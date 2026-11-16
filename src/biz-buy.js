/* Покупка пакета кодов на странице «Для организаций» (/ru/business/, с 2026-11-16, по просьбе заказчика; "bizBuy": true в site.config.json и payEndpoint).
   Разметку формы кладёт сборка (build.js, bizBuyHTML), логику — эта функция. Цена кода — по пакетам businessPacks (как в таблице на странице):
   чем больше кодов, тем дешевле каждый; сервер считает так же и сверяет цену кода (private/server/src/team.js). Запросы к серверу оплаты:
     POST <payEndpoint>/biz/order {lang, email, qty, team, org, unit} → {ok: true, order, key, url} или {ok: false, error, price?}
     GET  <payEndpoint>/status?order=…&key=…  → {ok: true, status: 'new' | 'paid' | 'sent' | 'failed' | 'refunded'} (sent — письмо с кодами ушло)
   После оплаты банк возвращает покупателя сюда же с ?order=<номер>&pay=ok или &pay=fail; номер, ключ и e-mail заказа — в sessionStorage (disc.bizpay).
   Цели системы веб-аналитики: biz-buy (нажата «Купить»), biz-pay-start, biz-pay-error, biz-pay-done (вернулся после оплаты, с суммой), biz-pay-fail.
   На сервер уходят только данные заказа — ничего о посетителе.
   c: {T (тексты content.business.buy; noteHtml, errorHtml, invoiceHtml — готовая разметка), endpoint, L, esc, $, packs: [{from, price}], retail, min, max, email} */
