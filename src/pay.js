/* Покупка расширенного отчёта: блок «Купить» на странице отчёта и страницы «Спасибо» и «Оплата не прошла».
   Сборка вставляет этот файл в три страницы, когда в site.config.json задан payEndpoint — адрес сервера оплаты:
     POST <payEndpoint>/order   {code, email, source, lang, price} → {ok: true, order, key, url} или {ok: false, error}
                                (price — цена в рублях, которую показала форма, только в языке со специальной ценой; error 'offer expired' — её срок вышел)
     GET  <payEndpoint>/status?order=…&key=…               → {ok: true, status: 'new' | 'paid' | 'sent' | 'failed' | 'refunded'}
   url — платёжная страница банка; после оплаты банк возвращает покупателя на …/extended-report/thanks/?order=<номер>,
   после отказа — на …/extended-report/failed/?order=<номер>. key — ключ заказа: по нему страница «Спасибо» спрашивает статус.
   Заказ, созданный в этом браузере, хранится в localStorage (disc.pay): номер, ключ, e-mail и отметки о сработавших целях.
   Цели Метрики: ext-page-buy (нажата «Купить»), ext-pay-start (заказ создан, переход на оплату), ext-pay-error (сервер оплаты
   не ответил или отказал), ext-pay-done (страница «Спасибо», с суммой), ext-pay-fail (страница «Оплата не прошла»). */
var PAY_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, PAY_EMAIL_MAX = 64;   // 64 знака — предел поля e-mail в кассовом чеке
function payTrack(goal, params){ if(window.discTrack) window.discTrack(goal, params); }
function payOrderFromUrl(){ var m = /[?&]order=([A-Za-z0-9_-]{4,50})(?:&|$)/.exec(location.search); return m ? m[1] : ''; }

/* Источник покупки для таблицы заказов: ?src=… в адресе (ссылки из письма, PDF, бота), иначе отметка экрана результата
   (sessionStorage disc.src: result-top, result-block), иначе services (пришли со страницы «Услуги») или page. */
