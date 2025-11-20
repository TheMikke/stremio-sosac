// routes/stream.js

import { sendJson, sendError, findLinkId } from "./utils.js";

// /stream/{type}/{id}.json
export async function handleStream(api, req, res, type, id) {
    try {
        // ---------- FILMY ----------
        if (type === "movie" && id.startsWith("sosac-movie-")) {
            const movieId = id.replace("sosac-movie-", "");
            console.log("STREAM movie, sosac ID:", movieId);

            // 1) Detail filmu ze Sosáče
            const data = await api.movies("id", { arg2: movieId });
            // Najdeme Streamuj.tv ID (linkId)
            const linkId = findLinkId(data);
            console.log("Nalezen linkId pro Streamuj.tv:", linkId);

            if (!linkId) {
                console.log("Nenalezen linkId, vracím prázdné streams");
                return sendJson(res, { streams: [] });
            }

            // 2) Streamuj.tv JSON
            const streamData = await api.streamujGet(linkId);
            console.log("Odpověď ze Streamuj.tv:", streamData);

            // Ověření odpovědi
            if (!streamData || streamData.result !== 1) {
                console.log("Streamuj.tv vrátil chybu nebo result != 1");
                return sendJson(res, { streams: [] });
            }

            if (!streamData.URL || typeof streamData.URL !== "object") {
                console.log("Streamuj.tv nevrátil URL objekt");
                return sendJson(res, { streams: [] });
            }

            const streams = [];

            // Projdeme jazyky (většinou jen CZ)
            for (const lang of Object.keys(streamData.URL)) {
                const qualityObj = streamData.URL[lang] || {};

                for (const qual of Object.keys(qualityObj)) {
                    const link = qualityObj[qual];
                    if (!link) continue;

                    // Tohle je přesně objekt, jaký Stremio očekává
                    streams.push({
                        title: `${lang} ${qual}`, // např. "CZ HD"
                        url: link,                // http(s) URL, co přehraje Stremio / service
                        isFree: true
                    });
                }
            }

            console.log("VRACÍM STREAMY PRO STREMIO:", streams);
            return sendJson(res, { streams });
        }

        // ---------- EPIZODY (zjednodušeně) ----------
        if (type === "series" && id.startsWith("sosac-episode-")) {
            const epId = id.replace("sosac-episode-", "");
            console.log("STREAM episode, sosac ID:", epId);

            // pro epizody zkusíme detail přes episodes
            const data = await api.serials("", { arg2: epId, arg3: "episodes" });
            const linkId = findLinkId(data);
            console.log("Nalezen linkId pro Streamuj.tv (episode):", linkId);

            if (!linkId) {
                console.log("Nenalezen linkId u epizody, vracím prázdné streams");
                return sendJson(res, { streams: [] });
            }

            const streamData = await api.streamujGet(linkId);
            console.log("Odpověď ze Streamuj.tv (episode):", streamData);

            if (!streamData || streamData.result !== 1 || !streamData.URL) {
                return sendJson(res, { streams: [] });
            }

            const streams = [];
            for (const lang of Object.keys(streamData.URL)) {
                const qualityObj = streamData.URL[lang] || {};
                for (const qual of Object.keys(qualityObj)) {
                    const link = qualityObj[qual];
                    if (!link) continue;

                    streams.push({
                        title: `${lang} ${qual}`,
                        url: link,
                        isFree: true
                    });
                }
            }

            console.log("VRACÍM STREAMY PRO STREMIO (episode):", streams);
            return sendJson(res, { streams });
        }

        // ---------- Ostatní typy – nic ----------
        console.log("Stream handler: neznámý typ/id:", type, id);
        return sendJson(res, { streams: [] });
    } catch (e) {
        console.error("Stream error:", e);
        sendError(res, 500, "Stream error: " + e.message);
    }
}
