// routes/stream.js

import { sendJson, sendError, findLinkId } from "./utils.js";

// Pomocná funkce: z odpovědi Streamuj.tv postaví pole streamů pro Stremio
async function buildStreamsFromStreamuj(api, streamData, logPrefix = "") {
    if (!streamData || streamData.result !== 1) {
        console.log(logPrefix, "Streamuj.tv vrátil chybu nebo result != 1");
        return [];
    }

    if (!streamData.URL || typeof streamData.URL !== "object") {
        console.log(logPrefix, "Streamuj.tv nevrátil URL objekt");
        return [];
    }

    const candidates = [];

    // Projdeme všechny jazyky a všechny kvality (nejen SD/HD)
    for (const lang of Object.keys(streamData.URL)) {
        const qualityObj = streamData.URL[lang] || {};

        for (const qual of Object.keys(qualityObj)) {
            const playerUrl = qualityObj[qual];

            // subtitles apod. někdy vrací objekt -> přeskočíme
            if (!playerUrl || typeof playerUrl !== "string") {
                console.log(
                    logPrefix,
                    "Přeskakuji ne-video položku:",
                    lang,
                    qual,
                    typeof playerUrl
                );
                continue;
            }

            candidates.push({
                title: `${lang} ${qual}`, // např. "CZ HD", "EN SD", ...
                playerUrl
            });
        }
    }

    const streams = [];

    // Pro každý "player" odkaz (https://www.streamuj.tv/video/...)
    // zkusíme najít přímé video URL (mp4/mkv/webm/m3u8)
    for (const cand of candidates) {
        const directUrl = await api.resolveStreamujDirectUrl(cand.playerUrl);

        if (!directUrl) {
            console.log(
                logPrefix,
                "Nepodařilo se najít přímé video URL, použiju fallback playerUrl:",
                cand.playerUrl
            );
        } else {
            console.log(logPrefix, "Používám přímé video URL:", directUrl);
        }

        streams.push({
            title: cand.title,
            url: directUrl || cand.playerUrl, // když selže resolver, aspoň fallback
            isFree: true
        });
    }

    console.log(logPrefix, "VRACÍM STREAMY PRO STREMIO:", streams);
    return streams;
}

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

            const streams = await buildStreamsFromStreamuj(
                api,
                streamData,
                "[FILM]"
            );

            return sendJson(res, { streams });
        }

        // ---------- EPIZODY ----------
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

            const streams = await buildStreamsFromStreamuj(
                api,
                streamData,
                "[EPIZODA]"
            );

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
