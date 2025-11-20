// routes/stream.js

import { sendJson, sendError, findLinkId } from "./utils.js";

// /stream/{type}/{id}.json
export async function handleStream(api, req, res, type, id) {
    try {
        // Zatím řešíme jen FILMY (movie)
        if (type === "movie" && id.startsWith("sosac-movie-")) {
            const movieId = id.replace("sosac-movie-", "");

            // 1) Dotaz na Sosáč – detail filmu
            const data = await api.movies("id", { arg2: movieId });

            // 2) Z detailu vytáhneme ID linku pro streamuj.tv
            const linkId = findLinkId(data);
            if (!linkId) {
                console.log("Nenalezen linkId pro film", movieId);
                return sendJson(res, { streams: [] });
            }

            console.log("Nalezen linkId pro Streamuj.tv:", linkId);

            // 3) Zavoláme JSON API streamuj.tv, dostaneme strukturu s URL
            const streamData = await api.streamujGet(linkId);
            console.log("JSON z Streamuj.tv:", streamData);

            const urlRoot = streamData.URL || streamData.Url || null;
            if (!urlRoot || typeof urlRoot !== "object") {
                console.log("Streamuj.tv nevrátil URL objekt");
                return sendJson(res, { streams: [] });
            }

            // 4) vybereme jazyk – preferuj CZ, jinak první
            const langKeys = Object.keys(urlRoot);
            if (!langKeys.length) {
                console.log("Streamuj.tv neobsahuje žádné jazykové větve");
                return sendJson(res, { streams: [] });
            }

            let lang = langKeys[0];
            for (const pref of ["CZ", "CZECH", "Sk", "SK", "EN", "ENGLISH"]) {
                if (langKeys.includes(pref)) {
                    lang = pref;
                    break;
                }
            }

            const qualityObj = urlRoot[lang];
            if (!qualityObj || typeof qualityObj !== "object") {
                console.log("Streamuj.tv: chybí quality objekt pro jazyk", lang);
                return sendJson(res, { streams: [] });
            }

            const qualities = Object.keys(qualityObj)
                .filter(q => q.toLowerCase() !== "subtitles");

            if (!qualities.length) {
                console.log("Streamuj.tv: žádné kvality pro jazyk", lang);
                return sendJson(res, { streams: [] });
            }

            // 5) Postavíme pole streams pro Stremio
            const streams = [];

            // pokud existuje HD, dáme ho jako první
            if (qualityObj.HD) {
                streams.push({
                    title: `${lang} HD`,
                    url: qualityObj.HD,
                    isFree: true
                });
            }
            if (qualityObj.SD) {
                streams.push({
                    title: `${lang} SD`,
                    url: qualityObj.SD,
                    isFree: true
                });
            }

            // fallback – kdyby byly jiné klíče (1080p, 720p, original…)
            if (!streams.length) {
                for (const q of qualities) {
                    const u = qualityObj[q];
                    if (!u) continue;
                    streams.push({
                        title: `${lang} ${q}`,
                        url: u,
                        isFree: true
                    });
                }
            }

            console.log("VRACÍM STREAMY PRO STREMIO:", streams);

            return sendJson(res, { streams });
        }

        // Ostatní typy (series atd.) zatím vrací prázdné streamy
        return sendJson(res, { streams: [] });

    } catch (e) {
        console.error("Stream error:", e);
        sendError(res, 500, "Stream error: " + e.message);
    }
}
