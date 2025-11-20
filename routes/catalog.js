// routes/catalog.js

import { sendJson, sendError, getTitleCs } from "./utils.js";

// kolik bereme z API Sosáče na jednu "stránku"
const PAGE_SIZE = 100;

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

        // Stremio posílá stránkování přes "skip"
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

        // ----------------------------------------------------
        // FILMY – hlavní katalog (populární + vyhledávání)
        // ----------------------------------------------------
        if (type === "movie" && id === "sosac-movies") {
            let data;

            if (search && search.trim() !== "") {
                // vyhledávání podle názvu
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

        // ----------------------------------------------------
        // FILMY – A-Z
        // query.search = písmeno (volitelné), jinak default 'a'
        // ----------------------------------------------------
        else if (type === "movie" && id === "sosac-movies-az") {
            let letter = "a";

            if (search && search.trim().length > 0) {
                letter = search.trim()[0].toLowerCase();
            }

            const data = await api.movies("a-z", {
                arg2: letter,
                arg3: pageStr
            });

            metas = (Array.isArray(data) ? data : []).map(mapMovieToMeta);
        }

        // ----------------------------------------------------
        // FILMY – podle žánru
        // žánr můžeš časem udělat dynamicky (extra param),
        // zatím fixně "akční"
        // ----------------------------------------------------
        else if (type === "movie" && id === "sosac-movies-genre") {
            const genre = query.genre || "akční"; // můžeš si přepsat / posílat z manifestu extra
            const data = await api.movies("by-genre", {
                arg2: genre,
                arg3: pageStr
            });

            metas = (Array.isArray(data) ? data : []).map(mapMovieToMeta);
        }

        // ----------------------------------------------------
        // SERIÁLY – hlavní katalog (populární + vyhledávání)
        // ----------------------------------------------------
        else if (type === "series" && id === "sosac-series") {
            let data;

            if (search && search.trim() !== "") {
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

        // ----------------------------------------------------
        // SERIÁLY – A-Z
        // ----------------------------------------------------
        else if (type === "series" && id === "sosac-series-az") {
            let letter = "a";

            if (search && search.trim().length > 0) {
                letter = search.trim()[0].toLowerCase();
            }

            const data = await api.serials("a-z", {
                arg2: letter,
                arg5: pageStr
            });

            metas = (Array.isArray(data) ? data : []).map(mapSeriesToMeta);
        }

        // ----------------------------------------------------
        // SERIÁLY – podle žánru
        // ----------------------------------------------------
        else if (type === "series" && id === "sosac-series-genre") {
            const genre = query.genre || "drama";
            const data = await api.serials("by-genre", {
                arg2: genre,
                arg5: pageStr
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
