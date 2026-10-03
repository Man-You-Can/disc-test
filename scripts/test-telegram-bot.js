// Проверка backend/telegram-bot/Code.gs без Google и Telegram: подменяем UrlFetchApp/PropertiesService/CacheService/HtmlService/Utilities.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const props = {}, cache = {}, calls = [];
let failMethod = null; // метод Bot API, на который «Telegram» ответит ошибкой
const ctx = {
  UrlFetchApp: { fetch: (url, o) => {
    const method = url.split('/').pop(), data = JSON.parse(o.payload);
    calls.push({ url, method, data });
    const body = method === failMethod ? { ok: false, description: 'Bad Request: test' }
      : { ok: true, result: method === 'getMe' ? { username: 'disc_test_bot' } : method === 'getWebhookInfo' ? { url: 'https://script.google.com/macros/s/AKfy/exec?key=secret', pending_update_count: 0 } : true };
    return { getContentText: () => JSON.stringify(body) };
  } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  HtmlService: { createHtmlOutput: s => ({ html: s }) },
  Utilities: { getUuid: () => '0f8fad5b-d9cb-469f-a165-70867728950e' },
  console: { log: () => {}, error: () => {} }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'backend', 'telegram-bot', 'Code.gs'), 'utf8'), ctx);

let fails = 0; const check = (name, cond) => { console.log((cond ? '✓ ' : '✗ ') + name); if (!cond) fails++; };
const throws = fn => { try { fn(); return ''; } catch (e) { return String(e.message); } };
const TOKEN = '123456:TEST', URL_OK = 'https://script.google.com/macros/s/AKfy-cb_x/exec';
const INN = String(cfg.legalInn), PRICE = String(cfg.servicePriceRub);
let uid = 100;
const post = (update, key) => { calls.length = 0; return ctx.doPost({ parameter: { key: key === undefined ? props.WEBHOOK_KEY : key }, postData: { contents: JSON.stringify(Object.assign({ update_id: ++uid }, update)) } }); };
const msg = (text, type) => ({ message: { message_id: 7, chat: { id: 42, type: type || 'private' }, text } });
const tap = data => ({ callback_query: { id: 'cb1', data, message: { message_id: 7, chat: { id: 42, type: 'private' } } } });
const buttons = c => [].concat(...c.data.reply_markup.inline_keyboard);

// ---- настройка ----
check('setup: без токена — понятная ошибка', /BOT_TOKEN/.test(throws(() => ctx.setup())));
props.BOT_TOKEN = TOKEN;
check('setup: без адреса веб-приложения — понятная ошибка', /WEBAPP_URL/.test(throws(() => ctx.setup())));
props.WEBAPP_URL = 'https://script.google.com/macros/s/AKfy-cb_x/dev';
check('setup: адрес /dev не подходит', /WEBAPP_URL/.test(throws(() => ctx.setup())) && !calls.length);
props.WEBAPP_URL = URL_OK;
const report = ctx.setup(), by = m => calls.find(c => c.method === m);
check('setup: отчёт с именем бота', /@disc_test_bot/.test(report));
check('setup: ключ вебхука создан и добавлен в адрес', props.WEBHOOK_KEY.length === 32 && by('setWebhook').data.url === URL_OK + '?key=' + props.WEBHOOK_KEY);
check('setup: запросы идут в Bot API с токеном', calls.every(c => c.url === 'https://api.telegram.org/bot' + TOKEN + '/' + c.method));
check('setup: команды start, service, help', by('setMyCommands').data.commands.map(c => c.command).join() === 'start,service,help');
const desc = by('setMyDescription').data.description, about = by('setMyShortDescription').data.short_description;
check('setup: описание до 512 знаков, с реквизитами как в шаблоне платёжной системы', desc.length <= 512 && desc.endsWith('Манукян Армен Кеворкович\nИНН ' + INN) && desc.includes(PRICE + ' ₽'));
check('setup: «О боте» до 120 знаков, одной строкой, с именем и ИНН', about.length <= 120 && !about.includes('\n') && about.includes('Манукян Армен Кеворкович, ИНН ' + INN));
const keyBefore = props.WEBHOOK_KEY; ctx.setup();
check('setup: повторный запуск ключ не меняет', props.WEBHOOK_KEY === keyBefore);
failMethod = 'setMyDescription';
check('setup: отказ Telegram виден в ошибке', /setMyDescription: Bad Request: test/.test(throws(() => ctx.setup())));
failMethod = 'getMe';
check('setup: неверный токен — понятная ошибка', /не принял токен/.test(throws(() => ctx.setup())));
failMethod = null;
check('status: адрес без ключа', /exec; в очереди: 0; ошибок нет/.test(ctx.status()) && !ctx.status().includes('secret'));

