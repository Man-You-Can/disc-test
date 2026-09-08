#!/usr/bin/env node
// Вливает фрагмент (новые или изменённые ключи) в локаль и приводит порядок ключей к эталону ru.json.
// Запуск: node scripts/merge-locale.js <фрагмент.json> <язык>
//   Строки и массивы из фрагмента заменяют существующие; content.faq.items — дополняются (повторные вливания дубли не создают);
//   новые ключи ui встают после последнего ключа своей группы (nav.*, pages.*, …), новые группы — перед root.*;
//   остальные новые ключи добавляются в конец родительского объекта. Файл записывается через format-locale.js.
const fs = require('fs'), path = require('path');
const format = require('./format-locale.js');
const dir = path.join(__dirname, '..', 'src', 'locales');
const [fragFile, code] = process.argv.slice(2);
if (!fragFile || !code) { console.error('usage: merge-locale.js <fragment.json> <lang>'); process.exit(2); }
const frag = JSON.parse(fs.readFileSync(fragFile, 'utf8'));
const file = path.join(dir, code + '.json');
const L = JSON.parse(fs.readFileSync(file, 'utf8'));
const APPEND = new Set(['content.faq.items']);
function insertUi(target, k, v) {
  const group = k.includes('.') ? k.split('.')[0] : '';
  const keys = Object.keys(target);
  let at = -1;
  keys.forEach((x, i) => { if ((x.includes('.') ? x.split('.')[0] : '') === group) at = i; });
  if (at < 0) { at = keys.findIndex(x => x.startsWith('root.')); at = at < 0 ? keys.length : at - 1; }
  const out = {}; keys.forEach((x, i) => { out[x] = target[x]; if (i === at) out[k] = v; });
  if (!(k in out)) out[k] = v;
  return out;
}
function merge(target, src, p) {
  for (const k of Object.keys(src)) {
    const path2 = p ? p + '.' + k : k, sv = src[k];
    if (!(k in target)) { if (p === 'ui') { const t = insertUi(target, k, sv); for (const x of Object.keys(target)) delete target[x]; Object.assign(target, t); } else target[k] = sv; continue; }
    const tv = target[k];
    if (Array.isArray(sv) && Array.isArray(tv) && APPEND.has(path2)) { // повторное вливание того же фрагмента не должно плодить дубли
      const have = new Set(tv.map(x => JSON.stringify(x))); target[k] = tv.concat(sv.filter(x => !have.has(JSON.stringify(x)))); }
    else if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) merge(tv, sv, path2);
    else target[k] = sv;
  }
}
function reorder(obj, ref) {
  if (Array.isArray(obj)) return Array.isArray(ref) ? obj.map((x, i) => reorder(x, ref[Math.min(i, ref.length - 1)])) : obj;
  if (obj && typeof obj === 'object') {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return obj;
    const out = {};
    for (const k of Object.keys(ref)) if (k in obj) out[k] = reorder(obj[k], ref[k]);
    for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
    return out;
  }
  return obj;
}
merge(L, frag, '');
const result = code === 'ru' ? L : reorder(L, JSON.parse(fs.readFileSync(path.join(dir, 'ru.json'), 'utf8')));
fs.writeFileSync(file, format(result));
console.log('merged ' + path.basename(fragFile) + ' → ' + code + '.json');
