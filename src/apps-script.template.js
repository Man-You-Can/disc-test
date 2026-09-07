/**
 * Тест DISC — серверная часть на Google Apps Script: письмо участнику с результатом
 * и база результатов в Google Таблице.
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
 * Защита от злоупотреблений: токен (совпадает с sendToken в site.config.json),
 * e-mail получателя должен совпадать с e-mail внутри кода результата, письмо
 * собирается только из шаблона (клиент не может передать произвольный текст),
 * лимиты на адрес в час и на день, лимит записей в таблицу в день; текст,
 * похожий на формулу, в ячейки не попадает.
 */
var SITE_URL = '__SITE_URL__';
var TOKEN = '__SEND_TOKEN__';        // '' — без проверки токена
var OWNER_COPY = '';                 // e-mail для скрытой копии каждого результата; '' — не отправлять
var SENDER_NAME = 'DISC Test';       // имя отправителя в письме
var MAX_PER_RECIPIENT_PER_HOUR = 3;
var MAX_PER_DAY = 90;                // лимит Gmail для обычного аккаунта — 100 писем в сутки
var SAVE_RESULTS = true;             // false — не вести базу результатов
var SHEET_ID = '';                   // ID своей Google Таблицы (из адреса …/spreadsheets/d/<ID>/edit); '' — таблица создаётся сама при первом результате
var SHEET_TITLE = 'DISC Test — результаты';  // название создаваемой таблицы
var SHEET_NAME = 'Результаты';       // название листа
var MAX_SAVES_PER_DAY = 2000;        // защита от заливки таблицы мусором
var HEADERS = ['Получено', 'Дата теста', 'Имя', 'E-mail', 'Язык', 'Профиль', 'Название профиля', 'D', 'I', 'S', 'C', 'D %', 'I %', 'S %', 'C %', 'Письмо', 'Ссылка на отчёт', 'Код результата'];
var VERSION = 'DISC1';
var KEYS = ['D', 'I', 'S', 'C'];
var COLORS = { D: '#C9453D', I: '#D6961F', S: '#3A9A69', C: '#3B6FB6' };
var BLOCK_KEYS = __BLOCK_KEYS__;
var DATA = __DATA__;

function doGet() { return out({ ok: true, service: 'disc-mailer', quota: MailApp.getRemainingDailyQuota(), results: SAVE_RESULTS }); }

function doPost(e) {
  try {
    var body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out({ ok: false, error: 'bad json' }); }
    if (TOKEN && body.token !== TOKEN) return out({ ok: false, error: 'forbidden' });
    var to = String(body.to || '').trim();
    if (to.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return out({ ok: false, error: 'bad email' });
    var lang = DATA[body.lang] ? body.lang : 'en';
    var r = decodeResult(body.code);
    if (!r) return out({ ok: false, error: 'bad code' });
    if (r.email && r.email.toLowerCase() !== to.toLowerCase()) return out({ ok: false, error: 'email mismatch' });
    var saved = SAVE_RESULTS ? saveResult(r, lang) : null;   // строка в таблице; null — база выключена или сохранить не удалось
    var limit = checkLimits(to);
    if (limit) { noteMail(saved, 'не отправлено: ' + limit); return out({ ok: false, error: limit, saved: !!saved }); }
    var mail = composeMail(r, lang, r.code);
    var opts = { to: to, subject: mail.subject, htmlBody: mail.html, body: mail.text, name: SENDER_NAME };
    if (OWNER_COPY) opts.bcc = OWNER_COPY;
    try { MailApp.sendEmail(opts); } catch (err) {
      var msg = String((err && err.message) || err);
      noteMail(saved, 'ошибка: ' + msg);
      return out({ ok: false, error: msg, saved: !!saved });
    }
    noteMail(saved, 'отправлено ' + stamp());
    return out({ ok: true, saved: !!saved });
  } catch (err) {
    return out({ ok: false, error: String((err && err.message) || err) });
  }
}

