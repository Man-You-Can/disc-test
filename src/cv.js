/* Лендинг сервиса «Резюме под каждую вакансию» (/ru/cv/): заявка на ранний доступ (с 2026-10-22, решение заказчика; до этого — заявка на ручную
   услугу в Telegram). Разметку cvFormHTML() кладёт в страницу сборка (build.js) — две одинаковые формы: на первом экране и в конце страницы;
   логику initCvForm() — сама страница. Заявка уходит через форму обратной связи сервера (action 'contact', тот же адрес и та же галочка согласия,
   что на /contact/ и /business/): только имя и e-mail; тема письма владельцу — «Сообщение с сайта …: Заявка на ранний доступ к сервису CV — <имя>».
   Сервер и тексты о данных не менялись: форма обратной связи передаёт имя, e-mail и текст сообщения.
   Цели Метрики: cv-cta — нажата кнопка, ведущая к форме, cv-request — заявка отправлена. */
function cvFormHTML(c, k){
  var T=c.T, esc=c.esc;
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
    '</form>';
}

/* Вкладки блока «Пример: от единого резюме до отклика»: без скрипта все панели видны подряд, со скриптом — одна, переключение мышью и стрелками */
function initCvTabs(){
  // скачивание примеров (карточка-оценка, блок «Готовое CV», блок «CV на английском»): цель cv-sample-<формат>[-en]
  document.querySelectorAll('a[data-dl]').forEach(function(a){ a.addEventListener('click', function(){ if(window.discTrack) window.discTrack('cv-sample-' + a.getAttribute('data-dl')); }); });
  // файлы примера (карточка-оценка и «Готовое резюме»): переключатель «Русский / English», под ним файлы на выбранном языке;
  // без скрипта видны обе строки с подписями языка
  document.querySelectorAll('.cvlangs').forEach(function(box){
    var bs=[].slice.call(box.querySelectorAll('.cvlangsw button')), rows=[].slice.call(box.children).filter(function(r){ return r.hasAttribute('data-l'); });
    box.classList.add('js');
    bs.forEach(function(b,i){ b.addEventListener('click', function(){ bs.forEach(function(x,k){ x.setAttribute('aria-pressed', k===i); if(rows[k]) rows[k].classList.toggle('on', k===i); }); }); });
  });
  var box=document.getElementById('cvEx'); if(!box) return;
  var tabs=[].slice.call(box.querySelectorAll('[role="tab"]')), panels=[].slice.call(box.querySelectorAll('[role="tabpanel"]')),
      ends=[].slice.call(box.querySelectorAll('.cvtabs-end button'));   // те же вкладки в конце блока
  function show(bar, t){ if(t.offsetLeft < bar.scrollLeft || t.offsetLeft + t.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = t.offsetLeft - 8; }
  var more=box.querySelector('.cvexmore button'), cur=0;
  function sel(i, focus){ cur=i; tabs.forEach(function(t,k){ var on=k===i; t.setAttribute('aria-selected', on); t.tabIndex=on?0:-1; panels[k].hidden=!on; if(ends[k]) ends[k].setAttribute('aria-pressed', on); }); if(focus) tabs[i].focus();
    show(tabs[i].parentNode, tabs[i]); if(ends[i]) show(ends[i].parentNode, ends[i]); fit(); }
  // свёрнутый пример (с 2026-10-24, по просьбе заказчика): вкладка выше --cvcut обрезана с затуханием, под ней «Показать полностью»;
  // разворот — сразу для всех вкладок, до перезагрузки страницы
  function fit(){ if(!box.classList.contains('cut')) return; var p=panels[cur], lim=parseFloat(getComputedStyle(box).getPropertyValue('--cvcut'))||520;
    p.classList.remove('over'); var over=p.scrollHeight > lim + 80;   // почти влезающую вкладку не режем
    p.classList.toggle('over', over); box.classList.toggle('over', over); }
  function expand(){ box.classList.remove('cut', 'over'); panels.forEach(function(p){ p.classList.remove('over'); }); if(more) more.setAttribute('aria-expanded', 'true'); }
  if(more){ box.classList.add('cut');
    more.addEventListener('click', function(){ expand(); stop(); panels[cur].focus({preventScroll:true}); if(window.discTrack) window.discTrack('cv-example-more'); });
    // фокус клавиатурой на ссылке или кнопке внутри обрезанной части — разворачиваем, иначе она прокрутится под затуханием
    box.addEventListener('focusin', function(e){ if(panels.indexOf(e.target) < 0 && e.target.closest('.cvpanel.over')) expand(); });
    window.addEventListener('resize', fit); }
  // нижние вкладки: переключают шаг и возвращают к началу блока, чтобы новый шаг читался сверху
  ends.forEach(function(b,i){ b.addEventListener('click', function(){ sel(i); var y=box.getBoundingClientRect().top + window.pageYOffset - 12;
    window.scrollTo({top:y, behavior:'smooth'}); if(window.discTrack) window.discTrack('cv-example'); }); });
  box.classList.add('js'); sel(0);
  // автопереключение вкладок (с 2026-10-24, по просьбе заказчика): по кругу, пока блок на экране и вкладка браузера открыта;
  // под активной вкладкой — полоска-таймер (при «уменьшить движение» в системе она без анимации: общее правило template.html).
  // Любой щелчок или клавиша внутри блока останавливают переключение до перезагрузки страницы
  var DUR=5000, auto=('IntersectionObserver' in window),
      timer=null, left=DUR, t0=0, inView=false;
  function run(){ return auto && inView && !document.hidden; }
  function upd(){ var on=run(); box.classList.toggle('paused', auto && !on);
    if(on && !timer){ t0=Date.now(); timer=setTimeout(function(){ timer=null; left=DUR; sel((cur+1) % tabs.length); upd(); }, left); }
    else if(!on && timer){ clearTimeout(timer); timer=null; left=Math.max(500, left-(Date.now()-t0)); } }
  function stop(){ if(!auto) return; auto=false; upd(); box.classList.remove('auto', 'paused'); }
  if(auto){ box.style.setProperty('--cvdur', DUR+'ms'); box.classList.add('auto', 'paused');
    new IntersectionObserver(function(es){ es.forEach(function(x){ inView = x.isIntersecting && x.intersectionRatio >= 0.4; }); upd(); }, {threshold:[0, 0.4, 0.6]}).observe(box);
    document.addEventListener('visibilitychange', upd);
    box.addEventListener('click', stop); box.addEventListener('keydown', stop); }
  // «Скопировать текст»: текст блока письма по абзацам (через пустую строку); запасной путь — выделение и execCommand
  box.querySelectorAll('.cvcopy').forEach(function(btn){
    var label=btn.textContent, src=btn.parentNode.parentNode.querySelector('.cvcopy-src');
    btn.addEventListener('click', function(){
      var text=[].map.call(src.querySelectorAll('p'), function(p){ return p.textContent.trim(); }).join('\n\n');
      function ok(){ btn.classList.add('done'); btn.textContent=btn.getAttribute('data-copied'); clearTimeout(btn._t);
        btn._t=setTimeout(function(){ btn.classList.remove('done'); btn.textContent=label; }, 2000); if(window.discTrack) window.discTrack('cv-letter-copy'); }
      function fallback(){ var ta=document.createElement('textarea'); ta.value=text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select(); try{ if(document.execCommand('copy')) ok(); }catch(e){} document.body.removeChild(ta); }
      if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
    });
  });
  tabs.forEach(function(t,i){
    t.addEventListener('click', function(){ sel(i); if(window.discTrack) window.discTrack('cv-example'); });
    t.addEventListener('keydown', function(e){ var n=tabs.length, j=e.key==='ArrowRight'?(i+1)%n:e.key==='ArrowLeft'?(i-1+n)%n:e.key==='Home'?0:e.key==='End'?n-1:-1; if(j<0) return; e.preventDefault(); sel(j, true); });
  });
}

function initCvForm(c){
  initCvTabs();
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
          var fl=$('#cvFloat'); if(fl) fl.classList.remove('show'); document.body.classList.remove('has-xbar');
          if(window.discTrack) window.discTrack('cv-request'); })
        .catch(function(err){ var m=String((err&&err.message)||err);
          setStatus('err', /too many|daily limit/.test(m) ? T.tooMany.replace('{contact}', mailLink) : T.sendFailed.replace('{error}', esc(m)).replace('{contact}', mailLink)); })
        .then(function(){ btn.disabled=false; });
    });
  });
  // плашка с кнопкой внизу экрана (с 2026-10-23 — на любой ширине, решение заказчика; стили .xbar — общие, src/template.html):
  // видна, когда первая форма ушла вверх, а последняя ещё не на экране; крестик скрывает её до конца сеанса (sessionStorage disc.cvbar)
  var fl=$('#cvFloat'), first=forms[0], last=forms[forms.length-1];
  if(!fl || !('IntersectionObserver' in window)) return;
  var passed=false, near=false;
  function closed(){ try{ return sessionStorage.getItem('disc.cvbar') === 'off'; }catch(e){ return false; } }
  function upd(){ var on = !sent && !closed() && passed && !near; fl.classList.toggle('show', on); document.body.classList.toggle('has-xbar', on); }
  $('#cvFloatX').addEventListener('click', function(){ try{ sessionStorage.setItem('disc.cvbar', 'off'); }catch(e){} upd(); });
  new IntersectionObserver(function(es){ es.forEach(function(x){ passed = !x.isIntersecting && x.boundingClientRect.top < 0; }); upd(); }).observe(first);
  new IntersectionObserver(function(es){ es.forEach(function(x){ near = x.isIntersecting; }); upd(); }).observe(last);
}
if (typeof module !== 'undefined' && module.exports) module.exports = cvFormHTML;
