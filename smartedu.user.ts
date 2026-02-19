// ==UserScript==
// @name         国家中小学智慧教育平台电子课本教材下载 最新版[直接下载pdf 跳过浏览器默认预览]
// @namespace    https://greasyfork.org/zh-CN/scripts/469898-smartedutextbookdownloader
// @version      1.7
// @description  在国家中小学智慧教育平台网站中添加电子课本下载按钮，在列表中无需跳转，无需登录，批量下载
// @author       @topjohncian
// @require      https://unpkg.com/idb@7/build/umd.js
// @require      https://unpkg.com/coco-message@2.0.3/coco-message.min.js
// @require      https://unpkg.com/crypto-js@4.2.0/crypto-js.js
// @match        *://basic.smartedu.cn/*
// @connect      r1-ndr.ykt.cbern.com.cn
// @connect      r2-ndr.ykt.cbern.com.cn
// @connect      r3-ndr.ykt.cbern.com.cn
// @connect      r1-ndr-private.ykt.cbern.com.cn
// @connect      r2-ndr-private.ykt.cbern.com.cn
// @connect      r3-ndr-private.ykt.cbern.com.cn
// @license      MIT
// @grant        window.onurlchange
// ==/UserScript==

import * as idb from "idb";

// ────────────────────────────────────────────────────────────
// Types & Constants
// ────────────────────────────────────────────────────────────

interface AuthToken {
  access_token: string;
  mac_key: string;
  diff: number;
}

interface MaterialInfoItem {
  id: string;
  title: string;
  tag_list: Array<{ tag_name: string }>;
}

const CONSTANTS = {
  DB_NAME: "content-library_ncet-xedu",
  STORE_NAME: "NDR_TchMaterial",
  HOSTS: {
    DETAIL: ["//s-file-1.ykt.cbern.com.cn", "//s-file-2.ykt.cbern.com.cn"],
    DOWNLOAD: [
      "https://r1-ndr-private.ykt.cbern.com.cn",
      "https://r2-ndr-private.ykt.cbern.com.cn",
      "https://r3-ndr-private.ykt.cbern.com.cn",
    ],
  },
  SELECTORS: {
    LIST_UL:
      "#main-content > div.content > div.fish-spin-nested-loading.x-edu-nested-loading > div > div:nth-child(2) > div > div:nth-child(2) > div:nth-child(2) > ul",
    VERSION_LABEL:
      "#main-content > div.content > div.fish-spin-nested-loading.x-edu-nested-loading > div > div:nth-child(2) > div > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) >  label.fish-radio-tag-wrapper-checked > span:nth-child(2)",
    DETAIL_CONTAINER:
      "#main-content > div.content > div:last-child > div > div > div:nth-child(1)",
  },
};

// ────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────

const Utils = {
  randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  /**
   * Wait for an element to appear in the DOM
   * @param selector CSS selector
   * @param timeout Timeout in ms (default 30s)
   */
  waitForElement<T extends Element>(
    selector: string,
    timeout = 60000
  ): Promise<T | null> {
    return new Promise((resolve) => {
      const el = document.querySelector<T>(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = document.querySelector<T>(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      if (timeout > 0) {
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, timeout);
      }
    });
  },
};

// ────────────────────────────────────────────────────────────
// State Management
// ────────────────────────────────────────────────────────────

class Store {
  private static materialInfo: MaterialInfoItem[] = [];

  static async init() {
    if (this.materialInfo.length > 0) return;
    try {
      const db = await idb.openDB(CONSTANTS.DB_NAME);
      this.materialInfo = await db
        .transaction(CONSTANTS.STORE_NAME, "readonly")
        .objectStore(CONSTANTS.STORE_NAME)
        .getAll();
    } catch (e) {
      console.error("[SMARTEDU] Failed to load material info:", e);
    }
  }

  static getMaterial(title: string, versionLabel?: string): MaterialInfoItem | undefined {
    const materials = this.materialInfo.filter((m) => m.title === title);
    if (materials.length === 0) return undefined;

    if (versionLabel) {
      const match = materials.find((m) =>
        (m.tag_list as any[]).some((tag) => tag.tag_name === versionLabel)
      );
      if (match) return match;
    }
    return materials[0];
  }
}

// ────────────────────────────────────────────────────────────
// Auth Module
// ────────────────────────────────────────────────────────────

const Auth = {
  getToken(): AuthToken | null {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("ND_UC_AUTH-") && key.endsWith("&ncet-xedu&token")) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const { value } = JSON.parse(raw);
          const { access_token, mac_key, diff } = JSON.parse(value);
          return { access_token, mac_key, diff };
        }
      }
    } catch (e) {
      console.error("[SMARTEDU] Token parse error:", e);
    }
    return null;
  },

  generateHeaders(url: string, token: AuthToken): Record<string, string> {
    const nonce = `${Math.floor(Date.now() / 1000) + token.diff}:${Math.random()
      .toString(36)
      .substring(2, 10)}`;
    const u = new URL(url);
    const relative = decodeURI(u.pathname) + u.search + u.hash || "/";
    const signingString = `${nonce}\nGET\n${relative}\n${u.host}\n`;
    const mac = CryptoJS.HmacSHA256(signingString, token.mac_key).toString(
      CryptoJS.enc.Base64
    );

    return {
      "x-nd-auth": `MAC id="${token.access_token}",nonce="${nonce}",mac="${mac}"`,
    };
  },
};

