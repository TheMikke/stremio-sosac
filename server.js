// server.js – Stremio addon backend pro Sosac + StreamujTV (modulární routy)

import http from "http";
import url from "url";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { serverConfig, sosacConfig } from "./config.js";
import SosacApi from "./sosacApi.js";

import { handleCatalog } from "./routes/catalog.js";
import { handleMeta } from "./routes/meta.js";
import { handleStream } from "./routes/stream.js";
import { sendError } from "./routes/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const api = new SosacApi(sosacConfig);

const MIME_TYPES = {
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".js": "application/javascript; charset=utf-8"
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
    if (!filePath.startsWith(root)) {
        return null;
    }
    return filePath;
}

// extra string z path -> objekt { search, skip, ... }
function parseExtra(extraStr) {
    const extra = {};
    if (!extraStr) return extra;

    // extraStr vypadá např. "search=matrix&skip=100"
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

// ----------------- SERVER -----------------------------

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || "/";

    // CORS pro Stremio
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // manifest
    if (pathname === "/manifest.json") {
        const manifestPath = path.join(__dirname, "manifest.json");
        return serveFile(res, manifestPath);
    }

    // statické soubory: icon, fanart
    if (pathname === "/icon.png" || pathname === "/fanart.png") {
        const filePath = path.join(__dirname, pathname.replace("/", ""));
        return serveFile(res, filePath);
    }

    // statické soubory: assets/*
    if (pathname.startsWith("/assets/")) {
        const relPath = pathname.replace("/assets/", "");
        const root = path.join(__dirname, "assets");
        const filePath = safeJoin(root, relPath);
        if (!filePath) {
            return sendError(res, 400, "Bad path");
        }
        return serveFile(res, filePath);
    }

    const parts = pathname.split("/").filter(Boolean);
    // příklady:
    // /catalog/movie/sosac-movies.json
    //   -> ["catalog","movie","sosac-movies.json"]
    // /catalog/movie/sosac-movies/search=matrix&skip=100.json
    //   -> ["catalog","movie","sosac-movies","search=matrix&skip=100.json"]

    // /catalog/{type}/{id}.json nebo /catalog/{type}/{id}/{extra}.json
    if (parts[0] === "catalog" && parts.length >= 3) {
        const type = parts[1];

        // bez extra: /catalog/:type/:id.json
        if (parts.length === 3) {
            const id = parts[2].replace(".json", "");
            const extra = {};
            return handleCatalog(api, req, res, type, id, extra);
        }

        // s extra: /catalog/:type/:id/:extra.json
        const id = parts[2];
        const extraPart = parts[3].replace(".json", "");
        const extra = parseExtra(extraPart);

        return handleCatalog(api, req, res, type, id, extra);
    }

    // /meta/{type}/{id}.json
    if (parts[0] === "meta" && parts.length >= 3) {
        const type = parts[1];
        const id = parts[2].replace(".json", "");
        return handleMeta(api, req, res, type, id);
    }

    // /stream/{type}/{id}.json
    if (parts[0] === "stream" && parts.length >= 3) {
        const type = parts[1];
        const id = parts[2].replace(".json", "");
        return handleStream(api, req, res, type, id);
    }

    // fallback
    sendError(res, 404, "Not found");
});

server.listen(serverConfig.port, serverConfig.host, () => {
    console.log(
        `Stremio Sosac addon listening on http://${serverConfig.host}:${serverConfig.port}`
    );
    console.log(
        `LAN URL:    http://192.168.0.127:${serverConfig.port}/manifest.json`
    );
    console.log(
        `Funnel URL: https://raspberrypi.napoleon-degree.ts.net/manifest.json`
    );
});
