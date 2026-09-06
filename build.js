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
  const options = locales.map(x => `<option value="${x.lang}"${x.lang === L.lang ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  const links = locales.map(x => `<a href="../${x.lang}/" hreflang="${hl(x.lang)}" lang="${x.lang}"${x.lang === L.lang ? ' aria-current="page"' : ''}>${esc(x.name)}</a>`).join('');
  const html = tpl
    .replace(/__LANG__/g, L.lang).replace(/__DIR__/g, L.dir)
    .replace(/__TITLE__/g, esc(L.title)).replace(/__DESC__/g, esc(L.description))
    .replace(/__CANONICAL__/g, `${siteUrl}/${L.lang}/`).replace(/__OG_LOCALE__/g, OG_LOCALE[L.lang] || L.lang)
    .replace(/__HREFLANG__/g, hreflangTags)
    .replace(/__FONTS_LINK__/g, f.link).replace(/__FONT_HEAD__/g, f.head).replace(/__FONT_BODY__/g, f.body)
    .replace(/__BRAND__/g, esc(L.brand)).replace(/__LANG_LABEL__/g, esc(L.ui.langLabel))
    .replace(/__LANG_OPTIONS__/g, options).replace(/__LANG_LINKS__/g, links)
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
  .replace('__LANG_LIST__', locales.map(L => `<li><a href="./${L.lang}/" hreflang="${hl(L.lang)}" lang="${L.lang}">${esc(L.name)}</a></li>`).join(''));
fs.writeFileSync(path.join(OUT, 'index.html'), rootHtml);
fs.writeFileSync(path.join(OUT, '404.html'), nfTpl.replace(/__BASE__/g, basePath));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
const urls = locales.map(L => `  <url><loc>${siteUrl}/${L.lang}/</loc><lastmod>${today}</lastmod>${locales.map(x => `<xhtml:link rel="alternate" hreflang="${hl(x.lang)}" href="${siteUrl}/${x.lang}/"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/"/></url>`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
if (cfg.customDomain) fs.writeFileSync(path.join(OUT, 'CNAME'), cfg.customDomain + '\n');
console.log(`Built ${locales.length} languages → docs/ (${locales.map(L => L.lang).join(', ')})`);
