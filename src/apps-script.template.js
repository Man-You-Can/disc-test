/**
 * Тест DISC — серверная часть на Google Apps Script: письмо участнику с результатом
 * и база результатов в Google Таблице.
 *
 * К письму прикладывается PDF с полным отчётом (ATTACH_PDF): он собирается здесь же из HTML.
 * Письма уходят с адреса SENDER_EMAIL, если он добавлен в Gmail этого аккаунта как «Отправлять
 * письма как»; иначе — с основного адреса аккаунта. Функция setup покажет, какой адрес используется,
 * а testMail пришлёт вам образцы писем с PDF.
 *
 * Файл backend/apps-script/Code.gs генерируется командой `node build.js` из
 * src/apps-script.template.js, site.config.json и локалей. Как развернуть — README.md,
 * раздел «Письмо с результатом и база результатов».
 *
 * На каждый завершённый тест скрипт сначала записывает строку в таблицу (получено,
 * дата теста, имя, e-mail, язык, профиль, баллы, статус письма, ссылка, код), затем
 * отправляет письмо. Повторная отправка того же результата строку не дублирует,
 * а обновляет статус письма. Таблица создаётся сама при первом результате
 * (её ID запоминается в свойствах скрипта); можно указать свою в SHEET_ID.
 *
 * Второй тип запроса — {action: 'contact'} с формы обратной связи (/contact/): письмо с текстом
 * сообщения и вложениями (общим размером до MAX_CONTACT_BYTES) уходит на CONTACT_TO, адрес
 * отправителя подставляется в replyTo; в таблицу такие сообщения не записываются.
 *
 * Рассылка. Если участник отметил в форме согласие ({subscribe: true}), в строке его результата
 * заполняются столбцы «Рассылка» («да»), «Согласие получено», «Текст согласия» (на языке участника) и
 * «Ссылка для отписки», а в письмо с результатом добавляется строка со ссылкой отписки. Запрос
 * {action: 'subscribe'} делает то же без письма (участник отметил согласие уже после отправки),
 * {action: 'unsubscribe', u: код} — отписка со страницы /unsubscribe/: во всех строках с этой ссылкой
 * «да» меняется на «отписка <дата>». Для рассылки берите только строки, где в столбце «Рассылка» стоит «да».
 * Сам скрипт рассылку не отправляет: лимит Gmail (100 писем в сутки) общий с письмами о результатах.
 *
 * Защита от злоупотреблений: токен (совпадает с sendToken в site.config.json),
 * e-mail получателя должен совпадать с e-mail внутри кода результата, письмо
 * собирается только из шаблона (клиент не может передать произвольный текст),
 * лимиты на адрес в час и на день, лимит записей в таблицу в день; текст,
 * похожий на формулу, в ячейки не попадает.
 */
var SITE_URL = '__SITE_URL__';
var TOKEN = '__SEND_TOKEN__';        // '' — без проверки токена
var OWNER_COPY = '';                 // e-mail для скрытой копии каждого результата; '' — не отправлять
var SENDER_NAME = '';                // имя отправителя; '' — название теста на языке участника и домен: «Тест DISC · disc-test.org»
var SENDER_EMAIL = '__SENDER_EMAIL__';  // адрес отправителя: должен быть добавлен в Gmail → Настройки → Аккаунты → «Отправлять письма как»; '' — основной адрес аккаунта
var ATTACH_PDF = true;               // прикладывать к письму PDF с полным отчётом
var CONTACT_TO = '__CONTACT_TO__';   // адрес формы обратной связи (feedbackEmail в site.config.json); '' — форма отключена
var MAX_CONTACT_BYTES = __MAX_CONTACT_BYTES__;  // общий размер вложений одного сообщения (то же число проверяет браузер)
var MAX_CONTACT_FILES = 20;
var MAX_CONTACT_PER_SENDER_PER_HOUR = 3;  // сообщений с одного e-mail в час; суточный лимит MAX_PER_DAY общий с письмами о результатах
var MAX_PER_RECIPIENT_PER_HOUR = 3;
var MAX_PER_DAY = 90;                // лимит Gmail для обычного аккаунта — 100 писем в сутки
var SAVE_RESULTS = true;             // false — не вести базу результатов
var SHEET_ID = '';                   // ID своей Google Таблицы (из адреса …/spreadsheets/d/<ID>/edit); '' — таблица создаётся сама при первом результате
var SHEET_TITLE = 'DISC Test — результаты';  // название создаваемой таблицы
var SHEET_NAME = 'Результаты';       // название листа
var MAX_SAVES_PER_DAY = 2000;        // защита от заливки таблицы мусором
var HEADERS = ['Дата получения', 'Время получения', 'Дата теста', 'Время теста', 'Имя', 'E-mail', 'Язык', 'Профиль', 'Название профиля', 'D', 'I', 'S', 'C', 'D %', 'I %', 'S %', 'C %', 'Письмо', 'Ссылка на отчёт', 'Код результата',
  'Рассылка', 'Согласие получено', 'Текст согласия', 'Ссылка для отписки'];   // четыре столбца согласия на рассылку: в таблице ищутся по заголовку «Рассылка» (см. subscribeColumn)
