/* Разметка стартового экрана. Один и тот же код используют сборка (build.js кладёт готовый HTML
   в страницу, чтобы поисковики видели текст без JavaScript) и сама страница (перерисовка
   с незавершённым прохождением и прошлым результатом). Имя и e-mail спрашиваются не здесь,
   а на экране результата: кнопка «Начать тест» стоит сразу под вводным абзацем, на первом экране телефона. */
function introHTML(c){
  var L=c.L, t=c.t, esc=c.esc, KEYS=c.KEYS, colorVar=c.colorVar, progDone=c.progDone||0, lastDate=c.lastDate||'';
  var links=c.links||{}, arr=L.dir==='rtl'?'←':'→';
  return '<div class="eyebrow">'+t('intro.eyebrow')+'</div>'+
    '<h1>'+t('intro.h1')+'</h1>'+
    '<p class="lead">'+t('intro.lead')+'</p>'+
    '<div class="actions startrow"><button class="btn big" type="button" id="start">'+t('intro.start')+'</button>'+
      '<span class="small muted">'+t('intro.startNote')+'</span>'+
      (progDone ? '<button class="link" type="button" id="resume">'+t('intro.resume',{n:progDone})+'</button>' : '')+
    '</div>'+
    (lastDate ? '<p class="small muted" style="margin-top:12px"><button class="link" id="showLast" type="button">'+t('intro.showLast',{date:esc(lastDate)})+'</button></p>' : '')+
    '<div class="tiles">'+KEYS.map(function(k){ return '<div class="tile" style="--k:'+colorVar(k)+'"><b>'+k+'</b><strong>'+esc(L.keys[k])+'</strong><span>'+esc(L.short[k])+'</span></div>'; }).join('')+'</div>'+
    '<div class="card">'+
      '<h2>'+t('intro.howTitle')+'</h2>'+
      '<p>'+t('intro.howText')+'</p>'+
      (links.pdf ? '<p class="small muted">'+t('intro.pdfNote',{link:'<a href="'+esc(links.pdf)+'">'+t('nav.pdf')+'</a>'})+'</p>' : '')+
      '<div class="actions"><button class="btn" type="button" id="start2">'+t('intro.start')+'</button></div>'+
    '</div>'+
    '<section class="styles-intro"><h2>'+t('intro.stylesTitle')+'</h2><div class="stylegrid">'+
      KEYS.map(function(k){ var st=L.styles[k], pr=L.profiles[k];
        return '<article class="stylecard" style="--k:'+colorVar(k)+'"><h3><span class="k">'+k+'</span>'+esc(L.keys[k])+' · '+esc(pr.name)+'</h3><p>'+esc(pr.summary)+'</p><div class="traits">'+st.traits.map(function(x){ return '<span>'+esc(x)+'</span>'; }).join('')+'</div>'+
          (links.profile ? '<a class="more" href="'+esc(links.profile(k))+'">'+t('pages.profile.more',{name:esc(pr.name)})+'</a>' : '')+'</article>'; }).join('')+
    '</div>'+(links.styles ? '<p class="all"><a href="'+esc(links.styles)+'">'+t('nav.styles')+' '+arr+'</a> · <a href="'+esc(links.profiles)+'">'+t('nav.profiles')+' '+arr+'</a></p>' : '')+'</section>'+
    homeHTML(c);
}
/* Текст под тестом (content.home): что вы получите, как считается результат, короткие вопросы, 16 профилей — закрывает интент «что за тест» на странице, где его проходят */
function homeHTML(c){
  var L=c.L, t=c.t, esc=c.esc, H=L.content && L.content.home, links=c.links||{}, arr=L.dir==='rtl'?'←':'→';
  if(!H) return '';
  var P=['D','DI','DC','DS','I','ID','IS','IC','S','SI','SC','SD','C','CD','CS','CI'];
  return '<section class="home-more">'+
    '<h2>'+esc(H.getTitle)+'</h2><ul>'+H.get.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'+
    '<h2>'+esc(H.calcTitle)+'</h2><p>'+esc(H.calc)+(links.results ? ' <a href="'+esc(links.results)+'">'+t('nav.results')+' '+arr+'</a>' : '')+'</p>'+
    '<h2>'+esc(H.faqTitle)+'</h2>'+H.faq.map(function(x){ return '<h3>'+esc(x.q)+'</h3><p>'+esc(x.a)+'</p>'; }).join('')+
    (links.faq ? '<p><a href="'+esc(links.faq)+'">'+t('nav.faq')+' '+arr+'</a></p>' : '')+
    (links.profile ? '<h2>'+esc(H.profilesTitle)+'</h2><p class="chips">'+P.map(function(k){ var pr=L.profiles[k];
      return '<a href="'+esc(links.profile(k))+'"><span class="pill" dir="ltr" style="--kp:var(--'+k[0].toLowerCase()+');--ks:var(--'+(k[1]||k[0]).toLowerCase()+')"><span class="p">'+k[0]+'</span>'+(k[1]?'<span class="s">'+k[1]+'</span>':'')+'</span> '+esc(pr.name)+'</a>'; }).join('')+'</p>' : '')+
    '</section>';
}
if (typeof module !== 'undefined' && module.exports) module.exports = introHTML;
