// Проверка backend/apps-script/Code.gs без Google: подменяем Utilities/CacheService/MailApp/ContentService,
// а также SpreadsheetApp/PropertiesService/LockService/Session (база результатов в таблице).
const fs = require('fs'), path = require('path'), vm = require('vm');
const store = {}, sent = [], props = {}, books = {};
let mailFail = null; // текст ошибки, которую бросит MailApp.sendEmail (null — письма уходят)
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
    newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
    formatDate: (d, tz, fmt) => /H/.test(fmt) ? '2026-09-07 12:00' : '2026-09-07'
  },
  CacheService: { getScriptCache: () => ({ get: k => store[k] || null, put: (k, v) => { store[k] = v; } }) },
  MailApp: { sendEmail: o => { if (mailFail) throw new Error(mailFail); sent.push(o); }, getRemainingDailyQuota: () => 100 },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ text: s }) }) },
  SpreadsheetApp: { create: makeBook, openById: id => { if (!books[id]) throw new Error('not found'); return books[id]; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  Session: { getScriptTimeZone: () => 'UTC' },
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
check('row: mail status sent', /^отправлено 2026-09-07 12:00$/.test(row[15]));
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

ctx.SAVE_RESULTS = false;
const before = rows().length;
check('SAVE_RESULTS=false: mail only', post({ to: 'q@b.co', lang: 'en', code: mk('Q', 'q@b.co') }).saved === false && rows().length === before);
ctx.SAVE_RESULTS = true;

check('setup returns sheet url', ctx.setup() === 'https://docs.google.com/spreadsheets/d/book1/edit' && Object.keys(books).length === 1);
check('doGet ok', JSON.parse(ctx.doGet().text).ok === true);
fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'disc-mail-preview.html'), mail.htmlBody);
console.log(fails ? `FAILED: ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
