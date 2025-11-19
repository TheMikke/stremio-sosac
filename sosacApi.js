// sosacApi.js  — pure ES modules version
import crypto from "crypto";

// Helper: global fetch for Node 18+ is built-in
// If your node is older, uncomment:
// import fetch from "node-fetch";

export default class SosacApi {
    constructor(cfg) {
        this.sosacDomain = cfg.sosac_domain;
        this.streamujDomain = cfg.streaming_provider;

        this.sosacUser = cfg.sosac_user;
        this.sosacPass = cfg.sosac_pass;

        this.streamujUser = cfg.streamujtv_user;
        this.streamujPass = cfg.streamujtv_pass;

        this.streamujLocation =
            String(parseInt(cfg.streamujtv_location || "0", 10) + 1);

        this.SOSAC_API = `https://${this.sosacDomain}/`;
        this.STREAMUJ_API = `https://${this.streamujDomain}/json_api_player.php?`;

        this._sosacPasswordHash = null;
        this._checkedLogin = false;
    }

    // ------------------- UTILITIES ------------------------

    md5(str) {
        return crypto.createHash("md5").update(str).digest("hex");
    }

    async getPasshash() {
        if (this._sosacPasswordHash) return this._sosacPasswordHash;

        if (!this.sosacUser || !this.sosacPass)
            throw new Error("Sosac: chybí login nebo heslo.");

        const pass1 = this.md5(`${this.sosacUser}:${this.sosacPass}`);
        const pass2 = this.md5(pass1 + "EWs5yVD4QF2sshGm22EWVa");

        this._sosacPasswordHash = pass2;

        if (!this._checkedLogin) {
            this._checkedLogin = true;
            const url = `${this.SOSAC_API}movies/lists/popular?pocet=10&stranka=1&username=${encodeURIComponent(
                this.sosacUser
            )}&password=${encodeURIComponent(pass2)}`;

            try {
                const r = await fetch(url);
                if (r.status === 401) throw new Error("Sosac: špatné heslo.");
                if (r.status === 403) throw new Error("Sosac: přístup odmítnut.");

                const data = await r.json().catch(() => null);
                if (data && Array.isArray(data) && data[0]?.w === null)
                    throw new Error("Sosac: účet nemá přístup / Licence chyba.");

            } catch (e) {
                throw new Error(
                    "Sosac: ověřovací request selhal: " + e.message
                );
            }
        }

        return this._sosacPasswordHash;
    }

    async getJson(url) {
        console.log("Volání API na URL:", url);
        const r = await fetch(url);
        if (!r.ok)
            throw new Error(`HTTP GET ${url} selhalo: ${r.status}`);
        return r.json();
    }

    async postForm(url) {
        const r = await fetch(url, { method: "POST" });
        if (!r.ok)
            throw new Error(`HTTP POST ${url} selhalo: ${r.status}`);
        return true;
    }

