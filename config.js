// config.js

export const serverConfig = {
    // poslouchá na všech rozhraních, port 2283 kvůli Tailscale Funnel
    host: "0.0.0.0",
    port: 2283
};

export const sosacConfig = {
    // Doména API Sosáče – stejně jako v Kodi
    sosac_domain: "kodi-api.sosac.to",

    // Streamuj.TV provider – stejně jako v Kodi
    streaming_provider: "www.streamuj.tv",

    // Přihlášení na Sosáč
    sosac_user: "TVUJ_LOGIN_NA_SOSAC",
    sosac_pass: "TVOJE_HESLO_NA_SOSAC",

    // Přihlášení na Streamuj.TV (pokud nemáš, nech prázdné)
    streamujtv_user: "TVUJ_LOGIN_NA_STREAMUJTV",
    streamujtv_pass: "TVOJE_HESLO_NA_STREAMUJTV",

    // v Kodi to byl index, tady prostě "0" nebo "1"
    streamujtv_location: "0"
};

export default {
    serverConfig,
    sosacConfig
};
