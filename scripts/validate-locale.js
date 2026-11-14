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
  '.content.product.sampleCaption', '.content.product.block.sample', '.content.product.pdf.sheets', '.content.product.promo',
  // тексты блока «Расширенный отчёт» на экране результата и в карточке вернувшегося посетителя («Чего нет в бесплатном отчёте, но есть в расширенном»,
  // с 2026-10-26): только где отчёт продаётся; обязательность — в проверке ниже
  '.content.product.block.screen',
  // Для организаций (с 2026-10-22 в русской версии, с 2026-11-12 — во всех языках с покупкой): страница «Для организаций» и её пункт в подвале,
  // поле кода доступа в форме покупки и письмо получателю отчёта по коду. Обязательны вместе с product.pay (правило «что сделано для продажи —
  // во все языки с покупкой»; проверка ниже)
  '.content.business', '.ui.nav.business', '.content.product.pay.code', '.content.extendedMail.codeIntro', '.content.extendedMail.codeFooter',
  // пункты оферты и абзац политики о кодах — там, где коды есть (с 2026-11-12 — во всех языках с покупкой)
  '.content.offer.codeTerms', '.content.policy.purchaseCode',
  // лендинг «CV и сопроводительное письмо под каждую вакансию» (/ru/cv/, с 2026-10-22, решение заказчика): только русская версия, ссылка только прямая
  '.content.cv',
  // подарочные сертификаты на расширенный отчёт (/<язык>/gift/, с 2026-11-14, по просьбе заказчика): там, где отчёт продаётся; обязательность — в проверке ниже
  '.content.gift', '.ui.nav.gift', '.content.policy.purchaseGift',
  // английская версия лендинга (с 2026-10-24): автор без ссылки на личный сайт — блок .cvsite не выводится
  '.content.cv.author.siteLabel', '.content.cv.author.site', '.content.cv.author.siteUrl',
  // анонсы этого сервиса на сайте (главная, экран результата, профили, «Услуги»; с 2026-10-24, по просьбе заказчика; русская и английская версии) — только вместе с лендингом
  '.content.cvPromo',
  '.content.paper', '.content.kit', '.content.consentDoc.paperForm',   // бумажный бланк: QR, «Что дальше», блок для групп, бланк на e-mail; набор ведущего (с 2026-10-25, пока русская версия)
  // покупка набора ведущего (с 2026-11-06): оплата по счёту для организации — только в русской версии (вне России счетов нет)
  '.content.kit.buy.invoice',
  // письмо подписчикам с призывом купить расширенный отчёт (content.mailing.promo, с 2026-10-25): только где отчёт продаётся; обязательность — в проверке ниже.
  // Где ключ есть, он полный (сверка с ru)
  '.content.mailing'];