var SUBSCRIBED = 'да';               // значение столбца «Рассылка» у согласившихся; после отписки — «отписка <дата>»
var DATE_FORMAT = 'dd.mm.yyyy', TIME_FORMAT = 'hh:mm:ss';  // вид даты и времени в таблице (первые четыре столбца)
var VERSION = 'DISC1';
var KEYS = ['D', 'I', 'S', 'C'];
var COLORS = { D: '#C9453D', I: '#D6961F', S: '#3A9A69', C: '#3B6FB6' };
var BLOCK_KEYS = __BLOCK_KEYS__;
var DATA = __DATA__;

function doGet() { return out({ ok: true, service: 'disc-mailer', quota: MailApp.getRemainingDailyQuota(), results: SAVE_RESULTS, contact: !!CONTACT_TO, newsletter: SAVE_RESULTS }); }

function doPost(e) {
  try {
    var body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out({ ok: false, error: 'bad json' }); }
    if (TOKEN && body.token !== TOKEN) return out({ ok: false, error: 'forbidden' });
    if (body.action === 'contact') return sendContact(body);
    if (body.action === 'unsubscribe') return unsubscribe(body);
    var to = String(body.to || '').trim();
    if (to.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return out({ ok: false, error: 'bad email' });
    var lang = DATA[body.lang] ? body.lang : 'en';
    var r = decodeResult(body.code);
    if (!r) return out({ ok: false, error: 'bad code' });
    if (r.email && r.email.toLowerCase() !== to.toLowerCase()) return out({ ok: false, error: 'email mismatch' });
    var saved = SAVE_RESULTS ? saveResult(r, lang) : null;   // строка в таблице; null — база выключена или сохранить не удалось
    var wantSub = body.subscribe === true || body.action === 'subscribe';
    var unsub = wantSub ? subscribe(saved, to, lang) : '';    // ссылка для отписки; '' — согласия нет или записать его не удалось
    if (body.action === 'subscribe') return unsub ? out({ ok: true, saved: true, subscribed: true }) : out({ ok: false, error: 'not saved', saved: !!saved, subscribed: false });
    var limit = checkLimits(to);
    if (limit) { noteMail(saved, 'не отправлено: ' + limit); return out({ ok: false, error: limit, saved: !!saved, subscribed: !!unsub }); }
    var res = sendResultMail(to, r, lang, unsub);
    if (res.error) { noteMail(saved, 'ошибка: ' + res.error); return out({ ok: false, error: res.error, saved: !!saved, subscribed: !!unsub }); }
    noteMail(saved, 'отправлено ' + stamp() + (res.pdfError ? ' (без PDF: ' + res.pdfError + ')' : ''));
    return out({ ok: true, saved: !!saved, pdf: res.pdf, subscribed: !!unsub });
  } catch (err) {
    return out({ ok: false, error: String((err && err.message) || err) });
  }
}

/** Письмо с результатом и PDF-отчётом. Если PDF собрать не удалось, письмо уходит без вложения. unsub — ссылка для отписки, если участник согласился на рассылку. Возвращает {pdf, pdfError} или {error}. */
function sendResultMail(to, r, lang, unsub) {
  var pdf = null, pdfError = '';
  if (ATTACH_PDF) { try { pdf = reportPdf(r, lang); } catch (err) { pdfError = String((err && err.message) || err); console.error('reportPdf: ' + pdfError); } }
  var mail = composeMail(r, lang, r.code, !!pdf, unsub);
  var opts = { to: to, subject: mail.subject, htmlBody: mail.html, body: mail.text, name: senderName(lang) };
  if (OWNER_COPY) opts.bcc = OWNER_COPY;
  if (pdf) opts.attachments = [pdf];
  try { sendMail(opts); } catch (err) { return { error: String((err && err.message) || err) }; }
  return { pdf: !!pdf, pdfError: pdfError };
}

