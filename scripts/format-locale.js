#!/usr/bin/env node
// Форматирование локали в принятом в проекте стиле: массивы строк и маленькие объекты в одну строку,
// остальное — с отступом в два пробела, пустая строка между группами ключей ui (intro.*, test.*, …).
// Используется скриптом merge-locale.js; можно вызвать и вручную: node scripts/format-locale.js ru
const fs = require('fs'), path = require('path');
const INLINE_MAX = 200, ARRAY_MAX = 400;
const q = s => JSON.stringify(s);
function inlineObj(o) { return '{ ' + Object.keys(o).map(k => q(k) + ': ' + q(o[k])).join(', ') + ' }'; }
function isFlatStrings(o) { return o && typeof o === 'object' && !Array.isArray(o) && Object.values(o).every(v => typeof v === 'string'); }
function fmt(v, ind, key) {
  const pad = '  '.repeat(ind), pad1 = '  '.repeat(ind + 1);
  if (Array.isArray(v)) {
    if (v.every(x => typeof x !== 'object' || x === null)) { const one = '[' + v.map(x => q(x)).join(', ') + ']'; if (one.length <= ARRAY_MAX || v.every(x => typeof x !== 'string' || x.length < 60)) return one; return '[\n' + v.map(x => pad1 + q(x)).join(',\n') + '\n' + pad + ']'; }
    return '[\n' + v.map(x => pad1 + fmt(x, ind + 1)).join(',\n') + '\n' + pad + ']';
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (isFlatStrings(v) && inlineObj(v).length <= INLINE_MAX && key !== 'ui') return inlineObj(v);
    const lines = []; let prevGroup = null;
    keys.forEach((k, i) => {
      if (key === 'ui') { const g = k.includes('.') ? k.split('.')[0] : ''; if (i && g !== prevGroup) lines.push(''); prevGroup = g; }
      lines.push(pad1 + q(k) + ': ' + fmt(v[k], ind + 1, k));
    });
    return '{\n' + lines.map((l, i) => l === '' ? '' : l + (i < lines.length - 1 && lines.slice(i + 1).some(x => x !== '') ? ',' : '')).join('\n') + '\n' + pad + '}';
  }
  return q(v);
}
function format(obj) { return fmt(obj, 0) + '\n'; }
module.exports = format;
if (require.main === module) {
  const dir = path.join(__dirname, '..', 'src', 'locales');
  for (const code of process.argv.slice(2)) {
    const file = path.join(dir, code + '.json');
    fs.writeFileSync(file, format(JSON.parse(fs.readFileSync(file, 'utf8'))));
    console.log('formatted ' + code + '.json');
  }
}
