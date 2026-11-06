/* Покупка набора ведущего на странице /kit/ (с 2026-11-06; "kitBuy": true в site.config.json и payEndpoint). Разметку формы кладёт сборка (build.js),
   логику — эта функция. Запросы к серверу оплаты (private/server/src/pay.js):
     POST <payEndpoint>/kit/order  {email, lang, price} → {ok: true, order, key, url} или {ok: false, error}
     GET  <payEndpoint>/status?order=…&key=…          → {ok: true, status: 'new' | 'paid' | 'sent' | 'failed' | 'refunded'}
   url — платёжная страница (Т-Банк в русской версии, Prodamus в остальных); после оплаты покупатель возвращается на эту же страницу
   с ?order=<номер>&pay=ok, после отказа — с &pay=fail. Номер, ключ и e-mail заказа живут до закрытия вкладки (sessionStorage disc.kitpay):
   по ним страница показывает, что письмо со ссылками на файлы ушло. ?kit=expired — сервер перевёл сюда по ссылке из письма, срок которой вышел.
   Цели системы веб-аналитики: kit-buy (нажата «Купить»), kit-pay-start (переход на оплату), kit-pay-error (сервер не ответил или отказал),
   kit-pay-done (вернулся после оплаты, с суммой), kit-pay-fail (оплата не прошла).
   c: {T (тексты content.kit.buy: noteHtml, errorHtml — готовая разметка, status — строки состояния), endpoint, L, esc, $, price (число), currency, email} */
function initKitBuy(c){
  var T = c.T, $ = c.$, esc = c.esc, form = $('#kitBuy'), box = $('#kitStatus');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, EMAIL_MAX = 64;   // 64 знака — предел поля e-mail в кассовом чеке
  var mailLink = c.email ? '<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>' : '';
  function track(goal, params){ if(window.discTrack) window.discTrack(goal, params); }
  function ssGet(){ try{ return JSON.parse(sessionStorage.getItem('disc.kitpay') || 'null'); }catch(e){ return null; } }
  function ssSet(v){ try{ sessionStorage.setItem('disc.kitpay', JSON.stringify(v)); }catch(e){} }
  function say(kind, html){ if(!box) return; box.className = 'small sendstatus kitstatus' + (kind ? ' ' + kind : ''); box.innerHTML = html; box.hidden = false; }

  /* возврат со страницы оплаты или по ссылке из письма с вышедшим сроком */
  var q = location.search, m = /[?&]order=(KIT-[A-Z0-9-]{4,40})(?:&|$)/.exec(q), pay = (/[?&]pay=(ok|fail)(?:&|$)/.exec(q) || [])[1];
  if(/[?&]kit=expired(?:&|$)/.test(q)) say('err', esc(T.status.expired).replace(esc('{email}'), mailLink));
  else if(m && pay === 'fail'){
    var rf = ssGet(); say('err', esc(T.status.failed));
    if(rf && rf.order === m[1] && !rf.fail){ rf.fail = true; ssSet(rf); track('kit-pay-fail'); }
  } else if(m && pay === 'ok'){
    var rec = ssGet();
    if(!rec || rec.order !== m[1] || !rec.key){ say('ok', esc(T.status.thanks)); }
    else {
      if(!rec.done){ rec.done = true; ssSet(rec); track('kit-pay-done', {order_price: c.price, currency: c.currency}); }
      var TEXT = {'new': [ '', T.status.wait ], paid: [ 'ok', T.status.paid ], sent: [ 'ok', T.status.sent ], failed: [ 'err', T.status.failed ]}, tries = 0;
      say('', esc(T.status.wait));
      (function ask(){
        fetch(c.endpoint + '/status?order=' + encodeURIComponent(rec.order) + '&key=' + encodeURIComponent(rec.key))
          .then(function(res){ return res.json(); })
          .then(function(j){ var s = j && j.ok ? String(j.status) : '', t = TEXT[s];
            if(t){ say(t[0], esc(t[1]).replace(esc('{email}'), '<span class="ym-hide-content">'+esc(rec.email || '')+'</span>')); }
            if((s === 'new' || s === 'paid') && ++tries < 30) setTimeout(ask, 4000); })
          .catch(function(){ if(++tries < 30) setTimeout(ask, 8000); });
      })();
    }
  }
  if(box && !box.hidden && box.scrollIntoView) setTimeout(function(){ box.scrollIntoView({block: 'center'}); }, 50);

  if(!form) return;
  var input = form.querySelector('input[type=email]'), btn = form.querySelector('button'), st = form.querySelector('.sendstatus'), busy = false;
  function setBusy(on){ busy = on; btn.disabled = on; btn.textContent = on ? T.wait : T.submit; }
  // возврат со страницы оплаты кнопкой «Назад»: браузер показывает сохранённую страницу с нажатой кнопкой
  window.addEventListener('pageshow', function(ev){ if(ev.persisted) setBusy(false); });
  input.addEventListener('input', function(){ st.hidden = true; });
  form.addEventListener('submit', function(ev){
    ev.preventDefault(); if(busy) return;
    var email = input.value.trim();
    if(email.length > EMAIL_MAX || !EMAIL_RE.test(email)){ st.textContent = T.badEmail; st.hidden = false; input.focus(); return; }
    st.hidden = true; setBusy(true); track('kit-buy');
    // Content-Type не задаём: «простой» запрос без предварительного OPTIONS
    fetch(c.endpoint + '/kit/order', {method: 'POST', body: JSON.stringify({email: email, lang: c.L.lang, price: c.price})})
      .then(function(res){ return res.text(); })
      .then(function(txt){ var j = null; try{ j = JSON.parse(txt); }catch(e){}
        if(!j || !j.ok || !j.url || !j.order) throw new Error((j && j.error) || 'bad response');
        var u = new URL(j.url, location.href);   // платёжная страница: только https (на локальной заглушке — тот же адрес, что у сайта)
        if(u.protocol !== 'https:' && u.origin !== location.origin) throw new Error('bad url');
        ssSet({order: String(j.order), key: String(j.key || ''), email: email});
        track('kit-pay-start'); location.href = u.href; })
      .catch(function(err){ setBusy(false); st.hidden = false;
        if(err && err.message === 'bad email'){ st.textContent = T.badEmail; input.focus(); }
        else { st.innerHTML = T.errorHtml; track('kit-pay-error'); } });
  });
}
