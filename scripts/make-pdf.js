#!/usr/bin/env node
// Печатная версия теста в PDF на каждом языке → src/assets/pdf/disc-test-<язык>.pdf (сборка копирует в docs/pdf/).
// Нужен Google Chrome или Chromium (путь можно задать переменной CHROME_PATH). Разметка — src/print.js.
// Запуск: node scripts/make-pdf.js [язык …]   (после изменения блоков, названий профилей или текстов print.* в локалях)
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src'), OUTD = path.join(SRC, 'assets', 'pdf');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const printHTML = require(path.join(SRC, 'print.js'));
const tpl = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const BLOCK_KEYS = JSON.parse((tpl.match(/var BLOCK_KEYS = (\[[^\]]+\]);/) || [])[1].replace(/'/g, '"'));
const KEYS = ['D', 'I', 'S', 'C'], PROFILE_KEYS = ['D', 'DI', 'DC', 'DS', 'I', 'ID', 'IS', 'IC', 'S', 'SI', 'SC', 'SD', 'C', 'CD', 'CS', 'CI'];
const CANDIDATES = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chrome = CANDIDATES.find(p => fs.existsSync(p));
if (!chrome) { console.error('Google Chrome не найден: задайте путь в переменной CHROME_PATH'); process.exit(1); }
const fontsDir = path.join(SRC, 'assets', 'fonts');
const fontsCssAll = fs.existsSync(path.join(fontsDir, 'fonts.css')) ? fs.readFileSync(path.join(fontsDir, 'fonts.css'), 'utf8') : '';
// Заголовочный шрифт Unbounded в печати не используется: в PDF нужен один надёжный текстовый шрифт на язык.
// Для китайского и японского — системные шрифты macOS/Windows (PingFang в headless Chrome не встраивается, Hiragino — встраивается).
const FONTS = {
  default: { families: ['Golos Text'], family: "'Golos Text',Helvetica,Arial,sans-serif" },
  ar: { families: ['IBM Plex Sans Arabic', 'Golos Text'], family: "'IBM Plex Sans Arabic','Golos Text',Tahoma,sans-serif" },
  hi: { families: ['Noto Sans Devanagari', 'Golos Text'], family: "'Noto Sans Devanagari','Golos Text',sans-serif" },
  zh: { families: [], family: "'Hiragino Sans GB','Heiti SC','STHeiti','Microsoft YaHei','Noto Sans CJK SC',sans-serif" },
  ja: { families: [], family: "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,'Noto Sans CJK JP',sans-serif" }
};
const siteUrl = cfg.siteUrl.replace(/\/+$/, ''), def = cfg.defaultLang;
const langs = process.argv.slice(2).length ? process.argv.slice(2) : cfg.languages;
fs.mkdirSync(OUTD, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-pdf-'));
const fontsUrl = 'file://' + encodeURI(fontsDir) + '/';
for (const code of langs) {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8')), f = FONTS[code] || FONTS.default;
  const fontsCss = fontsCssAll.split('\n').filter(l => l.startsWith('@font-face') && f.families.some(fam => l.includes(`font-family:'${fam}'`))).join('\n').replace(/__FONTS__/g, fontsUrl);
  const t = (key, vars) => { let v = L.ui[key]; if (v == null) v = key; if (vars) v = v.replace(/\{(\w+)\}/g, (_, n) => vars[n] != null ? vars[n] : '{' + n + '}'); return v; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = siteUrl + '/' + (code === def ? '' : code + '/');
  const html = printHTML({ L, t, esc, KEYS, PROFILE_KEYS, BLOCK_KEYS, url, fontsCss, fontFamily: f.family });
  const htmlFile = path.join(tmp, code + '.html'); fs.writeFileSync(htmlFile, html);
  const out = path.join(OUTD, 'disc-test-' + code + '.pdf');
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', '--virtual-time-budget=5000', '--print-to-pdf=' + out, 'file://' + encodeURI(htmlFile)], { stdio: 'ignore' });
  console.log('pdf: ' + path.relative(ROOT, out) + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');
}
