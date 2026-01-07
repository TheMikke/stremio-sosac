// routes/stream.js

import { sendJson, sendError, findLinkId } from "./utils.js";

const DEBUG = true;

// ------------------------ STREAMUJ BUILDERS ------------------------

async function buildStreamsFromStreamuj(api, streamData, logPrefix = "") {
    if (!streamData || streamData.result !== 1) {
        if (DEBUG) console.log(logPrefix, "Streamuj.tv vrátil chybu nebo result != 1");
        return [];
    }

    if (!streamData.URL || typeof streamData.URL !== "object") {
        if (DEBUG) console.log(logPrefix, "Streamuj.tv nevrátil URL objekt");
        return [];
    }

    // Dedup + cache pro resolveStreamujDirectUrl (šetří HTTP)
    const resolveCache = new Map(); // playerUrl -> directUrl|null
    const seenPlayerUrls = new Set();

    const candidates = [];

    // Projdeme všechny jazyky a všechny kvality (nejen SD/HD)
    for (const lang of Object.keys(streamData.URL)) {
        const qualityObj = streamData.URL[lang] || {};
        if (DEBUG) console.log(logPrefix, "Streamuj keys:", lang, Object.keys(qualityObj));

        for (const qual of Object.keys(qualityObj)) {
            const playerUrl = qualityObj[qual];

            // subtitles apod. někdy vrací objekt -> přeskočíme
            if (!playerUrl || typeof playerUrl !== "string") {
                if (DEBUG) {
                    console.log(logPrefix, "Přeskakuji ne-video položku:", lang, qual, typeof playerUrl);
                }
                continue;
            }

            // dedupe stejného playerUrl (jinak bys resolvoval HTML víckrát)
            if (seenPlayerUrls.has(playerUrl)) {
                continue;
            }
            seenPlayerUrls.add(playerUrl);

            candidates.push({
                title: `${lang} ${qual}`, // např. "CZ HD", "EN SD", ...
                playerUrl,
            });
        }
    }

    // Resolve direct url (s cache)
    const streams = [];
    for (const cand of candidates) {
        let directUrl;
        if (resolveCache.has(cand.playerUrl)) {
            directUrl = resolveCache.get(cand.playerUrl);
        } else {
            directUrl = await api.resolveStreamujDirectUrl(cand.playerUrl);
            resolveCache.set(cand.playerUrl, directUrl || null);
        }

        if (!directUrl) {
            if (DEBUG) {
                console.log(
                    logPrefix,
                    "Nepodařilo se najít přímé video URL, použiju fallback playerUrl:",
                    cand.playerUrl
                );
            }
        } else {
            if (DEBUG) console.log(logPrefix, "Používám přímé video URL");
        }

        streams.push({
            title: cand.title,
            url: directUrl || cand.playerUrl,
            isFree: true,
        });
    }

    if (DEBUG) console.log(logPrefix, `VRACÍM STREAMY PRO STREMIO: ${streams.length}`);
    return streams;
}

// ------------------------ CINEMETA HELPERS ------------------------

function parseCinemetaId(id) {
    // movie: tt1234567
    // episode: tt1234567:season:episode
    const parts = String(id || "").split(":");
    return {
        imdbId: parts[0] || "",
        season: parts.length >= 3 ? Number(parts[1]) : null,
        episode: parts.length >= 3 ? Number(parts[2]) : null,
        isEpisode: parts.length >= 3,
    };
}

