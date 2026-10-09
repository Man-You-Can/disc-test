// Проверка backend/apps-script/Code.gs без Google: подменяем Utilities/CacheService/MailApp/GmailApp/ContentService,
// а также SpreadsheetApp/PropertiesService/LockService/Session (база результатов в таблице).
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const store = {}, sent = [], props = {}, books = {};
let mailFail = null; // текст ошибки, которую бросит GmailApp.sendEmail (null — письма уходят)
let pdfFail = null;  // текст ошибки конвертера HTML → PDF (null — PDF собирается)
let aliases = ['info@disc-test.org']; // адреса «Отправлять письма как» в Gmail
const logs = [];
const blob = (bytes, type, name) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8'), getBytes: () => bytes, getContentType: () => type, getName: () => name,
  setName(n) { name = n; return this; },
  getAs: t => { if (pdfFail) throw new Error(pdfFail); const b = blob(bytes, t, name); b.source = Buffer.from(bytes).toString('utf8'); return b; } });
function makeSheet(ss, name) {
  const rows = [];
  const sh = {
    rows, getName: () => name, setName: n => { name = n; return sh; }, getParent: () => ss, setFrozenRows: () => sh,
    appendRow: r => { rows.push(r.slice()); return sh; }, getLastRow: () => rows.length,
    insertColumnAfter: n => { rows.forEach(r => r.splice(n, 0, '')); return sh; },
    getMaxColumns: () => 26, insertColumnsAfter: () => sh, getLastColumn: () => rows.reduce((n, r) => Math.max(n, r.length), 0),
    colFormats: {}, rowFormats: {},
    getRange: (row, col, nRows, nCols) => {
      if (typeof row === 'string') return { setNumberFormat: f => { sh.colFormats[row] = f; }, setFontWeight: () => {} };
      const range = {
        getValue: () => (rows[row - 1] || [])[col - 1] ?? '',
        getValues: () => Array.from({ length: nRows || 1 }, (_, i) => Array.from({ length: nCols || 1 }, (_, j) => (rows[row - 1 + i] || [])[col - 1 + j] ?? '')),
        setValue: v => { while (rows.length < row) rows.push([]); rows[row - 1][col - 1] = v; },
        setValues: vs => { vs.forEach((r, i) => r.forEach((v, j) => { rows[row - 1 + i][col - 1 + j] = v; })); return range; },
        setNumberFormats: fs => { sh.rowFormats[row] = fs[0].join(' | '); return range; },
        setNumberFormat: () => range, setFontWeight: () => range
      };
      return range;
    }
  };
  return sh;
}
function makeBook(title) {
  const id = 'book' + (Object.keys(books).length + 1), ss = { id, title, sheets: [] };
  Object.assign(ss, { getId: () => id, getSpreadsheetTimeZone: () => 'Asia/Yerevan', getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id + '/edit', getSheets: () => ss.sheets,
    getSheetByName: n => ss.sheets.find(s => s.getName() === n) || null, insertSheet: n => { const s = makeSheet(ss, n); ss.sheets.push(s); return s; } });
  ss.sheets.push(makeSheet(ss, 'Лист1')); books[id] = ss; return ss;
}
const ctx = {
  Utilities: {
    base64DecodeWebSafe: s => [...Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')],
    base64Decode: s => { if (!/^[A-Za-z0-9+/=]*$/.test(s)) throw new Error('bad base64'); return [...Buffer.from(s, 'base64')]; },
    newBlob: blob, Charset: { UTF_8: 'utf8' },
    base64EncodeWebSafe: s => (typeof s === 'string' ? Buffer.from(s, 'utf8') : Buffer.from(s)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    computeHmacSha256Signature: (v, k) => [...crypto.createHmac('sha256', k).update(v).digest()], getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, fmt) => {
      if (fmt !== 'yyyy-MM-dd-HH-mm-ss') return /H/.test(fmt) ? '2026-09-07 12:00' : '2026-09-07';
      const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(+d)).forEach(x => { p[x.type] = x.value; });
      return [p.year, p.month, p.day, p.hour, p.minute, p.second].join('-');
    }
  },
  CacheService: { getScriptCache: () => ({ get: k => store[k] || null, put: (k, v) => { store[k] = v; }, remove: k => { delete store[k]; } }) },
  MailApp: { getRemainingDailyQuota: () => 100 },
  GmailApp: { getAliases: () => aliases, sendEmail: (to, subject, body, o) => { if (mailFail) throw new Error(mailFail); sent.push(Object.assign({ to, subject, body }, o)); } },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ text: s }) }) },
  SpreadsheetApp: { create: makeBook, openById: id => { if (!books[id]) throw new Error('not found'); return books[id]; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  Session: { getScriptTimeZone: () => 'UTC', getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
  Logger: { log: x => logs.push(String(x)) },
  console: { log: console.log, error: () => {} }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'backend', 'apps-script', 'Code.gs'), 'utf8'), ctx);
