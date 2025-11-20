// routes/catalog.js

import { sendJson, sendError, getTitleCs, getTitleEn } from "./utils.js";

// dl (sekundy) -> minuty
function secsToMinutes(dl) {
    if (!dl) return null;
    const secs = parseInt(dl, 10);
    if (Number.isNaN(secs) || secs <= 0) return null;
    return Math.round(secs / 60);
}

function toArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
}

function normalizeDirectors(h) {
    if (!h) return [];
    if (Array.isArray(h)) return h.map(String);
    return [String(h)];
}

function normalizeCast(f) {
    if (!f) return [];
    if (Array.isArray(f)) return f.map(String);
    return [String(f)];
}

function mapMovieItemToMetaPreview(item) {
    const title = getTitleEn(item.n);
    const mid = item._id || item.id;

    const year = item.y || item.year || null;

    const poster =
        item.i ||
        `https://movies.sosac.tv/images/75x109/movie-${mid}.jpg`;

    const description =
        typeof item.p === "string" ? item.p.trim() : "";

    const genres = toArray(item.g).map(String);

    const countries = toArray(item.o).map(String);
    const country = countries.join(", ") || null;

    const languages = toArray(item.d).map(String);
    const language = languages.join(", ") || null;

    const minutes = secsToMinutes(item.dl);
    const runtime = minutes != null ? `${minutes} min` : null;

    // ČSFD hodnocení
    const csfdRating = item.c != null ? parseInt(item.c, 10) : null;
    const imdbRating =
        csfdRating != null ? (csfdRating / 10).toFixed(1) : undefined;

    // releaseInfo – jen rok (jak chceš)
    const releaseInfo = year ? String(year) : "";

    const directors = normalizeDirectors(item.h);
    const cast = normalizeCast(item.f);

    return {
        id: `sosac-movie-${mid}`,
        type: "movie",
        name: title,
        poster,
        posterShape: "poster",

        year,
        genres,
        description,
        country,
        language,
        runtime,
        releaseInfo,

        // Stremio použije jako rating v náhledu (číslo vedle hvězdičky)
        imdbRating, // string, ale je to ČSFD/10

        // režiséři / herci – Stremio si je může vytáhnout v detailu
        director: directors,
        cast
    };
}

function mapSeriesItemToMetaPreview(item) {
    const title = getTitleEn(item.n);
    const sid = item._id || item.id;

    const year = item.y || item.year || null;

    const poster =
        item.i ||
        `https://movies.sosac.tv/images/558x313/serial-${sid}.jpg`;

    const description =
        typeof item.p === "string" ? item.p.trim() : "";

    const genres = toArray(item.g).map(String);

    const countries = toArray(item.o).map(String);
    const country = countries.join(", ") || null;

    const languages = toArray(item.d).map(String);
    const language = languages.join(", ") || null;

    const minutes = secsToMinutes(item.dl);
    const runtime = minutes != null ? `${minutes} min` : null;

    const csfdRating = item.c != null ? parseInt(item.c, 10) : null;
    const imdbRating =
        csfdRating != null ? (csfdRating / 10).toFixed(1) : undefined;

    const releaseInfo = year ? String(year) : "";

    const directors = normalizeDirectors(item.h);
    const cast = normalizeCast(item.f);

    return {
        id: `sosac-series-${sid}`,
        type: "series",
        name: title,
        poster,
        posterShape: "poster",

        year,
        genres,
        description,
        country,
        language,
        runtime,
        releaseInfo,
        imdbRating,

        director: directors,
        cast
    };
}

// /catalog/{type}/{id}.json
// extra = { search, skip, ... } – přichází ze server.js
export async function handleCatalog(api, req, res, type, id, extra = {}) {
    try {
        let metas = [];

        const search = (extra.search || "").toString().trim();
        const skip = parseInt(extra.skip || "0", 10);
        const pageSize = 100;
        const page = Math.floor(skip / pageSize) + 1;
        const pageStr = String(page);

        // ----------------- FILMY -----------------
        if (type === "movie" && id === "sosac-movies") {
            let data;
            if (search) {
                // fulltext vyhledávání v Sosáči
                data = await api.movies("search", { arg2: search, arg3: pageStr });
            } else {
                // výchozí – populární filmy
                data = await api.movies("popular", { arg3: pageStr });
            }

            metas = (Array.isArray(data) ? data : []).map(mapMovieItemToMetaPreview);
        }

        // ----------------- SERIÁLY -----------------
        else if (type === "series" && id === "sosac-series") {
            let data;
            if (search) {
                data = await api.serials("search", { arg2: search, arg3: "", arg5: pageStr });
            } else {
                data = await api.serials("popular", { arg5: pageStr });
            }

            metas = (Array.isArray(data) ? data : []).map(mapSeriesItemToMetaPreview);
        }

        // ostatní katalogy (A-Z, žánry...) – když nejsou implementované
        else {
            metas = [];
        }

        sendJson(res, { metas });
    } catch (e) {
        console.error("Catalog error:", e);
        sendError(res, 500, "Catalog error: " + e.message);
    }
}