/** Адрес отправителя: SENDER_EMAIL, если он есть среди «Отправлять письма как» в Gmail этого аккаунта; иначе '' (основной адрес). */
function senderAlias() {
  if (!SENDER_EMAIL) return '';
  var cache = CacheService.getScriptCache(), key = 'alias:' + SENDER_EMAIL.toLowerCase(), hit = cache.get(key);
  if (hit != null) return hit === '1' ? SENDER_EMAIL : '';
  var ok = false;
  try { ok = GmailApp.getAliases().some(function (a) { return String(a).toLowerCase() === SENDER_EMAIL.toLowerCase(); }); } catch (err) { console.error('getAliases: ' + ((err && err.message) || err)); return ''; }
  cache.put(key, ok ? '1' : '0', 600);
  return ok ? SENDER_EMAIL : '';
}
/** Имя отправителя: SENDER_NAME, а если оно пустое — бренд на языке письма и домен сайта. */
function senderName(lang) {
  if (SENDER_NAME) return SENDER_NAME;
  var L = DATA[lang] || DATA.en;
  return ((L && L.brand) || 'DISC Test') + ' · ' + SITE_URL.replace(/^https?:\/\//, '');
}
function sendMail(o) {
  var opts = { name: o.name || senderName('en'), htmlBody: o.htmlBody }, from = senderAlias();
  if (from) opts.from = from;
  if (o.replyTo) opts.replyTo = o.replyTo;
  if (o.bcc) opts.bcc = o.bcc;
  if (o.attachments) opts.attachments = o.attachments;
  GmailApp.sendEmail(o.to, o.subject, o.body, opts);
}

function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

/** Лимиты: суточный счётчик общий для всех писем; счётчик на адрес в час — свой для результатов ('r:') и для формы ('c:'). */
function checkLimits(to, perHour, prefix) {
  var cache = CacheService.getScriptCache();
  var dayKey = 'day:' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  var rcKey = (prefix || 'r:') + to.toLowerCase();
  var day = +(cache.get(dayKey) || 0), rc = +(cache.get(rcKey) || 0);
  if (day >= MAX_PER_DAY) return 'daily limit';
  if (rc >= (perHour || MAX_PER_RECIPIENT_PER_HOUR)) return 'too many';
  cache.put(dayKey, String(day + 1), 86400);
  cache.put(rcKey, String(rc + 1), 3600);
  return null;
}

/* ====== форма обратной связи ====== */
/** Письмо на CONTACT_TO с текстом сообщения и вложениями; ответ уходит отправителю (replyTo). В таблицу не пишется. */
function sendContact(b) {
  if (!CONTACT_TO) return out({ ok: false, error: 'contact disabled' });
  if (String(b.hp || '')) return out({ ok: true });   // скрытое поле-ловушку заполняют только боты: делаем вид, что отправили
  var name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  var email = String(b.email || '').trim();
  var msg = String(b.message || '').replace(/\r\n?/g, '\n').trim();
  if (!name) return out({ ok: false, error: 'bad name' });
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out({ ok: false, error: 'bad email' });
  if (!msg || msg.length > 5000) return out({ ok: false, error: 'bad message' });
  var files = Array.isArray(b.files) ? b.files : [];
  if (files.length > MAX_CONTACT_FILES) return out({ ok: false, error: 'too many files' });
  var blobs = [], total = 0;
  for (var i = 0; i < files.length; i++) {
    var f = files[i] || {}, data = String(f.data || '');
    if (data.length > Math.ceil(MAX_CONTACT_BYTES / 3) * 4 + 4) return out({ ok: false, error: 'files too big' });   // до декодирования: base64 длиннее исходных байтов на треть
    var bytes;
    try { bytes = Utilities.base64Decode(data); } catch (err) { return out({ ok: false, error: 'bad file' }); }
    total += bytes.length;
    if (total > MAX_CONTACT_BYTES) return out({ ok: false, error: 'files too big' });
    var fname = String(f.name || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200) || ('file' + (i + 1));
    blobs.push(Utilities.newBlob(bytes, String(f.type || 'application/octet-stream').slice(0, 100), fname));
  }
  var limit = checkLimits(email, MAX_CONTACT_PER_SENDER_PER_HOUR, 'c:');
  if (limit) return out({ ok: false, error: limit });
  var lang = String(b.lang || '').replace(/[^a-z-]/gi, '').slice(0, 10), page = String(b.page || '').slice(0, 300);
  var meta = 'Имя: ' + name + '\nE-mail: ' + email + (lang ? '\nЯзык: ' + lang : '') + (page ? '\nСтраница: ' + page : '') + '\nПолучено: ' + stamp() +
    (blobs.length ? '\nВложения: ' + blobs.map(function (x) { return x.getName(); }).join(', ') : '');
  var subject = 'Сообщение с сайта ' + SITE_URL.replace(/^https?:\/\//, '') + ': ' + name;
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1B2027">' +
    '<p style="margin:0 0 18px">' + esc(msg).replace(/\n/g, '<br>') + '</p>' +
    '<p style="margin:0;padding-top:12px;border-top:1px solid #D9DDE3;font-size:13px;color:#5B6470">' + esc(meta).replace(/\n/g, '<br>') + '</p></div>';
  var opts = { to: CONTACT_TO, replyTo: email, subject: subject, body: msg + '\n\n---\n' + meta + '\n', htmlBody: html };
  if (blobs.length) opts.attachments = blobs;
  try { sendMail(opts); } catch (err) { return out({ ok: false, error: String((err && err.message) || err) }); }
  return out({ ok: true });
}

/* ====== база результатов (Google Таблица) ====== */
function stamp() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }
function cell(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? ' ' + v : v; } // текст, похожий на формулу, не должен выполняться

/** Лист результатов: таблица SHEET_ID, иначе созданная ранее (ID в свойствах скрипта), иначе создаётся новая. */
function resultsSheet() {
  var props = PropertiesService.getScriptProperties();
  var id = SHEET_ID || props.getProperty('sheetId'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { if (SHEET_ID) throw new Error('sheet ' + SHEET_ID + ' not found'); } }
  if (!ss) { ss = SpreadsheetApp.create(SHEET_TITLE); ss.getSheets()[0].setName(SHEET_NAME); props.setProperty('sheetId', ss.getId()); }
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    formatDateColumns(sheet);
  } else { splitDateColumns(sheet); subscribeColumn(sheet); }
  return sheet;
}
function formatDateColumns(sheet) {
  sheet.getRange('A:A').setNumberFormat(DATE_FORMAT); sheet.getRange('B:B').setNumberFormat(TIME_FORMAT);
  sheet.getRange('C:C').setNumberFormat(DATE_FORMAT); sheet.getRange('D:D').setNumberFormat(TIME_FORMAT);
}
/** Момент времени для таблицы: [дата, время] двумя числами (день и доля суток) в часовом поясе таблицы; не дата — как есть, время пустое. */
function dateTimeCells(d, tz) {
  if (Object.prototype.toString.call(d) !== '[object Date]' || isNaN(d.getTime())) return [d, ''];
  var p = Utilities.formatDate(d, tz, 'yyyy-MM-dd-HH-mm-ss').split('-');
  return [Date.UTC(+p[0], p[1] - 1, +p[2]) / 86400000 + 25569, (p[3] * 3600 + p[4] * 60 + +p[5]) / 86400];
}
/**
 * Таблица, заведённая до 8 октября 2026: «Получено» и «Дата теста» занимали по одному столбцу (дата и время вместе).
 * Делит каждый на дату и время. Вызывается при каждом обращении к листу; уже разделённую таблицу не трогает.
 */