const b64e = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const BK = ['IDCS','CSDI','SCID','DSIC','ICSD','SDCI','CIDS','DCSI','ISDC','CDIS','SICD','DISC','ICDS','CSID','SDCI','DCSI','ISDC','CISD','SCDI','DSIC','IDCS','CSID','SIDC','DCIS'];
const m = [], l = []; BK.forEach((ks, i) => { m.push(ks.indexOf(i % 3 === 0 ? 'I' : 'D')); l.push(ks.indexOf(i % 2 ? 'S' : 'C')); });
const mk = (n, e, t) => 'DISC1.' + b64e(JSON.stringify({ n, e, p: '', t: t || '2026-09-07T10:00:00Z', m: m.join(''), l: l.join('') }));
const code = mk('Иван Петров', 'ivan@example.com');
const TOKEN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site.config.json'), 'utf8')).sendToken || ''; // тот же токен, что попал в Code.gs при сборке
const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ token: TOKEN }, body)) } }).text);
const rows = () => Object.values(books)[0].getSheetByName('Результаты').rows;
const sheet1 = () => Object.values(books)[0].getSheetByName('Результаты');
const serial = (y, mo, d) => Date.UTC(y, mo - 1, d) / 864e5 + 25569; // дата в таблице — число дней от 30.12.1899
const isDay = v => typeof v === 'number' && Number.isInteger(v) && v > 46000, isTime = v => typeof v === 'number' && v >= 0 && v < 1;
const isDate = v => Object.prototype.toString.call(v) === '[object Date]'; // Date из другого realm (vm)
let fails = 0; const check = (name, cond) => { console.log((cond ? '✓ ' : '✗ ') + name); if (!cond) fails++; };

// ---- письмо ----
const r1 = post({ to: 'ivan@example.com', lang: 'ru', code });
check('happy path ru', r1.ok === true && r1.saved === true);
check('one mail sent', sent.length === 1);
const mail = sent[0];
check('subject has profile', /Первопроходец/.test(mail.subject) && /DI/.test(mail.subject));
check('html has link with code', mail.htmlBody.includes('/ru/#r=' + code));
check('html has greeting with name', mail.htmlBody.includes('Иван Петров'));
check('html has scores 83%', mail.htmlBody.includes('83%') && mail.htmlBody.includes('25%'));
check('text body present', /Первопроходец/.test(mail.body) && mail.body.includes(code));
check('sender name: brand in the mail language + domain', mail.name === 'Тест DISC · disc-test.org');
check('sent from the domain address', mail.from === 'info@disc-test.org');
const pdf = (mail.attachments || [])[0];
check('pdf attached, named by profile', mail.attachments.length === 1 && pdf.getContentType() === 'application/pdf' && pdf.getName() === 'DISC-DI.pdf');
check('pdf: profile, name, scores', /Первопроходец/.test(pdf.source) && pdf.source.includes('Иван Петров') && pdf.source.includes('83%') && pdf.source.includes('2026-09-07'));
check('pdf: all report sections', ['Ключевые черты', 'Сильные стороны', 'Зоны роста', 'Что мотивирует', 'Как с вами лучше общаться', 'Под стрессом', 'Комфортная среда', 'Вторичный стиль: I'].every(x => pdf.source.includes(x)));
check('pdf: site link, no result code', pdf.source.includes('https://disc-test.org/ru/') && !pdf.source.includes(code));
check('mail mentions attachment', mail.htmlBody.includes('во вложении') && mail.body.includes('во вложении'));

// ---- база результатов ----
check('sheet created and remembered', Object.keys(books).length === 1 && props.sheetId === 'book1');
check('header row', rows()[0].length === 24 && rows()[0].slice(20).join('|') === 'Рассылка|Согласие получено|Текст согласия|Ссылка для отписки' && rows()[0].slice(0, 5).join('|') === 'Дата получения|Время получения|Дата теста|Время теста|Имя' && rows()[0][19] === 'Код результата');
const row = rows()[1];
check('one data row', rows().length === 2);
// таблица в поясе Asia/Yerevan (UTC+4): тест в 10:00 UTC — это 14:00 по времени таблицы
check('row: date and time in separate cells, table time zone', row.length === 20 && isDay(row[0]) && isTime(row[1]) && row[2] === serial(2026, 9, 7) && Math.abs(row[3] - 14 / 24) < 1e-9);
check('row: day-first date format, time format', sheet1().rowFormats[2] === 'dd.mm.yyyy | hh:mm:ss | dd.mm.yyyy | hh:mm:ss' && sheet1().colFormats['A:A'] === 'dd.mm.yyyy' && sheet1().colFormats['D:D'] === 'hh:mm:ss');
check('row: name, email, lang', row[4] === 'Иван Петров' && row[5] === 'ivan@example.com' && row[6] === 'ru');
check('row: profile, name in English whatever the language', row[7] === 'DI' && row[8] === 'Pioneer');
check('row: net scores', row[9] === 16 && row[10] === 8 && row[11] === -12 && row[12] === -12);
check('row: percents', row[13] === 83 && row[14] === 67 && row[15] === 25 && row[16] === 25);
check('row: mail status sent', /^отправлено 2026-09-07 12:00$/.test(row[17]));
check('row: link and code', row[18] === 'https://disc-test.org/ru/#r=' + code && row[19] === code);

