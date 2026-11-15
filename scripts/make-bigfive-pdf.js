#!/usr/bin/env node
// Бланк теста «Большая пятёрка» в PDF → src/assets/pdf/big-five-test-<язык>.pdf (сборка копирует в docs/pdf/), с 2026-11-16.
// Только языки, где в локали есть content.bigfive.paper (пока русская версия). Разметка — src/bigfive-print.js.
// Порядок утверждений, обратные утверждения, нормы и границы уровней берутся из src/bigfive.js — тем же расчётом, что онлайн.
// Нужен Google Chrome или Chromium (путь — CHROME_PATH). Запуск: node scripts/make-bigfive-pdf.js [язык …]
// (после правки утверждений, текстов content.bigfive.paper.print, описаний черт и аспектов или норм в src/bigfive.js)
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src'), OUTD = path.join(SRC, 'assets', 'pdf');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const printHTML = require(path.join(SRC, 'bigfive-print.js'));
const qrSVG = require(path.join(SRC, 'qr.js'));
// ключи теста из src/bigfive.js: от «var TRAITS» до «var PER» (TRAITS, POS, нормы, ORDER) и функции cdf, pctl, level
const bf = fs.readFileSync(path.join(SRC, 'bigfive.js'), 'utf8');
const part = bf.slice(bf.indexOf('var TRAITS'), bf.indexOf('var PER'));
const fns = ['cdf', 'pctl', 'level'].map(n => { const m = bf.match(new RegExp('function ' + n + '\\([\\s\\S]*?\\n(?=  function |  /\\*|\\n)')); if (!m) throw new Error('src/bigfive.js: no function ' + n); return m[0]; }).join('\n');
const K = new Function(part + '\n' + fns + '\nreturn {TRAITS: TRAITS, POS: POS, NORM: NORM, ORDER: ORDER, pctl: pctl, level: level};')();
if (K.ORDER.length !== 100) throw new Error('ORDER: ' + K.ORDER.length);
const CANDIDATES = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chrome = CANDIDATES.find(p => fs.existsSync(p));
if (!chrome) { console.error('Google Chrome не найден: задайте путь в переменной CHROME_PATH'); process.exit(1); }
const fontsDir = path.join(SRC, 'assets', 'fonts');
const fontsCssAll = fs.existsSync(path.join(fontsDir, 'fonts.css')) ? fs.readFileSync(path.join(fontsDir, 'fonts.css'), 'utf8') : '';
const fontsUrl = 'file://' + encodeURI(fontsDir) + '/';
const fontsCss = fontsCssAll.split('\n').filter(l => l.startsWith('@font-face') && l.includes("font-family:'Golos Text'")).join('\n').replace(/__FONTS__/g, fontsUrl);
const siteUrl = cfg.siteUrl.replace(/\/+$/, ''), def = cfg.defaultLang;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const langs = process.argv.slice(2).length ? process.argv.slice(2) : cfg.languages;
fs.mkdirSync(OUTD, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-pdf-'));
for (const code of langs) {
  const L = require(path.join(SRC, 'typo.js'))(JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8')));
  if (!(L.content.bigfive && L.content.bigfive.paper)) { if (process.argv.length > 2) console.warn(code + ': нет content.bigfive.paper'); continue; }
  const url = siteUrl + '/' + (code === def ? '' : code + '/');
  const html = printHTML({ L, K, esc, url, testUrl: url + 'big-five/?ref=pdf', qr: qrSVG, fontsCss, fontFamily: "'Golos Text',Helvetica,Arial,sans-serif" });
  const htmlFile = path.join(tmp, code + '.html'); fs.writeFileSync(htmlFile, html);
  const out = path.join(OUTD, 'big-five-test-' + code + '.pdf');
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', '--virtual-time-budget=5000', '--print-to-pdf=' + out, 'file://' + encodeURI(htmlFile)], { stdio: 'ignore', timeout: 120000 });
  console.log('pdf: ' + path.relative(ROOT, out) + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');
}
