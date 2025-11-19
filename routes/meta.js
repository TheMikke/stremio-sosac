// routes/meta.js

import { sendJson, sendError, getTitleCs } from "./utils.js";

// /meta/{type}/{id}.json
export async function handleMeta(api, req, res, type, id) {
    try {
        // FILM
        if (type === "movie" && id.startsWith("sosac-movie-")) {
            const movieId = id.replace("sosac-movie-", "");
            const data = await api.movies("id", { arg2: movieId });

            const title = getTitleCs(data.n);
            const year = data.y || data.year || null;
            const imgBase = "https://movies.sosac.tv/images/75x109/movie-";
            const poster =
                data.i ||
                `${imgBase}${movieId}.jpg`;

            const meta = {
                id,
                type: "movie",
                name: title,
                poster,
                background: data.b || poster,
                year,
                description: data.o || data.plot || "",
                genres: data.g || [],
                imdbRating: data.r || data.m || null,
                runtime: data.dl ? parseInt(data.dl) : null
            };

            return sendJson(res, { meta });
        }

        // SERIÁL
        if (type === "series" && id.startsWith("sosac-series-")) {
            const seriesId = id.replace("sosac-series-", "");
            const data = await api.serialDetail(seriesId);

            const info = data.info || data["info"] || {};
            const title = getTitleCs(info.n || info);
            const year = info.y || null;
            const imgBase = "http://movies.sosac.tv/images/558x313/serial-";
            const poster =
                info.i ||
                `${imgBase}${seriesId}.jpg`;

            const videos = [];

            for (const seasonKey of Object.keys(data)) {
                if (seasonKey === "info") continue;
                const seasonNum = parseInt(seasonKey, 10);
                if (isNaN(seasonNum)) continue;

                const episodesObj = data[seasonKey];
                for (const epNumStr of Object.keys(episodesObj)) {
                    const epObj = episodesObj[epNumStr];
                    const epId = epObj._id || epObj.id;
                    const epTitle = getTitleCs(epObj.n || epObj);
                    const epNum = parseInt(epNumStr, 10);

                    videos.push({
                        id: `sosac-episode-${epId}`,
                        title: `${seasonNum}x${String(epNum).padStart(2, "0")} - ${epTitle}`,
                        season: seasonNum,
                        episode: epNum,
                        overview: epObj.o || epObj.plot || info.o || "",
                        released: epObj.premiere || null
                    });
                }
            }

            const meta = {
                id,
                type: "series",
                name: title,
                poster,
                background: info.b || poster,
                year,
                description: info.o || "",
                genres: info.g || [],
                imdbRating: info.r || null,
                videos
            };

            return sendJson(res, { meta });
        }

        // neznámé ID
        return sendError(res, 404, "Unknown meta id");
    } catch (e) {
        console.error("Meta error:", e);
        sendError(res, 500, "Meta error: " + e.message);
    }
}