check('ja works', post({ to: 'ivan@example.com', lang: 'ja', code }).ok === true && /開拓者/.test(sent[1].subject) && sent[1].name === 'DISC診断 · disc-test.org');
check('same code not duplicated', rows().length === 2);
check('ar rtl', post({ to: 'ivan@example.com', lang: 'ar', code }).ok === true && sent[2].htmlBody.includes('dir="rtl"') && sent[2].attachments[0].source.includes('<html lang="ar" dir="rtl">'));
const r4 = post({ to: 'ivan@example.com', lang: 'xx', code });
check('per-recipient limit (3/hour) still reports saved', r4.error === 'too many' && r4.saved === true);
check('row: mail status after limit', rows()[1][17] === 'не отправлено: too many');
check('email mismatch rejected, not saved', post({ to: 'other@example.com', lang: 'en', code }).error === 'email mismatch' && rows().length === 2);
check('bad email rejected', post({ to: 'not-an-email', lang: 'en', code }).error === 'bad email');
check('bad code rejected, not saved', post({ to: 'ivan@example.com', lang: 'en', code: 'DISC1.xxxx' }).error === 'bad code' && rows().length === 2);
check('wrong token rejected, not saved', !TOKEN || (JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ token: 'nope', to: 'ivan@example.com', lang: 'en', code }) } }).text).error === 'forbidden' && rows().length === 2));
check('bad json handled', JSON.parse(ctx.doPost({ postData: { contents: '{oops' } }).text).error === 'bad json');

mailFail = 'Service invoked too many times';
const c2 = mk('Anna Lee', 'anna@example.com', 'not-a-date');
const r5 = post({ to: 'anna@example.com', lang: 'en', code: c2 });
check('mail failure: saved, ok=false', r5.ok === false && r5.saved === true && /too many times/.test(r5.error));
check('mail failure row: status error, date fallback', rows().length === 3 && /^ошибка: /.test(rows()[2][17]) && isDay(rows()[2][2]) && isTime(rows()[2][3]) && rows()[2][8] === 'Pioneer');
mailFail = null;
check('retry after failure: same row, status sent', post({ to: 'anna@example.com', lang: 'en', code: c2 }).ok === true && rows().length === 3 && /^отправлено/.test(rows()[2][17]));

const c3 = mk('=1+1', 'a@b.co');
post({ to: 'a@b.co', lang: 'en', code: c3 });
check('no html injection in name', !sent[sent.length - 1].htmlBody.includes('<b>x</b>') && (() => { const c4 = mk('<b>x</b>', 'x@b.co'); post({ to: 'x@b.co', lang: 'en', code: c4 }); const h = sent[sent.length - 1].htmlBody; return !h.includes('<b>x</b>') && h.includes('&lt;b&gt;x&lt;/b&gt;'); })());
check('no formula injection in sheet', rows()[3][4] === ' =1+1');
check('code with surrounding text is trimmed', (() => { const c5 = mk('Пётр', 'p@b.co'); post({ to: 'p@b.co', lang: 'ru', code: 'см. ' + c5 + ' конец' }); return rows()[rows().length - 1][19] === c5; })());

// языки второй волны, в том числе код с дефисом (zh-hant): письмо на своём языке, ссылка ведёт в свою папку, язык попадает в таблицу
check('new languages: zh-hant, id, tr, pl', ['zh-hant', 'id', 'tr', 'pl'].every(lg => { const to = lg + '@b.co', cc = mk('Lin', to); const r = post({ to, lang: lg, code: cc }), m = sent[sent.length - 1], row = rows()[rows().length - 1];
  return r.ok === true && m.to === to && m.htmlBody.includes('<html lang="' + lg + '"') && m.htmlBody.includes('/' + lg + '/#r=' + cc) && row[6] === lg && /^[A-Za-z ]+$/.test(row[8]) && row[18] === 'https://disc-test.org/' + lg + '/#r=' + cc; }));

