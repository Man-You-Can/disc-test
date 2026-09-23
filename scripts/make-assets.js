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
// favicon.ico — контейнер ICO с одним PNG 32×32
run(favicon, path.join(OUTD, '.fav32.png'), 32, 32);
const png = fs.readFileSync(path.join(OUTD, '.fav32.png')); fs.unlinkSync(path.join(OUTD, '.fav32.png'));
const ico = Buffer.alloc(22); ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 32; ico[7] = 32; ico[8] = 0; ico[9] = 0; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(OUTD, 'favicon.ico'), Buffer.concat([ico, png]));

// og-картинки 1200×630 на каждом языке: точки + бренд, крупные буквы DISC, заголовок из title, домен
for (const code of cfg.languages) {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8'));
  const [t1, t2] = L.title.split(/\s*[—–｜|]\s*|\s-\s/);
  const FONT = FONT_FOR(CJK[code] || CJK_DEFAULT);
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
// og-картинки 16 профилей на каждом языке (ссылка «Поделиться типом» ведёт на страницу профиля):
// буквы профиля в цветах стилей, название, стили словами, шкалы четырёх стилей по типичному набору из src/samples.js
const SAMPLE_NET = require(path.join(SRC, 'samples.js'));
const COL = { D: C.d, I: C.i, S: C.s, C: C.c };
const wide = s => /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿＀-｠]/.test(s) ? 1.0 : 0.6; // средняя ширина знака в em
const fit = (s, max, width) => Math.max(26, Math.min(max, Math.floor(width / (Array.from(s).length * wide(s)))));
fs.mkdirSync(path.join(OUTD, 'og', 'profiles'), { recursive: true });
for (const code of cfg.languages) {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8'));
  const FONT = FONT_FOR(CJK[code] || CJK_DEFAULT), rtl = L.dir === 'rtl', dirAttr = rtl ? 'rtl' : 'ltr';
  const tx = rtl ? 1120 : 80;                          // колонка текста; шкалы — в противоположной половине
  const bx = rtl ? 90 : 760, bw = 290;                 // шкалы: буква, полоса, проценты
  for (const key of Object.keys(SAMPLE_NET)) {
    const pr = L.profiles[key], net = SAMPLE_NET[key];
    const eyebrow = L.ui['pages.profile.eyebrow'].replace('{key}', key);
    const styles = key.split('').map(k => L.keys[k]).join(' + ');
    const nameSize = fit(pr.name, 64, 620), stylesSize = fit(styles, 32, 620);
    const bars = ['D', 'I', 'S', 'C'].map((k, i) => { const y = 210 + i * 82, p = Math.round((net[k] + 24) / 48 * 100), w = Math.round(bw * p / 100);
      const lx = rtl ? bx + bw + 44 : bx, rx = rtl ? bx : bx + 44, fx = rtl ? rx + bw - w : rx;
      return `<text x="${lx}" y="${y + 17}" font-family="${FONT}" font-size="34" font-weight="700" fill="${COL[k]}">${k}</text>` +
        `<rect x="${rx}" y="${y}" width="${bw}" height="18" rx="9" fill="${C.line}" opacity=".6"/><rect x="${fx}" y="${y}" width="${w}" height="18" rx="9" fill="${COL[k]}"/>` +
        `<text x="${rtl ? rx - 12 : rx + bw + 12}" y="${y + 16}" font-family="${FONT}" font-size="22" fill="${C.muted}" text-anchor="${rtl ? 'end' : 'start'}" direction="ltr">${p}%</text>`; }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${C.paper}"/>
<rect x="40" y="40" width="1120" height="550" rx="28" fill="#fff" stroke="${C.line}"/>
<g transform="translate(${rtl ? 1070 : 80},96)">${dots(0, 0, 9, 11)}</g>
<text x="${rtl ? 1040 : 112}" y="107" font-family="${FONT}" font-size="30" font-weight="600" fill="${C.ink}" direction="${dirAttr}">${esc(L.brand)}</text>
<text x="${tx}" y="180" font-family="${FONT}" font-size="28" fill="${C.muted}" direction="${dirAttr}">${esc(eyebrow)}</text>
<text x="${tx}" y="345" font-family="${FONT}" font-size="170" font-weight="700" text-anchor="${rtl ? 'end' : 'start'}" direction="ltr"><tspan fill="${COL[key[0]]}">${key[0]}</tspan>${key[1] ? `<tspan fill="${COL[key[1]]}" font-size="110">${key[1]}</tspan>` : ''}</text>
<text x="${tx}" y="440" font-family="${FONT}" font-size="${nameSize}" font-weight="700" fill="${C.ink}" direction="${dirAttr}">${esc(pr.name)}</text>
<text x="${tx}" y="495" font-family="${FONT}" font-size="${stylesSize}" fill="${C.muted}" direction="${dirAttr}">${esc(styles)}</text>
${bars}
<text x="${rtl ? 80 : 1120}" y="548" font-family="${FONT}" font-size="26" fill="${C.muted}" text-anchor="${rtl ? 'start' : 'end'}">${esc(domain)}</text>
</svg>`;
    run(svg, path.join(OUTD, 'og', 'profiles', `${code}-${key.toLowerCase()}.png`), 1200, 630);
  }
}
// og-картинки 10 пар совместимости (страницы /compatibility/d-s/ и т. п.): две буквы в цветах стилей, заголовок пары, раздел сайта
const PAIRS = ['DD', 'DI', 'DS', 'DC', 'II', 'IS', 'IC', 'SS', 'SC', 'CC'];
fs.mkdirSync(path.join(OUTD, 'og', 'pairs'), { recursive: true });
for (const code of cfg.languages) {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8'));
  const FONT = FONT_FOR(CJK[code] || CJK_DEFAULT), rtl = L.dir === 'rtl', dirAttr = rtl ? 'rtl' : 'ltr', tx = rtl ? 1120 : 80;
  for (const k of PAIRS) {
    const names = k[0] === k[1] ? { a: k[0], b: k[1] } : { a: L.keys[k[0]], b: L.keys[k[1]] };
    const title = L.ui['pages.compat.h1'].replace('{a}', names.a).replace('{b}', names.b), size = fit(title, 56, 1040);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${C.paper}"/>
<rect x="40" y="40" width="1120" height="550" rx="28" fill="#fff" stroke="${C.line}"/>
<g transform="translate(${rtl ? 1070 : 80},96)">${dots(0, 0, 9, 11)}</g>
<text x="${rtl ? 1040 : 112}" y="107" font-family="${FONT}" font-size="30" font-weight="600" fill="${C.ink}" direction="${dirAttr}">${esc(L.brand)}</text>
<text x="${tx}" y="180" font-family="${FONT}" font-size="28" fill="${C.muted}" direction="${dirAttr}">${esc(L.ui['nav.compat'])}</text>
<text x="600" y="360" font-family="${FONT}" font-size="170" font-weight="700" text-anchor="middle" direction="ltr"><tspan fill="${COL[k[0]]}">${k[0]}</tspan><tspan fill="${C.muted}" font-size="110" dx="30" dy="-15">+</tspan><tspan fill="${COL[k[1]]}" dx="30" dy="15">${k[1]}</tspan></text>
<text x="600" y="470" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${C.ink}" text-anchor="middle" direction="${dirAttr}">${esc(title)}</text>
<text x="${rtl ? 80 : 1120}" y="548" font-family="${FONT}" font-size="26" fill="${C.muted}" text-anchor="${rtl ? 'start' : 'end'}">${esc(domain)}</text>
</svg>`;
    run(svg, path.join(OUTD, 'og', 'pairs', `${code}-${k[0].toLowerCase()}-${k[1].toLowerCase()}.png`), 1200, 630);
  }
}
console.log('assets written to src/assets/: favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, og/*.png, og/profiles/*.png, og/pairs/*.png');
