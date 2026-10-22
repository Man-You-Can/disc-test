/* Заявка со страницы «Для организаций» (/business/). Разметку businessHTML() кладёт в страницу сборка (build.js), логику initBusiness() —
   сама страница. Заявка уходит через форму обратной связи сервера (action 'contact', тот же адрес и та же галочка согласия, что на /contact/):
   имя и e-mail — отдельными полями, организация, число людей, что интересует и комментарий — текстом сообщения; тема письма владельцу —
   «Заявка для организации: <организация>». Цель Метрики business-request — заявка отправлена. */
function businessHTML(c){
  var T=c.T, esc=c.esc, mailLink = c.email ? '<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>' : '';
  var req='<span class="req" aria-hidden="true">*</span>';
  return '<div class="card contactcard bizcard">'+
    '<form class="form" id="bizForm" novalidate>'+
      '<p class="hint reqnote">'+esc(T.requiredNote).replace('*', req)+'</p>'+
      '<div class="field"><label for="bName">'+esc(T.name)+req+'</label><input type="text" id="bName" class="ym-disable-keys" autocomplete="name" required maxlength="80"></div>'+
      '<div class="field"><label for="bEmail">'+esc(T.email)+req+'</label><input type="email" id="bEmail" class="ym-disable-keys" autocomplete="email" inputmode="email" required maxlength="120"></div>'+
      '<div class="field"><label for="bCompany">'+esc(T.company)+req+'</label><input type="text" id="bCompany" autocomplete="organization" required maxlength="120"></div>'+
      '<div class="field"><label for="bSize">'+esc(T.size)+'</label><select id="bSize"><option value=""></option>'+
        T.sizes.map(function(x){ return '<option>'+esc(x)+'</option>'; }).join('')+'</select></div>'+
      '<fieldset class="field bizint"><legend>'+esc(T.interest)+req+'</legend>'+
        T.interests.map(function(x, i){ return '<label class="check"><input type="checkbox" name="interest" value="'+i+'"><span>'+esc(x)+'</span></label>'; }).join('')+'</fieldset>'+
      '<div class="field"><label for="bMsg">'+esc(T.comment)+'</label><textarea id="bMsg" class="msgbox ym-disable-keys" maxlength="4000" rows="4" placeholder="'+esc(T.commentPlaceholder)+'"></textarea></div>'+
      '<div class="hp" aria-hidden="true"><label for="bSite">Website</label><input type="text" id="bSite" tabindex="-1" autocomplete="off"></div>'+
      '<p class="hint">'+esc(T.privacyNote).replace('{email}', mailLink)+'</p>'+
      (c.pdLabel ? '<div class="subbox"><label class="check"><input type="checkbox" id="bPd"><span>'+c.pdLabel+'</span></label></div>' : '')+
      '<p class="small sendstatus" id="bStatus" aria-live="polite" hidden></p>'+
      '<div class="actions"><button class="btn" type="submit" id="bSend">'+esc(T.button)+'</button></div>'+
    '</form>'+
  '</div>';
}

function initBusiness(c){
  var T=c.T, esc=c.esc, $=c.$, L=c.L, form=$('#bizForm'); if(!form) return;
  var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, status=$('#bStatus'), btn=$('#bSend'), toastT;
  var mailLink = c.email ? '<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>' : '';
  function toast(msg){ var el=$('#toast'); if(!el){ alert(msg); return; } el.textContent=msg; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(function(){ el.hidden=true; }, 3200); }
  function setStatus(kind, html){ status.hidden=false; status.className='small sendstatus'+(kind?' '+kind:''); status.innerHTML=html; }
  function clean(s){ return String(s||'').trim().replace(/\s+/g,' '); }
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var name=clean($('#bName').value), em=$('#bEmail').value.trim(), company=clean($('#bCompany').value), size=$('#bSize').value, msg=$('#bMsg').value.trim();
    var picked=[].filter.call(form.querySelectorAll('input[name=interest]'), function(x){ return x.checked; }).map(function(x){ return T.interests[+x.value]; });
    if(name.length<2){ $('#bName').focus(); toast(T.nameRequired); return; }
    if(!EMAIL_RE.test(em)||em.length>120){ $('#bEmail').focus(); toast(T.emailRequired); return; }
    if(company.length<2){ $('#bCompany').focus(); toast(T.needCompany); return; }
    if(!picked.length){ form.querySelector('input[name=interest]').focus(); toast(T.needInterest); return; }
    var pd=$('#bPd'); if(pd && !pd.checked){ pd.focus(); toast(T.pdRequired); return; }
    if(!c.endpoint){ location.href='mailto:'+encodeURIComponent(c.email)+'?subject='+encodeURIComponent(T.subject.replace('{company}', company)); return; }
    var text=T.company+': '+company+'\n'+(size ? T.size+': '+size+'\n' : '')+T.interest+': '+picked.join('; ')+(msg ? '\n\n'+T.comment+':\n'+msg : '');
    var data={action:'contact', token:c.token, lang:L.lang, name:name, email:em, subject:T.subject.replace('{company}', company).slice(0,120), message:text.slice(0,5000),
      page:location.href.split('#')[0], hp:$('#bSite').value, files:[]};
    if(pd){ data.consent=true; data.consentV=c.pdVersion||''; }
    btn.disabled=true; setStatus('muted', esc(T.sending));
    // Content-Type не задаём: «простой» запрос без предварительного OPTIONS, как в форме обратной связи
    fetch(c.endpoint, {method:'POST', body:JSON.stringify(data)})
      .then(function(r){ return r.text(); })
      .then(function(txt){ var j=null; try{ j=JSON.parse(txt); }catch(err){} if(!j||!j.ok) throw new Error((j&&j.error)||'bad response');
        setStatus('ok', esc(T.sent.replace('{email}', em)));
        $('#bMsg').value=''; [].forEach.call(form.querySelectorAll('input[name=interest]'), function(x){ x.checked=false; });
        if(window.discTrack) window.discTrack('business-request'); })
      .catch(function(err){ var m=String((err&&err.message)||err);
        setStatus('err', /too many|daily limit/.test(m) ? T.tooMany.replace('{contact}', mailLink) : T.sendFailed.replace('{error}', esc(m)).replace('{contact}', mailLink)); })
      .then(function(){ btn.disabled=false; });
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = businessHTML;
