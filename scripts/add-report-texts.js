#!/usr/bin/env node
// Вставляет в локаль тексты платной услуги: страницу расширенного отчёта, оферту, условия возврата, раздел о данных покупателя,
// абзац со ссылками на странице «Услуги» и ссылку «Оферта». Локаль правится как текст: новые разделы встают на места по эталону (ru.json),
// остальные строки файла не трогаются (JSON.stringify всей локали раздувает diff).
// Запуск: node scripts/add-report-texts.js <фрагмент.json> <язык>
// Фрагмент: { "privacyPurchase": {h, p}, "policyPurchase": {h, p}, "servicesDocs": "...", "offer": {...}, "refund": {...}, "product": {...},
//             "navOffer": "...", "replace": [["ключ", "прежнее значение", "новое значение"], ...] }
// replace — точечная замена значения существующей строки (ключ и прежнее значение должны встретиться в файле ровно один раз).
const fs = require('fs'), path = require('path');
const [fragFile, lang] = process.argv.slice(2);
if (!fragFile || !lang) { console.error('Запуск: node scripts/add-report-texts.js <фрагмент.json> <язык>'); process.exit(1); }
const file = path.join(__dirname, '..', 'src', 'locales', lang + '.json');
const F = JSON.parse(fs.readFileSync(fragFile, 'utf8'));
let s = fs.readFileSync(file, 'utf8');
const before = JSON.parse(s);

// значение в принятом в локалях виде: отступ два пробела, короткие списки строк и пары — в одну строку
function fmt(v, ind) {
  const pad = ' '.repeat(ind);
  if (Array.isArray(v)) {
    const flat = v.every(x => typeof x === 'string' || typeof x === 'number'), one = '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
    if (flat && (one.length + ind <= 150 || v.length === 1)) return one;
    return '[\n' + v.map(x => pad + '  ' + fmt(x, ind + 2)).join(',\n') + '\n' + pad + ']';
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v), one = '{ ' + keys.map(k => JSON.stringify(k) + ': ' + JSON.stringify(v[k])).join(', ') + ' }';
    if (keys.length === 2 && keys[0] === 'q' && keys[1] === 'a') return one;
    return '{\n' + keys.map(k => pad + '  ' + JSON.stringify(k) + ': ' + fmt(v[k], ind + 2)).join(',\n') + '\n' + pad + '}';
  }
  return JSON.stringify(v);
}
function once(a, b, what) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(lang + ': ' + what + ' — место вставки найдено ' + n + ' раз(а), нужно ровно одно');
  s = s.replace(a, () => b);
}
const C = before.content;
// точечные замены — до вставки новых разделов: в них встречаются те же ключи (price, description)
for (const [key, from, to] of F.replace || []) {
  const a = JSON.stringify(key) + ': ' + JSON.stringify(from);
  if (!s.includes(a) && s.includes(JSON.stringify(key) + ': ' + JSON.stringify(to))) continue;   // уже заменено
  once(a, JSON.stringify(key) + ': ' + JSON.stringify(to), 'replace ' + key);
}
// раздел о данных покупателя: в прежней «Конфиденциальности» и в политике — последним ключом раздела
if (F.privacyPurchase && !C.privacy.purchase) once('\n      ]\n    },\n    "policy": {', '\n      ],\n      "purchase": ' + fmt(F.privacyPurchase, 6) + '\n    },\n    "policy": {', 'privacy.purchase');
if (F.policyPurchase && !C.policy.purchase) once('\n      ]\n    },\n    "consentDoc": {', '\n      ],\n      "purchase": ' + fmt(F.policyPurchase, 6) + '\n    },\n    "consentDoc": {', 'policy.purchase');
if (F.servicesDocs && !C.services.docs) {
  const m = /\n      "currency": "[A-Z]{3}",\n/.exec(s);
  if (!m) throw new Error(lang + ': services.currency не найден');
  once(m[0], m[0] + '      "docs": ' + JSON.stringify(F.servicesDocs) + ',\n', 'services.docs');
}
const blocks = ['offer', 'refund', 'product'].filter(k => F[k] && !C[k]);
if (blocks.length) {
  // разделы встают после «Услуг», перед «Обратной связью» (как в эталоне)
  const m = /\n    \},\n    "contact": \{/.exec(s);
  if (!m) throw new Error(lang + ': content.contact не найден');
  once(m[0], '\n    },\n' + blocks.map(k => '    ' + JSON.stringify(k) + ': ' + fmt(F[k], 4) + ',').join('\n') + '\n    "contact": {', 'offer/refund/product');
}
if (F.navOffer && !before.ui['nav.offer']) {
  const m = /\n    "nav\.services": "[^\n]*",\n/.exec(s);
  if (!m) throw new Error(lang + ': ui["nav.services"] не найден');
  once(m[0], m[0] + '    "nav.offer": ' + JSON.stringify(F.navOffer) + ',\n', 'nav.offer');
}
const after = JSON.parse(s);   // файл остался корректным JSON
fs.writeFileSync(file, s);
console.log(lang + ': вставлено — ' + [C.privacy.purchase ? '' : 'privacy.purchase', C.policy.purchase ? '' : 'policy.purchase', C.services.docs ? '' : 'services.docs'].concat(blocks, before.ui['nav.offer'] ? [] : ['nav.offer']).filter(Boolean).join(', ') +
  '; замен: ' + (F.replace || []).length + '; ключей content: ' + Object.keys(before.content).length + ' → ' + Object.keys(after.content).length);
