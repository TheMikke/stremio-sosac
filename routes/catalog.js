// routes/catalog.js

import { sendJson, sendError, getTitleCs } from "./utils.js";

// Pomocné mapování Sosáč -> Stremio meta (FILMY)
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

// Pomocné mapování Sosáč -> Stremio meta (SERIÁLY)
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

        // ----------------------------------------------------
        // FILMY – hlavní katalog (populární + vyhledávání)
        // ----------------------------------------------------
        if (type === "movie" && id === "sosac-movies") {
            let data;

            if (search) {
                // vyhledávání podle názvu
                data = await api.movies("search", { arg2: search, arg3: "1" });
            } else {
                // výchozí – populární filmy
                data = await api.movies("popular", { arg3: "1" });
            }

            metas = (Array.isArray(data) ? data : []).map(mapMovieToMeta);
        }

        // ----------------------------------------------------
        // FILMY – A-Z
        // query.search = písmeno (volitelné), jinak vše
        // ----------------------------------------------------
        else if (type === "movie" && id === "sosac-movies-az") {
            const letter =
                search && search.length > 0
                    ? search[0].toLowerCase()
                    : "";
            const data = await api.movies("a-z", { arg2: letter, arg3: "1" });

            metas = (Array.isArray(data) ? data : []).map(mapMovieToMeta);
        }

        // ----------------------------------------------------
        // FILMY – podle žánru
        // TODO: žánr můžeš časem udělat dynamicky (extra param),
        // zatím fixně "akční"
        // ----------------------------------------------------
        else if (type === "movie" && id === "sosac-movies-genre") {
            const genre = "akční";
            const data = await api.movies("by-genre", {
                arg2: genre,
                arg3: "1"
            });

            metas = (Array.isArray(data) ? data : []).map(mapMovieToMeta);
        }

        // ----------------------------------------------------
        // SERIÁLY – hlavní katalog (populární + vyhledávání)
        // ----------------------------------------------------
        else if (type === "series" && id === "sosac-series") {
            let data;

            if (search) {
                data = await api.serials("search", {
                    arg2: search,
                    arg3: "",
                    arg5: "1"
                });
            } else {
                // výchozí – populární seriály
                data = await api.serials("popular", { arg5: "1" });
            }

            metas = (Array.isArray(data) ? data : []).map(mapSeriesToMeta);
        }

        // ----------------------------------------------------
        // SERIÁLY – A-Z
        // ----------------------------------------------------
        else if (type === "series" && id === "sosac-series-az") {
            const letter =
                search && search.length > 0
                    ? search[0].toLowerCase()
                    : "";
            const data = await api.serials("a-z", {
                arg2: letter,
                arg5: "1"
            });

            metas = (Array.isArray(data) ? data : []).map(mapSeriesToMeta);
        }

        // ----------------------------------------------------
        // SERIÁLY – podle žánru
        // ----------------------------------------------------
        else if (type === "series" && id === "sosac-series-genre") {
            const genre = "drama";
            const data = await api.serials("by-genre", {
                arg2: genre,
                arg5: "1"
            });

            metas = (Array.isArray(data) ? data : []).map(mapSeriesToMeta);
        }

        // ----------------------------------------------------
        // Neznámý katalog – vrátíme prázdno
        // ----------------------------------------------------
        else {
            metas = [];
        }

        sendJson(res, { metas });
    } catch (e) {
        console.error("Catalog error:", e);
        sendError(res, 500, "Catalog error: " + e.message);
    }
}
