// Проверка backend/apps-script/Code.gs без Google: подменяем Utilities/CacheService/MailApp/ContentService,
// а также SpreadsheetApp/PropertiesService/LockService/Session (база результатов в таблице).
const fs = require('fs'), path = require('path'), vm = require('vm');
const store = {}, sent = [], props = {}, books = {};
let mailFail = null; // текст ошибки, которую бросит MailApp.sendEmail (null — письма уходят)
const fetched = []; let fetchReply = { code: 201, body: '{"messageId":"<202609071200.123@smtp-relay.mailin.fr>"}' }; // ответ сервиса рассылки
function makeSheet(ss, name) {
  const rows = [];
  const sh = {
    rows, getName: () => name, setName: n => { name = n; return sh; }, getParent: () => ss, setFrozenRows: () => sh,
    appendRow: r => { rows.push(r.slice()); return sh; }, getLastRow: () => rows.length,
    getRange: (row, col, nRows, nCols) => {
      if (typeof row === 'string') return { setNumberFormat: () => {}, setFontWeight: () => {} };
      return {
        getValues: () => Array.from({ length: nRows || 1 }, (_, i) => Array.from({ length: nCols || 1 }, (_, j) => (rows[row - 1 + i] || [])[col - 1 + j] ?? '')),
        setValue: v => { while (rows.length < row) rows.push([]); rows[row - 1][col - 1] = v; },
        setNumberFormat: () => {}, setFontWeight: () => {}
      };
    }
  };
  return sh;
}
function makeBook(title) {
  const id = 'book' + (Object.keys(books).length + 1), ss = { id, title, sheets: [] };
  Object.assign(ss, { getId: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id + '/edit', getSheets: () => ss.sheets,
    getSheetByName: n => ss.sheets.find(s => s.getName() === n) || null, insertSheet: n => { const s = makeSheet(ss, n); ss.sheets.push(s); return s; } });
  ss.sheets.push(makeSheet(ss, 'Лист1')); books[id] = ss; return ss;
}
const ctx = {
  Utilities: {
    base64DecodeWebSafe: s => [...Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')],
    base64Decode: s => { if (!/^[A-Za-z0-9+/=]*$/.test(s)) throw new Error('bad base64'); return [...Buffer.from(s, 'base64')]; },
    newBlob: (bytes, type, name) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8'), getBytes: () => bytes, getContentType: () => type, getName: () => name }),
    formatDate: (d, tz, fmt) => /H/.test(fmt) ? '2026-09-07 12:00' : '2026-09-07'
  },
  CacheService: { getScriptCache: () => ({ get: k => store[k] || null, put: (k, v) => { store[k] = v; } }) },
  MailApp: { sendEmail: o => { if (mailFail) throw new Error(mailFail); sent.push(o); }, getRemainingDailyQuota: () => 100 },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ text: s }) }) },
  SpreadsheetApp: { create: makeBook, openById: id => { if (!books[id]) throw new Error('not found'); return books[id]; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  UrlFetchApp: { fetch: (url, o) => { fetched.push({ url, o, payload: JSON.parse(o.payload) }); return { getResponseCode: () => fetchReply.code, getContentText: () => fetchReply.body }; } },
  Session: { getScriptTimeZone: () => 'UTC', getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
  Logger: { log: () => {} },
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
check('sender name', mail.name === 'DISC Test');

// ---- база результатов ----
check('sheet created and remembered', Object.keys(books).length === 1 && props.sheetId === 'book1');
check('header row', rows()[0][0] === 'Получено' && rows()[0][17] === 'Код результата');
const row = rows()[1];
check('one data row', rows().length === 2);
check('row: dates', isDate(row[0]) && isDate(row[1]) && row[1].toISOString() === '2026-09-07T10:00:00.000Z');
check('row: name, email, lang', row[2] === 'Иван Петров' && row[3] === 'ivan@example.com' && row[4] === 'ru');
check('row: profile', row[5] === 'DI' && row[6] === 'Первопроходец');
check('row: net scores', row[7] === 16 && row[8] === 8 && row[9] === -12 && row[10] === -12);
check('row: percents', row[11] === 83 && row[12] === 67 && row[13] === 25 && row[14] === 25);
check('row: mail status sent (no API key → gmail)', row[15] === 'отправлено 2026-09-07 12:00 (gmail)' && fetched.length === 0);
check('row: link and code', row[16] === 'https://disc-test.org/ru/#r=' + code && row[17] === code);

check('ja works', post({ to: 'ivan@example.com', lang: 'ja', code }).ok === true && /開拓者/.test(sent[1].subject));
check('same code not duplicated', rows().length === 2);
check('ar rtl', post({ to: 'ivan@example.com', lang: 'ar', code }).ok === true && sent[2].htmlBody.includes('dir="rtl"'));
const r4 = post({ to: 'ivan@example.com', lang: 'xx', code });
check('per-recipient limit (3/hour) still reports saved', r4.error === 'too many' && r4.saved === true);
check('row: mail status after limit', rows()[1][15] === 'не отправлено: too many');
check('email mismatch rejected, not saved', post({ to: 'other@example.com', lang: 'en', code }).error === 'email mismatch' && rows().length === 2);
check('bad email rejected', post({ to: 'not-an-email', lang: 'en', code }).error === 'bad email');
check('bad code rejected, not saved', post({ to: 'ivan@example.com', lang: 'en', code: 'DISC1.xxxx' }).error === 'bad code' && rows().length === 2);
check('wrong token rejected, not saved', !TOKEN || (JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ token: 'nope', to: 'ivan@example.com', lang: 'en', code }) } }).text).error === 'forbidden' && rows().length === 2));
check('bad json handled', JSON.parse(ctx.doPost({ postData: { contents: '{oops' } }).text).error === 'bad json');

