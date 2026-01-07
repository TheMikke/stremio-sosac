// server.js – Stremio addon backend pro Sosac + StreamujTV (modulární routy)

import http from "http";
import url from "url";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

import { serverConfig, sosacConfig } from "./config.js";
import SosacApi from "./sosacApi.js";

import { handleCatalog } from "./routes/catalog.js";
import { handleMeta } from "./routes/meta.js";
import { handleStream } from "./routes/stream.js";
import { sendError } from "./routes/utils.js";

import { renderConfigurePage, renderConfiguredPage, renderErrorPage } from "./routes/ui.js";

import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".js": "application/javascript; charset=utf-8",
};

function serveFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === "ENOENT") {
                sendError(res, 404, "Not found");
            } else {
                sendError(res, 500, "File read error");
            }
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime });
        res.end(data);
    });
}

function safeJoin(root, p) {
    const filePath = path.normalize(path.join(root, p));
    if (!filePath.startsWith(root)) return null;
    return filePath;
}

// extra string z path -> objekt { search, skip, ... }
function parseExtra(extraStr) {
    const extra = {};
    if (!extraStr) return extra;

    const parts = extraStr.split("&");
    for (const part of parts) {
        if (!part) continue;
        const [key, ...rest] = part.split("=");
        if (!key) continue;
        const value = rest.join("=");
        extra[decodeURIComponent(key)] = decodeURIComponent(value || "");
    }
    return extra;
}

// ----------------- NETWORK HELPERS -----------------------------

function getLanIPv4() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
            if (iface && iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null;
}

// ---------- Per-user config storage ----------
const PUBLIC_BASE = process.env.PUBLIC_BASE || ""; // např. https://addons.protozeproto.cz/stremio
const DATA_DIR = process.env.ADDON_DATA_DIR || path.join(__dirname, ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// jednoduché in-memory + file storage
let usersDb = {}; // { userKey: { sosac_user, sosac_pass, streamujtv_user, streamujtv_pass, streamujtv_location, createdAt } }
const apiCache = new Map(); // userKey -> SosacApi

function ensureDataDir() {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {}
}

function loadUsers() {
    ensureDataDir();
    try {
        const raw = fs.readFileSync(USERS_FILE, "utf-8");
        usersDb = JSON.parse(raw) || {};
    } catch {
        usersDb = {};
    }
}

function saveUsers() {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2), { mode: 0o600 });
}

function newUserKey() {
    return crypto.randomBytes(16).toString("hex");
}

// parse application/x-www-form-urlencoded
async function readForm(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString("utf-8");
    const out = {};
    for (const part of body.split("&")) {
        if (!part) continue;
        const [k, ...rest] = part.split("=");
        const v = rest.join("=");
        out[decodeURIComponent(k)] = decodeURIComponent(v || "");
    }
    return out;
}