// ---- вебхук ----
check('ответ вебхука — HtmlService (без переадресации)', post(msg('/start')).html === 'ok' && ctx.doGet().html === 'ok');
check('без ключа запрос игнорируется', (post(msg('/start'), '') , calls.length === 0) && (post(msg('/start'), 'nope'), calls.length === 0));
post(msg('/start'));
const home = calls[0];
check('/start: одно сообщение с тремя кнопками', calls.length === 1 && home.method === 'sendMessage' && home.data.chat_id === 42 && home.data.parse_mode === 'HTML' && buttons(home).length === 3);
check('/start: тест по ссылке, услуга и вопрос — кнопки', buttons(home)[0].url === cfg.siteUrl + '/ru/' && buttons(home)[1].callback_data === 'service' && buttons(home)[1].text.includes(PRICE + ' ₽') && buttons(home)[2].callback_data === 'ask');
check('/start с параметром и /start@имя_бота', (post(msg('/start promo')), calls[0].data.text === home.data.text) && (post(msg('/start@disc_test_bot')), calls[0].data.text === home.data.text));
post(msg('/service'));
const service = calls[0];
check('/service: цена, срок, реквизиты', service.data.text.includes('Расширенная версия DISC — ' + PRICE + ' ₽') && service.data.text.includes('не позднее 24 часов') && service.data.text.endsWith('Манукян Армен Кеворкович\nИНН ' + INN));
check('/service: ссылки на услугу, оферту и возврат', ['services/', 'offer/', 'refund/'].every(p => buttons(service).some(b => b.url === cfg.siteUrl + '/ru/' + p)));
post(msg('/help'));
check('/help: форма обратной связи и e-mail', calls[0].data.text.includes(cfg.feedbackEmail) && buttons(calls[0]).some(b => b.url === cfg.siteUrl + '/ru/contact/'));
post(msg('Здравствуйте, сколько стоит?'));
check('обычный текст: пояснение и меню', calls.length === 1 && calls[0].data.text.startsWith('Сообщения в этом чате никто не читает') && buttons(calls[0]).length === 3);
post({ message: { message_id: 8, chat: { id: 42, type: 'private' }, photo: [{}] } });
check('сообщение без текста: меню', calls.length === 1 && buttons(calls[0]).length === 3);
check('группа: бот молчит', (post(msg('/start', 'group')), calls.length === 0));
post(tap('service'));
check('кнопка «Расширенная версия»: ответ на нажатие и правка сообщения', calls.length === 2 && calls[0].method === 'answerCallbackQuery' && calls[0].data.callback_query_id === 'cb1' && calls[1].method === 'editMessageText' && calls[1].data.message_id === 7 && calls[1].data.text === service.data.text);
check('кнопка «Задать вопрос»', (post(tap('ask')), calls[1].data.text.includes(cfg.feedbackEmail)));
check('кнопка «В меню» и неизвестные данные — главное меню', (post(tap('home')), calls[1].data.text === home.data.text) && (post(tap('whatever')), calls[1].data.text === home.data.text));
failMethod = 'editMessageText'; post(tap('service')); failMethod = null;
check('сообщение нельзя править — приходит новое', calls.length === 3 && calls[2].method === 'sendMessage' && calls[2].data.message_id === undefined && calls[2].data.text === service.data.text);
post(msg('/start')); const dup = uid; calls.length = 0;
ctx.doPost({ parameter: { key: props.WEBHOOK_KEY }, postData: { contents: JSON.stringify(Object.assign({ update_id: dup }, msg('/start'))) } });
check('повтор того же update_id пропускается', calls.length === 0);
calls.length = 0;
check('битый запрос не роняет скрипт', ctx.doPost({ parameter: { key: props.WEBHOOK_KEY }, postData: { contents: '{oops' } }).html === 'ok' && calls.length === 0);

// ---- содержание ----
const all = [home, service].concat((post(msg('/help')), calls[0]));
check('тексты укладываются в лимит сообщения Telegram', all.every(c => c.data.text.length <= 4096));
check('данные кнопок до 64 байт', all.every(c => buttons(c).every(b => !b.callback_data || Buffer.byteLength(b.callback_data) <= 64)));
const pageOf = url => path.join(ROOT, 'docs', url.slice(cfg.siteUrl.length), 'index.html');
check('страницы по всем ссылкам есть в docs/', all.every(c => buttons(c).filter(b => b.url).every(b => fs.existsSync(pageOf(b.url)))));
check('токена бота в коде нет', !/\d{6,}:[\w-]{30,}/.test(fs.readFileSync(path.join(ROOT, 'backend', 'telegram-bot', 'Code.gs'), 'utf8')));
console.log(fails ? `FAILED: ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
