/* Подарочные сертификаты на расширенный отчёт: страница /<язык>/gift/ (с 2026-11-14, по просьбе заказчика; "giftBuy": true в site.config.json и payEndpoint;
   русская версия — Т-Банк, рубли; остальные — Prodamus, доллары или евро, цена языка из панели).
   Разметку страницы кладёт сборка (build.js), логику — initGift. Запросы к серверу оплаты (private/server/src/gift.js):
     POST <payEndpoint>/gift/order {lang, email, qty, named, each, from, recipients: [{name, email}], agree, unit} → {ok: true, order, key, url} или {ok: false, error}
     GET  <payEndpoint>/status?order=…&key=…  → {ok: true, status: 'new' | 'paid' | 'sent' | 'failed' | 'refunded'}
     GET  <payEndpoint>/offer                 → текущая обычная цена отчёта (prices.RUB.regular) — общий запрос страниц с ценами (discOffer, src/common.js)
   После оплаты банк возвращает покупателя сюда же с ?order=<номер>&pay=ok или &pay=fail; номер, ключ и e-mail заказа — в sessionStorage (disc.giftpay).
   Получатель открывает эту же страницу по ссылке или QR-коду с сертификата: /ru/gift/#g=<код>. Код убирается из адресной строки до загрузки счётчика
   веб-аналитики (dataHash в src/common.js) и запоминается в браузере (localStorage disc.gift): на экране результата и в карточке вернувшегося посетителя
   форма покупки сразу открыта в режиме кода с этим кодом (payCodeInit в src/pay.js). Цели: gift-buy, gift-pay-start, gift-pay-error, gift-pay-done,
   gift-pay-fail, gift-open (получатель открыл ссылку с сертификата). На сервер уходят только данные заказа — ничего о посетителе.
   giftCertHTML — вид сертификата для образца и предпросмотра на странице; сам PDF собирает сервер (certHtml в private/server/src/gift.js — та же раскладка). */
// шрифт сертификата по языку (как certHtml на сервере): китайский, японский, арабский — свой шрифт и заголовки без Unbounded (класс own)
var GIFT_OWN = {zh: 1, 'zh-hant': 1, ja: 1, ar: 1};
function giftCertHTML(C, o){
  var e = function(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }); };
  var a = function(href, label){ return '<a dir="ltr" href="'+e(href)+'">'+e(label)+'</a>'; };   // адрес — слева направо и в арабском тексте
  var homeShort = String(o.home).replace(/^https?:\/\//, '').replace(/\/$/, ''), site = String(o.site).replace(/^https?:\/\//, '');
  return '<div class="cert'+(o.name ? ' named' : '')+(GIFT_OWN[o.lang] ? ' own c-'+o.lang : '')+'"><div class="c-band"><i></i><i></i><i></i><i></i></div>'+(o.sample ? '<div class="c-sample">'+e(C.sample)+'</div>' : '')+
    '<div class="c-grid"><div class="c-main"><div class="c-brand"><span class="c-dots"><i></i><i></i><i></i><i></i></span>'+e(C.brand)+'</div>'+
    '<div class="c-eyebrow">'+e(C.eyebrow)+'</div><div class="c-title">'+e(C.title)+'</div>'+
    (o.name ? '<div class="c-to"><div class="c-lbl">'+e(C.to)+'</div><div class="c-name">'+e(o.name)+'</div></div>' : '')+
    '<p class="c-desc">'+e(C.desc)+'</p>'+(o.from ? '<div class="c-from"><span class="c-lbl">'+e(C.from)+'</span> '+e(o.from)+'</div>' : '')+
    '</div><div class="c-side"><div class="c-lbl">'+e(C.codeLabel)+'</div><a class="c-code" href="'+e(o.url)+'">'+e(o.code)+'</a>'+
    '<div class="c-qr">'+o.qr+'</div><div class="c-hint">'+e(C.hint)+'</div></div></div>'+
    '<div class="c-steps"><div class="c-sh">'+e(C.stepsTitle)+'</div><ol>'+C.steps.map(function(s){ return '<li><b>'+e(s[0])+'</b> '+e(s[1]).replace(e('{site}'), a(o.home, homeShort))+'</li>'; }).join('')+'</ol></div>'+
    '<div class="c-foot"><span>'+e(C.until.replace('{date}', o.until))+'</span>'+a(o.home, site)+'<span>'+e(C.questions).replace(e('{email}'), a('mailto:'+o.email, o.email))+'</span></div></div>';
}

