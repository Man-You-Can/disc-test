#!/usr/bin/env node
/*
 * Уборка копий, которые создаёт синхронизация Рабочего стола с iCloud («index 2.html», «sitemap-zh 5.xml», «.git/index 9»).
 * Папка проекта лежит на Рабочем столе, и iCloud при одновременной записи (сборка, git) оставляет второй файл с цифрой в имени.
 * Решение заказчика от 2026-10-24: папку из iCloud не выводить, копии убирать этим сценарием.
 *
 *   node scripts/clean-icloud-dups.js          — только показать, сколько копий и где (ничего не трогает)
 *   node scripts/clean-icloud-dups.js --trash  — перенести копии в Корзину (/usr/bin/trash; вернуть можно из Finder)
 *
 * Копией считается «имя N.расш» или «имя N» (N — 2…99), рядом с которой есть оригинал «имя.расш». Не трогает:
 * файлы без оригинала рядом, файлы, которые хранит git (любой из репозиториев проекта), node_modules и папки *.nosync.
 * Внутри .git копии («index 2», «ORIG_HEAD 3») git не читает — они тоже уходят в Корзину.
 */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), TRASH = process.argv.includes('--trash');
const DUP = /^(.*) ([2-9]|[1-9]\d)(\.[^./]+)?$/;

const found = [];
(function walk(dir) {
  let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of list) {
    const p = path.join(dir, e.name), m = DUP.exec(e.name);
    if (m) { const base = path.join(dir, m[1] + (m[3] || '')); if (exists(base)) { found.push(p); continue; } }
    if (e.isDirectory() && !e.isSymbolicLink() && e.name !== 'node_modules' && !e.name.endsWith('.nosync')) walk(p);
  }
})(ROOT);
function exists(p) { try { fs.lstatSync(p); return true; } catch (e) { return false; } }

// файлы, которые хранит git: в основном репозитории, в рабочих копиях и во вложенных репозиториях (private/server, private/extended-report)
const tracked = new Set();
for (const repo of [ROOT].concat(dirs(path.join(ROOT, '.claude', 'worktrees')), [path.join(ROOT, 'private', 'server'), path.join(ROOT, 'private', 'extended-report')])) {
  if (!exists(path.join(repo, '.git'))) continue;
  try { execFileSync('git', ['-C', repo, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean).forEach(f => tracked.add(path.join(repo, f))); }
  catch (e) { console.error('git ls-files не прочитан: ' + repo); }
}
function dirs(d) { try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => path.join(d, e.name)); } catch (e) { return []; } }

const keep = found.filter(p => tracked.has(p)), go = found.filter(p => !tracked.has(p));
const area = p => { const s = path.relative(ROOT, p).split(path.sep); return s[0] === '.claude' ? s.slice(0, 3).join('/') : s[0] === 'private' ? s.slice(0, 2).join('/') : s[0]; };
const by = {}; go.forEach(p => { by[area(p)] = (by[area(p)] || 0) + 1; });
Object.keys(by).sort().forEach(k => console.log(String(by[k]).padStart(6) + '  ' + k));
console.log('Копий: ' + go.length + (keep.length ? '; оставлены (их хранит git): ' + keep.length : ''));
keep.forEach(p => console.log('  оставлен: ' + path.relative(ROOT, p)));
if (!TRASH) { if (go.length) console.log('Перенести в Корзину: node scripts/clean-icloud-dups.js --trash'); process.exit(0); }
for (let i = 0; i < go.length; i += 200) execFileSync('/usr/bin/trash', go.slice(i, i + 200), { stdio: ['ignore', 'ignore', 'inherit'] });
const left = go.filter(exists);
console.log(left.length ? 'Не перенесено: ' + left.length : 'Перенесено в Корзину: ' + go.length);
process.exit(left.length ? 1 : 0);