function splitDateColumns(sheet) {
  var h = sheet.getRange(1, 1, 1, 18).getValues()[0];
  if (String(h[1]) !== 'Дата теста' && !(String(h[17]) === 'Код результата' && String(h[2]) !== 'Дата теста')) return false;
  var n = sheet.getLastRow() - 1, tz = sheet.getParent().getSpreadsheetTimeZone();
  var old = n > 0 ? sheet.getRange(2, 1, n, 2).getValues() : [];
  sheet.insertColumnAfter(2); sheet.insertColumnAfter(1);
  formatDateColumns(sheet);
  if (n > 0) sheet.getRange(2, 1, n, 4).setValues(old.map(function (r) { return dateTimeCells(r[0], tz).concat(dateTimeCells(r[1], tz)); }));
  sheet.getRange(1, 1, 1, 4).setValues([HEADERS.slice(0, 4)]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  return true;
}

/**
 * Номер первого из четырёх столбцов согласия на рассылку («Рассылка»). В таблице, заведённой до появления рассылки
 * (8 октября 2026), их нет: дописывает их справа от последнего занятого столбца — свои столбцы владельца остаются на месте.
 */
function subscribeColumn(sheet) {
  var names = HEADERS.slice(HEADERS.indexOf('Рассылка')), width = Math.max(sheet.getLastColumn(), 1);
  var c = sheet.getRange(1, 1, 1, width).getValues()[0].map(String).indexOf(names[0]) + 1;
  if (c) return c;
  c = Math.max(width, HEADERS.length - names.length) + 1;
  var need = c + names.length - 1 - sheet.getMaxColumns();
  if (need > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), need);
  sheet.getRange(1, c, 1, names.length).setValues([names]).setFontWeight('bold');
  return c;
}

/** Записывает результат в таблицу; тот же код второй раз не дублируется. Возвращает {sheet, row, isNew} или null. */
function saveResult(r, lang) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var sheet = resultsSheet(), last = sheet.getLastRow(), codeCol = HEADERS.indexOf('Код результата') + 1;
    if (last > 1) {
      var codes = sheet.getRange(2, codeCol, last - 1, 1).getValues();
      for (var i = 0; i < codes.length; i++) if (String(codes[i][0]) === r.code) return { sheet: sheet, row: i + 2, isNew: false };
    }
    var cache = CacheService.getScriptCache(), key = 'save:' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'), n = +(cache.get(key) || 0);
    if (n >= MAX_SAVES_PER_DAY) return null;
    cache.put(key, String(n + 1), 86400);
    var sc = score(r), c = classify(sc);
    var when = new Date(r.t); if (isNaN(when.getTime())) when = new Date();
    var tz = sheet.getParent().getSpreadsheetTimeZone();
    sheet.appendRow(dateTimeCells(new Date(), tz).concat(dateTimeCells(when, tz), [cell(r.name), cell(r.email), lang, c.key, sheetProfileName(c.key, lang),
      sc.net.D, sc.net.I, sc.net.S, sc.net.C, pct(sc.net.D), pct(sc.net.I), pct(sc.net.S), pct(sc.net.C),
      '', SITE_URL + '/' + lang + '/#r=' + r.code, r.code]));
    var row = sheet.getLastRow();
    sheet.getRange(row, 1, 1, 4).setNumberFormats([[DATE_FORMAT, TIME_FORMAT, DATE_FORMAT, TIME_FORMAT]]);
    return { sheet: sheet, row: row, isNew: true };
  } catch (err) { console.error('saveResult: ' + ((err && err.message) || err)); return null; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}
