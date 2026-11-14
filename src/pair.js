/* «DISC на двоих» (/<язык>/pair/, с 2026-11-14, по просьбе заказчика; все языки с покупкой). Одна страница — четыре состояния:
   - без хэша: описание отчёта и кнопка «Пригласить» (если на устройстве есть свой результат — disc.last);
   - #i=<код> — приглашение: пригласивший, кнопка теста (приглашение запоминается в disc.pairInvite — после теста экран результата предложит
     сравнение), а если свой результат уже есть — согласие показать его пригласившему и «Сравнить»;
   - #p=<код>~<код> — сравнение: две диаграммы шкал, строка о паре (summary из content.compatibility.pairs), где близки и где самый большой
     разрыв, «Чего нет в бесплатном сравнении» (content.pair.compare.only), листы образца, форма заказа, ссылка для второго;
   - ?order=PAIR-…&pay=ok|fail — возврат со страницы оплаты (Т-Банк или Prodamus): статус заказа (GET <payEndpoint>/status).
   Коды в ссылках — без e-mail (имя и ответы); хэш с ними убирает из адресной строки dataHash() до загрузки счётчика, в разметку коды не пишутся.
   Заказ — POST <payEndpoint>/pair/order (сервер — private/server/src/pair.js). Цели: pair-invite, pair-open, pair-start, pair-compare, pair-buy,
   pair-pay-start, pair-pay-error, pair-pay-done, pair-pay-fail. */
