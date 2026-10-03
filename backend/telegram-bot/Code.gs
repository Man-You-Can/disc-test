/**
 * Тест DISC — бот в Telegram на Google Apps Script (отдельный проект, не тот, что шлёт письма).
 *
 * Файл backend/telegram-bot/Code.gs генерируется командой `node build.js` из
 * src/telegram-bot.template.js, site.config.json и русской локали. Как развернуть — README.md,
 * раздел «Бот в Telegram».
 *
 * Бот справочный: на /start показывает меню из трёх кнопок — «Пройти тест бесплатно» (ссылка
 * на сайт), «Расширенная версия» (описание платной услуги, цена, оферта, условия возврата,
 * реквизиты исполнителя) и «Задать вопрос» (форма обратной связи и e-mail). Сообщения
 * пользователей бот не хранит и никуда не пересылает.
 *
 * Токен бота в код не вписывается: он лежит в свойствах скрипта (BOT_TOKEN), там же адрес
 * веб-приложения (WEBAPP_URL). Функция setup() ставит вебхук, меню команд и описание бота.
 * Telegram не подписывает запросы заголовком, доступным в Apps Script, поэтому в адрес
 * вебхука добавляется секретный ключ (?key=…, свойство WEBHOOK_KEY создаётся в setup);
 * запросы без ключа игнорируются.
 */
var SITE_URL = 'https://disc-test.org';
var HOME_URL = SITE_URL + '/ru/';
var PRICE = '490';               // servicePriceRub в site.config.json
var SERVICE_NAME = "Расширенная версия DISC";       // content.services.name в ru.json
var LEGAL = "Манукян Армен Кеворкович\nИНН 771583655604";                     // реквизиты исполнителя: ui.legal в ru.json и legalInn, две строки
var CONTACT_EMAIL = 'info@disc-test.org';   // feedbackEmail в site.config.json

// «Описание» видно в пустом чате до нажатия «Запустить» (до 512 знаков), «О боте» — в профиле бота (до 120 знаков)
var DESCRIPTION = 'Бесплатный тест поведенческих стилей DISC на сайте disc-test.org: 24 блока, около 10 минут, без регистрации.\n\n' +
  'В боте — ссылка на тест, сведения о платной услуге «' + SERVICE_NAME + '» (' + PRICE + ' ₽) и контакты.\n\n' + LEGAL;
var ABOUT = 'Тест DISC и расширенная версия. ' + LEGAL.replace(/\n/g, ', ');
var COMMANDS = [
  { command: 'start', description: 'Главное меню' },
  { command: 'service', description: 'Расширенная версия DISC' },
  { command: 'help', description: 'Задать вопрос' }
];

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ---- экраны: текст (HTML-разметка Telegram) и кнопки ----
var BACK = [{ text: '← В меню', callback_data: 'home' }];
function screen(name) {
  if (name === 'service') return {
    text: '<b>' + esc(SERVICE_NAME) + ' — ' + PRICE + ' ₽</b>\n\n' +
      'Более подробный разбор вашего профиля DISC по итогам теста.\n\n' +
      '<b>Как получить.</b> Расширенная версия направляется письмом на e-mail, указанный при оплате, не позднее 24 часов с момента оплаты.\n\n' +
      'Сам тест и результат на сайте остаются бесплатными, расширенная версия приобретается только по желанию.\n\n' +
      'Услуга оказывается на условиях публичной оферты; случаи и порядок возврата денег описаны в условиях возврата.\n\n' +
      esc(LEGAL),
    keyboard: [
      [{ text: 'Страница услуги', url: HOME_URL + 'services/' }],
      [{ text: 'Публичная оферта', url: HOME_URL + 'offer/' }, { text: 'Условия возврата', url: HOME_URL + 'refund/' }],
      BACK
    ]
  };
  if (name === 'ask') return {
    text: '<b>Вопросы</b>\n\n' +
      'Напишите нам через форму обратной связи на сайте или на ' + esc(CONTACT_EMAIL) + ' — ответ придёт на указанный вами e-mail.\n\n' +
      'Сообщения в этом чате никто не читает: бот только показывает информацию.\n\n' +
      esc(LEGAL),
    keyboard: [[{ text: 'Форма обратной связи', url: HOME_URL + 'contact/' }], BACK]
  };
  return {
    text: '<b>DISC Test</b> — бесплатный тест поведенческих стилей DISC.\n\n' +
      '24 блока, около 10 минут, без регистрации. Результат сразу на экране: ваш профиль, график четырёх стилей и описание.\n\n' +
      'Что вас интересует?',
    keyboard: [
      [{ text: 'Пройти тест бесплатно', url: HOME_URL }],
      [{ text: 'Расширенная версия — ' + PRICE + ' ₽', callback_data: 'service' }],
      [{ text: 'Задать вопрос', callback_data: 'ask' }]
    ]
  };
}
function payload(chatId, name, prefix) {
  var s = screen(name);
  return { chat_id: chatId, text: (prefix || '') + s.text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: s.keyboard } };
}

