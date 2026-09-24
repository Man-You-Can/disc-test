#!/usr/bin/env node
// IndexNow: сообщает Bing и Яндексу (и другим участникам протокола) об изменённых страницах сайта.
// Google протокол не поддерживает — для него sitemap и «Проверка URL» в Search Console.
// Запуск после публикации (git push и 1–2 минуты на пересборку GitHub Pages):
//   node scripts/indexnow.js              — страницы из docs/, изменённые последним коммитом
//   node scripts/indexnow.js <коммит>     — изменённые начиная с этого коммита (например, HEAD~3 или хэш)
//   node scripts/indexnow.js --all        — все адреса из docs/sitemap.xml
//   --dry                                 — только показать список, ничего не отправлять
// Ключ — indexNowKey в site.config.json; сборка кладёт файл <ключ>.txt в корень сайта.
const fs = require('fs'), path = require('path'), https = require('https'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const siteUrl = cfg.siteUrl.replace(/\/+$/, ''), host = new URL(siteUrl).host, key = String(cfg.indexNowKey || '');
if (!key) { console.error('indexNowKey не задан в site.config.json'); process.exit(1); }
const args = process.argv.slice(2), dry = args.includes('--dry'), all = args.includes('--all');
const since = args.find(a => !a.startsWith('--')) || 'HEAD~1';

let urls;
if (all) {
  // sitemap.xml — индекс файлов sitemap-<язык>.xml (с 24.09.2026): адреса страниц берём из каждого файла, а не адреса самих файлов
  const read = f => fs.readFileSync(path.join(ROOT, 'docs', f), 'utf8'), locs = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const top = read('sitemap.xml');
  urls = /<sitemapindex/.test(top) ? locs(top).flatMap(u => locs(read(u.split('/').pop()))) : locs(top);
} else {
  const files = execSync(`git diff --name-only ${since} HEAD -- docs`, { cwd: ROOT }).toString().split('\n').filter(Boolean);
  urls = files.filter(f => /\.(html|pdf)$/.test(f) && !/(^|\/)404\.html$/.test(f) && fs.existsSync(path.join(ROOT, f)))
    .map(f => siteUrl + '/' + f.replace(/^docs\//, '').replace(/(^|\/)index\.html$/, '$1'))
    .filter(u => u !== siteUrl + '/en/'); // /en/ — только перенаправление в корень
}
urls = [...new Set(urls)];
if (!urls.length) { console.log('Изменённых страниц нет — отправлять нечего.'); process.exit(0); }
console.log(`${urls.length} адрес(ов)` + (dry ? ' (--dry, без отправки):' : ':'));
urls.slice(0, 20).forEach(u => console.log('  ' + u)); if (urls.length > 20) console.log(`  … и ещё ${urls.length - 20}`);
if (dry) process.exit(0);

// api.indexnow.org пересылает уведомление всем поисковикам протокола; не больше 10 000 адресов за запрос
const post = list => new Promise((resolve, reject) => {
  const body = JSON.stringify({ host, key, keyLocation: `${siteUrl}/${key}.txt`, urlList: list });
  const req = https.request({ method: 'POST', host: 'api.indexnow.org', path: '/indexnow', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } }, res => {
    let t = ''; res.on('data', c => t += c); res.on('end', () => resolve({ status: res.statusCode, text: t }));
  });
  req.on('error', reject); req.end(body);
});
(async () => {
  for (let i = 0; i < urls.length; i += 10000) {
    const r = await post(urls.slice(i, i + 10000));
    // 200 — принято, 202 — принято, ключ ещё проверяется; 403 — ключ не найден на сайте; 422 — адреса не с этого домена
    console.log(`IndexNow: HTTP ${r.status}${r.text ? ' ' + r.text.slice(0, 300) : ''}`);
    if (r.status >= 300) process.exitCode = 1;
  }
})().catch(e => { console.error(e.message); process.exit(1); });
