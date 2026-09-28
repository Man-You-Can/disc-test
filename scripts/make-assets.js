// Генерация иконок и og-картинок в src/assets/. Нужен rsvg-convert (brew install librsvg).
// Запуск: node scripts/make-assets.js   (после изменения title в локалях — перезапустить)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src'), OUTD = path.join(SRC, 'assets');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const domain = cfg.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
fs.mkdirSync(path.join(OUTD, 'og'), { recursive: true });
const C = { d: '#C9453D', i: '#D6961F', s: '#3A9A69', c: '#3B6FB6', ink: '#1B2027', paper: '#F3F4F6', muted: '#5B6470', line: '#D9DDE3' };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const FONT_FOR = cjk => `'Helvetica Neue', Helvetica, Arial, ${cjk}, 'Hiragino Sans', 'Geeza Pro', 'Kohinoor Devanagari', 'Devanagari Sangam MN', 'Noto Sans', sans-serif`;
// для традиционного китайского первым идёт шрифт с тайваньскими начертаниями иероглифов
const CJK = { 'zh-hant': "'PingFang TC', 'Heiti TC', 'PingFang SC'" }, CJK_DEFAULT = "'PingFang SC'";
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
// favicon-120.png — Яндекс рекомендует PNG 120×120 для показа в поиске
run(favicon, path.join(OUTD, 'favicon-120.png'), 120, 120);
// favicon.ico — классический ICO с BMP-картинками 16, 32 и 48 px: PNG внутри ICO робот Яндекса не читал («Файл favicon не найден»)
const zlib = require('zlib');
const readRGBA = file => { // PNG от rsvg-convert: 8 бит, RGBA, без чересстрочности
  const b = fs.readFileSync(file); let p = 8, w, h; const idat = [];
  while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[9] !== 6 || d[12] !== 0) throw new Error('unexpected PNG format ' + file); }
    if (type === 'IDAT') idat.push(d); p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4), st = w * 4;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)];
    for (let x = 0; x < st; x++) { const v = raw[y * (st + 1) + 1 + x], a = x >= 4 ? px[y * st + x - 4] : 0, up = y ? px[(y - 1) * st + x] : 0, c = x >= 4 && y ? px[(y - 1) * st + x - 4] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      px[y * st + x] = (v + [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f]) & 255; } }
  return { w, h, px };
};
const bmps = [16, 32, 48].map(s => { const tmp = path.join(OUTD, `.fav${s}.png`); run(favicon, tmp, s, s); const { px } = readRGBA(tmp); fs.unlinkSync(tmp);
  const mask = Math.ceil(s / 32) * 4, img = Buffer.alloc(40 + s * s * 4 + mask * s); // BITMAPINFOHEADER + BGRA снизу вверх + маска прозрачности
  img.writeUInt32LE(40, 0); img.writeInt32LE(s, 4); img.writeInt32LE(s * 2, 8); img.writeUInt16LE(1, 12); img.writeUInt16LE(32, 14); img.writeUInt32LE(s * s * 4 + mask * s, 20);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4, o = 40 + ((s - 1 - y) * s + x) * 4;
    img[o] = px[i + 2]; img[o + 1] = px[i + 1]; img[o + 2] = px[i]; img[o + 3] = px[i + 3];
    if (!px[i + 3]) img[40 + s * s * 4 + (s - 1 - y) * mask + (x >> 3)] |= 0x80 >> (x & 7); }
  return { s, img }; });
const icoHead = Buffer.alloc(6 + 16 * bmps.length); icoHead.writeUInt16LE(1, 2); icoHead.writeUInt16LE(bmps.length, 4);
let icoOff = icoHead.length;
bmps.forEach(({ s, img }, k) => { const e = 6 + 16 * k; icoHead[e] = s; icoHead[e + 1] = s; icoHead.writeUInt16LE(1, e + 4); icoHead.writeUInt16LE(32, e + 6); icoHead.writeUInt32LE(img.length, e + 8); icoHead.writeUInt32LE(icoOff, e + 12); icoOff += img.length; });
fs.writeFileSync(path.join(OUTD, 'favicon.ico'), Buffer.concat([icoHead, ...bmps.map(b => b.img)]));

