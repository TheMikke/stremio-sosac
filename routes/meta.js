// routes/meta.js

import { sendJson, sendError, getTitleCs } from "./utils.js";

// seconds -> { minutes, label "1h 23m" }
function parseDuration(dl) {
    if (!dl) return { minutes: null, label: null };
    const secs = parseInt(dl, 10);
    if (Number.isNaN(secs) || secs <= 0) return { minutes: null, label: null };

    const minutes = Math.round(secs / 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    let label = "";
    if (h > 0) label += `${h}h`;
    if (m > 0 || h === 0) label += (label ? " " : "") + `${m}m`;

    return { minutes, label };
}

function toArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
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
            const genres = toArray(data.g);

            // země "o"
            const countries = toArray(data.o);
            const country = countries.join(", ") || null;

            // jazyk videa (dabing) "d"
            const languages = toArray(data.d);
            const language = languages.join(", ") || null;

            // kvalita streamu "q"
            const quality = data.q || null;

            // typ zvuku "e"
            const audio = data.e || null;

            // délka "dl" -> min + label
            const { minutes: runtime, label: runtimeStr } = parseDuration(
                data.dl
            );

            // datum přidání "r"
            const added = data.r || null;

            // režisér "s"
            const director = data.s || null;

            // ratingy:
            // c  = ČSFD v procentech (použijeme jako hlavní rating ve Stremiu)
            // m  = IMDb * 10  (81 => 8.1) – jen bokem
            const csfdRating = data.c != null ? parseInt(data.c, 10) : null;
            const imdbRaw =
                data.m != null ? parseInt(data.m, 10) : null;
            const imdbAsNumber =
                imdbRaw != null ? imdbRaw / 10 : null;

            // Stremio používá meta.imdbRating jako "rating".
            // Sem dáme přepočtené ČSFD (0–10), a IMDb necháme jen bokem.
            const rating10 = csfdRating != null
                ? csfdRating / 10
                : imdbAsNumber;

            // obrázky
            const poster =
                data.i ||
                `https://movies.sosac.tv/images/75x109/movie-${movieId}.jpg`;
            const background =
                data.b ||
                poster;

            const meta = {
                id,
                type: "movie",
                name: title,
                poster,
                posterShape: "poster",
                background,
                description,
                year,
                genres,
                // hlavní rating pro Stremio – z ČSFD
                imdbRating: rating10,
                // pro tebe navíc
                csfdRating,
                imdbRatingOriginal: imdbAsNumber,
                country,
                language,
                quality,
                audio,
                runtime,      // minuty
                runtimeStr,   // "1h 23m"
                added,
                director,
                // Stremio zobrazí v náhledu vpravo
                releaseInfo: [
                    year ? String(year) : null,
                    country,
                    csfdRating != null
                        ? `ČSFD ${csfdRating}%`
                        : (imdbAsNumber != null
                            ? `IMDb ${imdbAsNumber.toFixed(1)}`
                            : null),
                    runtimeStr
                ]
                    .filter(Boolean)
                    .join(" • "),
                // herce Sosáč v těchhle datech nevrací – necháme prázdné
                cast: [],
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
            const genres = toArray(info.g);
            const countries = toArray(info.o);
            const country = countries.join(", ") || null;

            // ratingy seriálu
            const csfdRating = info.c != null ? parseInt(info.c, 10) : null;
            const imdbRaw =
                info.m != null ? parseInt(info.m, 10) : null;
            const imdbAsNumber =
                imdbRaw != null ? imdbRaw / 10 : null;
            const rating10 = csfdRating != null
                ? csfdRating / 10
                : imdbAsNumber;

            // obrázky seriálu
            const poster =
                info.i ||
                `https://movies.sosac.tv/images/558x313/serial-${seriesId}.jpg`;
            const background =
                info.b ||
                poster;

            const videos = [];

            // Sezóny + epizody
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

                    // název epizody "ne" (cs/us)
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
                    const epLangs = toArray(epObj.d);
                    const language = epLangs.join(", ") || null;

                    // kvalita "q"
                    const quality = epObj.q || null;

                    // audio "e"
                    const audio = epObj.e || null;

                    // délka "dl"
                    const { minutes: runtime, label: runtimeStr } =
                        parseDuration(epObj.dl);

                    // žánry / země pro epizodu (pokud má vlastní, jinak z info)
                    const epGenres = toArray(epObj.g).length
                        ? toArray(epObj.g)
                        : genres;
                    const epCountries = toArray(epObj.o).length
                        ? toArray(epObj.o)
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
                        language,
                        quality,
                        audio,
                        runtime,
                        runtimeStr,
                        country: epCountry,
                        genres: epGenres,
                        added: released,
                        year: epObj.y || year,
                        linkId
                    });
                }
            }

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
                imdbRating: rating10,        // hlavní rating pro Stremio = ČSFD
                csfdRating,
                imdbRatingOriginal: imdbAsNumber,
                country,
                // režiséry / herce Sosáč v serialDetailu typicky detailně nevrací
                director: info.s || null,
                cast: [],
                releaseInfo: [
                    year ? String(year) : null,
                    country,
                    csfdRating != null
                        ? `ČSFD ${csfdRating}%`
                        : (imdbAsNumber != null
                            ? `IMDb ${imdbAsNumber.toFixed(1)}`
                            : null)
                ]
                    .filter(Boolean)
                    .join(" • "),
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