// специальная цена на час после теста (product.pay.offer; offerPriceRub, offerPriceUsd в site.config.json; с 2026-10-22) обязательна вместе с product.pay:
// её тексты сравниваются с ru.json как часть pay
// Страница «Как готовятся отчёты» (content.howMade) и её пункт в шапке (ui["nav.howMade"]) обязательны во всех языках (с 2026-10-14).
// Ключи, которых в эталоне нет, а в остальных локалях они допустимы: оговорка о переводе в оферте и условиях возврата (при расхождении действует
// русский текст) и строка о заявке в блоке расширенного отчёта (отчёт на этом языке пока нельзя заказать). Их обязательность — в проверке ниже.
// строка под «Купить» о странице оплаты Prodamus (на английском, в долларах или евро; с 2026-10-26) — только в языках, которые платят через Prodamus
// (в русском оплата через Т-Банк на русском — ключа нет)
const EXTRA = ['.content.offer.note', '.content.refund.note', '.content.product.block.soon', '.content.product.pay.payPage'];
// Лендинг /cv/ на других языках (с 2026-10-24): язык строки сравнения в блоке языков (без ключа — en) и начало имени файлов готового резюме
// (cvFile.file; пустая строка — файлов нет, кнопки неактивны)
const EXTRA_RE = [/^\.content\.cv\.english\.compare\[\d+\]\.lang$/, /^\.content\.cv\.example\.profile\.cvFile\.file$/];
// Пустая строка вместо имени файла примера на лендинге /cv/ — файлы на этом языке не готовы, кнопка скачивания неактивна
const EMPTY_OK = [/^\.content\.cv\..*\.f$/, /^\.content\.cv\.example\.profile\.cvFile\.file$/];
let failed = 0;
// лендинг /cv/ и анонсы сервиса: знак % — часть текста о скидке (в языках скидки разные, с 2026-10-24), а не подстановка — в content.cv и content.cvPromo не сравнивается
function phOf(s, p){ const x = ph(s); return p.startsWith('.content.cv.') || p.startsWith('.content.cvPromo.') ? x.split(' ').filter(t => t !== '%').join(' ') : x; }
function ph(s){ return (String(s).match(/\{[a-z]+\}|<\/?b>|<br>|%/g) || []).sort().join(' '); }
// языки ЕС без зачёркнутой цены распродажи (content.mailing.sale.plain, с 2026-11-12): в этих строках нет {price} — сравнения с обычной ценой
const PLAIN_KEYS = ['.content.mailing.sale.preheader', '.content.mailing.sale.until', '.content.mailing.sale.remindPreheader', '.content.mailing.sale.remindIntro', '.content.product.pay.sale.note'];
let PLAIN = false;
function walk(a, b, p, errs){
  // формы слова по числу у подарочных сертификатов (с 2026-11-14): категории Intl.PluralRules своего языка ({one, other}, {other}, {zero, one, two, few, many, other}…), обязательна other
  if (/^\.content\.gift\.(order|mail)\.units$/.test(p)) { if (!b || typeof b !== 'object' || typeof b.other !== 'string' || !b.other.trim()) errs.push(p + ': needs an object of plural forms with "other"'); return; }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return errs.push(p + ': expected array');
    if (a.length !== b.length) return errs.push(p + ': array length ' + b.length + ', expected ' + a.length);
    a.forEach((x, i) => walk(x, b[i], p + '[' + i + ']', errs));
  } else if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return errs.push(p + ': expected object');
    for (const k of Object.keys(a)) { if (!(k in b)) { if (!OPTIONAL.includes(p + '.' + k)) errs.push(p + '.' + k + ': missing'); } else walk(a[k], b[k], p + '.' + k, errs); }
    for (const k of Object.keys(b)) if (!(k in a)) { if (p + '.' + k === '.content.mailing.sale.plain') { if (b[k] !== true) errs.push(p + '.' + k + ': only true'); continue; }
      if (!EXTRA.includes(p + '.' + k) && !EXTRA_RE.some(r => r.test(p + '.' + k))) errs.push(p + '.' + k + ': unexpected key'); else if (typeof b[k] !== 'string' || (!b[k].trim() && !EMPTY_OK.some(r => r.test(p + '.' + k)))) errs.push(p + '.' + k + ': empty'); }
  } else if (typeof a === 'string') {
    if (typeof b !== 'string') return errs.push(p + ': expected string');
    if (!b.trim() && a.trim() && !EMPTY_OK.some(r => r.test(p))) errs.push(p + ': empty');   // пустая строка допустима там, где она пустая и в эталоне (угол таблицы сравнения)
    if (p !== '.lang' && p !== '.dir' && p !== '.name' && p !== '.dateLocale' && phOf(a, p) !== phOf(b, p) && !(PLAIN && PLAIN_KEYS.includes(p) && phOf(a, p).replace(/\{price\} ?/, '').trim() === phOf(b, p))) errs.push(p + ': placeholders/tags differ (expected "' + ph(a) + '", got "' + ph(b) + '")');
  }
}
for (const f of files) {
  const file = path.isAbsolute(f) ? f : path.join(dir, path.basename(f));
  let j; const errs = [];
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log('✗ ' + path.basename(file) + ': invalid JSON — ' + e.message); failed++; continue; }
  PLAIN = !!(j.content && j.content.mailing && j.content.mailing.sale && j.content.mailing.sale.plain);
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
  if (P.pay && P.pay.offer && !['regular', 'cta', 'note', 'left', 'expired'].every(k => typeof P.pay.offer[k] === 'string' && P.pay.offer[k]) ) errs.push('.content.product.pay.offer: needs regular, cta, note, left and expired');
  if (C.mailing && !P.pay) errs.push('.content.mailing: only where the report is on sale (needs product.pay)');
  if (P.pay && P.pay.payPage != null && !(typeof P.pay.payPage === 'string' && P.pay.payPage)) errs.push('.content.product.pay.payPage: must be a non-empty string');
  if (P.promo && !P.pay) errs.push('.content.product.promo: only where the report is on sale (needs product.pay)');
  if (B.screen && !P.pay) errs.push('.content.product.block.screen: only where the report is on sale (needs product.pay)');
  if (P.pay && !B.screen) errs.push('.content.product.block.screen: missing — the report is on sale in this language, so the result-screen block goes with it (CLAUDE.md)');
  if (B.screen && !(Array.isArray(B.screen.only) && B.screen.only.length && B.screen.only.every(x => Array.isArray(x) && x.length === 2 && x.every(y => typeof y === 'string' && y)))) errs.push('.content.product.block.screen.only: needs [start, explanation] pairs');
  if (B.screen && typeof B.screen.nameLower !== 'boolean') errs.push('.content.product.block.screen.nameLower: must be true or false');
  // Правило заказчика от 2026-10-14: всё, что сделано для продажи в русской версии, применяется в языке вместе с покупкой
  if (P.pay && !P.promo) errs.push('.content.product.promo: missing — the report is on sale in this language, so everything done for sales in the Russian version applies here (CLAUDE.md)');
  // письмо подписчикам о расширенном отчёте (с 2026-10-25, во всех языках с покупкой) — по этому же правилу
  if (P.pay && !(C.mailing && C.mailing.promo)) errs.push('.content.mailing.promo: missing — the report is on sale in this language, so the subscriber mail goes with it (CLAUDE.md)');
  // распродажа для подписчиков (с 2026-11-08, private/server/src/sale.js): письмо и напоминание (mailing.sale) и плашка формы покупки (product.pay.sale) — по этому же правилу
  if (P.pay && !(C.mailing && C.mailing.sale)) errs.push('.content.mailing.sale: missing — the report is on sale in this language, so the sale mail goes with it (CLAUDE.md)');
  if (P.pay && !P.pay.sale) errs.push('.content.product.pay.sale: missing — the report is on sale in this language, so the sale plate goes with it (CLAUDE.md)');
  if (P.pay && P.pay.sale && !['cta', 'note', 'expired'].every(k => typeof P.pay.sale[k] === 'string' && P.pay.sale[k])) errs.push('.content.product.pay.sale: needs cta, note and expired');
  if (P.pay && P.pay.sale && !/\{salePrice\}/.test(P.pay.sale.cta)) errs.push('.content.product.pay.sale.cta: needs {salePrice}');
  if (P.pay && P.pay.sale && !/\{day\}/.test(P.pay.sale.note)) errs.push('.content.product.pay.sale.note: needs {day}');
  const MS = C.mailing && C.mailing.sale;
  // с 2026-11-12: повод не вписан в тексты — {occasion} из настроек распродажи (названия — occasions, ключи bf и sale обязательны), две темы письма (subject, subjectB)
  if (P.pay && P.pay.sale && !/\{occasion\}/.test(P.pay.sale.cta)) errs.push('.content.product.pay.sale.cta: needs {occasion} (the sale name comes from the panel)');
  if (MS && !(MS.occasions && ['bf', 'sale'].every(k => typeof MS.occasions[k] === 'string' && MS.occasions[k]))) errs.push('.content.mailing.sale.occasions: needs names for bf and sale');
  if (MS) for (const k of ['subject', 'subjectNoName', 'subjectB', 'subjectBNoName', 'preheader', 'intro', 'until', 'remindSubject', 'remindSubjectNoName', 'remindPreheader', 'remindIntro'])
    if (typeof MS[k] !== 'string' || !MS[k]) errs.push('.content.mailing.sale.' + k + ': missing');
  if (MS) for (const k of ['subject', 'subjectNoName', 'preheader', 'remindSubject', 'remindSubjectNoName']) if (!/\{occasion\}/.test(String(MS[k] || ''))) errs.push('.content.mailing.sale.' + k + ': needs {occasion}');
  if (MS) for (const k of ['subjectB', 'subjectBNoName']) if (!/\{k\}/.test(String(MS[k] || '')) || !/\{pct\}/.test(String(MS[k] || ''))) errs.push('.content.mailing.sale.' + k + ': needs {k} and {pct} (the lowest scale)');
  if (MS) for (const k of ['preheader', 'until', 'remindPreheader', 'remindIntro']) if (!/\{salePrice\}|\{day\}/.test(String(MS[k] || ''))) errs.push('.content.mailing.sale.' + k + ': expected {salePrice} or {day}');
  if (MS && /11\.11|11\/11|双11|雙11/.test(JSON.stringify(MS) + JSON.stringify(P.pay && P.pay.sale || ''))) errs.push('.content.mailing.sale / product.pay.sale: no sale date in the texts — it comes from the panel ({occasion}, {day})');
  // языки ЕС без зачёркнутой цены (plain): тексты не сравнивают с обычной ценой
  if (MS && MS.plain) for (const k of ['preheader', 'until', 'remindPreheader', 'remindIntro']) if (/\{price\}/.test(String(MS[k] || ''))) errs.push('.content.mailing.sale.' + k + ': plain price — no {price} to compare with');
  if (MS && code !== 'ru' && /Моск|Moscow|Russia|Росси/i.test(JSON.stringify(MS))) errs.push('.content.mailing.sale: non-Russian versions do not name Russia or Moscow time (CLAUDE.md)');
  // «Для организаций»: страница и пункт в подвале — вместе; продаются коды доступа, поэтому нужны поле кода в покупке и письмо по коду
  // бумажный бланк и набор ведущего (с 2026-10-25): появляются в языке только вместе — QR-коды бланка ведут на набор, письмо с бланком — тоже
  if (!!C.kit !== !!C.paper) errs.push('.content.kit and .content.paper must come together (the blank links to the kit)');
  if (C.paper && !(C.consentDoc && C.consentDoc.paperForm)) errs.push('.content.paper: needs .content.consentDoc.paperForm (the consent text must describe the "blank by e-mail" form)');
  if (!!C.group !== !!(j.ui && j.ui['nav.group'])) errs.push('.content.group and .ui["nav.group"] must come together (the footer links to the page)');
  if (C.cvPromo && !C.cv) errs.push('.content.cvPromo: needs .content.cv (the blocks link to the /cv/ landing)');
  if (!!C.business !== !!(j.ui && j.ui['nav.business'])) errs.push('.content.business and .ui["nav.business"] must come together');
  if (C.business && !(P.pay && P.pay.code)) errs.push('.content.business: needs .content.product.pay.code (people redeem the codes in the purchase form)');
  if (P.pay && P.pay.code && !(C.extendedMail && C.extendedMail.codeIntro && C.extendedMail.codeFooter)) errs.push('.content.product.pay.code: needs .content.extendedMail.codeIntro and codeFooter');
  // с 2026-11-12: страница «Для организаций» и коды доступа — во всех языках, где отчёт продаётся (правило «что сделано для продажи — во все языки с покупкой»)
  if (P.pay && !(C.business && j.ui && j.ui['nav.business'] && P.pay.code)) errs.push('.content.business, .ui["nav.business"], .content.product.pay.code: missing — the report is on sale in this language, so the page for organizations and access codes go with it (CLAUDE.md)');
  if (P.pay && P.pay.code && !(C.offer && C.offer.codeTerms && C.policy && C.policy.purchaseCode)) errs.push('.content.product.pay.code: needs .content.offer.codeTerms and .content.policy.purchaseCode (the offer and the policy must describe codes)');
  // с 2026-11-14: подарочные сертификаты — во всех языках, где отчёт продаётся (правило «что сделано для продажи — во все языки с покупкой»):
  // страница /gift/ и пункт подвала, абзац политики о данных покупателя и получателей; ключ и тексты о данных меняются вместе
  if (P.pay && !(C.gift && j.ui && j.ui['nav.gift'] && C.policy && C.policy.purchaseGift)) errs.push('.content.gift, .ui["nav.gift"], .content.policy.purchaseGift: missing — the report is on sale in this language, so gift certificates must be too');
  if (!!C.gift !== !!(j.ui && j.ui['nav.gift'])) errs.push('.content.gift and .ui["nav.gift"] must come together');
  // В каждом блоке ровно 4 разных текста
  (j.blocks || []).forEach((b, i) => { const v = Object.values(b || {}); if (new Set(v).size !== v.length) errs.push('.blocks[' + i + ']: duplicate statements'); });
  // Буквы D I S C не переведены в csvHead
  const h = (j.ui && j.ui['admin.csvHead']) || []; ['D','I','S','C'].forEach((k, i) => { if (h[5 + i] !== k) errs.push('.ui.admin.csvHead[' + (5 + i) + '] must be "' + k + '"'); });
  if (errs.length) { failed++; console.log('✗ ' + code + ' (' + errs.length + ' problems)'); errs.slice(0, 40).forEach(e => console.log('   ' + e)); }
  else console.log('✓ ' + code + ' OK');
}
process.exit(failed ? 1 : 0);
