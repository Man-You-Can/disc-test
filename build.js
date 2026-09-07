#!/usr/bin/env node
/* Сборка сайта: src/template.html + src/locales/*.json → docs/<lang>/index.html
   Запуск: node build.js */
const fs = require('fs'), path = require('path');
const ROOT = __dirname, SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'docs');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const siteUrl = cfg.siteUrl.replace(/\/+$/, '');
const basePath = new URL(siteUrl + '/').pathname; // например "/disc-test/" или "/"
const tpl = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const rootTpl = fs.readFileSync(path.join(SRC, 'root.html'), 'utf8');
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
  zh: { link: G + BASE_FONTS + '&family=Noto+Sans+SC:wght@400;500;600&display=swap',
    head: "'Unbounded','Noto Sans SC','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif", body: "'Golos Text','Noto Sans SC','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif" },
  ja: { link: G + BASE_FONTS + '&family=Noto+Sans+JP:wght@400;500;600&display=swap',
    head: "'Unbounded','Noto Sans JP','Hiragino Sans','Yu Gothic',Meiryo,sans-serif", body: "'Golos Text','Noto Sans JP','Hiragino Sans','Yu Gothic',Meiryo,sans-serif" }
};
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
const hl = code => (cfg.hreflang && cfg.hreflang[code]) || code;
const hreflangTags = locales.map(L => `<link rel="alternate" hreflang="${hl(L.lang)}" href="${siteUrl}/${L.lang}/">`)
  .concat([`<link rel="alternate" hreflang="x-default" href="${siteUrl}/">`]).join('\n');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const L of locales) {
  const f = FONTS[L.lang] || FONTS.default;
  const chevron = `<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const switcher = `<div class="langsel" id="langSel">` +
    `<button type="button" class="langbtn" id="langBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(L.ui.langLabel)}">${flag(L.lang)}<span class="langname">${esc(L.name)}</span>${chevron}</button>` +
    `<ul class="langmenu" id="langMenu" role="listbox" aria-label="${esc(L.ui.langLabel)}" hidden>` +
    locales.map(x => `<li role="none"><a role="option" href="../${x.lang}/" hreflang="${hl(x.lang)}" lang="${x.lang}" data-lang="${x.lang}" aria-selected="${x.lang === L.lang}" tabindex="-1">${flag(x.lang)}<span>${esc(x.name)}</span></a></li>`).join('') +
    `</ul></div>`;
  const links = locales.map(x => `<a href="../${x.lang}/" hreflang="${hl(x.lang)}" lang="${x.lang}" data-lang="${x.lang}"${x.lang === L.lang ? ' aria-current="page"' : ''}>${flag(x.lang)}<span>${esc(x.name)}</span></a>`).join('');
  const html = tpl
    .replace(/__LANG__/g, L.lang).replace(/__DIR__/g, L.dir)
    .replace(/__TITLE__/g, esc(L.title)).replace(/__DESC__/g, esc(L.description))
    .replace(/__CANONICAL__/g, `${siteUrl}/${L.lang}/`).replace(/__OG_LOCALE__/g, OG_LOCALE[L.lang] || L.lang)
    .replace(/__HREFLANG__/g, hreflangTags)
    .replace(/__FONTS_LINK__/g, f.link).replace(/__FONT_HEAD__/g, f.head).replace(/__FONT_BODY__/g, f.body)
    .replace(/__BRAND__/g, esc(L.brand)).replace(/__LANG_LABEL__/g, esc(L.ui.langLabel))
    .replace('__LANG_SWITCHER__', () => switcher).replace('__LANG_LINKS__', () => links).replace('__FLAG_SPRITE__', () => flagSprite(locales.map(x => x.lang)))
    .replace(/__FOOTER__/g, esc(L.ui.footer)).replace(/__ADMIN_LINK__/g, esc(L.ui.adminLink)).replace(/__PRIVACY__/g, esc(L.ui.privacy))
    .replace(/__EMAIL__/g, String(cfg.contactEmail || '').replace(/['\\]/g, ''))
    .replace('__LOCALE_JSON__', () => JSON.stringify(L).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, ''));
  fs.mkdirSync(path.join(OUT, L.lang), { recursive: true });
  fs.writeFileSync(path.join(OUT, L.lang, 'index.html'), html);
}

// Корневая страница: автоопределение языка + список языков
const def = locales.find(L => L.lang === cfg.defaultLang) || locales[0];
const rootHtml = rootTpl
  .replace(/__TITLE__/g, esc(def.ui['root.title'])).replace(/__DESC__/g, esc(def.description))
  .replace(/__LEAD__/g, esc(def.ui['root.lead'])).replace(/__CANONICAL__/g, siteUrl + '/')
  .replace(/__HREFLANG__/g, hreflangTags)
  .replace('__LANGS_JSON__', JSON.stringify(locales.map(L => L.lang))).replace(/__DEFAULT__/g, def.lang)
  .replace('__FLAG_SPRITE__', () => flagSprite(locales.map(x => x.lang)))
  .replace('__LANG_LIST__', () => locales.map(L => `<li><a href="./${L.lang}/" hreflang="${hl(L.lang)}" lang="${L.lang}">${flag(L.lang)}<span>${esc(L.name)}</span></a></li>`).join(''));
fs.writeFileSync(path.join(OUT, 'index.html'), rootHtml);
fs.writeFileSync(path.join(OUT, '404.html'), nfTpl.replace(/__BASE__/g, basePath));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
const urls = locales.map(L => `  <url><loc>${siteUrl}/${L.lang}/</loc><lastmod>${today}</lastmod>${locales.map(x => `<xhtml:link rel="alternate" hreflang="${hl(x.lang)}" href="${siteUrl}/${x.lang}/"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/"/></url>`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
if (cfg.customDomain) fs.writeFileSync(path.join(OUT, 'CNAME'), cfg.customDomain + '\n');
console.log(`Built ${locales.length} languages → docs/ (${locales.map(L => L.lang).join(', ')})`);