mailFail = 'Service invoked too many times';
const c2 = mk('Anna Lee', 'anna@example.com', 'not-a-date');
const r5 = post({ to: 'anna@example.com', lang: 'en', code: c2 });
check('mail failure: saved, ok=false', r5.ok === false && r5.saved === true && /too many times/.test(r5.error));
check('mail failure row: status error, date fallback', rows().length === 3 && /^ошибка: /.test(rows()[2][15]) && isDate(rows()[2][1]) && rows()[2][6] === 'Pioneer');
mailFail = null;
check('retry after failure: same row, status sent', post({ to: 'anna@example.com', lang: 'en', code: c2 }).ok === true && rows().length === 3 && /^отправлено/.test(rows()[2][15]));

const c3 = mk('=1+1', 'a@b.co');
post({ to: 'a@b.co', lang: 'en', code: c3 });
check('no html injection in name', !sent[sent.length - 1].htmlBody.includes('<b>x</b>') && (() => { const c4 = mk('<b>x</b>', 'x@b.co'); post({ to: 'x@b.co', lang: 'en', code: c4 }); const h = sent[sent.length - 1].htmlBody; return !h.includes('<b>x</b>') && h.includes('&lt;b&gt;x&lt;/b&gt;'); })());
check('no formula injection in sheet', rows()[3][2] === ' =1+1');
check('code with surrounding text is trimmed', (() => { const c5 = mk('Пётр', 'p@b.co'); post({ to: 'p@b.co', lang: 'ru', code: 'см. ' + c5 + ' конец' }); return rows()[rows().length - 1][17] === c5; })());

// языки второй волны, в том числе код с дефисом (zh-hant): письмо на своём языке, ссылка ведёт в свою папку, язык попадает в таблицу
check('new languages: zh-hant, id, tr, pl', ['zh-hant', 'id', 'tr', 'pl'].every(lg => { const to = lg + '@b.co', cc = mk('Lin', to); const r = post({ to, lang: lg, code: cc }), m = sent[sent.length - 1], row = rows()[rows().length - 1];
  return r.ok === true && m.to === to && m.htmlBody.includes('<html lang="' + lg + '"') && m.htmlBody.includes('/' + lg + '/#r=' + cc) && row[4] === lg && row[16] === 'https://disc-test.org/' + lg + '/#r=' + cc; }));

