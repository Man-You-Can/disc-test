// Скачивает шрифты с Google Fonts в src/assets/fonts/ (woff2 по подмножествам) и пишет fonts.css с @font-face.
// Запуск: node scripts/fetch-fonts.js   (нужен интернет; повторять только при смене набора шрифтов)
const fs = require('fs'), path = require('path'), https = require('https');
const OUT = path.join(__dirname, '..', 'src', 'assets', 'fonts');
fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const FAMILIES = [
  { css: 'Unbounded:wght@400;500;600', subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'] },
  { css: 'Golos+Text:wght@400;500;600', subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'] },
  { css: 'IBM+Plex+Mono:wght@400;500', subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'] },
  { css: 'Noto+Kufi+Arabic:wght@500;600', subsets: ['arabic', 'latin'] },
  { css: 'IBM+Plex+Sans+Arabic:wght@400;500;600', subsets: ['arabic', 'latin'] },
  { css: 'Noto+Sans+Devanagari:wght@400;500;600', subsets: ['devanagari', 'latin'] }
];
const get = (url, binary) => new Promise((resolve, reject) => https.get(url, { headers: { 'User-Agent': UA } }, res => {
  if (res.statusCode !== 200) return reject(new Error(res.statusCode + ' ' + url));
  const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
}).on('error', reject));
(async () => {
  let cssOut = '/* Шрифты сайта. Сгенерировано scripts/fetch-fonts.js; лицензии: SIL OFL 1.1 */\n', files = 0, bytes = 0;
  for (const fam of FAMILIES) {
    const css = await get('https://fonts.googleapis.com/css2?family=' + fam.css + '&display=swap');
    const blocks = css.split('@font-face').slice(1);
    for (const b of blocks) {
      const subset = (b.match(/\/\* ([a-z-]+) \*\//) || [])[1];
      if (!fam.subsets.includes(subset)) continue;
      const family = (b.match(/font-family: '([^']+)'/) || [])[1], weight = (b.match(/font-weight: (\d+)/) || [])[1];
      const url = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1], range = (b.match(/unicode-range: ([^;]+);/) || [])[1];
      if (!url) continue;
      const name = family.toLowerCase().replace(/\s+/g, '-') + '-' + weight + '-' + subset + '.woff2';
      const buf = await get(url, true); fs.writeFileSync(path.join(OUT, name), buf); files++; bytes += buf.length;
      cssOut += `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(__FONTS__${name}) format('woff2');unicode-range:${range}}\n`;
    }
  }
  fs.writeFileSync(path.join(OUT, 'fonts.css'), cssOut);
  console.log(`fonts: ${files} files, ${Math.round(bytes / 1024)} KB → src/assets/fonts/ (+ fonts.css)`);
})().catch(e => { console.error('fetch-fonts failed:', e.message); process.exit(1); });