/** Название профиля для таблицы: всегда английское, на каком бы языке ни проходили тест (в письме и PDF — на языке участника). */
function sheetProfileName(key, lang) { var p = (DATA.en || DATA[lang] || {}).profiles; return (p && p[key] && p[key].name) || ''; }
function noteMail(saved, text) { if (saved) try { saved.sheet.getRange(saved.row, HEADERS.indexOf('Письмо') + 1).setValue(text); } catch (err) {} }

/* ====== рассылка: согласие и отписка ====== */
/** Код отписки: подпись адреса ключом, который хранится только в свойствах скрипта (создаётся сам). У одного адреса код всегда один. */
function unsubToken(email) {
  var props = PropertiesService.getScriptProperties(), key = props.getProperty('unsubKey');
  if (!key) { key = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('unsubKey', key); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(email).toLowerCase(), key)).replace(/=+$/, '').slice(0, 22);
}
/** Ссылка на страницу отписки на языке участника; код — после #, поэтому не попадает ни на хостинг, ни в аналитику. */
function unsubUrl(email, lang) { return SITE_URL + '/' + (lang === 'en' ? '' : lang + '/') + 'unsubscribe/#u=' + unsubToken(email); }

/**
 * Отмечает в строке результата согласие на рассылку: «да», когда получено, текст согласия на языке участника
 * (тот, что стоял у галочки) и ссылка для отписки. Повтор дату не меняет; согласие после отписки подписывает заново.
 * Возвращает ссылку для отписки или '' (строки нет или записать не удалось).
 */
function subscribe(saved, email, lang) {
  if (!saved) return '';
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var url = unsubUrl(email, lang), range = saved.sheet.getRange(saved.row, subscribeColumn(saved.sheet), 1, 4);
    if (String(range.getValues()[0][0]) !== SUBSCRIBED) range.setValues([[SUBSCRIBED, stamp(), cell((DATA[lang] || DATA.en).consent || ''), url]]);
    return url;
  } catch (err) { console.error('subscribe: ' + ((err && err.message) || err)); return ''; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

/** Отписка по коду из ссылки: во всех строках с этой ссылкой «да» меняется на «отписка <дата>». Неизвестный код — тоже ok: рассылка на адрес не идёт. */
function unsubscribe(b) {
  var u = String(b.u || '');
  if (!/^[A-Za-z0-9_-]{22}$/.test(u)) return out({ ok: false, error: 'bad link' });
  if (!SAVE_RESULTS) return out({ ok: false, error: 'no results base' });
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var sheet = resultsSheet(), last = sheet.getLastRow(), c = subscribeColumn(sheet), tail = '#u=' + u, n = 0;
    if (last > 1) {
      var v = sheet.getRange(2, c, last - 1, 4).getValues();
      for (var i = 0; i < v.length; i++) if (String(v[i][0]) === SUBSCRIBED && String(v[i][3]).slice(-tail.length) === tail) { sheet.getRange(i + 2, c).setValue('отписка ' + stamp()); n++; }
    }
    return out({ ok: true, rows: n });
  } catch (err) { return out({ ok: false, error: String((err && err.message) || err) }); }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

/** Запустите вручную в редакторе (Выполнить → setup): создаст таблицу заранее (а таблицу старого вида приведёт к нынешнему), покажет её адрес и адрес отправителя в журнале выполнения. */
function setup() {
  var url = resultsSheet().getParent().getUrl();
  Logger.log('Таблица результатов: ' + url);
  if (SENDER_EMAIL) {
    CacheService.getScriptCache().remove('alias:' + SENDER_EMAIL.toLowerCase());
    Logger.log(senderAlias() ? 'Письма уходят с адреса ' + SENDER_EMAIL
      : 'ВНИМАНИЕ: ' + SENDER_EMAIL + ' не найден среди адресов «Отправлять письма как» в Gmail этого аккаунта — письма уйдут с основного адреса. Добавьте его: Gmail → Настройки → Аккаунты и импорт → «Отправлять письма как».');
  }
  return url;
}

/** Запустите вручную один раз (Выполнить → englishProfileNames): заменит в уже записанных строках названия профилей на английские по столбцу «Профиль». */
function englishProfileNames() {
  var sheet = resultsSheet(), last = sheet.getLastRow(), n = 0;
  if (last < 2) return 0;
  var keyCol = HEADERS.indexOf('Профиль') + 1, range = sheet.getRange(2, keyCol, last - 1, 2), v = range.getValues();
  for (var i = 0; i < v.length; i++) { var name = sheetProfileName(String(v[i][0]), 'en'); if (name && v[i][1] !== name) { v[i][1] = name; n++; } }
  if (n) range.setValues(v);
  Logger.log('Названия профилей заменены на английские: ' + n + ' из ' + v.length);
  return n;
}

/** Запустите вручную (Выполнить → testMail): пришлёт на адрес этого аккаунта образцы писем с PDF на нескольких языках. В таблицу не пишет. */
function testMail() {
  var to = Session.getEffectiveUser().getEmail();
  var m = [], l = [];
  for (var i = 0; i < 24; i++) { m.push(BLOCK_KEYS[i].indexOf(i % 3 === 0 ? 'I' : 'D')); l.push(BLOCK_KEYS[i].indexOf(i % 2 ? 'S' : 'C')); }
  var json = JSON.stringify({ n: 'Test', e: to, p: '', t: new Date().toISOString(), m: m.join(''), l: l.join('') });
  var r = decodeResult(VERSION + '.' + Utilities.base64EncodeWebSafe(json, Utilities.Charset.UTF_8).replace(/=+$/, ''));
  ['ru', 'en', 'ar', 'ja', 'hi'].forEach(function (lang) {
    if (!DATA[lang]) return;
    var res = sendResultMail(to, r, lang);
    Logger.log(lang + ': ' + (res.error ? 'ошибка: ' + res.error : 'отправлено на ' + to + (res.pdf ? ' с PDF' : ' без PDF: ' + res.pdfError)));
  });
}

function decodeResult(str) {
  var m = String(str || '').match(new RegExp(VERSION + '\\.([A-Za-z0-9_-]+)'));
  if (!m) return null;
  try {
    var b = m[1]; while (b.length % 4) b += '=';
    var o = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString('UTF-8'));
    if (typeof o.n !== 'string' || !/^[0-3]{24}$/.test(o.m) || !/^[0-3]{24}$/.test(o.l)) return null;
    var mm = o.m.split('').map(Number), ll = o.l.split('').map(Number);
    for (var i = 0; i < 24; i++) if (mm[i] === ll[i]) return null;
    return { code: m[0], name: o.n.slice(0, 80), email: String(o.e || '').slice(0, 120), t: String(o.t || ''), m: mm, l: ll };
  } catch (err) { return null; }
}

