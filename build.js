#!/usr/bin/env node
/* Сборка сайта: src/template.html + src/locales/*.json → docs/<lang>/index.html
   Запуск: node build.js */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = __dirname, SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'docs');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
// Служебные теги в <head> (site.config.json): подтверждение сайта в Google Search Console и Яндекс Вебмастере
// (googleSiteVerification, yandexVerification) и аналитика (yandexMetrikaId — номер счётчика Яндекс.Метрики,
// analyticsMode — "optin": счётчик загружается после кнопки «Принять» в уведомлении о cookie, "always": сразу).
// Пустое значение — тег не выводится. Сам код счётчика живёт в src/common.js.
const headExtra = [["google-site-verification", cfg.googleSiteVerification], ["yandex-verification", cfg.yandexVerification]]
  .filter(([, v]) => v).map(([n, v]) => `<meta name="${n}" content="${String(v).replace(/["<>&]/g, "")}">`)
  .concat(cfg.yandexMetrikaId ? [`<script>window.DISC_ANALYTICS=${JSON.stringify({ ym: String(cfg.yandexMetrikaId).replace(/\D/g, ""), mode: cfg.analyticsMode === "always" ? "always" : "optin" })};</script>`] : [])
  .join("\n");
const siteUrl = cfg.siteUrl.replace(/\/+$/, '');
const basePath = new URL(siteUrl + '/').pathname; // например "/disc-test/" или "/"
const tpl = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const introJs = fs.readFileSync(path.join(SRC, 'intro.js'), 'utf8');
const introHTML = require(path.join(SRC, 'intro.js'));
const commonJs = fs.readFileSync(path.join(SRC, 'common.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
// Форма обратной связи: письма уходят на feedbackEmail через Apps Script; пустой адрес — страницы /contact/ и ссылки на неё нет
const contactJs = fs.readFileSync(path.join(SRC, 'contact.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
const contactHTML = require(path.join(SRC, 'contact.js'));
const feedbackEmail = String(cfg.feedbackEmail || '').trim().replace(/['\\<>"]/g, '');
const MAX_CONTACT_BYTES = 10 * 1024 * 1024; // общий размер вложений одного сообщения (проверяется и в браузере, и в Apps Script)
const jsStr = s => JSON.stringify(String(s == null ? '' : s)).replace(/</g, '\\u003c');
const graphJs = fs.readFileSync(path.join(SRC, 'graph.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
const graphSVG = require(path.join(SRC, 'graph.js'));
// Типичный итоговый профиль (net, от −24 до +24, сумма 0) для примера результата на странице каждого профиля
const SAMPLE_NET = {
  D: { D: 16, I: -2, S: -10, C: -4 }, DI: { D: 14, I: 8, S: -12, C: -10 }, DC: { D: 14, I: -8, S: -14, C: 8 }, DS: { D: 12, I: -6, S: 6, C: -12 },
  I: { D: -2, I: 16, S: -4, C: -10 }, ID: { D: 8, I: 14, S: -10, C: -12 }, IS: { D: -10, I: 14, S: 8, C: -12 }, IC: { D: -8, I: 12, S: -10, C: 6 },
  S: { D: -10, I: -2, S: 16, C: -4 }, SI: { D: -12, I: 8, S: 14, C: -10 }, SC: { D: -12, I: -10, S: 14, C: 8 }, SD: { D: 6, I: -8, S: 12, C: -10 },
  C: { D: -8, I: -6, S: -2, C: 16 }, CD: { D: 8, I: -12, S: -10, C: 14 }, CS: { D: -12, I: -10, S: 8, C: 14 }, CI: { D: -8, I: 6, S: -10, C: 12 }
};
const sampleScore = net => { const most = {}, least = {}; const pos = Object.values(net).filter(v => v > 0).reduce((a, b) => a + b, 0), base = (24 - pos) / 4;
  for (const k of Object.keys(net)) { most[k] = Math.max(0, net[k]) + base; least[k] = Math.max(0, -net[k]) + base; } return { most, least, net }; };
const pct = net => Math.round((net + 24) / 48 * 100);
const pageTpl = fs.readFileSync(path.join(SRC, 'page.html'), 'utf8');
const styleBlock = (tpl.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
const NAV_ITEMS = [['nav.test', ''], ['nav.disc', 'disc/'], ['nav.styles', 'styles/'], ['nav.profiles', 'profiles/'], ['nav.results', 'results/'], ['nav.compat', 'compatibility/'], ['nav.faq', 'faq/']];
// Подвал: ссылки на все материалы о DISC (сквозная перелинковка контентных страниц)
const MATERIALS = [['nav.disc', 'disc/'], ['nav.styles', 'styles/'], ['nav.profiles', 'profiles/'], ['nav.results', 'results/'], ['nav.compat', 'compatibility/'], ['nav.colors', 'colors/'], ['nav.teams', 'teams/'], ['nav.mbti', 'disc-vs-mbti/'], ['nav.pdf', 'pdf/'], ['nav.faq', 'faq/']];
const materialsHtml = (L, base, cur) => `<nav class="materials" aria-label="${esc(L.ui['nav.materials'])}"><span class="mlabel">${esc(L.ui['nav.materials'])}</span>` + MATERIALS.map(([k, sub]) => sub === cur ? `<span aria-current="page">${esc(L.ui[k])}</span>` : `<a href="${base + sub}">${esc(L.ui[k])}</a>`).join('') + `</nav>`;
const relRoot = (L, sub) => { const depth = (pathOf(L.lang) + sub).split('/').length - 1; return depth ? '../'.repeat(depth) : './'; };
const PAIRS = ['DD', 'DI', 'DS', 'DC', 'II', 'IS', 'IC', 'SS', 'SC', 'CC'], pairSlug = k => (k[0] + '-' + k[1]).toLowerCase();
const ltr = str => `<span dir="ltr">${str}</span>`; // латиница внутри арабского текста: без изоляции «D · I» читается как «I · D»
const FOOT_ITEMS = [['nav.about', 'about/']].concat(feedbackEmail ? [['nav.contact', 'contact/']] : []).concat([['nav.privacy', 'privacy/']]);
const footLinks = (L, base) => FOOT_ITEMS.map(([k, sub]) => `<a href="${base + sub}">${esc(L.ui[k])}</a>`).join(' · ');
const PROFILE_KEYS = ['D', 'DI', 'DC', 'DS', 'I', 'ID', 'IS', 'IC', 'S', 'SI', 'SC', 'SD', 'C', 'CD', 'CS', 'CI'];
const REPO_URL = 'https://github.com/Man-You-Can/disc-test';
// Источники к странице «Что такое DISC». Библиографические описания одинаковы во всех языках
// (названия работ приводятся на языке оригинала), поэтому живут здесь, а не в локалях;
// переводятся только заголовок раздела, вводка и подпись вида «Исследование» (ключи sources.kind.*).
// Каждая запись сверена с карточкой издателя или научной базы; kind — ключ подписи.
// Список выводится с dir="ltr": описания на латинице, и в арабской версии иначе съезжают знаки препинания.
const SOURCES = [
  { kind: 'primary', text: 'Marston W. M. Emotions of Normal People. — London: Kegan Paul, Trench, Trubner & Co., 1928.', url: 'https://archive.org/details/emotionsofnormal032195mbp' },
  { kind: 'history', text: 'Clarke W. V. The Construction of an Industrial Selection Personality Test // The Journal of Psychology. — 1956. — Vol. 41, № 2. — P. 379–394.', url: 'https://doi.org/10.1080/00223980.1956.9713011' },
  { kind: 'manual', text: 'Scullard M., Baum D. Everything DiSC Manual. — Hoboken: Wiley, 2015. — ISBN 978-1-119-08067-1.', url: 'https://www.wiley.com/en-us/Everything+DiSC+Manual-p-9781119080671' },
  { kind: 'research', text: 'Meade A. W. Psychometric problems and issues involved with creating and using ipsative measures for selection // Journal of Occupational and Organizational Psychology. — 2004. — Vol. 77, № 4. — P. 531–552.', url: 'https://doi.org/10.1348/0963179042596504' },
  { kind: 'research', text: 'Salgado J. F., Anderson N., Táuriz G. The validity of ipsative and quasi-ipsative forced-choice personality inventories for different occupational groups: A comprehensive meta-analysis // Journal of Occupational and Organizational Psychology. — 2015. — Vol. 88, № 4.', url: 'https://doi.org/10.1111/joop.12098' },
  { kind: 'research', text: 'Jones C. S., Hartley N. T. Comparing Correlations Between Four-Quadrant and Five-Factor Personality Assessments // American Journal of Business Education. — 2013. — Vol. 6, № 4. — P. 459–470.', url: 'https://files.eric.ed.gov/fulltext/EJ1054970.pdf' },
  { kind: 'research', text: 'McCrae R. R., John O. P. An Introduction to the Five-Factor Model and Its Applications // Journal of Personality. — 1992. — Vol. 60, № 2. — P. 175–215.', url: 'https://doi.org/10.1111/j.1467-6494.1992.tb00970.x' },
  { kind: 'research', text: 'Barrick M. R., Mount M. K. The Big Five Personality Dimensions and Job Performance: A Meta-Analysis // Personnel Psychology. — 1991. — Vol. 44, № 1. — P. 1–26.', url: 'https://doi.org/10.1111/j.1744-6570.1991.tb00688.x' },
  { kind: 'review', text: 'Pittenger D. J. Cautionary Comments Regarding the Myers-Briggs Type Indicator // Consulting Psychology Journal: Practice and Research. — 2005. — Vol. 57, № 3. — P. 210–221.', url: 'https://doi.org/10.1037/1065-9293.57.3.210' },
  { kind: 'research', text: 'Roberts B. W., Walton K. E., Viechtbauer W. Patterns of Mean-Level Change in Personality Traits Across the Life Course: A Meta-Analysis of Longitudinal Studies // Psychological Bulletin. — 2006. — Vol. 132, № 1. — P. 1–25.', url: 'https://doi.org/10.1037/0033-2909.132.1.1' }
];
const sourcesHtml = (L, t) => `<h2 id="sources">${escFull(L.content.disc.sourcesTitle)}</h2><p>${escFull(L.content.disc.sourcesLead)}</p><ol class="sources" dir="ltr">` +
  SOURCES.map(sc => `<li><span class="kind">${esc(t('sources.kind.' + sc.kind))}</span><a href="${sc.url}" rel="noopener nofollow" hreflang="en">${escFull(sc.text)}</a></li>`).join('') + `</ol>`;
const pages = []; // для sitemap: {lang, sub, files}
const extraUrls = []; // для sitemap: файлы без языковых версий (PDF)
const ASSETS = path.join(SRC, 'assets');
const nfTpl = fs.readFileSync(path.join(SRC, '404.html'), 'utf8');

// Шрифты размещены на самом сайте (src/assets/fonts, скачиваются scripts/fetch-fonts.js): нет запросов к Google,
// что важно для GDPR (Германия) и для надёжности там, где Google Fonts блокируется или тормозит.
// Для китайского и японского используются системные шрифты: файлы CJK слишком велики.
const FONT_CSS = fs.existsSync(path.join(ASSETS, 'fonts', 'fonts.css')) ? fs.readFileSync(path.join(ASSETS, 'fonts', 'fonts.css'), 'utf8') : '';
if (!FONT_CSS) console.warn('WARNING: src/assets/fonts/fonts.css not found (run node scripts/fetch-fonts.js)');
const LATIN_STACK = "'Golos Text',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
const FONTS = {
  default: { families: ['Unbounded', 'Golos Text', 'IBM Plex Mono'], head: "'Unbounded',sans-serif", body: LATIN_STACK,
    preload: sub => [`golos-text-400-${sub}.woff2`, `unbounded-500-${sub}.woff2`] },
  ar: { families: ['Unbounded', 'Golos Text', 'IBM Plex Mono', 'Noto Kufi Arabic', 'IBM Plex Sans Arabic'],
    head: "'Unbounded','Noto Kufi Arabic',sans-serif", body: "'IBM Plex Sans Arabic','Golos Text',system-ui,'Segoe UI',Tahoma,sans-serif",
    preload: () => ['ibm-plex-sans-arabic-400-arabic.woff2', 'noto-kufi-arabic-500-arabic.woff2'] },
  hi: { families: ['Unbounded', 'Golos Text', 'IBM Plex Mono', 'Noto Sans Devanagari'],
    head: "'Unbounded','Noto Sans Devanagari',sans-serif", body: "'Golos Text','Noto Sans Devanagari',system-ui,sans-serif",
    preload: () => ['noto-sans-devanagari-400-devanagari.woff2', 'noto-sans-devanagari-500-devanagari.woff2'] },
  zh: { families: [],
    head: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC',system-ui,sans-serif",
    body: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC',system-ui,sans-serif" },
  ja: { families: [],
    head: "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,'Noto Sans CJK JP',system-ui,sans-serif",
    body: "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,'Noto Sans CJK JP',system-ui,sans-serif" }
};
// @font-face только для семейств языка + preload двух основных файлов; пусто для языков на системных шрифтах
const fontsHead = (f, L) => {
  if (!f.families || !f.families.length || !FONT_CSS) return '';
  const sub = L.lang === 'ru' ? 'cyrillic' : 'latin';
  const faces = FONT_CSS.split('\n').filter(l => l.startsWith('@font-face') && f.families.some(fam => l.includes(`font-family:'${fam}'`))).join('\n').replace(/__FONTS__/g, basePath + 'fonts/');
  const pre = (f.preload ? f.preload(sub) : []).filter(n => fs.existsSync(path.join(ASSETS, 'fonts', n))).map(n => `<link rel="preload" href="${basePath}fonts/${n}" as="font" type="font/woff2" crossorigin>`).join('\n');
  return pre + '\n<style>' + faces + '</style>';
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
const ONLY = process.env.LANGS ? process.env.LANGS.split(',') : null; // локальная проверка одной локали: LANGS=ru node build.js
const locales = cfg.languages.filter(code => !missing.includes(code) && (!ONLY || ONLY.includes(code))).map(code => {
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
const today = new Date().toISOString().slice(0, 10);
const fmtDate = (iso, L) => { try { return new Intl.DateTimeFormat(L.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso + 'T12:00:00Z')); } catch (e) { return iso; } };
// Файлы с незакоммиченными правками считаем изменёнными сегодня: иначе в sitemap попала бы дата прошлого коммита
const dirty = (() => { try { return new Set(execSync('git status --porcelain -z', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\0').filter(Boolean).map(l => l.slice(3))); } catch (e) { return new Set(); } })();
const lastmod = files => { if (files.some(f => dirty.has(f))) return today;
  try { return execSync('git log -1 --format=%cs -- ' + files.map(f => JSON.stringify(f)).join(' '), { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; } catch (e) { return null; } };
// Организация-издатель: одна карточка на весь сайт, со ссылкой на открытый код и адресом для связи
const orgLd = () => ({ '@context': 'https://schema.org', '@type': 'Organization', name: 'DISC Test', url: siteUrl + '/', logo: `${siteUrl}/icon-512.png`,
  sameAs: [REPO_URL], email: feedbackEmail || undefined });
const jsonLd = L => JSON.stringify([
  { '@context': 'https://schema.org', '@type': 'WebSite', name: 'DISC Test', alternateName: L.brand, url: siteUrl + '/', inLanguage: L.lang },
  orgLd(),
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
  const navHtml = NAV_ITEMS.map(([k, sub]) => `<a href="${rootRel + pathOf(L.lang) + sub}"${sub === '' ? ' aria-current="page"' : ''}>${esc(L.ui[k])}</a>`).join('');
  const footHtml = footLinks(L, rootRel + pathOf(L.lang));
  pages.push({ lang: L.lang, sub: '', files: [`src/locales/${L.lang}.json`, 'src/template.html', 'src/intro.js'] });
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
    .replace('__COMMON_JS__', () => commonJs).replace('__GRAPH_JS__', () => graphJs)
    .replace('__NAV__', () => navHtml).replace('__FOOT_LINKS__', () => footHtml).replace('__MATERIALS__', () => materialsHtml(L, rootRel + pathOf(L.lang), null))
    .replace('__INTRO_HTML__', () => introHTML({ L, t: tFor(L), esc: escFull, KEYS, colorVar: k => 'var(--' + k.toLowerCase() + ')', who: {}, progDone: 0, lastDate: '',
      links: { styles: rootRel + pathOf(L.lang) + 'styles/', profiles: rootRel + pathOf(L.lang) + 'profiles/', pdf: rootRel + pathOf(L.lang) + 'pdf/', profile: k => rootRel + pathOf(L.lang) + 'profiles/' + k.toLowerCase() + '/' } }))
    .replace(/__HREFLANG__/g, hreflangTags).replace(/__HEAD_EXTRA__/g, () => headExtra)
    .replace(/__FONTS_HEAD__/g, () => fontsHead(f, L)).replace(/__FONT_HEAD__/g, f.head).replace(/__FONT_BODY__/g, f.body)
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
// ---------- Контентные страницы: четыре стиля, каталог и 16 профилей ----------
const colorVar = k => 'var(--' + k.toLowerCase() + ')';
const badge = (key, cls) => `<span class="${cls || 'badge'}" style="--kp:${colorVar(key[0])};--ks:${key[1] ? colorVar(key[1]) : 'inherit'}"><span class="p">${key[0]}</span>${key[1] ? `<span class="s">${key[1]}</span>` : ''}</span>`;
const ul = arr => '<ul>' + arr.map(x => `<li>${escFull(x)}</li>`).join('') + '</ul>';
const truncate = (str, n) => str.length <= n ? str : str.slice(0, n).replace(/\s+\S*$/, '') + '…';
const styleSections = (L, k, t, full) => {
  const st = L.styles[k];
  return `<div class="sections">` +
    `<div class="sec"><h3>${t('report.strengths')}</h3>${ul(st.strengths)}</div>` +
    `<div class="sec"><h3>${t('report.growth')}</h3>${ul(st.growth)}</div>` +
    (full ? `<div class="sec"><h3>${t('report.motivation')}</h3>${ul(st.motivation)}</div>` +
      `<div class="sec"><h3>${t('report.communication')}</h3>${ul(st.communication)}</div>` +
      `<div class="sec"><h3>${t('report.stress')}</h3><p>${escFull(st.stress)}</p></div>` +
      `<div class="sec"><h3>${t('report.environment')}</h3><p>${escFull(st.environment)}</p></div>` : '') +
    `</div>`;
};
const ctaBlock = (L, t, homeHref) => `<aside class="cta"><div><h2>${t('cta.title')}</h2><p>${escFull(t('cta.text'))}</p></div><a class="btn" href="${homeHref}">${t('cta.button')}</a></aside>`;
const profileCard = (L, key, base) => { const pr = L.profiles[key]; const names = key.split('').map(k => L.keys[k]).join(' + ');
  return `<a class="pcard" href="${base}profiles/${key.toLowerCase()}/">${badge(key)}<span><strong>${escFull(pr.name)}</strong><small>${key} · ${escFull(names)}</small><p>${escFull(truncate(pr.summary, 110))}</p></span></a>`; };

function writeContentPage(L, sub, opts) {
  const t = tFor(L), f = FONTS[L.lang] || FONTS.default;
  const depth = (pathOf(L.lang) + sub).split('/').length - 1, rootRel = depth ? '../'.repeat(depth) : './';
  const base = rootRel + pathOf(L.lang), homeHref = base || './';
  const switcher = `<div class="langsel" id="langSel">` +
    `<button type="button" class="langbtn" id="langBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(L.ui.langLabel)}">${flag(L.lang)}<span class="langname">${esc(L.name)}</span><svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` +
    `<ul class="langmenu" id="langMenu" role="listbox" aria-label="${esc(L.ui.langLabel)}" hidden>` +
    locales.map(x => `<li role="none"><a role="option" href="${rootRel + pathOf(x.lang) + sub}" hreflang="${hl(x.lang)}" lang="${x.lang}" data-lang="${x.lang}" aria-selected="${x.lang === L.lang}" tabindex="-1">${flag(x.lang)}<span>${esc(x.name)}</span></a></li>`).join('') + `</ul></div>`;
  const links = locales.map(x => `<a href="${rootRel + pathOf(x.lang) + sub}" hreflang="${hl(x.lang)}" lang="${x.lang}" data-lang="${x.lang}"${x.lang === L.lang ? ' aria-current="page"' : ''}>${flag(x.lang)}<span>${esc(x.name)}</span></a>`).join('');
  const navHtml = NAV_ITEMS.map(([k, s2]) => `<a href="${base + s2}"${opts.navKey === k ? ' aria-current="page"' : ''}>${esc(L.ui[k])}</a>`).join('');
  const footHtml = footLinks(L, base);
  const pageFiles = [`src/locales/${L.lang}.json`, 'src/page.html', 'build.js'].concat(opts.files || []);
  const updated = lastmod(pageFiles) || today;
  const updatedHtml = opts.noDate ? '' : `<p class="updated"><time datetime="${updated}">${esc(t('pages.updated', { date: fmtDate(updated, L) }))}</time></p>`;
  const crumbs = [{ name: L.ui['nav.home'], href: homeHref }].concat(opts.crumbs || []);
  const crumbsHtml = crumbs.map((c, i) => i === crumbs.length - 1 ? `<span aria-current="page">${esc(c.name)}</span>` : `<a href="${c.href}">${esc(c.name)}</a><span>›</span>`).join('');
  const hreflang = locales.flatMap(x => hls(x.lang).map(h => `<link rel="alternate" hreflang="${h}" href="${urlOf(x.lang) + sub}">`)).concat([`<link rel="alternate" hreflang="x-default" href="${siteUrl}/${sub}">`]).join('\n');
  const ld = JSON.stringify([
    { '@context': 'https://schema.org', '@type': opts.ldType || (opts.article ? 'Article' : 'WebPage'), headline: opts.article ? opts.title : undefined, name: opts.title, description: opts.description, url: urlOf(L.lang) + sub, inLanguage: L.lang,
      dateModified: opts.article ? (lastmod([`src/locales/${L.lang}.json`]) || today) : undefined, author: opts.article ? { '@type': 'Organization', name: 'DISC Test', url: siteUrl + '/' } : undefined,
      image: opts.article ? `${siteUrl}/og/${L.lang}.png` : undefined, publisher: opts.article ? { '@type': 'Organization', name: 'DISC Test', url: siteUrl + '/', logo: `${siteUrl}/icon-512.png` } : undefined,
      isPartOf: { '@type': 'WebSite', name: 'DISC Test', url: siteUrl + '/' } },
    ...(opts.article ? [orgLd()] : []),
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: i === 0 ? urlOf(L.lang) : urlOf(L.lang) + (c.sub || sub) })) }
  ].concat(opts.ldExtra || [])).replace(/</g, '\\u003c');
  const miniL = { lang: L.lang, name: L.name, dir: L.dir, dateLocale: L.dateLocale, ui: Object.fromEntries(Object.entries(L.ui).filter(([k]) => k === 'langLabel' || k === 'root.continue' || k.startsWith('consent.') || (opts.uiKeys && opts.uiKeys.test(k)))) };
  const html = pageTpl
    .replace(/__LANG__/g, L.lang).replace(/__DIR__/g, L.dir)
    .replace(/__TITLE__/g, esc(opts.title)).replace(/__DESC__/g, esc(opts.description))
    .replace(/__CANONICAL__/g, urlOf(L.lang) + sub).replace(/__OG_LOCALE__/g, OG_LOCALE[L.lang] || L.lang)
    .replace(/__OG_ALTERNATES__/g, () => locales.filter(x => x !== L).map(x => `<meta property="og:locale:alternate" content="${OG_LOCALE[x.lang] || x.lang}">`).join('\n'))
    .replace(/__OG_IMAGE__/g, `${siteUrl}/og/${L.lang}.png`).replace(/__HREFLANG__/g, hreflang).replace(/__HEAD_EXTRA__/g, () => headExtra)
    .replace(/__ROOT_REL__/g, rootRel).replace('__JSON_LD__', () => ld)
    .replace(/__FONTS_HEAD__/g, () => fontsHead(f, L)).replace('__STYLE__', () => styleBlock.replace(/__FONT_HEAD__/g, f.head).replace(/__FONT_BODY__/g, f.body))
    .replace('__FLAG_SPRITE__', () => flagSprite(locales.map(x => x.lang)))
    .replace(/__BRAND__/g, esc(L.brand)).replace(/__HOME_HREF__/g, homeHref).replace(/__LANG_LABEL__/g, esc(L.ui.langLabel))
    .replace('__LANG_SWITCHER__', () => switcher).replace('__NAV__', () => navHtml).replace('__CRUMBS__', () => crumbsHtml).replace('__FOOT_LINKS__', () => footHtml).replace('__MATERIALS__', () => materialsHtml(L, base, sub))
    .replace('__CONTENT__', () => opts.content + updatedHtml)
    .replace(/__FOOTER__/g, esc(L.ui.footer)).replace(/__PRIVACY__/g, esc(L.ui.privacy)).replace('__LANG_LINKS__', () => links)
    .replace('__LOCALE_JSON__', () => JSON.stringify(miniL).replace(/</g, '\\u003c'))
    .replace(/__SUBPATH__/g, sub)
    .replace('__LANG_PATH_JSON__', () => JSON.stringify(LANG_PATH)).replace('__LANG_META_JSON__', () => JSON.stringify(LANG_META).replace(/</g, '\\u003c'))
    .replace('__COMMON_JS__', () => commonJs).replace('__PAGE_JS__', () => opts.pageJs || '');
  fs.mkdirSync(path.join(OUT, pathOf(L.lang), sub), { recursive: true });
  fs.writeFileSync(path.join(OUT, pathOf(L.lang), sub, 'index.html'), html);
  pages.push({ lang: L.lang, sub, files: pageFiles });
}

for (const L of locales) {
  const t = tFor(L), base0 = pathOf(L.lang);
  // /styles/
  const stylesContent = `<div class="eyebrow">DISC</div><h1>${t('pages.styles.h1')}</h1><p class="lead">${escFull(t('pages.styles.lead'))}</p>` +
    `<p class="seealso"><a href="../colors/">${esc(L.ui['nav.colors'])} →</a> · <a href="../compatibility/">${esc(L.ui['nav.compat'])} →</a> · <a href="../results/">${esc(L.ui['nav.results'])} →</a></p>` +
    KEYS.map(k => { const st = L.styles[k], pr = L.profiles[k], b = '../';
      return `<section class="stylefull" id="${k.toLowerCase()}" style="--k:${colorVar(k)}"><h2><span class="k">${k}</span>${escFull(L.keys[k])} · ${escFull(pr.name)}</h2><p class="muted">${escFull(L.short[k])}</p><p>${escFull(pr.summary)}</p>` +
        `<div class="traits">${st.traits.map(x => `<span>${escFull(x)}</span>`).join('')}</div>` + styleSections(L, k, t, true) +
        `<a class="more" href="${b}profiles/${k.toLowerCase()}/">${t('pages.profile.more', { name: escFull(pr.name) })}</a></section>`; }).join('') +
    ctaBlock(L, t, '../') + `<h2>${t('pages.profiles.h1')}</h2><div class="pgrid">${PROFILE_KEYS.map(k => profileCard(L, k, '../')).join('')}</div>`;
  writeContentPage(L, 'styles/', { navKey: 'nav.styles', title: t('pages.styles.title'), description: t('pages.styles.description'), crumbs: [{ name: t('nav.styles') }], content: stylesContent });
  // /profiles/
  const profilesContent = `<div class="eyebrow">DISC</div><h1>${t('pages.profiles.h1')}</h1><p class="lead">${escFull(t('pages.profiles.lead'))}</p>` +
    `<div class="pgrid">${PROFILE_KEYS.map(k => profileCard(L, k, '../')).join('')}</div>` + ctaBlock(L, t, '../');
  writeContentPage(L, 'profiles/', { navKey: 'nav.profiles', title: t('pages.profiles.title'), description: t('pages.profiles.description'), crumbs: [{ name: t('nav.profiles') }], content: profilesContent });
  // /profiles/<key>/
  for (const key of PROFILE_KEYS) {
    const pr = L.profiles[key], p = key[0], s2 = key[1] || null, b = '../../';
    const content = `<div class="eyebrow">${t('pages.profile.eyebrow', { key })}</div>` +
      `<div class="rhead">${badge(key)}<div class="rtitle"><h1>${escFull(pr.name)}</h1><div class="meta">${escFull(s2 ? L.keys[p] + ' + ' + L.keys[s2] : L.keys[p])}</div></div></div>` +
      `<p class="lead">${escFull(pr.summary)}</p>` +
      (() => { const sc = sampleScore(SAMPLE_NET[key]);
        return `<section class="example"><h2>${t('pages.profile.exampleTitle')}</h2><p>${escFull(t('pages.profile.exampleText', { name: pr.name }))}</p>` +
          `<div class="card graphcard"><div class="graph"><h3>${t('report.graphTitle')}</h3>${graphSVG(sc, { net: true }, { label: t('report.graphAria'), colorVar, keys: KEYS })}</div>` +
          `<div><h3>${t('report.statsTitle')}</h3><div class="stats">` + KEYS.map(k => `<div class="stat" style="--k:${colorVar(k)}"><span class="k">${k}</span><span class="nm">${escFull(L.keys[k])}</span><span class="v">${pct(sc.net[k])}%</span><div class="bar"><i style="width:${pct(sc.net[k])}%"></i></div></div>`).join('') + `</div></div></div></section>`; })() +
      `<h2>${t('pages.profile.primary', { name: escFull(L.keys[p]), key: p })}</h2><div class="traits">${L.styles[p].traits.map(x => `<span>${escFull(x)}</span>`).join('')}</div>` + styleSections(L, p, t, true) +
      (s2 ? `<h2>${t('pages.profile.secondary', { name: escFull(L.keys[s2]), key: s2 })}</h2><p>${escFull(t('report.secondaryAddon', { addon: L.addon[s2] }))}</p><div class="traits">${L.styles[s2].traits.map(x => `<span>${escFull(x)}</span>`).join('')}</div>` + styleSections(L, s2, t, false) : '') +
      `<h2>${t('pages.profile.careers')}</h2>${ul(pr.careers)}` +
      `<h2>${t('pages.profile.team')}</h2><p>${escFull(pr.team)}</p>` +
      `<h2>${t('pages.profile.with')}</h2><div class="sections">` + KEYS.map(k => `<div class="sec kcol" style="--k:${colorVar(k)}"><h3>${escFull(t('pages.profile.withKey', { name: L.keys[k], key: k }))}</h3><p>${escFull(pr.with[k])}</p></div>`).join('') + `</div>` +
      `<p class="seealso"><a href="${b}compatibility/">${escFull(t('pages.profile.compatLink'))}</a></p>` +
      ctaBlock(L, t, b) +
      `<h2>${t('pages.profile.others')}</h2><div class="pgrid">${PROFILE_KEYS.filter(k => k !== key).map(k => profileCard(L, k, b)).join('')}</div>`;
    writeContentPage(L, `profiles/${key.toLowerCase()}/`, { navKey: 'nav.profiles', title: t('pages.profile.title', { name: pr.name, key }),
      description: truncate(t('pages.profile.description', { name: pr.name, key, summary: pr.summary }), 155),
      crumbs: [{ name: t('nav.profiles'), href: '../', sub: 'profiles/' }, { name: pr.name }], content });
  }
}

// ---------- Текстовые страницы: что такое DISC, FAQ, о проекте, конфиденциальность ----------
// Секция текстовой страницы: {h, p:[абзацы], ul|ol:[пункты], after:[абзацы после списка]}
const listHtml = (tag, arr) => `<${tag}>` + arr.map(x => `<li>${escFull(x)}</li>`).join('') + `</${tag}>`;
const sectionsHtml = secs => secs.map(sec => `<h2>${escFull(sec.h)}</h2>` + (sec.p || []).map(par => `<p>${escFull(par)}</p>`).join('') + (sec.ul ? listHtml('ul', sec.ul) : '') + (sec.ol ? listHtml('ol', sec.ol) : '') + (sec.after || []).map(par => `<p>${escFull(par)}</p>`).join('')).join('');
const tableHtml = tb => `<div class="tablewrap"><table class="cmp"><thead><tr>${tb.head.map(h => `<th>${escFull(h)}</th>`).join('')}</tr></thead><tbody>${tb.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${escFull(c)}</td>` : `<th scope="row">${escFull(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
const pdfInfo = code => { const f = path.join(ASSETS, 'pdf', `disc-test-${code}.pdf`); if (!fs.existsSync(f)) return null; const buf = fs.readFileSync(f), s = buf.toString('latin1');
  const m = s.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/); return { file: `disc-test-${code}.pdf`, size: buf.length, pages: m ? +m[1] : (s.match(/\/Type\s*\/Page(?!s)/g) || []).length }; };
for (const L of locales) {
  const t = tFor(L), C = L.content;
  const seeAlso = (base, cur) => `<p class="seealso">${MATERIALS.filter(([k]) => k !== cur).map(([k, sub]) => `<a href="${base + sub}">${esc(L.ui[k])} →</a>`).join(' · ')}</p>`;
  const d = C.disc;
  writeContentPage(L, 'disc/', { navKey: 'nav.disc', article: true, title: d.title, description: d.description, crumbs: [{ name: t('nav.disc') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(d.h1)}</h1><p class="lead">${escFull(d.lead)}</p>` + sectionsHtml(d.sections) + sourcesHtml(L, t) + ctaBlock(L, t, '../') + seeAlso('../', 'nav.disc'),
    ldExtra: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: d.sourcesTitle, itemListElement: SOURCES.map((sc, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'CreativeWork', name: sc.text, url: sc.url } })) }] });
  const f = C.faq;
  writeContentPage(L, 'faq/', { navKey: 'nav.faq', title: f.title, description: f.description, crumbs: [{ name: t('nav.faq') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(f.h1)}</h1><p class="lead">${escFull(f.lead)}</p>` + f.items.map(it => `<h2>${escFull(it.q)}</h2><p>${escFull(it.a).replace('{pdf}', `<a href="../pdf/">${escFull(t('nav.pdf'))}</a>`)}</p>`).join('') + ctaBlock(L, t, '../') + seeAlso('../', 'nav.faq'),
    ldExtra: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: f.items.map(it => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a.replace('{pdf}', t('nav.pdf')) } })) }] });
  const a = C.about;
  writeContentPage(L, 'about/', { navKey: 'nav.about', title: a.title, description: a.description, crumbs: [{ name: t('nav.about') }],
    content: (`<div class="eyebrow">DISC</div><h1>${escFull(a.h1)}</h1>` +
      sectionsHtml(a.sections.slice(0, 2)) + sectionsHtml(C.editorial.sections) + sectionsHtml(a.sections.slice(2)))
      .replace('github.com/Man-You-Can/disc-test', `<a href="${REPO_URL}" rel="noopener">github.com/Man-You-Can/disc-test</a>`)
      .replace('{contact}', feedbackEmail ? `<a href="../contact/">${escFull(t('nav.contact'))}</a>` : escFull(t('nav.contact')))
      .replace('{sources}', `<a href="../disc/#sources">${escFull(L.content.disc.sourcesTitle)}</a>`) + ctaBlock(L, t, '../') });
  const pv = C.privacy;
  writeContentPage(L, 'privacy/', { navKey: 'nav.privacy', title: pv.title, description: pv.description, crumbs: [{ name: t('nav.privacy') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(pv.h1)}</h1>` + sectionsHtml(pv.sections).replace(/\{email\}/g, feedbackEmail ? `<a href="mailto:${escFull(feedbackEmail)}">${escFull(feedbackEmail)}</a>` : '—') });
  // /results/ — расшифровка результатов: текст + три примера графика (DI, SC, сбалансированный)
  const rs = C.results, exNet = { D: 4, I: 2, S: -2, C: -4 };
  const exampleHtml = ex => { const key = ex.key, sc = sampleScore(key === 'flat' ? exNet : SAMPLE_NET[key]);
    const title = key === 'flat' ? t('pages.results.flatTitle') : `${L.profiles[key].name} (${key})`;
    return `<div class="example card"><h3>${escFull(title)}</h3><div class="graph">${graphSVG(sc, { net: true }, { label: t('report.graphAria'), colorVar, keys: KEYS })}</div><div class="stats">` +
      KEYS.map(k => `<div class="stat" style="--k:${colorVar(k)}"><span class="k">${k}</span><span class="nm">${escFull(L.keys[k])}</span><span class="v">${pct(sc.net[k])}%</span><div class="bar"><i style="width:${pct(sc.net[k])}%"></i></div></div>`).join('') +
      `</div><p>${escFull(ex.text)}</p>` + (key !== 'flat' ? `<a class="more" href="../profiles/${key.toLowerCase()}/">${t('pages.profile.more', { name: escFull(L.profiles[key].name) })}</a>` : '') + `</div>`; };
  writeContentPage(L, 'results/', { navKey: 'nav.results', article: true, title: rs.title, description: rs.description, crumbs: [{ name: t('nav.results') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(rs.h1)}</h1><p class="lead">${escFull(rs.lead)}</p>` + sectionsHtml(rs.sections.slice(0, 3)) +
      `<div class="examples">${rs.examples.map(exampleHtml).join('')}</div>` + sectionsHtml(rs.sections.slice(3)) + ctaBlock(L, t, '../') + seeAlso('../', 'nav.results') });
  // /colors/ — DISC по цветам: четыре цветные карточки + текст
  const co = C.colors;
  writeContentPage(L, 'colors/', { navKey: 'nav.colors', article: true, title: co.title, description: co.description, crumbs: [{ name: t('nav.colors') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(co.h1)}</h1><p class="lead">${escFull(co.lead)}</p><div class="colorgrid">` +
      KEYS.map(k => { const c = co.colors[k]; return `<section class="colorcard" id="${k.toLowerCase()}" style="--k:${colorVar(k)}"><div class="swatch">${k}</div><h2>${escFull(c.name)}</h2><p class="muted">${escFull(c.tagline)}</p><p>${escFull(c.text)}</p><div class="traits">${L.styles[k].traits.map(x => `<span>${escFull(x)}</span>`).join('')}</div><a class="more" href="../profiles/${k.toLowerCase()}/">${t('pages.profile.more', { name: escFull(L.profiles[k].name) })}</a></section>`; }).join('') +
      `</div>` + sectionsHtml(co.sections) + ctaBlock(L, t, '../') + seeAlso('../', 'nav.colors') });
  // /compatibility/ — матрица пар и 10 страниц пар стилей
  const cp = C.compatibility;
  const pairNames = k => k[0] === k[1] ? { a: k[0], b: k[1] } : { a: L.keys[k[0]], b: L.keys[k[1]] };
  const pairCard = (k, base) => { const nm = pairNames(k);
    return `<a class="pcard" href="${base}${pairSlug(k)}/">${badge(k)}<span><strong>${escFull(nm.a)} + ${escFull(nm.b)}</strong><small>${k[0] === k[1] ? escFull(L.keys[k[0]]) : ltr(k[0] + ' · ' + k[1])}</small><p>${escFull(truncate(cp.pairs[k].summary, 110))}</p></span></a>`; };
  const matrix = `<h2>${t('pages.compat.matrix')}</h2><div class="tablewrap plain"><table class="matrix"><thead><tr><th></th>${KEYS.map(k => `<th style="color:${colorVar(k)}">${k}</th>`).join('')}</tr></thead><tbody>` +
    KEYS.map(a => `<tr><th style="color:${colorVar(a)}">${a}</th>` + KEYS.map(b => { const k = KEYS.indexOf(a) <= KEYS.indexOf(b) ? a + b : b + a;
      return `<td><a href="./${pairSlug(k)}/" style="--kp:${colorVar(k[0])};--ks:${colorVar(k[1])}" aria-label="${escFull(t('pages.compat.pairLink', { a: L.keys[k[0]], b: L.keys[k[1]] }))}"><b>${k[0]}</b><i>${k[1]}</i></a></td>`; }).join('') + `</tr>`).join('') + `</tbody></table></div>`;
  writeContentPage(L, 'compatibility/', { navKey: 'nav.compat', article: true, title: cp.title, description: cp.description, crumbs: [{ name: t('nav.compat') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(cp.h1)}</h1><p class="lead">${escFull(cp.lead)}</p>` + matrix + `<div class="pgrid">${PAIRS.map(k => pairCard(k, './')).join('')}</div>` +
      sectionsHtml(cp.sections) + ctaBlock(L, t, '../') + seeAlso('../', 'nav.compat') });
  for (const k of PAIRS) {
    const a = k[0], b2 = k[1], pr = cp.pairs[k], names = pairNames(k), base = '../../';
    const content = `<div class="eyebrow">${t('nav.compat')} · ${ltr(a + ' + ' + b2)}</div>` +
      `<div class="rhead">${badge(k)}<div class="rtitle"><h1>${escFull(t('pages.compat.h1', names))}</h1><div class="meta">${ltr(a + ' · ' + b2)}</div></div></div>` +
      `<p class="lead">${escFull(pr.summary)}</p><p>${escFull(pr.text)}</p>` +
      `<div class="sections"><div class="sec"><h3>${t('pages.compat.common')}</h3>${ul(pr.common)}</div><div class="sec"><h3>${t('pages.compat.friction')}</h3>${ul(pr.friction)}</div>` +
      Object.keys(pr.tips).map(s => `<div class="sec kcol" style="--k:${colorVar(s)}"><h3>${escFull(t('pages.compat.tips', { name: L.keys[s], key: s }))}</h3>${ul(pr.tips[s])}</div>`).join('') + `</div>` +
      `<p class="seealso">${[...new Set([a, b2])].map(s => `<a href="${base}profiles/${s.toLowerCase()}/">${t('pages.profile.more', { name: escFull(L.profiles[s].name) })}</a>`).join(' · ')}</p>` +
      ctaBlock(L, t, base) + `<h2>${t('pages.compat.other')}</h2><div class="pgrid">${PAIRS.filter(x => x !== k).map(x => pairCard(x, '../')).join('')}</div>`;
    writeContentPage(L, `compatibility/${pairSlug(k)}/`, { navKey: 'nav.compat', article: true, title: t('pages.compat.title', names), description: truncate(t('pages.compat.description', names), 155),
      crumbs: [{ name: t('nav.compat'), href: '../', sub: 'compatibility/' }, { name: a + b2 }], content });
  }
  // /teams/ — DISC для команды и HR
  const tm = C.teams;
  writeContentPage(L, 'teams/', { navKey: 'nav.teams', article: true, title: tm.title, description: tm.description, crumbs: [{ name: t('nav.teams') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(tm.h1)}</h1><p class="lead">${escFull(tm.lead)}</p>` + sectionsHtml(tm.sections) + ctaBlock(L, t, '../') + seeAlso('../', 'nav.teams') });
  // /disc-vs-mbti/ — сравнение моделей: таблица после второй секции
  const mb = C.mbti;
  writeContentPage(L, 'disc-vs-mbti/', { navKey: 'nav.mbti', article: true, title: mb.title, description: mb.description, crumbs: [{ name: t('nav.mbti') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(mb.h1)}</h1><p class="lead">${escFull(mb.lead)}</p>` + sectionsHtml(mb.sections.slice(0, 2)) + tableHtml(mb.table) + sectionsHtml(mb.sections.slice(2)) +
      `<p class="seealso"><a href="../disc/#sources">${esc(t('pages.sourcesLink'))} →</a></p>` + ctaBlock(L, t, '../') + seeAlso('../', 'nav.mbti') });
  // /pdf/ — печатная версия: кнопка скачивания файла из src/assets/pdf (готовится node scripts/make-pdf.js)
  const pd = C.pdf, pi = pdfInfo(L.lang), pdfRoot = relRoot(L, 'pdf/');
  const download = pi ? `<p class="download"><a class="btn" href="${pdfRoot}pdf/${pi.file}" download>${t('pages.pdf.download')}</a><span class="muted">${escFull(t('pages.pdf.meta', { pages: pi.pages, size: fmtSize(pi.size) }))}</span></p>` : `<p class="notice">${escFull(t('pages.pdf.missing'))}</p>`;
  if (!pi) console.warn('WARNING: no PDF for ' + L.lang + ' (run node scripts/make-pdf.js)');
  writeContentPage(L, 'pdf/', { navKey: 'nav.pdf', title: pd.title, description: pd.description, crumbs: [{ name: t('nav.pdf') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(pd.h1)}</h1><p class="lead">${escFull(pd.lead)}</p>` + download + sectionsHtml(pd.sections) + download + ctaBlock(L, t, '../') + seeAlso('../', 'nav.pdf'),
    ldExtra: pi ? [{ '@context': 'https://schema.org', '@type': 'DigitalDocument', name: pd.title, url: `${siteUrl}/pdf/${pi.file}`, encodingFormat: 'application/pdf', inLanguage: L.lang, isAccessibleForFree: true }] : [] });
  if (pi) extraUrls.push({ loc: `${siteUrl}/pdf/${pi.file}`, files: [`src/assets/pdf/${pi.file}`] });
  // /contact/ — форма обратной связи (только при заданном feedbackEmail); разметка из src/contact.js, там же логика страницы
  if (feedbackEmail) {
    const ct = C.contact, maxLabel = '10 ' + (L.ui['contact.mb'] || 'MB');
    writeContentPage(L, 'contact/', { navKey: 'nav.contact', ldType: 'ContactPage', title: ct.title, description: ct.description, crumbs: [{ name: t('nav.contact') }],
      content: contactHTML({ t, esc: escFull, email: feedbackEmail, maxLabel, h1: ct.h1, lead: ct.lead }),
      uiKeys: /^(contact\.|intro\.(nameRequired|emailRequired)$)/, files: ['src/contact.js'],
      pageJs: contactJs + `initContact({L:L, t:t, esc:esc, $:$, endpoint:${jsStr(cfg.sendEndpoint)}, token:${jsStr(cfg.sendToken)}, email:${jsStr(feedbackEmail)}, maxBytes:${MAX_CONTACT_BYTES}});` });
  }
}

// /en/ (язык по умолчанию) перенаправляет в корень: адрес существовал раньше и мог быть сохранён
fs.mkdirSync(path.join(OUT, def.lang), { recursive: true });
fs.writeFileSync(path.join(OUT, def.lang, 'index.html'), `<!doctype html><html lang="${def.lang}"><head><meta charset="utf-8"><title>${esc(def.brand)}</title><meta http-equiv="refresh" content="0; url=../"><link rel="canonical" href="${siteUrl}/"><script>location.replace('../'+location.hash)</script></head><body><a href="../">${esc(def.brand)}</a></body></html>\n`);

fs.writeFileSync(path.join(OUT, '404.html'), nfTpl.replace(/__BASE__/g, basePath));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
const alt = locales.flatMap(x => hls(x.lang).map(h => `<xhtml:link rel="alternate" hreflang="${h}" href="${urlOf(x.lang)}"/>`)).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/"/>`;
const altFor = sub => locales.flatMap(x => hls(x.lang).map(h => `<xhtml:link rel="alternate" hreflang="${h}" href="${urlOf(x.lang) + sub}"/>`)).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/${sub}"/>`;
const urls = pages.map(pg => `  <url><loc>${urlOf(pg.lang) + pg.sub}</loc><lastmod>${lastmod(pg.files) || today}</lastmod>${altFor(pg.sub)}</url>`)
  .concat(extraUrls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${lastmod(u.files) || today}</lastmod></url>`));
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
if (cfg.customDomain) fs.writeFileSync(path.join(OUT, 'CNAME'), cfg.customDomain + '\n');

// Иконки, og-картинки, манифест (файлы готовятся заранее командой node scripts/make-assets.js)
for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  const src = path.join(ASSETS, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f)); else console.warn('WARNING: missing asset ' + f + ' (run node scripts/make-assets.js)');
}
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
for (const f of fs.existsSync(path.join(ASSETS, 'fonts')) ? fs.readdirSync(path.join(ASSETS, 'fonts')) : []) if (f.endsWith('.woff2')) fs.copyFileSync(path.join(ASSETS, 'fonts', f), path.join(OUT, 'fonts', f));
fs.mkdirSync(path.join(OUT, 'pdf'), { recursive: true });
for (const f of fs.existsSync(path.join(ASSETS, 'pdf')) ? fs.readdirSync(path.join(ASSETS, 'pdf')) : []) if (f.endsWith('.pdf')) fs.copyFileSync(path.join(ASSETS, 'pdf', f), path.join(OUT, 'pdf', f));
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
  // письму нужны только название профиля и краткое описание; роли, поведение в команде и советы по общению в скрипт не кладём
  const profiles = {};
  for (const k of Object.keys(L.profiles)) profiles[k] = { name: L.profiles[k].name, summary: L.profiles[k].summary };
  mailData[L.lang] = { name: L.name, dir: L.dir, keys: L.keys, profiles, email };
}
const gsTpl = fs.readFileSync(path.join(SRC, 'apps-script.template.js'), 'utf8');
const gs = gsTpl
  .replace('__SITE_URL__', siteUrl).replace('__SEND_TOKEN__', String(cfg.sendToken || '').replace(/['\\]/g, ''))
  .replace('__CONTACT_TO__', feedbackEmail).replace('__MAX_CONTACT_BYTES__', String(MAX_CONTACT_BYTES))
  .replace('__BLOCK_KEYS__', BLOCK_KEYS).replace('__DATA__', () => JSON.stringify(mailData));
fs.mkdirSync(path.join(ROOT, 'backend', 'apps-script'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'backend', 'apps-script', 'Code.gs'), gs);
console.log(`Built ${locales.length} languages, ${pages.length} pages (root = ${def.lang}) → docs/ (${locales.map(L => L.lang).join(', ')}); backend/apps-script/Code.gs${cfg.sendEndpoint ? '' : ' (sendEndpoint не задан: письма не отправляются)'}${feedbackEmail ? '' : ' (feedbackEmail не задан: страницы /contact/ нет)'}`);