function initBizBuy(c){
  var T = c.T, $ = c.$, esc = c.esc, form = $('#bizBuy'), box = $('#bizStatus');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, EMAIL_MAX = 64;
  function track(goal, params){ if(window.discTrack) window.discTrack(goal, params); }
  function ssGet(){ try{ return JSON.parse(sessionStorage.getItem('disc.bizpay') || 'null'); }catch(e){ return null; } }
  function ssSet(v){ try{ sessionStorage.setItem('disc.bizpay', JSON.stringify(v)); }catch(e){} }
  function fill(s, v){ return String(s).replace(/\{(\w+)\}/g, function(m, k){ return k in v ? v[k] : m; }); }
  function plural(n, f){ var k = 'many'; try{ k = new Intl.PluralRules(c.L.dateLocale).select(n); }catch(e){} return f[k] || f.many || f.other || ''; }
  function money(n){ return fill(T.money, {n: n.toLocaleString(c.L.dateLocale).replace(/ /g, ' ')}); }
  function say(kind, html){ if(!box) return; box.className = 'small sendstatus kitstatus' + (kind ? ' ' + kind : ''); box.innerHTML = html; box.hidden = false; }
  var packs = (c.packs || []).slice().sort(function(a, b){ return a.from - b.from; });
  function unit(n){ var u = 0; packs.forEach(function(p){ if(n >= p.from) u = p.price; }); return u; }

  /* возврат со страницы оплаты */
  var q = location.search, m = /[?&]order=(BIZ-[A-Z0-9-]{4,40})(?:&|$)/.exec(q), pay = (/[?&]pay=(ok|fail)(?:&|$)/.exec(q) || [])[1];
  if(m && pay === 'fail'){
    var rf = ssGet(); say('err', esc(T.status.failed));
    if(rf && rf.order === m[1] && !rf.fail){ rf.fail = true; ssSet(rf); track('biz-pay-fail'); }
  } else if(m && pay === 'ok'){
    var rec = ssGet();
    if(!rec || rec.order !== m[1] || !rec.key) say('ok', esc(T.status.thanks));
    else {
      if(!rec.done){ rec.done = true; ssSet(rec); track('biz-pay-done', {order_price: rec.total || 0, currency: 'RUB'}); }
      var TEXT = {'new': ['', T.status.wait], paid: ['ok', T.status.paid], sent: ['ok', T.status.sent], failed: ['err', T.status.failed]}, tries = 0;
      say('', esc(T.status.wait));
      (function ask(){
        fetch(c.endpoint + '/status?order=' + encodeURIComponent(rec.order) + '&key=' + encodeURIComponent(rec.key))
          .then(function(res){ return res.json(); })
          .then(function(j){ var s = j && j.ok ? String(j.status) : '', t = TEXT[s];
            if(t) say(t[0], esc(t[1]).replace(esc('{email}'), '<span class="ym-hide-content">'+esc(rec.email || '')+'</span>'));
            if((s === 'new' || s === 'paid') && ++tries < 45) setTimeout(ask, 4000); })
          .catch(function(){ if(++tries < 45) setTimeout(ask, 8000); });
      })();
    }
  }
  if(box && !box.hidden && box.scrollIntoView) setTimeout(function(){ box.scrollIntoView({block: 'center'}); }, 50);

  if(!form) return;
  var qty = $('#bizQty'), team = $('#bizTeam'), org = $('#bizOrg'), orgRow = $('#bizOrgRow'), email = $('#bizEmail'), btn = $('#bizPay'), err = $('#bizErr'), busy = false;
  function n(){ var v = parseInt(qty.value, 10); return isNaN(v) ? c.min : Math.max(c.min, Math.min(c.max, v)); }
  function price(){
    var k = n(), u = unit(k), t = Math.round(k * u * 100) / 100;
    [].forEach.call(form.querySelectorAll('.go-chip'), function(x){ x.setAttribute('aria-pressed', String(+x.getAttribute('data-n') === k)); });
    var line = esc(fill(T.line, {n: k, units: plural(k, T.units), unit: money(u)}));
    var next = packs.filter(function(p){ return p.from > k; })[0];
    if(next) line += '<br><span class="muted">' + esc(fill(T.addMore, {k: next.from - k, unit: money(next.price)})) + '</span>';
    if(c.retail > u) line += '<br><span class="ok">' + esc(fill(T.save, {sum: money(Math.round((c.retail - u) * k * 100) / 100)})) + '</span>';
    $('#bizPrice').innerHTML = line;
    $('#bizTotal').textContent = money(t);
    if(!busy) btn.textContent = fill(T.submit, {total: money(t)});
  }
  function all(){ qty.value = n(); orgRow.hidden = !team.checked; price(); err.hidden = true; }
  form.addEventListener('click', function(ev){ var b = ev.target.closest('.go-pm,.go-chip'); if(!b) return; ev.preventDefault();
    qty.value = b.getAttribute('data-n') ? b.getAttribute('data-n') : n() + (+b.getAttribute('data-d')); all(); });
  qty.addEventListener('input', function(){ if(qty.value !== '' && +qty.value >= c.min) price(); });
  qty.addEventListener('blur', all);
  team.addEventListener('change', all);
  [email, org].forEach(function(x){ x.addEventListener('input', function(){ x.classList.remove('go-bad'); err.hidden = true; }); });
  function setBusy(on){ busy = on; btn.disabled = on; if(on) btn.textContent = T.wait; else price(); }
  window.addEventListener('pageshow', function(ev){ if(ev.persisted) setBusy(false); });

  form.addEventListener('submit', function(ev){
    ev.preventDefault(); if(busy) return;
    var k = n(), em = email.value.trim(), tm = team.checked, og = org.value.trim().replace(/\s+/g, ' '), bad = null;
    qty.value = k;
    if(em.length > EMAIL_MAX || !EMAIL_RE.test(em)){ email.classList.add('go-bad'); bad = bad || [T.checkEmail, email]; }
    if(tm && og.length < 2){ org.classList.add('go-bad'); bad = bad || [T.checkOrg, org]; }
    if(bad){ err.textContent = bad[0]; err.hidden = false; bad[1].focus(); return; }
    err.hidden = true; setBusy(true); track('biz-buy', {qty: k, team: tm ? 1 : 0});
    var u = unit(k);
    // Content-Type не задаём: «простой» запрос без предварительного OPTIONS
    fetch(c.endpoint + '/biz/order', {method: 'POST', body: JSON.stringify({lang: c.L.lang, email: em, qty: k, team: tm, org: tm ? og : '', unit: u})})
      .then(function(res){ return res.text(); })
      .then(function(txt){ var j = null; try{ j = JSON.parse(txt); }catch(e){}
        if(j && !j.ok && j.error === 'price' && j.price > 0){ throw new Error('price'); }
        if(!j || !j.ok || !j.url || !j.order) throw new Error((j && j.error) || 'bad response');
        var url = new URL(j.url, location.href);   // платёжная страница: только https (на локальной заглушке — тот же адрес, что у сайта)
        if(url.protocol !== 'https:' && url.origin !== location.origin) throw new Error('bad url');
        ssSet({order: String(j.order), key: String(j.key || ''), email: em, total: Math.round(k * u * 100) / 100});
        track('biz-pay-start'); location.href = url.href; })
      .catch(function(e){ setBusy(false); err.hidden = false; var m2 = e && e.message;
        if(m2 === 'price') err.textContent = T.priceChanged;
        else if(m2 === 'bad email'){ err.textContent = T.checkEmail; email.classList.add('go-bad'); email.focus(); }
        else if(m2 === 'bad org'){ err.textContent = T.checkOrg; org.classList.add('go-bad'); org.focus(); }
        else if(m2 === 'bad qty') err.textContent = fill(T.checkQty, {min: c.min, max: c.max});
        else { err.innerHTML = T.errorHtml; track('biz-pay-error', {error: String(m2 || '').slice(0, 40)}); } });
  });
  all();
}

