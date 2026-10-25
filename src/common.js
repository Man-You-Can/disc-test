/* Общие элементы всех страниц сайта (тест и контентные страницы): выпадающий список языков,
   запоминание выбранного языка, подсказка «Продолжить на …», уведомление о cookie и загрузка Яндекс.Метрики после согласия.
   Вставляется сборкой в каждую страницу; вызывается как initCommon({L, t, esc, lsGet, lsSet, langHref, $}). */
/* Хэш адреса с личными данными: #r=… — код результата (в нём имя, e-mail и ответы участника), #u=… — ключ отписки от рассылки,
   #c=… — ключ подтверждения подписки на рассылку (с 2026-10-22).
   Счётчик веб-аналитики читает адрес страницы сам: в первом запросе (он уходит и при defer), в карте кликов, при переходе
   по внешней ссылке, в записи посещения. Поэтому такой хэш убирается из адресной строки раньше, чем счётчик загружен, и
   остаётся в записи истории браузера (history.state): обновление страницы и «Назад» открывают тот же экран, а новый переход
   по тому же адресу (ссылка на эту же страницу) — страницу без данных.
   Код страниц берёт хэш через dataHash() и pageHash(), а не из location.hash; в разметку страницы хэш с данными не пишется.
   Исключение (решение заказчика от 2026-10-22): экран результата после загрузки сам кладёт в адресную строку ссылку на отчёт без e-mail
   (showHash) — ту же, что копирует кнопка «Скопировать ссылку», чтобы адрес из строки браузера можно было переслать. Её счётчик видит;
   о ней говорят тексты о данных на 14 языках. При открытии страницы любой #r=… (в старых ссылках из писем — с e-mail) всё равно сначала
   убирается, до загрузки счётчика, и возвращается в строку уже без e-mail. */
function dataHash(){
  var re = /^#[ruc]=/, h = location.hash || '';
  try{
    var first = !dataHash.seen, s = history.state; dataHash.seen = 1;
    /* ссылка, которую страница сама показала в адресной строке (showHash), остаётся на месте; при открытии страницы (first) убирается и она */
    if(!first && h && s && s.discShown === h) return h;
    if(re.test(h)){ history.replaceState({discHash:h}, '', location.pathname + location.search); return h; }
    if(s && typeof s.discHash === 'string' && re.test(s.discHash)){
      if(first && navFresh()){ history.replaceState(null, '', location.href); return ''; }
      return s.discHash;
    }
  }catch(e){}
  return re.test(h) ? h : '';
}
/* Специальная цена, цены и срок из панели (с 2026-10-25, по просьбе заказчика; сервер — private/server/src/prices.js): GET <payEndpoint>/offer →
   {ok, offer, minutes, prices: {RUB: {regular, offer}, USD: {…}, EUR: {…}}}. Один запрос на страницу, без данных о посетителе, и только когда он нужен:
   на странице есть цена (метки сборки, discPriceApply) или у посетителя идёт его срок после теста (src/pay.js, закреплённая кнопка ниже).
   discOffer(url, fn): fn(on) — сразу, если ответ уже есть, иначе по ответу. discOffer.on: true / false; null или undefined — ответа ещё нет.
   discOffer.data — ответ сервера (цены и срок); discOfferWatch(fn) — fn() при каждом ответе и смене (discOfferSet(false), когда сервер оплаты
   ответил «offer off» — выключили, пока страница открыта); discOfferRefresh(url) — спросить заново (сервер оплаты не принял цену: её только что сменили).
   Пока ответа нет и при сбое запроса специальной цены нет, а цены на странице — те, что были при сборке. */
