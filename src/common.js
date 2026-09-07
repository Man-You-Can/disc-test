/* Общие элементы всех страниц сайта (тест и контентные страницы): выпадающий список языков,
   запоминание выбранного языка, подсказка «Продолжить на …», уведомление о cookie и загрузка Яндекс.Метрики после согласия.
   Вставляется сборкой в каждую страницу; вызывается как initCommon({L, t, esc, lsGet, lsSet, langHref, $}). */
function initCommon(c){
  var L=c.L, t=c.t, esc=c.esc, lsGet=c.lsGet, lsSet=c.lsSet, langHref=c.langHref, $=c.$;

  /* выбор языка запоминается только при явном действии пользователя */
  document.querySelectorAll('a[data-lang]').forEach(function(a){
    a.addEventListener('click', function(){ var code=a.getAttribute('data-lang'); lsSet('disc.lang', code); a.href=langHref(code); });
  });

  /* выпадающий список языков */
  (function(){
    var box=$('#langSel'), btn=$('#langBtn'), menu=$('#langMenu');
    if(!box||!btn||!menu) return;
    var items=[].slice.call(menu.querySelectorAll('a[data-lang]'));
    function open(){
      items.forEach(function(a){ a.href=langHref(a.getAttribute('data-lang')); });
      menu.hidden=false; btn.setAttribute('aria-expanded','true');
      var cur=menu.querySelector('a[aria-selected="true"]')||items[0]; try{ cur.focus({preventScroll:true}); }catch(e){ cur.focus(); }
    }
    function close(focusBtn){ if(menu.hidden) return; menu.hidden=true; btn.setAttribute('aria-expanded','false'); if(focusBtn) btn.focus(); }
    btn.addEventListener('click', function(){ menu.hidden ? open() : close(false); });
    btn.addEventListener('keydown', function(e){ if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); open(); } });
    menu.addEventListener('keydown', function(e){
      var i=items.indexOf(document.activeElement), n=items.length;
      if(e.key==='Escape'){ e.preventDefault(); close(true); }
      else if(e.key==='ArrowDown'){ e.preventDefault(); items[(i+1)%n].focus(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); items[(i-1+n)%n].focus(); }
      else if(e.key==='Home'){ e.preventDefault(); items[0].focus(); }
      else if(e.key==='End'){ e.preventDefault(); items[n-1].focus(); }
      else if(e.key==='Tab'){ close(false); }
    });
    document.addEventListener('click', function(e){ if(!box.contains(e.target)) close(false); });
  })();

  /* подсказка «Продолжить на …», если язык браузера отличается и выбор ещё не делался */
  (function(){
    if(lsGet('disc.lang')) return;
    var LANG_META = c.langMeta||{}, LANG_PATH = c.langPath||{};
    var prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language||''];
    var pick = null;
    for(var i=0;i<prefs.length && !pick;i++){ var p = String(prefs[i]).toLowerCase().split('-')[0]; if(LANG_PATH[p]!=null) pick = p; }
    if(!pick || pick===L.lang || !LANG_META[pick]) return;
    var m = LANG_META[pick], bar = document.createElement('div');
    bar.className='langbar no-print'; bar.setAttribute('lang', pick); bar.setAttribute('dir', m.dir||'ltr');
    bar.innerHTML = '<a href="'+esc(langHref(pick))+'"><svg class="flag" aria-hidden="true" focusable="false"><use href="#flag-'+pick+'"/></svg><b>'+esc(m.name)+'</b><span>'+esc(m.cont)+' →</span></a><button type="button" class="langbar-x" aria-label="×">×</button>';
    var app = $('#app'); app.insertBefore(bar, app.firstChild.nextSibling);
    bar.querySelector('a').addEventListener('click', function(){ lsSet('disc.lang', pick); });
    bar.querySelector('button').addEventListener('click', function(){ lsSet('disc.lang', L.lang); bar.remove(); });
  })();

  /* уведомление о cookie и согласие на аналитику.
     window.DISC_ANALYTICS задаётся сборкой из site.config.json: {ym: номер счётчика Яндекс.Метрики, mode: "optin"|"always"}.
     optin — счётчик загружается только после кнопки «Принять»; always — сразу, уведомление лишь информирует.
     В localStorage disc.consent: "analytics" (согласие), "essential" (отказ), "noted" (режим always или счётчик не задан);
     старая отметка-дата означает, что человек видел прежний текст без аналитики, — уведомление показывается снова. */
  (function(){
    var A = window.DISC_ANALYTICS||{}, ym = A.ym ? String(A.ym) : "", optin = A.mode!=="always", ask = optin && !!ym;
    function loadYm(){
      if(!ym || window.ym) return;
      (function(m,e,t,r,i,k,a){ m[i]=m[i]||function(){ (m[i].a=m[i].a||[]).push(arguments); }; m[i].l=1*new Date();
        for(var j=0;j<document.scripts.length;j++){ if(document.scripts[j].src===r) return; }
        k=e.createElement(t); a=e.getElementsByTagName(t)[0]; k.async=1; k.src=r; a.parentNode.insertBefore(k,a);
      })(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id="+ym,"ym");
      /* defer: первый просмотр отправляем сами — без #r=…, в котором закодированы имя и e-mail участника */
      window.ym(ym,"init",{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",accurateTrackBounce:true,trackLinks:true,defer:true});
      window.ym(ym,"hit", location.origin+location.pathname+location.search, {referer:document.referrer});
    }
    /* цели Метрики: страница теста вызывает discTrack("start") и discTrack("finish") */
    window.discTrack = function(goal){ if(ym && window.ym) window.ym(ym,"reachGoal",goal); };
    var st = lsGet("disc.consent");
    if(!optin) loadYm();
    if(st==="analytics"||st==="essential"||(st==="noted"&&!ask)){ if(ask && st==="analytics") loadYm(); return; }
    var el=document.createElement("div"); el.className="consent no-print"; el.id="consent"; el.setAttribute("role","region"); el.setAttribute("aria-label", t("consent.label"));
    var more = t("consent.details") + (c.privacyHref ? " <a href=\""+esc(c.privacyHref)+"\">"+esc(t("nav.privacy"))+"</a>" : "");
    el.innerHTML="<div class=\"consent-in\"><p>"+t("consent.text")+"</p>"+
      (ask ? "<span class=\"consent-btns\"><button class=\"btn small\" type=\"button\" id=\"consentOk\">"+t("consent.accept")+"</button><button class=\"btn small secondary\" type=\"button\" id=\"consentNo\">"+t("consent.decline")+"</button></span>"
           : "<button class=\"btn small\" type=\"button\" id=\"consentOk\">"+t("consent.ok")+"</button>")+
      "<details><summary>"+t("consent.more")+"</summary><p>"+more+"</p></details></div>";
    document.body.appendChild(el); document.body.classList.add("has-consent");
    function close(v){ lsSet("disc.consent", v); el.remove(); document.body.classList.remove("has-consent"); }
    $("#consentOk").addEventListener("click", function(){ close(ask ? "analytics" : "noted"); if(ask) loadYm(); });
    if($("#consentNo")) $("#consentNo").addEventListener("click", function(){ close("essential"); });
  })();
}
if (typeof module !== 'undefined' && module.exports) module.exports = initCommon;