/* Страница команды для покупателя кодов (/ru/business/team/#t=<партия>.<ключ>, ссылка из письма с кодами). Ключ убирается из адресной строки
   до загрузки счётчика веб-аналитики (dataHash в src/common.js). Только числа и кнопка «Получить отчёт о команде»:
     GET  <payEndpoint>/team?t=…            → {ok, org, count, used, shared, min, days, pending, requested, sent, reports, revoked}
     POST <payEndpoint>/team/request {t}    → то же | {ok: false, error: 'few' | 'not found' | 'revoked'}
   Цели: team-open (страница открылась с верной ссылкой), team-request (отчёт запрошен).
   c: {T (content.business.teamPage; notFoundHtml, errorHtml — готовая разметка), endpoint, L, esc, $} */
function initTeamPage(c){
  var T = c.T, $ = c.$, esc = c.esc, box = $('#teamBox'), h = (typeof dataHash === 'function' ? dataHash() : '') || '', mm = /^#t=(\d{1,9}\.[A-Za-z0-9_-]{20,40})$/.exec(h);
  function fill(s, v){ return String(s).replace(/\{(\w+)\}/g, function(m, k){ return k in v ? v[k] : m; }); }
  function date(iso){ try{ return new Date(iso).toLocaleDateString(c.L.dateLocale, {day: 'numeric', month: 'long', year: 'numeric'}); }catch(e){ return ''; } }
  if(!box) return;
  if(!mm){ box.innerHTML = '<p class="small sendstatus err">' + T.notFoundHtml + '</p>'; return; }
  var t = mm[1], busy = false;
  function draw(j, problem){
    if(!j || !j.ok && j.error === 'not found'){ box.innerHTML = '<p class="small sendstatus err">' + T.notFoundHtml + '</p>'; return; }
    var row = function(k, v){ return '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>'; };
    var html = '<dl class="teamstats">' + (j.org ? row(T.org, esc(j.org)) : '') + row(T.codes, j.count) + row(T.used, j.used) + row(T.shared, '<b>' + j.shared + '</b>') + '</dl>' +
      '<p class="small muted">' + esc(T.privacy) + '</p>';
    if(j.revoked) html += '<p class="small sendstatus err">' + esc(T.revoked) + '</p>';
    else if(j.pending) html += '<p class="small sendstatus ok">' + esc(fill(T.requested, {date: date(j.requested), days: j.days})) + '</p>';
    else {
      if(j.sent) html += '<p class="small sendstatus ok">' + esc(fill(T.sent, {date: date(j.sent)})) + '</p>';
      var enough = j.shared >= j.min;
      html += '<p><button class="btn" type="button" id="teamReq"' + (enough ? '' : ' disabled') + '>' + esc(j.sent ? T.again : T.button) + '</button></p>';
      if(!enough) html += '<p class="small muted">' + esc(fill(T.few, {min: j.min, n: j.shared})) + '</p>';
    }
    if(problem) html += '<p class="small sendstatus err">' + problem + '</p>';
    box.innerHTML = html;
    var b = $('#teamReq');
    if(b) b.addEventListener('click', function(){
      if(busy) return; busy = true; b.disabled = true;
      fetch(c.endpoint + '/team/request', {method: 'POST', body: JSON.stringify({t: t})})
        .then(function(res){ return res.json(); })
        .then(function(r){ busy = false; if(r && (r.ok || r.error === 'few' || r.error === 'revoked')){ if(r.ok) track('team-request'); draw(r); } else draw(j, T.errorHtml); })
        .catch(function(){ busy = false; draw(j, T.errorHtml); });
    });
  }
  function track(goal){ if(window.discTrack) window.discTrack(goal); }
  box.innerHTML = '<p class="small muted">' + esc(T.loading) + '</p>';
  fetch(c.endpoint + '/team?t=' + encodeURIComponent(t))
    .then(function(res){ return res.json(); })
    .then(function(j){ if(j && j.ok) track('team-open'); draw(j); })
    .catch(function(){ box.innerHTML = '<p class="small sendstatus err">' + T.errorHtml + '</p>'; });
}