// ---- сервис рассылки ----
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site.config.json'), 'utf8'));
if (ctx.MAIL_PROVIDER === 'brevo' && ctx.MAIL_FROM) {
  props.MAIL_API_KEY = 'xkeysib-test';
  const gBefore = sent.length, cb = mk('Brevo User', 'b1@example.com');
  const rb = post({ to: 'b1@example.com', lang: 'de', code: cb });
  const f = fetched[fetched.length - 1], rowB = rows()[rows().length - 1];
  check('brevo: ok, API called, gmail not used', rb.ok === true && fetched.length === 1 && sent.length === gBefore);
  check('brevo: url and key header', f.url === 'https://api.brevo.com/v3/smtp/email' && f.o.headers['api-key'] === 'xkeysib-test' && f.o.muteHttpExceptions === true);
  check('brevo: payload', f.payload.sender.email === CFG.mailFrom && f.payload.sender.name === 'DISC Test' && f.payload.to[0].email === 'b1@example.com' &&
    f.payload.htmlContent.includes('/de/#r=' + cb) && f.payload.textContent.includes(cb) && !!f.payload.subject && (CFG.mailReplyTo ? f.payload.replyTo.email === CFG.mailReplyTo : !f.payload.replyTo));
  check('brevo: row status with message id', rowB[15] === 'отправлено 2026-09-07 12:00 (brevo, 202609071200.123@smtp-relay.mailin.fr)');
  check('doGet reports provider', JSON.parse(ctx.doGet().text).mail === 'brevo');
  fetchReply = { code: 401, body: '{"code":"unauthorized","message":"Key not found"}' };
  const cf = mk('Fallback', 'b2@example.com'), rf = post({ to: 'b2@example.com', lang: 'en', code: cf });
  check('brevo error → gmail fallback', rf.ok === true && sent.length === gBefore + 1 && sent[sent.length - 1].to === 'b2@example.com' &&
    rows()[rows().length - 1][15] === 'отправлено 2026-09-07 12:00 (gmail); brevo: HTTP 401 Key not found');
  mailFail = 'Service invoked too many times';
  const cx = mk('Both', 'b3@example.com'), rx = post({ to: 'b3@example.com', lang: 'en', code: cx });
  check('brevo and gmail both fail → error, saved', rx.ok === false && rx.saved === true && /^ошибка: brevo: HTTP 401 .*; gmail: Service invoked/.test(rows()[rows().length - 1][15]));
  mailFail = null;
  ctx.GMAIL_FALLBACK = false;
  const cn = mk('NoFallback', 'b4@example.com'), rn = post({ to: 'b4@example.com', lang: 'en', code: cn });
  check('GMAIL_FALLBACK=false: error, gmail not used', rn.ok === false && /^brevo: HTTP 401/.test(rn.error) && !sent.some(x => x.to === 'b4@example.com'));
  ctx.GMAIL_FALLBACK = true;
  fetchReply = { code: 201, body: '{"messageId":"<t1@relay>"}' };
  check('testMail sends to script owner via provider', ctx.testMail() === 't1@relay' && fetched[fetched.length - 1].payload.to[0].email === 'owner@example.com' && /^\[test\] /.test(fetched[fetched.length - 1].payload.subject));
  ctx.MAIL_PROVIDER = 'resend';
  const cr2 = mk('Resend User', 'r1@example.com');
  fetchReply = { code: 200, body: '{"id":"re_123"}' };
  const rr = post({ to: 'r1@example.com', lang: 'en', code: cr2 }), fr = fetched[fetched.length - 1];
  check('resend: bearer, from, status', rr.ok === true && fr.url === 'https://api.resend.com/emails' && fr.o.headers.Authorization === 'Bearer xkeysib-test' &&
    fr.payload.from === 'DISC Test <' + CFG.mailFrom + '>' && fr.payload.to[0] === 'r1@example.com' && /\(resend, re_123\)$/.test(rows()[rows().length - 1][15]));
  ctx.MAIL_PROVIDER = 'brevo';
  delete props.MAIL_API_KEY;
  check('no key again → gmail, doGet reports gmail', JSON.parse(ctx.doGet().text).mail === 'gmail');
} else console.log('(mailProvider не brevo — проверки сервиса рассылки пропущены)');

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
check('contact: to feedback address, replyTo sender', !CONTACT_TO || (cm.to === CONTACT_TO && cm.replyTo === 'maria@example.com' && cm.name === 'DISC Test'));
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

check('setup returns sheet url', ctx.setup() === 'https://docs.google.com/spreadsheets/d/book1/edit' && Object.keys(books).length === 1);
check('doGet ok', JSON.parse(ctx.doGet().text).ok === true);
fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'disc-mail-preview.html'), mail.htmlBody);
console.log(fails ? `FAILED: ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
