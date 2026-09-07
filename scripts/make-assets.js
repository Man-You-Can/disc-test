// Генерация иконок и og-картинок в src/assets/. Нужен rsvg-convert (brew install librsvg).
// Запуск: node scripts/make-assets.js   (после изменения title в локалях — перезапустить)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src'), OUTD = path.join(SRC, 'assets');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const domain = cfg.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
fs.mkdirSync(path.join(OUTD, 'og'), { recursive: true });
const C = { d: '#C9453D', i: '#D6961F', s: '#3A9A69', c: '#3B6FB6', ink: '#1B2027', paper: '#F3F4F6', muted: '#5B6470', line: '#D9DDE3' };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const FONT = "'Helvetica Neue', Helvetica, Arial, 'PingFang SC', 'Hiragino Sans', 'Geeza Pro', 'Kohinoor Devanagari', 'Devanagari Sangam MN', 'Noto Sans', sans-serif";
const run = (svg, out, w, h) => { const tmp = path.join(OUTD, '.tmp.svg'); fs.writeFileSync(tmp, svg); execSync(`rsvg-convert -w ${w} -h ${h} "${tmp}" -o "${out}"`); fs.unlinkSync(tmp); };

// favicon.svg — четыре точки на прозрачном фоне
const dots = (cx, cy, r, gap) => `<circle cx="${cx - gap}" cy="${cy - gap}" r="${r}" fill="${C.d}"/><circle cx="${cx + gap}" cy="${cy - gap}" r="${r}" fill="${C.i}"/><circle cx="${cx - gap}" cy="${cy + gap}" r="${r}" fill="${C.s}"/><circle cx="${cx + gap}" cy="${cy + gap}" r="${r}" fill="${C.c}"/>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${dots(16, 16, 6, 7)}</svg>\n`;
fs.writeFileSync(path.join(OUTD, 'favicon.svg'), favicon);
// иконки приложения — тёмный квадрат с точками (скругление добавляют сами ОС)
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="${C.ink}"/>${dots(256, 256, 72, 92)}</svg>`;
run(appIcon, path.join(OUTD, 'apple-touch-icon.png'), 180, 180);
run(appIcon, path.join(OUTD, 'icon-192.png'), 192, 192);
run(appIcon, path.join(OUTD, 'icon-512.png'), 512, 512);
// favicon.ico — контейнер ICO с одним PNG 32×32
run(favicon, path.join(OUTD, '.fav32.png'), 32, 32);
const png = fs.readFileSync(path.join(OUTD, '.fav32.png')); fs.unlinkSync(path.join(OUTD, '.fav32.png'));
const ico = Buffer.alloc(22); ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 32; ico[7] = 32; ico[8] = 0; ico[9] = 0; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(OUTD, 'favicon.ico'), Buffer.concat([ico, png]));

// og-картинки 1200×630 на каждом языке: точки + бренд, крупные буквы DISC, заголовок из title, домен
for (const code of cfg.languages) {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8'));
  const [t1, t2] = L.title.split(/\s*[—–]\s*|\s-\s/);
  // В SVG при direction="rtl" text-anchor="start" ставит начало строки в x и растит её влево — так текст прижат к правому краю
  const rtl = L.dir === 'rtl', x = rtl ? 1120 : 80, anchor = 'start', dirAttr = rtl ? 'rtl' : 'ltr';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${C.paper}"/>
<rect x="40" y="40" width="1120" height="550" rx="28" fill="#fff" stroke="${C.line}"/>
<g transform="translate(${rtl ? 1070 : 80},96)">${dots(0, 0, 9, 11)}</g>
<text x="${rtl ? 1040 : 112}" y="107" font-family="${FONT}" font-size="30" font-weight="600" fill="${C.ink}" text-anchor="${anchor}" direction="${dirAttr}">${esc(L.brand)}</text>
<text x="${x}" y="320" font-family="${FONT}" font-size="190" font-weight="700" letter-spacing="8" text-anchor="${rtl ? 'end' : 'start'}"><tspan fill="${C.d}">D</tspan><tspan fill="${C.i}">I</tspan><tspan fill="${C.s}">S</tspan><tspan fill="${C.c}">C</tspan></text>
<text x="${x}" y="410" font-family="${FONT}" font-size="46" font-weight="700" fill="${C.ink}" text-anchor="${anchor}" direction="${dirAttr}">${esc(t1)}</text>
<text x="${x}" y="470" font-family="${FONT}" font-size="32" fill="${C.muted}" text-anchor="${anchor}" direction="${dirAttr}">${esc(t2 || '')}</text>
<text x="${rtl ? 80 : 1120}" y="548" font-family="${FONT}" font-size="26" fill="${C.muted}" text-anchor="${rtl ? 'start' : 'end'}">${esc(domain)}</text>
</svg>`;
  run(svg, path.join(OUTD, 'og', code + '.png'), 1200, 630);
}
console.log('assets written to src/assets/: favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, og/*.png');
