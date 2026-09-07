#!/usr/bin/env node
/* Сборка сайта: src/template.html + src/locales/*.json → docs/<lang>/index.html
   Запуск: node build.js */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = __dirname, SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'docs');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const siteUrl = cfg.siteUrl.replace(/\/+$/, '');
const basePath = new URL(siteUrl + '/').pathname; // например "/disc-test/" или "/"
const tpl = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const introJs = fs.readFileSync(path.join(SRC, 'intro.js'), 'utf8');
const introHTML = require(path.join(SRC, 'intro.js'));
const ASSETS = path.join(SRC, 'assets');
const nfTpl = fs.readFileSync(path.join(SRC, '404.html'), 'utf8');

const G = 'https://fonts.googleapis.com/css2?';
const BASE_FONTS = 'family=Unbounded:wght@400;500;600&family=Golos+Text:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500';
const FONTS = {
  default: { link: G + BASE_FONTS + '&display=swap',
    head: "'Unbounded',sans-serif", body: "'Golos Text',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" },
  ar: { link: G + BASE_FONTS + '&family=Noto+Kufi+Arabic:wght@500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap',
    head: "'Unbounded','Noto Kufi Arabic',sans-serif", body: "'IBM Plex Sans Arabic','Golos Text',system-ui,'Segoe UI',Tahoma,sans-serif" },
  hi: { link: G + BASE_FONTS + '&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap',
    head: "'Unbounded','Noto Sans Devanagari',sans-serif", body: "'Golos Text','Noto Sans Devanagari',system-ui,sans-serif" },
  // zh: без Google Fonts. В материковом Китае fonts.googleapis.com заблокирован, и запрос стилей
  // подвешивал бы отрисовку страницы. Используются системные шрифты: PingFang (macOS/iOS),
  // Microsoft YaHei (Windows), Noto Sans CJK / Source Han Sans (Android, Linux).
  zh: { link: '',
    head: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC',system-ui,sans-serif",
    body: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC',system-ui,sans-serif" },
  ja: { link: G + BASE_FONTS + '&family=Noto+Sans+JP:wght@400;500;600&display=swap',
    head: "'Unbounded','Noto Sans JP','Hiragino Sans','Yu Gothic',Meiryo,sans-serif", body: "'Golos Text','Noto Sans JP','Hiragino Sans','Yu Gothic',Meiryo,sans-serif" }
};
// Теги подключения Google Fonts; пустая строка для языков без внешних шрифтов.
const fontsHead = f => f.link
  ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${f.link}">`
  : '';
const OG_LOCALE = { en: 'en_US', ru: 'ru_RU', es: 'es_ES', zh: 'zh_CN', ar: 'ar_AR', pt: 'pt_BR', fr: 'fr_FR', de: 'de_DE', ja: 'ja_JP', hi: 'hi_IN' };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Упрощённые SVG-флаги (viewBox 0 0 30 20). Рисуются одинаково на всех платформах, в отличие от эмодзи.
function star(cx, cy, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.382 : r; pts.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2)); }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}
const FLAGS = {
  en: `<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#C8102E" stroke-width="3.6"/>`,
  ru: `<rect width="30" height="20" fill="#fff"/><rect y="6.67" width="30" height="6.67" fill="#0039A6"/><rect y="13.33" width="30" height="6.67" fill="#D52B1E"/>`,
  es: `<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>`,
  zh: `<rect width="30" height="20" fill="#EE1C25"/>` + star(5, 5, 3, '#FFDE00') + star(10, 2, 1, '#FFDE00') + star(12, 4.2, 1, '#FFDE00') + star(12, 7, 1, '#FFDE00') + star(10, 9, 1, '#FFDE00'),
  ar: `<rect width="30" height="20" fill="#006C35"/><path d="M7 8.5c1.5-2.2 3-2.2 4 0s2.5 2.2 4 0 3-2.2 4 0 2.5 2.2 4 0" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><path d="M7.5 13.5H21.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M21.2 12.2v2.6" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`,
  pt: `<rect width="30" height="20" fill="#009C3B"/><polygon points="15,2.5 27,10 15,17.5 3,10" fill="#FFDF00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/><path d="M10.7 9.3c2.9-1.5 5.9-1.3 8.6.4" fill="none" stroke="#fff" stroke-width=".9"/>`,
  fr: `<rect width="10" height="20" fill="#0055A4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#EF4135"/>`,
  de: `<rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#DD0000"/><rect y="13.33" width="30" height="6.67" fill="#FFCE00"/>`,
  ja: `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>`,
  hi: `<rect width="30" height="6.67" fill="#FF9933"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#138808"/><circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width=".8"/><circle cx="15" cy="10" r=".6" fill="#000080"/>`
};
const flagSprite = codes => `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">` +
  codes.map(c => `<symbol id="flag-${c}" viewBox="0 0 30 20">${FLAGS[c] || `<rect width="30" height="20" fill="#888"/>`}</symbol>`).join('') + `</svg>`;
