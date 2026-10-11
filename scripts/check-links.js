#!/usr/bin/env node
// Проверка внутренних ссылок собранного сайта: каждая ссылка и каждый файл (href, src), которые ведут внутрь сайта,
// должны указывать на существующий файл в docs/. Запуск после сборки: node scripts/check-links.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'docs');
const site = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site.config.json'), 'utf8')).siteUrl.replace(/\/+$/, '');
const pages = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.html')) pages.push(p); } })(root);
let links = 0; const broken = [];
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');   // ссылки, которые собирает скрипт страницы, здесь не проверяются
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    let u = m[1].replace(/&amp;/g, '&');
    if (u.startsWith(site + '/') || u === site) u = u.slice(site.length) || '/';
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u) || u.startsWith('data:')) continue;   // внешние адреса, mailto:, якоря на той же странице
    u = u.split('#')[0].split('?')[0];
    if (!u) continue;
    links++;
    let file = u.startsWith('/') ? path.join(root, u) : path.resolve(path.dirname(page), u);
    try { file = decodeURIComponent(file); } catch (e) {}
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) broken.push(path.relative(root, page) + ' → ' + m[1]);
  }
}
console.log(links + ' внутренних ссылок на ' + pages.length + ' страницах, битых: ' + broken.length);
[...new Set(broken)].slice(0, 40).forEach(b => console.log('  ' + b));
process.exit(broken.length ? 1 : 0);
