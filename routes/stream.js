// routes/stream.js

import { sendJson, sendError, findLinkId } from "./utils.js";

// /stream/{type}/{id}.json
export async function handleStream(api, req, res, type, id) {
    try {
        // FILM
        if (type === "movie" && id.startsWith("sosac-movie-")) {
            const movieId = id.replace("sosac-movie-", "");
            const data = await api.movies("id", { arg2: movieId });

            const linkId = findLinkId(data);
            if (!linkId) {
                return sendJson(res, { streams: [] });
            }

            const streamData = await api.streamujGet(linkId);
            const urls = streamData.URL || streamData.Url || {};

            const langKeys = Object.keys(urls);
            if (!langKeys.length) return sendJson(res, { streams: [] });

            const preferredLangOrder = ["CZECH", "CZ", "SK", "ENGLISH", "EN"];
            let lang = langKeys[0];
            for (const L of preferredLangOrder) {
                if (langKeys.includes(L)) {
                    lang = L;
                    break;
                }
            }

            const qualities = Object.keys(urls[lang] || {}).filter(
                q => q.toLowerCase() !== "subtitles"
            );
            if (!qualities.length) return sendJson(res, { streams: [] });

            let qual = qualities[0];
            if (qualities.includes("1080p")) qual = "1080p";
            else if (qualities.includes("720p")) qual = "720p";

            const link = urls[lang][qual];

            const streams = [
                {
                    title: `${lang} ${qual}`,
                    url: link,
                    isFree: true
                }
            ];

            return sendJson(res, { streams });
        }

        // EPIZODA
        if (type === "series" && id.startsWith("sosac-episode-")) {
            const epId = id.replace("sosac-episode-", "");
            const data = await api.serials("", { arg2: epId, arg3: "episodes" });

            const linkId = findLinkId(data);
            if (!linkId) return sendJson(res, { streams: [] });

            const streamData = await api.streamujGet(linkId);
            const urls = streamData.URL || {};

            const langKeys = Object.keys(urls);
            if (!langKeys.length) return sendJson(res, { streams: [] });

            const preferredLangOrder = ["CZECH", "CZ", "SK", "ENGLISH", "EN"];
            let lang = langKeys[0];
            for (const L of preferredLangOrder) {
                if (langKeys.includes(L)) {
                    lang = L;
                    break;
                }
            }

            const qualities = Object.keys(urls[lang] || {}).filter(
                q => q.toLowerCase() !== "subtitles"
            );
            if (!qualities.length) return sendJson(res, { streams: [] });

            let qual = qualities[0];
            if (qualities.includes("1080p")) qual = "1080p";
            else if (qualities.includes("720p")) qual = "720p";

            const link = urls[lang][qual];

            const streams = [
                {
                    title: `${lang} ${qual}`,
                    url: link,
                    isFree: true
                }
            ];

            return sendJson(res, { streams });
        }

        return sendJson(res, { streams: [] });
    } catch (e) {
        console.error("Stream error:", e);
        sendError(res, 500, "Stream error: " + e.message);
    }
}