    async postJson(url, bodyObj) {
        const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyObj),
        });
        if (!r.ok)
            throw new Error(`HTTP POST(JSON) ${url} selhalo: ${r.status}`);
        try {
            return await r.json();
        } catch {
            return {};
        }
    }

    // ------------------- STREAMUJ TV ------------------------

    async streamujGet(stream) {
    if (!this.streamujUser || !this.streamujPass)
        throw new Error("StreamujTV: chybí login nebo heslo.");

    const passMd5 = this.md5(this.streamujPass);
    const loc = this.streamujLocation;

    let url;

    if (stream) {
        // Požadavek na získání streamovacích odkazů
        url =
            `${this.STREAMUJ_API}action=get-video-links&d=19&link=${encodeURIComponent(
                stream
            )}` +
            `&login=${encodeURIComponent(this.streamujUser)}` +
            `&password=${encodeURIComponent(passMd5)}` +
            `&location=${encodeURIComponent(loc)}`;

        // Získáme odpověď z API
        const response = await this.getJson(url);

        // Pokud je odpověď správná, vybereme kvalitní verzi (HD nebo SD)
        if (response.result === 1 && response.URL) {
            // Pokud chceme HD verzi, můžeme to nastavit podle potřeby
            const videoUrl = response.URL.CZ.HD || response.URL.CZ.SD;

            if (videoUrl) {
                console.log("Streamovací odkaz pro přehrání:", videoUrl); // Debug log
                return videoUrl; // Vracení správného odkazu
            } else {
                throw new Error("StreamujTV: Žádný dostupný stream.");
            }
        } else {
            throw new Error("StreamujTV: Chyba při získávání streamu.");
            }
        }
    }

    // ------------------- MOVIES ------------------------

    async movies(stream, { arg2, arg3 } = {}) {
        const hash = await this.getPasshash();
        const page = arg3 || "1";
        let url;

        if (stream === "a-z") {
            url =
                `${this.SOSAC_API}movies/lists/a-z?l=${encodeURIComponent(
                    arg2?.toLowerCase() || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "by-year") {
            url =
                `${this.SOSAC_API}movies/lists/by-year?y=${encodeURIComponent(
                    arg2 || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "by-quality") {
            url =
                `${this.SOSAC_API}movies/lists/by-quality?q=${encodeURIComponent(
                    arg2 || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "by-genre") {
            url =
                `${this.SOSAC_API}movies/lists/by-genre?g=${encodeURIComponent(
                    arg2 || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "search") {
            url =
                `${this.SOSAC_API}movies/simple-search?q=${encodeURIComponent(
                    arg2 || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "watching-time") {
            url =
                `${this.SOSAC_API}movies/${encodeURIComponent(
                    arg2
                )}/watching-time?username=${this.sosacUser}&password=${hash}&d=19`;

        } else if (stream === "id") {
            url =
                `${this.SOSAC_API}movies/${encodeURIComponent(arg2)}?username=${
                    this.sosacUser
                }&password=${hash}`;

        } else if (stream === "into-queue") {
            url =
                `${this.SOSAC_API}movies/${encodeURIComponent(
                    arg2
                )}/into-queue?username=${this.sosacUser}&password=${hash}`;
            await this.postForm(url);
            return { ok: true };

        } else if (stream === "off-queue") {
            url =
                `${this.SOSAC_API}movies/${encodeURIComponent(
                    arg2
                )}/off-queue?username=${this.sosacUser}&password=${hash}`;
            await this.postForm(url);
            return { ok: true };

        } else {
            url =
                `${this.SOSAC_API}movies/lists/${encodeURIComponent(
                    stream
                )}?pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;
        }

        return this.getJson(url);
    }

    async moviesAdvanced(opts) {
        const hash = await this.getPasshash();
        const page = opts.page || "1";

        const year =
            opts.yearTo && opts.yearTo !== ""
                ? `${parseInt(opts.yearFrom)} , ${parseInt(opts.yearTo)}`
                : opts.yearFrom;

        const quality =
            !opts.quality || opts.quality === "All" || opts.quality === "Vše"
                ? ""
                : opts.quality;

        const url =
            `${this.SOSAC_API}movies/advanced-search?` +
            `k=${encodeURIComponent(opts.keyword || "")}` +
            `&y=${encodeURIComponent(year || "")}` +
            `&g=${encodeURIComponent(opts.genre || "")}` +
            `&q=${encodeURIComponent(quality || "")}` +
            `&c=${encodeURIComponent(opts.country || "")}` +
            `&l=${encodeURIComponent(opts.language || "")}` +
            `&d=${encodeURIComponent(opts.director || "")}` +
            `&s=${encodeURIComponent(opts.writer || "")}` +
            `&a=${encodeURIComponent(opts.actor || "")}` +
            `&o=${encodeURIComponent(opts.sortValue || "")}` +
            `&pocet=10&stranka=${page}` +
            `&username=${this.sosacUser}&password=${hash}`;

        return this.getJson(url);
    }

    // ------------------- SERIALS / EPISODES ------------------------

    async serials(stream, args = {}) {
        const hash = await this.getPasshash();
        const page = args.arg5 || "1";
        const episodes = args.arg3 || "";
        let url;

        if (stream === "a-z") {
            url =
                `${this.SOSAC_API}serials/lists/a-z?l=${encodeURIComponent(
                    args.arg2?.toLowerCase() || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "by-year") {
            url =
                `${this.SOSAC_API}serials/lists/by-year?y=${encodeURIComponent(
                    args.arg2 || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "by-quality") {
            url =
                `${this.SOSAC_API}serials/lists/by-quality?q=${encodeURIComponent(
                    args.arg2 || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "by-genre") {
            url =
                `${this.SOSAC_API}serials/lists/by-genre?g=${encodeURIComponent(
                    args.arg2 || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "search") {
            url =
                `${this.SOSAC_API}serials/simple-search?q=${encodeURIComponent(
                    args.arg2 || ""
                )}` +
                `&pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;

        } else if (stream === "watching-time" && episodes === "episodes") {
            url =
                `${this.SOSAC_API}episodes/${encodeURIComponent(
                    args.arg2
                )}/watching-time?username=${this.sosacUser}&password=${hash}&d=19`;

        } else if (stream === "watching-time") {
            url =
                `${this.SOSAC_API}serials/${encodeURIComponent(
                    args.arg2
                )}/watching-time?username=${this.sosacUser}&password=${hash}&d=19`;

        } else if (episodes === "episodes") {
            const id = args.arg2;
            if (id !== "22") {
                url =
                    `${this.SOSAC_API}episodes/${encodeURIComponent(
                        id
                    )}?username=${this.sosacUser}&password=${hash}`;
            } else {
                url =
                    `${this.SOSAC_API}episodes/lists/${encodeURIComponent(
                        stream
                    )}?pocet=100&stranka=${page}&username=${
                        this.sosacUser
                    }&password=${hash}`;
            }

        } else {
            url =
                `${this.SOSAC_API}serials/lists/${encodeURIComponent(
                    stream
                )}?pocet=100&stranka=${page}&username=${this.sosacUser}&password=${hash}`;
        }

        return this.getJson(url);
    }

    async serialDetail(id) {
        const hash = await this.getPasshash();
        const url =
            `${this.SOSAC_API}serials/${encodeURIComponent(
                id
            )}?username=${this.sosacUser}&password=${hash}`;
        return this.getJson(url);
    }

    // ------------------- WATCH TIME ------------------------

    async setWatchTime(type, id, seconds) {
        const hash = await this.getPasshash();
        const t = parseInt(seconds);

        const url =
            `${this.SOSAC_API}${type}/${encodeURIComponent(
                id
            )}/watching-time?username=${this.sosacUser}&password=${hash}&d=19`;

        return this.postJson(url, { time: t });
    }

    // ------------------- TITLE FROM PATH ------------------------

    async getTitleFromFilename(path) {
        const fn = path.split("/").pop();
        if (!fn) return "";
        const id = fn.split("-")[0];
        const isMovie = path.includes("movies");

        const data = isMovie
            ? await this.movies("id", { arg2: id })
            : await this.serials("", { arg2: id, arg3: "episodes" });

        const nameField = data?.n?.cs;
        let name = Array.isArray(nameField) ? nameField[0] : nameField;

        if (!isMovie) {
            const ep = data.ep;
            const s = data.s;
            const epN = String(ep).padStart(2, "0");
            const sN = String(s).padStart(2, "0");
            name = `${name} ${sN}x${epN}`;
        }
        return name;
    }
}