function initPair(o){
  var T = o.T, esc = o.esc, $ = o.$, lsGet = o.lsGet, lsSet = o.lsSet, BK = o.BK, KEYS = ['D','I','S','C'];
  var fmt = function(s, v){ return String(s).replace(/\{(\w+)\}/g, function(m, k){ return v && k in v ? v[k] : m; }); };
  var track = function(g, p){ if(window.discTrack) window.discTrack(g, p); };
  // число по правилам языка (o.loc); знак валюты — в самих строках («{price} ₽», «US${price}») и в записи цены языка o.money (content.services.price)
  var num = function(n){ try{ return new Intl.NumberFormat(o.loc || 'ru-RU', n % 1 ? {minimumFractionDigits: 2, maximumFractionDigits: 2} : {}).format(n); }catch(e){ return String(n); } };
  var money = function(n){ return String(o.money || '{price}').replace('{price}', num(n)).replace(/ /g, '\u00a0'); };

  /* ---- код результата: разбор, подсчёт, профиль (как decodeResult, score, classify на главной) ---- */
  function decode(code){
    var m = /^DISC1\.([A-Za-z0-9_-]+)$/.exec(String(code || ''));
    if(!m) return null;
    try{
      var b = m[1].replace(/-/g,'+').replace(/_/g,'/'); while(b.length % 4) b += '=';
      var j = JSON.parse(decodeURIComponent(escape(atob(b))));
      if(typeof j.n !== 'string' || !/^[0-3]{24}$/.test(j.m) || !/^[0-3]{24}$/.test(j.l)) return null;
      var mm = j.m.split('').map(Number), ll = j.l.split('').map(Number);
      for(var i = 0; i < 24; i++) if(mm[i] === ll[i]) return null;
      return {name: j.n.slice(0,80), pos: String(j.p || '').slice(0,80), t: String(j.t || ''), m: mm, l: ll};
    }catch(e){ return null; }
  }
  function encode(r){   // код без e-mail: для ссылок приглашения и сравнения
    var s = JSON.stringify({n: r.name || '', e: '', p: r.pos || '', t: r.t, m: r.m.join(''), l: r.l.join('')});
    return 'DISC1.' + btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function score(r){
    var most = {D:0,I:0,S:0,C:0}, least = {D:0,I:0,S:0,C:0}, net = {}, pct = {};
    for(var i = 0; i < 24; i++){ most[BK[i][r.m[i]]]++; least[BK[i][r.l[i]]]++; }
    KEYS.forEach(function(k){ net[k] = most[k] - least[k]; pct[k] = Math.round((net[k] + 24) / 48 * 100); });
    var ord = KEYS.slice().sort(function(a,b){ return net[b] - net[a]; }), p = ord[0], s = ord[1];
    var sec = net[s] > 0 && net[s] >= Math.max(3, Math.round(net[p] * 0.4));
    return {net: net, pct: pct, lead: p, key: p + (sec ? s : '')};
  }
  var same = function(a, b){ return a && b && a.t === b.t && a.m.join('') === b.m.join('') && a.l.join('') === b.l.join(''); };
  var profileName = function(sc){ return (o.profiles[sc.key] || {}).name || sc.key; };
  var myResult = function(){ var r = lsGet('disc.last'); return r && r.m && r.l && r.t ? {name: String(r.name || ''), pos: r.pos || '', t: r.t, m: [].concat(r.m), l: [].concat(r.l)} : null; };
  var pageUrl = location.origin + location.pathname;

  /* ---- отправка ссылки: «Поделиться» (телефон), Telegram, WhatsApp, «Скопировать» ---- */
  function shareBox(box, link, msg, goal){
    var e = encodeURIComponent;
    box.innerHTML = '<div class="pr-share">' + (navigator.share ? '<button class="btn" type="button" data-s="native">' + esc(T.compare.share) + '</button>' : '') +
      '<button class="btn' + (navigator.share ? ' secondary' : '') + '" type="button" data-s="copy">' + esc(T.compare.copy) + '</button>' +
      '<a class="btn secondary" target="_blank" rel="noopener" data-s="telegram" href="https://t.me/share/url?url=' + e(link) + '&text=' + e(msg) + '">Telegram</a>' +
      '<a class="btn secondary" target="_blank" rel="noopener" data-s="whatsapp" href="https://wa.me/?text=' + e(msg + ' ' + link) + '">WhatsApp</a></div>' +
      '<p class="small pr-copied" aria-live="polite" hidden>' + esc(T.compare.copied) + '</p>';
    box.querySelectorAll('[data-s]').forEach(function(b){
      b.addEventListener('click', function(){
        var how = b.getAttribute('data-s');
        track(goal, {share: how});
        if(how === 'native'){ navigator.share({text: msg, url: link}).catch(function(){}); }
        if(how === 'copy'){
          var done = function(){ var c = box.querySelector('.pr-copied'); c.hidden = false; setTimeout(function(){ c.hidden = true; }, 3000); };
          if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function(){ window.prompt('', link); });
          else window.prompt('', link);
        }
      });
    });
  }
  var inviteLink = function(r){ return pageUrl + '?ref=pair#i=' + encode(r); };

  /* ---- без хэша: «Пригласить» ---- */
  function landing(){
    var box = $('#pairInviteBox'); if(!box) return;
    var me = myResult();
    if(!me){ box.innerHTML = '<p>' + esc(T.inviteNoTest) + '</p><p><a class="btn" href="' + o.home + '#test">' + esc(T.ctaTest) + '</a></p>'; return; }
    box.innerHTML = '<p>' + esc(T.inviteText) + '</p><div id="pairInviteShare"></div>';
    shareBox($('#pairInviteShare'), inviteLink(me), fmt(T.inviteMsg, {name: me.name || ''}), 'pair-invite');
  }

  /* ---- #i= приглашение ---- */
  function invite(code){
    var sec = $('#pairInvite'), a = decode(code);
    sec.hidden = false;
    if(!a){ sec.innerHTML = '<p class="err">' + esc(T.invite.bad) + '</p>'; return; }
    var sa = score(a), me = myResult();
    track('pair-open', {via: 'invite'});
    $('#piTitle').textContent = fmt(T.invite.title, {name: a.name});
    $('#piProfile').textContent = fmt(T.invite.profile, {name: a.name, profile: profileName(sa)});
    $('#piStart').addEventListener('click', function(){
      lsSet('disc.pairInvite', {c: encode(a), at: Date.now()});
      track('pair-start');
    });
    if(me && !same(me, a)){
      var have = $('#piHave'); have.hidden = false;
      $('#piConsentText').textContent = fmt(T.invite.consent, {name: a.name});
      $('#piCompare').addEventListener('click', function(){
        if(!$('#piConsent').checked){ $('#piErr').textContent = T.invite.needConsent; $('#piErr').hidden = false; return; }
        track('pair-compare', {via: 'page'});
        lsSet('disc.pairInvite', null);
        compare(encode(a), encode(me), true);
        window.scrollTo(0, 0);
      });
    }
    if(me && same(me, a)){   // своё же приглашение — отправить его другому
      $('#piHave').hidden = false;
      $('#piHave').innerHTML = '<p>' + esc(T.inviteText) + '</p><div id="piOwnShare"></div>';
      shareBox($('#piOwnShare'), inviteLink(me), fmt(T.inviteMsg, {name: me.name || ''}), 'pair-invite');
    }
  }

  /* ---- #p= сравнение и заказ ---- */
  function bars(sa, sb){
    var pct = function(n){ return fmt(T.compare.pct, {n: n}); };
    return '<div class="pr-cmp" role="img" aria-label="' + esc(KEYS.map(function(k){ return fmt(T.compare.aria, {k: k, a: sa.pct[k], b: sb.pct[k]}); }).join('; ')) + '">' +
      KEYS.map(function(k){
        return '<div class="pr-row ' + k + '"><span class="k">' + k + '</span><span class="pr-pair">' +
          '<span class="pr-bar m"><span class="tr"><i style="width:' + sa.pct[k] + '%"></i></span><span class="v">' + pct(sa.pct[k]) + '</span></span>' +
          '<span class="pr-bar l"><span class="tr"><i style="width:' + sb.pct[k] + '%"></i></span><span class="v">' + pct(sb.pct[k]) + '</span></span></span></div>';
      }).join('') + '</div>';
  }
  function compare(ca, cb, fresh){
    var sec = $('#pairCompare'), a = decode(ca), b = decode(cb);
    $('#pairInvite').hidden = true; $('#pairLanding').hidden = true; sec.hidden = false;
    if(!a || !b){ sec.innerHTML = '<p class="err">' + esc(T.compare.bad) + '</p>'; return; }
    if(same(a, b)){ sec.innerHTML = '<p class="err">' + esc(T.compare.same) + '</p>'; return; }
    var sa = score(a), sb = score(b);
    if(!fresh) track('pair-open', {via: 'compare'});
    var pk = [sa.lead, sb.lead].sort(function(x, y){ return KEYS.indexOf(x) - KEYS.indexOf(y); }).join(''), P = o.pairs[pk] || {};
    var near = KEYS.filter(function(k){ return Math.abs(sa.pct[k] - sb.pct[k]) <= 15; });
    $('#pcTitle').textContent = fmt(T.compare.title, {a: a.name, b: b.name});
    $('#pcChart').innerHTML = bars(sa, sb);
    $('#pcLegend').textContent = fmt(T.compare.legend, {a: a.name, b: b.name});
    $('#pcProfiles').innerHTML = [[a, sa], [b, sb]].map(function(x){ return '<li><b>' + esc(x[0].name) + '</b> — ' + esc(fmt(T.compare.profile, {key: x[1].key, name: profileName(x[1])})) + '</li>'; }).join('');
    $('#pcSummary').textContent = P.summary || '';   // только затравка: полное описание пары — на страницах совместимости
    $('#pcClose').textContent = near.length ? fmt(T.compare.close, {list: near.length > 1 ? near.slice(0, -1).join(T.compare.sep) + T.compare.and + near[near.length - 1] : near[0]}) : T.compare.closeNone;
    var diff = function(k){ return Math.abs(sa.pct[k] - sb.pct[k]); };   // самый большой разрыв по шкалам
    var gk = KEYS.slice().sort(function(x, y){ return diff(y) - diff(x); })[0], gd = diff(gk);
    $('#pcGap').textContent = fmt(gd > 15 ? T.compare.gap : T.compare.gapSmall, {k: gk, a: a.name, b: b.name, pa: sa.pct[gk], pb: sb.pct[gk]});
    var link = pageUrl + '#p=' + encode(a) + '~' + encode(b);
    shareBox($('#pcShare'), link, fmt(T.compare.shareMsg, {title: fmt(T.compare.title, {a: a.name, b: b.name})}), 'pair-share');
    orderForm(encode(a), encode(b), a, b);
  }
  function orderForm(ca, cb, a, b){
    var O = T.order, price = o.price, form = $('#pairOrder'), err = $('#poErr'), btn = $('#poPay');
    var who = lsGet('disc.who'); if(who && who.email && !$('#poEmail').value) $('#poEmail').value = who.email;
    $('#poLeadA').nextElementSibling.textContent = a.name; $('#poLeadB').nextElementSibling.textContent = b.name;
    var setBtn = function(){ btn.textContent = fmt(O.buy, {price: num(price)}); $('#poPrice').textContent = money(price); };
    setBtn();
    form.querySelectorAll('input[name="porel"]').forEach(function(r){ r.addEventListener('change', function(){ $('#poLead').hidden = form.querySelector('input[name="porel"]:checked').value !== 'boss'; }); });
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, say = function(s){ err.textContent = s; err.hidden = !s; };
    form.addEventListener('submit', function(ev){
      ev.preventDefault(); say('');
      var email = $('#poEmail').value.trim(), copy = $('#poCopy').value.trim(), rel = (form.querySelector('input[name="porel"]:checked') || {}).value || '';
      var lead = rel === 'boss' ? ((form.querySelector('input[name="polead"]:checked') || {}).value || '') : '';
      if(!EMAIL.test(email) || email.length > 64) return say(O.badEmail);
      if(copy && (!EMAIL.test(copy) || copy.length > 64)) return say(O.badCopy);
      if(rel === 'boss' && !lead) return say(O.needLead);
      if(!$('#poAgree').checked) return say(O.needAgree);
      btn.disabled = true; btn.textContent = O.wait; track('pair-buy', {rel: rel || 'none'});
      fetch(o.endpoint + '/pair/order', {method: 'POST', body: JSON.stringify({lang: o.lang, a: ca, b: cb, email: email, copy: copy, rel: rel, lead: lead, agree: true, price: price})})
        .then(function(r){ return r.json(); })
        .then(function(j){
          if(j && j.ok && j.url && (/^https:\/\//.test(j.url) || j.url.indexOf(location.origin) === 0)){
            try{ sessionStorage.setItem('disc.pairpay', JSON.stringify({order: j.order, key: j.key})); }catch(e){}
            track('pair-pay-start');
            location.href = j.url; return;
          }
          btn.disabled = false;
          if(j && j.error === 'price' && j.price){ price = j.price; setBtn(); return say(fmt(O.priceChanged, {price: num(price)})); }
          setBtn(); track('pair-pay-error', {error: (j && j.error) || 'unknown'});
          say(j && j.error === 'bad email' ? O.badEmail : j && j.error === 'bad copy' ? O.badCopy : fmt(O.error, {email: o.email}));
        })
        .catch(function(){ btn.disabled = false; setBtn(); track('pair-pay-error', {error: 'network'}); say(fmt(O.error, {email: o.email})); });
    });
  }

  /* ---- возврат со страницы банка ---- */
  function status(order, pay){
    var S = T.status, box = $('#pairStatus'), saved = null;
    try{ saved = JSON.parse(sessionStorage.getItem('disc.pairpay') || 'null'); }catch(e){}
    box.hidden = false;
    var show = function(s, cls){ box.textContent = s; box.className = 'pr-status ' + (cls || ''); };
    if(pay === 'fail'){ show(S.fail, 'err'); track('pair-pay-fail'); return; }
    if(!saved || saved.order !== order){ show(fmt(S.unknown, {email: o.email})); return; }
    show(S.wait);
    var tries = 0;
    (function ask(){
      fetch(o.endpoint + '/status?order=' + encodeURIComponent(order) + '&key=' + encodeURIComponent(saved.key)).then(function(r){ return r.json(); }).then(function(j){
        var st = j && j.status;
        if(st === 'paid' || st === 'sent'){
          show(st === 'sent' ? S.sent : S.ok, 'ok');
          if(lsGet('disc.pairDone') !== order){ lsSet('disc.pairDone', order); track('pair-pay-done', {order_price: o.price, currency: o.cur || 'RUB'}); }
          return;
        }
        if(st === 'failed'){ show(S.fail, 'err'); track('pair-pay-fail'); return; }
        if(++tries < 12) return setTimeout(ask, 2500);
        show(fmt(S.unknown, {email: o.email}));
      }).catch(function(){ if(++tries < 12) setTimeout(ask, 2500); else show(fmt(S.unknown, {email: o.email})); });
    })();
  }

  var q = new URLSearchParams(location.search), h = typeof dataHash === 'function' ? dataHash() : '';
  var mi = /^#i=(DISC1\.[A-Za-z0-9_-]+)$/.exec(h), mp = /^#p=(DISC1\.[A-Za-z0-9_-]+)~(DISC1\.[A-Za-z0-9_-]+)$/.exec(h);
  if(/^PAIR-[A-Z0-9-]{6,30}$/.test(q.get('order') || '')) status(q.get('order'), q.get('pay'));
  if(mp) compare(mp[1], mp[2], false);
  else if(mi){ invite(mi[1]); landing(); }
  else landing();
}