function discOffer(url, fn){
  var S = discOffer;
  if(S.on === true || S.on === false){ if(fn) fn(S.on); return; }
  S.fns = S.fns || []; if(fn) S.fns.push(fn);
  if(S.asked) return;
  S.asked = true;
  url = url || (window.DISC_PRICE && window.DISC_PRICE.url);
  if(!url || !window.fetch){ discOfferSet(false); return; }
  fetch(url, {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(j){ if(j && j.ok && j.prices) S.data = j; discOfferSet(!!(j && j.ok && j.offer === true), true); }, function(){ discOfferSet(false); });
}
function discOfferWatch(fn){ (discOffer.watchers = discOffer.watchers || []).push(fn); }
function discOfferSet(v, answer){
  var S = discOffer, a = (S.fns || []).concat(S.watchers || []); S.fns = []; S.asked = true;
  if(S.on === v && !answer) return; S.on = v;
  for(var i = 0; i < a.length; i++) a[i](v);
}
function discOfferRefresh(url, fn){ var S = discOffer; S.asked = false; S.on = null; discOffer(url, fn); }
/* числа и срок в записи языка страницы (window.DISC_PRICE.loc) — так же, как сборка (fmtPrice, fmtDuration в build.js) */
function discNum(v){ var P = window.DISC_PRICE || {}; try{ return new Intl.NumberFormat(P.loc, v % 1 ? {minimumFractionDigits:2, maximumFractionDigits:2} : {}).format(v); }catch(e){ return String(v); } }
function discDuration(min){ var P = window.DISC_PRICE || {}, h = min % 60 === 0; try{ return new Intl.NumberFormat(P.loc, {style:'unit', unit: h ? 'hour' : 'minute', unitDisplay:'long'}).format(h ? min / 60 : min); }catch(e){ return min + ' min'; } }
/* текущие значения в валюте страницы: {regular, offer, minutes}; null — ответа сервера ещё нет */
function discPriceNow(){
  var d = discOffer.data, P = window.DISC_PRICE, x = d && P && d.prices && d.prices[P.cur];
  return x && +x.regular > 0 ? {regular: +x.regular, offer: +x.offer || 0, minutes: +d.minutes || 0} : null;
}
/* строка с метками сборки (U+2063 — обычная цена, U+2062 — специальная, U+2061 — срок) → та же строка с текущими значениями; метки остаются */
function discPriceStr(s){
  var n = discPriceNow();
  if(!n || typeof s !== 'string' || !/[\u2061-\u2063]/.test(s)) return s;
  return s.replace(/\u2063[^\u2063]*\u2063/g, '\u2063' + discNum(n.regular) + '\u2063')
    .replace(/\u2062[^\u2062]*\u2062/g, function(m){ return n.offer ? '\u2062' + discNum(n.offer) + '\u2062' : m; })
    .replace(/\u2061[^\u2061]*\u2061/g, function(m){ return n.minutes ? '\u2061' + discDuration(n.minutes) + '\u2061' : m; });
}
/* цены на странице: текст между метками — текущие значения; скидки пакетов кодов (<span data-dpct>, «Для организаций») — от текущей обычной цены.
   Видна на странице цена (скрытые — например, закреплённая кнопка у того, кто тест не проходил, — не в счёт), а ответа сервера ещё нет — спрашивает его. Вызывается при загрузке, при каждом изменении страницы и по ответу сервера. */
function discPriceApply(){
  var P = window.DISC_PRICE; if(!P || !document.body) return;
  var w = document.createTreeWalker(document.body, 4, null), t, found = false;   // 4 — NodeFilter.SHOW_TEXT
  var seen = function(el){ return !!(el && el.getClientRects && el.getClientRects().length); };   // элемент на экране (не скрыт): только тогда цене нужен ответ сервера
  while((t = w.nextNode())){ var v = t.nodeValue, el = t.parentNode; if(!/[\u2061-\u2063]/.test(v) || /^(SCRIPT|STYLE|TEXTAREA)$/.test(el && el.nodeName)) continue;
    if(!found && seen(el)) found = true; var nv = discPriceStr(v); if(nv !== v) t.nodeValue = nv; }
  var sp = document.querySelectorAll('[data-dpct]'), n = discPriceNow();
  if(sp.length && seen(sp[0])) found = true;
  if(n && sp.length && P.packs && P.packs.length){
    var pct = function(p){ return Math.max(0, Math.floor((1 - p / n.regular) * 100)); }, mx = Math.max.apply(null, P.packs.map(pct));
    for(var i = 0; i < sp.length; i++){ var k = sp[i].getAttribute('data-dpct'), v2 = String(k === 'max' ? mx : pct(+k)); if(sp[i].textContent !== v2) sp[i].textContent = v2; }
  }
  if(found && discOffer.on !== true && discOffer.on !== false) discOffer(P.url);
}
/* страница открыта новым переходом, а не обновлением и не возвратом по истории */
function navFresh(){
  try{ var n = performance.getEntriesByType('navigation')[0]; return n ? n.type === 'navigate' : performance.navigation.type === 0; }catch(e){ return false; }
}
function pageHash(){ return dataHash() || location.hash || ''; }
/* показать ссылку на результат в адресной строке (экран результата): без новой записи истории и без события hashchange */
function showHash(h){ try{ history.replaceState({discHash:h, discShown:h}, '', location.pathname + location.search + h); }catch(e){} }
/* возврат к началу: адрес без хэша, запись истории без данных */
function dropHash(){ try{ if(location.hash || history.state) history.replaceState(null, '', location.pathname + location.search); }catch(e){} }

function initCommon(c){
  var L=c.L, t=c.t, esc=c.esc, lsGet=c.lsGet, lsSet=c.lsSet, langHref=c.langHref, $=c.$;

  /* цены и срок из панели (window.DISC_PRICE задаёт сборка там, где есть платная услуга): подставляются при загрузке, при каждом изменении
     страницы (экран результата и формы покупки рисуются скриптом) и по ответу сервера; своё изменение текста наблюдатель видит и больше ничего не меняет */
  (function(){
    if(!window.DISC_PRICE) return;
    var pend = false;
    function run(){ pend = false; discPriceApply(); }
    discOfferWatch(discPriceApply);
    discPriceApply();
    // class и hidden — элемент с ценой показан (закреплённая кнопка, раскрытая форма покупки)
    if(window.MutationObserver) new MutationObserver(function(){ if(!pend){ pend = true; (window.queueMicrotask || setTimeout)(run); } }).observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class', 'hidden']});
  })();

  /* хэш с данными убирается из адреса до загрузки счётчика (ниже) и при каждой смене хэша: этот обработчик стоит раньше обработчиков счётчика */
  dataHash();
  window.addEventListener('hashchange', dataHash);

  /* выбор языка запоминается только при явном действии пользователя. Хэш с данными в адрес ссылки не пишется (разметку видит
     запись посещений): обычный щелчок переносит его сам, а ссылка, открытая в новой вкладке, ведёт на страницу языка без него */
  function langClick(a, code){
    a.addEventListener('click', function(e){
      lsSet('disc.lang', code); a.href=langHref(code);
      var h = dataHash();
      if(h && !(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button)){ e.preventDefault(); location.href = a.href.split('#')[0] + h; }
    });
  }
  document.querySelectorAll('a[data-lang]').forEach(function(a){ langClick(a, a.getAttribute('data-lang')); });

  /* выпадающий список языков */
  (function(){
    var box=$('#langSel'), btn=$('#langBtn'), menu=$('#langMenu');
    if(!box||!btn||!menu) return;
    var items=[].slice.call(menu.querySelectorAll('a[data-lang]'));
    function open(){
      items.forEach(function(a){ a.href=langHref(a.getAttribute('data-lang')); });
      menu.hidden=false; btn.setAttribute('aria-expanded','true');
      var cur=menu.querySelector('a[aria-selected="true"]')||items[0]; try{ cur.focus({preventScroll:true}); }catch(e){ cur.focus(); }
    }
    function close(focusBtn){ if(menu.hidden) return; menu.hidden=true; btn.setAttribute('aria-expanded','false'); if(focusBtn) btn.focus(); }
    btn.addEventListener('click', function(){ menu.hidden ? open() : close(false); });
    btn.addEventListener('keydown', function(e){ if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); open(); } });
    menu.addEventListener('keydown', function(e){
      var i=items.indexOf(document.activeElement), n=items.length;
      if(e.key==='Escape'){ e.preventDefault(); close(true); }
      else if(e.key==='ArrowDown'){ e.preventDefault(); items[(i+1)%n].focus(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); items[(i-1+n)%n].focus(); }
      else if(e.key==='Home'){ e.preventDefault(); items[0].focus(); }
      else if(e.key==='End'){ e.preventDefault(); items[n-1].focus(); }
      else if(e.key==='Tab'){ close(false); }
    });
    document.addEventListener('click', function(e){ if(!box.contains(e.target)) close(false); });
  })();

  /* подсказка «Продолжить на …», если язык браузера отличается и выбор ещё не делался */
  (function(){
    if(lsGet('disc.lang')) return;
    var LANG_META = c.langMeta||{}, LANG_PATH = c.langPath||{};
    var prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language||''];
    var pick = null;
    /* zh-TW, zh-HK, zh-MO и zh-Hant-* — традиционный китайский (zh-hant), остальные zh — упрощённый; «in» — старый код индонезийского */
    for(var i=0;i<prefs.length && !pick;i++){ var full = String(prefs[i]).toLowerCase(), p = full.split('-')[0];
      if(p==='zh' && /^zh-(hant|tw|hk|mo)\b/.test(full) && LANG_PATH['zh-hant']!=null) p = 'zh-hant';
      if(p==='in') p = 'id';
      if(LANG_PATH[p]!=null) pick = p; }
    if(!pick || pick===L.lang || !LANG_META[pick]) return;
    var m = LANG_META[pick], bar = document.createElement('div');
    bar.className='langbar no-print'; bar.setAttribute('lang', pick); bar.setAttribute('dir', m.dir||'ltr');
    bar.innerHTML = '<a href="'+esc(langHref(pick))+'"><svg class="flag" aria-hidden="true" focusable="false"><use href="#flag-'+pick+'"/></svg><b>'+esc(m.name)+'</b><span>'+esc(m.cont)+(m.dir==="rtl"?" ←":" →")+'</span></a><button type="button" class="langbar-x" aria-label="×">×</button>';
    var app = $('#app'); app.insertBefore(bar, app.firstChild.nextSibling);
    langClick(bar.querySelector('a'), pick);
    bar.querySelector('button').addEventListener('click', function(){ lsSet('disc.lang', L.lang); bar.remove(); });
  })();

  /* уведомление о cookie и согласие на аналитику.
     window.DISC_ANALYTICS задаётся сборкой из site.config.json: {ym: номер счётчика Яндекс.Метрики, mode: "optin"|"always"}.
     optin — счётчик загружается только после кнопки «Принять»; always — сразу, уведомление лишь информирует.
     В localStorage disc.consent: "analytics" (согласие), "essential" (отказ), "noted" (режим always или счётчик не задан);
     старая отметка-дата означает, что человек видел прежний текст без аналитики, — уведомление показывается снова. */
  (function(){
    var A = window.DISC_ANALYTICS||{}, ym = A.ym ? String(A.ym) : "", optin = A.mode!=="always", ask = optin && !!ym;
    function loadYm(){
      /* пока в адресе остаётся хэш с данными (убрать его не удалось), счётчик не загружается вовсе */
      if(!ym || window.ym || /^#[ruc]=/.test(location.hash)) return;
      (function(m,e,t,r,i,k,a){ m[i]=m[i]||function(){ (m[i].a=m[i].a||[]).push(arguments); }; m[i].l=1*new Date();
        for(var j=0;j<document.scripts.length;j++){ if(document.scripts[j].src===r) return; }
        k=e.createElement(t); a=e.getElementsByTagName(t)[0]; k.async=1; k.src=r; a.parentNode.insertBefore(k,a);
      })(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id="+ym,"ym");
      /* defer: первый просмотр отправляем сами. От передачи хэша это не защищает: первый запрос счётчика с адресом страницы
         уходит и при defer (с отметкой «не считать просмотром»), — защищает dataHash() выше */
      window.ym(ym,"init",{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",accurateTrackBounce:true,trackLinks:true,defer:true});
      /* параметр визита «Язык сайта»: в Метрике «Параметры визитов» и сегменты по языковой версии (en в корне сайта не отличить по адресу) */
      window.ym(ym,"hit", location.origin+location.pathname+location.search, {referer:document.referrer, params:{"Язык сайта": L.lang}});
    }
    /* цели Метрики: страница теста вызывает discTrack("start") и discTrack("finish"); params — параметры цели (сумма оплаты: order_price, currency) */
    window.discTrack = function(goal, params){ if(ym && window.ym) window.ym(ym,"reachGoal",goal,params); };
    var st = lsGet("disc.consent");
    /* отказ «Только необходимое», данный в режиме optin, остаётся в силе и в режиме always: этому посетителю счётчик не загружается */
    if(!optin && st!=="essential") loadYm();
    if(st==="analytics"||st==="essential"||(st==="noted"&&!ask)){ if(ask && st==="analytics") loadYm(); return; }
    var el=document.createElement("div"); el.className="consent no-print"; el.id="consent"; el.setAttribute("role","region"); el.setAttribute("aria-label", t("consent.label"));
    var more = t("consent.details") + (c.privacyHref ? " <a href=\""+esc(c.privacyHref)+"\">"+esc(t("nav.privacy"))+"</a>" : "");
    el.innerHTML="<div class=\"consent-in\"><p>"+t("consent.text")+"</p>"+
      (ask ? "<span class=\"consent-btns\"><button class=\"btn small\" type=\"button\" id=\"consentOk\">"+t("consent.accept")+"</button><button class=\"btn small secondary\" type=\"button\" id=\"consentNo\">"+t("consent.decline")+"</button></span>"
           : "<button class=\"btn small\" type=\"button\" id=\"consentOk\">"+t("consent.ok")+"</button>")+
      "<details><summary>"+t("consent.more")+"</summary><p>"+more+"</p></details></div>";
    document.body.appendChild(el); document.body.classList.add("has-consent");
    function close(v){ lsSet("disc.consent", v); el.remove(); document.body.classList.remove("has-consent"); }
    $("#consentOk").addEventListener("click", function(){ close(ask ? "analytics" : "noted"); if(ask) loadYm(); });
    /* тест пройден в этом браузере: уведомление было на экране все 24 блока. В режиме always оно только сообщает — считаем его прочитанным
       и убираем, чтобы на телефоне оно не закрывало кнопку отчёта на экране результата. Согласие (режим optin) так не ставится никогда */
    if(!ask) window.discNoticeSeen = function(){ if(el.parentNode) close("noted"); };
    if($("#consentNo")) $("#consentNo").addEventListener("click", function(){ close("essential"); });
  })();

  /* закреплённая кнопка расширенного отчёта внизу экрана (с 2026-10-22 — на всех страницах сайта, решение заказчика).
     window.DISC_XBAR задаёт сборка только в языках, где отчёт продаётся (content.product.promo): {button, offer — та же кнопка со специальной
     ценой (пусто, если её нет), offerUrl — где спросить, включена ли она (discOffer), ms — срок специальной цены, close}. Видна тем, у кого на устройстве сохранён результат теста (disc.last),
     пока её не закроют крестиком (sessionStorage disc.xbar, до конца сеанса); не видна купившему отчёт (disc.pay.done) и на самостоятельных
     лендингах (c.noXbar). Страница теста управляет ею сама через window.discXbar.set({show, go, src}): прячет на время вопросов и в панели,
     на экране результата показывает и для чужого результата и раскрывает форму покупки. По умолчанию кнопка ведёт на страницу отчёта
     (источник заказа site-bar), а на самой странице отчёта — прокручивает к форме покупки. Цель Метрики — ext-bar. */
  (function(){
    var X = window.DISC_XBAR;
    if(!X || c.noXbar || !c.reportHref) return;
    function closed(){ try{ return sessionStorage.getItem('disc.xbar') === 'off'; }catch(e){ return false; } }
    function bought(){ var p = lsGet('disc.pay'); return !!(p && p.done); }
    function last(){ var r = lsGet('disc.last'); return r && r.t && r.m && r.l ? r : null; }
    var bar = document.createElement('div'); bar.className = 'xbar no-print'; bar.id = 'extBar';
    bar.innerHTML = '<a class="btn" id="extBarGo" href="'+esc(c.reportHref)+'"></a><button class="xbar-x" type="button" id="extBarX" aria-label="'+esc(X.close)+'" title="'+esc(X.close)+'">×</button>';
    document.body.appendChild(bar);
    var go = bar.firstChild, page = null, text = '', timer = 0;
    /* надпись: пока действует специальная цена (час после первого прохождения на устройстве, как в src/pay.js, и она включена в панели — discOffer) — с ней, потом обычная */
    function label(){
      clearTimeout(timer);
      if(text){ go.textContent = discPriceStr(text); return; }
      var r = last(), until = 0;
      var now = discPriceNow(), ms = now && now.minutes ? now.minutes * 60000 : X.ms;   // срок — из панели, когда ответ сервера уже есть
      if(X.offer && r){ var a = Date.parse(r.t), s = lsGet('disc.offer'), b = s && Date.parse(s.t); if(!isNaN(a)) until = Math.min(a, b && !isNaN(b) ? b : a) + ms; }
      var left = until - Date.now();
      if(left > 0 && discOffer.on !== true && discOffer.on !== false){ go.textContent = discPriceStr(X.button); discOffer(X.offerUrl); return; }
      if(left > 0 && !discOffer.on) left = 0;
      go.textContent = discPriceStr(left > 0 ? X.offer : X.button);
      if(left > 0) timer = setTimeout(label, Math.min(left + 500, 2147483000));
    }
    function sync(){
      var on = !closed() && !bought() && (page ? !!page.show : !!last());
      bar.classList.toggle('show', on); document.body.classList.toggle('has-xbar', on);
    }
    go.addEventListener('click', function(ev){
      if(window.discTrack) window.discTrack('ext-bar');
      if(page && page.go){ ev.preventDefault(); page.go(); return; }
      var f = document.querySelector('#buy input[type=email]');
      if(f){ ev.preventDefault(); f.scrollIntoView({behavior:'smooth', block:'center'}); try{ f.focus({preventScroll:true}); }catch(e){ f.focus(); } return; }
      try{ sessionStorage.setItem('disc.src', (page && page.src) || 'site-bar'); }catch(e){}
    });
    bar.lastChild.addEventListener('click', function(){ try{ sessionStorage.setItem('disc.xbar', 'off'); }catch(e){} sync(); });
    window.discXbar = {
      set: function(p){ page = p || null; text = ''; label(); sync(); },   // null — как на обычной странице
      text: function(s){ text = s || ''; label(); },
      sync: sync
    };
    discOfferWatch(label);   // ответ сервера о специальной цене и ценах (discOffer) — надпись заново
    label(); sync();
  })();

  /* отметка о посещении (visitStats в site.config.json, window.DISC_VISIT задаёт сборка): раз в сутки по Москве — один запрос на сервер сайта
     с языком версии, без адресов, меток и ответов; сервер пишет её со временем получения (счёт посетителей на «Сводке» панели).
     Дата последней отметки — в localStorage disc.visit; без localStorage отметка не шлётся (иначе ушла бы с каждой страницы).
     Только на самом сайте (не на localhost) и не из автоматических браузеров. Об отметке говорят тексты о данных на 14 языках. */
  (function(){
    var V = window.DISC_VISIT, day = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
    if(!V || !V.url || !window.fetch || navigator.webdriver || location.hostname !== V.host) return;
    try{ if(localStorage.getItem("disc.visit") === day) return; localStorage.setItem("disc.visit", day); if(localStorage.getItem("disc.visit") !== day) return; }catch(e){ return; }
    try{ fetch(V.url, {method:"POST", body:JSON.stringify({action:"visit", token:V.token, lang:L.lang}), keepalive:true})["catch"](function(){}); }catch(e){}
  })();
}
if (typeof module !== 'undefined' && module.exports) module.exports = initCommon;
