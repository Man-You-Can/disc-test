#!/usr/bin/env node
// Проверяет, что локаль структурно совпадает с эталоном (ru.json):
// те же ключи, те же длины массивов, те же плейсхолдеры {n}/{date}/… и HTML-теги.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'src', 'locales');
const ref = JSON.parse(fs.readFileSync(path.join(dir, 'ru.json'), 'utf8'));
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'ru.json');
// Разделы, которые есть не во всех языках: в эталоне они есть, в остальных локалях могут отсутствовать. Если раздел в локали есть — проверяется как обычно.
// Это всё, что означает «расширенный отчёт на этом языке написан и продаётся»: письмо покупателю (extendedMail), покупка (product.pay: по этому ключу
// при включённом payEndpoint появляется кнопка «Купить», а сервер оплаты принимает заказы), листы образца и подписи к ним (product.sample*, block.sample,
// pdf.sheets), личные зацепки, закреплённая кнопка и строка вернувшемуся посетителю (product.promo — только там, где отчёт продаётся) —
// и полный текст политики по российскому закону (policy.legal).
// Оферта, условия возврата, страница отчёта, раздел о данных покупателя и ссылка «Оферта» обязательны во всех языках.
const OPTIONAL = ['.content.policy.legal', '.content.extendedMail', '.content.product.pay', '.content.product.sampleTitle', '.content.product.sampleNote', '.content.product.sampleAlt',
  '.content.product.sampleCaption', '.content.product.block.sample', '.content.product.pdf.sheets', '.content.product.promo'];
// Ключи, которых в эталоне нет, а в остальных локалях они допустимы: оговорка о переводе в оферте и условиях возврата (при расхождении действует
// русский текст) и строка о заявке в блоке расширенного отчёта (отчёт на этом языке пока нельзя заказать). Их обязательность — в проверке ниже.
const EXTRA = ['.content.offer.note', '.content.refund.note', '.content.product.block.soon'];
let failed = 0;
function ph(s){ return (String(s).match(/\{[a-z]+\}|<\/?b>|<br>|%/g) || []).sort().join(' '); }
function walk(a, b, p, errs){
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return errs.push(p + ': expected array');
    if (a.length !== b.length) return errs.push(p + ': array length ' + b.length + ', expected ' + a.length);
    a.forEach((x, i) => walk(x, b[i], p + '[' + i + ']', errs));
  } else if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return errs.push(p + ': expected object');
    for (const k of Object.keys(a)) { if (!(k in b)) { if (!OPTIONAL.includes(p + '.' + k)) errs.push(p + '.' + k + ': missing'); } else walk(a[k], b[k], p + '.' + k, errs); }
    for (const k of Object.keys(b)) if (!(k in a)) { if (!EXTRA.includes(p + '.' + k)) errs.push(p + '.' + k + ': unexpected key'); else if (typeof b[k] !== 'string' || !b[k].trim()) errs.push(p + '.' + k + ': empty'); }
  } else if (typeof a === 'string') {
    if (typeof b !== 'string') return errs.push(p + ': expected string');
    if (!b.trim() && a.trim()) errs.push(p + ': empty');   // пустая строка допустима там, где она пустая и в эталоне (угол таблицы сравнения)
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
  // Расширенный отчёт: перевод оферты и условий возврата несёт оговорку со ссылкой на русский текст; где отчёт не продаётся (нет product.pay),
  // блок обязан говорить о заявке; листы образца — либо все ключи, либо ни одного; покупка и письмо покупателю появляются только вместе
  const C = j.content || {}, P = C.product || {}, B = P.block || {};
  for (const d of ['offer', 'refund']) if (C[d] && !/\{original\}/.test(String(C[d].note || ''))) errs.push('.content.' + d + '.note: missing or without {original}');
  if (C.product && !P.pay && !B.soon) errs.push('.content.product.block.soon: missing (no product.pay — the report is not on sale in this language)');
  if (P.pay && B.soon) errs.push('.content.product.block.soon: must be removed once product.pay is present');
  const sm = [P.sampleTitle, P.sampleNote, P.sampleAlt, P.sampleCaption, B.sample, P.pdf && P.pdf.sheets].filter(x => x != null).length;
  if (sm && sm < 6) errs.push('.content.product: sample keys must come together (sampleTitle, sampleNote, sampleAlt, sampleCaption, block.sample, pdf.sheets)');
  if (!!P.pay !== !!C.extendedMail) errs.push('.content.product.pay and .content.extendedMail must come together');
  if (P.promo && !P.pay) errs.push('.content.product.promo: only where the report is on sale (needs product.pay)');
  // Правило заказчика от 2026-10-14: всё, что сделано для продажи в русской версии, применяется в языке вместе с покупкой
  if (P.pay && !P.promo) errs.push('.content.product.promo: missing — the report is on sale in this language, so everything done for sales in the Russian version applies here (CLAUDE.md)');
  // В каждом блоке ровно 4 разных текста
  (j.blocks || []).forEach((b, i) => { const v = Object.values(b || {}); if (new Set(v).size !== v.length) errs.push('.blocks[' + i + ']: duplicate statements'); });
  // Буквы D I S C не переведены в csvHead
  const h = (j.ui && j.ui['admin.csvHead']) || []; ['D','I','S','C'].forEach((k, i) => { if (h[5 + i] !== k) errs.push('.ui.admin.csvHead[' + (5 + i) + '] must be "' + k + '"'); });
  if (errs.length) { failed++; console.log('✗ ' + code + ' (' + errs.length + ' problems)'); errs.slice(0, 40).forEach(e => console.log('   ' + e)); }
  else console.log('✓ ' + code + ' OK');
}
process.exit(failed ? 1 : 0);
