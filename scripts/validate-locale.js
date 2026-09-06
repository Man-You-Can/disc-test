#!/usr/bin/env node
// Проверяет, что локаль структурно совпадает с эталоном (ru.json):
// те же ключи, те же длины массивов, те же плейсхолдеры {n}/{date}/… и HTML-теги.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'src', 'locales');
const ref = JSON.parse(fs.readFileSync(path.join(dir, 'ru.json'), 'utf8'));
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'ru.json');
let failed = 0;
function ph(s){ return (String(s).match(/\{[a-z]+\}|<\/?b>|<br>|%/g) || []).sort().join(' '); }
function walk(a, b, p, errs){
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return errs.push(p + ': expected array');
    if (a.length !== b.length) return errs.push(p + ': array length ' + b.length + ', expected ' + a.length);
    a.forEach((x, i) => walk(x, b[i], p + '[' + i + ']', errs));
  } else if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return errs.push(p + ': expected object');
    for (const k of Object.keys(a)) { if (!(k in b)) errs.push(p + '.' + k + ': missing'); else walk(a[k], b[k], p + '.' + k, errs); }
    for (const k of Object.keys(b)) if (!(k in a)) errs.push(p + '.' + k + ': unexpected key');
  } else if (typeof a === 'string') {
    if (typeof b !== 'string') return errs.push(p + ': expected string');
    if (!b.trim()) errs.push(p + ': empty');
    if (p !== '.lang' && p !== '.dir' && p !== '.name' && p !== '.dateLocale' && ph(a) !== ph(b)) errs.push(p + ': placeholders/tags differ (expected "' + ph(a) + '", got "' + ph(b) + '")');
  }
}
for (const f of files) {
  const file = path.isAbsolute(f) ? f : path.join(dir, path.basename(f));
  let j; const errs = [];
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log('✗ ' + path.basename(file) + ': invalid JSON — ' + e.message); failed++; continue; }
  walk(ref, j, '', errs);
  const code = path.basename(file, '.json');
  if (j.lang !== code) errs.push('.lang must be "' + code + '"');
  if (j.dir !== 'ltr' && j.dir !== 'rtl') errs.push('.dir must be ltr|rtl');
  if (!/^[A-Z]{2,3}$/.test(String(j.name).slice(0, 0) + 'XX')) {}
  // В каждом блоке ровно 4 разных текста
  (j.blocks || []).forEach((b, i) => { const v = Object.values(b || {}); if (new Set(v).size !== v.length) errs.push('.blocks[' + i + ']: duplicate statements'); });
  // Буквы D I S C не переведены в csvHead
  const h = (j.ui && j.ui['admin.csvHead']) || []; ['D','I','S','C'].forEach((k, i) => { if (h[5 + i] !== k) errs.push('.ui.admin.csvHead[' + (5 + i) + '] must be "' + k + '"'); });
  if (errs.length) { failed++; console.log('✗ ' + code + ' (' + errs.length + ' problems)'); errs.slice(0, 40).forEach(e => console.log('   ' + e)); }
  else console.log('✓ ' + code + ' OK');
}
process.exit(failed ? 1 : 0);
