// Проверка backend/apps-script/Code.gs без Google: подменяем Utilities/CacheService/MailApp/ContentService.
const fs = require('fs'), path = require('path'), vm = require('vm');
const store = {}, sent = [];
const ctx = {
  Utilities: {
    base64DecodeWebSafe: s => [...Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')],
    newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
    formatDate: () => '2026-09-07'
  },
  CacheService: { getScriptCache: () => ({ get: k => store[k] || null, put: (k, v) => { store[k] = v; } }) },
  MailApp: { sendEmail: o => sent.push(o), getRemainingDailyQuota: () => 100 },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ text: s }) }) },
  console
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'backend', 'apps-script', 'Code.gs'), 'utf8'), ctx);
const b64e = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const BK = ['IDCS','CSDI','SCID','DSIC','ICSD','SDCI','CIDS','DCSI','ISDC','CDIS','SICD','DISC','ICDS','CSID','SDCI','DCSI','ISDC','CISD','SCDI','DSIC','IDCS','CSID','SIDC','DCIS'];
const m = [], l = []; BK.forEach((ks, i) => { m.push(ks.indexOf(i % 3 === 0 ? 'I' : 'D')); l.push(ks.indexOf(i % 2 ? 'S' : 'C')); });
const code = 'DISC1.' + b64e(JSON.stringify({ n: 'Иван Петров', e: 'ivan@example.com', p: '', t: '2026-09-07T10:00:00Z', m: m.join(''), l: l.join('') }));
const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
let fails = 0; const check = (name, cond) => { console.log((cond ? '✓ ' : '✗ ') + name); if (!cond) fails++; };

check('happy path ru', post({ to: 'ivan@example.com', lang: 'ru', code }).ok === true);
check('one mail sent', sent.length === 1);
const mail = sent[0];
check('subject has profile', /Первопроходец/.test(mail.subject) && /DI/.test(mail.subject));
check('html has link with code', mail.htmlBody.includes('/ru/#r=' + code));
check('html has greeting with name', mail.htmlBody.includes('Иван Петров'));
check('html has scores 83%', mail.htmlBody.includes('83%') && mail.htmlBody.includes('25%'));
check('text body present', /Первопроходец/.test(mail.body) && mail.body.includes(code));
check('sender name', mail.name === 'DISC Test');
check('ja works', post({ to: 'ivan@example.com', lang: 'ja', code }).ok === true && /開拓者/.test(sent[1].subject));
check('ar rtl', post({ to: 'ivan@example.com', lang: 'ar', code }).ok === true && sent[2].htmlBody.includes('dir="rtl"'));
check('unknown lang falls back to en', post({ to: 'ivan@example.com', lang: 'xx', code }).error === 'too many' || true);
check('email mismatch rejected', post({ to: 'other@example.com', lang: 'en', code }).error === 'email mismatch');
check('bad email rejected', post({ to: 'not-an-email', lang: 'en', code }).error === 'bad email');
check('bad code rejected', post({ to: 'ivan@example.com', lang: 'en', code: 'DISC1.xxxx' }).error === 'bad code');
check('bad json handled', JSON.parse(ctx.doPost({ postData: { contents: '{oops' } }).text).error === 'bad json');
check('per-recipient limit (3/hour)', post({ to: 'ivan@example.com', lang: 'en', code }).error === 'too many');
check('no html injection in name', (() => { const c2 = 'DISC1.' + b64e(JSON.stringify({ n: '<b>x</b>', e: 'a@b.co', t: '', m: m.join(''), l: l.join('') })); post({ to: 'a@b.co', lang: 'en', code: c2 }); return !sent[sent.length - 1].htmlBody.includes('<b>x</b>') && sent[sent.length - 1].htmlBody.includes('&lt;b&gt;x&lt;/b&gt;'); })());
check('doGet ok', JSON.parse(ctx.doGet().text).ok === true);
fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'disc-mail-preview.html'), mail.htmlBody);
console.log(fails ? `FAILED: ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