function html(res, code, body) {
    res.writeHead(code, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
}

function json(res, code, obj) {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
}

function getApiForUser(userKey) {
    if (!userKey) return null;
    const cfg = usersDb[userKey];
    if (!cfg) return null;

    if (apiCache.has(userKey)) return apiCache.get(userKey);

    const perUserConfig = {
        sosac_domain: sosacConfig.sosac_domain,
        streaming_provider: sosacConfig.streaming_provider,
        sosac_user: cfg.sosac_user,
        sosac_pass: cfg.sosac_pass,
        streamujtv_user: cfg.streamujtv_user,
        streamujtv_pass: cfg.streamujtv_pass,
        streamujtv_location: cfg.streamujtv_location || "0",
    };

    const api = new SosacApi(perUserConfig);
    apiCache.set(userKey, api);
    return api;
}

loadUsers();

// ----------------- SERVER -----------------------------

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || "/";

    // --- per-user prefix /u/<userKey>/... ---
    let userKey = null;
    let effectivePath = pathname;

    const pathParts = pathname.split("/").filter(Boolean);
    if (pathParts[0] === "u" && pathParts.length >= 2) {
        userKey = pathParts[1];
        effectivePath = "/" + pathParts.slice(2).join("/");
        if (effectivePath === "/") effectivePath = "/";
    }

    // CORS pro Stremio
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // ---------- CONFIGURE ----------
    if (effectivePath === "/configure" && req.method === "GET") {
        return html(res, 200, renderConfigurePage());
    }

    if (effectivePath === "/configure" && req.method === "POST") {
        const form = await readForm(req);

        const sosac_user = (form.sosac_user || "").trim();
        const sosac_pass = (form.sosac_pass || "").trim();
        const streamujtv_user = (form.streamujtv_user || "").trim();
        const streamujtv_pass = (form.streamujtv_pass || "").trim();
        const streamujtv_location = "0";

        if (!sosac_user || !sosac_pass || !streamujtv_user || !streamujtv_pass) {
            return html(
                res,
                400,
                renderErrorPage({
                    status: 400,
                    title: "Chybí údaje",
                    message: "Chybí přihlašovací údaje (Sosáč i StreamujTV jsou povinné).",
                    backHref: "/configure",
                })
            );
        }

        const base = PUBLIC_BASE;
        if (!base) {
            return html(
                res,
                500,
                renderErrorPage({
                    status: 500,
                    title: "Chyba serveru",
                    message: "Není nastaven PUBLIC_BASE v env (např. https://addons.protozeproto.cz/stremio).",
                    backHref: "/configure",
                })
            );
        }

        const key = newUserKey();
        usersDb[key] = {
            sosac_user,
            sosac_pass,
            streamujtv_user,
            streamujtv_pass,
            streamujtv_location,
            createdAt: new Date().toISOString(),
        };
        saveUsers();

        const httpsManifest = `${base}/u/${key}/manifest.json`;
        return html(res, 200, renderConfiguredPage({ manifestUrl: httpsManifest }));
    }

    // manifest (public + per-user)
    if (effectivePath === "/manifest.json") {
        const manifestPath = path.join(__dirname, "manifest.json");
        const raw = fs.readFileSync(manifestPath, "utf-8");
        const m = JSON.parse(raw);

        // veřejný manifest (bez /u/<key>/)
        if (!userKey) {
            return json(res, 200, m);
        }

        // per-user manifest (unikátní instance)
        const short = userKey.slice(0, 6);
        m.id = `${m.id}:${userKey}`;
        m.name = `${m.name} (${short})`;

        if (PUBLIC_BASE) {
            m.logo = `${PUBLIC_BASE}/u/${userKey}/icon.png`;
            m.background = `${PUBLIC_BASE}/u/${userKey}/fanart.png`;
        }

        m.behaviorHints = m.behaviorHints || {};
        m.behaviorHints.configurationRequired = false;

        return json(res, 200, m);
    }

    // statické soubory: icon, fanart
    if (effectivePath === "/icon.png" || effectivePath === "/fanart.png") {
        const filePath = path.join(__dirname, effectivePath.replace("/", ""));
        return serveFile(res, filePath);
    }

    // statické soubory: assets/*
    if (effectivePath.startsWith("/assets/")) {
        const relPath = effectivePath.replace("/assets/", "");
        const root = path.join(__dirname, "assets");
        const filePath = safeJoin(root, relPath);
        if (!filePath) return sendError(res, 400, "Bad path");
        return serveFile(res, filePath);
    }

    const parts = effectivePath.split("/").filter(Boolean);

    // /catalog/{type}/{id}.json nebo /catalog/{type}/{id}/{extra}.json
    if (parts[0] === "catalog" && parts.length >= 3) {
        const type = parts[1];

        if (parts.length === 3) {
            const id = parts[2].replace(".json", "");
            const extra = {};
            const api = getApiForUser(userKey);
            if (!api) return json(res, 200, { metas: [] });
            return handleCatalog(api, req, res, type, id, extra);
        }

        const id = parts[2];
        const extraPart = parts[3].replace(".json", "");
        const extra = parseExtra(extraPart);
        const api = getApiForUser(userKey);
        if (!api) return json(res, 200, { metas: [] });
        return handleCatalog(api, req, res, type, id, extra);
    }

    // /meta/{type}/{id}.json
    if (parts[0] === "meta" && parts.length >= 3) {
        const type = parts[1];
        const id = parts[2].replace(".json", "");
        const api = getApiForUser(userKey);
        if (!api) return json(res, 404, { meta: null });
        return handleMeta(api, req, res, type, id);
    }

    // /stream/{type}/{id}.json
    if (parts[0] === "stream" && parts.length >= 3) {
        const type = parts[1];
        const id = parts[2].replace(".json", "");
        const api = getApiForUser(userKey);
        if (!api) return json(res, 200, { streams: [] });
        return handleStream(api, req, res, type, id);
    }

    // fallback
    sendError(res, 404, "Not found");
});

server.listen(serverConfig.port, serverConfig.host, () => {
    const host = serverConfig.host;
    const port = serverConfig.port;

    const bindHostForPrint = host === "0.0.0.0" || host === "::" ? "localhost" : host;
    console.log(`Stremio Sosac addon listening on http://${bindHostForPrint}:${port}`);

    const lanIp = getLanIPv4();
    if (lanIp) {
        console.log(`LAN URL:    http://${lanIp}:${port}/manifest.json`);
    } else {
        console.log(`LAN URL:    (LAN IP not detected) http://<LAN-IP>:${port}/manifest.json`);
    }

    const publicUrl = process.env.PUBLIC_URL;
    if (publicUrl) console.log(`Public URL: ${publicUrl}`);
    else console.log("Public URL: (not set) set PUBLIC_URL env var");
});