// PDF: сбой конвертера не мешает письму; имя участника экранируется; английская версия ссылается на корень сайта
pdfFail = 'conversion failed';
const cp = mk('Pat <i>', 'pat@b.co'), rp = post({ to: 'pat@b.co', lang: 'en', code: cp }), mp = sent[sent.length - 1];
check('pdf failure: mail still sent without attachment', rp.ok === true && rp.pdf === false && !mp.attachments && !/attached/.test(mp.htmlBody) && /\(без PDF: conversion failed\)$/.test(rows()[rows().length - 1][17]));
pdfFail = null;
const cq = mk('Pat <i>', 'pat2@b.co'); post({ to: 'pat2@b.co', lang: 'en', code: cq });
const pq = sent[sent.length - 1].attachments[0].source;
check('pdf: name escaped, en links to site root', pq.includes('Pat &lt;i&gt;') && !pq.includes('Pat <i>') && pq.includes('href="https://disc-test.org/"') && /attached/.test(sent[sent.length - 1].htmlBody));
check('pdf: every language builds', Object.keys(ctx.DATA).every(lg => { const h = ctx.reportHtml(ctx.decodeResult(code), lg); return h.length > 3000 && !/undefined|\{\w+\}/.test(h); }));
check('pdf: rights line with the year in every language', Object.keys(ctx.DATA).every(lg => ctx.reportHtml(ctx.decodeResult(code), lg).includes('© ' + new Date().getFullYear() + ' disc-test.org')));
ctx.ATTACH_PDF = false;
post({ to: 'pat3@b.co', lang: 'en', code: mk('Pat', 'pat3@b.co') });
check('ATTACH_PDF=false: no attachment', !sent[sent.length - 1].attachments && !/attached/.test(sent[sent.length - 1].body));
ctx.ATTACH_PDF = true;
ctx.SENDER_NAME = 'My Name';
post({ to: 'pat4@b.co', lang: 'ru', code: mk('Pat', 'pat4@b.co') });
check('SENDER_NAME overrides the default name', sent[sent.length - 1].name === 'My Name');
ctx.SENDER_NAME = '';

// адрес отправителя: если info@ не добавлен в Gmail как «Отправлять письма как», письмо уходит с основного адреса
aliases = []; delete store['alias:info@disc-test.org'];
post({ to: 'al@b.co', lang: 'en', code: mk('Al', 'al@b.co') });
check('no alias in Gmail: sent without from', sent[sent.length - 1].to === 'al@b.co' && !('from' in sent[sent.length - 1]));
logs.length = 0; ctx.setup();
check('setup warns about missing alias', logs.some(x => /ВНИМАНИЕ: info@disc-test\.org/.test(x)));
aliases = ['Info@disc-test.org']; logs.length = 0; ctx.setup();
check('setup confirms alias (case-insensitive)', logs.some(x => x === 'Письма уходят с адреса info@disc-test.org'));
const nSent = sent.length, nRows = rows().length; logs.length = 0; ctx.testMail();
check('testMail: 5 samples with pdf to the owner, nothing saved', sent.length === nSent + 5 && sent.slice(nSent).every(x => x.to === 'owner@example.com' && x.from === 'info@disc-test.org' && x.attachments.length === 1) && rows().length === nRows && logs.length === 5 && logs.every(x => /с PDF$/.test(x)));

ctx.SAVE_RESULTS = false;
const before = rows().length;
check('SAVE_RESULTS=false: mail only', post({ to: 'q@b.co', lang: 'en', code: mk('Q', 'q@b.co') }).saved === false && rows().length === before);
ctx.SAVE_RESULTS = true;

// ---- форма обратной связи ----
const CONTACT_TO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site.config.json'), 'utf8')).feedbackEmail || '';
const rowsBefore = rows().length, sentBefore = sent.length;
const longName = 'очень-длинное-имя-файла-со-скриншотом-ошибки-в-переводе-2026-09-07.pdf';
const cr = post({ action: 'contact', name: '  Мария   Иванова ', email: 'maria@example.com', lang: 'ru', page: 'https://disc-test.org/ru/contact/', message: 'Здравствуйте!\r\nВ переводе <b>опечатка</b>.',
  files: [{ name: longName, type: 'application/pdf', data: Buffer.from('%PDF-1.4 test').toString('base64') }, { name: 'note.txt', type: 'text/plain', data: Buffer.from('hi').toString('base64') }] });