function paySource(){
  var m = /[?&]src=([a-z0-9-]{1,20})(?:&|$)/.exec(location.search), s = '';
  try{ if(m) sessionStorage.setItem('disc.src', m[1]); s = sessionStorage.getItem('disc.src') || ''; }catch(e){ s = m ? m[1] : ''; }
  return s || (/\/services\/(?:$|[?#])/.test(document.referrer) ? 'services' : 'page');
}

/* Код результата для заказа — тот же формат, что у encodeResult на странице теста */
function payCode(r){
  function b64e(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  return 'DISC1.' + b64e(JSON.stringify({n:r.name||'', e:r.email||'', p:r.pos||'', t:r.t, m:r.m.join(''), l:r.l.join('')}));
}

/* Специальная цена на час после теста (T.offer — build.js, payOffer; сейчас только русская версия). Срок отсчитывается от более раннего
   из двух моментов: прохождение этого результата (r.t) и первое прохождение теста на этом устройстве (localStorage disc.offer — его ставит
   payOfferMark в конце теста, повторное прохождение срок не продлевает). Возвращает время окончания (мс) или 0. Сервер оплаты проверяет срок
   по r.t сам и цену вне срока не примет. */
function payOfferUntil(O, t, lsGet){
  if(!O) return 0;
  var a = Date.parse(t), s = lsGet ? lsGet('disc.offer') : null, b = s && Date.parse(s.t);
  if(isNaN(a)) return 0;
  return Math.min(a, b && !isNaN(b) ? b : a) + O.ms;
}
function payOfferMark(r, lsGet, lsSet){ if(!lsGet('disc.offer')) lsSet('disc.offer', {t: r.t}); }
function payClock(ms){ var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); s %= 60; return m + ':' + (s < 10 ? '0' : '') + s; }

/* Формы покупки одной страницы: поле e-mail, кнопка «Купить», строка гарантии (T.guarantee) и условие оферты. Формы на странице
   работают вместе: e-mail набирается в одной — появляется в остальных, на время перехода к оплате все кнопки заняты.
   Ими пользуются страница отчёта (initPayBuy) и экран результата на главной (src/template.html: покупка без перехода на страницу отчёта).
   c: {T (тексты content.product.pay, noteHtml и errorHtml — готовая разметка; T.offer — специальная цена), endpoint, L, esc, lsGet, lsSet}.
   add({id, code, t, source, email, price, priceEl}) → {form, input, btn, st}: форма ещё не вставлена в страницу; price — цена крупно над кнопкой,
   priceEl — готовый элемент цены на странице (страница отчёта), t — время прохождения теста (для срока специальной цены).
   Пока специальная цена действует, вместо цены — зачёркнутая обычная и специальная, под кнопкой — обратный отсчёт; по окончании срока
   (или по ответу сервера «offer expired») формы показывают обычную цену. g.onOffer(fn) — fn(on) при смене цены (закреплённая кнопка). */
function payForms(c){
  var T = c.T, esc = c.esc, O = T.offer || null, g = {busy:false, forms:[], subs:[], tick:0};
  g.onOffer = function(fn){ g.subs.push(fn); fn(g.forms.some(function(f){ return f.until > Date.now(); })); };
  g.paint = function(){
    var now = Date.now(), any = false;
    g.forms.forEach(function(f){
      var on = f.until > now; any = any || on;
      f.price = O ? (on ? O.price : O.regular) : 0;
      var html = O ? (on ? '<s class="xold"><span class="vh">'+esc(O.regularLabel)+' </span>'+esc(O.regularText)+'</s> '+esc(O.priceText) : esc(O.regularText)) : null;
      if(f.big && html !== null && f.big.innerHTML !== html) f.big.innerHTML = html;
      f.deal.hidden = !on; if(on) f.clock.textContent = payClock(f.until - now);
    });
    if(any !== g.on){ g.on = any; g.subs.forEach(function(fn){ fn(any); }); }
    if(any && !g.tick) g.tick = setInterval(g.paint, 1000);
    if(!any && g.tick){ clearInterval(g.tick); g.tick = 0; }
  };
  g.setBusy = function(on){ g.busy = on; g.forms.forEach(function(f){ f.btn.disabled = on; f.btn.textContent = on ? T.wait : T.button; }); };
  // возврат со страницы банка кнопкой «Назад»: браузер показывает сохранённую страницу с нажатой кнопкой
  window.addEventListener('pageshow', function(ev){ if(ev.persisted) g.setBusy(false); });
  g.add = function(o){
    var form = document.createElement('form'); form.className = 'xpay'; form.noValidate = true;
    // плашка специальной цены над полем e-mail: призыв «Успейте купить за 490 ₽», пояснение о сроке и крупный обратный отсчёт
    form.innerHTML = (O ? '<div class="xdeal" hidden><div class="xdeal-t"><b>'+esc(O.cta)+'</b><small>'+esc(O.note)+'</small></div>'+
        '<div class="xclock"><small>'+esc(O.left)+'</small><span aria-live="off"></span></div></div>' : '<div class="xdeal" hidden><span></span></div>')+
      '<div class="field"><label for="'+o.id+'">'+esc(T.emailLabel)+'</label>'+
      '<input type="email" id="'+o.id+'" class="ym-disable-keys" autocomplete="email" inputmode="email" maxlength="'+PAY_EMAIL_MAX+'"'+(T.emailPlaceholder ? ' placeholder="'+esc(T.emailPlaceholder)+'"' : '')+' required></div>'+
      (o.price ? '<div class="xbuyact"><span class="xbig">'+esc(o.price)+'</span><button class="btn" type="submit">'+esc(T.button)+'</button></div>'
        : '<button class="btn" type="submit">'+esc(T.button)+'</button>')+
      (T.guarantee ? '<p class="xguar">'+esc(T.guarantee)+'</p>' : '')+
      '<p class="small sendstatus err" aria-live="polite" hidden></p><p class="xnote">'+T.noteHtml+'</p>';
    var f = {form:form, input:form.querySelector('input'), btn:form.querySelector('button'), st:form.querySelector('.sendstatus'), deal:form.querySelector('.xdeal'), clock:form.querySelector('.xdeal span'),
      big: o.priceEl || form.querySelector('.xbig'), until: payOfferUntil(O, o.t, c.lsGet), price: 0}, input = f.input, st = f.st;
    var other = g.forms.filter(function(x){ return x.input.value; })[0];
    if(other) input.value = other.input.value;
    else if(o.email && String(o.email).length <= PAY_EMAIL_MAX) input.value = o.email;
    g.forms.push(f); g.paint();
    input.addEventListener('input', function(){ st.hidden = true; g.forms.forEach(function(x){ if(x.input !== input) x.input.value = input.value; }); });
    form.addEventListener('submit', function(ev){
      ev.preventDefault(); if(g.busy) return;
      var email = input.value.trim();
      if(email.length > PAY_EMAIL_MAX || !PAY_EMAIL_RE.test(email)){ st.textContent = T.badEmail; st.hidden = false; input.focus(); return; }
      st.hidden = true; g.setBusy(true); payTrack('ext-page-buy');
      // Content-Type не задаём: «простой» запрос без предварительного OPTIONS
      g.paint(); var price = f.price;
      var body = {code:o.code, email:email, source:o.source, lang:c.L.lang}; if(price) body.price = price;
      fetch(c.endpoint + '/order', {method:'POST', body: JSON.stringify(body)})
        .then(function(res){ return res.text(); })
        .then(function(txt){ var j = null; try{ j = JSON.parse(txt); }catch(e){}
          if(j && !j.ok && j.error === 'offer expired' && O){ g.forms.forEach(function(x){ x.until = 0; }); g.paint(); throw new Error('offer expired'); }
          if(!j || !j.ok || !j.url || !j.order) throw new Error((j && j.error) || 'bad response');
          var u = new URL(j.url, location.href);   // платёжная страница: только https (на локальной заглушке — тот же адрес, что у сайта)
          if(u.protocol !== 'https:' && u.origin !== location.origin) throw new Error('bad url');
          c.lsSet('disc.pay', {order:String(j.order), key:String(j.key||''), email:email, t:Date.now(), price:price || 0});
          payTrack('ext-pay-start'); location.href = u.href; })
        .catch(function(err){ g.setBusy(false); st.hidden = false;
          if(err && err.message === 'bad email'){ st.textContent = T.badEmail; input.focus(); }
          else if(err && err.message === 'offer expired'){ st.textContent = O.expired; }
          else { st.innerHTML = T.errorHtml; payTrack('ext-pay-error'); } });
    });
    return f;
  };
  return g;
}

/* Страница отчёта: у кого результат сохранён на этом устройстве (disc.last), тому блок покупки (.xbuy) превращается в форму
   с полем e-mail и кнопкой «Купить». c: {T (тексты content.product.pay, noteHtml и errorHtml — готовая разметка), endpoint, L, esc, lsGet, lsSet} */
function initPayBuy(c){
  // результат — из адреса страницы (ссылка из PDF краткого отчёта или письма: #r=DISC1.…, функция resultFromUrl вставляется сборкой), иначе сохранённый на устройстве
  var T = c.T, r = (typeof resultFromUrl === 'function' && resultFromUrl()) || c.lsGet('disc.last'); if(!r || !r.t || !r.m || !r.l || !r.m.join) return;
  var d = new Date(r.t), date = isNaN(d) ? '' : d.toLocaleDateString(c.L.dateLocale, {day:'numeric', month:'long', year:'numeric'});
  var code = payCode(r), source = paySource(), g = payForms(c);
  [].forEach.call(document.querySelectorAll('.xbuy'), function(box, i){
    var old = box.querySelector('a.btn'), price = box.querySelector('.price'), guar = box.querySelector('.xguar'), pv = null;
    box.querySelector('h2').textContent = T.title.replace('{date}', date);
    box.querySelector('div p').textContent = T.text;
    // цена «Стоимость 790 ₽»: сама сумма — в своём элементе, им управляет форма (зачёркнутая обычная цена и специальная, пока та действует)
    if(price && T.offer){ var sm = price.querySelector('small'); pv = document.createElement('span'); pv.textContent = T.offer.regularText;
      price.textContent = ''; if(sm) price.appendChild(sm); price.appendChild(pv); }
    var f = g.add({id:'payEmail' + i, code:code, t:r.t, source:source, email:r.email, priceEl:pv});
    if(price) f.form.insertBefore(price, f.btn);
    if(old) old.parentNode.removeChild(old);
    if(guar) guar.parentNode.removeChild(guar);   // строка гарантии без формы (сборка) — в форме она своя
    box.appendChild(f.form);
  });
}

/* Заказ для страниц «Спасибо» и «Оплата не прошла»: номер из адреса; mine — заказ создан в этом браузере (тогда известны e-mail и ключ) */
function payOrder(c){
  var rec = c.lsGet('disc.pay'), order = payOrderFromUrl() || (rec && rec.order) || '';
  return {order: order, rec: rec && rec.order && rec.order === order ? rec : null};
}

/* «Спасибо»: e-mail покупателя в первом абзаце, номер заказа, статус (оплата получена → отчёт отправлен), цель ext-pay-done один раз на заказ.
   c: {T (content.product.pay.thanks), endpoint, price, currency (RUB или USD — валюта языка), lsGet, lsSet, $} */
function initPayThanks(c){
  var T = c.T, $ = c.$, o = payOrder(c), rec = o.rec, lead = $('#payLead'), ord = $('#payOrder'), st = $('#payStatus');
  if(rec && rec.email){ lead.textContent = T.leadEmail.replace('{email}', rec.email); lead.classList.add('ym-hide-content'); }
  if(o.order){ ord.textContent = T.order.replace('{order}', o.order); ord.hidden = false; }
  if(!rec) return;
  if(!rec.done){ rec.done = true; c.lsSet('disc.pay', rec); payTrack('ext-pay-done', {order_price: rec.price || c.price, currency: c.currency || 'RUB'}); }
  if(!rec.key || !c.endpoint) return;
  var TEXT = {'new': T.statusWait, paid: T.statusPaid, sent: T.statusSent}, tries = 0;
  (function ask(){
    fetch(c.endpoint + '/status?order=' + encodeURIComponent(rec.order) + '&key=' + encodeURIComponent(rec.key))
      .then(function(res){ return res.json(); })
      .then(function(j){ var s = j && j.ok ? String(j.status) : '';
        if(TEXT[s]){ st.textContent = TEXT[s]; st.className = 'small sendstatus' + (s === 'new' ? '' : ' ok'); st.hidden = false; } else st.hidden = true;
        if((s === 'new' || s === 'paid') && ++tries < 30) setTimeout(ask, 4000); })
      .catch(function(){ if(++tries < 30) setTimeout(ask, 8000); });
  })();
}

/* «Оплата не прошла»: номер заказа и цель ext-pay-fail один раз на заказ. c: {T (content.product.pay.fail), lsGet, lsSet, $} */
function initPayFail(c){
  var o = payOrder(c), rec = o.rec, ord = c.$('#payOrder');
  if(o.order){ ord.textContent = c.T.order.replace('{order}', o.order); ord.hidden = false; }
  if(rec && !rec.fail){ rec.fail = true; c.lsSet('disc.pay', rec); payTrack('ext-pay-fail'); }
}