function initGift(c){
  var T = c.T, O = T.order, C = c.C, G = c.G, esc = c.esc, $ = c.$;
  var base = c.base;   // обычная цена отчёта языка в его валюте: при сборке — из site.config.json, после ответа сервера — из панели
  var cur = c.cur || 'RUB', dec = cur === 'RUB' ? 0 : 2;   // рубли — целые, доллары и евро — с центами
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, EMAIL_MAX = 64;
  function track(goal, params){ if(window.discTrack) window.discTrack(goal, params); }
  function ssGet(){ try{ return JSON.parse(sessionStorage.getItem('disc.giftpay') || 'null'); }catch(e){ return null; } }
  function ssSet(v){ try{ sessionStorage.setItem('disc.giftpay', JSON.stringify(v)); }catch(e){} }
  // цена одного сертификата: от G.offFrom штук — со скидкой G.offPct %: рубли — до целого рубля, доллары и евро — до цента (так же считает сервер)
  function unit(n){ return !(n >= G.offFrom && G.offPct > 0) ? base : dec ? Math.round(base * 100 * (100 - G.offPct) / 100) / 100 : Math.round(base * (100 - G.offPct) / 100); }
  // сумма в записи языка: число — Intl.NumberFormat языка, знак валюты — по образцу order.money («{n} ₽», «US${n}», «{n} €»)
  function rub(n){ var s = n.toLocaleString(c.L.dateLocale, {minimumFractionDigits: dec, maximumFractionDigits: dec}); if(cur === 'RUB') s = s.replace(/\u00a0/g, '\u202f'); return String(O.money || '{n}').replace('{n}', s); }
  // форма слова по числу — по правилам языка (Intl.PluralRules): units — {one, few, many, other, …}
  function plural(n, f){ if(Array.isArray(f)) f = {one: f[0], few: f[1], many: f[2], other: f[2]}; var k = 'other'; try{ k = new Intl.PluralRules(c.L.dateLocale).select(n); }catch(e){} return f[k] || f.other || ''; }
  function fill(s, v){ return String(s).replace(/\{(\w+)\}/g, function(m, k){ return k in v ? v[k] : m; }); }

  /* сертификат: масштаб под ширину блока (раскладка — 1123 × 794, лист A4) */
  function fit(box){ var x = box.firstElementChild; if(x) x.style.transform = 'scale(' + (box.clientWidth / 1123) + ')'; }
  var boxes = [].slice.call(document.querySelectorAll('.certbox'));
  function fitAll(){ boxes.forEach(fit); }
  if(window.ResizeObserver){ var ro = new ResizeObserver(function(es){ es.forEach(function(x){ fit(x.target); }); }); boxes.forEach(function(b){ ro.observe(b); }); }
  window.addEventListener('resize', fitAll);
  function cert(box, o){ box.innerHTML = giftCertHTML(C, {name: o.name, from: o.from, code: o.code || c.sampleCode, url: o.url || c.sampleUrl, qr: c.qr, until: c.until, sample: true, home: c.home, site: c.site, email: c.email, lang: c.L.lang}); fit(box); }

  /* образец: именной / без имени */
  var sb = $('#giftSample');
  [].forEach.call(document.querySelectorAll('.gift-tabs button'), function(b){
    b.addEventListener('click', function(){
      [].forEach.call(b.parentNode.children, function(x){ x.setAttribute('aria-selected', String(x === b)); });
      var named = b.getAttribute('data-v') === 'named';
      cert(sb, {name: named ? T.sampleName : '', from: named ? T.sampleFrom : ''});
    });
  });
  fitAll();

  /* получатель: открыл ссылку или QR-код с сертификата (#g=<код>) */
  var rc = $('#giftFor'), seenG = '';
  function recipient(){
  var h = (typeof dataHash === 'function' ? dataHash() : '') || '', gm = /^#g=([A-Za-z0-9-]{12,20})$/.exec(h);
  if(rc && /^#g=/.test(h) && h !== seenG){
    seenG = h;
    var code = gm ? gm[1].toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    rc.hidden = false;
    if(code.length === 12){
      try{ c.lsSet('disc.gift', {code: code, t: Date.now()}); }catch(e){}
      rc.querySelector('.gf-text').textContent = T.recipient.text.replace('{code}', code.replace(/(.{4})(?=.)/g, '$1-'));
      var last = c.lsGet('disc.last'); if(last && last.t) rc.querySelector('.gf-result').hidden = false;
      track('gift-open');
    } else { rc.querySelector('.gf-text').textContent = T.recipient.bad; rc.querySelector('.gf-acts').hidden = true; }
    try{ rc.scrollIntoView({block: 'start'}); }catch(e){}
  }
  }
  recipient();
  window.addEventListener('hashchange', function(){ setTimeout(recipient, 0); });   // ссылка с сертификата открыта на уже открытой странице

  /* возврат со страницы оплаты */
  var box = $('#giftStatus'), q = location.search, om = /[?&]order=(GIFT-[A-Z0-9-]{4,40})(?:&|$)/.exec(q), pay = (/[?&]pay=(ok|fail)(?:&|$)/.exec(q) || [])[1];
  function say(kind, html){ if(!box) return; box.className = 'small sendstatus giftstatus' + (kind ? ' ' + kind : ''); box.innerHTML = html; box.hidden = false; }
  if(om && pay === 'fail'){
    var rf = ssGet(); say('err', esc(O.status.failed));
    if(rf && rf.order === om[1] && !rf.fail){ rf.fail = true; ssSet(rf); track('gift-pay-fail'); }
  } else if(om && pay === 'ok'){
    var rec = ssGet();
    if(!rec || rec.order !== om[1] || !rec.key) say('ok', esc(O.status.thanks));
    else {
      if(!rec.done){ rec.done = true; ssSet(rec); track('gift-pay-done', {order_price: rec.total || 0, currency: cur}); }
      var TX = {'new': ['', O.status.wait], paid: ['ok', O.status.paid], sent: ['ok', O.status.sent], failed: ['err', O.status.failed]}, tries = 0;
      say('', esc(O.status.wait));
      (function ask(){
        fetch(c.endpoint + '/status?order=' + encodeURIComponent(rec.order) + '&key=' + encodeURIComponent(rec.key))
          .then(function(res){ return res.json(); })
          .then(function(j){ var s = j && j.ok ? String(j.status) : '', t = TX[s];
            if(t) say(t[0], esc(t[1]).replace(esc('{email}'), '<span class="ym-hide-content">'+esc(rec.email || '')+'</span>'));
            if((s === 'new' || s === 'paid') && ++tries < 45) setTimeout(ask, 4000); })
          .catch(function(){ if(++tries < 45) setTimeout(ask, 8000); });
      })();
    }
  }
  if(box && !box.hidden && box.scrollIntoView) setTimeout(function(){ box.scrollIntoView({block: 'center'}); }, 50);

  /* форма заказа */
  var f = $('#giftOrder'); if(!f) return;
  var qty = $('#giftQty'), rows = $('#giftRows'), data = [], busy = false, err = $('#giftErr'), payBtn = $('#giftPay');
  function n(){ var v = parseInt(qty.value, 10); return isNaN(v) ? 1 : Math.max(1, Math.min(G.max, v)); }
  function named(){ return f.querySelector('input[name=gnamed]:checked').value === '1'; }
  function each(){ return f.querySelector('input[name=gto]:checked').value === 'each'; }
  function save(){ [].forEach.call(rows.querySelectorAll('.go-row'), function(r, i){ data[i] = data[i] || {}; var a = r.querySelector('.go-nm'), e2 = r.querySelector('.go-e'); if(a) data[i].name = a.value; if(e2) data[i].email = e2.value; }); }
  function attr(s){ return esc(s || ''); }
  function drawRows(skip){
    if(!skip) save();
    var k = n(), nm = named(), ea = each(), show = nm || ea;
    $('#giftRecip').hidden = !show; $('#giftAgreeRow').hidden = !show;
    if(!show) return;
    $('#giftRecipTitle').textContent = nm && ea ? O.recipBoth : nm ? O.recipNames : O.recipEmails;
    $('#giftPasteFmt').textContent = nm && ea ? O.fmtBoth : nm ? O.fmtName : O.fmtEmail;
    $('#giftAgreeText').textContent = nm && ea ? O.agreeBoth : nm ? O.agreeNamed : O.agreeEach;
    var html = '';
    for(var i = 0; i < k; i++){ var d = data[i] || {};
      html += '<div class="go-row' + (nm && ea ? '' : ' one') + '"><span class="go-i">' + (i + 1) + '</span>' +
        (nm ? '<input type="text" class="go-nm ym-disable-keys" maxlength="60" autocomplete="off" placeholder="' + attr(O.namePh) + '" aria-label="' + attr(fill(O.nameAria, {n: i + 1})) + '" value="' + attr(d.name) + '">' : '') +
        (ea ? '<input type="email" class="go-e ym-disable-keys" maxlength="64" autocomplete="off" inputmode="email" placeholder="' + attr(O.emailPh) + '" aria-label="' + attr(fill(O.emailAria, {n: i + 1})) + '" value="' + attr(d.email) + '">' : '') + '</div>';
    }
    rows.innerHTML = html;
  }
  function price(){
    var k = n(), u = unit(k), t = Math.round(k * u * 100) / 100, old = Math.round(k * base * 100) / 100, units = plural(k, O.units);
    [].forEach.call(f.querySelectorAll('.go-chip'), function(x){ x.setAttribute('aria-pressed', String(+x.getAttribute('data-n') === k)); });
    var line = esc(fill(O.line, {n: k, units: units, unit: rub(u), total: '\u0001'})).replace('\u0001', '<b>' + esc(rub(t)) + '</b>');
    if(u < base) line += ' <span class="ok">' + esc(fill(O.off, {pct: G.offPct})) + '</span> <s>' + esc(rub(old)) + '</s>';
    else if(G.offPct > 0 && k < G.offFrom) line += '<br><span class="muted">' + esc(fill(O.addMore, {k: G.offFrom - k, unit: rub(unit(G.offFrom)), pct: G.offPct})) + '</span>';
    $('#giftPrice').innerHTML = line;
    // сводка заказа: в японском число и счётное слово без пробела, перечень — запятой языка («、», арабская «،»)
    var lg = c.L.lang, sep = /^(zh|ja)/.test(lg) ? '、' : lg === 'ar' ? '، ' : ', ';
    $('#giftSumWhat').textContent = k + (lg === 'ja' ? '' : ' ') + units + sep + (named() ? O.sumNamed : O.sumPlain) + sep + (each() ? O.sumEach : O.sumMe);
    $('#giftSumBig').textContent = rub(t);
    $('#giftSumOld').innerHTML = u < base ? '<s class="muted">' + esc(rub(old)) + '</s> <span class="ok">−' + esc(rub(Math.round((old - t) * 100) / 100)) + '</span>' : '';
    if(!busy) payBtn.textContent = fill(O.pay, {total: rub(t)});
    $('#giftEmailHint').textContent = each() ? O.emailHintEach : O.emailHint;
  }
  function live(){ save(); var first = (data[0] && data[0].name) || ''; cert($('#giftLive'), {name: named() ? (first.trim() || O.previewName) : '', from: $('#giftFrom').value.trim(), code: 'XXXX-XXXX-XXXX', url: '#'}); }
  function all(){ qty.value = n(); drawRows(); price(); live(); err.hidden = true; }
  f.addEventListener('click', function(ev){ var b = ev.target.closest('.go-pm,.go-chip'); if(!b) return; qty.value = b.getAttribute('data-n') ? b.getAttribute('data-n') : n() + (+b.getAttribute('data-d')); all(); });
  qty.addEventListener('input', function(){ if(qty.value !== '') all(); });
  qty.addEventListener('blur', all);
  f.addEventListener('change', function(ev){ var nm2 = ev.target.name; if(nm2 === 'gnamed' || nm2 === 'gto') all(); });
  rows.addEventListener('input', function(ev){ ev.target.classList.remove('go-bad'); if(ev.target.classList.contains('go-nm')) live(); });
  $('#giftFrom').addEventListener('input', live);
  $('#giftEmail').addEventListener('input', function(){ this.classList.remove('go-bad'); });
  $('#giftPasteBtn').addEventListener('click', function(){ var p = $('#giftPasteBox'); p.hidden = !p.hidden; if(!p.hidden) $('#giftPasteTa').focus(); });
  $('#giftPasteApply').addEventListener('click', function(){
    var lines = $('#giftPasteTa').value.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean).slice(0, G.max); if(!lines.length) return;
    data = lines.map(function(s){ var p = s.split(/\t|;|,|，|；|、|،|؛/).map(function(x){ return x.trim(); });
      var em = p.filter(function(x){ return /@/.test(x); })[0] || '', nm3 = p.filter(function(x){ return x && !/@/.test(x); }).join(' ');
      return {name: nm3, email: em}; });
    qty.value = lines.length; drawRows(true); price(); live(); $('#giftPasteBox').hidden = true;
  });
  // цена из панели: страница собрана с ценой на момент сборки, сервер оплаты сверяет цену одного сертификата
  function syncBase(){ var d = typeof discOffer === 'function' && discOffer.data, l = d && d.langs && d.langs[c.L.lang];
    var p = l && +l.regular > 0 && cur !== 'RUB' ? +l.regular : d && d.prices && d.prices[cur] && +d.prices[cur].regular; if(p > 0 && p !== base){ base = p; price(); } }
  if(typeof discOffer === 'function'){ discOffer(c.endpoint + '/offer', syncBase); if(typeof discOfferWatch === 'function') discOfferWatch(syncBase); }
  function setBusy(on){ busy = on; payBtn.disabled = on; if(on) payBtn.textContent = O.wait; else price(); }
  window.addEventListener('pageshow', function(ev){ if(ev.persisted) setBusy(false); });

  f.addEventListener('submit', function(ev){
    ev.preventDefault(); if(busy) return; save();
    [].forEach.call(f.querySelectorAll('.go-bad'), function(x){ x.classList.remove('go-bad'); });
    var bad = [], k = n(), nm = named(), ea = each(), em = $('#giftEmail'), email = em.value.trim(), first = null;
    if(email.length > EMAIL_MAX || !EMAIL_RE.test(email)){ em.classList.add('go-bad'); bad.push(O.checkEmail); first = first || em; }
    var recips = [];
    for(var i = 0; i < k; i++){ var d = data[i] || {}; recips.push({name: nm ? String(d.name || '').trim() : '', email: ea ? String(d.email || '').trim() : ''}); }
    if(nm){ var miss = [].filter.call(rows.querySelectorAll('.go-nm'), function(x){ return x.value.trim().length < 2; }); miss.forEach(function(x){ x.classList.add('go-bad'); }); if(miss.length){ bad.push(O.checkNames); first = first || miss[0]; } }
    if(ea){ var me = [].filter.call(rows.querySelectorAll('.go-e'), function(x){ var v = x.value.trim(); return v.length > EMAIL_MAX || !EMAIL_RE.test(v); }); me.forEach(function(x){ x.classList.add('go-bad'); }); if(me.length){ bad.push(O.checkEmails); first = first || me[0]; } }
    var agree = $('#giftAgree');
    if((nm || ea) && !agree.checked){ bad.push(O.checkAgree); first = first || agree; }
    // перечень — по правилам языка («ваш e-mail и имена получателей», «邮箱和收卡人姓名»)
    var list = bad.join(', '); try{ list = new Intl.ListFormat(c.L.dateLocale, {style: 'long', type: 'conjunction'}).format(bad); }catch(e){}
    if(bad.length){ err.textContent = fill(O.check, {what: list}); err.hidden = false; if(first) first.focus(); return; }
    err.hidden = true; setBusy(true); track('gift-buy', {qty: k});
    var u = unit(k), body = {lang: c.L.lang, email: email, qty: k, named: nm, each: ea, from: $('#giftFrom').value.trim(), recipients: (nm || ea) ? recips : [], agree: (nm || ea) ? agree.checked : false, unit: u};
    // Content-Type не задаём: «простой» запрос без предварительного OPTIONS
    fetch(c.endpoint + '/gift/order', {method: 'POST', body: JSON.stringify(body)})
      .then(function(res){ return res.text(); })
      .then(function(txt){ var j = null; try{ j = JSON.parse(txt); }catch(e){}
        if(j && !j.ok && j.error === 'price' && j.price > 0){ base = +j.price; throw new Error('price'); }
        if(!j || !j.ok || !j.url || !j.order) throw new Error((j && j.error) || 'bad response');
        var url = new URL(j.url, location.href);   // платёжная страница: только https (на локальной заглушке — тот же адрес, что у сайта)
        if(url.protocol !== 'https:' && url.origin !== location.origin) throw new Error('bad url');
        ssSet({order: String(j.order), key: String(j.key || ''), email: email, total: Math.round(k * u * 100) / 100});
        track('gift-pay-start'); location.href = url.href; })
      .catch(function(e){ setBusy(false); err.hidden = false; var m = e && e.message;
        if(m === 'price'){ err.textContent = O.priceChanged; }
        else if(m === 'bad email'){ err.textContent = fill(O.check, {what: O.checkEmail}); em.classList.add('go-bad'); em.focus(); }
        else { err.innerHTML = esc(O.error).replace(esc('{email}'), '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>'); track('gift-pay-error', {error: String(m || '').slice(0, 40)}); } });
  });
  all();
}
