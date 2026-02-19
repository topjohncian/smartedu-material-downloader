// ==UserScript==
// @name         [已更新]国家中小学智慧教育平台电子课本教材下载 最新版[直接下载pdf 跳过浏览器默认预览]
// @namespace    https://greasyfork.org/zh-CN/scripts/469898-smartedutextbookdownloader
// @version      2.0
// @description  在国家中小学智慧教育平台网站中添加电子课本下载按钮，支持列表批量下载，无需跳转，需要登录
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
"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // global-external:idb
  var require_idb = __commonJS({
    "global-external:idb"(exports, module) {
      module.exports = window.idb || self.idb || globalThis.idb;
    }
  });

  // smartedu.user.ts
  var idb = __toESM(require_idb(), 1);
  var CONSTANTS = {
    DB_NAME: "content-library_ncet-xedu",
    STORE_NAME: "NDR_TchMaterial",
    HOSTS: {
      DETAIL: ["//s-file-1.ykt.cbern.com.cn", "//s-file-2.ykt.cbern.com.cn"],
      DOWNLOAD: [
        "https://r1-ndr-private.ykt.cbern.com.cn",
        "https://r2-ndr-private.ykt.cbern.com.cn",
        "https://r3-ndr-private.ykt.cbern.com.cn"
      ]
    },
    SELECTORS: {
      LIST_UL: "#main-content > div.content > div.fish-spin-nested-loading.x-edu-nested-loading > div > div:nth-child(2) > div > div:nth-child(2) > div:nth-child(2) > ul",
      VERSION_LABEL: "#main-content > div.content > div.fish-spin-nested-loading.x-edu-nested-loading > div > div:nth-child(2) > div > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) >  label.fish-radio-tag-wrapper-checked > span:nth-child(2)",
      DETAIL_CONTAINER: "#main-content > div.content > div:last-child > div > div > div:nth-child(1)"
    }
  };
  var Utils = {
    randomItem(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },
    /**
     * Wait for an element to appear in the DOM
     * @param selector CSS selector
     * @param timeout Timeout in ms (default 30s)
     */
    waitForElement(selector, timeout = 6e4) {
      return new Promise((resolve) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const observer = new MutationObserver(() => {
          const el2 = document.querySelector(selector);
          if (el2) {
            observer.disconnect();
            resolve(el2);
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
    }
  };
  var Store = class {
    static materialInfo = [];
    static async init() {
      if (this.materialInfo.length > 0) return;
      try {
        const db = await idb.openDB(CONSTANTS.DB_NAME);
        this.materialInfo = await db.transaction(CONSTANTS.STORE_NAME, "readonly").objectStore(CONSTANTS.STORE_NAME).getAll();
      } catch (e) {
        console.error("[SMARTEDU] Failed to load material info:", e);
      }
    }
    static getMaterial(title, versionLabel) {
      const materials = this.materialInfo.filter((m) => m.title === title);
      if (materials.length === 0) return void 0;
      if (versionLabel) {
        const match = materials.find(
          (m) => m.tag_list.some((tag) => tag.tag_name === versionLabel)
        );
        if (match) return match;
      }
      return materials[0];
    }
  };
  var Auth = {
    getToken() {
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
    generateHeaders(url, token) {
      const nonce = `${Math.floor(Date.now() / 1e3) + token.diff}:${Math.random().toString(36).substring(2, 10)}`;
      const u = new URL(url);
      const relative = decodeURI(u.pathname) + u.search + u.hash || "/";
      const signingString = `${nonce}
GET
${relative}
${u.host}
`;
      const mac = CryptoJS.HmacSHA256(signingString, token.mac_key).toString(
        CryptoJS.enc.Base64
      );
      return {
        "x-nd-auth": `MAC id="${token.access_token}",nonce="${nonce}",mac="${mac}"`
      };
    }
  };
  var API = {
    async fetchDetail(id) {
      const host = Utils.randomItem(CONSTANTS.HOSTS.DETAIL);
      const res = await fetch(
        `${host}/zxx/ndrv2/resources/tch_material/details/${id}.json`
      );
      if (!res.ok) throw new Error(`Detail fetch failed: ${res.status}`);
      return res.json();
    },
    async downloadFile(url, token, fileName) {
      const headers = Auth.generateHeaders(url, token);
      const res = await fetch(url, {
        referrer: "https://basic.smartedu.cn/",
        referrerPolicy: "strict-origin-when-cross-origin",
        headers,
        cache: "no-store",
        mode: "cors"
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    }
  };
  var UI = {
    toast: {
      loading: (msg) => window.cocoMessage.loading(msg),
      success: (msg) => window.cocoMessage.success(msg),
      error: (msg) => window.cocoMessage.error(msg)
    },
    createButton(id, title) {
      const btn = document.createElement("button");
      btn.innerText = `\u4E0B\u8F7D ${title}.pdf`;
      btn.style.zIndex = "999";
      btn.onclick = (e) => this.handleDownload(e, id, title);
      return btn;
    },
    async handleDownload(e, id, title) {
      e.preventDefault();
      e.stopPropagation();
      const token = Auth.getToken();
      if (!token) {
        return this.toast.error("\u8BF7\u5148\u767B\u5F55\u8D26\u53F7\u540E\u91CD\u8BD5");
      }
      const closeLoading = this.toast.loading(`\u6B63\u5728\u4E0B\u8F7D ${title}.pdf`);
      try {
        const detail = await API.fetchDetail(id);
        const pdfItem = detail.ti_items?.find(
          (i) => i.ti_format === "pdf"
        );
        if (!pdfItem) throw new Error("\u672A\u627E\u5230PDF\u8D44\u6E90");
        const downloadUrl = pdfItem.ti_storage.replace(
          /^cs_path:\${ref-path}/,
          Utils.randomItem(CONSTANTS.HOSTS.DOWNLOAD)
        );
        await API.downloadFile(downloadUrl, token, `${title}.pdf`);
        this.toast.success(`\u4E0B\u8F7D\u5B8C\u6210 ${title}.pdf`);
      } catch (err) {
        console.error(err);
        this.toast.error(err.message || "\u4E0B\u8F7D\u5931\u8D25");
      } finally {
        closeLoading();
      }
    }
  };
  var Hooks = {
    async listPage() {
      const ul = await Utils.waitForElement(
        CONSTANTS.SELECTORS.LIST_UL
      );
      if (!ul) return;
      await Store.init();
      const update = () => {
        const items = ul.querySelectorAll("li > div:nth-child(2) > div:nth-child(1)");
        const labelEl = document.querySelector(CONSTANTS.SELECTORS.VERSION_LABEL);
        const versionLabel = labelEl?.innerText;
        items.forEach((div) => {
          if (div.querySelector("button")) return;
          const titleSpan = div.querySelector("span");
          if (!titleSpan) return;
          const material = Store.getMaterial(titleSpan.innerText, versionLabel);
          if (material) {
            div.querySelectorAll("button").forEach((b) => b.remove());
            div.appendChild(UI.createButton(material.id, material.title));
          }
        });
      };
      update();
      const observer = new MutationObserver(update);
      observer.observe(ul, { childList: true, subtree: true });
    },
    async detailPage() {
      const container = await Utils.waitForElement(
        CONSTANTS.SELECTORS.DETAIL_CONTAINER
      );
      if (!container) return;
      const id = new URLSearchParams(location.search).get("contentId");
      const title = container.querySelector("h3")?.innerText;
      if (id && title && !container.querySelector("button")) {
        container.appendChild(UI.createButton(id, title));
      }
    }
  };
  (function main() {
    const router = () => {
      const path = new URL(location.href).pathname;
      if (path === "/tchMaterial") Hooks.listPage();
      else if (path === "/tchMaterial/detail") Hooks.detailPage();
    };
    if (window.onurlchange === null) {
      window.addEventListener("urlchange", router);
    }
    router();
  })();
})();
// @license      MIT