function safeStr(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normTitle(s) {
    return safeStr(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

function extractNumericId(val) {
    if (val == null) return null;

    if (typeof val === "number" && Number.isFinite(val)) return String(val);

    const s = safeStr(val).trim();
    if (!s) return null;

    if (/^\d+$/.test(s)) return s;

    // vezmi poslední čísla před .ext nebo před ?query nebo koncem
    // příklady:
    //  .../35512.jpg
    //  .../35512.jpg?x=1
    //  .../35512
    const m =
        s.match(/(\d+)(?=(\.(jpg|jpeg|png|webp|gif))?(\?.*)?$)/i) ||
        s.match(/\/(\d+)(?:\.\w+)?(?:\?.*)?$/i);

    if (m && m[1]) return m[1];

    const m2 = s.match(/(\d{3,})/);
    if (m2 && m2[1]) return m2[1];

    return null;
}

function getItemTitleCs(it) {
    const nameField = it?.n?.cs;
    if (Array.isArray(nameField)) return nameField[0] || "";
    return safeStr(nameField);
}

function getItemYear(it) {
    const y = it?.y ?? it?.year ?? it?.Year ?? null;
    const n = Number(y);
    return Number.isFinite(n) ? n : null;
}

function getItemId(it) {
    if (!it || typeof it !== "object") return null;

    const preferredKeys = [
        "id",
        "_id",
        "ID",
        "Id",
        "movieId",
        "mid",
        "m",
        "serialId",
        "seriesId",
        "sid",
        "episodeId",
        "epId",
        "eid",
    ];

    for (const k of preferredKeys) {
        const id = extractNumericId(it[k]);
        if (id) return id;
    }

    // častý případ: it.i je obrázek URL, kde je ID na konci
    const fromImage = extractNumericId(it.i);
    if (fromImage) return fromImage;

    // fallback: projdi plochá pole
    for (const k of Object.keys(it)) {
        const v = it[k];
        if (typeof v === "string" || typeof v === "number") {
            const id = extractNumericId(v);
            if (id) return id;
        }
    }

    return null;
}

function scoreMatch({ itemTitle, itemYear, hasId }, targetTitle, targetYear) {
    const a = normTitle(itemTitle);
    const b = normTitle(targetTitle);

    let score = 0;

    if (a && b) {
        if (a === b) score += 6;
        else if (a.includes(b) || b.includes(a)) score += 4;
        else {
            const aw = new Set(a.split(" ").filter(Boolean));
            const bw = new Set(b.split(" ").filter(Boolean));
            let common = 0;
            for (const w of aw) if (bw.has(w)) common++;
            if (common >= 2) score += 2;
            else if (common === 1) score += 1;
        }
    }

    if (targetYear && itemYear) {
        if (Number(targetYear) === Number(itemYear)) score += 2;
        else if (Math.abs(Number(targetYear) - Number(itemYear)) === 1) score += 1;
    }

    // preferuj položky s validním ID (jinak se stejně nedostaneš na detail)
    score += hasId ? 3 : -10;

    return score;
}

function asArraySearchResults(searchRes) {
    if (!searchRes) return [];
    if (Array.isArray(searchRes)) return searchRes;
    if (typeof searchRes !== "object") return [];
    return (
        searchRes.items ||
        searchRes.results ||
        searchRes.data ||
        searchRes.list ||
        searchRes.m ||
        []
    );
}

function pickBestByTitleYear(items, targetTitle, targetYear) {
    if (!Array.isArray(items) || items.length === 0) return null;

    let best = null;
    let bestScore = -9999;

    for (const it of items) {
        const t = getItemTitleCs(it);
        const y = getItemYear(it);
        const id = getItemId(it);

        const s = scoreMatch(
            { itemTitle: t, itemYear: y, hasId: Boolean(id) },
            targetTitle,
            targetYear
        );

        if (s > bestScore) {
            bestScore = s;
            best = it;
        }
    }

    return best;
}

// ------------------------ EPISODE FALLBACK HELPERS ------------------------

function collectEpisodeCandidatesDeep(obj, out = []) {
    if (!obj || typeof obj !== "object") return out;

    if (Array.isArray(obj)) {
        for (const v of obj) collectEpisodeCandidatesDeep(v, out);
        return out;
    }

    const season =
        obj.s ?? obj.season ?? obj.Season ?? obj.se ?? obj.seriesSeason ?? null;
    const episode =
        obj.ep ?? obj.episode ?? obj.Episode ?? obj.e ?? obj.seriesEpisode ?? null;

    const rawId =
        obj.id ?? obj.i ?? obj._id ?? obj.episodeId ?? obj.epId ?? obj.ID ?? null;

    const epId = extractNumericId(rawId);

    if (
        season != null &&
        episode != null &&
        epId != null &&
        Number.isFinite(Number(season)) &&
        Number.isFinite(Number(episode))
    ) {
        out.push({
            season: Number(season),
            episode: Number(episode),
            id: String(epId),
        });
    }

    for (const k of Object.keys(obj)) collectEpisodeCandidatesDeep(obj[k], out);
    return out;
}

function findEpisodeIdInSeriesDetail(seriesDetail, season, episode) {
    const cands = collectEpisodeCandidatesDeep(seriesDetail, []);
    const hit = cands.find(
        (c) => c.season === Number(season) && c.episode === Number(episode)
    );
    return hit?.id || null;
}

// ------------------------ STREAM HANDLER ------------------------

export async function handleStream(api, req, res, type, id) {
    try {
        id = String(id || "");
        type = String(type || "");

        const { imdbId, season, episode, isEpisode } = parseCinemetaId(id);

        // =========================================================
        // CINEMETA ("Objevit") - tt...
        // =========================================================
        if ((type === "movie" || type === "series") && imdbId.startsWith("tt")) {
            if (DEBUG) console.log("[TT] Stream request:", { type, id, imdbId, season, episode });

            // ---------------- MOVIE: tt123...
            if (type === "movie" && !isEpisode) {
                let meta = null;
                try {
                    meta = await api.cinemetaMeta("movie", imdbId);
                } catch (e) {
                    if (DEBUG) console.log("[TT][MOVIE] cinemetaMeta error:", e?.message || e);
                }

                const title = meta?.name;
                const year = meta?.year ? Number(meta.year) : null;

                if (!title) {
                    if (DEBUG) console.log("[TT][MOVIE] Cinemeta meta bez title -> []");
                    return sendJson(res, { streams: [] });
                }

                // 1) najdi film v Sosáči přes search
                let searchRes;
                try {
                    searchRes = await api.movies("search", { arg2: title, arg3: "1" });
                } catch (e) {
                    if (DEBUG) console.log("[TT][MOVIE] Sosáč search fail:", e?.message || e);
                    return sendJson(res, { streams: [] });
                }

                const items = asArraySearchResults(searchRes);
                const best = pickBestByTitleYear(items, title, year);
                const sosacId = best ? getItemId(best) : null;

                if (DEBUG) {
                    console.log("[TT][MOVIE] Best match:", {
                        title,
                        year,
                        sosacId,
                        bestTitle: best ? getItemTitleCs(best) : null,
                        bestYear: best ? getItemYear(best) : null,
                        bestRawId: best ? (best.id ?? best._id ?? best.ID ?? best.i ?? null) : null,
                    });
                }

                if (!sosacId) return sendJson(res, { streams: [] });

                // 2) detail filmu -> linkId -> streamuj
                let data;
                try {
                    data = await api.movies("id", { arg2: String(sosacId) });
                } catch (e) {
                    if (DEBUG) console.log("[TT][MOVIE] Sosáč detail fail:", e?.message || e);
                    return sendJson(res, { streams: [] });
                }

                const linkId = findLinkId(data);
                if (DEBUG) console.log("[TT][MOVIE] linkId:", linkId);
                if (!linkId) return sendJson(res, { streams: [] });

                let streamData;
                try {
                    streamData = await api.streamujGet(linkId);
                } catch (e) {
                    if (DEBUG) console.log("[TT][MOVIE] streamujGet fail:", e?.message || e);
                    return sendJson(res, { streams: [] });
                }

                const streams = await buildStreamsFromStreamuj(api, streamData, "[TT][MOVIE]");
                return sendJson(res, { streams });
            }

            // ---------------- EPISODE: tt123...:S:E (type=series)
            if (
                type === "series" &&
                isEpisode &&
                Number.isFinite(season) &&
                Number.isFinite(episode)
            ) {
                let meta = null;
                try {
                    meta = await api.cinemetaMeta("series", imdbId);
                } catch (e) {
                    if (DEBUG) console.log("[TT][EP] cinemetaMeta error:", e?.message || e);
                }

                const seriesTitle = meta?.name;
                if (!seriesTitle) return sendJson(res, { streams: [] });

                // 1) najdi seriál v Sosáči přes search
                let sRes;
                try {
                    sRes = await api.serials("search", { arg2: seriesTitle, arg5: "1" });
                } catch (e) {
                    if (DEBUG) console.log("[TT][EP] Sosáč search fail:", e?.message || e);
                    return sendJson(res, { streams: [] });
                }

                const sItems = asArraySearchResults(sRes);
                const bestSeries = pickBestByTitleYear(sItems, seriesTitle, null);
                const sosacSeriesId = bestSeries ? getItemId(bestSeries) : null;

                if (DEBUG) {
                    console.log("[TT][EP] Best series match:", {
                        seriesTitle,
                        sosacSeriesId,
                        bestTitle: bestSeries ? getItemTitleCs(bestSeries) : null,
                        bestRawId: bestSeries ? (bestSeries.id ?? bestSeries._id ?? bestSeries.ID ?? bestSeries.i ?? null) : null,
                    });
                }

                if (!sosacSeriesId) return sendJson(res, { streams: [] });

                // 2) najdi epizodu (ideálně vlastní metoda, jinak fallback přes serialDetail)
                let sosacEpisodeId = null;

                try {
                    if (typeof api.findEpisodeId === "function") {
                        sosacEpisodeId = await api.findEpisodeId(String(sosacSeriesId), season, episode);
                    } else {
                        const seriesDetail = await api.serialDetail(String(sosacSeriesId));
                        sosacEpisodeId = findEpisodeIdInSeriesDetail(seriesDetail, season, episode);
                    }
                } catch (e) {
                    if (DEBUG) console.log("[TT][EP] episode resolve fail:", e?.message || e);
                    return sendJson(res, { streams: [] });
                }

                if (DEBUG) console.log("[TT][EP] Resolved sosacEpisodeId:", sosacEpisodeId);
                if (!sosacEpisodeId) return sendJson(res, { streams: [] });

                // 3) detail epizody -> linkId -> streamuj
                let epData;
                try {
                    epData = await api.serials("", { arg2: String(sosacEpisodeId), arg3: "episodes" });
                } catch (e) {
                    if (DEBUG) console.log("[TT][EP] episode detail fail:", e?.message || e);
                    return sendJson(res, { streams: [] });
                }

                const linkId = findLinkId(epData);
                if (DEBUG) console.log("[TT][EP] linkId:", linkId);
                if (!linkId) return sendJson(res, { streams: [] });

                let streamData;
                try {
                    streamData = await api.streamujGet(linkId);
                } catch (e) {
                    if (DEBUG) console.log("[TT][EP] streamujGet fail:", e?.message || e);
                    return sendJson(res, { streams: [] });
                }

                const streams = await buildStreamsFromStreamuj(api, streamData, "[TT][EP]");
                return sendJson(res, { streams });
            }

            // series bez konkrétní epizody
            return sendJson(res, { streams: [] });
        }

        // =========================================================
        // PŮVODNÍ SOSAC ID
        // =========================================================

        // ---------- FILMY ----------
        if (type === "movie" && id.startsWith("sosac-movie-")) {
            const movieId = id.replace("sosac-movie-", "");
            if (DEBUG) console.log("STREAM movie, sosac ID:", movieId);

            const data = await api.movies("id", { arg2: movieId });
            const linkId = findLinkId(data);
            if (DEBUG) console.log("Nalezen linkId pro Streamuj.tv:", linkId);

            if (!linkId) return sendJson(res, { streams: [] });

            const streamData = await api.streamujGet(linkId);
            const streams = await buildStreamsFromStreamuj(api, streamData, "[FILM]");
            return sendJson(res, { streams });
        }

        // ---------- EPIZODY ----------
        if (type === "series" && id.startsWith("sosac-episode-")) {
            const epId = id.replace("sosac-episode-", "");
            if (DEBUG) console.log("STREAM episode, sosac ID:", epId);

            const data = await api.serials("", { arg2: epId, arg3: "episodes" });
            const linkId = findLinkId(data);
            if (DEBUG) console.log("Nalezen linkId pro Streamuj.tv (episode):", linkId);

            if (!linkId) return sendJson(res, { streams: [] });

            const streamData = await api.streamujGet(linkId);
            const streams = await buildStreamsFromStreamuj(api, streamData, "[EPIZODA]");
            return sendJson(res, { streams });
        }

        if (DEBUG) console.log("Stream handler: neznámý typ/id:", type, id);
        return sendJson(res, { streams: [] });
    } catch (e) {
        console.error("Stream error:", e);
        sendError(res, 500, "Stream error: " + e.message);
    }
}
