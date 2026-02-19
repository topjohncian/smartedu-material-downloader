/**
 * smartedu MAC Authorization Header Generator
 *
 * 根据逆向分析的代码，实现获取 hmac_key (MAC Authorization Header) 的逻辑。
 * 用于访问 r2-ndr-private.ykt.cbern.com.cn 等私有 CDN 资源。
 *
 * 依赖: crypto-js (浏览器环境可用 CDN，Node.js 环境需 npm install crypto-js)
 *
 * ── 流程说明 ──
 * 1. 先通过平台登录接口获取 token（包含 access_token, mac_key, diff 等字段）
 * 2. 用 token 中的信息 + 请求 URL 生成 MAC Authorization Header
 * 3. 将 Header 放入 HTTP 请求的 Authorization 字段即可访问私有资源
 */

// ============================================================
// ▸ Node.js 环境
// ============================================================
import CryptoJS from "crypto-js";

// 如果在 UserScript / 浏览器环境中使用，改为:
// @require https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js
// 然后直接用全局 CryptoJS

// ────────────────────────────────────────────────────────────
// URL 解析 —— 对应逆向代码中的 f.parse(url)
// ────────────────────────────────────────────────────────────
function parseUrl(url) {
    const u = new URL(url);
    // 使用 decodeURI 还原 percent-encoded 的中文字符，
    // 因为原始 f.parse() 保留原始路径，服务器端签名验证也使用原始路径
    const pathname = decodeURI(u.pathname);
    const search = u.search;
    const hash = u.hash;
    const relative = pathname + search + hash;
    return {
        protocol: u.protocol.replace(":", ""),
        authority: u.host, // host:port (若无端口则仅 host)
        host: u.hostname,
        port: u.port,
        relative: relative || "/",
        path: pathname,
        query: search.replace("?", ""),
        anchor: hash.replace("#", ""),
        source: url,
    };
}

// ────────────────────────────────────────────────────────────
// Nonce 生成 —— 对应逆向代码中的 Fe(diff)
// ────────────────────────────────────────────────────────────
/**
 * 生成 nonce 字符串
 *
 * 逆向分析：nonce 格式通常为  `<timestamp_seconds>:<random_string>`
 * 其中 timestamp 需要加上 diff（服务器时间偏移量，单位秒）
 *
 * @param {number} diff - token 中的 diff 值（客户端与服务器的时间差，单位秒）
 * @returns {string} nonce
 */
function generateNonce(diff = 0) {
    // 当前时间戳（秒）+ diff 校正
    const timestamp = Math.floor(Date.now() / 1000) + diff;
    // 随机字符串部分
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}:${random}`;
}

// ────────────────────────────────────────────────────────────
// HMAC-SHA256 签名 —— 对应逆向代码中的 ze(url, nonce, method, macKey)
// ────────────────────────────────────────────────────────────
/**
 * 计算请求的 MAC 签名
 *
 * 签名字符串格式 (每行以 \n 结尾):
 *   <nonce>\n
 *   <METHOD>\n
 *   <relative_url>\n
 *   <host>\n
 *
 * @param {string} url       - 完整的请求 URL
 * @param {string} nonce     - 由 generateNonce 生成的 nonce
 * @param {string} method    - HTTP 方法 (GET/POST/...)
 * @param {string} macKey    - token 中的 mac_key
 * @returns {string} Base64 编码的 HMAC-SHA256 签名
 */
function computeMac(url, nonce, method, macKey) {
    const parsed = parseUrl(url);
    const signingString =
        nonce +
        "\n" +
        method.toUpperCase() +
        "\n" +
        parsed.relative +
        "\n" +
        parsed.authority +
        "\n";

    return CryptoJS.HmacSHA256(signingString, macKey).toString(
        CryptoJS.enc.Base64
    );
}

// ────────────────────────────────────────────────────────────
// 生成完整 Authorization Header —— 对应逆向代码中的 He(url, method, token)
// ────────────────────────────────────────────────────────────
/**
 * 生成 MAC Authorization Header
 *
 * @param {string} url    - 请求的完整 URL
 * @param {object} token  - 登录后获取的 token 对象，需包含:
 *   - access_token {string}
 *   - mac_key      {string}
 *   - diff         {number} (客户端与服务器时间差，秒)
 * @param {string} [method="GET"] - HTTP 请求方法
 * @returns {string} 完整的 Authorization header 值
 *
 * @example
 * const header = generateMacHeader(
 *   "https://r2-ndr-private.ykt.cbern.com.cn/edu_product/esp/assets/xxx.pdf",
 *   { access_token: "...", mac_key: "...", diff: 296 }
 * );
 * // => 'MAC id="<access_token>",nonce="<nonce>",mac="<hmac>"'
 */
function generateMacHeader(url, token, method = "GET") {
    const { access_token: accessToken, mac_key: macKey, diff } = token;
    const nonce = generateNonce(diff);
    const mac = computeMac(url, nonce, method, macKey);
    return `MAC id="${accessToken}",nonce="${nonce}",mac="${mac}"`;
}

// ────────────────────────────────────────────────────────────
// 解析 MAC Header —— 对应逆向代码中的 Ke(headerStr, url)
// ────────────────────────────────────────────────────────────
/**
 * 解析已有的 MAC Authorization Header
 *
 * @param {string} headerStr - MAC header 字符串
 * @param {string} url       - 原始请求 URL (用于提取 request_uri 和 host)
 * @returns {object} { access_token, nonce, mac, request_uri, host }
 */
function parseMacHeader(headerStr, url) {
    const macMatch = headerStr.match(
        /MAC id="([^"]*)",nonce="([^"]*)",mac="([^"]*)"/
    );
    const extMatch = headerStr.match(
        /request_uri="([^"]*)",host="([^"]*)"/
    );
    const parsed = parseUrl(url);

    return {
        access_token: macMatch?.[1] ?? "",
        nonce: macMatch?.[2] ?? "",
        mac: macMatch?.[3] ?? "",
        request_uri: extMatch ? extMatch[1] : parsed.relative || "/",
        host: extMatch ? extMatch[2] : parsed.authority,
    };
}

// ============================================================
// ▸ 导出
// ============================================================
export {
    generateMacHeader,
    computeMac,
    generateNonce,
    parseMacHeader,
    parseUrl,
};

// ============================================================
// ▸ 使用示例 / 测试
// ============================================================

// ---- 示例 token（来自 debug.js 中的逆向数据）----
const exampleToken = {
    access_token:
        "73AD",
    mac_key: "aqf",
    diff: 296,
};

const exampleUrl =
    "https://r2-ndr-private.ykt.cbern.com.cn/edu_product/esp/assets/437cc71c-b382-467e-b3d4-256222913fe7.pkg/义务教育教科书（五·四学制） 数学 六年级 上册_1756191625306.pdf";

const authHeader = generateMacHeader(exampleUrl, exampleToken);
console.log("=== MAC Authorization Header ===");
console.log(authHeader);
console.log();

// 验证：解析刚刚生成的 header
const parsed = parseMacHeader(authHeader, exampleUrl);
console.log("=== Parsed Header ===");
console.log(JSON.stringify(parsed, null, 2));
console.log();

// 单独演示签名过程
const nonce = generateNonce(exampleToken.diff);
const mac = computeMac(exampleUrl, nonce, "GET", exampleToken.mac_key);
console.log("=== 签名细节 ===");
console.log("Nonce:", nonce);
console.log("MAC:  ", mac);