const flag = c => `<svg class="flag" aria-hidden="true" focusable="false"><use href="#flag-${c}"/></svg>`;
const missing = cfg.languages.filter(code => !fs.existsSync(path.join(SRC, 'locales', code + '.json')));
if (missing.length) console.warn('WARNING: locales not found, skipped: ' + missing.join(', '));
const locales = cfg.languages.filter(code => !missing.includes(code)).map(code => {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8'));
  if (L.lang !== code) throw new Error(code + '.json: lang mismatch');
  return L;
});
const def = locales.find(L => L.lang === cfg.defaultLang) || locales[0];
const pathOf = code => code === def.lang ? '' : code + '/';   // язык по умолчанию живёт в корне сайта
const urlOf = code => siteUrl + '/' + pathOf(code);
const hls = code => { const v = cfg.hreflang && cfg.hreflang[code]; return v ? (Array.isArray(v) ? v : [v]) : [code]; };
const hl = code => hls(code)[0];
const hreflangTags = locales.flatMap(L => hls(L.lang).map(h => `<link rel="alternate" hreflang="${h}" href="${urlOf(L.lang)}">`))
  .concat([`<link rel="alternate" hreflang="x-default" href="${siteUrl}/">`]).join('\n');
const escFull = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tFor = L => (key, vars) => { let v = L.ui[key]; if (v == null) v = key; if (vars) v = v.replace(/\{(\w+)\}/g, (_, n) => vars[n] != null ? vars[n] : '{' + n + '}'); return v; };
const KEYS = ['D', 'I', 'S', 'C'];
const LANG_PATH = Object.fromEntries(locales.map(L => [L.lang, pathOf(L.lang)]));
const LANG_META = Object.fromEntries(locales.map(L => [L.lang, { name: L.name, cont: L.ui['root.continue'] || L.name, dir: L.dir }]));
const lastmod = files => { try { return execSync('git log -1 --format=%cs -- ' + files.map(f => JSON.stringify(f)).join(' '), { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; } catch (e) { return null; } };
const today = new Date().toISOString().slice(0, 10);
const jsonLd = L => JSON.stringify([
  { '@context': 'https://schema.org', '@type': 'WebSite', name: 'DISC Test', alternateName: L.brand, url: siteUrl + '/', inLanguage: L.lang },
  { '@context': 'https://schema.org', '@type': 'WebApplication', name: L.brand, url: urlOf(L.lang), description: L.description,
    applicationCategory: 'Personality test', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', inLanguage: L.lang,
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, image: `${siteUrl}/og/${L.lang}.png`,
    publisher: { '@type': 'Organization', name: 'DISC Test', url: siteUrl + '/', logo: `${siteUrl}/icon-512.png` } }
]).replace(/</g, '\\u003c');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const L of locales) {
  const f = FONTS[L.lang] || FONTS.default;
  const isRoot = L.lang === def.lang, rootRel = isRoot ? './' : '../';
  const href = x => rootRel + pathOf(x.lang);
  const chevron = `<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const switcher = `<div class="langsel" id="langSel">` +
    `<button type="button" class="langbtn" id="langBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(L.ui.langLabel)}">${flag(L.lang)}<span class="langname">${esc(L.name)}</span>${chevron}</button>` +
    `<ul class="langmenu" id="langMenu" role="listbox" aria-label="${esc(L.ui.langLabel)}" hidden>` +
    locales.map(x => `<li role="none"><a role="option" href="${href(x)}" hreflang="${hl(x.lang)}" lang="${x.lang}" data-lang="${x.lang}" aria-selected="${x.lang === L.lang}" tabindex="-1">${flag(x.lang)}<span>${esc(x.name)}</span></a></li>`).join('') +
    `</ul></div>`;
  const links = locales.map(x => `<a href="${href(x)}" hreflang="${hl(x.lang)}" lang="${x.lang}" data-lang="${x.lang}"${x.lang === L.lang ? ' aria-current="page"' : ''}>${flag(x.lang)}<span>${esc(x.name)}</span></a>`).join('');
  const html = tpl
    .replace(/__LANG__/g, L.lang).replace(/__DIR__/g, L.dir)
    .replace(/__TITLE__/g, esc(L.title)).replace(/__DESC__/g, esc(L.description))
    .replace(/__CANONICAL__/g, urlOf(L.lang)).replace(/__OG_LOCALE__/g, OG_LOCALE[L.lang] || L.lang)
    .replace(/__OG_ALTERNATES__/g, () => locales.filter(x => x !== L).map(x => `<meta property="og:locale:alternate" content="${OG_LOCALE[x.lang] || x.lang}">`).join('\n'))
    .replace(/__OG_IMAGE__/g, `${siteUrl}/og/${L.lang}.png`)
    .replace(/__ROOT_REL__/g, rootRel).replace(/__IS_ROOT__/g, isRoot ? '1' : '0')
    .replace('__LANG_PATH_JSON__', () => JSON.stringify(LANG_PATH)).replace('__LANG_META_JSON__', () => JSON.stringify(LANG_META).replace(/</g, '\\u003c'))
    .replace('__JSON_LD__', () => jsonLd(L))
    .replace('__INTRO_JS__', () => introJs.replace(/\nif \(typeof module[^\n]*\n?$/, '\n'))
    .replace('__INTRO_HTML__', () => introHTML({ L, t: tFor(L), esc: escFull, KEYS, colorVar: k => 'var(--' + k.toLowerCase() + ')', who: {}, progDone: 0, lastDate: '' }))
    .replace(/__HREFLANG__/g, hreflangTags)
    .replace(/__FONTS_HEAD__/g, () => fontsHead(f)).replace(/__FONT_HEAD__/g, f.head).replace(/__FONT_BODY__/g, f.body)
    .replace(/__BRAND__/g, esc(L.brand)).replace(/__LANG_LABEL__/g, esc(L.ui.langLabel))
    .replace('__LANG_SWITCHER__', () => switcher).replace('__LANG_LINKS__', () => links).replace('__FLAG_SPRITE__', () => flagSprite(locales.map(x => x.lang)))
    .replace(/__FOOTER__/g, esc(L.ui.footer)).replace(/__ADMIN_LINK__/g, esc(L.ui.adminLink)).replace(/__PRIVACY__/g, esc(L.ui.privacy))
    .replace(/__EMAIL__/g, String(cfg.contactEmail || '').replace(/['\\]/g, ''))
    .replace(/__SEND_ENDPOINT__/g, String(cfg.sendEndpoint || '').replace(/['\\]/g, ''))
    .replace(/__SEND_TOKEN__/g, String(cfg.sendToken || '').replace(/['\\]/g, ''))
    .replace('__LOCALE_JSON__', () => JSON.stringify(L).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, ''));
  fs.mkdirSync(path.join(OUT, pathOf(L.lang)), { recursive: true });
  fs.writeFileSync(path.join(OUT, pathOf(L.lang), 'index.html'), html);
}
// /en/ (язык по умолчанию) перенаправляет в корень: адрес существовал раньше и мог быть сохранён
fs.mkdirSync(path.join(OUT, def.lang), { recursive: true });
fs.writeFileSync(path.join(OUT, def.lang, 'index.html'), `<!doctype html><html lang="${def.lang}"><head><meta charset="utf-8"><title>${esc(def.brand)}</title><meta http-equiv="refresh" content="0; url=../"><link rel="canonical" href="${siteUrl}/"><script>location.replace('../'+location.hash)</script></head><body><a href="../">${esc(def.brand)}</a></body></html>\n`);

fs.writeFileSync(path.join(OUT, '404.html'), nfTpl.replace(/__BASE__/g, basePath));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
const alt = locales.flatMap(x => hls(x.lang).map(h => `<xhtml:link rel="alternate" hreflang="${h}" href="${urlOf(x.lang)}"/>`)).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/"/>`;
const urls = locales.map(L => `  <url><loc>${urlOf(L.lang)}</loc><lastmod>${lastmod([`src/locales/${L.lang}.json`, 'src/template.html', 'src/intro.js']) || today}</lastmod>${alt}</url>`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
if (cfg.customDomain) fs.writeFileSync(path.join(OUT, 'CNAME'), cfg.customDomain + '\n');

// Иконки, og-картинки, манифест (файлы готовятся заранее командой node scripts/make-assets.js)
for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  const src = path.join(ASSETS, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f)); else console.warn('WARNING: missing asset ' + f + ' (run node scripts/make-assets.js)');
}
fs.mkdirSync(path.join(OUT, 'og'), { recursive: true });
for (const L of locales) {
  const src = path.join(ASSETS, 'og', L.lang + '.png');
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, 'og', L.lang + '.png')); else console.warn('WARNING: missing og image for ' + L.lang);
}
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({ name: 'DISC Test', short_name: 'DISC', start_url: basePath, display: 'standalone', background_color: '#F3F4F6', theme_color: '#1B2027',
  icons: [{ src: basePath + 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: basePath + 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2) + '\n');

// Google Apps Script для отправки писем: шаблон + данные из локалей (названия стилей, профили, тексты письма)
const BLOCK_KEYS = (tpl.match(/var BLOCK_KEYS = (\[[^\]]+\]);/) || [])[1];
if (!BLOCK_KEYS) throw new Error('BLOCK_KEYS not found in template');
const mailData = {};
for (const L of locales) {
  const email = {};
  for (const k of Object.keys(L.ui)) if (k.startsWith('email.')) email[k.slice(6)] = L.ui[k];
  mailData[L.lang] = { name: L.name, dir: L.dir, keys: L.keys, profiles: L.profiles, email };
}
const gsTpl = fs.readFileSync(path.join(SRC, 'apps-script.template.js'), 'utf8');
const gs = gsTpl
  .replace('__SITE_URL__', siteUrl).replace('__SEND_TOKEN__', String(cfg.sendToken || '').replace(/['\\]/g, ''))
  .replace('__BLOCK_KEYS__', BLOCK_KEYS).replace('__DATA__', () => JSON.stringify(mailData));
fs.mkdirSync(path.join(ROOT, 'backend', 'apps-script'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'backend', 'apps-script', 'Code.gs'), gs);
console.log(`Built ${locales.length} languages (root = ${def.lang}) → docs/ (${locales.map(L => L.lang).join(', ')}); backend/apps-script/Code.gs${cfg.sendEndpoint ? '' : ' (sendEndpoint не задан: письма не отправляются)'}`);