check('contact: ok, one mail, nothing saved to sheet', !CONTACT_TO || (cr.ok === true && sent.length === sentBefore + 1 && rows().length === rowsBefore));
const cm = sent[sent.length - 1];
check('contact: to feedback address, replyTo sender', !CONTACT_TO || (cm.to === CONTACT_TO && cm.replyTo === 'maria@example.com' && cm.name === 'DISC Test · disc-test.org' && cm.from === 'info@disc-test.org'));
check('contact: subject has site and normalized name', !CONTACT_TO || cm.subject === 'Сообщение с сайта disc-test.org: Мария Иванова');
check('contact: text body has message and meta', !CONTACT_TO || (cm.body.includes('В переводе <b>опечатка</b>.') && cm.body.includes('E-mail: maria@example.com') && cm.body.includes('Язык: ru') && cm.body.includes('Вложения: ' + longName + ', note.txt')));
check('contact: html body escaped with line breaks', !CONTACT_TO || cm.htmlBody.includes('Здравствуйте!<br>В переводе &lt;b&gt;опечатка&lt;/b&gt;.'));
check('contact: attachments decoded', !CONTACT_TO || (cm.attachments.length === 2 && cm.attachments[0].getName() === longName && cm.attachments[0].getContentType() === 'application/pdf' && Buffer.from(cm.attachments[0].getBytes()).toString() === '%PDF-1.4 test'));
check('contact: honeypot filled → fake ok, no mail', post({ action: 'contact', hp: 'http://spam', name: 'Bot', email: 'bot@example.com', message: 'buy' }).ok === true && sent.length === sentBefore + (CONTACT_TO ? 1 : 0));
check('contact: bad email', post({ action: 'contact', name: 'X', email: 'nope', message: 'm' }).error === (CONTACT_TO ? 'bad email' : 'contact disabled'));
check('contact: empty message', post({ action: 'contact', name: 'X', email: 'x@example.com', message: '   ' }).error === (CONTACT_TO ? 'bad message' : 'contact disabled'));
check('contact: missing name', post({ action: 'contact', name: '', email: 'x@example.com', message: 'm' }).error === (CONTACT_TO ? 'bad name' : 'contact disabled'));
const big = Buffer.alloc(ctx.MAX_CONTACT_BYTES + 1, 1).toString('base64'), half = Buffer.alloc(Math.floor(ctx.MAX_CONTACT_BYTES / 2) + 1, 1).toString('base64');
check('contact: one file over limit rejected', post({ action: 'contact', name: 'X', email: 'big@example.com', message: 'm', files: [{ name: 'big.bin', data: big }] }).error === (CONTACT_TO ? 'files too big' : 'contact disabled'));
check('contact: two files over limit in total rejected', post({ action: 'contact', name: 'X', email: 'big@example.com', message: 'm', files: [{ name: 'a.bin', data: half }, { name: 'b.bin', data: half }] }).error === (CONTACT_TO ? 'files too big' : 'contact disabled'));
check('contact: broken base64 rejected', post({ action: 'contact', name: 'X', email: 'big@example.com', message: 'm', files: [{ name: 'a.bin', data: '***' }] }).error === (CONTACT_TO ? 'bad file' : 'contact disabled'));
check('contact: nothing sent for rejected requests', sent.length === sentBefore + (CONTACT_TO ? 1 : 0));
check('contact: 3 per sender per hour', !CONTACT_TO || (post({ action: 'contact', name: 'M', email: 'maria@example.com', message: '2' }).ok && post({ action: 'contact', name: 'M', email: 'maria@example.com', message: '3' }).ok && post({ action: 'contact', name: 'M', email: 'maria@example.com', message: '4' }).error === 'too many'));
check('contact: wrong token rejected', !TOKEN || JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ token: 'nope', action: 'contact', name: 'X', email: 'x@example.com', message: 'm' }) } }).text).error === 'forbidden');
const savedTo = ctx.CONTACT_TO; ctx.CONTACT_TO = '';
check('contact: disabled without address', post({ action: 'contact', name: 'X', email: 'x@example.com', message: 'm' }).error === 'contact disabled');
ctx.CONTACT_TO = savedTo;

// таблица, заведённая до разделения дат (18 столбцов, дата и время в одной ячейке): делится при первом же обращении, один раз
const newRows = JSON.stringify(rows());
const toDate = (day, time) => typeof day === 'number' ? new Date(Math.round((day - 25569 + time) * 864e5) - 4 * 3600e3) : day; // обратно в момент времени (UTC+4)
rows().forEach((r, i) => { r.splice(0, 4, i ? toDate(r[0], r[1]) : 'Получено', i ? toDate(r[2], r[3]) : 'Дата теста'); });
rows()[0].length = 18; // и без четырёх столбцов согласия на рассылку
rows()[3][0] = 'вручную'; // не дата: остаётся как есть, время пустое
check('old layout prepared', rows().every(r => r.length === 18) && rows()[0][17] === 'Код результата' && isDate(rows()[1][1]));
ctx.setup();
const want = JSON.parse(newRows); want[3][0] = 'вручную'; want[3][1] = '';
check('old sheet: date columns split, subscription columns added, other cells intact', rows()[0].length === 24 && rows().slice(1).every(r => r.length === 20) && JSON.stringify(rows().map(r => r.map(v => typeof v === 'number' ? +v.toFixed(9) : v))) === JSON.stringify(want.map(r => r.map(v => typeof v === 'number' ? +v.toFixed(9) : v))));
const split = JSON.stringify(rows()); ctx.setup();
check('old sheet: second call changes nothing', JSON.stringify(rows()) === split);
rows()[0][1] = 'Gjkextyj'; ctx.setup();
check('new sheet with a retyped header is not split again', rows()[0].length === 24 && rows().slice(1).every(r => r.length === 20));
rows()[0][1] = 'Время получения';
const cOld = mk('Olga', 'olga@b.co'); post({ to: 'olga@b.co', lang: 'ru', code: cOld });
check('row after split: 20 cells, code in the last column, no duplicates on resend', (() => { const n = rows().length, last = rows()[n - 1]; post({ to: 'olga@b.co', lang: 'ru', code: cOld }); return last.length === 20 && last[19] === cOld && last[4] === 'Olga' && rows().length === n; })());

