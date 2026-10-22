/* Заявка с лендинга «CV и сопроводительное письмо под каждую вакансию» (/ru/cv/, с 2026-10-22, решение заказчика). Разметку cvFormHTML() кладёт
   в страницу сборка (build.js), логику initCvForm() — сама страница. Заявка уходит через форму обратной связи сервера (action 'contact', тот же
   адрес и та же галочка согласия, что на /contact/ и /business/): имя и e-mail — отдельными полями (e-mail сервер требует), Telegram — текстом
   сообщения (должность и ссылка на резюме убраны 2026-10-22 по просьбе заказчика); тема письма владельцу — «Сообщение с сайта …: Заявка на CV под вакансию — <имя>».
   Цели Метрики: cv-cta — нажата кнопка «Оставить заявку», cv-request — заявка отправлена. */
function cvFormHTML(c){
  var T=c.T, esc=c.esc, mailLink = c.email ? '<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>' : '';
  var req='<span class="req" aria-hidden="true">*</span>';
  return '<div class="card contactcard cvformcard">'+
    '<form class="form" id="cvForm" novalidate>'+
      '<p class="hint reqnote">'+esc(T.requiredNote).replace('*', req)+'</p>'+
      '<div class="field"><label for="vName">'+esc(T.name)+req+'</label><input type="text" id="vName" class="ym-disable-keys" autocomplete="name" required maxlength="80"></div>'+
      '<div class="field"><label for="vTg">'+esc(T.telegram)+req+'</label><input type="text" id="vTg" class="ym-disable-keys" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="64" placeholder="'+esc(T.telegramPlaceholder)+'"></div>'+
      '<div class="field"><label for="vEmail">'+esc(T.email)+req+'</label><input type="email" id="vEmail" class="ym-disable-keys" autocomplete="email" inputmode="email" required maxlength="120"></div>'+
      '<div class="hp" aria-hidden="true"><label for="vSite">Website</label><input type="text" id="vSite" tabindex="-1" autocomplete="off"></div>'+
      '<p class="hint">'+esc(T.privacyNote).replace('{email}', mailLink)+'</p>'+
      (c.pdLabel ? '<div class="subbox"><label class="check"><input type="checkbox" id="vPd"><span>'+c.pdLabel+'</span></label></div>' : '')+
      '<p class="small sendstatus" id="vStatus" aria-live="polite" hidden></p>'+
      '<div class="actions"><button class="btn" type="submit" id="vSend">'+esc(T.button)+'</button></div>'+
    '</form>'+
  '</div>';
}

function initCvForm(c){
  var T=c.T, esc=c.esc, $=c.$, L=c.L, form=$('#cvForm'); if(!form) return;
  var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, status=$('#vStatus'), btn=$('#vSend'), toastT;
  // ник в Telegram (@name, t.me/name) или номер телефона
  var TG_RE=/^(?:@?[A-Za-z][A-Za-z0-9_]{3,31}|(?:https?:\/\/)?(?:t|telegram)\.me\/[A-Za-z][A-Za-z0-9_]{3,31}\/?|\+?[0-9][0-9 ()\-]{8,18}[0-9])$/;
  var mailLink = c.email ? '<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>' : '';
  function toast(msg){ var el=$('#toast'); if(!el){ alert(msg); return; } el.textContent=msg; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){ el.hidden=true; }, 3200); }
  function setStatus(kind, html){ status.hidden=false; status.className='small sendstatus'+(kind?' '+kind:''); status.innerHTML=html; }
  function clean(s){ return String(s||'').trim().replace(/\s+/g,' '); }
  document.querySelectorAll('a[href="#request"]').forEach(function(a){ a.addEventListener('click', function(){ if(window.discTrack) window.discTrack('cv-cta'); }); });
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var name=clean($('#vName').value), tg=clean($('#vTg').value), em=$('#vEmail').value.trim();
    if(name.length<2){ $('#vName').focus(); toast(T.nameRequired); return; }
    if(!TG_RE.test(tg)){ $('#vTg').focus(); toast(T.needTelegram); return; }
    if(!EMAIL_RE.test(em)||em.length>120){ $('#vEmail').focus(); toast(T.emailRequired); return; }
    var pd=$('#vPd'); if(pd && !pd.checked){ pd.focus(); toast(T.pdRequired); return; }
    var text=T.subject+'\n'+T.telegram+': '+tg;
    if(!c.endpoint){ location.href='mailto:'+encodeURIComponent(c.email)+'?subject='+encodeURIComponent(T.subject+' — '+name)+'&body='+encodeURIComponent(text+'\n\n'+name+' <'+em+'>\n'); return; }
    var data={action:'contact', token:c.token, lang:L.lang, name:name, email:em, subject:T.subject, message:text.slice(0,5000),
      page:location.href.split('#')[0], hp:$('#vSite').value, files:[]};
    if(pd){ data.consent=true; data.consentV=c.pdVersion||''; }
    btn.disabled=true; setStatus('muted', esc(T.sending));
    // Content-Type не задаём: «простой» запрос без предварительного OPTIONS, как в форме обратной связи
    fetch(c.endpoint, {method:'POST', body:JSON.stringify(data)})
      .then(function(r){ return r.text(); })
      .then(function(txt){ var j=null; try{ j=JSON.parse(txt); }catch(err){} if(!j||!j.ok) throw new Error((j&&j.error)||'bad response');
        setStatus('ok', esc(T.sent));
        if(window.discTrack) window.discTrack('cv-request'); })
      .catch(function(err){ var m=String((err&&err.message)||err);
        setStatus('err', /too many|daily limit/.test(m) ? T.tooMany.replace('{contact}', mailLink) : T.sendFailed.replace('{error}', esc(m)).replace('{contact}', mailLink)); })
      .then(function(){ btn.disabled=false; });
  });
  // закреплённая кнопка «Оставить заявку» на телефоне: видна, когда кнопка первого экрана ушла вверх, а форма и подвал ещё не на экране
  var fl=$('#cvFloat'), top=$('#cvTop'), ends=[form, document.querySelector('.foot')];
  if(!fl || !top || !('IntersectionObserver' in window)) return;
  var passed=false, near=false;
  function upd(){ fl.classList.toggle('show', passed && !near); }
  new IntersectionObserver(function(es){ es.forEach(function(x){ passed = !x.isIntersecting && x.boundingClientRect.top < 0; }); upd(); }).observe(top);
  var io=new IntersectionObserver(function(es){ es.forEach(function(x){ x.target._vis = x.isIntersecting; }); near = ends.some(function(x){ return x && x._vis; }); upd(); });
  ends.forEach(function(x){ if(x) io.observe(x); });
}
if (typeof module !== 'undefined' && module.exports) module.exports = cvFormHTML;
