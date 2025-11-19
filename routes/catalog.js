// routes/catalog.js

import { sendJson, sendError, getTitleCs } from "./utils.js";

// /catalog/{type}/{id}.json
export async function handleCatalog(api, req, res, type, id, query) {
    try {
        let metas = [];

        if (type === "movie" && id === "sosac-movies") {
            const search = query.search || null;
            let data;
            if (search) {
                data = await api.movies("search", { arg2: search, arg3: "1" });
            } else {
                // výchozí – populární filmy
                data = await api.movies("popular", { arg3: "1" });
            }

            metas = (Array.isArray(data) ? data : []).map(item => {
                const title = getTitleCs(item.n);
                const year = item.y || item.year || null;
                const mid = item._id || item.id;
                const imgBase = "https://movies.sosac.tv/images/75x109/movie-";
                const poster =
                    item.i ||
                    `${imgBase}${mid}.jpg`;

                return {
                    id: `sosac-movie-${mid}`,
                    type: "movie",
                    name: title,
                    poster,
                    posterShape: "poster",
                    year,
                    genres: item.g || item.genres || [],
                    imdbRating: item.r || item.m || null
                };
            });
        } else if (type === "series" && id === "sosac-series") {
            const search = query.search || null;
            let data;
            if (search) {
                data = await api.serials("search", { arg2: search, arg3: "", arg5: "1" });
            } else {
                // výchozí – populární seriály
                data = await api.serials("popular", { arg5: "1" });
            }

            metas = (Array.isArray(data) ? data : []).map(item => {
                const title = getTitleCs(item.n);
                const year = item.y || item.year || null;
                const sid = item._id || item.id;
                const imgBase = "http://movies.sosac.tv/images/558x313/serial-";
                const poster =
                    item.i ||
                    `${imgBase}${sid}.jpg`;

                return {
                    id: `sosac-series-${sid}`,
                    type: "series",
                    name: title,
                    poster,
                    posterShape: "poster",
                    year,
                    genres: item.g || item.genres || [],
                    imdbRating: item.r || item.m || null
                };
            });
        } else {
            metas = [];
        }

        sendJson(res, { metas });
    } catch (e) {
        console.error("Catalog error:", e);
        sendError(res, 500, "Catalog error: " + e.message);
    }
}