// og-картинки 1200×630. Telegram (и мелкие превью WhatsApp) обрезают картинку по центру до квадрата 630×630,
// поэтому всё главное — в центральной колонке шириной SAFE; бренд и домен по углам целиком вне квадрата.
const CX = 600, SAFE = 540;
// ширина строки в px — рендерим её отдельно и ищем границы непрозрачных пикселей (подходит для любой письменности)
const widthCache = new Map();
const measure = (s, size, weight, font) => {
  const k = [s, size, weight, font].join('|'); if (widthCache.has(k)) return widthCache.get(k);
  const W = 4000, H = Math.ceil(size * 2), tmp = path.join(OUTD, '.measure.png');
  run(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="${W / 2}" y="${Math.round(size * 1.4)}" font-family="${font}" font-size="${size}" font-weight="${weight}" text-anchor="middle">${esc(s)}</text></svg>`, tmp, W, H);
  const { w, h, px } = readRGBA(tmp); fs.unlinkSync(tmp);
  let min = w, max = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 20) { if (x < min) min = x; if (x > max) max = x; }
  const r = max < 0 ? 0 : max - min + 1; widthCache.set(k, r); return r;
};
// строка в ширину width: кегль до max; если выходит мельче min — перенос на две строки (по пробелу ближе к середине, без пробелов — по знаку)
const fitLines = (s, { max, min, width = SAFE, weight = 400, font }) => {
  const size1 = Math.min(max, Math.floor(max * width / measure(s, max, weight, font)));
  const chars = Array.from(s);
  if (size1 >= min || chars.length < 4) return { size: Math.max(size1, 20), lines: [s] };
  const spaces = chars.map((c, i) => c === ' ' && !/[:;!?»)]/.test(chars[i + 1] || '') ? i : -1).filter(i => i > 0); // не переносим «:» французского на новую строку
  const cand = spaces.length ? spaces : chars.map((_, i) => i).slice(1);
  const mid = chars.length / 2, at = cand.reduce((a, b) => Math.abs(b - mid) < Math.abs(a - mid) ? b : a);
  const lines = [chars.slice(0, at).join('').trim(), chars.slice(at).join('').trim()];
  const size = Math.min(max, Math.floor(max * width / Math.max(...lines.map(l => measure(l, max, weight, font)))));
  return { size: Math.max(size, 20), lines };
};
// строки по центру; y — базовая линия первой строки, возвращает базовую линию последней
const centered = (fit, y, lh, attrs) => fit.lines.map((l, i) => `<text x="${CX}" y="${y + i * Math.round(fit.size * lh)}" font-size="${fit.size}" text-anchor="middle" ${attrs}>${esc(l)}</text>`).join('\n');
const lastY = (fit, y, lh) => y + (fit.lines.length - 1) * Math.round(fit.size * lh);
// общая рамка: фон, карточка, точки + бренд в верхнем углу, домен в нижнем
const frame = (L, FONT, body) => {
  const rtl = L.dir === 'rtl', dirAttr = rtl ? 'rtl' : 'ltr';
  const brandSize = Math.min(30, Math.floor(30 * 170 / measure(L.brand, 30, 600, FONT))); // бренд не заходит в центральный квадрат
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${C.paper}"/>
<rect x="40" y="40" width="1120" height="550" rx="28" fill="#fff" stroke="${C.line}"/>
<g transform="translate(${rtl ? 1100 : 100},100)">${dots(0, 0, 9, 11)}</g>
<text x="${rtl ? 1070 : 130}" y="111" font-family="${FONT}" font-size="${brandSize}" font-weight="600" fill="${C.ink}" direction="${dirAttr}">${esc(L.brand)}</text>
${body}
<text x="${rtl ? 80 : 1120}" y="555" font-family="${FONT}" font-size="26" fill="${C.muted}" text-anchor="${rtl ? 'start' : 'end'}">${esc(domain)}</text>
</svg>`;
};

// og-картинки на каждом языке: крупные буквы DISC, заголовок из title (до «—» или «｜») и подзаголовок
for (const code of cfg.languages) {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8'));
  const [t1, t2] = L.title.split(/\s*[—–｜|]\s*|\s-\s/);
  const FONT = FONT_FOR(CJK[code] || CJK_DEFAULT), dirAttr = L.dir === 'rtl' ? 'rtl' : 'ltr';
  const f1 = fitLines(t1, { max: 50, min: 38, weight: 700, font: FONT }), y1 = f1.lines.length > 1 ? 375 : 395;
  const f2 = t2 ? fitLines(t2, { max: 32, min: 26, font: FONT }) : null, y2 = lastY(f1, y1, 1.2) + (f2 ? Math.round(f2.size * 1.7) : 0);
  const svg = frame(L, FONT, `<text x="${CX}" y="${f1.lines.length > 1 || (f2 && f2.lines.length > 1) ? 280 : 300}" font-family="${FONT}" font-size="180" font-weight="700" letter-spacing="6" text-anchor="middle" direction="ltr"><tspan fill="${C.d}">D</tspan><tspan fill="${C.i}">I</tspan><tspan fill="${C.s}">S</tspan><tspan fill="${C.c}">C</tspan></text>
${centered(f1, y1 - (f2 && f2.lines.length > 1 ? 15 : 0), 1.2, `font-family="${FONT}" font-weight="700" fill="${C.ink}" direction="${dirAttr}"`)}
${f2 ? centered(f2, y2 - (f2.lines.length > 1 ? 15 : 0), 1.3, `font-family="${FONT}" fill="${C.muted}" direction="${dirAttr}"`) : ''}`);
  run(svg, path.join(OUTD, 'og', code + '.png'), 1200, 630);
}
// og-картинки 16 профилей на каждом языке (ссылка «Поделиться типом» ведёт на страницу профиля):
// буквы профиля в цветах стилей рядом со шкалами четырёх стилей (типичный набор из src/samples.js), ниже название и стили словами
const SAMPLE_NET = require(path.join(SRC, 'samples.js'));
const COL = { D: C.d, I: C.i, S: C.s, C: C.c };
fs.mkdirSync(path.join(OUTD, 'og', 'profiles'), { recursive: true });
for (const code of cfg.languages) {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8'));
  const FONT = FONT_FOR(CJK[code] || CJK_DEFAULT), rtl = L.dir === 'rtl', dirAttr = rtl ? 'rtl' : 'ltr';
  for (const key of Object.keys(SAMPLE_NET)) {
    const pr = L.profiles[key], net = SAMPLE_NET[key];
    const eyebrow = fitLines(L.ui['pages.profile.eyebrow'].replace('{key}', key), { max: 28, min: 22, font: FONT });
    const styles = fitLines(key.split('').map(k => L.keys[k]).join(' + '), { max: 30, min: 24, font: FONT });
    const name = fitLines(pr.name, { max: 60, min: 40, weight: 700, font: FONT });
    // блок «буквы + шкалы» по центру: ширина букв меряется, шкалы — 290 px (буква, полоса 190, проценты)
    const lw = measure(key[0], 150, 700, FONT) + (key[1] ? 8 + measure(key[1], 96, 700, FONT) : 0), bw = 190, gap = 50;
    const left = Math.round(CX - (lw + gap + 290) / 2);
    const lx = rtl ? left + 290 + gap + lw : left, bx = rtl ? left : left + lw + gap; // буквы и шкалы меняются местами в RTL
    const bars = ['D', 'I', 'S', 'C'].map((k, i) => { const y = 214 + i * 38, p = Math.round((net[k] + 24) / 48 * 100), w = Math.round(bw * p / 100);
      const tx = rtl ? bx + 290 : bx, rx = rtl ? bx + 60 : bx + 36, fx = rtl ? rx + bw - w : rx;
      return `<text x="${tx}" y="${y + 14}" font-family="${FONT}" font-size="26" font-weight="700" fill="${COL[k]}" text-anchor="${rtl ? 'end' : 'start'}">${k}</text>` +
        `<rect x="${rx}" y="${y}" width="${bw}" height="14" rx="7" fill="${C.line}" opacity=".6"/><rect x="${fx}" y="${y}" width="${w}" height="14" rx="7" fill="${COL[k]}"/>` +
        `<text x="${rtl ? rx - 10 : rx + bw + 10}" y="${y + 13}" font-family="${FONT}" font-size="19" fill="${C.muted}" text-anchor="${rtl ? 'end' : 'start'}" direction="ltr">${p}%</text>`; }).join('');
    const yName = name.lines.length > 1 ? 405 : 425, yStyles = lastY(name, yName, 1.15) + Math.round(styles.size * 1.7);
    const svg = frame(L, FONT, `${centered(eyebrow, 162, 1.2, `font-family="${FONT}" fill="${C.muted}" direction="${dirAttr}"`)}
<text x="${lx}" y="344" font-family="${FONT}" font-size="150" font-weight="700" text-anchor="${rtl ? 'end' : 'start'}" direction="ltr"><tspan fill="${COL[key[0]]}">${key[0]}</tspan>${key[1] ? `<tspan fill="${COL[key[1]]}" font-size="96" dx="8">${key[1]}</tspan>` : ''}</text>
${bars}
${centered(name, yName, 1.15, `font-family="${FONT}" font-weight="700" fill="${C.ink}" direction="${dirAttr}"`)}
${centered(styles, yStyles, 1.3, `font-family="${FONT}" fill="${C.muted}" direction="${dirAttr}"`)}`);
    run(svg, path.join(OUTD, 'og', 'profiles', `${code}-${key.toLowerCase()}.png`), 1200, 630);
  }
}
// og-картинки 10 пар совместимости (страницы /compatibility/d-s/ и т. п.): две буквы в цветах стилей, заголовок пары, раздел сайта
const PAIRS = ['DD', 'DI', 'DS', 'DC', 'II', 'IS', 'IC', 'SS', 'SC', 'CC'];
fs.mkdirSync(path.join(OUTD, 'og', 'pairs'), { recursive: true });
for (const code of cfg.languages) {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8'));
  const FONT = FONT_FOR(CJK[code] || CJK_DEFAULT), dirAttr = L.dir === 'rtl' ? 'rtl' : 'ltr';
  const eyebrow = fitLines(L.ui['nav.compat'], { max: 28, min: 22, font: FONT });
  for (const k of PAIRS) {
    const names = k[0] === k[1] ? { a: k[0], b: k[1] } : { a: L.keys[k[0]], b: L.keys[k[1]] };
    const title = fitLines(L.ui['pages.compat.h1'].replace('{a}', names.a).replace('{b}', names.b), { max: 54, min: 40, weight: 700, font: FONT });
    const svg = frame(L, FONT, `${centered(eyebrow, 172, 1.2, `font-family="${FONT}" fill="${C.muted}" direction="${dirAttr}"`)}
<text x="${CX}" y="${title.lines.length > 1 ? 345 : 360}" font-family="${FONT}" font-size="170" font-weight="700" text-anchor="middle" direction="ltr"><tspan fill="${COL[k[0]]}">${k[0]}</tspan><tspan fill="${C.muted}" font-size="110" dx="30" dy="-15">+</tspan><tspan fill="${COL[k[1]]}" dx="30" dy="15">${k[1]}</tspan></text>
${centered(title, title.lines.length > 1 ? 440 : 465, 1.2, `font-family="${FONT}" font-weight="700" fill="${C.ink}" direction="${dirAttr}"`)}`);
    run(svg, path.join(OUTD, 'og', 'pairs', `${code}-${k[0].toLowerCase()}-${k[1].toLowerCase()}.png`), 1200, 630);
  }
}
console.log('assets written to src/assets/: favicon.svg, favicon.ico, favicon-120.png, apple-touch-icon.png, icon-192.png, icon-512.png, og/*.png, og/profiles/*.png, og/pairs/*.png');
