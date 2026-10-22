/* Лендинг сервиса «Резюме под каждую вакансию» (/ru/cv/): заявка на ранний доступ (с 2026-10-22, решение заказчика; до этого — заявка на ручную
   услугу в Telegram). Разметку cvFormHTML() кладёт в страницу сборка (build.js) — две одинаковые формы: на первом экране и в конце страницы;
   логику initCvForm() — сама страница. Заявка уходит через форму обратной связи сервера (action 'contact', тот же адрес и та же галочка согласия,
   что на /contact/ и /business/): только имя и e-mail; тема письма владельцу — «Сообщение с сайта …: Заявка на ранний доступ к сервису CV — <имя>».
   Сервер и тексты о данных не менялись: форма обратной связи передаёт имя, e-mail и текст сообщения.
   Цели Метрики: cv-cta — нажата кнопка, ведущая к форме, cv-request — заявка отправлена. */
function cvFormHTML(c, k){
  var T=c.T, esc=c.esc, mailLink = c.email ? '<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>' : '';
  var req='<span class="req" aria-hidden="true">*</span>';
  return '<form class="form cvform" id="cvForm'+k+'" data-k="'+k+'" novalidate>'+
      '<div class="cvfields">'+
        '<div class="field"><label for="vName'+k+'">'+esc(T.name)+req+'</label><input type="text" id="vName'+k+'" class="ym-disable-keys" autocomplete="name" required maxlength="80"></div>'+
        '<div class="field"><label for="vEmail'+k+'">'+esc(T.email)+req+'</label><input type="email" id="vEmail'+k+'" class="ym-disable-keys" autocomplete="email" inputmode="email" required maxlength="120"></div>'+
      '</div>'+
      '<div class="hp" aria-hidden="true"><label for="vSite'+k+'">Website</label><input type="text" id="vSite'+k+'" tabindex="-1" autocomplete="off"></div>'+
      (c.pdLabel ? '<div class="subbox"><label class="check"><input type="checkbox" id="vPd'+k+'"><span>'+c.pdLabel+'</span></label></div>' : '')+
      '<p class="small sendstatus" id="vStatus'+k+'" aria-live="polite" hidden></p>'+
      '<div class="actions"><button class="btn cvsubmit" type="submit" id="vSend'+k+'">'+esc(T.button)+'</button></div>'+
      '<p class="hint cvprivacy">'+esc(T.privacyNote).replace('{email}', mailLink)+'</p>'+
    '</form>';
}

function initCvForm(c){
  var T=c.T, esc=c.esc, $=c.$, L=c.L, forms=document.querySelectorAll('form.cvform'); if(!forms.length) return;
  var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, toastT, sent=false;
  var mailLink = c.email ? '<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>' : '';
  function toast(msg){ var el=$('#toast'); if(!el){ alert(msg); return; } el.textContent=msg; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){ el.hidden=true; }, 3200); }
  function clean(s){ return String(s||'').trim().replace(/\s+/g,' '); }
  document.querySelectorAll('a[data-cta]').forEach(function(a){ a.addEventListener('click', function(){ if(window.discTrack) window.discTrack('cv-cta'); }); });
  forms.forEach(function(form){
    var k=form.getAttribute('data-k'), g=function(id){ return document.getElementById(id+k); }, status=g('vStatus'), btn=g('vSend');
    function setStatus(kind, html){ status.hidden=false; status.className='small sendstatus'+(kind?' '+kind:''); status.innerHTML=html; }
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name=clean(g('vName').value), em=g('vEmail').value.trim();
      if(name.length<2){ g('vName').focus(); toast(T.nameRequired); return; }
      if(!EMAIL_RE.test(em)||em.length>120){ g('vEmail').focus(); toast(T.emailRequired); return; }
      var pd=g('vPd'); if(pd && !pd.checked){ pd.focus(); toast(T.pdRequired); return; }
      if(!c.endpoint){ location.href='mailto:'+encodeURIComponent(c.email)+'?subject='+encodeURIComponent(T.subject+' — '+name)+'&body='+encodeURIComponent(T.message+'\n\n'+name+' <'+em+'>\n'); return; }
      var data={action:'contact', token:c.token, lang:L.lang, name:name, email:em, subject:T.subject, message:T.message.slice(0,5000),
        page:location.href.split('#')[0], hp:g('vSite').value, files:[]};
      if(pd){ data.consent=true; data.consentV=c.pdVersion||''; }
      btn.disabled=true; setStatus('muted', esc(T.sending));
      // Content-Type не задаём: «простой» запрос без предварительного OPTIONS, как в форме обратной связи
      fetch(c.endpoint, {method:'POST', body:JSON.stringify(data)})
        .then(function(r){ return r.text(); })
        .then(function(txt){ var j=null; try{ j=JSON.parse(txt); }catch(err){} if(!j||!j.ok) throw new Error((j&&j.error)||'bad response');
          // после заявки обе формы заменяются подтверждением, закреплённая кнопка больше не нужна
          sent=true; forms.forEach(function(f){ var d=document.createElement('div'); d.className='cvdone'; d.setAttribute('role','status');
            d.innerHTML='<strong>'+esc(T.sentTitle)+'</strong><p>'+esc(T.sent)+'</p>'; f.replaceWith(d); });
          var fl=$('#cvFloat'); if(fl) fl.classList.remove('show');
          if(window.discTrack) window.discTrack('cv-request'); })
        .catch(function(err){ var m=String((err&&err.message)||err);
          setStatus('err', /too many|daily limit/.test(m) ? T.tooMany.replace('{contact}', mailLink) : T.sendFailed.replace('{error}', esc(m)).replace('{contact}', mailLink)); })
        .then(function(){ btn.disabled=false; });
    });
  });
  // закреплённая кнопка на телефоне: видна, когда первая форма ушла вверх, а последняя ещё не на экране
  var fl=$('#cvFloat'), first=forms[0], last=forms[forms.length-1];
  if(!fl || !('IntersectionObserver' in window)) return;
  var passed=false, near=false;
  function upd(){ fl.classList.toggle('show', !sent && passed && !near); }
  new IntersectionObserver(function(es){ es.forEach(function(x){ passed = !x.isIntersecting && x.boundingClientRect.top < 0; }); upd(); }).observe(first);
  new IntersectionObserver(function(es){ es.forEach(function(x){ near = x.isIntersecting; }); upd(); }).observe(last);
}
if (typeof module !== 'undefined' && module.exports) module.exports = cvFormHTML;