// строки, записанные до перехода на английские названия: englishProfileNames правит их по столбцу «Профиль», остальное не трогает
rows()[1][8] = 'Первопроходец'; const others = JSON.stringify(rows().map(r => r.filter((_, j) => j !== 8)));
check('englishProfileNames: old rows fixed, nothing else touched', ctx.englishProfileNames() === 1 && rows()[1][8] === 'Pioneer' && rows()[0][8] === 'Название профиля' && JSON.stringify(rows().map(r => r.filter((_, j) => j !== 8))) === others);
check('englishProfileNames: second run changes nothing', ctx.englishProfileNames() === 0);
check('setup returns sheet url', ctx.setup() === 'https://docs.google.com/spreadsheets/d/book1/edit' && Object.keys(books).length === 1);

// ---- рассылка: согласие и отписка ----
const subCell = r => r.slice(20, 24), lastRow = () => rows()[rows().length - 1];
check('no consent: subscription cells stay empty, mail has no unsubscribe link', rows().slice(1).every(r => r.length === 20) && sent.every(x => !/unsubscribe\//.test(x.htmlBody || '')) && r1.subscribed === false);
const cS = mk('Sub One', 'sub@b.co'), rS = post({ to: 'sub@b.co', lang: 'ru', code: cS, subscribe: true }), mS = sent[sent.length - 1], sS = subCell(lastRow());
const linkS = sS[3], tokS = String(linkS).split('#u=')[1];
check('subscribe with the result: ok, subscribed, one mail', rS.ok === true && rS.subscribed === true && mS.to === 'sub@b.co');
check('subscribe: row marked, consent text in the participant language, link to the ru page', sS[0] === 'да' && sS[1] === '2026-09-07 12:00' && sS[2] === ctx.DATA.ru.consent && /^Соглашаюсь получать/.test(sS[2]) && /^https:\/\/disc-test\.org\/ru\/unsubscribe\/#u=[A-Za-z0-9_-]{22}$/.test(linkS));
check('subscribe: mail has the consent line and the unsubscribe link (html and text)', mS.htmlBody.includes('Вы согласились получать рассылку') && mS.htmlBody.includes('href="' + linkS + '"') && mS.body.includes('Отписаться от рассылки: ' + linkS));
check('subscribe: key kept in script properties, not in the link', typeof props.unsubKey === 'string' && props.unsubKey.length > 30 && !linkS.includes(props.unsubKey));
const nBefore = sent.length, cL = mk('Late', 'late@b.co'); post({ to: 'late@b.co', lang: 'en', code: cL });
check('result sent without consent: cells empty', lastRow().length === 20 && sent.length === nBefore + 1);
const rL = post({ action: 'subscribe', to: 'late@b.co', lang: 'en', code: cL });
check('consent given later: row marked, no second mail, en link at the site root', rL.ok === true && rL.subscribed === true && sent.length === nBefore + 1 && rows().filter(r => r[19] === cL).length === 1 && lastRow()[20] === 'да' && lastRow()[22] === ctx.DATA.en.consent && /^https:\/\/disc-test\.org\/unsubscribe\/#u=/.test(lastRow()[23]));
check('same address in another language: same code, own page', (() => { const c = mk('Sub One', 'SUB@b.co', '2026-09-08T10:00:00Z'); const r = post({ action: 'subscribe', to: 'SUB@b.co', lang: 'de', code: c }); return r.subscribed === true && lastRow()[23] === 'https://disc-test.org/de/unsubscribe/#u=' + tokS; })());
check('different addresses: different codes', String(rows().find(r => r[19] === cL)[23]).split('#u=')[1] !== tokS);
check('repeat consent keeps the first date', (() => { const i = rows().findIndex(r => r[19] === cS); rows()[i][21] = 'раньше'; post({ action: 'subscribe', to: 'sub@b.co', lang: 'ru', code: cS }); return rows()[i][20] === 'да' && rows()[i][21] === 'раньше'; })());
check('subscribe: address must match the code', post({ action: 'subscribe', to: 'other@b.co', lang: 'ru', code: cS }).error === 'email mismatch');
check('unsubscribe: bad code rejected', post({ action: 'unsubscribe', u: 'short' }).error === 'bad link' && post({ action: 'unsubscribe' }).error === 'bad link');
check('unsubscribe: unknown code is ok, nothing changes', (() => { const r = post({ action: 'unsubscribe', u: 'A'.repeat(22) }); return r.ok === true && r.rows === 0 && rows().filter(x => x[20] === 'да').length === 3; })());
const rU = post({ action: 'unsubscribe', u: tokS });
check('unsubscribe: every row of the address marked, others untouched, no mail', rU.ok === true && rU.rows === 2 && rows().filter(r => /^отписка 2026-09-07 12:00$/.test(r[20])).length === 2 && rows().find(r => r[19] === cL)[20] === 'да' && sent.length === nBefore + 1);
check('unsubscribe twice: nothing left to change', post({ action: 'unsubscribe', u: tokS }).rows === 0);
check('consent after unsubscribing subscribes again', post({ action: 'subscribe', to: 'sub@b.co', lang: 'ru', code: cS }).subscribed === true && rows().find(r => r[19] === cS)[20] === 'да' && rows().find(r => r[19] === cS)[21] === '2026-09-07 12:00');
check('unsubscribe: wrong token rejected', !TOKEN || JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ token: 'nope', action: 'unsubscribe', u: tokS }) } }).text).error === 'forbidden');
check('consent text and mail lines exist in every language', Object.keys(ctx.DATA).every(lg => ctx.DATA[lg].consent && ctx.DATA[lg].email.subscribed && ctx.DATA[lg].email.unsubscribe && ctx.composeMail(ctx.decodeResult(code), lg, code, true, 'https://x/#u=1').html.includes('https://x/#u=1')));
const own = makeSheet({}, 'x'); own.rows.push(ctx.HEADERS.slice(0, 20).concat(['Моя заметка']), new Array(20).fill('').concat(['важно']));
check('owner columns on the right are kept: subscription columns go after them, once', ctx.subscribeColumn(own) === 22 && ctx.subscribeColumn(own) === 22 && own.rows[0].length === 25 && own.rows[0][20] === 'Моя заметка' && own.rows[0].slice(21).join('|') === 'Рассылка|Согласие получено|Текст согласия|Ссылка для отписки' && own.rows[1][20] === 'важно');
ctx.SAVE_RESULTS = false;
const rN = post({ to: 'nosave@b.co', lang: 'en', code: mk('N', 'nosave@b.co'), subscribe: true });
check('SAVE_RESULTS=false: mail goes, subscription is not claimed', rN.ok === true && rN.subscribed === false && !/unsubscribe\//.test(sent[sent.length - 1].htmlBody) && post({ action: 'subscribe', to: 'nosave@b.co', lang: 'en', code: mk('N', 'nosave@b.co') }).error === 'not saved' && post({ action: 'unsubscribe', u: tokS }).ok === false);
ctx.SAVE_RESULTS = true;
check('doGet ok, reports newsletter support', JSON.parse(ctx.doGet().text).ok === true && JSON.parse(ctx.doGet().text).newsletter === true);
// ---- расширенный отчёт: PDF приходит с сервера сборки, письмо уходит покупателю ----
const raw = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text); // без токена сайта: у запроса свой секрет
const pdfB64 = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3000, 32)]).toString('base64');
const cX = mk('Пётр Буянов', '', '2026-10-01T10:00:00Z'), fX = 'Первопроходец (DI) — расширенный отчёт DISC — Пётр Буянов.pdf';
const ext = o => raw(Object.assign({ action: 'extended', secret: 's3cret', to: 'buyer@b.co', lang: 'ru', code: cX, pdf: pdfB64, filename: fX }, o));
const extCol = () => sheet1().rows[0].indexOf('Расширенный отчёт'), rowX = () => rows().find(r => r[19] === cX);
let nX = sent.length;
check('extended: off until the secret is set in script properties', ext({}).error === 'forbidden' && JSON.parse(ctx.doGet().text).extended === false);
props.extendedSecret = 's3cret';
check('extended: wrong or missing secret rejected, nothing sent', ext({ secret: 'nope' }).error === 'forbidden' && ext({ secret: '' }).error === 'forbidden' && ext({ secret: TOKEN }).error === 'forbidden' && sent.length === nX);
check('extended: bad address, bad code, not a pdf, language without the report', ext({ to: 'nobody' }).error === 'bad email' && ext({ code: 'DISC1.zzz' }).error === 'bad code' &&
  ext({ pdf: Buffer.alloc(3000, 65).toString('base64') }).error === 'bad pdf' && ext({ pdf: '***' }).error === 'bad pdf' && ext({ pdf: '' }).error === 'bad pdf' && /^no extended report/.test(ext({ lang: 'en' }).error) && sent.length === nX);
