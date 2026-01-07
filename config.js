// config.js

export const serverConfig = {
    // poslouchá na všech rozhraních
    host: process.env.ADDON_HOST || "0.0.0.0",
    port: Number(process.env.ADDON_PORT || 2283),
  };

  export const sosacConfig = {
    // Doména API Sosáče – stejně jako v Kodi
    sosac_domain: process.env.SOSAC_DOMAIN || "kodi-api.sosac.to",

    // Streamuj.TV provider – stejně jako v Kodi
    streaming_provider: process.env.STREAMING_PROVIDER || "www.streamuj.tv",

    // Přihlášení na Sosáč (doporučeno přes ENV)
    sosac_user: process.env.SOSAC_USER || "",
    sosac_pass: process.env.SOSAC_PASS || "",

    // Přihlášení na Streamuj.TV (pokud nemáš, nech prázdné)
    streamujtv_user: process.env.STREAMUJ_USER || "",
    streamujtv_pass: process.env.STREAMUJ_PASS || "",

    // v Kodi to byl index, tady prostě "0" nebo "1"
    streamujtv_location: process.env.STREAMUJ_LOCATION || "0",
  };

  export default {
    serverConfig,
    sosacConfig,
  };
