/* Форма обратной связи (страница /contact/). Разметку contactHTML() использует сборка (build.js кладёт
   готовый HTML в страницу, чтобы форма была видна и поисковикам, и без JavaScript), логику initContact() —
   сама страница: список файлов, ограничение общего размера, отправка на Google Apps Script, который шлёт
   письмо на адрес feedbackEmail из site.config.json. Пока sendEndpoint не задан, кнопка «Отправить»
   открывает почтовый клиент (mailto:), а файлы участник прикладывает в письме сам.
   Длинные имена файлов показываются как «начало…конец»: имя разбито на два <span>, первый сжимается с
   многоточием, второй (хвост с расширением) не сжимается — так обрезка подстраивается под ширину экрана. */
function contactHTML(c){
  var t=c.t, esc=c.esc, email=c.email||'', maxLabel=c.maxLabel||'10 MB';
  var mailLink = email ? '<a href="mailto:'+esc(email)+'">'+esc(email)+'</a>' : '';
  return '<div class="eyebrow">DISC</div>'+
    '<h1>'+esc(c.h1)+'</h1>'+
    '<p class="lead">'+esc(c.lead)+'</p>'+
    '<div class="card contactcard">'+
      '<form class="form" id="contactForm" novalidate>'+
        '<p class="hint reqnote">'+t('intro.requiredNote').replace('*','<span class="req" aria-hidden="true">*</span>')+'</p>'+
        '<div class="field"><label for="cName">'+t('intro.nameLabel')+'<span class="req" aria-hidden="true">*</span></label><input type="text" id="cName" name="name" class="ym-disable-keys" autocomplete="name" required maxlength="80"></div>'+
        '<div class="field"><label for="cEmail">'+t('contact.emailLabel')+'<span class="req" aria-hidden="true">*</span></label><input type="email" id="cEmail" name="email" class="ym-disable-keys" autocomplete="email" inputmode="email" required maxlength="120"></div>'+
        '<div class="field"><label for="cMsg">'+t('contact.messageLabel')+'<span class="req" aria-hidden="true">*</span></label><textarea id="cMsg" name="message" class="msgbox ym-disable-keys" required maxlength="5000" rows="6"></textarea></div>'+
        '<div class="field" id="cFilesField"><label for="cFiles">'+t('contact.filesLabel')+'</label>'+
          '<div class="dropzone" id="cDrop"><input type="file" id="cFiles" multiple hidden><button type="button" class="btn secondary small" id="cPick">'+t('contact.filesAdd')+'</button><span class="hint">'+t('contact.filesHint',{max:maxLabel})+'</span></div>'+
          '<ul class="filelist" id="cList" hidden></ul><span class="hint" id="cTotal" hidden></span></div>'+
        '<div class="hp" aria-hidden="true"><label for="cSite">Website</label><input type="text" id="cSite" name="website" tabindex="-1" autocomplete="off"></div>'+
        '<p class="hint">'+t('contact.privacyNote',{email:mailLink})+'</p>'+
        '<p class="small sendstatus" id="cStatus" aria-live="polite" hidden></p>'+
        '<div class="actions"><button class="btn" type="submit" id="cSend">'+t('contact.send')+'</button></div>'+
      '</form>'+
    '</div>'+
    (email ? '<p class="small muted contactdirect">'+t('contact.direct',{email:mailLink})+'</p>' : '');
}