// ---- вебхук ----
function doGet() { return done(); }

function doPost(e) {
  try {
    var key = prop('WEBHOOK_KEY');
    if (!key || !e || !e.parameter || e.parameter.key !== key) return done();
    var u = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (!seen(u.update_id)) handle(u);
  } catch (err) {
    console.error(String((err && err.message) || err));
  }
  return done();
}

// Отвечать нужно HtmlService: ответ ContentService отдаётся через переадресацию (302), Telegram считает её ошибкой и повторяет запрос
function done() { return HtmlService.createHtmlOutput('ok'); }

// Telegram повторяет запрос, если не дождался ответа; повтор с тем же update_id пропускаем
function seen(id) {
  if (id === undefined || id === null) return false;
  var cache = CacheService.getScriptCache(), k = 'u' + id;
  if (cache.get(k)) return true;
  cache.put(k, '1', 600);
  return false;
}

function handle(u) {
  var cb = u.callback_query;
  if (cb) {
    api('answerCallbackQuery', { callback_query_id: cb.id });
    var msg = cb.message;
    if (!msg || !msg.chat || msg.chat.type !== 'private') return;
    var name = cb.data === 'service' || cb.data === 'ask' ? cb.data : 'home';
    var p = payload(msg.chat.id, name);
    p.message_id = msg.message_id;
    if (!api('editMessageText', p).ok) { delete p.message_id; api('sendMessage', p); }  // старое сообщение править нельзя — шлём новое
    return;
  }
  var m = u.message;
  if (!m || !m.chat || m.chat.type !== 'private') return;  // в группах и каналах бот молчит
  var cmd = (/^\/([a-z]+)/.exec(String(m.text || '')) || [])[1];
  if (cmd === 'start') api('sendMessage', payload(m.chat.id, 'home'));
  else if (cmd === 'service') api('sendMessage', payload(m.chat.id, 'service'));
  else if (cmd === 'help') api('sendMessage', payload(m.chat.id, 'ask'));
  else api('sendMessage', payload(m.chat.id, 'home', 'Сообщения в этом чате никто не читает. Вопрос можно задать по кнопке «Задать вопрос».\n\n'));
}

// ---- Telegram Bot API ----
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }

function api(method, data) {
  var token = prop('BOT_TOKEN');
  if (!token) throw new Error('В свойствах скрипта нет BOT_TOKEN');
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method,
    { method: 'post', contentType: 'application/json', payload: JSON.stringify(data || {}), muteHttpExceptions: true });
  try { return JSON.parse(res.getContentText()) || {}; } catch (err) { return { ok: false, description: 'bad response' }; }
}

/**
 * Запускается вручную из редактора после развёртывания веб-приложения: ставит вебхук,
 * меню команд, «Описание» и «О боте». Повторный запуск безопасен (например, после смены
 * цены или текстов). Нужны свойства скрипта BOT_TOKEN и WEBAPP_URL.
 */
function setup() {
  var url = prop('WEBAPP_URL').trim();
  if (!prop('BOT_TOKEN')) throw new Error('Добавьте в свойства скрипта BOT_TOKEN — токен от @BotFather');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error('Добавьте в свойства скрипта WEBAPP_URL — адрес веб-приложения вида https://script.google.com/macros/s/…/exec');
  var me = api('getMe');
  if (!me.ok) throw new Error('Telegram не принял токен: ' + (me.description || 'нет ответа'));
  var key = prop('WEBHOOK_KEY');
  if (!key) { key = Utilities.getUuid().replace(/-/g, ''); PropertiesService.getScriptProperties().setProperty('WEBHOOK_KEY', key); }
  var steps = [
    ['setWebhook', { url: url + '?key=' + key, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true }],
    ['setMyCommands', { commands: COMMANDS }],
    ['setMyDescription', { description: DESCRIPTION }],
    ['setMyShortDescription', { short_description: ABOUT }]
  ];
  var failed = [];
  steps.forEach(function (s) { var r = api(s[0], s[1]); if (!r.ok) failed.push(s[0] + ': ' + (r.description || 'нет ответа')); });
  if (failed.length) throw new Error('Не выполнено: ' + failed.join('; '));
  var report = 'Бот @' + me.result.username + ' настроен: вебхук, команды, описание.';
  console.log(report);
  return report;
}

/** Состояние вебхука: если бот молчит, запустите и посмотрите журнал выполнения (адрес показан без ключа). */
function status() {
  var r = api('getWebhookInfo').result || {};
  var report = 'Вебхук: ' + (r.url ? r.url.replace(/\?.*$/, '') : 'не установлен') + '; в очереди: ' + (r.pending_update_count || 0) +
    (r.last_error_message ? '; последняя ошибка: ' + r.last_error_message : '; ошибок нет');
  console.log(report);
  return report;
}
