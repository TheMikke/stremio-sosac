// routes/meta.js

import { sendJson, sendError, getTitleCs } from "./utils.js";

function parseDuration(dl) {
    if (!dl) return { minutes: null };
    const secs = parseInt(dl, 10);
    if (Number.isNaN(secs) || secs <= 0) return { minutes: null };

    const minutes = Math.round(secs / 60);
    return { minutes };
}


function toArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
}

// režisér/ři: pole stringů (pole nebo string → pole)
function normalizeDirectors(h) {
    if (!h) return [];
    if (Array.isArray(h)) return h.map(String);
    return [String(h)];
}

// cast: "f" může být string nebo pole
function normalizeCast(f) {
    if (!f) return [];
    if (Array.isArray(f)) return f.map(String);
    return [String(f)];
}

// ---------------- META HANDLER --------------------

// /meta/{type}/{id}.json
export async function handleMeta(api, req, res, type, id) {
    try {
        // ============================================================
        // FILM
        // ============================================================
        if (type === "movie" && id.startsWith("sosac-movie-")) {
            const movieId = id.replace("sosac-movie-", "");
            const data = await api.movies("id", { arg2: movieId });

            // název z "n" (cs/us/sk)
            const title = getTitleCs(data.n);

            // popis z "p"
            const description =
                typeof data.p === "string" ? data.p.trim() : "";

            // rok vydání "y"
            const year = data.y || data.year || null;

            // žánry "g"
            const genres = toArray(data.g).map(String);

            // země "o"
            const countries = toArray(data.o).map(String);
            const country = countries.join(", ") || null;

            // jazyk videa (dabing) "d"
            const languages = toArray(data.d).map(String);
            const language = languages.join(", ") || null;

            // kvalita streamu "q"
            const quality = data.q || null;

            // typ zvuku "e"
            const audio = data.e || null;

            // délka "dl" -> min 
            const { minutes: runtimeMinutes } = parseDuration(data.dl);

            // runtime, jak chce Stremio – string
            const runtime = runtimeMinutes != null ? `${runtimeMinutes} min` : null;

            // datum přidání "r"
            const added = data.r || null;

            // režiséři "h"
            const directors = normalizeDirectors(data.h);

            // herci "f"
            const cast = normalizeCast(data.f);

            // rating:
            // c = ČSFD v procentech → hlavní rating pro Stremio
            const csfdRating = data.c != null ? parseInt(data.c, 10) : null;
            const rating10 = csfdRating != null ? csfdRating / 10 : null;
            const imdbRating =
                rating10 != null ? rating10.toFixed(1) : undefined; // string, např. "8.8"

            // obrázky: poster + background
            const poster =
                data.i ||
                `https://movies.sosac.tv/images/75x109/movie-${movieId}.jpg`;
            const background =
                data.b ||
                poster;

            // releaseInfo – uprostřed
            const releaseInfo = year ? String(year) : "";

            const meta = {
                // povinné
                id,
                type: "movie",
                name: title,
                poster,
                posterShape: "poster",

                // doporučené / volitelné
                background,
                description,
                year,
                genres,
                releaseInfo,
                imdbRating,       // string, ale je to ve skutečnosti ČSFD/10
                runtime,          // string ("123 min" nebo "1h 23m")
                language,         // string
                country,          // string
                director: directors, // pole stringů
                cast,             // pole stringů

                // vlastní užitečná pole navíc – Stremio ignoruje
                csfdRating,
                quality,
                audio,
                added,

                // filmy nemají epizody
                videos: []
            };

            return sendJson(res, { meta });
        }

        // ============================================================
        // SERIÁL
        // ============================================================
        if (type === "series" && id.startsWith("sosac-series-")) {
            const seriesId = id.replace("sosac-series-", "");

            // serialDetail:
            // { info: {...}, "1": { "1": epObj, ... }, "2": { ... }, ... }
            const data = await api.serialDetail(seriesId);
            const info = data.info || data["info"] || {};

            // název seriálu z "n"
            const seriesTitle = getTitleCs(info.n || info);

            // popis seriálu z "p" (pokud existuje)
            const seriesDescription =
                typeof info.p === "string" ? info.p.trim() : "";

            const year = info.y || info.year || null;
            const genres = toArray(info.g).map(String);
            const countries = toArray(info.o).map(String);
            const country = countries.join(", ") || null;

            // režiséři "h"
            const directors = normalizeDirectors(info.h);

            // herci "f"
            const cast = normalizeCast(info.f);

            // rating seriálu z ČSFD
            const csfdRating =
                info.c != null ? parseInt(info.c, 10) : null;
            const rating10 = csfdRating != null ? csfdRating / 10 : null;
            const imdbRating =
                rating10 != null ? rating10.toFixed(1) : undefined;

            // obrázky seriálu
            const poster =
                info.i ||
                `https://movies.sosac.tv/images/558x313/serial-${seriesId}.jpg`;
            const background =
                info.b ||
                poster;

            const videos = [];

            // Sezóny + epizody (s, ep, p, d, q, dl, o, g, ne/n)
            for (const key of Object.keys(data)) {
                if (key === "info") continue;

                const seasonBlock = data[key];
                if (!seasonBlock || typeof seasonBlock !== "object") continue;

                for (const epKey of Object.keys(seasonBlock)) {
                    const epObj = seasonBlock[epKey];
                    if (!epObj) continue;

                    const epId = epObj._id || epObj.id;
                    if (!epId) continue;

                    const season = epObj.s
                        ? parseInt(epObj.s, 10)
                        : parseInt(key, 10);
                    const episode = epObj.ep
                        ? parseInt(epObj.ep, 10)
                        : parseInt(epKey, 10);

                    if (Number.isNaN(season) || Number.isNaN(episode)) continue;

                    // název epizody "ne" (cs/us) nebo fallback na název seriálu
                    const epTitleName = getTitleCs(
                        epObj.ne || epObj.n || info.n || seriesTitle
                    );

                    const title = `${season}x${String(episode).padStart(
                        2,
                        "0"
                    )} – ${epTitleName}`;

                    // popis epizody "p"
                    const overview =
                        typeof epObj.p === "string" && epObj.p.trim()
                            ? epObj.p.trim()
                            : seriesDescription;

                    // datum "r"
                    const released = epObj.r || null;

                    // jazyk "d"
                    const epLangs = toArray(epObj.d).map(String);
                    const epLanguage = epLangs.join(", ") || null;

                    // kvalita "q"
                    const epQuality = epObj.q || null;

                    // audio "e"
                    const epAudio = epObj.e || null;

                    // délka "dl"
                    const {
                        minutes: epRuntimeMinutes,
                        label: epRuntimeLabel
                    } = parseDuration(epObj.dl);
                    const epRuntime = epRuntimeLabel || (epRuntimeMinutes != null
                        ? `${epRuntimeMinutes} min`
                        : null);

                    // žánry / země pro epizodu (pokud má vlastní, jinak z info)
                    const epGenres = toArray(epObj.g).length
                        ? toArray(epObj.g).map(String)
                        : genres;
                    const epCountries = toArray(epObj.o).length
                        ? toArray(epObj.o).map(String)
                        : countries;
                    const epCountry = epCountries.join(", ") || null;

                    // náhled epizody "ie" / "i"
                    const thumbnail =
                        epObj.ie ||
                        epObj.i ||
                        poster;

                    // linkId "l" – používá se ve /stream
                    const linkId = epObj.l || null;
                    
                    videos.push({
                        id: `sosac-episode-${epId}`,
                        title,
                        season,
                        episode,
                        overview,
                        released,
                        thumbnail,
                        language: epLanguage,
                        quality: epQuality,
                        audio: epAudio,
                        runtime: epRuntime,
                        country: epCountry,
                        genres: epGenres,
                        year: epObj.y || year,
                        added: released,
                        linkId
                    });
                }
            }

            const releaseInfo = year ? String(year) : "";
            
            const meta = {
                id,
                type: "series",
                name: seriesTitle,
                poster,
                posterShape: "poster",
                background,
                description: seriesDescription,
                year,
                genres,
                releaseInfo,
                released,
                imdbRating,
                country,
                director: directors,
                cast,
                csfdRating,
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
