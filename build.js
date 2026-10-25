#!/usr/bin/env node
/* Сборка сайта: src/template.html + src/locales/*.json → docs/<lang>/index.html
   Запуск: node build.js */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync } = require('child_process');
const ROOT = __dirname, SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'docs');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const typo = require('./src/typo.js');
// Служебные теги в <head> (site.config.json): подтверждение сайта в Google Search Console и Яндекс Вебмастере
// (googleSiteVerification, yandexVerification) и аналитика (yandexMetrikaId — номер счётчика Яндекс.Метрики,
// analyticsMode — "optin": счётчик загружается после кнопки «Принять» в уведомлении о cookie, "always": сразу).
// Пустое значение — тег не выводится. Сам код счётчика живёт в src/common.js.
// analyticsAlwaysLangs — языки, где счётчик загружается сразу, даже когда analyticsMode — "optin" (решение заказчика от 2026-10-10:
// в русской версии сразу, в остальных — после согласия). Текст уведомления в режиме optin — ui["pd.cookieAsk"], в режиме always — ui["consent.text"].
const analyticsMode = L => cfg.analyticsMode === "always" || (cfg.analyticsAlwaysLangs || []).includes(L.lang) ? "always" : "optin";
const headExtraFor = L => [["google-site-verification", cfg.googleSiteVerification], ["yandex-verification", cfg.yandexVerification]]
  .filter(([, v]) => v).map(([n, v]) => `<meta name="${n}" content="${String(v).replace(/["<>&]/g, "")}">`)
  .concat(cfg.yandexMetrikaId ? [`<script>window.DISC_ANALYTICS=${JSON.stringify({ ym: String(cfg.yandexMetrikaId).replace(/\D/g, ""), mode: analyticsMode(L) })};</script>`] : [])
  // закреплённая кнопка расширенного отчёта на всех страницах (src/common.js) — только в языках, где отчёт продаётся (content.product.promo)
  .concat(L.content.product && L.content.product.promo ? [`<script>window.DISC_XBAR=${JSON.stringify(xbarCfg(L)).replace(/</g, "\\u003c")};</script>`] : [])
  .concat(visitStats ? [`<script>window.DISC_VISIT=${JSON.stringify({ url: String(cfg.sendEndpoint), token: String(cfg.sendToken || ''), host: new URL(cfg.siteUrl).hostname }).replace(/</g, "\\u003c")};</script>`] : [])
  .join("\n");
