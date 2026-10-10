/* Покупка расширенного отчёта: блок «Купить» на странице отчёта и страницы «Спасибо» и «Оплата не прошла».
   Сборка вставляет этот файл в три страницы, когда в site.config.json задан payEndpoint — адрес сервера оплаты:
     POST <payEndpoint>/order   {code, email, source, lang} → {ok: true, order, key, url} или {ok: false, error}
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

/* Страница отчёта: у кого результат сохранён на этом устройстве (disc.last), тому блок покупки (.xbuy) превращается в форму
   с полем e-mail и кнопкой «Купить». c: {T (тексты content.product.pay, noteHtml и errorHtml — готовая разметка), endpoint, L, esc, lsGet, lsSet} */
function initPayBuy(c){
  var T = c.T, esc = c.esc, r = c.lsGet('disc.last'); if(!r || !r.t || !r.m || !r.l || !r.m.join) return;
  var d = new Date(r.t), date = isNaN(d) ? '' : d.toLocaleDateString(c.L.dateLocale, {day:'numeric', month:'long', year:'numeric'});
  function b64e(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  var code = 'DISC1.' + b64e(JSON.stringify({n:r.name||'', e:r.email||'', p:r.pos||'', t:r.t, m:r.m.join(''), l:r.l.join('')}));
  var source = paySource(), busy = false, forms = [];
  function setBusy(on){ busy = on; forms.forEach(function(f){ f.btn.disabled = on; f.btn.textContent = on ? T.wait : T.button; }); }
  // возврат со страницы банка кнопкой «Назад»: браузер показывает сохранённую страницу с нажатой кнопкой
  window.addEventListener('pageshow', function(ev){ if(ev.persisted) setBusy(false); });
  [].forEach.call(document.querySelectorAll('.xbuy'), function(box, i){
    var id = 'payEmail' + i, old = box.querySelector('a.btn'), price = box.querySelector('.price');
    box.querySelector('h2').textContent = T.title.replace('{date}', date);
    box.querySelector('div p').textContent = T.text;
    var form = document.createElement('form'); form.className = 'xpay'; form.noValidate = true;
    form.innerHTML = '<div class="field"><label for="'+id+'">'+esc(T.emailLabel)+'</label>'+
      '<input type="email" id="'+id+'" class="ym-disable-keys" autocomplete="email" inputmode="email" maxlength="'+PAY_EMAIL_MAX+'" required></div>'+
      '<button class="btn" type="submit">'+esc(T.button)+'</button>'+
      '<p class="small sendstatus err" aria-live="polite" hidden></p><p class="xnote">'+T.noteHtml+'</p>';
    var input = form.querySelector('input'), btn = form.querySelector('button'), st = form.querySelector('.sendstatus');
    if(price) form.insertBefore(price, btn);
    if(old) old.parentNode.removeChild(old);
    box.appendChild(form);
    if(r.email && String(r.email).length <= PAY_EMAIL_MAX) input.value = r.email;
    forms.push({input:input, btn:btn, st:st});
    input.addEventListener('input', function(){ st.hidden = true; forms.forEach(function(f){ if(f.input !== input) f.input.value = input.value; }); });
    form.addEventListener('submit', function(ev){
      ev.preventDefault(); if(busy) return;
      var email = input.value.trim();
      if(email.length > PAY_EMAIL_MAX || !PAY_EMAIL_RE.test(email)){ st.textContent = T.badEmail; st.hidden = false; input.focus(); return; }
      st.hidden = true; setBusy(true); payTrack('ext-page-buy');
      // Content-Type не задаём: «простой» запрос без предварительного OPTIONS
      fetch(c.endpoint + '/order', {method:'POST', body: JSON.stringify({code:code, email:email, source:source, lang:c.L.lang})})
        .then(function(res){ return res.text(); })
        .then(function(txt){ var j = null; try{ j = JSON.parse(txt); }catch(e){}
          if(!j || !j.ok || !j.url || !j.order) throw new Error((j && j.error) || 'bad response');
          var u = new URL(j.url, location.href);   // платёжная страница: только https (на локальной заглушке — тот же адрес, что у сайта)
          if(u.protocol !== 'https:' && u.origin !== location.origin) throw new Error('bad url');
          c.lsSet('disc.pay', {order:String(j.order), key:String(j.key||''), email:email, t:Date.now()});
          payTrack('ext-pay-start'); location.href = u.href; })
        .catch(function(err){ setBusy(false); st.hidden = false;
          if(err && err.message === 'bad email'){ st.textContent = T.badEmail; input.focus(); }
          else { st.innerHTML = T.errorHtml; payTrack('ext-pay-error'); } });
    });
  });
}

/* Заказ для страниц «Спасибо» и «Оплата не прошла»: номер из адреса; mine — заказ создан в этом браузере (тогда известны e-mail и ключ) */
function payOrder(c){
  var rec = c.lsGet('disc.pay'), order = payOrderFromUrl() || (rec && rec.order) || '';
  return {order: order, rec: rec && rec.order && rec.order === order ? rec : null};
}

/* «Спасибо»: e-mail покупателя в первом абзаце, номер заказа, статус (оплата получена → отчёт отправлен), цель ext-pay-done один раз на заказ.
   c: {T (content.product.pay.thanks), endpoint, price, lsGet, lsSet, $} */
function initPayThanks(c){
  var T = c.T, $ = c.$, o = payOrder(c), rec = o.rec, lead = $('#payLead'), ord = $('#payOrder'), st = $('#payStatus');
  if(rec && rec.email){ lead.textContent = T.leadEmail.replace('{email}', rec.email); lead.classList.add('ym-hide-content'); }
  if(o.order){ ord.textContent = T.order.replace('{order}', o.order); ord.hidden = false; }
  if(!rec) return;
  if(!rec.done){ rec.done = true; c.lsSet('disc.pay', rec); payTrack('ext-pay-done', {order_price: c.price, currency: 'RUB'}); }
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
