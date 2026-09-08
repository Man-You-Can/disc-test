#!/usr/bin/env node
// Подрезает слишком длинные meta description: отбрасывает последнее предложение, пока строка длиннее предела
// и пока в остатке не меньше MIN символов: слишком короткое описание тратит место в выдаче впустую. Поисковики обрезают описания примерно на 160 символах
// (для японского и китайского — около 95), и обрезанный на полуслове текст выглядит хуже целого.
// Запуск: node scripts/trim-descriptions.js [--write] [язык …]
const fs = require('fs'), path = require('path');
const format = require('./format-locale.js');
const dir = path.join(__dirname, '..', 'locales'), LOC = path.join(__dirname, '..', 'src', 'locales');
const args = process.argv.slice(2), write = args.includes('--write');
const langs = args.filter(a => a !== '--write');
const MAX = { ja: 95, zh: 95 }, DEFAULT_MAX = 170, MIN = { ja: 45, zh: 45 }, DEFAULT_MIN = 120;
const files = (langs.length ? langs : fs.readdirSync(LOC).map(f => path.basename(f, '.json'))).sort();
let changed = 0;
for (const code of files) {
  const file = path.join(LOC, code + '.json'), L = JSON.parse(fs.readFileSync(file, 'utf8'));
  const max = MAX[code] || DEFAULT_MAX, min = MIN[code] || DEFAULT_MIN;
  const trim = s => { let out = s;
    while (out.length > max) {
      const parts = out.split(/(?<=[.!?。।؟])\s*/).filter(Boolean);
      if (parts.length < 2) break;
      const shorter = parts.slice(0, -1).join(' ').trim();
      if (shorter.length < min) break;
      out = shorter;
    }
    return out; };
  const set = [];
  for (const k of Object.keys(L.content || {})) if (typeof L.content[k].description === 'string') set.push([`content.${k}`, () => L.content[k].description, v => L.content[k].description = v]);
  for (const k of Object.keys(L.ui)) if (/^pages\..*\.description$/.test(k)) set.push([`ui.${k}`, () => L.ui[k], v => L.ui[k] = v]);
  for (const [name, get, put] of set) {
    const before = get(), after = trim(before);
    if (after !== before) { changed++; console.log(`${code} ${name}: ${before.length} → ${after.length}`); if (write) put(after); }
  }
  if (write) fs.writeFileSync(file, format(L));
}
console.log(changed ? `${changed} описаний ${write ? 'подрезано' : 'будет подрезано (запустите с --write)'}` : 'все описания в пределах лимита');
