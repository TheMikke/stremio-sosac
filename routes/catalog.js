// routes/catalog.js

import { sendJson, sendError, getTitleCs } from "./utils.js";

const PAGE_SIZE = 100;

// Sosáč -> Stremio meta (film)
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

// Sosáč -> Stremio meta (seriál)
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
export async function handleCatalog(api, req, res, type, id, query) {
    try {
        let metas = [];

        const search = query.search || null;

        // stránkování z Stremia (skip = kolik položek přeskočit)
        const skipRaw = query.skip || "0";
        const skip = Number.isNaN(parseInt(skipRaw, 10))
            ? 0
            : parseInt(skipRaw, 10);

        const page = Math.floor(skip / PAGE_SIZE) + 1;
        const pageStr = String(page);

        console.log(
            "Catalog request:",
            "type:", type,
            "id:", id,
            "search:", search,
            "skip:", skip,
            "page:", pageStr
        );

        // ---------------- FILMY ----------------
        if (type === "movie" && id === "sosac-movies") {
            let data;

            if (search && search.trim() !== "") {
                // vyhledávání ve filmech
                data = await api.movies("search", {
                    arg2: search.trim(),
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

            if (search && search.trim() !== "") {
                data = await api.serials("search", {
                    arg2: search.trim(),
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

        sendJson(res, { metas });
    } catch (e) {
        console.error("Catalog error:", e);
        sendError(res, 500, "Catalog error: " + e.message);
    }
}