const rX = ext({ order: '1042' }), mX = sent[sent.length - 1];
check('extended: accepted without the site token, one mail to the buyer', rX.ok === true && rX.saved === true && rX.warned === false && sent.length === nX + 1 && mX.to === 'buyer@b.co');
check('extended mail: subject with profile, from the domain address, brand name', mX.subject === 'Ваш расширенный отчёт DISC: DI · Первопроходец' && mX.from === 'info@disc-test.org' && mX.name === 'Тест DISC · disc-test.org');
check('extended mail: pdf attached under the report name, bytes intact', mX.attachments.length === 1 && mX.attachments[0].getContentType() === 'application/pdf' && mX.attachments[0].getName() === fX && mX.attachments[0].getBytes().length === 3009);
check('extended mail: greeting, texts and result link in html and text', [mX.htmlBody, mX.body].every(s => s.includes('Пётр Буянов') && s.includes('во вложении') && s.includes('Как со мной работать') && s.includes('/ru/#r=' + cX)) && !/\{\w+\}|undefined/.test(mX.htmlBody + mX.body));
check('extended: result saved once, column added on the right, cell says when, where and the order', rows().filter(r => r[19] === cX).length === 1 && extCol() >= 24 && rowX()[extCol()] === 'отправлен 2026-09-07 12:00 на buyer@b.co, заказ 1042');
const rX2 = ext({ to: 'other@b.co', notes: ['профиль сбалансированный', 'полупустые листы: 24  ← проверьте'] }), mN = sent[sent.length - 1];
check('extended with build notes: buyer still gets the report, owner gets the notes', rX2.ok === true && rX2.warned === true && sent.length === nX + 3 && sent[sent.length - 2].to === 'other@b.co' && sent[sent.length - 2].attachments.length === 1 &&
  mN.to === 'info@disc-test.org' && /с замечаниями: Пётр Буянов/.test(mN.subject) && mN.body.includes('профиль сбалансированный') && mN.body.includes('other@b.co') && !mN.attachments);
