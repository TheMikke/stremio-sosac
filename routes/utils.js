// routes/utils.js

// Odeslání JSONu
export function sendJson(res, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8"
    });
    res.end(body);
}

// Odeslání chyby
export function sendError(res, status, message) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8"
    });
    res.end(JSON.stringify({ error: message || "error" }));
}

// Najde první "l" v Sosac JSONu – link ID pro StreamujTV
export function findLinkId(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (Object.prototype.hasOwnProperty.call(obj, "l") && obj.l) {
        return obj.l;
    }
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val && typeof val === "object") {
            const r = findLinkId(val);
            if (r) return r;
        }
    }
    return null;
}

// Vrátí český název z pole n.cs
export function getTitleCs(n) {
    if (!n) return "";
    const cs = n.cs || n["cs"];
    if (!cs) return "";
    return Array.isArray(cs) ? cs[0] : cs;
}

function getTitleEn(n) {
    if (!n) return "";
    if (typeof n === "string") return n;
    if (n.us) return Array.isArray(n.us) ? n.us[0] : n.us;
    if (n.en) return Array.isArray(n.en) ? n.en[0] : n.en;
    if (n.cs) return Array.isArray(n.cs) ? n.cs[0] : n.cs;
    return "";
}
