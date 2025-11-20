// routes/meta.js

import { sendJson, sendError, getTitleCs } from "./utils.js";

// Pomocná funkce: vytáhne první smysluplný text z objektu / pole / stringu
function pickText(value) {
    if (!value) return "";
    // když je to objekt typu { cs: "...", en: "..." }
    if (typeof value === "object" && !Array.isArray(value)) {
        // preferuj češtinu
        if (value.cs) return Array.isArray(value.cs) ? value.cs[0] : value.cs;
        if (value.sk) return Array.isArray(value.sk) ? value.sk[0] : value.sk;
        // jinak vezmi první klíč
        const firstKey = Object.keys(value)[0];
        if (firstKey) {
            const v = value[firstKey];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    // když je to pole stringů
    if (Array.isArray(value)) {
        return value.join(", ");
    }
    // fallback: string
    return String(value);
}

// -------------------- /meta/{type}/{id}.json --------------------
export async function handleMeta(api, req, res, type, id) {
    try {
        // --------------------------------------------------------
        // FILM
        // --------------------------------------------------------
        if (type === "movie" && id.startsWith("sosac-movie-")) {
            const movieId = id.replace("sosac-movie-", "");
            const data = await api.movies("id", { arg2: movieId });

            console.log("Sosac movie detail:", data);

            const title = getTitleCs(data.n);
            const year = data.y || data.year || null;

            // plakáty z Sosáče
            const poster =
                data.i ||
                `https://movies.sosac.tv/images/75x109/movie-${movieId}.jpg`;
            const background =
                data.bi ||
                `https://movies.sosac.tv/images/558x313/movie-${movieId}.jpg`;

            const overview =
                pickText(data.d) ||
                pickText(data.popis) ||
                pickText(data.o) || // když nic jiného, aspoň nějaký text
                "";

            const genres =
                Array.isArray(data.g) || Array.isArray(data.genres)
                    ? (data.g || data.genres)
                    : data.g
                    ? [data.g]
                    : [];

            const country = pickText(data.o); // Sosáč obvykle dává zemi do "o"
            const imdbRating = data.r || data.m || null;
            const runtime =
                data.t || data.time || data.runtime || null; // pokud tam je

            const meta = {
                id,
                type: "movie",
                name: title,
                poster,
                posterShape: "poster",
                background,
                description: overview,
                year,
                genres,
                imdbRating,
                country,
                runtime,
                // pár polí navíc, která Stremio umí zobrazit, když jsou
                releaseInfo: year
                    ? country
                        ? `${year} • ${country}`
                        : String(year)
                    : country || "",
                videos: [] // pro film nepotřebujeme jednotlivé epizody
            };

            return sendJson(res, { meta });
        }

        // --------------------------------------------------------
        // SERIÁL
        // --------------------------------------------------------
        if (type === "series" && id.startsWith("sosac-series-")) {
            const seriesId = id.replace("sosac-series-", "");

            // detail seriálu (popis, žánry, atd.)
            const info = await api.serialDetail(seriesId);
            console.log("Sosac series detail:", info);

            const title = getTitleCs(info.n);
            const year = info.y || info.year || null;

            const poster =
                info.i ||
                `https://movies.sosac.tv/images/558x313/serial-${seriesId}.jpg`;
            const background =
                info.bi ||
                `https://movies.sosac.tv/images/558x313/serial-${seriesId}.jpg`;

            const overview =
                pickText(info.d) ||
                pickText(info.popis) ||
                pickText(info.o) ||
                "";

            const genres =
                Array.isArray(info.g) || Array.isArray(info.genres)
                    ? (info.g || info.genres)
                    : info.g
                    ? [info.g]
                    : [];

            const country = pickText(info.o);
            const imdbRating = info.r || info.m || null;

            // zatím jen základní meta bez vypisování všech epizod
            // (Stremio to zvládne, epizody se stejně řeší přes /stream)
            const meta = {
                id,
                type: "series",
                name: title,
                poster,
                posterShape: "poster",
                background,
                description: overview,
                year,
                genres,
                imdbRating,
                country,
                releaseInfo: year
                    ? country
                        ? `${year} • ${country}`
                        : String(year)
                    : country || "",
                videos: [] // pokud budeš chtít, můžeme doplnit epizody
            };

            return sendJson(res, { meta });
        }

        // --------------------------------------------------------
        // neznámé ID
        // --------------------------------------------------------
        return sendError(res, 404, "Unknown meta id");
    } catch (e) {
        console.error("Meta error:", e);
        sendError(res, 500, "Meta error: " + e.message);
    }
}