check('extended: second sending is appended to the cell, row and column not duplicated', rows().filter(r => r[19] === cX).length === 1 && sheet1().rows[0].filter(h => h === 'Расширенный отчёт').length === 1 &&
  rowX()[extCol()] === 'отправлен 2026-09-07 12:00 на buyer@b.co, заказ 1042; отправлен 2026-09-07 12:00 на other@b.co');
const nRowsX = rows().length;
check('extended for a result already in the table: same row marked', ext({ code, to: 'ivan@example.com' }).ok === true && rows().length === nRowsX && /^отправлен .* на ivan@example\.com$/.test(rows().find(r => r[19] === code)[extCol()]));
check('extended: file name without .pdf or with a path is replaced', (() => { ext({ to: 'n1@b.co', filename: '../../etc/passwd' }); const a = sent[sent.length - 1].attachments[0].getName(); ext({ to: 'n2@b.co', filename: 'a/b\\c.pdf' }); return a === 'DISC-extended.pdf' && sent[sent.length - 1].attachments[0].getName() === 'a b c.pdf'; })());
mailFail = 'Service invoked too many times';
const rXF = ext({ to: 'fail@b.co' });
mailFail = null;
check('extended: mail error is returned and written to the cell', rXF.ok === false && /too many times/.test(rXF.error) && /ошибка 2026-09-07 12:00: Service invoked/.test(rowX()[extCol()]));
check('extended: at most 5 reports per address per hour', (() => { let last; for (let i = 0; i < 6; i++) last = ext({ to: 'loop@b.co' }); return last.error === 'too many' && sent.filter(m => m.to === 'loop@b.co').length === 5; })());
check('extended: reports do not use up the daily counter of result mails', (() => { const k = Object.keys(store).find(x => x.startsWith('day:')), was = store[k]; ext({ to: 'quota@b.co' }); return store[k] === was; })());
check('extended texts exist only where the report is written', Object.keys(ctx.DATA).filter(lg => ctx.DATA[lg].extended).join() === 'ru' && Object.values(ctx.DATA.ru.extended).every(s => typeof s === 'string' && s.trim()));
check('doGet reports that extended delivery is on', JSON.parse(ctx.doGet().text).extended === true);
fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'disc-extended-mail-preview.html'), mX.htmlBody);
fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'disc-mail-preview.html'), mail.htmlBody);
fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'disc-pdf-preview.html'), pdf.source);
fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'disc-pdf-preview-ar.html'), sent[2].attachments[0].source);
console.log(fails ? `FAILED: ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