function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function checkLimits(to) {
  var cache = CacheService.getScriptCache();
  var dayKey = 'day:' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  var rcKey = 'r:' + to.toLowerCase();
  var day = +(cache.get(dayKey) || 0), rc = +(cache.get(rcKey) || 0);
  if (day >= MAX_PER_DAY) return 'daily limit';
  if (rc >= MAX_PER_RECIPIENT_PER_HOUR) return 'too many';
  cache.put(dayKey, String(day + 1), 86400);
  cache.put(rcKey, String(rc + 1), 3600);
  return null;
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
    sheet.getRange('A:B').setNumberFormat('yyyy-mm-dd hh:mm');
  }
  return sheet;
}

/** Записывает результат в таблицу; тот же код второй раз не дублируется. Возвращает {sheet, row, isNew} или null. */
function saveResult(r, lang) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var sheet = resultsSheet(), last = sheet.getLastRow(), codeCol = HEADERS.length;
    if (last > 1) {
      var codes = sheet.getRange(2, codeCol, last - 1, 1).getValues();
      for (var i = 0; i < codes.length; i++) if (String(codes[i][0]) === r.code) return { sheet: sheet, row: i + 2, isNew: false };
    }
    var cache = CacheService.getScriptCache(), key = 'save:' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'), n = +(cache.get(key) || 0);
    if (n >= MAX_SAVES_PER_DAY) return null;
    cache.put(key, String(n + 1), 86400);
    var sc = score(r), c = classify(sc), prof = DATA[lang].profiles[c.key];
    var when = new Date(r.t); if (isNaN(when.getTime())) when = new Date();
    sheet.appendRow([new Date(), when, cell(r.name), cell(r.email), lang, c.key, prof.name,
      sc.net.D, sc.net.I, sc.net.S, sc.net.C, pct(sc.net.D), pct(sc.net.I), pct(sc.net.S), pct(sc.net.C),
      '', SITE_URL + '/' + lang + '/#r=' + r.code, r.code]);
    return { sheet: sheet, row: sheet.getLastRow(), isNew: true };
  } catch (err) { console.error('saveResult: ' + ((err && err.message) || err)); return null; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}
function noteMail(saved, text) { if (saved) try { saved.sheet.getRange(saved.row, HEADERS.indexOf('Письмо') + 1).setValue(text); } catch (err) {} }

/** Запустите вручную в редакторе (Выполнить → setup): создаст таблицу заранее и покажет её адрес в журнале выполнения. */
function setup() {
  var url = resultsSheet().getParent().getUrl();
  Logger.log('Таблица результатов: ' + url);
  return url;
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

function composeMail(r, lang, code) {
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
    '<p style="margin:0 0 18px"><a href="' + esc(link) + '" style="display:inline-block;background:#1B2027;color:#F7F8FA;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(E.open) + '</a></p>' +
    '<p style="margin:0 0 18px;font-size:13px;color:#5B6470">' + esc(E.linkNote) + '<br><a href="' + esc(link) + '" style="color:#3B6FB6;word-break:break-all">' + esc(link) + '</a></p>' +
    '<p style="margin:0;padding-top:12px;border-top:1px solid #D9DDE3;font-size:12px;color:#5B6470">' + esc(E.footer) + '</p>' +
    '</td></tr></table></td></tr></table></body></html>';
  var text = fmt(E.greeting, { name: r.name }) + '\n\n' + E.intro + ' ' + label + ' (' + styleName + ')\n\n' + prof.summary + '\n\n' + E.scores + ':\n' +
    KEYS.map(function (k) { return k + ' — ' + L.keys[k] + ': ' + pct(sc.net[k]) + '%'; }).join('\n') +
    '\n\n' + E.open + ':\n' + link + '\n\n' + E.footer + '\n';
  return { subject: subject, html: html, text: text };
}