function initContact(c){
  var t=c.t, esc=c.esc, $=c.$, L=c.L, endpoint=c.endpoint||'', token=c.token||'', email=c.email||'', MAX=c.maxBytes||10*1024*1024;
  var form=$('#contactForm'); if(!form) return;
  var input=$('#cFiles'), list=$('#cList'), total=$('#cTotal'), drop=$('#cDrop'), status=$('#cStatus'), sendBtn=$('#cSend');
  var files=[]; // выбранные объекты File
  var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var toastT;
  function toast(msg){ var el=$('#toast'); if(!el){ alert(msg); return; } el.textContent=msg; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){ el.hidden=true; }, 3200); }
  function fmtSize(b){
    var v, u;
    if(b>=1048576){ v=b/1048576; u=t('contact.mb'); } else { v=Math.max(1, b/1024); u=t('contact.kb'); }
    var s; try{ s=v.toLocaleString(L.dateLocale+'-u-nu-latn',{maximumFractionDigits: v>=100?0:1}); }catch(e){ s=String(Math.round(v*10)/10); } // латинские цифры и локальный разделитель дробей
    return s+' '+u;
  }
  var maxLabel=fmtSize(MAX);
  function directLink(){ return email ? '<a href="mailto:'+esc(email)+'">'+esc(email)+'</a>' : ''; }
  function setStatus(kind, html){ status.hidden=false; status.className='small sendstatus'+(kind?' '+kind:''); status.innerHTML=html; }

  /* имя файла → {a: начало, b: хвост}; хвост — последние ~10 символов вместе с расширением, он всегда виден */
  function graphemes(s){
    try{ if(window.Intl && Intl.Segmenter) return Array.from(new Intl.Segmenter().segment(s), function(x){ return x.segment; }); }catch(e){}
    return Array.from ? Array.from(s) : s.split('');
  }
  function splitName(name){
    var g=graphemes(name), dot=-1;
    for(var i=g.length-1;i>0;i--){ if(g[i]==='.'){ dot=i; break; } }
    var tail=Math.max(10, dot>0 ? g.length-dot+4 : 0);
    if(g.length<=tail) return {a:'', b:name};
    return {a:g.slice(0, g.length-tail).join(''), b:g.slice(g.length-tail).join('')};
  }
  function sum(){ return files.reduce(function(s,f){ return s+f.size; },0); }
  function render(){
    if(!files.length){ list.hidden=true; total.hidden=true; list.innerHTML=''; return; }
    list.innerHTML=files.map(function(f,i){
      var p=splitName(f.name);
      return '<li><span class="fname" dir="auto" title="'+esc(f.name)+'">'+(p.a?'<span class="a">'+esc(p.a)+'</span>':'')+'<span class="b">'+esc(p.b)+'</span></span>'+
        '<span class="fsize">'+fmtSize(f.size)+'</span>'+
        '<button type="button" class="fdel" data-i="'+i+'" aria-label="'+esc(t('contact.fileRemove',{name:f.name}))+'">×</button></li>';
    }).join('');
    list.hidden=false;
    total.textContent=t('contact.filesTotal',{size:fmtSize(sum()), max:maxLabel}); total.hidden=false;
    list.querySelectorAll('.fdel').forEach(function(b){ b.addEventListener('click', function(){ files.splice(+b.getAttribute('data-i'),1); render(); }); });
  }
  function add(fl){
    var skipped=null;
    Array.prototype.forEach.call(fl||[], function(f){
      if(!f||!f.name) return;
      if(files.some(function(x){ return x.name===f.name && x.size===f.size && x.lastModified===f.lastModified; })) return; // уже в списке
      if(sum()+f.size>MAX){ if(!skipped) skipped=f.name; return; }
      files.push(f);
    });
    render();
    if(skipped) toast(t('contact.fileSkipped',{name:skipped, max:maxLabel}));
  }
  $('#cPick').addEventListener('click', function(){ input.click(); });
  drop.addEventListener('click', function(e){ if(e.target===drop||e.target.classList.contains('hint')) input.click(); });
  input.addEventListener('change', function(){ add(input.files); input.value=''; });
  ['dragenter','dragover'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave','drop'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function(e){ if(e.dataTransfer) add(e.dataTransfer.files); });

  function readFile(f){
    return new Promise(function(resolve, reject){
      var rd=new FileReader();
      rd.onload=function(){ var s=String(rd.result||''); resolve({name:f.name, type:f.type||'application/octet-stream', data:s.slice(s.indexOf(',')+1)}); };
      rd.onerror=function(){ reject(new Error('read failed')); };
      rd.readAsDataURL(f);
    });
  }
  function postJSON(url, data){
    return new Promise(function(resolve, reject){
      var ctrl=window.AbortController ? new AbortController() : null, done=false;
      var tm=setTimeout(function(){ if(done) return; done=true; if(ctrl) ctrl.abort(); reject(new Error('timeout')); }, 120000);
      // Content-Type не задаём: «простой» запрос без preflight, который принимает Google Apps Script
      fetch(url, {method:'POST', body:JSON.stringify(data), signal: ctrl?ctrl.signal:undefined, redirect:'follow'})
        .then(function(res){ return res.text(); })
        .then(function(txt){ if(done) return; done=true; clearTimeout(tm); var j=null; try{ j=JSON.parse(txt); }catch(e){}
          if(j&&j.ok) resolve(j); else reject(new Error((j&&j.error)||'bad response')); })
        .catch(function(err){ if(done) return; done=true; clearTimeout(tm); reject(err); });
    });
  }

  if(!endpoint) setStatus('muted', t('contact.mailtoNote'));
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var name=$('#cName').value.trim().replace(/\s+/g,' '), em=$('#cEmail').value.trim(), msg=$('#cMsg').value.trim();
    if(name.length<2){ $('#cName').focus(); toast(t('intro.nameRequired')); return; }
    if(!EMAIL_RE.test(em)||em.length>120){ $('#cEmail').focus(); toast(t('intro.emailRequired')); return; }
    if(!msg){ $('#cMsg').focus(); toast(t('contact.messageRequired')); return; }
    if(!endpoint){ // сервис отправки не подключён — открываем почтовый клиент
      var body=msg+(files.length ? '\r\n\r\n'+t('contact.mailFiles',{list:files.map(function(f){ return f.name; }).join(', ')}) : '')+'\r\n\r\n'+name+' <'+em+'>\r\n';
      location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(t('contact.mailSubject',{name:name}))+'&body='+encodeURIComponent(body);
      return;
    }
    sendBtn.disabled=true; setStatus('muted', esc(t('contact.sending')));
    Promise.all(files.map(readFile)).then(function(payload){
      return postJSON(endpoint, {action:'contact', token:token, lang:L.lang, name:name, email:em, message:msg, page:location.href.split('#')[0], hp:$('#cSite').value, files:payload});
    }).then(function(){
      setStatus('ok', esc(t('contact.sent',{email:em})));
      $('#cMsg').value=''; files=[]; render();
      if(window.discTrack) window.discTrack('contact'); // цель Метрики: сообщение отправлено
    }, function(err){
      var m=String((err&&err.message)||err);
      setStatus('err', /too many|daily limit/.test(m) ? t('contact.tooMany',{contact:directLink()}) : t('contact.sendFailed',{error:esc(m), contact:directLink()}));
    }).then(function(){ sendBtn.disabled=false; });
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = contactHTML;
