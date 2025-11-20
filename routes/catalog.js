// routes/catalog.js

import { sendJson, sendError, getTitleCs } from "./utils.js";

const PAGE_SIZE = 100;

// Sosáč -> Stremio meta (FILM)
function mapMovieToMeta(item) {
    const title = getTitleCs(item.n);
    const year = item.y || item.year || null;
    const mid = item._id || item.id;
    const imgBase = "https://movies.sosac.tv/images/75x109/movie-";
    const poster = item.i || `${imgBase}${mid}.jpg`;

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
}

// Sosáč -> Stremio meta (SERIÁL)
function mapSeriesToMeta(item) {
    const title = getTitleCs(item.n);
    const year = item.y || item.year || null;
    const sid = item._id || item.id;
    const imgBase = "https://movies.sosac.tv/images/558x313/serial-";
    const poster = item.i || `${imgBase}${sid}.jpg`;

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
}

// /catalog/{type}/{id}.json
// POZOR: poslední argument bereme jako "extra" z URL (search, skip, ...)
// server.js by měl volat: handleCatalog(api, req, res, type, id, extra)
export async function handleCatalog(api, req, res, type, id, extra = {}) {
    try {
        let metas = [];

        // extra.search může přijít jako string z cesty
        const search = (extra.search || "").toString().trim();

        // skip může být string, převedeme na číslo
        const skipRaw = extra.skip || "0";
        const skipNum = parseInt(skipRaw, 10);
        const skip = Number.isNaN(skipNum) ? 0 : skipNum;

        const page = Math.floor(skip / PAGE_SIZE) + 1;
        const pageStr = String(page);

        console.log(
            "Catalog request:",
            "type:", type,
            "id:", id,
            "search:", search || null,
            "skip:", skip,
            "page:", pageStr
        );

        // ---------------- FILMY ----------------
        if (type === "movie" && id === "sosac-movies") {
            let data;

            if (search) {
                // vyhledávání ve filmech
                data = await api.movies("search", {
                    arg2: search,
                    arg3: pageStr
                });
            } else {
                // výchozí – populární filmy
                data = await api.movies("popular", {
                    arg3: pageStr
                });
            }

            metas = (Array.isArray(data) ? data : []).map(mapMovieToMeta);
        }

        // ---------------- SERIÁLY ----------------
        else if (type === "series" && id === "sosac-series") {
            let data;

            if (search) {
                data = await api.serials("search", {
                    arg2: search,
                    arg3: "",
                    arg5: pageStr
                });
            } else {
                // výchozí – populární seriály
                data = await api.serials("popular", {
                    arg5: pageStr
                });
            }

            metas = (Array.isArray(data) ? data : []).map(mapSeriesToMeta);
        }

        // neznámý katalog
        else {
            metas = [];
        }

        // Když vrátíme pole s položkami, Stremio ho normálně vykreslí.
        // Když vrátíme prázdné [] a už předtím něco bylo, je to "konec listování".
        sendJson(res, { metas });
    } catch (e) {
        console.error("Catalog error:", e);
        sendError(res, 500, "Catalog error: " + e.message);
    }
}