function score(r) {
  var most = { D: 0, I: 0, S: 0, C: 0 }, least = { D: 0, I: 0, S: 0, C: 0 }, net = {};
  for (var i = 0; i < 24; i++) { most[BLOCK_KEYS[i].charAt(r.m[i])]++; least[BLOCK_KEYS[i].charAt(r.l[i])]++; }
  KEYS.forEach(function (k) { net[k] = most[k] - least[k]; });
  return { most: most, least: least, net: net };
}
function classify(sc) {
  var ord = KEYS.slice().sort(function (a, b) { return sc.net[b] - sc.net[a]; });
  var p = ord[0], s = ord[1];
  var sec = sc.net[s] > 0 && sc.net[s] >= Math.max(3, Math.round(sc.net[p] * 0.4));
  return { p: p, s: sec ? s : null, key: p + (sec ? s : '') };
}
function pct(net) { return Math.round((net + 24) / 48 * 100); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(s, vars) { return String(s).replace(/\{(\w+)\}/g, function (_, n) { return vars[n] != null ? vars[n] : '{' + n + '}'; }); }

function composeMail(r, lang, code, hasPdf, unsub) {
  var L = DATA[lang], E = L.email;
  var sc = score(r), c = classify(sc), prof = L.profiles[c.key];
  var label = c.key + ' · ' + prof.name;
  var link = SITE_URL + '/' + lang + '/#r=' + code;
  var subject = fmt(E.subject, { label: label });
  var styleName = c.s ? L.keys[c.p] + ' + ' + L.keys[c.s] : L.keys[c.p];
  var rows = KEYS.map(function (k) {
    var p = pct(sc.net[k]);
    return '<tr>' +
      '<td style="padding:6px 10px 6px 0;font-weight:bold;color:' + COLORS[k] + ';font-size:16px;width:24px">' + k + '</td>' +
      '<td style="padding:6px 10px 6px 0;font-size:14px">' + esc(L.keys[k]) + '</td>' +
      '<td style="padding:6px 0;width:140px"><div style="height:6px;background:#E9EBEF;border-radius:3px"><div style="height:6px;width:' + p + '%;background:' + COLORS[k] + ';border-radius:3px"></div></div></td>' +
      '<td style="padding:6px 0 6px 10px;font-size:14px;font-weight:bold;text-align:right;width:44px">' + p + '%</td></tr>';
  }).join('');
  var attached = hasPdf && E.attached ? E.attached : '';
  var badge = '<span style="color:' + COLORS[c.p] + '">' + c.p + '</span>' + (c.s ? '<span style="color:' + COLORS[c.s] + ';font-size:22px">' + c.s + '</span>' : '');
  var html = '<!DOCTYPE html><html lang="' + lang + '" dir="' + (L.dir || 'ltr') + '"><body style="margin:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;color:#1B2027">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #D9DDE3;border-radius:14px"><tr><td style="padding:28px;font-size:16px;line-height:1.5">' +
    '<p style="margin:0 0 16px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5B6470;font-weight:bold">DISC</p>' +
    '<p style="margin:0 0 8px">' + esc(fmt(E.greeting, { name: r.name })) + '</p>' +
    '<p style="margin:0 0 14px">' + esc(E.intro) + '</p>' +
    '<p style="margin:0 0 2px;font-size:34px;font-weight:bold;line-height:1">' + badge + '&nbsp; ' + esc(prof.name) + '</p>' +
    '<p style="margin:0 0 14px;font-size:13px;color:#5B6470">' + esc(styleName) + '</p>' +
    '<p style="margin:0 0 18px">' + esc(prof.summary) + '</p>' +
    '<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5B6470;font-weight:bold">' + esc(E.scores) + '</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px">' + rows + '</table>' +
    (attached ? '<p style="margin:0 0 18px;font-weight:bold">' + esc(attached) + '</p>' : '') +
    '<p style="margin:0 0 18px"><a href="' + esc(link) + '" style="display:inline-block;background:#1B2027;color:#F7F8FA;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(E.open) + '</a></p>' +
    '<p style="margin:0 0 18px;font-size:13px;color:#5B6470">' + esc(E.linkNote) + '<br><a href="' + esc(link) + '" style="color:#3B6FB6;word-break:break-all">' + esc(link) + '</a></p>' +
    '<p style="margin:0;padding-top:12px;border-top:1px solid #D9DDE3;font-size:12px;color:#5B6470">' + esc(E.footer) + '</p>' +
    (unsub ? '<p style="margin:8px 0 0;font-size:12px;color:#5B6470">' + esc(E.subscribed) + ' <a href="' + esc(unsub) + '" style="color:#5B6470">' + esc(E.unsubscribe) + '</a></p>' : '') +
    '</td></tr></table></td></tr></table></body></html>';
  var text = fmt(E.greeting, { name: r.name }) + '\n\n' + E.intro + ' ' + label + ' (' + styleName + ')\n\n' + prof.summary + '\n\n' + E.scores + ':\n' +
    KEYS.map(function (k) { return k + ' — ' + L.keys[k] + ': ' + pct(sc.net[k]) + '%'; }).join('\n') +
    (attached ? '\n\n' + attached : '') + '\n\n' + E.open + ':\n' + link + '\n\n' + E.footer + '\n' +
    (unsub ? '\n' + E.subscribed + '\n' + E.unsubscribe + ': ' + unsub + '\n' : '');
  return { subject: subject, html: html, text: text };
}

/* ====== PDF с полным отчётом ====== */
/**
 * HTML → PDF встроенным конвертером Apps Script. Он понимает только простую вёрстку,
 * поэтому здесь таблицы и строчные стили, без flex и внешних шрифтов.
 */
function reportPdf(r, lang) {
  var c = classify(score(r));
  return Utilities.newBlob(reportHtml(r, lang), 'text/html', 'report.html').getAs('application/pdf').setName('DISC-' + c.key + '.pdf');
}

function reportHtml(r, lang) {
  var L = DATA[lang], R = L.report, sc = score(r), c = classify(sc), prof = L.profiles[c.key], st = L.styles[c.p];
  var rtl = L.dir === 'rtl', start = rtl ? 'right' : 'left', end = rtl ? 'left' : 'right';
  var home = SITE_URL + '/' + (lang === 'en' ? '' : lang + '/');
  var when = new Date(r.t); if (isNaN(when.getTime())) when = new Date();
  var meta = [r.name, Utilities.formatDate(when, Session.getScriptTimeZone(), 'dd.MM.yyyy')].filter(Boolean).join(' · ');
  var styleName = c.s ? L.keys[c.p] + ' + ' + L.keys[c.s] : L.keys[c.p];
  var h = function (t) { return '<p style="margin:16px 0 6px;font-size:10pt;font-weight:bold;text-transform:uppercase;color:#5B6470">' + esc(t) + '</p>'; };
  var list = function (arr) { return '<ul style="margin:0;padding-' + start + ':18px">' + arr.map(function (x) { return '<li style="margin:0 0 3px">' + esc(x) + '</li>'; }).join('') + '</ul>'; };
  var para = function (t) { return '<p style="margin:0">' + esc(t) + '</p>'; };
  var bars = KEYS.map(function (k) {
    var p = pct(sc.net[k]), net = (sc.net[k] > 0 ? '+' : '') + sc.net[k];
    var bar = '<table width="100%" cellpadding="0" cellspacing="0" dir="' + (L.dir || 'ltr') + '"><tr>' +
      (p > 0 ? '<td width="' + p + '%" bgcolor="' + COLORS[k] + '" style="height:8px;font-size:1px;line-height:1px">&nbsp;</td>' : '') +
      (p < 100 ? '<td width="' + (100 - p) + '%" bgcolor="#E9EBEF" style="height:8px;font-size:1px;line-height:1px">&nbsp;</td>' : '') + '</tr></table>';
    return '<tr>' +
      '<td width="26" style="padding:5px 0;font-size:15pt;font-weight:bold;color:' + COLORS[k] + '">' + k + '</td>' +
      '<td width="200" style="padding:5px 8px"><b>' + esc(L.keys[k]) + '</b><br><span style="font-size:8.5pt;color:#5B6470">' + esc(fmt(R.statMeta, { most: sc.most[k], least: sc.least[k], net: net })) + '</span></td>' +
      '<td style="padding:5px 8px">' + bar + '</td>' +
      '<td width="48" align="' + end + '" style="padding:5px 0;font-weight:bold">' + p + '%</td></tr>';
  }).join('');
  var two = function (t1, b1, t2, b2) {
    return '<table width="100%" cellpadding="0" cellspacing="0" dir="' + (L.dir || 'ltr') + '"><tr>' +
      '<td width="50%" valign="top" style="padding-' + end + ':12px">' + h(t1) + b1 + '</td>' +
      '<td width="50%" valign="top" style="padding-' + start + ':12px">' + h(t2) + b2 + '</td></tr></table>';
  };
  return '<!DOCTYPE html><html lang="' + lang + '" dir="' + (L.dir || 'ltr') + '"><head><meta charset="utf-8"><title>' + esc('DISC — ' + c.key + ' · ' + prof.name) + '</title>' +
    '<style>@page{size:A4;margin:16mm 15mm}body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.45;color:#1B2027;text-align:' + start + '}</style></head><body>' +
    '<table width="100%" cellpadding="0" cellspacing="0" dir="' + (L.dir || 'ltr') + '" style="border-bottom:1px solid #C9CED6"><tr>' +
      '<td style="padding-bottom:6px;font-size:9pt;font-weight:bold">' + esc(L.brand) + '</td>' +
      '<td align="' + end + '" style="padding-bottom:6px;font-size:9pt;color:#5B6470">' + esc(L.cta.desc) + ' <a href="' + esc(home) + '" dir="ltr" style="color:#1B2027;font-weight:bold;text-decoration:none">' + esc(home) + '</a></td></tr></table>' +
    '<p style="margin:18px 0 0;font-size:9pt;font-weight:bold;text-transform:uppercase;color:#5B6470">' + esc(styleName) + '</p>' +
    '<p style="margin:2px 0 0;font-size:26pt;font-weight:bold;line-height:1.15"><span style="color:' + COLORS[c.p] + '">' + c.p + '</span>' + (c.s ? '<span style="color:' + COLORS[c.s] + '">' + c.s + '</span>' : '') + ' &nbsp;' + esc(prof.name) + '</p>' +
    (meta ? '<p style="margin:2px 0 0;font-size:9.5pt;color:#5B6470">' + esc(meta) + '</p>' : '') +
    '<p style="margin:12px 0 0;font-size:11.5pt">' + esc(prof.summary) + '</p>' +
    (sc.net[c.p] <= 2 ? '<p style="margin:10px 0 0;padding:8px 10px;background:#F3F4F6">' + esc(R.flat) + '</p>' : '') +
    h(R.statsTitle) + '<table width="100%" cellpadding="0" cellspacing="0" dir="' + (L.dir || 'ltr') + '">' + bars + '</table>' +
    h(R.traits) + '<p style="margin:0">' + st.traits.map(esc).join(' · ') + '</p>' +
    (c.s ? '<p style="margin:8px 0 0"><b>' + esc(fmt(R.secondary, { k: c.s, name: L.keys[c.s] })) + '</b> ' + esc(fmt(R.secondaryAddon, { addon: L.addon[c.s] })) + '</p>' : '') +
    two(R.strengths, list(st.strengths), R.growth, list(st.growth)) +
    two(R.motivation, list(st.motivation), R.communication, list(st.communication)) +
    two(R.stress, para(st.stress), R.environment, para(st.environment)) +
    '<table width="100%" cellpadding="0" cellspacing="0" dir="' + (L.dir || 'ltr') + '" style="margin-top:22px;border:1px solid #C9CED6"><tr><td style="padding:10px 12px">' +
      '<b>' + esc(L.cta.title) + '</b><br>' + esc(L.cta.text) + ' <a href="' + esc(home) + '" dir="ltr" style="color:#1B2027;font-weight:bold;text-decoration:none">' + esc(home) + '</a></td></tr></table>' +
    '<p style="margin:8px 0 0;font-size:8pt;color:#5B6470">' + esc(fmt(L.rights, { year: when.getFullYear() })) + '</p>' +
    '</body></html>';
}
