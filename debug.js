
const token = { "source_token_account_type": "person", "tenant_id": 0, "server_time": "2026-02-19T15:20:33.686+0800", "account_type": "org", "mac_key": "", "mac_algorithm": "hmac-sha-256", "access_token": "", "refresh_token": "7F", "account_id": "0", "expires_at": "2026-02-26T15:03:09.059+0800", "user_id": "", "first_create_time": 0, "auth_verify_types": ["PASSWORD"], "region": "wx", "diff": 296 }

const o = { "anchor": "", "query": "", "file": "义务教育教科书（五·四学制） 数学 六年级 上册_1756191625306.pdf", "directory": "/edu_product/esp/assets/437cc71c-b382-467e-b3d4-256222913fe7.pkg/", "path": "/edu_product/esp/assets/437cc71c-b382-467e-b3d4-256222913fe7.pkg/义务教育教科书（五·四学制） 数学 六年级 上册_1756191625306.pdf", "relative": "/edu_product/esp/assets/437cc71c-b382-467e-b3d4-256222913fe7.pkg/义务教育教科书（五·四学制） 数学 六年级 上册_1756191625306.pdf", "port": "", "host": "r2-ndr-private.ykt.cbern.com.cn", "password": "", "user": "", "userInfo": "", "authority": "r2-ndr-private.ykt.cbern.com.cn", "protocol": "https", "source": "https://r2-ndr-private.ykt.cbern.com.cn/edu_product/esp/assets/437cc71c-b382-467e-b3d4-256222913fe7.pkg/义务教育教科书（五·四学制） 数学 六年级 上册_1756191625306.pdf", "queryKey": {} }


function He(e) {
    var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "GET"
        , n = arguments.length > 2 ? arguments[2] : void 0
        , r = n.accessToken
        , o = n.macKey
        , i = n.diff
        , s = Fe(i)
        , a = ze(e, s, t, o)
        , c = 'MAC id="'.concat(r, '",nonce="').concat(s, '",mac="').concat(a, '"');
    return c
}
function Ke() {
    var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : ""
        , t = arguments.length > 1 ? arguments[1] : void 0
        , n = e.match('MAC id="([^"]*)",nonce="([^"]*)",mac="([^"]*)"')
        , r = e.match('request_uri="([^"]*)",host="([^"]*)"')
        , o = f.parse(t)
        , i = n[1]
        , s = n[2]
        , a = n[3]
        , c = r ? r[1] : o.relative || "/"
        , u = r ? r[2] : o.authority;
    return {
        access_token: i,
        nonce: s,
        mac: a,
        request_uri: c,
        host: u
    }
}
function ze(e, t, n, r) {
    var o = f.parse(e)
        , i = t + "\n" + n.toUpperCase() + "\n" + o.relative + "\n" + o.authority + "\n";
    return ee.HmacSHA256(i, r).toString(ee.enc.Base64)
}

const hmac_key = He("https://r2-ndr-private.ykt.cbern.com.cn/edu_product/esp/assets/437cc71c-b382-467e-b3d4-256222913fe7.pkg/义务教育教科书（五·四学制） 数学 六年级 上册_1756191625306.pdf")