// ────────────────────────────────────────────────────────────
// API Module
// ────────────────────────────────────────────────────────────

const API = {
  async fetchDetail(id: string) {
    const host = Utils.randomItem(CONSTANTS.HOSTS.DETAIL);
    const res = await fetch(
      `${host}/zxx/ndrv2/resources/tch_material/details/${id}.json`
    );
    if (!res.ok) throw new Error(`Detail fetch failed: ${res.status}`);
    return res.json();
  },

  async downloadFile(url: string, token: AuthToken, fileName: string) {
    const headers = Auth.generateHeaders(url, token);
    const res = await fetch(url, {
      referrer: "https://basic.smartedu.cn/",
      referrerPolicy: "strict-origin-when-cross-origin",
      headers,
      cache: "no-store",
      mode: "cors",
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(blobUrl);
  },
};

// ────────────────────────────────────────────────────────────
// UI Module
// ────────────────────────────────────────────────────────────

const UI = {
  toast: {
    loading: (msg: string) => window.cocoMessage.loading(msg),
    success: (msg: string) => window.cocoMessage.success(msg),
    error: (msg: string) => window.cocoMessage.error(msg),
  },

  createButton(id: string, title: string) {
    const btn = document.createElement("button");
    btn.innerText = `下载 ${title}.pdf`;
    btn.style.zIndex = "999";
    btn.onclick = (e) => this.handleDownload(e, id, title);
    return btn;
  },

  async handleDownload(e: MouseEvent, id: string, title: string) {
    e.preventDefault();
    e.stopPropagation();

    const token = Auth.getToken();
    if (!token) {
      return this.toast.error("请先登录账号后重试");
    }

    const closeLoading = this.toast.loading(`正在下载 ${title}.pdf`);

    try {
      const detail = await API.fetchDetail(id);
      const pdfItem = detail.ti_items?.find(
        (i: any) => i.ti_format === "pdf"
      );
      if (!pdfItem) throw new Error("未找到PDF资源");

      const downloadUrl = pdfItem.ti_storage.replace(
        /^cs_path:\${ref-path}/,
        Utils.randomItem(CONSTANTS.HOSTS.DOWNLOAD)
      );

      await API.downloadFile(downloadUrl, token, `${title}.pdf`);
      this.toast.success(`下载完成 ${title}.pdf`);
    } catch (err: any) {
      console.error(err);
      this.toast.error(err.message || "下载失败");
    } finally {
      closeLoading();
    }
  },
};

// ────────────────────────────────────────────────────────────
// Hooks
// ────────────────────────────────────────────────────────────

const Hooks = {
  async listPage() {
    const ul = await Utils.waitForElement<HTMLUListElement>(
      CONSTANTS.SELECTORS.LIST_UL
    );
    if (!ul) return;

    await Store.init();

    const update = () => {
      const items = ul.querySelectorAll("li > div:nth-child(2) > div:nth-child(1)");

      // Get version label
      const labelEl = document.querySelector<HTMLSpanElement>(CONSTANTS.SELECTORS.VERSION_LABEL);
      const versionLabel = labelEl?.innerText;

      items.forEach((div) => {
        if (div.querySelector("button")) return; // Already processed

        const titleSpan = div.querySelector("span");
        if (!titleSpan) return;

        const material = Store.getMaterial(titleSpan.innerText, versionLabel);
        if (material) {
          // Remove old buttons first to be safe
          div.querySelectorAll("button").forEach(b => b.remove());
          div.appendChild(UI.createButton(material.id, material.title));
        }
      });
    };

    // Initial update
    update();

    // Watch for list changes
    const observer = new MutationObserver(update);
    observer.observe(ul, { childList: true, subtree: true });
  },

  async detailPage() {
    const container = await Utils.waitForElement<HTMLDivElement>(
      CONSTANTS.SELECTORS.DETAIL_CONTAINER
    );
    if (!container) return;

    const id = new URLSearchParams(location.search).get("contentId");
    const title = container.querySelector("h3")?.innerText;

    if (id && title && !container.querySelector("button")) {
      container.appendChild(UI.createButton(id, title));
    }
  },
};

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

(function main() {
  const router = () => {
    const path = new URL(location.href).pathname;
    if (path === "/tchMaterial") Hooks.listPage();
    else if (path === "/tchMaterial/detail") Hooks.detailPage();
  };

  if ((window as any).onurlchange === null) {
    window.addEventListener("urlchange", router);
  }
  router(); // Initial run
})();