// Персональные данные (план боевого режима, этап Д). pdConsent в site.config.json включает схему «свой сервер в России»:
// отдельная галочка согласия на обработку данных в форме отправки результата и в форме обратной связи (без неё форма не отправляется,
// запрос несёт consent: true и consentV — дату редакции), страница согласия /consent/, новая редакция страницы «Конфиденциальность»
// (content.policy; в русской версии — с полным текстом политики) и подробности уведомления о cookie без названий прежних сервисов.
// Включать вместе с переводом sendEndpoint на свой сервер: тексты описывают хранение в России, а прежний скрипт согласие не записывает.
// pdVersion — дата редакции политики и согласия (ГГГГ-ММ-ДД): её показывают страницы и сохраняет сервер рядом с отметкой о согласии.
// Локальная проверка без правки site.config.json: PD_CONSENT=1 SEND_ENDPOINT=https://api.disc-test.org/ node build.js (после проверки пересобрать без них).
if (process.env.SEND_ENDPOINT) cfg.sendEndpoint = process.env.SEND_ENDPOINT;
const pdOn = process.env.PD_CONSENT ? process.env.PD_CONSENT === '1' : !!cfg.pdConsent;
const pdVersion = /^\d{4}-\d\d-\d\d$/.test(String(cfg.pdVersion || '')) ? cfg.pdVersion : '2026-10-11';
// Тексты уведомления о cookie, которые видит страница: по режиму аналитики языка и по схеме обработки данных
const noticeUi = L => ({ 'consent.text': cfg.yandexMetrikaId && analyticsMode(L) === 'optin' ? L.ui['pd.cookieAsk'] : L.ui['consent.text'], 'consent.details': pdOn ? L.ui['pd.cookieDetails'] : L.ui['consent.details'] });
const siteUrl = cfg.siteUrl.replace(/\/+$/, '');
const basePath = new URL(siteUrl + '/').pathname; // например "/disc-test/" или "/"
const tpl = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const introJs = fs.readFileSync(path.join(SRC, 'intro.js'), 'utf8');
const introHTML = require(path.join(SRC, 'intro.js')), cvPromoHTML = introHTML.cvPromoHTML;
const commonJs = fs.readFileSync(path.join(SRC, 'common.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
// Форма обратной связи: письма уходят на feedbackEmail через Apps Script; пустой адрес — страницы /contact/ и ссылки на неё нет
const contactJs = fs.readFileSync(path.join(SRC, 'contact.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
// Заявка со страницы «Для организаций» (/business/): разметку businessHTML() кладёт сборка, логику initBusiness() — сама страница
const businessHTML = require(path.join(SRC, 'business.js'));
const businessJs = fs.readFileSync(path.join(SRC, 'business.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
// Лендинг «CV под каждую вакансию» (/ru/cv/): разметку формы cvFormHTML() кладёт сборка, логику initCvForm() — сама страница; стили страницы — src/cv.css
const cvFormHTML = require(path.join(SRC, 'cv.js'));
const cvJs = fs.readFileSync(path.join(SRC, 'cv.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
// комментарии в cv.js — по-русски и упоминают русскую страницу: в лендинги на других языках код идёт без них (с 2026-10-24)
const cvJsBare = cvJs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*\n/gm, '').replace(/[ \t]+\/\/ .*$/gm, '').replace(/\n{2,}/g, '\n');
const cvCss = fs.readFileSync(path.join(SRC, 'cv.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n+/g, '\n').trim();
// неактивные кнопки скачивания (файлы примера на языке ещё не готовы, с 2026-10-24 — английская версия): стили только для таких страниц, cv.css не меняется
const cvOffCss = fs.readFileSync(path.join(SRC, 'cv-off.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n+/g, '\n').trim();
// фото автора без обрезки головы (src/cv-photo.css): во всех языках лендинга, кроме русского — русская страница не меняется без решения заказчика
const cvPhotoCss = fs.readFileSync(path.join(SRC, 'cv-photo.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n+/g, '\n').trim();
// китайский и японский лендинг (src/cv-cjk.css, с 2026-10-24): цитата автора без курсива — у иероглифов его нет; только эти языки
const cvCjkCss = fs.readFileSync(path.join(SRC, 'cv-cjk.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n+/g, '\n').trim(), CV_CJK = ['zh', 'zh-hant', 'ja'];
const contactHTML = require(path.join(SRC, 'contact.js'));
const feedbackEmail = String(cfg.feedbackEmail || '').trim().replace(/['\\<>"]/g, '');
// Адрес, с которого Apps Script шлёт письма (в Gmail он должен быть добавлен как «Отправлять письма как»); по умолчанию — feedbackEmail
const senderEmail = String(cfg.senderEmail == null ? feedbackEmail : cfg.senderEmail).trim().replace(/['\\<>"]/g, '');
// Реквизиты владельца (требование платёжной системы: в подвале или на странице контактов): с 2026-10-20 по слову заказчика — только в подвале страницы
// «Обратная связь» (contact/); в оферте (раздел о продавце) они есть отдельно. Имя и подпись к ИНН — в локали (ui.legal), номер — в legalInn; пустой номер — строки нет
const legalInn = String(cfg.legalInn || '').replace(/\D/g, '');
const legalHtml = L => legalInn ? `<div class="legal">${esc(L.ui.legal.replace('{inn}', legalInn))}</div>` : '';
// Строка о правах на тексты (подвал каждой страницы, печатная версия результата, PDF-отчёт из письма): ui.rights, {year} — год сборки
const rightsHtml = L => `<div class="rights">${esc(L.ui.rights.replace('{year}', new Date().getFullYear()))}</div>`;
// Платная услуга. Страница /services/ есть во всех языках; цена берётся по валюте локали (content.services.currency):
// servicePriceRub, servicePriceUsd или servicePriceEur (французская и немецкая версии, с 2026-10-22) в site.config.json, пустое значение или 0 убирает страницу и пункт меню в языках с этой валютой.
// Оферта и условия возврата (/offer/, /refund/) — только в языках, где есть content.offer и content.refund (сейчас — русский)
const servicePrices = { RUB: Number(cfg.servicePriceRub) || 0, USD: Number(cfg.servicePriceUsd) || 0, EUR: Number(cfg.servicePriceEur) || 0 };
const fmtPrice = (L, v) => v ? new Intl.NumberFormat(L.dateLocale, Number.isInteger(v) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) : '';
const servicePrice = L => fmtPrice(L, L.content.services ? servicePrices[L.content.services.currency] || 0 : 0);
const hasServices = L => !!(servicePrice(L) && L.ui['nav.services']);
// анонсы сервиса «Резюме под каждую вакансию» (content.cvPromo, с 2026-10-24): только там, где есть сам лендинг /<язык>/cv/ (content.cv и форма заявки)
const hasCvPromo = L => !!(L.content.cvPromo && L.content.cv && feedbackEmail);
const hasOffer = L => !!(hasServices(L) && L.content.offer && L.content.refund && L.ui['nav.offer']);
// Расширенный отчёт: страница /extended-report/ и блок на экране результата — в языках, где есть content.product и оферта.
// Листы образца — картинки src/assets/extended/<язык>-i-<n>.webp (с уменьшенной копией -s) и подписи к ним в локали (sampleAlt, sampleCaption,
// sampleTitle, sampleNote, block.sample): они есть только там, где расширенный отчёт на этом языке написан (сейчас — русский). В остальных
// языках страница, блок на экране результата, блок в PDF и в письме строятся без листов; чтобы листы появились, достаточно положить
// картинки и добавить эти ключи в локаль. Сам отчёт в репозиторий не попадает.
const sampleCount = L => { let n = 0; while (fs.existsSync(path.join(SRC, 'assets', 'extended', `${L.lang}-i-${n + 1}.webp`)) && fs.existsSync(path.join(SRC, 'assets', 'extended', `${L.lang}-i-${n + 1}-s.webp`))) n++; return n; };
const hasProduct = L => !!(hasOffer(L) && L.content.product);
const hasSamples = L => { const P = L.content.product; return !!(hasProduct(L) && P.sampleTitle && P.sampleNote && P.block.sample && Array.isArray(P.sampleAlt) && Array.isArray(P.sampleCaption) && P.sampleAlt.length && sampleCount(L) >= P.sampleAlt.length); };
// Специальная цена (offerPriceRub, offerPriceUsd, offerPriceEur, offerMinutes в site.config.json; решение заказчика от 2026-10-22, во всех языках с покупкой): в течение
// offerMinutes после прохождения теста отчёт стоит offerPrice<валюта> вместо servicePrice<валюта>. Включается в языке с этой валютой, где отчёт продаётся
// (content.product.pay) и есть тексты content.product.pay.offer; в текстах цена подставляется вместо {offerPrice}. Срок проверяет сервер оплаты
// по времени прохождения в коде результата (private/server/src/pay.js), страница показывает зачёркнутую обычную цену и обратный отсчёт (src/pay.js).
const offerPrices = { RUB: Number(cfg.offerPriceRub) || 0, USD: Number(cfg.offerPriceUsd) || 0, EUR: Number(cfg.offerPriceEur) || 0 }, offerMinutes = Number(cfg.offerMinutes) || 60;
// offerTermsPrice — цена для оферты (п. 3.1 во всех языках, где она есть, даже без покупки); offerPrice — для форм покупки (нужны тексты pay.offer)
const offerTermsPrice = L => { const cur = L.content.services && L.content.services.currency, v = offerPrices[cur] || 0; return v && v < (servicePrices[cur] || 0) ? fmtPrice(L, v) : ''; };
const offerPrice = L => { const C = L.content; return C.product && C.product.pay && C.product.pay.offer ? offerTermsPrice(L) : ''; };
const withPrice = (L, obj) => { const s = JSON.stringify(obj).replace(/\{price\}/g, servicePrice(L));
  if (/\{offerPrice\}/.test(s) && !offerPrice(L)) throw new Error(`${L.lang}: в тексте есть {offerPrice}, а специальная цена не задана (offerPriceRub в site.config.json)`);
  return JSON.parse(s.replace(/\{offerPrice\}/g, offerPrice(L))); };
// Специальная цена для скрипта покупки (src/pay.js, T.offer): числа — для сервера, строки — для показа; null — специальной цены в языке нет
const payOffer = L => { if (!offerPrice(L)) return null; const P = L.content.product, O = withPrice(L, P.pay.offer), cur = L.content.services.currency;
  return { price: offerPrices[cur], regular: servicePrices[cur], ms: offerMinutes * 60000, priceText: withPrice(L, P.price).replace(servicePrice(L), offerPrice(L)),
    regularText: withPrice(L, P.price), regularLabel: O.regular, cta: O.cta, note: O.note, left: O.left, expired: O.expired,
    button: P.promo ? withPrice(L, P.promo.button).replace(servicePrice(L), offerPrice(L)) : '' }; };
// Закреплённая кнопка расширенного отчёта (src/common.js, window.DISC_XBAR): надпись с обычной ценой, со специальной (пусто — её нет в языке), адрес, где спросить,
// включена ли специальная цена в панели (GET <payEndpoint>/offer, с 2026-10-25), срок специальной цены, «Скрыть»
const xbarCfg = L => { const PM = withPrice(L, L.content.product.promo), O = payOffer(L); return { button: PM.button, offer: O ? O.button : '', offerUrl: O && payEndpoint ? payEndpoint + '/offer' : '', ms: offerMinutes * 60000, close: PM.close }; };
// Коды доступа (с 2026-10-22, по просьбе заказчика; сначала русская версия): организации покупают расширенные отчёты пакетом и раздают людям коды.
// accessCodes в site.config.json включает в формах покупки ссылку «У меня есть код организации» с полем кода (тексты content.product.pay.code):
// код уходит на <payEndpoint>/code, сервер проверяет его и ставит задание на отчёт (private/server/src/codes.js). Включать после выкладки сервера с кодами.
const accessCodes = () => !!(cfg.accessCodes && payEndpoint);   // функция: payEndpoint объявлен ниже
const payCodeT = (L, fill) => { const P = L.content.product && L.content.product.pay, X = P && P.code; if (!accessCodes() || !X) return null;
  return Object.assign(Object.fromEntries(['link', 'label', 'placeholder', 'button', 'back', 'wait', 'badEmail', 'empty', 'done', 'bad', 'expired'].map(k => [k, X[k]])),
    { noteHtml: fill(escFull(X.note)), usedHtml: fill(escFull(X.used)), errorHtml: fill(escFull(X.error)) }); };
// Страница «Для организаций» (/business/, пункт в подвале): пакеты кодов — businessPacks в site.config.json ([{from, priceRub}]: от скольких кодов
// и цена одного), срок кода — businessCodeMonths; заявка — форма на странице (src/business.js), уходит через форму обратной связи сервера.
// Есть там, где в локали content.business и ui['nav.business'], отчёт продаётся в рублях и включены коды доступа.
const businessPacks = (Array.isArray(cfg.businessPacks) ? cfg.businessPacks : []).filter(x => x && x.from > 0 && x.priceRub > 0).sort((a, b) => a.from - b.from);
const businessMonths = Number(cfg.businessCodeMonths) || 12;
// Пункты оферты и абзац политики о кодах доступа (offer.codeTerms: [{section, text}] — пункт в конец раздела; policy.purchaseCode — абзац в конец
// раздела о покупке): решение заказчика от 2026-10-22 — коды только в русской версии, поэтому эти тексты в отдельных ключах, а не в общих списках,
// и появляются только там, где коды включены. Когда коды придут в другой язык, его перевод получает те же ключи.
const offerSections = L => { const of = L.content.offer; if (!of.codeTerms || !payCodeT(L, x => x)) return of.sections;
  return of.sections.map((sec, i) => { const add = of.codeTerms.filter(x => x.section === i).map(x => x.text), k = sec.ul ? 'ul' : sec.ol ? 'ol' : 'p';
    return add.length ? Object.assign({}, sec, { [k]: sec[k].concat(add) }) : sec; }); };
const policyPurchase = L => { const po = L.content.policy; return po.purchaseCode && payCodeT(L, x => x) ? Object.assign({}, po.purchase, { p: po.purchase.p.concat([po.purchaseCode]) }) : po.purchase; };
const hasBusiness = L => !!(L.content.business && L.ui['nav.business'] && hasProduct(L) && L.content.product.pay && L.content.services.currency === 'RUB' && servicePrices.RUB &&
  payCodeT(L, x => x) && feedbackEmail && cfg.sendEndpoint && businessPacks.length);
// Оператор и дата редакции в политике и согласии: в языке с полным текстом политики (policy.legal — русская версия) — исполнитель из оферты
// (ИП с ИНН), в остальных — строка реквизитов из подвала. От наличия оферты не зависит: иначе её появление в языке меняло бы текст согласия,
// на который люди уже согласились (после правки текста согласия нужна новая pdVersion)
const pdOwner = L => (hasOffer(L) && L.content.policy && L.content.policy.legal ? L.content.offer.seller : L.ui.legal).replace('{inn}', legalInn);
const pdDate = L => new Intl.DateTimeFormat(L.dateLocale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(pdVersion + 'T00:00:00Z')).replace(/\s*г\.$/, ' года');   // «11 октября 2026 года»: после даты в тексте стоит точка
// Галочка согласия на обработку данных: подпись со ссылками на страницу согласия и на «Конфиденциальность» (base — путь к корню языка)
const pdLabelHtml = (L, base) => escFull(L.ui['pd.consent']).replace('{consent}', `<a href="${base}consent/" target="_blank" rel="noopener">${escFull(L.ui['pd.consentLink'])}</a>`)
  .replace('{privacy}', `<a href="${base}privacy/" target="_blank" rel="noopener">${escFull(L.ui['nav.privacy'])}</a>`);
// Текст согласия без разметки — его сервер сохраняет рядом с отметкой о согласии: подпись у галочки и сам документ
const pdConsentText = L => { const cd = L.content.consentDoc, plain = str => String(str).replace(/\{email\}/g, feedbackEmail).replace(/\{contact\}/g, L.ui['nav.contact']).replace(/\{owner\}/g, pdOwner(L))
    .replace(/\{date\}/g, pdDate(L)).replace(/\{consent\}/g, L.ui['pd.consentLink']).replace(/\{privacy\}/g, L.ui['nav.privacy']);
  return [plain(L.ui['pd.consent']), '', cd.h1, plain(cd.lead)].concat(cd.sections.flatMap(sec => ['', sec.h].concat(sec.p.map(plain))), ['', plain(cd.edition)]).join('\n'); };
// Рассылка: newsletter в site.config.json включает галочку согласия в форме отправки результата. Включать после того, как в Apps Script
// развёрнута версия скрипта со столбцами согласия (GET на sendEndpoint отвечает newsletter:true): прежняя версия галочку молча игнорирует.
// Страница отписки /unsubscribe/ строится всегда, когда задан sendEndpoint: ссылки из уже разосланных писем должны работать.
const newsletter = !!(cfg.newsletter && cfg.sendEndpoint);
// Подписка на рассылку на стартовом экране (с 2026-10-22): "homeSubscribe": true — форма e-mail + «Подписаться» и страница подтверждения /subscribe/ (#c=…).
// Сервер пишет подписчика в базу результатов строкой без результата и шлёт письмо со ссылкой подтверждения (тексты content.subscribeMail).
const homeSub = !!(cfg.homeSubscribe && newsletter);
// Кнопка «Отправить на e-mail» с формой краткого отчёта в карточке «Сохраните результат» (с 2026-10-22): "resultEmail": false её убирает
// (так было с 2026-10-21 по 2026-10-22 по решению заказчика; код отправки остаётся). Без ключа кнопка есть.
const resultEmail = cfg.resultEmail !== false;
// Обезличенный счёт прохождений: profileStats в site.config.json — в момент, когда тест пройден, страница шлёт на sendEndpoint профиль и язык версии
// (action: 'stat'), без имени, адреса, ответов и кода результата; сервер пишет их в таблицу счёта, панель показывает на странице «Профили».
// По кнопке «Начать тест» уходит вторая запись — только язык версии (action: 'start'): панель показывает на странице «Прохождения», сколько раз тест начали.
// Тексты о данных (ui.privacy, content.policy, pd.cookieDetails) об этой записи говорят: ключ и тексты меняются только вместе.
const profileStats = !!(cfg.profileStats && cfg.sendEndpoint);
// Скачивание краткого отчёта: pdfDownload в site.config.json — кнопка «Сохранить в PDF» на экране результата шлёт на <sendEndpoint>pdf ответы и дату
// без имени и e-mail и сохраняет файл, который собрал сервер (тот же PDF, что в письме); без ключа или при сбое — окно печати браузера.
// Тексты о данных (ui.privacy, content.policy, pd.cookieDetails, пункт 2.8 русской политики) об этом запросе говорят: ключ и тексты меняются только вместе.
const pdfDownload = !!(cfg.pdfDownload && cfg.sendEndpoint);
// Свой счёт посетителей: visitStats в site.config.json — раз в сутки по Москве каждая страница сайта шлёт на sendEndpoint отметку о посещении
// (action: 'visit') — только язык версии; дату последней отметки браузер хранит в localStorage disc.visit (код — в src/common.js, window.DISC_VISIT).
// Сервер пишет язык и время получения — «Сводка» панели сравнивает посетителей «к этому часу» без задержки системы веб-аналитики.
// Тексты о данных (ui.privacy, content.policy, pd.cookieDetails, пункт 2.7 русской политики) об этой отметке говорят: ключ и тексты меняются только вместе.
const visitStats = !!(cfg.visitStats && cfg.sendEndpoint);
// Оплата расширенного отчёта: payEndpoint — адрес сервера оплаты (README → «Оплата расширенного отчёта»). Пока он пустой, на странице
// отчёта остаётся заявка через форму обратной связи, страниц «Спасибо» и «Оплата не прошла» нет. Для локальной проверки адрес можно
// задать переменной PAY_ENDPOINT, не трогая site.config.json: PAY_ENDPOINT=http://localhost:8765/mock-pay LANGS=ru node build.js
const payEndpoint = String(process.env.PAY_ENDPOINT || cfg.payEndpoint || '').trim().replace(/\/+$/, '');
const payJs = fs.readFileSync(path.join(SRC, 'pay.js'), 'utf8');
// Результат из адреса страницы отчёта: ссылка из PDF краткого отчёта и из письма несёт код результата (…/extended-report/?src=pdf#r=DISC1.…).
// Так страница знает результат и на устройстве, где тест не проходили (PDF открыт на телефоне, тест пройден на компьютере); без кода — результат,
// сохранённый на устройстве (disc.last). Разбор тот же, что у decodeResult в src/template.html.
const resultFromUrlJs = `function resultFromUrl(){
  var m = /[#&]r=DISC1\\.([A-Za-z0-9_-]+)/.exec(dataHash());
  if(!m) return null;
  try{
    var b = m[1].replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b += '=';
    var o = JSON.parse(decodeURIComponent(escape(atob(b))));
    if(typeof o.n!=='string' || !/^[0-3]{24}$/.test(o.m) || !/^[0-3]{24}$/.test(o.l)) return null;
    var mm = o.m.split('').map(Number), ll = o.l.split('').map(Number);
    for(var i=0;i<24;i++) if(mm[i]===ll[i]) return null;
    return {name:o.n.slice(0,80), email:String(o.e||'').slice(0,120), pos:String(o.p||'').slice(0,80), t:String(o.t||''), m:mm, l:ll};
  }catch(e){ return null; }
}
`;
const MAX_CONTACT_BYTES = 10 * 1024 * 1024; // общий размер вложений одного сообщения (проверяется и в браузере, и в Apps Script)
const jsStr = s => JSON.stringify(String(s == null ? '' : s)).replace(/</g, '\\u003c');
const graphJs = fs.readFileSync(path.join(SRC, 'graph.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
const graphSVG = require(path.join(SRC, 'graph.js'));
// Типичный итоговый профиль (net, от −24 до +24, сумма 0) для примера результата на странице профиля и для его og-картинки
const SAMPLE_NET = require(path.join(SRC, 'samples.js'));
const sampleScore = net => { const most = {}, least = {}; const pos = Object.values(net).filter(v => v > 0).reduce((a, b) => a + b, 0), base = (24 - pos) / 4;
  for (const k of Object.keys(net)) { most[k] = Math.max(0, net[k]) + base; least[k] = Math.max(0, -net[k]) + base; } return { most, least, net }; };
const pct = net => Math.round((net + 24) / 48 * 100);
const pageTpl = fs.readFileSync(path.join(SRC, 'page.html'), 'utf8');
const styleBlock = (tpl.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
const NAV_ITEMS = [['nav.test', ''], ['nav.disc', 'disc/'], ['nav.styles', 'styles/'], ['nav.profiles', 'profiles/'], ['nav.results', 'results/'], ['nav.compat', 'compatibility/'], ['nav.faq', 'faq/']];
// Подвал: ссылки на все материалы о DISC (сквозная перелинковка контентных страниц)
const MATERIALS = [['nav.disc', 'disc/'], ['nav.styles', 'styles/'], ['nav.profiles', 'profiles/'], ['nav.results', 'results/'], ['nav.compat', 'compatibility/'], ['nav.colors', 'colors/'], ['nav.teams', 'teams/'], ['nav.mbti', 'disc-vs-mbti/'], ['nav.pdf', 'pdf/'], ['nav.faq', 'faq/']];
// «Как готовятся отчёты» (/how-reports-are-made/): страница и пункт в шапке есть в языках, где в локали есть content.howMade и ui['nav.howMade'] (с 2026-10-14 — во всех 14: валидатор требует оба ключа)
const HOWMADE_SUB = 'how-reports-are-made/', hasHowMade = L => !!(L.content.howMade && L.ui['nav.howMade']);
const navItems = L => NAV_ITEMS.concat(hasHowMade(L) ? [['nav.howMade', HOWMADE_SUB]] : [], hasServices(L) ? [['nav.services', 'services/']] : [], feedbackEmail ? [['nav.contact', 'contact/']] : []);
const materialsHtml = (L, base, cur) => `<nav class="materials" aria-label="${esc(L.ui['nav.materials'])}"><span class="mlabel">${esc(L.ui['nav.materials'])}</span>` + MATERIALS.map(([k, sub]) => sub === cur ? `<span aria-current="page">${esc(L.ui[k])}</span>` : `<a href="${base + sub}">${esc(L.ui[k])}</a>`).join('') + `</nav>`;
const relRoot = (L, sub) => { const depth = (pathOf(L.lang) + sub).split('/').length - 1; return depth ? '../'.repeat(depth) : './'; };
const PAIRS = ['DD', 'DI', 'DS', 'DC', 'II', 'IS', 'IC', 'SS', 'SC', 'CC'], pairSlug = k => (k[0] + '-' + k[1]).toLowerCase();
const ltr = str => `<span dir="ltr">${str}</span>`; // латиница внутри арабского текста: без изоляции «D · I» читается как «I · D»
const FOOT_ITEMS = [['nav.about', 'about/']].concat(feedbackEmail ? [['nav.contact', 'contact/']] : []).concat([['nav.privacy', 'privacy/']]);
// Короткий подвал экрана результата (с 2026-10-21, решение заказчика): только оферта, конфиденциальность и обратная связь + строка ©
const footShort = (L, base) => (hasOffer(L) ? [['nav.offer', 'offer/']] : []).concat([['nav.privacy', 'privacy/']], feedbackEmail ? [['nav.contact', 'contact/']] : []).map(([k, sub]) => `<a href="${base + sub}">${esc(L.ui[k])}</a>`).join(' · ');
const footLinks = (L, base) => FOOT_ITEMS.slice(0, 1).concat(hasServices(L) ? [['nav.services', 'services/']] : [], hasBusiness(L) ? [['nav.business', 'business/']] : [], hasOffer(L) ? [['nav.offer', 'offer/']] : [], FOOT_ITEMS.slice(1)).map(([k, sub]) => `<a href="${base + sub}">${esc(L.ui[k])}</a>`).join(' · ');
const PROFILE_KEYS = ['D', 'DI', 'DC', 'DS', 'I', 'ID', 'IS', 'IC', 'S', 'SI', 'SC', 'SD', 'C', 'CD', 'CS', 'CI'];
// Источники к странице «Что такое DISC». Библиографические описания одинаковы во всех языках
// (названия работ приводятся на языке оригинала), поэтому живут здесь, а не в локалях;
// переводятся только заголовок раздела, вводка и подпись вида «Исследование» (ключи sources.kind.*).
// Каждая запись сверена с карточкой издателя или научной базы; kind — ключ подписи.
// Список выводится с dir="ltr": описания на латинице, и в арабской версии иначе съезжают знаки препинания.
const SOURCES = [
  { kind: 'primary', text: 'Marston W. M. Emotions of Normal People. — London: Kegan Paul, Trench, Trubner & Co., 1928.', url: 'https://archive.org/details/emotionsofnormal032195mbp' },
  { kind: 'history', text: 'Clarke W. V. The Construction of an Industrial Selection Personality Test // The Journal of Psychology. — 1956. — Vol. 41, № 2. — P. 379–394.', url: 'https://doi.org/10.1080/00223980.1956.9713011' },
  { kind: 'manual', text: 'Scullard M., Baum D. Everything DiSC Manual. — Hoboken: Wiley, 2015. — ISBN 978-1-119-08067-1.', url: 'https://www.wiley.com/en-us/Everything+DiSC+Manual-p-9781119080671' },
  { kind: 'research', text: 'Meade A. W. Psychometric problems and issues involved with creating and using ipsative measures for selection // Journal of Occupational and Organizational Psychology. — 2004. — Vol. 77, № 4. — P. 531–552.', url: 'https://doi.org/10.1348/0963179042596504' },
  { kind: 'research', text: 'Salgado J. F., Anderson N., Táuriz G. The validity of ipsative and quasi-ipsative forced-choice personality inventories for different occupational groups: A comprehensive meta-analysis // Journal of Occupational and Organizational Psychology. — 2015. — Vol. 88, № 4.', url: 'https://doi.org/10.1111/joop.12098' },
  { kind: 'research', text: 'Jones C. S., Hartley N. T. Comparing Correlations Between Four-Quadrant and Five-Factor Personality Assessments // American Journal of Business Education. — 2013. — Vol. 6, № 4. — P. 459–470.', url: 'https://files.eric.ed.gov/fulltext/EJ1054970.pdf' },
  { kind: 'research', text: 'McCrae R. R., John O. P. An Introduction to the Five-Factor Model and Its Applications // Journal of Personality. — 1992. — Vol. 60, № 2. — P. 175–215.', url: 'https://doi.org/10.1111/j.1467-6494.1992.tb00970.x' },
  { kind: 'research', text: 'Barrick M. R., Mount M. K. The Big Five Personality Dimensions and Job Performance: A Meta-Analysis // Personnel Psychology. — 1991. — Vol. 44, № 1. — P. 1–26.', url: 'https://doi.org/10.1111/j.1744-6570.1991.tb00688.x' },
  { kind: 'review', text: 'Pittenger D. J. Cautionary Comments Regarding the Myers-Briggs Type Indicator // Consulting Psychology Journal: Practice and Research. — 2005. — Vol. 57, № 3. — P. 210–221.', url: 'https://doi.org/10.1037/1065-9293.57.3.210' },
  { kind: 'research', text: 'Roberts B. W., Walton K. E., Viechtbauer W. Patterns of Mean-Level Change in Personality Traits Across the Life Course: A Meta-Analysis of Longitudinal Studies // Psychological Bulletin. — 2006. — Vol. 132, № 1. — P. 1–25.', url: 'https://doi.org/10.1037/0033-2909.132.1.1' }
];
const sourcesHtml = (L, t) => `<h2 id="sources">${escFull(L.content.disc.sourcesTitle)}</h2><p>${escFull(L.content.disc.sourcesLead)}</p><ol class="sources" dir="ltr">` +
  SOURCES.map(sc => `<li><span class="kind">${esc(t('sources.kind.' + sc.kind))}</span><a href="${sc.url}" rel="noopener nofollow" hreflang="en">${escFull(sc.text)}</a></li>`).join('') + `</ol>`;
const pages = []; // для sitemap: {lang, sub, files}
const writtenSubs = {}; // все записанные контентные страницы по языкам (и noindex): для переадресации снятых языков
const extraUrls = []; // для sitemap: файлы PDF {lang, loc, date}
const ASSETS = path.join(SRC, 'assets');
const nfTpl = fs.readFileSync(path.join(SRC, '404.html'), 'utf8');

// Шрифты размещены на самом сайте (src/assets/fonts, скачиваются scripts/fetch-fonts.js): нет запросов к Google,
// что важно для GDPR (Германия) и для надёжности там, где Google Fonts блокируется или тормозит.
// Для китайского и японского используются системные шрифты: файлы CJK слишком велики.
const FONT_CSS = fs.existsSync(path.join(ASSETS, 'fonts', 'fonts.css')) ? fs.readFileSync(path.join(ASSETS, 'fonts', 'fonts.css'), 'utf8') : '';
if (!FONT_CSS) console.warn('WARNING: src/assets/fonts/fonts.css not found (run node scripts/fetch-fonts.js)');
const LATIN_STACK = "'Golos Text',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
const LATIN_EXT = ['pl']; // языки на основном наборе шрифтов, где буквы с диакритикой (ł, ą, ę, ż…) лежат в подмножестве latin-ext: его тоже грузим заранее
const FONTS = {
  default: { families: ['Unbounded', 'Golos Text', 'IBM Plex Mono'], head: "'Unbounded',sans-serif", body: LATIN_STACK,
    preload: (sub, ext) => [`golos-text-400-${sub}.woff2`, `unbounded-500-${sub}.woff2`].concat(ext ? ['golos-text-400-latin-ext.woff2', 'unbounded-500-latin-ext.woff2'] : []) },
  // Турецкий: у Golos Text в поставке Google Fonts буквы ğ и Ğ собраны без бревиса (рисуются как g и G),
  // поэтому основной текст набирается системным шрифтом; у Unbounded и IBM Plex Mono эти буквы в порядке.
  tr: { families: ['Unbounded', 'IBM Plex Mono'], head: "'Unbounded',sans-serif", body: "system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
    preload: () => ['unbounded-500-latin.woff2', 'unbounded-500-latin-ext.woff2'] },
  ar: { families: ['Unbounded', 'Golos Text', 'IBM Plex Mono', 'Noto Kufi Arabic', 'IBM Plex Sans Arabic'],
    head: "'Unbounded','Noto Kufi Arabic',sans-serif", body: "'IBM Plex Sans Arabic','Golos Text',system-ui,'Segoe UI',Tahoma,sans-serif",
    preload: () => ['ibm-plex-sans-arabic-400-arabic.woff2', 'noto-kufi-arabic-500-arabic.woff2'] },
  zh: { families: [],
    head: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC',system-ui,sans-serif",
    body: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC',system-ui,sans-serif" },
  'zh-hant': { families: [],
    head: "'PingFang TC','PingFang HK','Microsoft JhengHei','Heiti TC','Noto Sans CJK TC','Source Han Sans TC',system-ui,sans-serif",
    body: "'PingFang TC','PingFang HK','Microsoft JhengHei','Heiti TC','Noto Sans CJK TC','Source Han Sans TC',system-ui,sans-serif" },
  ja: { families: [],
    head: "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,'Noto Sans CJK JP',system-ui,sans-serif",
    body: "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,'Noto Sans CJK JP',system-ui,sans-serif" }
};
// @font-face только для семейств языка + preload двух основных файлов; пусто для языков на системных шрифтах
const fontsHead = (f, L) => {
  if (!f.families || !f.families.length || !FONT_CSS) return '';
  const sub = L.lang === 'ru' ? 'cyrillic' : 'latin', ext = LATIN_EXT.includes(L.lang);
  // шрифт заголовков — один вес (500): файлы 600 Unbounded и Noto Kufi Arabic не подключаются — минус ~80 КБ на страницу, в арабской ~170 КБ (аудит 3, п. 11)
  const faces = FONT_CSS.split('\n').filter(l => l.startsWith('@font-face') && f.families.some(fam => l.includes(`font-family:'${fam}'`)) && !/font-family:'(Unbounded|Noto Kufi Arabic)';[^}]*font-weight:600/.test(l)).join('\n').replace(/__FONTS__/g, basePath + 'fonts/');
  const pre = (f.preload ? f.preload(sub, ext) : []).filter(n => fs.existsSync(path.join(ASSETS, 'fonts', n))).map(n => `<link rel="preload" href="${basePath}fonts/${n}" as="font" type="font/woff2" crossorigin>`).join('\n');
  return pre + '\n<style>' + faces + '</style>';
};
const OG_LOCALE = { en: 'en_US', ru: 'ru_RU', es: 'es_ES', zh: 'zh_CN', ar: 'ar_AR', pt: 'pt_BR', fr: 'fr_FR', de: 'de_DE', ja: 'ja_JP', 'zh-hant': 'zh_TW', id: 'id_ID', tr: 'tr_TR', pl: 'pl_PL' };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Упрощённые SVG-флаги (viewBox 0 0 30 20). Рисуются одинаково на всех платформах, в отличие от эмодзи.
function star(cx, cy, r, fill, rot) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = (rot == null ? -Math.PI / 2 : rot) + i * Math.PI / 5, rr = i % 2 ? r * 0.382 : r; pts.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2)); }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}
// Солнце с 12 лучами: звезда-многоугольник, поверх неё кольцо цвета фона и белый диск
function sun(cx, cy, r, disc, fill, bg) {
  const pts = [];
  for (let i = 0; i < 24; i++) { const a = -Math.PI / 2 + i * Math.PI / 12, rr = i % 2 ? r * 0.62 : r; pts.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2)); }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/><circle cx="${cx}" cy="${cy}" r="${(disc * 1.18).toFixed(2)}" fill="${bg}"/><circle cx="${cx}" cy="${cy}" r="${disc}" fill="${fill}"/>`;
}
const FLAGS = {
  en: `<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#C8102E" stroke-width="3.6"/>`,
  ru: `<rect width="30" height="20" fill="#fff"/><rect y="6.67" width="30" height="6.67" fill="#0039A6"/><rect y="13.33" width="30" height="6.67" fill="#D52B1E"/>`,
  es: `<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>`,
  zh: `<rect width="30" height="20" fill="#EE1C25"/>` + star(5, 5, 3, '#FFDE00') + star(10, 2, 1, '#FFDE00') + star(12, 4.2, 1, '#FFDE00') + star(12, 7, 1, '#FFDE00') + star(10, 9, 1, '#FFDE00'),
  ar: `<rect width="30" height="20" fill="#006C35"/><path d="M7 8.5c1.5-2.2 3-2.2 4 0s2.5 2.2 4 0 3-2.2 4 0 2.5 2.2 4 0" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><path d="M7.5 13.5H21.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M21.2 12.2v2.6" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`,
  pt: `<rect width="30" height="20" fill="#009C3B"/><polygon points="15,2.5 27,10 15,17.5 3,10" fill="#FFDF00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/><path d="M10.7 9.3c2.9-1.5 5.9-1.3 8.6.4" fill="none" stroke="#fff" stroke-width=".9"/>`,
  fr: `<rect width="10" height="20" fill="#0055A4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#EF4135"/>`,
  de: `<rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#DD0000"/><rect y="13.33" width="30" height="6.67" fill="#FFCE00"/>`,
  ja: `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>`,
  // Традиционный китайский — флаг Тайваня (крупнейшая аудитория версии), белое солнце упрощено до круга с лучами
  'zh-hant': `<rect width="30" height="20" fill="#FE0000"/><rect width="15" height="10" fill="#000095"/>` + sun(7.5, 5, 3.6, 2.1, '#fff', '#000095'),
  id: `<rect width="30" height="10" fill="#FF0000"/><rect y="10" width="30" height="10" fill="#fff"/>`,
  tr: `<rect width="30" height="20" fill="#E30A17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.25" cy="10" r="4" fill="#E30A17"/>` + star(17.2, 10, 2.5, '#fff', Math.PI),
  pl: `<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#DC143C"/>`
};
const flagSprite = codes => `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">` +
  codes.map(c => `<symbol id="flag-${c}" viewBox="0 0 30 20">${FLAGS[c] || `<rect width="30" height="20" fill="#888"/>`}</symbol>`).join('') + `</svg>`;
const flag = c => `<svg class="flag" aria-hidden="true" focusable="false"><use href="#flag-${c}"/></svg>`;
const missing = cfg.languages.filter(code => !fs.existsSync(path.join(SRC, 'locales', code + '.json')));
if (missing.length) console.warn('WARNING: locales not found, skipped: ' + missing.join(', '));
const ONLY = process.env.LANGS ? process.env.LANGS.split(',') : null; // локальная проверка одной локали: LANGS=ru node build.js
const locales = cfg.languages.filter(code => !missing.includes(code) && (!ONLY || ONLY.includes(code))).map(code => {
  const L = JSON.parse(fs.readFileSync(path.join(SRC, 'locales', code + '.json'), 'utf8'));
  if (L.lang !== code) throw new Error(code + '.json: lang mismatch');
  return typo(L);   // src/typo.js: неразрывные пробелы во французском, знаки чисел в арабском
});
const LANG_ROWS = Math.ceil(locales.length / 2); // меню языков в две колонки: число строк для CSS (--lrows)
const arrow = L => L.dir === 'rtl' ? '←' : '→';   // стрелка «дальше» у ссылок; в арабском указывает влево
const def = locales.find(L => L.lang === cfg.defaultLang) || locales[0];
const pathOf = code => code === def.lang ? '' : code + '/';   // язык по умолчанию живёт в корне сайта
const urlOf = code => siteUrl + '/' + pathOf(code);
const hls = code => { const v = cfg.hreflang && cfg.hreflang[code]; return v ? (Array.isArray(v) ? v : [v]) : [code]; };
const hl = code => hls(code)[0];
const hreflangTags = locales.flatMap(L => hls(L.lang).map(h => `<link rel="alternate" hreflang="${h}" href="${urlOf(L.lang)}">`))
  .concat([`<link rel="alternate" hreflang="x-default" href="${siteUrl}/">`]).join('\n');
const escFull = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tFor = L => (key, vars) => { let v = L.ui[key]; if (v == null) v = key; if (vars) v = v.replace(/\{(\w+)\}/g, (_, n) => vars[n] != null ? vars[n] : '{' + n + '}'); return v; };
const KEYS = ['D', 'I', 'S', 'C'];
const LANG_PATH = Object.fromEntries(locales.map(L => [L.lang, pathOf(L.lang)]));
const LANG_META = Object.fromEntries(locales.map(L => [L.lang, { name: L.name, cont: L.ui['root.continue'] || L.name, dir: L.dir }]));
const today = (d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10))(new Date()); // местная дата, как у дат коммитов (git %cs)
const fmtDate = (iso, L) => { try { return new Intl.DateTimeFormat(L.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso + 'T12:00:00Z')); } catch (e) { return iso; } };
// Файлы с незакоммиченными правками считаем изменёнными сегодня: иначе в sitemap попала бы дата прошлого коммита
const dirty = (() => { try { return new Set(execSync('git status --porcelain -z', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\0').filter(Boolean).map(l => l.slice(3))); } catch (e) { return new Set(); } })();
const lastmod = files => { if (files.some(f => dirty.has(f))) return today;
  try { return execSync('git log -1 --format=%cs -- ' + files.map(f => JSON.stringify(f)).join(' '), { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; } catch (e) { return null; } };
// Дата изменения страницы — по её собственному содержимому, а не по дате правки локали целиком: иначе любая правка
// одной строки обновляла бы lastmod всех 40 страниц языка, и поисковики перестают доверять этой дате.
// src/lastmod.json хранит отпечаток содержимого и дату для каждой страницы ("ru:colors/"); коммитится вместе с docs/.
// Новый адрес получает дату последнего коммита своих файлов, изменённый — сегодняшнюю, неизменный сохраняет прежнюю.
const LASTMOD_FILE = path.join(SRC, 'lastmod.json');
const lmOld = fs.existsSync(LASTMOD_FILE) ? JSON.parse(fs.readFileSync(LASTMOD_FILE, 'utf8')) : {}, lmNew = {};
// p — дата первой публикации (datePublished в разметке Article): у страниц, опубликованных до появления поля, — по журналу
// работ (PROJECT.md): сайт и первые разделы — 7 сентября 2026, расшифровка, цвета, совместимость, команда, MBTI и PDF — 8 сентября,
// четыре языка второй волны — 20 сентября; у новых страниц — дата первой сборки. История git для этого не годится: клоны бывают неполными.
const WAVE2 = ['id', 'tr', 'pl', 'zh-hant'];
const firstPublished = key => { const [lang, sub] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  return WAVE2.includes(lang) ? '2026-09-20' : /^(results|colors|compatibility|teams|disc-vs-mbti|pdf)/.test(sub) ? '2026-09-08' : '2026-09-07'; };
const contentDate = (key, text, files) => { const h = crypto.createHash('sha1').update(text).digest('hex').slice(0, 16), old = lmOld[key];
  const d = old ? (old.h === h ? old.d : today) : (lastmod(files) || today); lmNew[key] = { h, d, p: old ? (old.p || firstPublished(key)) : today }; return d; };
// Локаль для скрипта главной — только то, что нужно тесту, отчёту и блоку под тестом: у профилей название и краткое описание,
// из статей — content.home (ссылка «Ваш цвет DISC» в отчёте и названия цветов для неё убраны 2026-10-21). Тексты статей и страниц профилей
// (profiles.*.deep, careers, team, with, content.*) раньше попадали в скрипт целиком — ~150 КБ лишнего на главной (аудит 3, п. 4).
const homeLocale = L => Object.assign({}, L, {
  // ui: тексты уведомления о cookie — по режиму языка; ключи pd.* нужны главной только при включённой галочке согласия (pd.cookie* — никогда: они уже подставлены)
  ui: Object.assign(Object.fromEntries(Object.entries(L.ui).filter(([k]) => !k.startsWith('pd.') || (pdOn && !k.startsWith('pd.cookie')))), noticeUi(L)),
  profiles: Object.fromEntries(Object.entries(L.profiles).map(([k, p]) => [k, { name: p.name, summary: p.summary }])),
  // product — тексты блока «Расширенный отчёт» на экране результата (цена уже подставлена); страница отчёта в скрипт не идёт
  content: Object.assign({ home: L.content.home }, hasCvPromo(L) ? { cvPromo: L.content.cvPromo } : {},
    hasProduct(L) ? { product: Object.assign(withPrice(L, L.content.product.block), hasSamples(L) ? {} : { sample: '' },
      L.content.product.promo ? { promo: withPrice(L, L.content.product.promo) } : {}, homePay(L) ? { pay: homePay(L) } : {}) } : {})
});
// Покупка прямо на экране результата (src/pay.js, payForms): тексты формы — те же, что на странице отчёта; ссылки в условии оферты и в ошибке —
// готовая разметка, адрес оферты начинается с {base} (скрипт главной подставляет путь языковой версии). Без payEndpoint кнопки ведут на страницу отчёта
function homePay(L) {
  const C = L.content, pay = payEndpoint && C.product && C.product.pay ? withPrice(L, C.product.pay) : null; if (!pay) return null;
  const vars = { offer: `<a href="{base}offer/">${escFull(C.offer.linkText)}</a>`, email: feedbackEmail ? `<a href="mailto:${escFull(feedbackEmail)}">${escFull(feedbackEmail)}</a>` : '—' };
  const fill = h => h.replace(/\{(offer|email)\}/g, (m, k) => vars[k]);
  return Object.assign({ noteHtml: fill(escFull(pay.note)), errorHtml: fill(escFull(pay.error)), more: C.product.more, offer: payOffer(L), code: payCodeT(L, fill) },
    Object.fromEntries(['text', 'emailLabel', 'emailPlaceholder', 'button', 'badEmail', 'wait', 'guarantee'].map(k => [k, pay[k]])));
}
// Организация-издатель: одна карточка на весь сайт, с адресом для связи
const orgLd = () => ({ '@context': 'https://schema.org', '@type': 'Organization', name: 'DISC Test', url: siteUrl + '/', logo: `${siteUrl}/icon-512.png`, email: feedbackEmail || undefined });
const jsonLd = L => JSON.stringify([
  { '@context': 'https://schema.org', '@type': 'WebSite', name: 'DISC Test', alternateName: [...new Set([L.brand, 'disc-test.org'])].filter(x => x !== 'DISC Test'), url: siteUrl + '/', inLanguage: hl(L.lang) },
  orgLd(),
  { '@context': 'https://schema.org', '@type': 'WebApplication', name: L.brand, url: urlOf(L.lang), description: L.description,
    applicationCategory: 'BusinessApplication', applicationSubCategory: 'Personality test', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', inLanguage: hl(L.lang),
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, image: `${siteUrl}/og/${L.lang}.png`,
    publisher: { '@type': 'Organization', name: 'DISC Test', url: siteUrl + '/', logo: `${siteUrl}/icon-512.png` } }
]).replace(/</g, '\\u003c');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const L of locales) {
  const f = FONTS[L.lang] || FONTS.default;
  const isRoot = L.lang === def.lang, rootRel = isRoot ? './' : '../';
  const href = x => rootRel + pathOf(x.lang);
  const navHtml = navItems(L).map(([k, sub]) => `<a href="${rootRel + pathOf(L.lang) + sub}"${sub === '' ? ' aria-current="page"' : ''}>${esc(L.ui[k])}</a>`).join('');
  const footHtml = footLinks(L, rootRel + pathOf(L.lang)), footShortHtml = footShort(L, rootRel + pathOf(L.lang));
  const introBuilt = introHTML({ L, t: tFor(L), esc: escFull, KEYS, colorVar: k => 'var(--' + k.toLowerCase() + ')', progDone: 0, lastDate: '',
    links: { styles: rootRel + pathOf(L.lang) + 'styles/', profiles: rootRel + pathOf(L.lang) + 'profiles/', pdf: rootRel + pathOf(L.lang) + 'pdf/', results: rootRel + pathOf(L.lang) + 'results/', faq: rootRel + pathOf(L.lang) + 'faq/', profile: k => rootRel + pathOf(L.lang) + 'profiles/' + k.toLowerCase() + '/',
      cv: hasCvPromo(L) ? rootRel + pathOf(L.lang) + 'cv/' : '' } });
  pages.push({ lang: L.lang, sub: '', date: contentDate(L.lang + ':', [L.title, L.description, introBuilt.split(rootRel + pathOf(L.lang)).join('~/')].join('\n'), [`src/locales/${L.lang}.json`, 'src/template.html', 'src/intro.js']) });
  const chevron = `<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const switcher = `<div class="langsel" id="langSel">` +
    `<button type="button" class="langbtn" id="langBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(L.ui.langLabel)}: ${esc(L.name)}">${flag(L.lang)}<span class="langname">${esc(L.name)}</span>${chevron}</button>` +
    `<ul class="langmenu" id="langMenu" role="listbox" aria-label="${esc(L.ui.langLabel)}" style="--lrows:${LANG_ROWS}" hidden>` +
    locales.map(x => `<li role="none"><a role="option" href="${href(x)}" hreflang="${hl(x.lang)}" lang="${hl(x.lang)}" data-lang="${x.lang}" aria-selected="${x.lang === L.lang}" tabindex="-1">${flag(x.lang)}<span>${esc(x.name)}</span></a></li>`).join('') +
    `</ul></div>`;
  const links = locales.map(x => `<a href="${href(x)}" hreflang="${hl(x.lang)}" lang="${hl(x.lang)}" data-lang="${x.lang}"${x.lang === L.lang ? ' aria-current="page"' : ''}>${flag(x.lang)}<span>${esc(x.name)}</span></a>`).join('');
  const html = tpl
    .replace(/__LANG__/g, hl(L.lang)).replace(/__DIR__/g, L.dir)
    .replace(/__TITLE__/g, esc(L.title)).replace(/__DESC__/g, esc(L.description))
    .replace(/__CANONICAL__/g, urlOf(L.lang)).replace(/__OG_LOCALE__/g, OG_LOCALE[L.lang] || L.lang)
    .replace(/__OG_ALTERNATES__/g, () => locales.filter(x => x !== L).map(x => `<meta property="og:locale:alternate" content="${OG_LOCALE[x.lang] || x.lang}">`).join('\n'))
    .replace(/__OG_IMAGE__/g, `${siteUrl}/og/${L.lang}.png`)
    .replace(/__ROOT_REL__/g, rootRel).replace(/__IS_ROOT__/g, isRoot ? '1' : '0')
    .replace('__LANG_PATH_JSON__', () => JSON.stringify(LANG_PATH)).replace('__LANG_META_JSON__', () => JSON.stringify(LANG_META).replace(/</g, '\\u003c'))
    .replace('__JSON_LD__', () => jsonLd(L))
    .replace('__INTRO_JS__', () => introJs.replace(/\nif \(typeof module[^\n]*\n?$/, '\n'))
    .replace('__COMMON_JS__', () => commonJs).replace('__GRAPH_JS__', () => graphJs)
    .replace('__NAV__', () => navHtml).replace('__FOOT_LINKS__', () => footHtml).replace('__FOOT_SHORT__', () => footShortHtml).replace('__MATERIALS__', () => materialsHtml(L, rootRel + pathOf(L.lang), null))
    .replace('__INTRO_HTML__', () => introBuilt)
    .replace(/__HREFLANG__/g, hreflangTags).replace(/__HEAD_EXTRA__/g, () => headExtraFor(L))
    .replace(/__FONTS_HEAD__/g, () => fontsHead(f, L)).replace(/__FONT_HEAD__/g, f.head).replace(/__FONT_BODY__/g, f.body)
    .replace(/__BRAND__/g, esc(L.brand)).replace(/__LANG_LABEL__/g, esc(L.ui.langLabel))
    .replace('__LANG_SWITCHER__', () => switcher).replace('__LANG_LINKS__', () => links).replace('__FLAG_SPRITE__', () => flagSprite(locales.map(x => x.lang)))
    .replace(/__FOOTER__/g, esc(L.ui.footer)).replace(/__ADMIN_LINK__/g, esc(L.ui.adminLink)).replace(/__PRIVACY__/g, esc(L.ui.privacy)).replace('__LEGAL__', () => rightsHtml(L))
    .replace(/__EMAIL__/g, String(cfg.contactEmail || '').replace(/['\\]/g, ''))
    .replace(/__SEND_ENDPOINT__/g, String(cfg.sendEndpoint || '').replace(/['\\]/g, '')).replace(/__PAY_ENDPOINT__/g, homePay(L) ? payEndpoint.replace(/['\\]/g, '') : '')
    .replace('__PAY_JS__', () => homePay(L) ? payJs : '')
    .replace(/__SEND_TOKEN__/g, String(cfg.sendToken || '').replace(/['\\]/g, '')).replace(/__NEWSLETTER__/g, newsletter ? '1' : '0').replace(/__STATS__/g, profileStats ? '1' : '0').replace(/__PDF_DL__/g, pdfDownload ? '1' : '0').replace(/__RESULT_EMAIL__/g, resultEmail ? '1' : '0').replace(/__HOME_SUB__/g, homeSub ? '1' : '0')
    .replace(/__PD__/g, pdOn && cfg.sendEndpoint ? '1' : '0').replace(/__PD_VERSION__/g, pdVersion)
    .replace('__LOCALE_JSON__', () => JSON.stringify(homeLocale(L)).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, ''));
  fs.mkdirSync(path.join(OUT, pathOf(L.lang)), { recursive: true });
  fs.writeFileSync(path.join(OUT, pathOf(L.lang), 'index.html'), html);
}
// ---------- Контентные страницы: четыре стиля, каталог и 16 профилей ----------
const colorVar = k => 'var(--' + k.toLowerCase() + ')';
const badge = (key, cls) => `<span class="${cls || 'badge'}" style="--kp:${colorVar(key[0])};--ks:${key[1] ? colorVar(key[1]) : 'inherit'}"><span class="p">${key[0]}</span>${key[1] ? `<span class="s">${key[1]}</span>` : ''}</span>`;
const ul = arr => '<ul>' + arr.map(x => `<li>${escFull(x)}</li>`).join('') + '</ul>';
// Секция текстовой страницы: {h, p:[абзацы], ul|ol:[пункты], after:[абзацы после списка]}
const listHtml = (tag, arr) => `<${tag}>` + arr.map(x => `<li>${escFull(x)}</li>`).join('') + `</${tag}>`;
const sectionsHtml = secs => secs.map(sec => `<h2>${escFull(sec.h)}</h2>` + (sec.p || []).map(par => `<p>${escFull(par)}</p>`).join('') + (sec.ul ? listHtml('ul', sec.ul) : '') + (sec.ol ? listHtml('ol', sec.ol) : '') + (sec.after || []).map(par => `<p>${escFull(par)}</p>`).join('')).join('');
const truncate = (str, n) => str.length <= n ? str : str.slice(0, n).replace(/\s+\S*$/, '') + '…';
// предел description для шаблонных описаний (профили, пары): в японском и китайском выдача показывает около 95 знаков, и пробелов для обрезки там нет
const descMax = L => /^(ja|zh)/.test(L.lang) ? 90 : 155;
// Обрезка description: по концу последнего влезающего предложения, если остаётся не меньше 60 % предела, — без многоточия,
// так что призыв в конце шаблона либо помещается целиком, либо отбрасывается; иначе по слову с «…» без знака препинания
// перед ним (раньше обрыв «…на сайте…» и «.…» были у 43 пар и почти всех профилей — аудит 3, п. 2)
const truncDesc = (L, str, max) => { const n = max || descMax(L); if (str.length <= n) return str;
  const cjk = /^(ja|zh)/.test(L.lang); let end = -1;
  for (let i = 0; i < n; i++) if ((cjk ? /[。！？]/ : /[.!?।؟]/).test(str[i]) && (cjk || i + 1 === str.length || /\s/.test(str[i + 1]))) end = i + 1;
  if (end >= n * 0.6) return str.slice(0, end);
  const cut = str.slice(0, n);
  return (cjk ? cut : cut.replace(/\s+\S*$/, '')).replace(/[\s.,;:!?।؟،、，。：—–-]+$/, '') + '…'; };
const styleSections = (L, k, t, full) => {
  const st = L.styles[k];
  return `<div class="sections">` +
    `<div class="sec"><h3>${t('report.strengths')}</h3>${ul(st.strengths)}</div>` +
    `<div class="sec"><h3>${t('report.growth')}</h3>${ul(st.growth)}</div>` +
    (full ? `<div class="sec"><h3>${t('report.motivation')}</h3>${ul(st.motivation)}</div>` +
      `<div class="sec"><h3>${t('report.communication')}</h3>${ul(st.communication)}</div>` +
      `<div class="sec"><h3>${t('report.stress')}</h3><p>${escFull(st.stress)}</p></div>` +
      `<div class="sec"><h3>${t('report.environment')}</h3><p>${escFull(st.environment)}</p></div>` : '') +
    `</div>`;
};
const ctaBlock = (L, t, homeHref) => `<aside class="cta"><div><h2>${t('cta.title')}</h2><p>${escFull(t('cta.text'))}</p></div><a class="btn" href="${homeHref}" data-goal="cta-bottom">${t('cta.button')}</a></aside>`;
// Призыв сразу после вводного абзаца: с поиска приходят на профили, расшифровку, PDF, а кнопка теста была только в конце
// страницы (на телефоне — через 4–10 экранов). data-goal — цели Метрики cta-top / cta-bottom / cta-float (аудит 3, п. 1)
const ctaTop = (t, homeHref, key, btn) => `<aside class="cta cta-top no-print"><p>${escFull(t(key || 'cta.inline'))}</p><a class="btn" href="${homeHref}" data-goal="cta-top">${escFull(btn || t('cta.button'))}</a></aside>`;
// Карточка профиля или пары (та же картинка, что og:image) картинкой в тексте страницы: её индексируют Google Картинки,
// встроенный SVG и метатеги — нет (аудит 3, п. 10). Ставится после верхнего призыва, первый экран не удлиняет.
const ogFigure = (src, alt) => `<figure class="ogfig"><img src="${src}" width="1200" height="630" alt="${escFull(alt)}" loading="lazy" decoding="async"></figure>`;
// Таблица всех 16 профилей: строки — ведущий стиль, столбцы — без вторичного и вторичный D, I, S, C (аудит 3, п. 9)
const profilesTable = (L, t, base) => `<h2>${escFull(t('pages.profiles.tableTitle'))}</h2><div class="tablewrap"><table class="cmp ptable"><thead><tr><th>${escFull(t('pages.profiles.colLead'))}</th><th>${escFull(t('pages.profiles.colPure'))}</th>` +
  KEYS.map(k => `<th>${ltr('+ ' + k)}</th>`).join('') + `</tr></thead><tbody>` +
  KEYS.map(p => `<tr><th scope="row"><span class="k" style="color:${colorVar(p)}">${p}</span> ${escFull(L.keys[p])}</th>` +
    [''].concat(KEYS).map(s2 => s2 === p ? `<td class="na">—</td>` : `<td><a href="${base}profiles/${(p + s2).toLowerCase()}/">${escFull(L.profiles[p + s2].name)}</a> <small>${ltr(p + s2)}</small></td>`).join('') + `</tr>`).join('') +
  `</tbody></table></div>`;
// description страницы профиля: profiles.<код>.metaDesc и призыв pages.profile.descCta, если он помещается целиком
const profileDesc = (L, key, t) => { const pr = L.profiles[key], cta = t('pages.profile.descCta'), sep = /^(ja|zh)/.test(L.lang) ? '' : ' ';
  if (!pr.metaDesc) return truncDesc(L, t('pages.profile.description', { name: pr.name, key, summary: pr.summary }), descMax(L) - cta.length - sep.length) + sep + cta;
  if (pr.metaDesc.length + sep.length + cta.length <= descMax(L)) return pr.metaDesc + sep + cta;
  console.warn(`WARNING: ${L.lang} profiles.${key}.metaDesc длиннее ${descMax(L) - cta.length - sep.length} знаков — призыв не добавлен`);
  return truncDesc(L, pr.metaDesc); };
// похожие профили: обратный порядок букв (DI ↔ ID), чистый ведущий стиль и смешанные профили с тем же ведущим стилем; не больше четырёх
const related = key => [...new Set([key.length === 2 ? key[1] + key[0] : null, key.length === 2 ? key[0] : null].concat(PROFILE_KEYS.filter(k => k[0] === key[0] && k.length === 2)))].filter(k => k && k !== key).slice(0, 4);
const profileCard = (L, key, base) => { const pr = L.profiles[key]; const names = key.split('').map(k => L.keys[k]).join(' + ');
  return `<a class="pcard" href="${base}profiles/${key.toLowerCase()}/">${badge(key)}<span><strong>${escFull(pr.name)}</strong><small>${key} · ${escFull(names)}</small><p>${escFull(truncate(pr.summary, 110))}</p></span></a>`; };

function writeContentPage(L, sub, opts) {
  const t = tFor(L), f = FONTS[L.lang] || FONTS.default;
  const depth = (pathOf(L.lang) + sub).split('/').length - 1, rootRel = depth ? '../'.repeat(depth) : './';
  const base = rootRel + pathOf(L.lang), homeHref = base || './';
  // opts.langs — локали, в которых есть эта страница (по умолчанию все): в остальных языках переключатель ведёт на главную, hreflang на них не ставится
  const own = opts.langs || locales, subOf = x => own.includes(x) ? sub : '';
  const switcher = `<div class="langsel" id="langSel">` +
    `<button type="button" class="langbtn" id="langBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(L.ui.langLabel)}: ${esc(L.name)}">${flag(L.lang)}<span class="langname">${esc(L.name)}</span><svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` +
    `<ul class="langmenu" id="langMenu" role="listbox" aria-label="${esc(L.ui.langLabel)}" style="--lrows:${LANG_ROWS}" hidden>` +
    locales.map(x => `<li role="none"><a role="option" href="${rootRel + pathOf(x.lang) + subOf(x)}" hreflang="${hl(x.lang)}" lang="${hl(x.lang)}" data-lang="${x.lang}" aria-selected="${x.lang === L.lang}" tabindex="-1">${flag(x.lang)}<span>${esc(x.name)}</span></a></li>`).join('') + `</ul></div>`;
  const links = locales.map(x => `<a href="${rootRel + pathOf(x.lang) + subOf(x)}" hreflang="${hl(x.lang)}" lang="${hl(x.lang)}" data-lang="${x.lang}"${x.lang === L.lang ? ' aria-current="page"' : ''}>${flag(x.lang)}<span>${esc(x.name)}</span></a>`).join('');
  const navHtml = navItems(L).map(([k, s2]) => `<a href="${base + s2}"${opts.navKey === k ? ' aria-current="page"' : ''}>${esc(L.ui[k])}</a>`).join('');
  const footHtml = footLinks(L, base);
  const pageFiles = [`src/locales/${L.lang}.json`, 'src/page.html', 'build.js'].concat(opts.files || []);
  const updated = contentDate(L.lang + ':' + sub, [opts.title, opts.description, opts.content].join('\n'), pageFiles), published = lmNew[L.lang + ':' + sub].p;
  const updatedHtml = opts.noDate ? '' : `<p class="updated"><time datetime="${updated}">${esc(t('pages.updated', { date: fmtDate(updated, L) }))}</time></p>`;
  const crumbs = [{ name: L.ui['nav.home'], href: homeHref }].concat(opts.crumbs || []);
  const crumbsHtml = crumbs.map((c, i) => i === crumbs.length - 1 ? `<span aria-current="page">${esc(c.name)}</span>` : `<a href="${c.href}">${esc(c.name)}</a><span>›</span>`).join('');
  const hreflang = own.length < 2 ? '' : own.flatMap(x => hls(x.lang).map(h => `<link rel="alternate" hreflang="${h}" href="${urlOf(x.lang) + sub}">`)).concat(own.includes(def) ? [`<link rel="alternate" hreflang="x-default" href="${siteUrl}/${sub}">`] : []).join('\n');
  const ld = JSON.stringify([
    { '@context': 'https://schema.org', '@type': opts.ldType || (opts.article ? 'Article' : 'WebPage'), headline: opts.article ? opts.title : undefined, name: opts.title, description: opts.description, url: urlOf(L.lang) + sub, inLanguage: hl(L.lang),
      datePublished: opts.article ? (published < updated ? published : updated) : undefined, dateModified: opts.article ? updated : undefined, author: opts.article ? { '@type': 'Organization', name: 'DISC Test', url: siteUrl + '/' } : undefined,
      image: opts.article ? (opts.ogImage || `${siteUrl}/og/${L.lang}.png`) : undefined,
      primaryImageOfPage: !opts.article && opts.ogImage ? { '@type': 'ImageObject', url: opts.ogImage, width: 1200, height: 630 } : undefined, publisher: opts.article ? { '@type': 'Organization', name: 'DISC Test', url: siteUrl + '/', logo: `${siteUrl}/icon-512.png` } : undefined,
      isPartOf: { '@type': 'WebSite', name: 'DISC Test', url: siteUrl + '/' } },
    ...(opts.article ? [orgLd()] : []),
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: i === 0 ? urlOf(L.lang) : urlOf(L.lang) + (c.sub || sub) })) }
  ].concat(opts.ldExtra || [])).replace(/</g, '\\u003c');
  const miniL = { lang: L.lang, name: L.name, dir: L.dir, dateLocale: L.dateLocale, ui: Object.fromEntries(Object.entries(L.ui).filter(([k]) => k === 'langLabel' || k === 'root.continue' || k.startsWith('consent.') || (opts.uiKeys && opts.uiKeys.test(k)))) };
  Object.assign(miniL.ui, noticeUi(L));
  // opts.bare — самостоятельная страница (лендинг): без шапки сайта (название и выбор языка), пунктов меню, хлебных крошек и подвала; opts.css — стили только этой страницы
  const tpl = !opts.bare ? pageTpl : pageTpl.replace(/\s*<header class="topbar">[\s\S]*?<\/header>/, '').replace(/\s*<footer class="foot">[\s\S]*?<\/footer>/, '')
    .replace(/\s*<nav class="sitenav no-print">__NAV__<\/nav>/, '').replace(/\s*<nav class="crumbs">__CRUMBS__<\/nav>/, '');
  const html = tpl.replace('</head>', () => opts.css ? `<style>${opts.css}</style>\n</head>` : '</head>')
    .replace(/__LANG__/g, hl(L.lang)).replace(/__DIR__/g, L.dir)
    .replace(/__TITLE__/g, esc(opts.title)).replace(/__DESC__/g, esc(opts.description))
    .replace('__ROBOTS__', opts.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large')
    .replace(/__CANONICAL__/g, urlOf(L.lang) + sub).replace(/__OG_LOCALE__/g, OG_LOCALE[L.lang] || L.lang)
    .replace(/__OG_ALTERNATES__/g, () => own.filter(x => x !== L).map(x => `<meta property="og:locale:alternate" content="${OG_LOCALE[x.lang] || x.lang}">`).join('\n'))
    .replace(/__OG_IMAGE__/g, opts.ogImage || `${siteUrl}/og/${L.lang}.png`).replace(/__HREFLANG__/g, hreflang).replace(/__HEAD_EXTRA__/g, () => headExtraFor(L))
    .replace(/__ROOT_REL__/g, rootRel).replace('__JSON_LD__', () => ld)
    .replace(/__FONTS_HEAD__/g, () => fontsHead(f, L)).replace('__STYLE__', () => styleBlock.replace(/__FONT_HEAD__/g, f.head).replace(/__FONT_BODY__/g, f.body))
    .replace('__FLAG_SPRITE__', () => flagSprite(locales.map(x => x.lang)))
    .replace(/__BRAND__/g, esc(L.brand)).replace(/__HOME_HREF__/g, homeHref).replace(/__LANG_LABEL__/g, esc(L.ui.langLabel))
    .replace('__LANG_SWITCHER__', () => switcher).replace('__NAV__', () => navHtml).replace('__CRUMBS__', () => crumbsHtml).replace('__FOOT_LINKS__', () => footHtml).replace('__MATERIALS__', () => materialsHtml(L, base, sub))
    .replace('__CONTENT__', () => opts.content + updatedHtml)
    .replace('__CTA_FLOAT__', () => opts.content.includes('class="cta cta-top') ? `<a class="btn ctafloat no-print" id="ctaFloat" href="${homeHref}" data-goal="cta-float">${esc(t('cta.button'))}</a>` : '')
    .replace(/__FOOTER__/g, esc(L.ui.footer)).replace(/__PRIVACY__/g, esc(L.ui.privacy)).replace('__LEGAL__', () => (sub === 'contact/' ? legalHtml(L) : '') + rightsHtml(L)).replace('__LANG_LINKS__', () => links)
    .replace('__LOCALE_JSON__', () => JSON.stringify(miniL).replace(/</g, '\\u003c'))
    .replace(/__SUBPATH__/g, sub).replace('__PAGE_LANGS_JSON__', () => opts.langs ? JSON.stringify(own.map(x => x.lang)) : 'null')
    .replace('__LANG_PATH_JSON__', () => JSON.stringify(LANG_PATH)).replace('__LANG_META_JSON__', () => JSON.stringify(LANG_META).replace(/</g, '\\u003c'))
    .replace('__COMMON_JS__', () => commonJs).replace('__PAGE_JS__', () => opts.pageJs || '').replace('__NO_XBAR__', opts.bare ? 'true' : 'false');
  fs.mkdirSync(path.join(OUT, pathOf(L.lang), sub), { recursive: true });
  fs.writeFileSync(path.join(OUT, pathOf(L.lang), sub, 'index.html'), html);
  (writtenSubs[L.lang] = writtenSubs[L.lang] || []).push(sub);
  if (!opts.noindex) pages.push({ lang: L.lang, sub, date: updated, langs: own });
}

for (const L of locales) {
  const t = tFor(L), base0 = pathOf(L.lang);
  // /styles/
  const stylesContent = `<div class="eyebrow">DISC</div><h1>${t('pages.styles.h1')}</h1><p class="lead">${escFull(t('pages.styles.lead'))}</p>` + ctaTop(t, '../') +
    `<p class="seealso"><a href="../colors/">${esc(L.ui['nav.colors'])} ${arrow(L)}</a> · <a href="../compatibility/">${esc(L.ui['nav.compat'])} ${arrow(L)}</a> · <a href="../results/">${esc(L.ui['nav.results'])} ${arrow(L)}</a></p>` +
    KEYS.map(k => { const st = L.styles[k], pr = L.profiles[k], b = '../';
      return `<section class="stylefull" id="${k.toLowerCase()}" style="--k:${colorVar(k)}"><h2><span class="k">${k}</span>${escFull(L.keys[k])} · ${escFull(pr.name)}</h2><p class="muted">${escFull(L.short[k])}</p><p>${escFull(pr.summary)}</p>` +
        `<div class="traits">${st.traits.map(x => `<span>${escFull(x)}</span>`).join('')}</div>` + styleSections(L, k, t, true) +
        `<a class="more" href="${b}profiles/${k.toLowerCase()}/">${t('pages.profile.more', { name: escFull(pr.name) })}</a></section>`; }).join('') +
    ctaBlock(L, t, '../') + `<h2>${t('pages.profiles.h1')}</h2><div class="pgrid">${PROFILE_KEYS.map(k => profileCard(L, k, '../')).join('')}</div>`;
  writeContentPage(L, 'styles/', { navKey: 'nav.styles', title: t('pages.styles.title'), description: t('pages.styles.description'), crumbs: [{ name: t('nav.styles') }], content: stylesContent });
  // /profiles/
  const profilesContent = `<div class="eyebrow">DISC</div><h1>${t('pages.profiles.h1')}</h1><p class="lead">${escFull(t('pages.profiles.lead'))}</p>` + ctaTop(t, '../') +
    `<div class="pgrid">${PROFILE_KEYS.map(k => profileCard(L, k, '../')).join('')}</div>` + profilesTable(L, t, '../') + sectionsHtml(L.content.profiles.sections) + ctaBlock(L, t, '../');
  writeContentPage(L, 'profiles/', { navKey: 'nav.profiles', title: t('pages.profiles.title'), description: t('pages.profiles.description'), crumbs: [{ name: t('nav.profiles') }], content: profilesContent });
  // /profiles/<key>/
  for (const key of PROFILE_KEYS) {
    const pr = L.profiles[key], dp = pr.deep, p = key[0], s2 = key[1] || null, b = '../../';
    const content = `<div class="eyebrow">${t('pages.profile.eyebrow', { key })}</div>` +
      `<div class="rhead">${badge(key)}<div class="rtitle"><h1>${escFull(t('pages.profile.h1', { name: pr.name, key: '\u0000' })).replace('\u0000', ltr(key))}</h1><div class="meta">${escFull(s2 ? L.keys[p] + ' + ' + L.keys[s2] : L.keys[p])}</div></div></div>` +
      `<p class="lead">${escFull(pr.summary)}</p>` + ctaTop(t, b, 'cta.inlineProfile') +
      (fs.existsSync(path.join(ASSETS, 'og', 'profiles', `${L.lang}-${key.toLowerCase()}.png`)) ? ogFigure(`${b}${pathOf(L.lang) ? '../' : ''}og/profiles/${L.lang}-${key.toLowerCase()}.png`,
        `${t('pages.profile.h1', { name: pr.name, key })} · ${s2 ? L.keys[p] + ' + ' + L.keys[s2] : L.keys[p]}`) : '') +
      (() => { const sc = sampleScore(SAMPLE_NET[key]);
        return `<section class="example"><h2>${t('pages.profile.exampleTitle')}</h2><p>${escFull(t('pages.profile.exampleText', { name: pr.name }))}</p>` +
          `<div class="card graphcard"><div class="graph"><h3>${t('report.graphTitle')}</h3>${graphSVG(sc, { net: true }, { label: t('report.graphAria'), colorVar, keys: KEYS })}</div>` +
          `<div><h3>${t('report.statsTitle')}</h3><div class="stats">` + KEYS.map(k => `<div class="stat" style="--k:${colorVar(k)}"><span class="k">${k}</span><span class="nm">${escFull(L.keys[k])}</span><span class="v">${pct(sc.net[k])}%</span><div class="bar"><i style="width:${pct(sc.net[k])}%"></i></div></div>`).join('') + `</div></div></div></section>`; })() +
      // Уникальный текст профиля (profiles.<код>.deep); ведущий и вторичный стиль — кратко, со ссылкой на «Четыре стиля»:
      // полные описания стилей повторялись на четырёх страницах профилей и на /styles/ (аудит 2, п. 4.1)
      (dp ? `<h2>${t('pages.profile.vs')}</h2><p>${escFull(dp.vs)}</p>` : '') +
      `<div class="sections">` + [p].concat(s2 ? [s2] : []).map((k, i) => `<div class="sec kcol" style="--k:${colorVar(k)}"><h3>${escFull(t(i ? 'pages.profile.secondary' : 'pages.profile.primary', { name: L.keys[k], key: k }))}</h3>` +
        `<p>${escFull(i ? t('report.secondaryAddon', { addon: L.addon[k] }) : L.short[k] + '.')}</p><div class="traits">${L.styles[k].traits.map(x => `<span>${escFull(x)}</span>`).join('')}</div>` +
        `<a class="more" href="${b}styles/#${k.toLowerCase()}">${escFull(t('pages.profile.styleMore', { name: L.keys[k], key: k }))} ${arrow(L)}</a></div>`).join('') + `</div>` +
      (dp ? `<h2>${escFull(t('pages.profile.work', { name: pr.name }))}</h2><p>${escFull(dp.work)}</p>` : '') +
      `<h2>${t('pages.profile.careers')}</h2>${ul(pr.careers)}` +
      // анонс сервиса резюме — сразу после подходящих профессий (с 2026-10-24, где есть content.cvPromo)
      (hasCvPromo(L) ? cvPromoHTML({ P: L.content.cvPromo, esc: escFull, href: b + 'cv/', kind: 'profile' }) : '') +
      `<h2>${t('pages.profile.team')}</h2><p>${escFull(pr.team)}</p>` +
      (dp ? `<h2>${escFull(t('pages.profile.lead', { name: pr.name }))}</h2><p>${escFull(dp.lead)}</p>` +
        `<h2>${t('pages.profile.managed')}</h2><p>${escFull(dp.managed)}</p>` +
        `<h2>${t('pages.profile.pressure')}</h2><p>${escFull(dp.pressure)}</p>` +
        `<h2>${t('pages.profile.develop')}</h2>${ul(dp.develop)}` : '') +
      `<h2>${t('pages.profile.with')}</h2><div class="sections">` + KEYS.map(k => `<div class="sec kcol" style="--k:${colorVar(k)}"><h3>${escFull(t('pages.profile.withKey', { name: L.keys[k], key: k }))}</h3><p>${escFull(pr.with[k])}</p></div>`).join('') + `</div>` +
      (dp ? `<h2>${t('pages.profile.agree')}</h2><p>${escFull(dp.agree)}</p><h2>${t('pages.profile.example')}</h2><p>${escFull(dp.example)}</p>` : '') +
      `<p class="seealso"><a href="${b}compatibility/">${escFull(t('pages.profile.compatLink'))}</a></p>` +
      ctaBlock(L, t, b) +
      // похожие профили — карточки с описанием (обратный порядок букв и профили с тем же ведущим стилем), остальные — только названия
      `<h2>${t('pages.profile.related')}</h2><div class="pgrid">${related(key).map(k => profileCard(L, k, b)).join('')}</div>` +
      `<h2>${t('pages.profile.others')}</h2><p class="chips">${PROFILE_KEYS.filter(k => k !== key && !related(key).includes(k)).map(k => `<a href="${b}profiles/${k.toLowerCase()}/">${badge(k, 'pill')} ${escFull(L.profiles[k].name)}</a>`).join('')}</p>`;
    writeContentPage(L, `profiles/${key.toLowerCase()}/`, { navKey: 'nav.profiles', title: t('pages.profile.title', { name: pr.name, key }),
      // в конце — призыв пройти тест: description видна в выдаче и в карточке ссылки в соцсетях (Facebook и LinkedIn берут текст только оттуда)
      // своё описание профиля (profiles.<код>.metaDesc) + призыв; шаблон из summary давал два двоеточия и обрыв на полуслове (аудит 3, п. 2)
      description: profileDesc(L, key, t),
      crumbs: [{ name: t('nav.profiles'), href: '../', sub: 'profiles/' }, { name: pr.name }], content,
      // пришли по ссылке с ?ref= (прежние ссылки «Поделиться типом» с экрана результата; блок убран 2026-10-21, ссылки уже разосланы) — вверху баннер-приглашение пройти тест
      pageJs: `if(/[?&]ref=/.test(location.search)){ var inv = document.createElement('aside'); inv.className = 'cta invite'; inv.innerHTML = ${jsStr(
        `<div><h2>${escFull(t('invite.title', { name: pr.name }))}</h2><p>${escFull(t('invite.text'))}</p></div><a class="btn" href="${b}">${escFull(t('cta.button'))}</a>`)};` +
        `inv.querySelector('a').addEventListener('click', function(){ if(window.discTrack) window.discTrack('invite'); });` +
        `var m = $('main.content'); m.insertBefore(inv, m.firstChild); var ct = $('.cta-top'); if(ct) ct.remove(); if(window.discTrack) window.discTrack('invite-view'); }`,
      ogImage: fs.existsSync(path.join(ASSETS, 'og', 'profiles', `${L.lang}-${key.toLowerCase()}.png`)) ? `${siteUrl}/og/profiles/${L.lang}-${key.toLowerCase()}.png` : null });
  }
}

// ---------- Текстовые страницы: что такое DISC, FAQ, о проекте, конфиденциальность ----------
const tableHtml = tb => `<div class="tablewrap"><table class="cmp"><thead><tr>${tb.head.map(h => `<th>${escFull(h)}</th>`).join('')}</tr></thead><tbody>${tb.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${escFull(c)}</td>` : `<th scope="row">${escFull(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
const pdfInfo = code => { const f = path.join(ASSETS, 'pdf', `disc-test-${code}.pdf`); if (!fs.existsSync(f)) return null; const buf = fs.readFileSync(f), s = buf.toString('latin1');
  const m = s.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/); return { file: `disc-test-${code}.pdf`, size: buf.length, pages: m ? +m[1] : (s.match(/\/Type\s*\/Page(?!s)/g) || []).length }; };
for (const L of locales) {
  const t = tFor(L), C = L.content;
  const seeAlso = (base, cur) => `<p class="seealso">${MATERIALS.filter(([k]) => k !== cur).map(([k, sub]) => `<a href="${base + sub}">${esc(L.ui[k])} ${arrow(L)}</a>`).join(' · ')}</p>`;
  const d = C.disc;
  writeContentPage(L, 'disc/', { navKey: 'nav.disc', article: true, title: d.title, description: d.description, crumbs: [{ name: t('nav.disc') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(d.h1)}</h1><p class="lead">${escFull(d.lead)}</p>` + ctaTop(t, '../') + sectionsHtml(d.sections) + sourcesHtml(L, t) + ctaBlock(L, t, '../') + seeAlso('../', 'nav.disc'),
    ldExtra: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: d.sourcesTitle, itemListElement: SOURCES.map((sc, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'CreativeWork', name: sc.text, url: sc.url } })) }] });
  const f = C.faq;
  writeContentPage(L, 'faq/', { navKey: 'nav.faq', title: f.title, description: f.description, crumbs: [{ name: t('nav.faq') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(f.h1)}</h1><p class="lead">${escFull(f.lead)}</p>` + ctaTop(t, '../') + f.items.map(it => `<h2>${escFull(it.q)}</h2><p>${escFull(it.a).replace('{pdf}', `<a href="../pdf/">${escFull(t('nav.pdf'))}</a>`)}</p>`).join('') + ctaBlock(L, t, '../') + seeAlso('../', 'nav.faq'),
    ldExtra: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: f.items.map(it => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a.replace('{pdf}', t('nav.pdf')) } })) }] });
  const a = C.about;
  writeContentPage(L, 'about/', { navKey: 'nav.about', title: a.title, description: a.description, crumbs: [{ name: t('nav.about') }],
    content: (`<div class="eyebrow">DISC</div><h1>${escFull(a.h1)}</h1>` +
      sectionsHtml(a.sections.slice(0, 2)) + sectionsHtml(C.editorial.sections) + sectionsHtml(a.sections.slice(2)))
      .replace('{contact}', feedbackEmail ? `<a href="../contact/">${escFull(t('nav.contact'))}</a>` : escFull(t('nav.contact')))
      .replace('{sources}', `<a href="../disc/#sources">${escFull(L.content.disc.sourcesTitle)}</a>`) + ctaBlock(L, t, '../') });
  // /how-reports-are-made/ — «Как готовятся отчёты»: тексты отчётов написал ИИ по правилам редакции, расчёт и сборку делает программа, правила и
  // проверка — за человеком. Утверждения страницы описывают то, как отчёты готовятся на самом деле (сборщик расширенного отчёта, расчёт на сайте):
  // после смены порядка подготовки отчётов текст страницы править вместе с ним. {results}, {contact}, {privacy} — ссылки, {price} — цена услуги
  if (hasHowMade(L)) {
    const hm = withPrice(L, C.howMade), rich = str => escFull(str).replace(/&lt;(\/?)b&gt;/g, '<$1b>'), link = (sub2, text) => `<a href="../${sub2}">${escFull(text)}</a>`;
    const names = { results: t('nav.results'), contact: t('nav.contact'), privacy: t('nav.privacy') };
    const links = { results: link('results/', names.results), contact: feedbackEmail ? link('contact/', names.contact) : escFull(names.contact), privacy: link('privacy/', names.privacy) };
    const fillLinks = html => html.replace(/\{(\w+)\}/g, (m, k) => k in links ? links[k] : m), plain = str => String(str).replace(/<\/?b>/g, '').replace(/\{(\w+)\}/g, (m, k) => k in names ? names[k] : m);
    const more = [hasProduct(L) ? ['extended-report/', C.product.h1] : null, ['results/', names.results], ['about/', t('nav.about')]].filter(Boolean);
    writeContentPage(L, HOWMADE_SUB, { navKey: 'nav.howMade', langs: locales.filter(hasHowMade), title: hm.title, description: hm.description, crumbs: [{ name: t('nav.howMade') }],
      content: fillLinks(`<div class="eyebrow">DISC</div><h1>${escFull(hm.h1)}</h1><p class="lead">${escFull(hm.lead)}</p>` +
        `<ul class="xfacts">${hm.facts.map(x => `<li>${escFull(x)}</li>`).join('')}</ul>` +
        `<h2>${escFull(hm.stepsTitle)}</h2><ol>${hm.steps.map(x => `<li>${rich(x)}</li>`).join('')}</ol>` + sectionsHtml(hm.sections) +
        `<h2>${escFull(hm.benefitsTitle)}</h2><div class="hmgrid">${hm.benefits.map(b => `<div><h3>${escFull(b.h)}</h3><p>${escFull(b.p)}</p></div>`).join('')}</div>` +
        `<h2>${escFull(hm.limitsTitle)}</h2><ul>${hm.limits.map(x => `<li>${rich(x)}</li>`).join('')}</ul>` +
        `<h2>${escFull(hm.faqTitle)}</h2>` + hm.faq.map(it => `<h3 class="xq">${escFull(it.q)}</h3><p>${escFull(it.a)}</p>`).join('')) + ctaBlock(L, t, '../') +
        `<p class="seealso">${more.map(([sub2, name]) => `<a href="../${sub2}">${escFull(name)} ${arrow(L)}</a>`).join(' · ')}</p>`,
      ldExtra: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: hm.faq.map(it => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: plain(it.a) } })) }] });
  }
  // content.privacy.purchase — раздел о данных покупателя платной услуги: есть только в языках с офертой (сейчас — русский), встаёт перед «Как удалить данные»
  const pv = C.privacy, pvSecs = pv.purchase && hasOffer(L) ? pv.sections.slice(0, 4).concat([pv.purchase], pv.sections.slice(4)) : pv.sections;
  if (!pdOn) writeContentPage(L, 'privacy/', { navKey: 'nav.privacy', title: pv.title, description: pv.description, crumbs: [{ name: t('nav.privacy') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(pv.h1)}</h1>` + sectionsHtml(pvSecs).replace(/\{email\}/g, feedbackEmail ? `<a href="mailto:${escFull(feedbackEmail)}">${escFull(feedbackEmail)}</a>` : '—')
      .replace(/\{offer\}/g, () => hasOffer(L) ? `<a href="../offer/">${escFull(C.offer.linkText)}</a>` : '') });
  // Новая редакция (pdConsent): content.policy — те же разделы на всех языках; policy.purchase (данные покупателя) встаёт перед «Ваши права»
  // в языках с офертой; policy.legal — полный текст политики по статье 18.1 закона № 152-ФЗ, только в русской версии.
  // /consent/ — согласие на обработку персональных данных отдельным документом (на него ведёт галочка в формах); в индекс не идёт.
  else {
    const po = C.policy, cd = C.consentDoc, poSecs = po.purchase && hasOffer(L) ? po.sections.slice(0, 6).concat([policyPurchase(L)], po.sections.slice(6)) : po.sections;
    const pdFill = html => html.replace(/\{email\}/g, feedbackEmail ? `<a href="mailto:${escFull(feedbackEmail)}">${escFull(feedbackEmail)}</a>` : '—')
      .replace(/\{contact\}/g, feedbackEmail ? `<a href="../contact/">${escFull(t('nav.contact'))}</a>` : escFull(t('nav.contact')))
      .replace(/\{owner\}/g, escFull(pdOwner(L))).replace(/\{date\}/g, escFull(pdDate(L)))
      .replace(/\{consent\}/g, `<a href="../consent/">${escFull(t('pd.consentLink'))}</a>`).replace(/\{privacy\}/g, `<a href="../privacy/">${escFull(t('nav.privacy'))}</a>`)
      .replace(/\{offer\}/g, () => hasOffer(L) ? `<a href="../offer/">${escFull(C.offer.linkText)}</a>` : '')
      .replace(/\s*\{reset\}/g, cfg.yandexMetrikaId && analyticsMode(L) === 'optin' ? ` <button class="link" type="button" id="cookieReset">${escFull(t('pd.cookieChange'))}</button>` : '');
    writeContentPage(L, 'privacy/', { navKey: 'nav.privacy', title: po.title, description: po.description, crumbs: [{ name: t('nav.privacy') }],
      content: pdFill(`<div class="eyebrow">DISC</div><h1>${escFull(po.h1)}</h1><p class="lead">${escFull(po.lead)}</p>` + sectionsHtml(poSecs) +
        (po.legal ? `<h2 id="full">${escFull(po.legal.h1)}</h2>` + po.legal.sections.map(sec => `<h3 style="font-size:15px;text-transform:none;letter-spacing:0;color:var(--ink);margin:20px 0 6px">${escFull(sec.h)}</h3>` + sec.p.map(par => `<p>${escFull(par)}</p>`).join('')).join('') : '')),
      // «Изменить выбор cookie»: отметка о выборе стирается, после перезагрузки уведомление спрашивает заново, счётчик без согласия не загружается
      pageJs: `(function(){ var b = $('#cookieReset'); if(b) b.addEventListener('click', function(){ try{ localStorage.removeItem('disc.consent'); }catch(e){} location.reload(); }); })();` });
    writeContentPage(L, 'consent/', { noindex: true, noDate: true, title: cd.title, description: cd.description, crumbs: [{ name: t('nav.privacy'), href: '../privacy/', sub: 'privacy/' }, { name: cd.h1 }],
      content: pdFill(`<div class="eyebrow">DISC</div><h1>${escFull(cd.h1)}</h1><p class="lead">${escFull(cd.lead)}</p>` + sectionsHtml(cd.sections) + `<p class="small muted">${escFull(cd.edition)}</p>`) });
  }
  // /results/ — расшифровка результатов: текст + три примера графика (DI, SC, сбалансированный)
  const rs = C.results, exNet = { D: 4, I: 2, S: -2, C: -4 };
  const exampleHtml = ex => { const key = ex.key, sc = sampleScore(key === 'flat' ? exNet : SAMPLE_NET[key]);
    const title = key === 'flat' ? t('pages.results.flatTitle') : `${L.profiles[key].name} (${key})`;
    return `<div class="example card"><h3>${escFull(title)}</h3><div class="graph">${graphSVG(sc, { net: true }, { label: t('report.graphAria'), colorVar, keys: KEYS })}</div><div class="stats">` +
      KEYS.map(k => `<div class="stat" style="--k:${colorVar(k)}"><span class="k">${k}</span><span class="nm">${escFull(L.keys[k])}</span><span class="v">${pct(sc.net[k])}%</span><div class="bar"><i style="width:${pct(sc.net[k])}%"></i></div></div>`).join('') +
      `</div><p>${escFull(ex.text)}</p>` + (key !== 'flat' ? `<a class="more" href="../profiles/${key.toLowerCase()}/">${t('pages.profile.more', { name: escFull(L.profiles[key].name) })}</a>` : '') + `</div>`; };
  writeContentPage(L, 'results/', { navKey: 'nav.results', article: true, title: rs.title, description: rs.description, crumbs: [{ name: t('nav.results') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(rs.h1)}</h1><p class="lead">${escFull(rs.lead)}</p>` + ctaTop(t, '../', 'cta.inlineResults') + sectionsHtml(rs.sections.slice(0, 3)) +
      `<div class="examples">${rs.examples.map(exampleHtml).join('')}</div>` + sectionsHtml(rs.sections.slice(3)) + ctaBlock(L, t, '../') + seeAlso('../', 'nav.results') });
  // /colors/ — DISC по цветам: четыре цветные карточки, подробный разбор каждого цвета, текст и свой призыв «Узнать свой цвет»
  const co = C.colors;
  // Схема четырёх цветов картинкой (docs/img/disc-colors-<язык>.svg) для Google Картинок: D слева вверху, I справа, S справа внизу,
  // C слева внизу, как в круге DISC. Шрифт системный: в <img> веб-шрифты страницы недоступны (аудит 3, п. 10)
  const xmlEsc = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const QUAD = { D: [0, 0, '#C9453D', '#fff'], I: [1, 0, '#D6961F', '#1B2027'], S: [1, 1, '#3A9A69', '#fff'], C: [0, 1, '#3B6FB6', '#fff'] };
  const colorsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630"${L.dir === 'rtl' ? ' direction="rtl"' : ''}><title>${xmlEsc(co.h1)}</title>` +
    `<rect width="1200" height="630" fill="#F3F4F6"/>` + KEYS.map(k => { const [cx, cy, bg, ink] = QUAD[k], x = 24 + cx * 588, y = 24 + cy * 303, mx = x + 282;
      return `<rect x="${x}" y="${y}" width="564" height="279" rx="22" fill="${bg}"/>` +
        `<text x="${mx}" y="${y + 128}" text-anchor="middle" fill="${ink}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="108" direction="ltr">${k}</text>` +
        `<text x="${mx}" y="${y + 196}" text-anchor="middle" fill="${ink}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif" font-weight="700" font-size="40">${xmlEsc(co.colors[k].name)}</text>` +
        `<text x="${mx}" y="${y + 240}" text-anchor="middle" fill="${ink}" fill-opacity=".85" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif" font-size="28">${xmlEsc(L.keys[k])}</text>`; }).join('') + `</svg>\n`;
  fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'img', `disc-colors-${L.lang}.svg`), colorsSvg);
  const colorType = k => { const c = co.colors[k];
    return `<section class="colortype" id="type-${k.toLowerCase()}" style="--k:${colorVar(k)}"><h2><span class="k">${k}</span>${escFull(c.h)}</h2>` +
      `<h3>${escFull(co.labels.signs)}</h3>${ul(c.signs)}<h3>${escFull(co.labels.blind)}</h3><p>${escFull(c.blind)}</p><h3>${escFull(co.labels.talk)}</h3>${ul(c.talk)}` +
      `<a class="more" href="../profiles/${k.toLowerCase()}/">${t('pages.profile.more', { name: escFull(L.profiles[k].name) })}</a></section>`; };
  writeContentPage(L, 'colors/', { navKey: 'nav.colors', article: true, title: co.title, description: co.description, crumbs: [{ name: t('nav.colors') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(co.h1)}</h1><p class="lead">${escFull(co.lead)}</p>` + ctaTop(t, '../', 'cta.inlineColors', co.cta.button) + `<div class="colorgrid">` +
      KEYS.map(k => { const c = co.colors[k]; return `<section class="colorcard" id="${k.toLowerCase()}" style="--k:${colorVar(k)}"><div class="swatch">${k}</div><h2>${escFull(c.name)}</h2><p class="muted">${escFull(c.tagline)}</p><p>${escFull(c.text)}</p><div class="traits">${L.styles[k].traits.map(x => `<span>${escFull(x)}</span>`).join('')}</div><a class="more" href="#type-${k.toLowerCase()}">${escFull(c.h)} ↓</a></section>`; }).join('') +
      `</div>` + `<aside class="cta"><div><h2>${escFull(co.cta.title)}</h2><p>${escFull(co.cta.text)}</p></div><a class="btn" href="../" data-goal="cta-bottom">${escFull(co.cta.button)}</a></aside>` +
      KEYS.map(colorType).join('') + `<figure class="ogfig"><img src="${relRoot(L, 'colors/')}img/disc-colors-${L.lang}.svg" width="1200" height="630" alt="${escFull(co.h1)}" loading="lazy" decoding="async"></figure>` + sectionsHtml(co.sections) +
      `<aside class="cta"><div><h2>${escFull(co.cta.title)}</h2><p>${escFull(co.cta.text)}</p></div><a class="btn" href="../" data-goal="cta-bottom">${escFull(co.cta.button)}</a></aside>` + seeAlso('../', 'nav.colors') });
  // /compatibility/ — матрица пар и 10 страниц пар стилей
  const cp = C.compatibility;
  const pairNames = k => k[0] === k[1] ? { a: k[0], b: k[1] } : { a: L.keys[k[0]], b: L.keys[k[1]] };
  const pairCard = (k, base) => { const nm = pairNames(k);
    return `<a class="pcard" href="${base}${pairSlug(k)}/">${badge(k)}<span><strong>${escFull(nm.a)} + ${escFull(nm.b)}</strong><small>${k[0] === k[1] ? escFull(L.keys[k[0]]) : ltr(k[0] + ' · ' + k[1])}</small><p>${escFull(truncate(cp.pairs[k].summary, 110))}</p></span></a>`; };
  const matrix = `<h2>${t('pages.compat.matrix')}</h2><div class="tablewrap plain"><table class="matrix"><thead><tr><th></th>${KEYS.map(k => `<th style="color:${colorVar(k)}">${k}</th>`).join('')}</tr></thead><tbody>` +
    KEYS.map(a => `<tr><th style="color:${colorVar(a)}">${a}</th>` + KEYS.map(b => { const k = KEYS.indexOf(a) <= KEYS.indexOf(b) ? a + b : b + a;
      return `<td><a href="./${pairSlug(k)}/" style="--kp:${colorVar(k[0])};--ks:${colorVar(k[1])}" aria-label="${escFull(t('pages.compat.pairLink', { a: L.keys[k[0]], b: L.keys[k[1]] }))}"><b>${k[0]}</b><i>${k[1]}</i></a></td>`; }).join('') + `</tr>`).join('') + `</tbody></table></div>`;
  writeContentPage(L, 'compatibility/', { navKey: 'nav.compat', article: true, title: cp.title, description: cp.description, crumbs: [{ name: t('nav.compat') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(cp.h1)}</h1><p class="lead">${escFull(cp.lead)}</p>` + ctaTop(t, '../', 'cta.inlinePair') + matrix + `<div class="pgrid">${PAIRS.map(k => pairCard(k, './')).join('')}</div>` +
      sectionsHtml(cp.sections) + ctaBlock(L, t, '../') + seeAlso('../', 'nav.compat') });
  for (const k of PAIRS) {
    const a = k[0], b2 = k[1], pr = cp.pairs[k], names = pairNames(k), base = '../../';
    const content = `<div class="eyebrow">${t('nav.compat')} · ${ltr(a + ' + ' + b2)}</div>` +
      `<div class="rhead">${badge(k)}<div class="rtitle"><h1>${escFull(t('pages.compat.h1', names))}</h1><div class="meta">${ltr(a + ' · ' + b2)}</div></div></div>` +
      `<p class="lead">${escFull(pr.summary)}</p><p>${escFull(pr.text)}</p>` + ctaTop(t, base, 'cta.inlinePair') +
      (fs.existsSync(path.join(ASSETS, 'og', 'pairs', `${L.lang}-${pairSlug(k)}.png`)) ? ogFigure(`${base}${pathOf(L.lang) ? '../' : ''}og/pairs/${L.lang}-${pairSlug(k)}.png`, t('pages.compat.h1', names)) : '') +
      // H2 над карточками «Что объединяет / Где трения / Советы»: раньше после H1 сразу шли H3 (аудит 3, п. 12)
      `<h2>${escFull(t('pages.compat.together'))}</h2><div class="sections"><div class="sec"><h3>${t('pages.compat.common')}</h3>${ul(pr.common)}</div><div class="sec"><h3>${t('pages.compat.friction')}</h3>${ul(pr.friction)}</div>` +
      Object.keys(pr.tips).map(s => `<div class="sec kcol" style="--k:${colorVar(s)}"><h3>${escFull(t('pages.compat.tips', { name: L.keys[s], key: s }))}</h3>${ul(pr.tips[s])}</div>`).join('') + `</div>` +
      // свой текст пары (pairs.<код>.deep): руководитель и подчинённый в обе стороны, совещания, конфликт, вне работы, правила
      (pr.deep ? `<h2>${escFull(t('pages.compat.lead', { a, b: b2 }))}</h2><p>${escFull(pr.deep.lead)}</p>` +
        (pr.deep.leadRev ? `<h2>${escFull(t('pages.compat.lead', { a: b2, b: a }))}</h2><p>${escFull(pr.deep.leadRev)}</p>` : '') +
        `<h2>${t('pages.compat.meeting')}</h2><p>${escFull(pr.deep.meeting)}</p><h2>${t('pages.compat.conflict')}</h2><p>${escFull(pr.deep.conflict)}</p>` +
        `<h2>${t('pages.compat.life')}</h2><p>${escFull(pr.deep.life)}</p><h2>${t('pages.compat.rules')}</h2>${listHtml('ol', pr.deep.rules)}` : '') +
      `<p class="seealso">${[...new Set([a, b2])].map(s => `<a href="${base}profiles/${s.toLowerCase()}/">${t('pages.profile.more', { name: escFull(L.profiles[s].name) })}</a>`).join(' · ')}</p>` +
      ctaBlock(L, t, base) + `<h2>${t('pages.compat.other')}</h2><p class="chips">${PAIRS.filter(x => x !== k).map(x => { const n2 = pairNames(x); return `<a href="../${pairSlug(x)}/">${badge(x, 'pill')} ${escFull(n2.a)} + ${escFull(n2.b)}</a>`; }).join('')}</p>`;
    writeContentPage(L, `compatibility/${pairSlug(k)}/`, { navKey: 'nav.compat', article: true, title: t('pages.compat.title', names), description: truncDesc(L, t('pages.compat.description', names)),
      crumbs: [{ name: t('nav.compat'), href: '../', sub: 'compatibility/' }, { name: a + b2 }], content,
      ogImage: fs.existsSync(path.join(ASSETS, 'og', 'pairs', `${L.lang}-${pairSlug(k)}.png`)) ? `${siteUrl}/og/pairs/${L.lang}-${pairSlug(k)}.png` : null });
  }
  // /teams/ — DISC для команды и HR
  const tm = C.teams;
  writeContentPage(L, 'teams/', { navKey: 'nav.teams', article: true, title: tm.title, description: tm.description, crumbs: [{ name: t('nav.teams') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(tm.h1)}</h1><p class="lead">${escFull(tm.lead)}</p>` + ctaTop(t, '../') + sectionsHtml(tm.sections) +
      (hasBusiness(L) ? `<p class="seealso"><a href="../business/">${escFull(C.business.h1)}: ${escFull(C.business.packsTitle.toLowerCase())} ${arrow(L)}</a></p>` : '') +
      ctaBlock(L, t, '../') + seeAlso('../', 'nav.teams') });
  // /cv/ — лендинг сервиса «Резюме под каждую вакансию» (с 2026-10-22, решение заказчика; первая редакция того же дня продавала ручную услугу в Telegram):
  // заявка на ранний доступ, первым 1000 — скидка 50%, оплаты на странице нет. Две одинаковые формы (первый экран и конец страницы, src/cv.js) →
  // форма обратной связи сервера, тема «Заявка на ранний доступ к сервису CV». Только там, где в локали есть content.cv (сейчас русская версия).
  // С 2026-10-24 (по просьбе заказчика) на лендинг ведут блоки-анонсы content.cvPromo: главная, экран результата, страницы профилей и «Услуги»
  // (раздел «Поиск работы»); в меню и подвале ссылки нет. С 2026-10-24 (решение заказчика) открыта для поисковиков и входит в sitemap
  if (C.cv && feedbackEmail) {
    const V = C.cv, F = V.form, A = V.author, D = V.demo, K = ['--d', '--i', '--s', '--c'];
    const fill = str => escFull(str).replace(/\{email\}/g, `<a href="mailto:${escFull(feedbackEmail)}">${escFull(feedbackEmail)}</a>`);
    const VT = { name: t('intro.nameLabel'), email: F.email, button: F.button, subject: F.subject, message: F.message, sentTitle: F.sentTitle, sent: F.sent,
      nameRequired: t('intro.nameRequired'), emailRequired: t('intro.emailRequired'), pdRequired: L.ui['pd.required'] || '', sending: t('contact.sending'),
      sendFailed: t('contact.sendFailed'), tooMany: t('contact.tooMany') };
    // фото основателя — src/assets/img (копируются в docs/img); путь от страницы /<язык>/cv/ к корню сайта
    const imgRel = '../'.repeat((pathOf(L.lang) + 'cv/').split('/').length - 1);
    const form = k => cvFormHTML({ T: VT, esc: escFull, email: feedbackEmail, pdLabel: pdOn ? pdLabelHtml(L, '../') : '' }, k);
    const tick = `<svg class="cvtick" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const cta = (cls) => `<a class="btn ${cls || ''}" href="#cvfinal" data-cta>${escFull(V.button)}</a>`;
    const ldFaq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: V.faq.map(it => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a.replace(/\{email\}/g, feedbackEmail) } })) };
    const demo = `<figure class="cvdemo" aria-label="${escFull(D.label)}"><figcaption class="cvdemo-label">${escFull(D.label)}</figcaption>` +
      `<div class="cvdemo-head"><div><strong>${escFull(D.role)}</strong><span>${escFull(D.company)}</span></div>` +
      `<div class="cvscorebox"><div class="cvscore" style="--p:${(+D.score) * 10}%"><b>${escFull(D.score)}</b><span>${escFull(D.scoreOf)}</span></div>` +
        (D.scoreLabel ? `<small>${escFull(D.scoreLabel)}</small>` : '') + `</div></div>` + (D.scoreNote ? `<p class="cvscorenote">${escFull(D.scoreNote)}</p>` : '') +
      `<ul class="cvrows">${D.rows.map(r => `<li class="s-${r.s}"><span>${escFull(r.t)}</span><em>${escFull(r.v)}</em></li>`).join('')}</ul>` +
      `<div class="cvverdict${D.verdictTag ? ' go' : ''}"><b>${escFull(D.verdictTitle)}</b>${D.verdictTag ? `<span class="cvgo">${escFull(D.verdictTag)}</span>` : ''}<p>${escFull(D.verdict)}</p></div>` +
      // файлы примера: переключатель «Русский / English» и одна строка файлов на выбранном языке (без скрипта — обе строки с меткой RU / EN)
      `<div class="cvlangs cvdemo-files"><div class="cvlangsw" role="group" aria-label="${escFull(V.example && V.example.profile.cvFile ? V.example.profile.cvFile.langSwitch : '')}">` +
        D.fileGroups.map((g, i) => `<button type="button" data-l="${i}" aria-pressed="${i === 0}">${escFull(g.label)}</button>`).join('') + `</div>` +
      D.fileGroups.map((g, i) => `<div class="cvfiles${i === 0 ? ' on' : ''}" data-l="${i}"><span class="cvlang">${escFull(g.lang)}</span>${g.files.map(f => f.f ? `<a href="${imgRel}files/${f.f}" download data-dl="${f.dl}">${escFull(f.t)}</a>` : `<button type="button" disabled>${escFull(f.t)}</button>`).join('')}</div>`).join('') + `</div>` + (D.more && V.example ? `<a class="cvmore" href="#example">${escFull(D.more)} ↓</a>` : '') + `</figure>`;
    // «Пример: от единого резюме до отклика» (с 2026-10-22, по просьбе заказчика): четыре вкладки на вымышленном кандидате; без скрипта все панели видны подряд
    const X = V.example;
    // сравнение «вакансия — кандидатка» в оценке: в обеих таблицах вакансия — первый столбец (синим), кандидатка — второй (серым); на телефоне строка — карточка с подписями
    const cmpTable = (title, cols, rows, a, b, ka, kb) => `<h3>${escFull(title)}</h3><table class="cvcmp"><colgroup><col><col><col class="c-res"></colgroup><thead><tr>` +
      `<th class="k-${ka}"><span>${escFull(cols[0])}</span></th><th class="k-${kb}"><span>${escFull(cols[1])}</span></th><th>${escFull(cols[2])}</th></tr></thead><tbody>` +
      rows.map(r => `<tr class="s-${r.s}"><td class="k-${ka}" data-l="${escFull(cols[0])}">${escFull(r[a])}</td><td class="k-${kb}" data-l="${escFull(cols[1])}">${escFull(r[b])}</td>` +
        `<td class="cvres" data-l="${escFull(cols[2])}"><em>${escFull(r.v)}</em></td></tr>`).join('') + `</tbody></table>`;
    const exPanels = X ? [
      // единое резюме: всё, что собрано о кандидате, с пометкой «войдёт в CV под эту вакансию» / «останется в едином резюме»; счётчик считается из самих данных
      (() => {
        const P = X.profile, tag = it => `<li class="${it.in ? 'in' : 'out'}">${escFull(it.t)}</li>`;
        // файлы готового резюме: cvFile.file — начало имени файла (без ключа — пример Ирины Соколовой), пустая строка — файлов нет, кнопки неактивны
        const cvBase = P.cvFile && P.cvFile.file !== undefined ? P.cvFile.file : 'cv-example-irina-sokolova';
        const all = [].concat(...P.jobs.map(j => j.items), ...P.early.map(j => j.items), P.intern.items, ...P.sections.map(s => s.items));
        const nIn = all.filter(x => x.in).length + 1, nAll = all.length + 1;   // + перерыв в работе: в CV входит одна строка о нём
        const titles = j => j.titles ? `<div class="cvtitles"><p class="cvtitles-l">${escFull(P.titlesLabel)}</p><ul>` +
          j.titles.map(x => `<li class="${x.pick ? 'cvsel' : ''}"><b>${escFull(x.t)}</b> <i>— ${escFull(x.src)}${x.pick ? ` · ${escFull(P.pickLabel)}` : ''}</i></li>`).join('') + `</ul></div>` : '';
        const job = j => `<div class="cvjob"><p class="cvjob-period">${escFull(j.period)}</p><p class="cvjob-role"><b>${escFull(j.role)}</b> · ${escFull(j.company)}</p>` +
          titles(j) + `<ul class="cvmarks">${j.items.map(tag).join('')}</ul>` + (j.note ? `<p class="cvflag"><b>${escFull(P.flagLabel)}.</b> ${escFull(j.note)}</p>` : '') + `</div>`;
        const G = P.gap;
        const gap = `<div class="cvjob cvgap"><p class="cvjob-period">${escFull(G.period)}</p><p class="cvjob-role"><b>${escFull(G.title)}</b></p>` +
          `<p class="cvgap-l">${escFull(G.label)}:</p><ul class="cvvariants">${G.variants.map(v => `<li><b>${escFull(v.t)}</b> <i>${escFull(v.src)}</i></li>`).join('')}</ul>` +
          `<p class="cvflag">${escFull(G.resolved)}</p><p class="cvpick">${escFull(G.pick)}</p></div>`;
        const I2 = P.intern;
        const intern = `<div class="cvjob cvdim"><p class="cvjob-period">${escFull(I2.period)}</p><p class="cvjob-role"><b>${escFull(I2.role)}</b> · ${escFull(I2.company)}</p>` +
          `<ul class="cvmarks">${I2.items.map(tag).join('')}</ul><p class="cvwhy">${escFull(I2.why)}</p></div>`;
        return `<div class="cvdoc"><div class="cvdoc-head"><strong>${escFull(P.name)}</strong><span>${escFull(P.headline)}</span></div>` +
          `<p class="cvsrc">${escFull(P.sources)}</p>` +
          (P.cvFile ? `<div class="cvfile"><div class="cvfile-t"><strong>${escFull(P.cvFile.title)}</strong><p>${escFull(P.cvFile.text)}</p></div>` +
            `<div class="cvfile-b cvlangs"><div class="cvlangsw" role="group" aria-label="${escFull(P.cvFile.langSwitch)}">${P.cvFile.langs.map((l, i) => `<button type="button" data-l="${i}" aria-pressed="${i === 0}">${escFull(l.label)}</button>`).join('')}</div>` +
              `${P.cvFile.langs.map((l, i) => `<div class="cvfile-row${i === 0 ? ' on' : ''}" data-l="${i}"><span class="cvlang">${escFull(l.label)}</span>` +
              (cvBase ? `<a class="btn" href="${imgRel}files/${cvBase}${l.sfx}.pdf" download data-dl="pdf${l.sfx}">${escFull(P.cvFile.pdf)}</a>` +
              `<a class="btn btn-ghost" href="${imgRel}files/${cvBase}${l.sfx}.docx" download data-dl="docx${l.sfx}">${escFull(P.cvFile.docx)}</a></div>` :
              `<button type="button" class="btn" disabled>${escFull(P.cvFile.pdf)}</button><button type="button" class="btn btn-ghost" disabled>${escFull(P.cvFile.docx)}</button></div>`)).join('')}</div></div>` : '') +
          `<div class="cvlegend"><span class="in">${escFull(P.legendIn)}</span><span class="out">${escFull(P.legendOut)}</span></div>` +
          `<p class="cvcount">${escFull(P.count).replace('{in}', `<b>${nIn}</b>`).replace('{all}', `<b>${nAll}</b>`)}</p>` +
          `<h3>${escFull(P.expTitle)}</h3>` + P.jobs.map(job).join('') + gap + P.early.map(job).join('') + intern +
          P.sections.map(s => `<h3>${escFull(s.h)}</h3><ul class="cvmarks${s.items.length > 3 && s.items.every(x => !x.in) ? ' wrap' : ''}">${s.items.map(tag).join('')}</ul>${s.why ? `<p class="cvwhy">${escFull(s.why)}</p>` : ''}`).join('') +
          `<h3>${escFull(P.skillsTitle)}</h3><p class="cvchips">${P.skills.map(x => `<span>${escFull(x)}</span>`).join('')}</p></div>`;
      })(),
      // что ищет кандидат: профиль поиска — по нему считается вторая часть оценки («подходит ли вакансия кандидату»)
      (() => { const S = X.search;
        return `<div class="cvdoc"><div class="cvdoc-head"><strong>${escFull(S.title)}</strong><span>${escFull(S.subtitle)}</span></div>` +
          `<dl class="cvwant">${S.groups.map(g => `<div><dt>${escFull(g.h)}</dt><dd><ul>${g.items.map(x => `<li>${escFull(x)}</li>`).join('')}</ul></dd></div>`).join('')}</dl>` +
          `<h3>${escFull(S.stopTitle)}</h3><ul class="cvminus">${S.stop.map(x => `<li>${escFull(x)}</li>`).join('')}</ul>` +
          `<div class="cvshort"><h3>${escFull(S.otherTitle)}</h3><p>${escFull(S.other)}</p></div>` +
          `<p class="cvwhy cvwant-note">${escFull(S.note)}</p></div>`; })(),
      // вакансия
      `<div class="cvdoc"><div class="cvdoc-head"><strong>${escFull(X.vacancy.role)}</strong><span>${escFull(X.vacancy.company)}</span></div><p class="cvsrc">${escFull(X.vacancy.meta)}</p>` +
        X.vacancy.sections.map(sct => `<h3>${escFull(sct.h)}</h3><ul>${sct.items.map(x => `<li>${escFull(x)}</li>`).join('')}</ul>`).join('') + `</div>`,
      // оценка
      `<div class="cvdoc"><div class="cvdoc-head cvscorehead"><div><strong>${escFull(X.vacancy.role)}</strong><span>${escFull(X.vacancy.company)}</span></div>` +
        `<div class="cvscorebox"><div class="cvscore cvscore-lg" style="--p:${(+X.score.total) * 10}%"><b>${escFull(X.score.total)}</b><span>${escFull(X.score.of)}</span></div>` +
        (X.score.label ? `<small>${escFull(X.score.label)}</small>` : '') + `</div></div>` + (X.score.note ? `<p class="cvscorenote">${escFull(X.score.note)}</p>` : '') +
        `<p class="cvparts">${X.score.parts.map(x => `<span>${escFull(x.label)}: <b>${escFull(x.value)}</b></span>`).join('')}</p>` +
        cmpTable(X.score.reqTitle, X.score.reqCols, X.score.rows, 't', 'why', 'vac', 'cand') +
        cmpTable(X.score.critTitle, X.score.critCols, X.score.crit, 'offer', 'want', 'vac', 'cand') +
        `<div class="cvverdict${X.score.verdictTag ? ' go' : ''}"><b>${escFull(X.score.verdictTitle)}</b>${X.score.verdictTag ? `<span class="cvgo">${escFull(X.score.verdictTag)}</span>` : ''}<p>${escFull(X.score.verdict)}</p></div>` +
        `<div class="cvtopskip"><div><h3>${escFull(X.score.topTitle)}</h3><ul class="cvplus">${X.score.top.map(x => `<li>${escFull(x)}</li>`).join('')}</ul></div>` +
        `<div><h3>${escFull(X.score.skipTitle)}</h3><ul class="cvminus">${X.score.skip.map(x => `<li>${escFull(x)}</li>`).join('')}</ul></div></div></div>`,
      // сопроводительное письмо
      // кнопки «Скопировать текст» у полной и короткой версии (src/cv.js, initCvTabs): копируют текст блока .cvcopy-src без строки «Тема»
      (() => { const LT = X.letter, copyBtn = `<button type="button" class="cvcopy" data-copied="${escFull(LT.copied)}">${escFull(LT.copy)}</button>`;
        return `<div class="cvdoc cvletter"><p class="cvsrc">${escFull(LT.subject)}</p>` +
          `<div class="cvletter-full"><div class="cvcopy-head"><h3>${escFull(LT.fullTitle)}</h3>${copyBtn}</div>` +
          `<div class="cvcopy-src">${LT.body.map(x => `<p>${escFull(x)}</p>`).join('')}<p class="cvsign">${escFull(LT.sign)}</p></div></div>` +
          `<div class="cvshort"><div class="cvcopy-head"><h3>${escFull(LT.shortTitle)}</h3>${copyBtn}</div><div class="cvcopy-src"><p>${escFull(LT.short)}</p></div></div></div>`; })(),
      // дашборд: макет личного кабинета — вакансии с оценкой, советом и документами; элементы некликабельные, счётчики фильтров считаются из строк
      (() => { const DB = X.dashboard, cnt = r => DB.rows.filter(x => x.rec === r).length;
        const tone = n => n >= 7 ? 'hi' : n >= 5 ? 'mid' : 'lo';
        return `<div class="cvdash"><div class="cvdash-head"><strong>${escFull(DB.title)}</strong><span>${escFull(DB.lead)}</span></div>` +
          `<div class="cvdash-f" aria-hidden="true"><span class="on">${escFull(DB.all)} <b>${DB.rows.length}</b></span>` +
            ['go', 'maybe', 'no'].map(r => `<span class="r-${r}">${escFull(DB.recLabels[r])} <b>${cnt(r)}</b></span>`).join('') + `</div>` +
          `<table class="cvdash-t"><thead><tr>${DB.cols.map(c => `<th>${escFull(c)}</th>`).join('')}</tr></thead><tbody>` +
          DB.rows.map(r => `<tr class="r-${r.rec}"><td class="d-vac"><b>${escFull(r.role)}</b><span>${escFull(r.company)} · ${escFull(r.place)}</span></td>` +
            `<td class="d-score"><span class="cvdash-score t-${tone(r.score)}"><b>${r.score}</b> ${escFull(DB.of)}</span></td>` +
            `<td class="d-rec"><span class="cvdash-rec r-${r.rec}">${escFull(DB.recLabels[r.rec])}</span><small>${escFull(r.why)}</small></td>` +
            `<td class="d-docs">${r.rec === 'no' ? `<span class="cvdash-none">${escFull(DB.noDocs)}</span>` : DB.docs.map(d => `<span class="cvdash-doc" aria-disabled="true">${escFull(d)}</span>`).join('')}</td></tr>`).join('') +
          `</tbody></table><p class="cvwhy cvdash-note">${escFull(DB.note)}</p></div>`; })()
    ] : [];
    const exampleHtml = X ? `<section class="cvsec" id="example"><h2>${escFull(X.title)}</h2><p class="cvsub">${escFull(X.lead)}</p>` +
      `<div class="cvex" id="cvEx"><div class="cvtabs" role="tablist" aria-label="${escFull(X.title)}">` +
        X.tabs.map((tb, i) => `<button type="button" role="tab" id="cvt${i}" aria-controls="cvp${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span>${i + 1}</span>${escFull(tb)}</button>`).join('') + `</div>` +
        exPanels.map((h, i) => `<div class="cvpanel" role="tabpanel" id="cvp${i}" aria-labelledby="cvt${i}" tabindex="0"><h3 class="cvpanel-title">${escFull(X.tabs[i])}</h3>${h}</div>`).join('') +
        // свёрнутый пример (с 2026-10-24, по просьбе заказчика): вкладка видна не целиком, внизу «Показать полностью» — логика в src/cv.js
        (X.more ? `<div class="cvexmore"><button type="button" class="btn secondary" aria-expanded="false">${escFull(X.more)}</button></div>` : '') +
        // те же вкладки в конце блока (с 2026-10-23, по просьбе заказчика): долистав вкладку до конца, видно, что есть другие шаги
        `<div class="cvtabs cvtabs-end" role="group" aria-label="${escFull(X.title)}">` +
        X.tabs.map((tb, i) => `<button type="button" data-i="${i}" aria-controls="cvp${i}" aria-pressed="${i === 0}"><span>${i + 1}</span>${escFull(tb)}</button>`).join('') + `</div>` +
      `</div><p class="cvsub small">${escFull(X.note)}</p></section>` : '';
    // языковые версии лендинга друг на друга не ссылаются (с 2026-10-24, решение заказчика): langs — только сама локаль, без hreflang и og:locale:alternate;
    // cvIndex в site.config.json — языки, где страница открыта поисковикам и входит в sitemap (остальные — noindex, пока заказчик не одобрит)
    const filesOff = D.fileGroups.some(g => g.files.some(f => !f.f)) || !!(X && X.profile.cvFile && X.profile.cvFile.file === '') || !!(V.english && V.english.downloads.some(d => !d.f));
    writeContentPage(L, 'cv/', { bare: true, noDate: true, langs: [L], noindex: !!cfg.cvIndex && !cfg.cvIndex.includes(L.lang), css: [cvCss].concat(filesOff ? [cvOffCss] : [], L.lang !== 'ru' ? [cvPhotoCss] : [], CV_CJK.includes(L.lang) ? [cvCjkCss] : []).join('\n'), title: V.title, description: V.description,
      crumbs: [{ name: V.h1 }], ldExtra: [ldFaq], files: ['src/cv.js', 'src/cv.css'].concat(filesOff ? ['src/cv-off.css'] : [], L.lang !== 'ru' ? ['src/cv-photo.css'] : [], CV_CJK.includes(L.lang) ? ['src/cv-cjk.css'] : []),
      content: `<div class="cvpage">` +
        `<section class="cvhero"><div class="cvhero-text"><p class="cvbadge">${escFull(V.badge)}</p><h1>${escFull(V.h1)}</h1><p class="lead">${escFull(V.lead)}</p>` +
          `<ul class="cvpoints">${V.heroPoints.map(x => `<li>${tick}${escFull(x)}</li>`).join('')}</ul></div>` +
          `<div class="cvformcard" id="request"><h2>${escFull(V.formTitle)}</h2><p class="cvformlead">${escFull(V.formLead)}</p>${form('1')}<p class="cvnote">${escFull(V.formNote)}</p></div></section>` +
        // порядок блоков (с 2026-10-24, по просьбе заказчика): проблема → как работает → что получите → пример → «ничего не выдумываем» → английский →
        // кто создаёт → тарифы → вопросы → заявка; блоки с cvband — на своём фоне во всю ширину (через один), чтобы страница делилась на «главы»
        `<section class="cvsec cvband"><h2>${escFull(V.painTitle)}</h2><ul class="cvpain">${V.pain.map((x, i) => `<li style="--k:var(${K[i % 4]})"><h3>${escFull(x.h)}</h3><p>${escFull(x.p)}</p></li>`).join('')}</ul></section>` +
        `<section class="cvsec cvhow"><div><h2>${escFull(V.howTitle)}</h2><ol class="cvsteps">${V.how.map(x => `<li><strong>${escFull(x.h)}</strong><span>${escFull(x.p)}</span></li>`).join('')}</ol>${cta()}</div>${demo}</section>` +
        `<section class="cvsec cvband"><h2>${escFull(V.featuresTitle)}</h2><ul class="cvgrid">${V.features.map((x, i) => `<li style="--k:var(${K[i % 4]})"><h3>${escFull(x.h)}</h3><p>${escFull(x.p)}</p></li>`).join('')}</ul></section>` +
        exampleHtml +
        `<section class="cvsec cvband"><h2>${escFull(V.honestTitle)}</h2><div class="cvhonest"><p>${escFull(V.honest)}</p>${listHtml('ul', V.honestList)}</div></section>` +
        // «CV на английском — без переводчика» (с 2026-10-23, по просьбе заказчика): почему простого перевода мало, пример строк RU → EN, скачивание английских примеров
        (V.english ? (E => `<section class="cvsec cven" id="english"><h2>${escFull(E.title)}</h2><p class="cvsub">${escFull(E.lead)}</p>` +
          `<ul class="cvgrid cven-points">${E.points.map((x, i) => `<li style="--k:var(${K[(i + 3) % 4]})"><h3>${escFull(x.h)}</h3><p>${escFull(x.p)}</p></li>`).join('')}</ul>` +
          `<div class="cven-cmp"><h3>${escFull(E.compareTitle)}</h3><div class="cven-rows"><div class="cven-hd"><span>${escFull(E.ruLabel)}</span><span></span><span>${escFull(E.enLabel)}</span></div>` +
            E.compare.map(r => `<div class="cven-row"><span class="ru">${escFull(r.ru)}</span><span class="arr" aria-hidden="true">→</span><span class="en" lang="${escFull(r.lang || 'en')}">${escFull(r.en)}</span></div>`).join('') + `</div></div>` +
          `<div class="cven-dl"><span>${escFull(E.downloadsTitle)}:</span>${E.downloads.map(d => d.f ? `<a class="btn btn-ghost" href="${imgRel}files/${d.f}" download data-dl="${d.dl}">${escFull(d.t)}</a>` : `<button type="button" class="btn btn-ghost" disabled>${escFull(d.t)}</button>`).join('')}</div></section>`)(V.english) : '') +
        `<section class="cvsec cvband"><h2>${escFull(V.founderTitle)}</h2><div class="cvauthor">` +
          `<div class="cvauthor-side">` + (A.photoAlt ? `<img class="cvphoto" src="${imgRel}img/armen-manukyan.webp" srcset="${imgRel}img/armen-manukyan.webp 1x, ${imgRel}img/armen-manukyan-2x.webp 2x" width="280" height="350" alt="${escFull(A.photoAlt)}" loading="lazy" decoding="async">` : '') +
          `<blockquote class="cvquote"><p>${escFull(A.text)}</p></blockquote></div>` +
          `<div class="cvauthor-body"><span class="cvname">${escFull(A.name)}</span><p class="cvrole">${escFull(A.role)}</p>` + listHtml('ul', A.facts) + `</div>` +
          // ссылка на личный сайт — только если в локали есть author.site (в английской версии её нет: автор без привязки к стране, с 2026-10-24)
          (A.site ? `<p class="cvsite"><span>${escFull(A.siteLabel)}</span><a href="${escFull(A.siteUrl)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>${escFull(A.site)} <span aria-hidden="true">${arrow(L)}</span></a></p>` : '') + `</div></section>` +
        `<section class="cvsec" id="pricing"><h2>${escFull(V.pricingTitle)}</h2><p class="cvsub">${escFull(V.pricingLead)}</p><ul class="cvplans">` +
          V.plans.map((p, i) => `<li class="${i === 1 ? 'hot' : ''}"><div class="cvplan-head"><h3>${escFull(p.name)}</h3>${p.tag ? `<span class="cvtag">${escFull(p.tag)}</span>` : ''}</div>` +
            `<p class="cvprice">${p.old ? `<s>${escFull(p.old)}</s>` : ''}<b>${escFull(p.price)}</b><span>${escFull(p.per)}</span></p>` +
            `<ul>${p.items.map(x => `<li>${tick}${escFull(x)}</li>`).join('')}</ul></li>`).join('') +
          `</ul><p class="cvsub small">${escFull(V.pricingNote)}</p>${cta('cvcenter')}</section>` +
        `<section class="cvsec cvband cvfaq"><h2>${escFull(V.faqTitle)}</h2>` + V.faq.map(it => `<details><summary>${escFull(it.q)}</summary><p>${fill(it.a)}</p></details>`).join('') + `</section>` +
        `<section class="cvfinal" id="cvfinal"><h2>${escFull(V.finalTitle)}</h2><p>${escFull(V.finalLead)}</p>${form('2')}</section>` +
        `</div><div class="xbar no-print" id="cvFloat"><a class="btn" href="#cvfinal" data-cta>${escFull(V.floatButton)}</a><button class="xbar-x" type="button" id="cvFloatX" aria-label="${escFull(V.floatClose)}" title="${escFull(V.floatClose)}">×</button></div>`,
      pageJs: (L.lang === 'ru' ? cvJs : cvJsBare) + `initCvForm({T: ${JSON.stringify(VT).replace(/</g, '\\u003c')}, L: L, esc: esc, $: $, endpoint: ${jsStr(cfg.sendEndpoint)}, token: ${jsStr(cfg.sendToken)}, email: ${jsStr(feedbackEmail)}, pdVersion: ${jsStr(pdOn ? pdVersion : '')}});` });
  }
  // /disc-vs-mbti/ — сравнение моделей: таблица после второй секции
  const mb = C.mbti;
  writeContentPage(L, 'disc-vs-mbti/', { navKey: 'nav.mbti', article: true, title: mb.title, description: mb.description, crumbs: [{ name: t('nav.mbti') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(mb.h1)}</h1><p class="lead">${escFull(mb.lead)}</p>` + ctaTop(t, '../') + sectionsHtml(mb.sections.slice(0, 2)) + tableHtml(mb.table) + sectionsHtml(mb.sections.slice(2)) +
      `<p class="seealso"><a href="../disc/#sources">${esc(t('pages.sourcesLink'))} ${arrow(L)}</a></p>` + ctaBlock(L, t, '../') + seeAlso('../', 'nav.mbti') });
  // /pdf/ — печатная версия: кнопка скачивания файла из src/assets/pdf (готовится node scripts/make-pdf.js)
  const pd = C.pdf, pi = pdfInfo(L.lang), pdfRoot = relRoot(L, 'pdf/');
  const download = pi ? `<p class="download"><a class="btn" href="${pdfRoot}pdf/${pi.file}" download>${t('pages.pdf.download')}</a><span class="muted">${escFull(t('pages.pdf.meta', { pages: pi.pages, size: fmtSize(pi.size) }))}</span></p>` : `<p class="notice">${escFull(t('pages.pdf.missing'))}</p>`;
  if (!pi) console.warn('WARNING: no PDF for ' + L.lang + ' (run node scripts/make-pdf.js)');
  writeContentPage(L, 'pdf/', { navKey: 'nav.pdf', title: pd.title, description: pd.description, crumbs: [{ name: t('nav.pdf') }],
    content: `<div class="eyebrow">DISC</div><h1>${escFull(pd.h1)}</h1><p class="lead">${escFull(pd.lead)}</p>` + download + ctaTop(t, '../', 'cta.inlinePdf') + sectionsHtml(pd.sections) + download + ctaBlock(L, t, '../') + seeAlso('../', 'nav.pdf'),
    ldExtra: pi ? [{ '@context': 'https://schema.org', '@type': 'DigitalDocument', name: pd.title, url: `${siteUrl}/pdf/${pi.file}`, encodingFormat: 'application/pdf', inLanguage: hl(L.lang), isAccessibleForFree: true }] : [] });
  if (pi) extraUrls.push({ lang: L.lang, loc: `${siteUrl}/pdf/${pi.file}`, date: contentDate(L.lang + ':pdf-file', fs.readFileSync(path.join(ASSETS, 'pdf', pi.file)).toString('base64'), [`src/assets/pdf/${pi.file}`]) });
  // /services/ — платная услуга (все языки); /offer/ и /refund/ — публичная оферта и условия возврата, только в языках, где эти разделы есть (hasOffer).
  // В текстах подставляются {price}, {inn}, {seller} (исполнитель с ИНН), {email}, {site} и ссылки {contact}, {privacy}, {offer}, {refund}
  if (hasServices(L)) {
    const sv = C.services, of = C.offer, rf = C.refund, docs = hasOffer(L), own = locales.filter(hasOffer), price = servicePrice(L), fill = str => String(str).replace(/\{price\}/g, price);
    if (!offerTermsPrice(L) && /\{offerPrice\}/.test(JSON.stringify([sv, of || '', rf || '']))) throw new Error(`${L.lang}: в услуге или оферте есть {offerPrice}, а специальная цена не задана`);
    const link = (sub2, text) => `<a href="../${sub2}">${escFull(text)}</a>`;
    const vars = Object.assign({ price, offerPrice: offerTermsPrice(L), site: escFull(siteUrl),
      email: feedbackEmail ? `<a href="mailto:${escFull(feedbackEmail)}">${escFull(feedbackEmail)}</a>` : '—',
      contact: feedbackEmail ? link('contact/', t('nav.contact')) : escFull(t('nav.contact')), privacy: link('privacy/', t('nav.privacy')) },
      docs ? { inn: legalInn, seller: escFull(of.seller.replace('{inn}', legalInn)), offer: link('offer/', of.linkText), refund: link('refund/', rf.linkText) } : {});
    const fillHtml = html => html.replace(/\{(\w+)\}/g, (m, k) => k in vars ? vars[k] : m);
    const svcCrumb = { name: t('nav.services'), href: '../services/', sub: 'services/' }, docLink = (sub2, d) => `<a href="../${sub2}">${escFull(d.h1)} ${arrow(L)}</a>`;
    // раздел «Поиск работы» (cvPart ниже)
    const CP = hasCvPromo(L) ? C.cvPromo.services : null, cvPlans = CP ? C.cv.plans : [], cvFrom = CP ? CP.price.replace('{price}', cvPlans[0].price) : '';
    writeContentPage(L, 'services/', { navKey: 'nav.services', langs: locales.filter(hasServices), title: fill(sv.title), description: fill(sv.description), crumbs: [{ name: t('nav.services') }],
      content: hasBusiness(L) ? servicesSplit() : fillHtml(`<div class="eyebrow">DISC</div><h1>${escFull(sv.h1)}</h1><p class="lead">${escFull(sv.lead)}</p>` + personCard() +
        sectionsHtml(sv.sections.slice(0, 1)) + (docs && sv.docs ? `<p>${escFull(sv.docs)}</p>` : '') + sectionsHtml(sv.sections.slice(1)) + cvPart()) +
        (docs ? `<p class="seealso">${docLink('offer/', of)} · ${docLink('refund/', rf)}</p>` : '') });
    // карточка расширенного отчёта для физических лиц: название, описание, ссылка на страницу отчёта, цена
    function personCard() {
      return `<section class="service"><div><h2>${escFull(sv.name)}</h2><p>${escFull(sv.text)}</p>` + (hasProduct(L) ? `<p><a class="more" href="../extended-report/">${escFull(C.product.more)} ${arrow(L)}</a></p>` : '') +
        `</div><p class="price"><small>${escFull(sv.priceLabel)}</small>${escFull(sv.price)}</p></section>`;
    }
    // сервис «Резюме под каждую вакансию» (с 2026-10-24, по просьбе заказчика; где есть content.cvPromo): раздел «Поиск работы» с карточкой —
    // название, анонс, тарифы и цены (из content.cv.plans лендинга, чтобы не расходились), кнопка на лендинг (цель Метрики cv-promo-services)
    function cvPart() {
      if (!CP) return '';
      // бесплатный тариф («0 ₽», «$0») показывается словом из per («бесплатно», «free»), а не ценой
      const plansLine = cvPlans.map(p => `<span>${escFull(`${p.name} — ${/^\D*0(?![\d.,])/.test(p.price) ? p.per : p.price + ' ' + p.per}`)}</span>`).join(' · ');
      return `<h2 class="svcpart" id="cv">${escFull(CP.part)}</h2>` +
        `<section class="service"><div><h2>${escFull(CP.name)}</h2><p>${escFull(CP.text)}</p><p class="svcplans">${plansLine}</p></div>` +
        `<p class="price"><small>${escFull(sv.priceLabel)}</small>${escFull(cvFrom)}</p>` +
        `<a class="btn" href="../cv/" data-goal="cv-promo-services">${escFull(CP.button)}</a></section>`;
    }
    // «Услуги» там, где есть страница «Для организаций» (с 2026-10-22, по просьбе заказчика; сейчас русская версия): сверху выбор из двух карточек
    // («Для физических лиц» → #person, «Для организаций» → #org), затем два раздела со своими карточками и ценами; подразделы о физических лицах —
    // заголовками третьего уровня; последний раздел услуги («Вопросы об услуге») — общий, в конце страницы. Тексты — content.business.services
    function servicesSplit() {
      const S = C.business.services, retail = servicePrices.RUB, minPrice = Math.min(...businessPacks.map(p => p.priceRub));
      const maxDiscount = Math.max(...businessPacks.map(p => Math.floor((1 - p.priceRub / retail) * 100)));
      const fillS = str => String(str).replace(/\{minPrice\}/g, fmtPrice(L, minPrice)).replace(/\{maxDiscount\}/g, maxDiscount);
      const h3 = secs => sectionsHtml(secs).replace(/<h2>/g, '<h3 class="svch3">').replace(/<\/h2>/g, '</h3>');
      const pick = (id, title, text, price) => `<a class="svcpick" href="#${id}"><strong>${escFull(title)}</strong><span>${escFull(text)}</span><b>${escFull(price)}</b></a>`;
      return fillHtml(`<div class="eyebrow">DISC</div><h1>${escFull(sv.h1)}</h1><p class="lead">${escFull(sv.lead)}</p>` +
        `<nav class="svcpicks${CP ? ' three' : ''}" aria-label="${escFull(sv.h1)}">` + pick('person', S.person, S.personPick, sv.price) +
          (CP ? pick('cv', CP.part, CP.pick, cvFrom) : '') + pick('org', S.org, S.orgPick, fillS(S.orgPrice)) + `</nav>` +
        `<h2 class="svcpart" id="person">${escFull(S.person)}</h2>` + personCard() +
        h3(sv.sections.slice(0, 1)) + (docs && sv.docs ? `<p>${escFull(sv.docs)}</p>` : '') + h3(sv.sections.slice(1, -1)) + cvPart() +
        `<h2 class="svcpart" id="org">${escFull(S.org)}</h2>` +
        `<section class="service"><div><h2>${escFull(S.orgName)}</h2><p>${escFull(fillS(S.orgText))}</p></div>` +
        `<p class="price"><small>${escFull(S.orgPriceLabel)}</small>${escFull(fillS(S.orgPrice))}</p>` +
        `<a class="btn" href="../business/">${escFull(S.orgButton)}</a></section>` +
        sectionsHtml(sv.sections.slice(-1))) +
        (docs ? `<p class="seealso">${docLink('business/', C.business)} · ${docLink('offer/', of)} · ${docLink('refund/', rf)}</p>` : '');
    }
    // /business/ — «Для организаций»: пакеты кодов доступа к расширенному отчёту (цены — businessPacks), как это работает, данные участников,
    // границы применения, оплата по счёту, вопросы и форма заявки (src/business.js → форма обратной связи сервера, тема «Заявка для организации: …»)
    if (hasBusiness(L)) {
      const B = C.business, retail = servicePrices.RUB, pct = p => Math.floor((1 - p.priceRub / retail) * 100);   // вниз: скидку не преувеличиваем
      const bv = Object.assign({}, vars, { minPack: String(businessPacks[0].from), maxDiscount: String(Math.max(...businessPacks.map(pct))), retail: fmtPrice(L, retail), months: String(businessMonths),
        report: link('extended-report/', C.product.h1), teams: link('teams/', t('nav.teams')) });
      const fillB = html => html.replace(/\{(\w+)\}/g, (m, k) => k in bv ? bv[k] : m), plainB = str => String(str).replace(/\{(minPack|maxDiscount|retail|months)\}/g, (m, k) => bv[k]);
      const packs = `<div class="tablewrap"><table class="cmp packs"><thead><tr>${B.packsHead.map(h => `<th scope="col">${escFull(h)}</th>`).join('')}</tr></thead><tbody>` +
        businessPacks.map(p => `<tr><td>${escFull(B.packRow.replace("{n}", p.from))}</td><td>${escFull(B.packPrice.replace('{price}', fmtPrice(L, p.priceRub)))}</td><td>${escFull(B.packDiscount.replace('{pct}', pct(p)))}</td></tr>`).join('') + `</tbody></table></div>`;
      const F = B.form, BT = { name: t('intro.nameLabel'), email: t('contact.emailLabel'), size: F.size, sizes: F.sizes, interest: F.interest, interests: F.interests,
        comment: F.comment, commentPlaceholder: F.commentPlaceholder, button: F.button, subject: F.subject, sent: F.sent, needInterest: F.needInterest,
        requiredNote: t('intro.requiredNote'), nameRequired: t('intro.nameRequired'), emailRequired: t('intro.emailRequired'), pdRequired: L.ui['pd.required'] || '',
        sending: t('contact.sending'), sendFailed: t('contact.sendFailed'), tooMany: t('contact.tooMany'), privacyNote: F.privacy };
      writeContentPage(L, 'business/', { navKey: 'nav.services', langs: locales.filter(hasBusiness), title: plainB(B.title), description: plainB(B.description), crumbs: [svcCrumb, { name: t('nav.business') }],
        content: fillB(`<div class="eyebrow">${escFull(t('nav.services'))}</div><h1>${escFull(B.h1)}</h1><p class="lead">${escFull(B.lead)}</p>` +
          `<ul class="xfacts">${B.facts.map(x => `<li>${escFull(x)}</li>`).join('')}</ul>` +
          `<p><a class="btn" href="#request">${escFull(F.button)}</a></p>` +
          `<h2>${escFull(B.forTitle)}</h2>` + listHtml('ul', B.for) +
          `<h2>${escFull(B.packsTitle)}</h2><p>${escFull(B.packsText)}</p>` + packs + `<p class="small muted">${escFull(B.packsNote)}</p>` +
          `<h2>${escFull(B.howTitle)}</h2>` + listHtml('ol', B.how) +
          `<h2>${escFull(B.privacyTitle)}</h2>` + B.privacy.map(x => `<p>${escFull(x)}</p>`).join('') +
          `<h2>${escFull(B.boundsTitle)}</h2><p>${escFull(B.bounds)}</p>` +
          `<h2>${escFull(B.teamTitle)}</h2><p>${escFull(B.team)}</p>` +
          `<h2>${escFull(B.payTitle)}</h2>` + B.pay.map(x => `<p>${escFull(x)}</p>`).join('') +
          `<h2>${escFull(B.faqTitle)}</h2>` + B.faq.map(it => `<h3 class="xq">${escFull(it.q)}</h3><p>${escFull(it.a)}</p>`).join('') +
          `<h2 id="request">${escFull(F.title)}</h2><p>${escFull(F.lead)}</p>`) +
          businessHTML({ T: BT, esc: escFull, email: feedbackEmail, pdLabel: pdOn ? pdLabelHtml(L, '../') : '' }) +
          `<p class="seealso">${docLink('extended-report/', C.product)} · ${docLink('services/', sv)} · ${docLink('offer/', of)}</p>`,
        files: ['src/business.js'],
        pageJs: businessJs + `initBusiness({T: ${JSON.stringify(BT).replace(/</g, '\\u003c')}, L: L, esc: esc, $: $, endpoint: ${jsStr(cfg.sendEndpoint)}, token: ${jsStr(cfg.sendToken)}, email: ${jsStr(feedbackEmail)}, pdVersion: ${jsStr(pdOn ? pdVersion : '')}});` });
    }
    // /extended-report/ — страница расширенного отчёта: что внутри, листы образца картинками, сравнение с кратким отчётом, цена.
    // Блок покупки по умолчанию ведёт на тест. У кого результат сохранён на этом устройстве (disc.last), тому скрипт страницы меняет его:
    // при заданном payEndpoint — на форму с полем e-mail и кнопкой «Купить» (src/pay.js), без него — на заявку через форму обратной связи
    // с готовым текстом и ссылкой на результат (передаются через sessionStorage, см. src/contact.js)
    if (hasProduct(L)) {
      const pr = withPrice(L, C.product), root = '../' + (pathOf(L.lang) ? '../' : ''), rich = str => escFull(str).replace(/&lt;(\/?)b&gt;/g, '<$1b>');
      const pay = payEndpoint && C.product.pay ? pr.pay : null;
      const buyBox = id => `<section class="service xbuy"${pay && id ? ` id="${id}"` : ''}><div><h2>${escFull(pr.buy.testTitle)}</h2><p>${escFull(pr.buy.testText)}</p></div><p class="price"><small>${escFull(pr.priceLabel)}</small>${escFull(pr.price)}</p>` +
        `<a class="btn" href="../" data-goal="ext-page-test">${escFull(pr.buy.testButton)}</a>` + (pay && pay.guarantee ? `<p class="xguar">${escFull(pay.guarantee)}</p>` : '') + `</section>`;
      const samples = hasSamples(L);
      const sample = !samples ? '' : pr.sampleAlt.map((alt, i) => `<figure><a href="${root}extended/${L.lang}-i-${i + 1}.webp" target="_blank" rel="noopener" data-goal="ext-page-sample">` +
        `<img src="${root}extended/${L.lang}-i-${i + 1}-s.webp" width="440" height="623" alt="${escFull(alt)}" loading="lazy" decoding="async"></a><figcaption>${escFull(pr.sampleCaption[i])}</figcaption></figure>`).join('');
      const compare = `<div class="tablewrap"><table class="cmp"><thead><tr>${pr.compareHead.map(h => `<th scope="col">${escFull(h)}</th>`).join('')}</tr></thead><tbody>` +
        pr.compare.map(r => `<tr><th scope="row">${escFull(r[0])}</th><td>${escFull(r[1])}</td><td>${escFull(r[2])}</td></tr>`).join('') + `</tbody></table></div>`;
      writeContentPage(L, 'extended-report/', { navKey: 'nav.services', langs: locales.filter(hasProduct), title: pr.title, description: pr.description, crumbs: [svcCrumb, { name: pr.h1 }],
        content: fillHtml(`<div class="eyebrow">${escFull(t('nav.services'))}</div><h1>${escFull(pr.h1)}</h1><p class="lead">${escFull(pr.lead)}</p>` +
          `<ul class="xfacts">${pr.facts.map(x => `<li>${escFull(x)}</li>`).join('')}</ul>` + buyBox('buy') +
          (samples ? `<h2 id="sample">${escFull(pr.sampleTitle)}</h2><p>${escFull(pr.sampleNote)}</p><div class="xsample">${sample}</div>` : '') +
          `<h2>${escFull(pr.forTitle)}</h2>` + listHtml('ul', pr.for) +
          `<h2>${escFull(pr.insideTitle)}</h2><p>${escFull(pr.insideLead)}</p><ol>${pr.inside.map(x => `<li>${rich(x)}</li>`).join('')}</ol>` +
          `<h2>${escFull(pr.compareTitle)}</h2>` + compare + `<p class="small muted">${escFull(pr.compareNote)}</p>` +
          `<h2>${escFull(pr.howTitle)}</h2>` + listHtml('ol', pay ? pay.how : pr.how) + buyBox() +
          `<h2>${escFull(pr.faqTitle)}</h2>` + pr.faq.map(it => `<h3 class="xq">${escFull(it.q)}</h3><p>${escFull(it.a)}</p>`).join('') + `<p class="small muted">${escFull(pr.docs)}</p>`) +
          `<p class="seealso">${docLink('services/', sv)} · ${docLink('offer/', of)} · ${docLink('refund/', rf)}</p>`,
        files: samples ? pr.sampleAlt.map((_, i) => `src/assets/extended/${L.lang}-i-${i + 1}.webp`) : [],
        pageJs: resultFromUrlJs + (pay ? payJs + `\ninitPayBuy({T: ${JSON.stringify(Object.assign({ noteHtml: fillHtml(escFull(pay.note)), errorHtml: fillHtml(escFull(pay.error)) },
          Object.fromEntries(['title', 'text', 'emailLabel', 'emailPlaceholder', 'button', 'badEmail', 'wait', 'guarantee'].map(k => [k, pay[k]])), { offer: payOffer(L), code: payCodeT(L, fillHtml) })).replace(/</g, '\\u003c')}, endpoint: ${jsStr(payEndpoint)}, L: L, esc: esc, lsGet: lsGet, lsSet: lsSet});` : `(function(){
  var r = resultFromUrl() || lsGet('disc.last'); if(!r || !r.t || !r.m || !r.l || !r.m.join) return;
  var B = ${JSON.stringify(pr.buy).replace(/</g, '\\u003c')}, d = new Date(r.t), date = isNaN(d) ? '' : d.toLocaleDateString(L.dateLocale, {day:'numeric', month:'long', year:'numeric'});
  function b64e(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''); }
  var code = 'DISC1.' + b64e(JSON.stringify({n:r.name||'', e:r.email||'', p:r.pos||'', t:r.t, m:r.m.join(''), l:r.l.join('')})), link = new URL('../', location.href).href + '#r=' + code;
  document.querySelectorAll('.xbuy').forEach(function(box){
    box.querySelector('h2').textContent = B.orderTitle.replace('{date}', date);
    box.querySelector('div p').textContent = B.orderText;
    var a = box.querySelector('a.btn'); a.textContent = B.orderButton; a.href = '../contact/'; a.setAttribute('data-goal', 'ext-page-order');
    a.addEventListener('click', function(){ try{ sessionStorage.setItem('disc.order', JSON.stringify({topic:'extended', code:code, subject:(document.querySelector('h1')||{}).textContent||'', name:r.name||'', email:r.email||'', message:B.orderMsg.replace('{link}', link)})); }catch(e){} });
  });
})();`) });
      // «Спасибо» и «Оплата не прошла»: на них банк возвращает покупателя после оплаты и после отказа (?order=<номер заказа>).
      // Служебные страницы: закрыты от индексации, в sitemap не идут. Номер заказа, e-mail и статус подставляет скрипт (src/pay.js)
      if (pay) {
        const th = pay.thanks, fl = pay.fail, own2 = locales.filter(x => hasProduct(x) && x.content.product.pay);   // страницы есть только в языках с покупкой
        const crumbs2 = h1 => [{ name: t('nav.services'), href: '../../services/', sub: 'services/' }, { name: pr.h1, href: '../', sub: 'extended-report/' }, { name: h1 }];
        const fill2 = html => html.replace(/\{contact\}/g, () => `<a href="../../contact/">${escFull(t('nav.contact'))}</a>`).replace(/\{email\}/g, () => vars.email);
        const pick = (o, keys) => JSON.stringify(Object.fromEntries(keys.map(k => [k, o[k]]))).replace(/</g, '\\u003c');
        // знак над заголовком: зелёная галочка на «Спасибо», красный «кирпич» на «Оплата не прошла» — исход виден сразу, до чтения текста
        const payMark = kind => `<svg class="paymark ${kind}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="currentColor"/>` +
          (kind === 'ok' ? '<path d="M18 33.5l9.5 9.5L46 24" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' : '<rect x="13" y="26" width="38" height="12" rx="2" fill="#fff"/>') + '</svg>';
        writeContentPage(L, 'extended-report/thanks/', { noindex: true, noDate: true, navKey: 'nav.services', langs: own2, title: th.title, description: th.description, crumbs: crumbs2(th.h1),
          content: payMark('ok') + `<div class="eyebrow">${escFull(pr.h1)}</div><h1>${escFull(th.h1)}</h1><p class="lead" id="payLead">${escFull(th.lead)}</p>` +
            `<p class="notice payorder ym-hide-content" id="payOrder" hidden></p><p class="small sendstatus" id="payStatus" aria-live="polite" hidden></p>` +
            fill2(`<h2>${escFull(th.nextTitle)}</h2>` + listHtml('ul', th.next) + `<h2>${escFull(th.helpTitle)}</h2>` + th.help.map(x => `<p>${escFull(x)}</p>`).join('')) +
            `<p class="seealso"><a href="../../">${escFull(th.back)} ${arrow(L)}</a> · <a href="../../refund/">${escFull(rf.h1)} ${arrow(L)}</a></p>`,
          pageJs: payJs + `\ninitPayThanks({T: ${pick(th, ['leadEmail', 'order', 'statusWait', 'statusPaid', 'statusSent'])}, endpoint: ${jsStr(payEndpoint)}, price: ${servicePrices[sv.currency] || 0}, currency: ${jsStr(sv.currency)}, lsGet: lsGet, lsSet: lsSet, $: $});` });
        writeContentPage(L, 'extended-report/failed/', { noindex: true, noDate: true, navKey: 'nav.services', langs: own2, title: fl.title, description: fl.description, crumbs: crumbs2(fl.h1),
          content: payMark('fail') + `<div class="eyebrow">${escFull(pr.h1)}</div><h1>${escFull(fl.h1)}</h1><p class="lead">${escFull(fl.lead)}</p>` +
            `<p class="notice payorder ym-hide-content" id="payOrder" hidden></p>` +
            `<h2>${escFull(fl.tryTitle)}</h2>` + listHtml('ul', fl.try) + `<p class="payretry"><a class="btn" href="../#buy">${escFull(fl.button)}</a></p>` +
            fill2(`<p class="small muted">${escFull(fl.charged)}</p>`) +
            `<p class="seealso"><a href="../../refund/">${escFull(rf.h1)} ${arrow(L)}</a> · <a href="../../contact/">${escFull(t('nav.contact'))} ${arrow(L)}</a></p>`,
          pageJs: payJs + `\ninitPayFail({T: ${pick(fl, ['order'])}, lsGet: lsGet, lsSet: lsSet, $: $});` });
      }
    }
    if (docs) {
    // note — оговорка в переводах оферты и условий возврата: при расхождении действует русский текст; {original} — ссылка на него
    const docNote = (d, sub2) => d.note ? `<p class="notice">${escFull(d.note).replace(/\{original\}/g, () => `<a href="${'../' + (pathOf(L.lang) ? '../' : '')}ru/${sub2}" hreflang="ru" dir="ltr">${escFull(siteUrl.replace(/^https?:\/\//, ''))}/ru/${sub2}</a>`)}</p>` : '';
    writeContentPage(L, 'offer/', { navKey: 'nav.services', langs: own, title: of.title, description: of.description, crumbs: [svcCrumb, { name: of.h1 }],
      content: fillHtml(`<div class="eyebrow">${escFull(t('nav.services'))}</div><h1>${escFull(of.h1)}</h1><p class="muted">${escFull(of.edition)}</p>${docNote(of, 'offer/')}<p>${escFull(of.lead)}</p>` + sectionsHtml(offerSections(L))) +
        `<p class="seealso">${docLink('refund/', rf)} · ${docLink('services/', sv)}</p>` });
    writeContentPage(L, 'refund/', { navKey: 'nav.services', langs: own, title: rf.title, description: rf.description, crumbs: [svcCrumb, { name: rf.h1 }],
      content: fillHtml(`<div class="eyebrow">${escFull(t('nav.services'))}</div><h1>${escFull(rf.h1)}</h1><p class="lead">${escFull(rf.lead)}</p>${docNote(rf, 'refund/')}` + sectionsHtml(rf.sections)) +
        `<p class="seealso">${docLink('offer/', of)} · ${docLink('services/', sv)}</p>` });
    }
  }
  // /unsubscribe/ — отписка от рассылки: код из ссылки в письме (#u=…) страница сама отправляет серверу при открытии ({action: 'unsubscribe'})
  // и пишет «Вы отписались» с зелёной галочкой (с 2026-10-25, по просьбе заказчика: без лишнего нажатия; так же устроена /subscribe/).
  // Запрос шлёт скрипт страницы, а не сам переход по ссылке: сканеры ссылок в почте, которые только скачивают страницу, никого не отписывают.
  // Кнопка «Отписаться» — только для повтора после сбоя. Сервер отвечает ok и на повторную отписку: страницу можно открыть снова.
  if (cfg.sendEndpoint) {
    const un = C.unsubscribe, mailLink = feedbackEmail ? `<a href="mailto:${escFull(feedbackEmail)}">${escFull(feedbackEmail)}</a>` : '';
    writeContentPage(L, 'unsubscribe/', { noindex: true, noDate: true, title: un.title, description: un.description, crumbs: [{ name: un.h1 }],
      content: `<div class="eyebrow">DISC</div><h1>${escFull(un.h1)}</h1><p class="lead">${escFull(un.lead)}</p>` +
        `<div class="card contactcard"><p class="sendstatus" id="uStatus" aria-live="polite">${escFull(t('unsub.wait'))}</p><div class="actions"><button class="btn" type="button" id="uBtn" hidden>${escFull(t('unsub.button'))}</button></div></div>`,
      uiKeys: /^unsub\./,
      pageJs: `(function(){ var btn = $('#uBtn'), st = $('#uStatus'), m = /[#&]u=([A-Za-z0-9_-]{22})(?:&|$)/.exec(dataHash()), mail = ${jsStr(mailLink)};
  function status(kind, html){ st.hidden = false; st.className = 'sendstatus ' + kind; st.innerHTML = html; }
  if(!m){ status('err', t('unsub.bad', {email: mail})); return; }
  function unsubscribe(){
    btn.hidden = true; status('muted', esc(t('unsub.wait')));
    // Content-Type не задаём: «простой» запрос без preflight
    fetch(${jsStr(cfg.sendEndpoint)}, {method: 'POST', body: JSON.stringify({token: ${jsStr(cfg.sendToken)}, action: 'unsubscribe', u: m[1]}), redirect: 'follow'})
      .then(function(res){ return res.text(); })
      .then(function(txt){ var j = null; try{ j = JSON.parse(txt); }catch(e){}
        if(j && j.error === 'bad link'){ status('err', t('unsub.bad', {email: mail})); return; }
        if(!j || !j.ok) throw new Error('failed');
        status('ok', '<span style="display:flex;gap:12px;align-items:center"><svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" style="flex:none">' +
          '<circle cx="12" cy="12" r="12" fill="currentColor"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span>' + esc(t('unsub.done')) + '</span></span>'); if(window.discTrack) window.discTrack('unsubscribe'); })
      .catch(function(){ btn.hidden = false; status('err', t('unsub.failed', {email: mail})); });
  }
  btn.addEventListener('click', unsubscribe);
  unsubscribe();
})();` });
  }
  // /subscribe/ — подтверждение подписки с главной: ключ из ссылки в письме (#c=…) страница сама отправляет серверу при открытии ({action: 'confirmSubscribe'})
  // и пишет «Подписка подтверждена» (с 2026-10-22, по просьбе заказчика: без лишнего нажатия). Запрос шлёт скрипт страницы, а не сам переход по ссылке:
  // сканеры ссылок в почте, которые только скачивают страницу, подписку не подтверждают. Кнопка «Подтвердить подписку» — только для повтора после сбоя.
  if (homeSub) {
    const sc = C.subscribeConfirm, mailLink = feedbackEmail ? `<a href="mailto:${escFull(feedbackEmail)}">${escFull(feedbackEmail)}</a>` : '';
    writeContentPage(L, 'subscribe/', { noindex: true, noDate: true, title: sc.title, description: sc.description, crumbs: [{ name: sc.h1 }],
      content: `<div class="eyebrow">DISC</div><h1>${escFull(sc.h1)}</h1><p class="lead">${escFull(sc.lead)}</p>` +
        `<div class="card contactcard"><p class="sendstatus" id="cStatus" aria-live="polite">${escFull(t('subc.wait'))}</p><div class="actions"><button class="btn" type="button" id="cBtn" hidden>${escFull(t('subc.button'))}</button></div></div>`,
      uiKeys: /^subc\./,
      pageJs: `(function(){ var btn = $('#cBtn'), st = $('#cStatus'), m = /[#&]c=([A-Za-z0-9_-]{22})(?:&|$)/.exec(dataHash()), mail = ${jsStr(mailLink)};
  function status(kind, html){ st.hidden = false; st.className = 'sendstatus ' + kind; st.innerHTML = html; }
  if(!m){ status('err', t('subc.bad', {email: mail})); return; }
  function confirm(){
    btn.hidden = true; status('muted', esc(t('subc.wait')));
    fetch(${jsStr(cfg.sendEndpoint)}, {method: 'POST', body: JSON.stringify({token: ${jsStr(cfg.sendToken)}, action: 'confirmSubscribe', c: m[1]}), redirect: 'follow'})
      .then(function(res){ return res.text(); })
      .then(function(txt){ var j = null; try{ j = JSON.parse(txt); }catch(e){}
        if(j && j.error === 'bad link'){ status('err', t('subc.bad', {email: mail})); return; }
        if(!j || !j.ok) throw new Error('failed');
        // зелёная галочка в кружке перед надписью (по просьбе заказчика от 2026-10-22): с первого взгляда видно, что подписка прошла
        status('ok', '<span style="display:flex;gap:12px;align-items:center"><svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" style="flex:none">' +
          '<circle cx="12" cy="12" r="12" fill="currentColor"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span>' + esc(t('subc.done')) + '</span></span>'); if(window.discTrack) window.discTrack('subscribe'); })
      .catch(function(){ btn.hidden = false; status('err', t('subc.failed', {email: mail})); });
  }
  btn.addEventListener('click', confirm);
  confirm();
})();` });
  }
  // /contact/ — форма обратной связи (только при заданном feedbackEmail); разметка из src/contact.js, там же логика страницы
  if (feedbackEmail) {
    const ct = C.contact, maxLabel = '10 ' + (L.ui['contact.mb'] || 'MB');
    // обратная связь: служебная страница без своего текста — в индекс не нужна и в sitemap не идёт, ссылки с неё учитываются (аудит 3, п. 12)
    writeContentPage(L, 'contact/', { navKey: 'nav.contact', ldType: 'ContactPage', noindex: true, title: ct.title, description: ct.description, crumbs: [{ name: t('nav.contact') }],
      content: contactHTML({ t, esc: escFull, email: feedbackEmail, maxLabel, h1: ct.h1, lead: ct.lead, pdLabel: pdOn && cfg.sendEndpoint ? pdLabelHtml(L, '../') : '' }),
      uiKeys: /^(contact\.|intro\.(nameRequired|emailRequired)$|pd\.required$)/, files: ['src/contact.js'],
      pageJs: contactJs + `initContact({L:L, t:t, esc:esc, $:$, endpoint:${jsStr(cfg.sendEndpoint)}, token:${jsStr(cfg.sendToken)}, email:${jsStr(feedbackEmail)}, maxBytes:${MAX_CONTACT_BYTES}, pdVersion:${jsStr(pdOn && cfg.sendEndpoint ? pdVersion : '')}});` });
  }
}

// /en/ (язык по умолчанию) перенаправляет в корень: адрес существовал раньше и мог быть сохранён
fs.mkdirSync(path.join(OUT, def.lang), { recursive: true });
fs.writeFileSync(path.join(OUT, def.lang, 'index.html'), `<!doctype html><html lang="${def.lang}"><head><meta charset="utf-8"><title>${esc(def.brand)}</title><meta http-equiv="refresh" content="0; url=../"><link rel="canonical" href="${siteUrl}/"><script>location.replace('../'+location.hash)</script></head><body><a href="../">${esc(def.brand)}</a></body></html>\n`);

// Снятые языки (retiredLanguages в site.config.json: код → язык, куда вести). Хинди снят 2026-10-25 по решению заказчика
// (за месяц один посетитель): прежние адреса /hi/… и разосланные ссылки (#r=…, #u=…, #c=…) ведут на ту же страницу
// другого языка, хэш переносится. Сам язык в сборку не входит: ни страниц, ни sitemap, ни hreflang, ни пункта в меню.
for (const [code, to] of Object.entries(cfg.retiredLanguages || {})) {
  const T = locales.find(L => L.lang === to);
  if (!T || locales.some(L => L.lang === code)) continue;   // при сборке части языков (LANGS) целевого может не быть
  for (const sub of [''].concat(writtenSubs[to] || [])) {
    const rel = '../'.repeat(1 + sub.split('/').filter(Boolean).length) + pathOf(to) + sub, abs = urlOf(to) + sub;
    fs.mkdirSync(path.join(OUT, code, sub), { recursive: true });
    fs.writeFileSync(path.join(OUT, code, sub, 'index.html'), `<!doctype html><html lang="${hl(to)}"><head><meta charset="utf-8"><title>${esc(T.brand)}</title>` +
      `<meta http-equiv="refresh" content="0; url=${rel}"><link rel="canonical" href="${abs}">` +
      `<script>location.replace(${JSON.stringify(rel)}+location.hash)</script></head><body><a href="${rel}">${esc(T.brand)}</a></body></html>\n`);
  }
}

// 404: тексты на всех языках, язык выбирает скрипт страницы (по началу пути, прежнему выбору или языку браузера);
// без JavaScript — язык по умолчанию. Старые ссылки #r=… и #admin перенаправляются на главную (аудит 3, п. 6)
const NF_LINKS = [['nav.home', ''], ['nav.disc', 'disc/'], ['nav.profiles', 'profiles/'], ['nav.results', 'results/'], ['nav.faq', 'faq/']];
const nfData = Object.fromEntries(locales.map(L => [L.lang, { lang: hl(L.lang), dir: L.dir, path: pathOf(L.lang), title: L.ui['notFound.title'], text: L.ui['notFound.text'], cta: L.ui['cta.button'],
  links: NF_LINKS.map(([k, sub]) => [L.ui[k], sub]) }]));
fs.writeFileSync(path.join(OUT, '404.html'), nfTpl.replace(/__BASE__/g, basePath).replace('__NF_JSON__', () => JSON.stringify(nfData).replace(/</g, '\\u003c'))
  .replace(/__DEF_LANG_CODE__/g, def.lang).replace(/__DEF_LANG__/g, hl(def.lang))
  .replace(/__NF_TITLE__/g, () => esc(def.ui['notFound.title'])).replace('__NF_TEXT__', () => esc(def.ui['notFound.text'])).replace('__NF_CTA__', () => esc(def.ui['cta.button']))
  .replace('__NF_LINKS__', () => NF_LINKS.map(([k, sub]) => `<li><a href="${basePath + sub}">${esc(def.ui[k])}</a></li>`).join('')));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
// Clean-param (Яндекс): метка ?ref=<сеть> в ссылках «Поделиться типом» не меняет страницу — робот не обходит такие адреса
// как отдельные; Google директиву игнорирует, ему хватает canonical (аудит 3, п. 5)
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nClean-param: ref\nSitemap: ${siteUrl}/sitemap.xml\n`);
const altFor = (sub, own = locales) => own.length < 2 ? '' : own.flatMap(x => hls(x.lang).map(h => `<xhtml:link rel="alternate" hreflang="${h}" href="${urlOf(x.lang) + sub}"/>`)).join('') + (own.includes(def) ? `<xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/${sub}"/>` : '');
// Sitemap по языкам: sitemap.xml — индекс, sitemap-<язык>.xml — страницы и PDF одного языка.
// В Search Console по каждому файлу видно, сколько адресов языка проиндексировано.
const maxDate = ds => ds.reduce((a, b) => (b > a ? b : a), '');
const smIndex = [];
for (const L of locales) {
  const own = pages.filter(pg => pg.lang === L.lang), files = extraUrls.filter(u => u.lang === L.lang);
  const urls = own.map(pg => `  <url><loc>${urlOf(pg.lang) + pg.sub}</loc><lastmod>${pg.date}</lastmod>${altFor(pg.sub, pg.langs)}</url>`)
    .concat(files.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.date}</lastmod></url>`));
  fs.writeFileSync(path.join(OUT, `sitemap-${L.lang}.xml`), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
  smIndex.push(`  <sitemap><loc>${siteUrl}/sitemap-${L.lang}.xml</loc><lastmod>${maxDate(own.map(p => p.date).concat(files.map(u => u.date)))}</lastmod></sitemap>`);
}
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${smIndex.join('\n')}\n</sitemapindex>\n`);
// полная сборка переписывает список целиком (удалённые страницы уходят), сборка части языков (LANGS) сохраняет чужие записи
fs.writeFileSync(LASTMOD_FILE, JSON.stringify(Object.fromEntries(Object.entries(ONLY ? Object.assign({}, lmOld, lmNew) : lmNew).sort(([a], [b]) => a.localeCompare(b))), null, 0).replace(/\},"/g, '},\n"') + '\n');
if (cfg.customDomain) fs.writeFileSync(path.join(OUT, 'CNAME'), cfg.customDomain + '\n');
// IndexNow (Bing, Яндекс, Seznam, Naver): файл-ключ в корне сайта подтверждает, что уведомления шлёт владелец; отправка — scripts/indexnow.js
const indexNowKey = String(cfg.indexNowKey || '').replace(/[^A-Za-z0-9-]/g, '');
if (indexNowKey) fs.writeFileSync(path.join(OUT, indexNowKey + '.txt'), indexNowKey + '\n');

// Иконки, og-картинки, манифест (файлы готовятся заранее командой node scripts/make-assets.js)
for (const f of ['favicon.svg', 'favicon.ico', 'favicon-120.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  const src = path.join(ASSETS, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f)); else console.warn('WARNING: missing asset ' + f + ' (run node scripts/make-assets.js)');
}
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
for (const f of fs.existsSync(path.join(ASSETS, 'fonts')) ? fs.readdirSync(path.join(ASSETS, 'fonts')) : []) if (f.endsWith('.woff2')) fs.copyFileSync(path.join(ASSETS, 'fonts', f), path.join(OUT, 'fonts', f));
// листы образца расширенного отчёта (картинки; готовятся вручную из PDF образца, см. PROJECT.md от 2026-10-09)
if (fs.existsSync(path.join(ASSETS, 'extended'))) { fs.mkdirSync(path.join(OUT, 'extended'), { recursive: true });
  // <язык>-mail.jpg — листы образца для письма подписчикам (content.mailing.promo): JPEG, а не WebP — WebP показывают не все почтовые программы
  for (const f of fs.readdirSync(path.join(ASSETS, 'extended'))) if (f.endsWith('.webp') || /^[a-z-]+-mail\.jpg$/.test(f)) fs.copyFileSync(path.join(ASSETS, 'extended', f), path.join(OUT, 'extended', f)); }
// файлы для скачивания (пример CV в PDF и DOCX на лендинге /ru/cv/, с 2026-10-22)
if (fs.existsSync(path.join(ASSETS, 'files'))) { fs.mkdirSync(path.join(OUT, 'files'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ASSETS, 'files'))) if (/\.(pdf|docx)$/.test(f)) fs.copyFileSync(path.join(ASSETS, 'files', f), path.join(OUT, 'files', f)); }
// картинки страниц (фото основателя на лендинге /ru/cv/, с 2026-10-22)
if (fs.existsSync(path.join(ASSETS, 'img'))) { fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ASSETS, 'img'))) if (/\.(webp|png|jpe?g)$/.test(f)) fs.copyFileSync(path.join(ASSETS, 'img', f), path.join(OUT, 'img', f)); }
fs.mkdirSync(path.join(OUT, 'pdf'), { recursive: true });
for (const f of fs.existsSync(path.join(ASSETS, 'pdf')) ? fs.readdirSync(path.join(ASSETS, 'pdf')) : []) if (f.endsWith('.pdf')) fs.copyFileSync(path.join(ASSETS, 'pdf', f), path.join(OUT, 'pdf', f));
fs.mkdirSync(path.join(OUT, 'og'), { recursive: true });
for (const L of locales) {
  const src = path.join(ASSETS, 'og', L.lang + '.png');
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, 'og', L.lang + '.png')); else console.warn('WARNING: missing og image for ' + L.lang);
}
// og-картинки 10 пар совместимости: src/assets/og/pairs/<язык>-<пара>.png
const ogPairs = path.join(ASSETS, 'og', 'pairs');
if (fs.existsSync(ogPairs)) { fs.mkdirSync(path.join(OUT, 'og', 'pairs'), { recursive: true });
  for (const f of fs.readdirSync(ogPairs)) if (f.endsWith('.png') && locales.some(L => f.startsWith(L.lang + '-') && /^[a-z]-[a-z]\.png$/.test(f.slice(L.lang.length + 1)))) fs.copyFileSync(path.join(ogPairs, f), path.join(OUT, 'og', 'pairs', f)); }
// og-картинки 16 профилей на каждом языке (для «Поделиться типом»): src/assets/og/profiles/<язык>-<код>.png
const ogProfiles = path.join(ASSETS, 'og', 'profiles');
if (fs.existsSync(ogProfiles)) { fs.mkdirSync(path.join(OUT, 'og', 'profiles'), { recursive: true });
  for (const f of fs.readdirSync(ogProfiles)) if (f.endsWith('.png') && locales.some(L => f.startsWith(L.lang + '-') && /^[a-z]{1,2}\.png$/.test(f.slice(L.lang.length + 1)))) fs.copyFileSync(path.join(ogProfiles, f), path.join(OUT, 'og', 'profiles', f)); }
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({ name: 'DISC Test', short_name: 'DISC', start_url: basePath, display: 'standalone', background_color: '#F3F4F6', theme_color: '#1B2027',
  icons: [{ src: basePath + 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: basePath + 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2) + '\n');

// Google Apps Script для отправки писем: шаблон + данные из локалей (названия стилей, профили, тексты письма)
const BLOCK_KEYS = (tpl.match(/var BLOCK_KEYS = (\[[^\]]+\]);/) || [])[1];
if (!BLOCK_KEYS) throw new Error('BLOCK_KEYS not found in template');
const mailData = {};
for (const L of locales) {
  const email = {};
  for (const k of Object.keys(L.ui)) if (k.startsWith('email.')) email[k.slice(6)] = L.ui[k];
  // письму и PDF-отчёту нужны название профиля и краткое описание, описания четырёх стилей и подписи разделов отчёта;
  // роли, поведение в команде и советы по общению (страницы профилей) в скрипт не кладём
  const profiles = {};
  for (const k of Object.keys(L.profiles)) profiles[k] = { name: L.profiles[k].name, summary: L.profiles[k].summary };
  const report = {};
  for (const k of ['flat', 'statsTitle', 'statMeta', 'traits', 'secondary', 'secondaryAddon', 'strengths', 'growth', 'motivation', 'communication', 'stress', 'environment']) report[k] = L.ui['report.' + k];
  // consent — текст у галочки согласия на рассылку: скрипт записывает его в таблицу рядом с отметкой о согласии
  mailData[L.lang] = { name: L.name, dir: L.dir, brand: L.brand, keys: L.keys, addon: L.addon, styles: L.styles, profiles, email, report, rights: L.ui.rights, consent: L.ui['share.subscribe'],
    pd: { v: pdVersion, text: pdConsentText(L) },   // согласие на обработку данных: редакция и текст — свой сервер сохраняет их рядом с отметкой о согласии
    cta: { title: L.ui['cta.title'], text: L.ui['cta.text'], desc: L.ui['pages.profile.descCta'] },
    // подписка с главной: текст у галочки согласия (сервер сохраняет его с отметкой о согласии) и письмо со ссылкой подтверждения
    nl: { consent: L.ui['nl.consent'], mail: L.content.subscribeMail } };
  // письмо с расширенным отчётом (платная услуга): тексты есть только в языках, где отчёт написан
  if (L.content.extendedMail) mailData[L.lang].extended = L.content.extendedMail;
  // оплата расширенного отчёта на своём сервере: название услуги для платёжной страницы и чека, письмо-напоминание о неоконченной оплате, валюта заказа (USD или EUR через Prodamus)
  if (L.content.product && L.content.product.pay && L.content.product.pay.remind) mailData[L.lang].pay = { name: L.content.services.name, remind: L.content.product.pay.remind, dateLocale: L.dateLocale, currency: L.content.services.currency };
  // письмо подписчикам с призывом купить расширенный отчёт (с 2026-10-25; отправляет свой сервер, src/promo.js): только где отчёт продаётся и есть тексты письма.
  // Тезисы, подпись к листам, кнопка и «бесплатно» — из блока «Расширенный отчёт» (product.block), гарантия — из покупки; цена — обычная (servicePrice).
  // image — есть ли картинка листов образца для писем (src/assets/extended/<язык>-mail.jpg; сайт отдаёт её по адресу /extended/<язык>-mail.jpg)
  const MP = L.content.mailing && L.content.mailing.promo, PP = L.content.product;
  if (MP && PP && PP.pay && PP.block) mailData[L.lang].promo = Object.assign({}, MP, { list: PP.block.list, sample: PP.block.sample || '', button: PP.block.button, free: PP.block.free,
    guarantee: PP.pay.guarantee, price: MP.price.replace('{price}', servicePrice(L)), dateLocale: L.dateLocale,
    image: fs.existsSync(path.join(SRC, 'assets', 'extended', L.lang + '-mail.jpg')) });
}
// Блок о расширенном отчёте в PDF краткого отчёта и в теле письма с результатом: в языках, где есть страница отчёта и тексты `content.product.pdf`.
// Листы образца — только там, где есть и их картинки для PDF, и подписи (hasSamples): они вшиваются в данные ядра, при сборке PDF сеть закрыта.
// В остальных языках блок без листов: на их месте строка о заявке (content.product.block.soon). Включается ключом "reportAd": true в site.config.json;
// для образца без включения — переменной REPORT_AD=1 (site.config.json не меняется).
if (cfg.reportAd === true || process.env.REPORT_AD === '1') {
  for (const L of locales) {
    const P = L.content.product, dir = path.join(SRC, 'assets', 'extended');
    // -p.jpg — листы образца для PDF: JPEG шириной 367 px (sips -s format jpeg -s formatOptions 62 -Z 520 из <язык>-i-<n>.webp); в docs/ не копируются.
    // Именно JPEG: его Chrome кладёт в PDF как есть, а WebP разворачивает в несжатую картинку — файл выходил втрое тяжелее
    // какие листы образца показать в блоке — content.product.pdf.sheets (номера листов образца со страницы отчёта)
    if (!hasProduct(L) || !P.pdf || !P.block) continue;
    const sheets = hasSamples(L) ? (Array.isArray(P.pdf.sheets) ? P.pdf.sheets : [1, 2, 3, 4]) : [];
    const files = sheets.map(n => path.join(dir, L.lang + '-i-' + n + '-p.jpg'));
    const withSheets = sheets.length > 0 && files.every(f => fs.existsSync(f));
    // ни листов, ни строки о заявке — блок не строим; там, где отчёт продаётся (product.pay), он строится и без листов образца
    if (!withSheets && !P.block.soon && !P.pay) continue;
    mailData[L.lang].reportAd = Object.assign({ eyebrow: P.h1, title: P.block.title, lead: P.pdf.lead, facts: P.pdf.facts, hook: P.block.hook, list: P.pdf.list || P.block.list },
      withSheets ? { sample: P.block.sample, captions: sheets.map(n => P.sampleCaption[n - 1]) } : {},
      { price: P.block.price.replace('{price}', servicePrice(L)), button: P.block.button, free: P.block.free, where: P.pdf.where },
      withSheets ? { images: files.map(f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64')) } : P.block.soon ? { soon: P.block.soon } : {});
  }
}
const gsTpl = fs.readFileSync(path.join(SRC, 'apps-script.template.js'), 'utf8');
const gs = gsTpl
  .replace('__SITE_URL__', siteUrl).replace('__SEND_TOKEN__', String(cfg.sendToken || '').replace(/['\\]/g, ''))
  .replace('__SENDER_EMAIL__', senderEmail).replace('__CONTACT_TO__', feedbackEmail).replace('__PRICE_RUB__', String(servicePrices.RUB || 0)).replace('__PRICE_USD__', String(servicePrices.USD || 0)).replace('__OFFER_RUB__', String(offerPrices.RUB || 0)).replace('__OFFER_USD__', String(offerPrices.USD || 0)).replace('__PRICE_EUR__', String(servicePrices.EUR || 0)).replace('__OFFER_EUR__', String(offerPrices.EUR || 0)).replace('__OFFER_MIN__', String(offerMinutes)).replace('__MAX_CONTACT_BYTES__', String(MAX_CONTACT_BYTES))
  .replace('__BLOCK_KEYS__', BLOCK_KEYS).replace('__DATA__', () => JSON.stringify(mailData));
fs.mkdirSync(path.join(ROOT, 'backend', 'apps-script'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'backend', 'apps-script', 'Code.gs'), gs);
// Бот в Telegram (отдельный проект Apps Script, только русский): цена, реквизиты и адрес для вопросов — из тех же настроек, что и сайт.
// Собирается, когда есть всё, на что бот ссылается: русская версия с офертой, цена в рублях, ИНН и страница обратной связи.
const ruL = locales.find(L => L.lang === 'ru');
const hasBot = !!(ruL && hasOffer(ruL) && servicePrices.RUB && legalInn && feedbackEmail);
if (hasBot) {
  const bot = fs.readFileSync(path.join(SRC, 'telegram-bot.template.js'), 'utf8')
    .replace('__SITE_URL__', siteUrl).replace('__PRICE_RUB__', String(servicePrices.RUB)).replace('__OFFER_RUB__', String(offerPrices.RUB || 0)).replace('__CONTACT_EMAIL__', feedbackEmail)
    .replace('__SERVICE_NAME__', () => JSON.stringify(ruL.content.services.name))
    .replace('__LEGAL__', () => JSON.stringify(ruL.ui.legal.replace('{inn}', legalInn).split(' · ').join('\n')));
  fs.mkdirSync(path.join(ROOT, 'backend', 'telegram-bot'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'backend', 'telegram-bot', 'Code.gs'), bot);
}
console.log(`Built ${locales.length} languages, ${pages.length} pages (root = ${def.lang}) → docs/ (${locales.map(L => L.lang).join(', ')}); backend/apps-script/Code.gs${hasBot ? ', backend/telegram-bot/Code.gs' : ''}${cfg.sendEndpoint ? '' : ' (sendEndpoint не задан: письма не отправляются)'}${feedbackEmail ? '' : ' (feedbackEmail не задан: страницы /contact/ нет)'}`);
