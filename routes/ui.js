// routes/ui.js
// UI renderer (HTML + CSS) pro /configure (GET/POST výsledky)

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeJs(s) {
  return String(s || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "");
}

// Reusable wrapper se stejným stylem jako tvůj configure (aby “Hotovo” vypadalo stejně)
function styledPage({ title, subtitle, bodyHtml }) {
  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root{
      --bg1:#0b1220;
      --bg2:#0b2a3a;
      --card: rgba(255,255,255,.08);
      --card2: rgba(255,255,255,.06);
      --text: rgba(255,255,255,.92);
      --muted: rgba(255,255,255,.70);
      --line: rgba(255,255,255,.12);
      --accent: #7dd3fc;
      --accent2:#a78bfa;
      --danger:#fb7185;
      --shadow: 0 20px 60px rgba(0,0,0,.45);
      --radius: 18px;
      --radius2: 14px;
      font-synthesis-weight:none;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      color:var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      background:
        radial-gradient(1200px 600px at 20% 10%, rgba(167,139,250,.30), transparent 55%),
        radial-gradient(900px 500px at 80% 20%, rgba(125,211,252,.25), transparent 55%),
        linear-gradient(180deg, var(--bg1), var(--bg2));
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:28px 16px;
    }
    .wrap{ width:min(820px, 100%); }
    .card{
      background: linear-gradient(180deg, var(--card), var(--card2));
      border:1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow:hidden;
    }
    .head{
      padding:22px 22px 14px;
      border-bottom: 1px solid var(--line);
      background: rgba(255,255,255,.03);
    }
    .badge{
      display:inline-flex;
      gap:8px;
      align-items:center;
      padding:6px 10px;
      border-radius: 999px;
      background: rgba(125,211,252,.14);
      border: 1px solid rgba(125,211,252,.25);
      color: var(--text);
      font-size: 12px;
      letter-spacing: .2px;
    }
    h1{
      margin:10px 0 6px;
      font-size: 22px;
      line-height: 1.2;
    }
    p{margin:0 0 10px; color:var(--muted); line-height:1.45}
    .content{padding:22px}

    .section{
      margin-bottom:16px;
      padding:16px;
      border:1px solid var(--line);
      border-radius: var(--radius2);
      background: rgba(255,255,255,.03);
    }
    .section h2{
      margin:0 0 10px;
      font-size:14px;
      letter-spacing:.25px;
      text-transform:uppercase;
      color: rgba(255,255,255,.86);
    }

    label{display:block; font-size:13px; color: rgba(255,255,255,.85); margin-bottom:8px}
    .grid{display:grid; grid-template-columns:1fr 1fr; gap:12px}
    @media (max-width: 520px){ .grid{grid-template-columns:1fr} }

    input, select{
      width:100%;
      padding:12px 12px;
      border-radius: 12px;
      border:1px solid rgba(255,255,255,.14);
      background: rgba(8,14,26,.55);
      color: var(--text);
      outline:none;
    }
    input:focus, select:focus{
      border-color: rgba(125,211,252,.55);
      box-shadow: 0 0 0 3px rgba(125,211,252,.15);
    }

    .hint{font-size:12px; color: var(--muted); margin-top:6px}

    /* DEFAULT: tlačítka jsou úzká (jen na text) */
    .btn{
      width:auto;
      margin-top:0;
      padding:12px 14px;
      border-radius: 14px;
      border:1px solid rgba(255,255,255,.18);
      background: rgba(255,255,255,.10);
      color: var(--text);
      font-weight: 650;
      cursor:pointer;
      text-decoration:none;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:10px;
    }
    .btn:hover{filter:brightness(1.06)}
    .btn.primary{
      background: linear-gradient(135deg, rgba(125,211,252,.35), rgba(167,139,250,.35));
    }

    /* FULL-WIDTH varianta jen tam, kde chceš */
    .btn.full{
      width:100%;
      display:flex;          /* ať je to pěkně přes celý box */
      justify-content:center;
      margin-top:12px;       /* zachová původní spacing u submitu */
    }

    .row{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin-top:10px;
      align-items:flex-start;
    }

    pre, code{
      display:block;
      padding:10px 12px;
      border-radius: 12px;
      background: rgba(0,0,0,.25);
      border:1px solid rgba(255,255,255,.10);
      color: rgba(255,255,255,.88);
      overflow:auto;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .ok{
      display:flex;
      align-items:flex-start;
      gap:12px;
      padding:14px 14px;
      border-radius: var(--radius2);
      border:1px solid rgba(125,211,252,.25);
      background: rgba(125,211,252,.10);
      margin-bottom: 14px;
    }
    .ok .icon{ font-size: 20px; line-height: 1; margin-top: 2px; }

    .warn{
      border-left: 3px solid var(--danger);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="head">
        <span class="badge">Stremio Addon • Sosáč + StreamujTV</span>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ``}
      </div>
      <div class="content">
        ${bodyHtml}
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function renderConfigurePage() {
  const bodyHtml = `
    <form method="POST" action="">
      <div class="section">
        <h2>Sosáč</h2>
        <div class="grid">
          <div>
            <label>Uživatel</label>
            <input name="sosac_user" autocomplete="username" required>
          </div>
          <div>
            <label>Heslo</label>
            <input name="sosac_pass" type="password" autocomplete="current-password" required>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Streamuj.TV</h2>
        <div class="grid">
          <div>
            <label>Uživatel</label>
            <input name="streamujtv_user" autocomplete="username" required>
          </div>
          <div>
            <label>Heslo</label>
            <input name="streamujtv_pass" type="password" autocomplete="current-password" required>
          </div>
        </div>
      </div>

      <p class="hint" style="margin: 10px 0 0;">
        Vygeneruje se ti unikátní URL. Tu pak vložíš do Stremio:
        <b>Addons → Community Addons → install from URL</b>.
      </p>

      <!-- Tohle chceme přes celou šířku -->
      <button class="btn primary full" type="submit">Vygenerovat můj manifest</button>
    </form>
  `;

  return styledPage({
    title: "Nastavení doplňku",
    subtitle: "Zadej své údaje k účtům. Po uložení dostaneš vlastní manifest URL.",
    bodyHtml,
  });
}

export function renderConfiguredPage({ manifestUrl }) {
  const installUrl = `stremio://${String(manifestUrl).replace(/^https?:\/\//, "")}`;
  const installWebUrl = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifestUrl)}`;

  const bodyHtml = `
    <div class="row">
      <a class="btn primary" href="${escapeHtml(installUrl)}">Instalovat do Stremio</a>
      <a class="btn" href="${escapeHtml(installWebUrl)}" target="_blank" rel="noopener">Otevřít ve Stremio Web</a>
    </div>
    <div class="section" style="margin-top:14px;">
      <h2>Manifest URL</h2>
      <p class="hint" style="margin-top:0;">
        Nebo vlož URL manuálně do Stremio: Addons → Community Addons → install from URL:
      </p>
      <pre id="manifestBox">${escapeHtml(manifestUrl)}</pre>

      <div class="row">
        <button class="btn" type="button" id="copyBtn">Zkopírovat manifest URL</button>
      </div>
    </div>

    <script>
      const btn = document.getElementById('copyBtn');
      btn?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText('${escapeJs(manifestUrl)}');
          btn.textContent = 'Zkopírováno ✅';
          setTimeout(() => btn.textContent = 'Zkopírovat manifest URL', 1400);
        } catch (e) {
          btn.textContent = 'Nešlo zkopírovat';
          setTimeout(() => btn.textContent = 'Zkopírovat manifest URL', 1400);
        }
      });
    </script>
  `;

  return styledPage({
    title: "Hotovo ✅",
    subtitle: "Vygeneroval jsem ti unikátní manifest URL pro Stremio.",
    bodyHtml,
  });
}

export function renderErrorPage({ title = "Chyba", message, backHref = "configure", status = 400 }) {
  const bodyHtml = `
    <div class="section warn">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message || "Nastala chyba.")}</p>
      <div class="row">
        <a class="btn primary" href="${escapeHtml(backHref)}">Zpět</a>
      </div>
      <p class="hint" style="margin-top:10px;">HTTP ${Number(status) || 400}</p>
    </div>
  `;

  return styledPage({
    title,
    subtitle: "Oprav vstup a zkus to znovu.",
    bodyHtml,
  });
}
