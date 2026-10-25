/* Разметка стартового экрана. Один и тот же код используют сборка (build.js кладёт готовый HTML
   в страницу, чтобы поисковики видели текст без JavaScript) и сама страница (перерисовка
   с незавершённым прохождением и прошлым результатом). Имя и e-mail спрашиваются не здесь,
   а на экране результата: кнопка «Начать тест» стоит сразу под вводным абзацем, на первом экране телефона. */
function introHTML(c){
  var L=c.L, t=c.t, esc=c.esc, KEYS=c.KEYS, colorVar=c.colorVar, progDone=c.progDone||0, lastDate=c.lastDate||'';
  var links=c.links||{}, arr=L.dir==='rtl'?'←':'→';
  // lc — карточка вернувшегося посетителя (её собирает сама страница, в сборке её нет): прошлый результат и под ним блок расширенного отчёта,
  // как на экране результата (заголовок, строка о самой низкой шкале, тезисы, листы образца; форму покупки страница добавляет сама, где lc.pay;
  // без неё — крупная кнопка отчёта) — сразу под заголовком; «Начать тест» становится неброской ссылкой «Пройти тест заново» под вводным абзацем
  var lc=c.lastCard||null;
  return '<div class="eyebrow">'+t('intro.eyebrow')+'</div>'+
    '<h1>'+t('intro.h1')+'</h1>'+
    (lc ? '<section class="share xoffer lastcard" id="lastOffer" style="--k:'+colorVar(lc.k)+'"><div class="lchead">'+esc(lc.label)+
        '<span class="lastname"><b>'+lc.badge+' '+esc(lc.name)+'</b><button class="link" type="button" id="showLast">'+esc(lc.open)+'</button></span></div>'+
      '<h2>'+esc(lc.title)+'</h2><p class="xhook">'+esc(lc.hook)+'</p>'+
      '<div class="xgrid"><ul>'+lc.list.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'+
        (lc.thumbs ? '<div class="xside"><a class="xthumbs" id="lastSample" href="'+esc(lc.href)+'#sample" aria-label="'+esc(lc.sample)+'">'+lc.thumbs.map(function(u){ return '<img src="'+esc(u)+'" width="440" height="623" alt="" loading="lazy" decoding="async">'; }).join('')+'</a>'+
          '<p>'+esc(lc.sample)+'</p></div>' : '')+'</div>'+
      (lc.soon ? '<p class="xsoon">'+esc(lc.soon)+'</p>' : '')+
      (lc.pay ? '' : '<a class="btn big" id="lastExt" href="'+esc(lc.href)+'">'+esc(lc.button)+'</a>')+'</section>' : '')+
    '<p class="lead">'+t('intro.lead')+'</p>'+
    // пришёл по QR-коду с бумажного бланка (?ref=pdf, с 2026-10-25; тексты content.paper.fromPdf): как перенести отметки
    (c.fromPdf ? '<div class="frompdf"><b>'+esc(c.fromPdf.title)+'</b><p>'+esc(c.fromPdf.text)+'</p>'+(c.fromPdf.scoreLink ? '<a href="#paper">'+esc(c.fromPdf.scoreLink)+' '+arr+'</a>' : '')+'</div>' : '')+
    '<div class="actions startrow'+(lc ? ' again' : '')+'">'+(lc ? '<button class="link" type="button" id="start">'+esc(lc.retake)+'</button>' : '<button class="btn big" type="button" id="start">'+t('intro.start')+'</button>')+
      '<span class="small muted">'+t('intro.startNote')+'</span>'+
      (progDone ? '<button class="link" type="button" id="resume">'+t('intro.resume',{n:progDone})+'</button>' : '')+
    '</div>'+
    // строка со счётом прохождений за 7 дней: число страница берёт у сервера (GET <sendEndpoint>stats) и показывает строку сама, в сборке она скрыта
    (lc ? '' : '<p class="small muted passes" id="weekPasses" hidden></p>')+
    (lastDate && !lc ? '<p class="small muted" style="margin-top:12px"><button class="link" id="showLast" type="button">'+t('intro.showLast',{date:esc(lastDate)})+'</button></p>' : '')+
    // «Что вы получите» с примером результата — сразу под кнопкой (с 2026-10-25, по просьбе заказчика); вернувшемуся посетителю с карточкой результата не нужен
    (lc ? '' : homeGetHTML(c))+
    '<div class="tiles">'+KEYS.map(function(k){ return '<div class="tile" style="--k:'+colorVar(k)+'"><b>'+k+'</b><strong>'+esc(L.keys[k])+'</strong><span>'+esc(L.short[k])+'</span></div>'; }).join('')+'</div>'+
    '<div class="card">'+
      '<h2>'+t('intro.howTitle')+'</h2>'+
      '<p>'+t('intro.howText')+'</p>'+
      (links.pdf ? '<p class="small muted">'+t('intro.pdfNote',{link:'<a href="'+esc(links.pdf)+'">'+t('nav.pdf')+'</a>'})+'</p>' : '')+
      '<div class="actions"><button class="btn'+(lc ? ' secondary' : '')+'" type="button" id="start2">'+(lc ? esc(lc.retake) : t('intro.start'))+'</button></div>'+
    '</div>'+
    '<section class="styles-intro"><h2>'+t('intro.stylesTitle')+'</h2><div class="stylegrid">'+
      KEYS.map(function(k){ var st=L.styles[k], pr=L.profiles[k];
        return '<article class="stylecard" style="--k:'+colorVar(k)+'"><h3><span class="k">'+k+'</span>'+esc(L.keys[k])+' · '+esc(pr.name)+'</h3><p>'+esc(pr.summary)+'</p><div class="traits">'+st.traits.map(function(x){ return '<span>'+esc(x)+'</span>'; }).join('')+'</div>'+
          (links.profile ? '<a class="more" href="'+esc(links.profile(k))+'">'+t('pages.profile.more',{name:esc(pr.name)})+'</a>' : '')+'</article>'; }).join('')+
    '</div>'+(links.styles ? '<p class="all"><a href="'+esc(links.styles)+'">'+t('nav.styles')+' '+arr+'</a> · <a href="'+esc(links.profiles)+'">'+t('nav.profiles')+' '+arr+'</a></p>' : '')+'</section>'+
    // анонс сервиса резюме и подписка — после «Как считается результат» и коротких вопросов, перед списком 16 профилей (с 2026-10-25, по просьбе заказчика):
    // раньше стояли между кнопкой теста и доводами пройти его
    homeHTML(c, cvPromoHTML({P: L.content && L.content.cvPromo, esc: esc, href: links.cv, kind: 'home'})+subHTML(c));
}
/* Пример результата: профиль DI (те же числа, что в src/samples.js) — название, график и шкалы. «Что вы получите» на главной (homeGetHTML,
   график на телефоне скрыт) и колонка «Онлайн» на странице «Тест в PDF» (build.js, без графика). c.graphSVG — функция графика (src/graph.js):
   сборка передаёт её явно, страница — свою глобальную. o.graph — рисовать график, o.cls — классы обёртки. */
var HOME_SAMPLE = {key:'DI', net:{D:14, I:8, S:-12, C:-10}};
function sampleCardHTML(c, o){
  var L=c.L, t=c.t, esc=c.esc, KEYS=c.KEYS, colorVar=c.colorVar, g=o.graph ? (c.graphSVG || (typeof graphSVG === 'function' ? graphSVG : null)) : null;
  var k=HOME_SAMPLE.key, net=HOME_SAMPLE.net, pr=L.profiles[k], most={}, least={};
  var pos=KEYS.reduce(function(a,x){ return a+Math.max(0,net[x]); },0), base=(24-pos)/4;
  KEYS.forEach(function(x){ most[x]=Math.max(0,net[x])+base; least[x]=Math.max(0,-net[x])+base; });
  var pct=function(x){ return Math.round((net[x]+24)/48*100); };
  return '<div class="'+(o.cls||'hgcard')+'"><div class="hglabel">'+esc(t('pages.profile.exampleTitle'))+'</div>'+
    '<div class="hgname"><span class="pill" dir="ltr" style="--kp:var(--'+k[0].toLowerCase()+');--ks:var(--'+k[1].toLowerCase()+')"><span class="p">'+k[0]+'</span><span class="s">'+k[1]+'</span></span> <b>'+esc(pr.name)+'</b>'+
      '<span class="muted">'+esc(L.keys[k[0]]+' + '+L.keys[k[1]])+'</span></div>'+
    '<div class="hgbody">'+(g ? '<div class="graph">'+g({most:most, least:least, net:net}, {net:true}, {label:t('report.graphAria'), colorVar:colorVar, keys:KEYS})+'</div>' : '')+
      '<div class="hgbars">'+KEYS.map(function(x){ return '<div class="hgbar" style="--k:'+colorVar(x)+'"><b>'+x+'</b><div class="bar"><i style="width:'+pct(x)+'%"></i></div><span>'+pct(x)+'%</span></div>'; }).join('')+'</div></div></div>';
}
/* «Что вы получите» на главной — сразу под кнопкой теста (с 2026-10-25, по просьбе заказчика): заголовок, пример результата и список content.home.get */
function homeGetHTML(c){
  var H=c.L.content && c.L.content.home, esc=c.esc;
  if(!H || !H.get) return '';
  return '<section class="homeget"><h2>'+esc(H.getTitle)+'</h2>'+sampleCardHTML(c, {graph:true, cls:'card hgcard'})+
    '<ul>'+H.get.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></section>';
}
/* Блок-анонс сервиса «Резюме под каждую вакансию» (/ru/cv/, с 2026-10-24, по просьбе заказчика; сейчас только русская версия — content.cvPromo):
   метка «Новый сервис», вопрос, короткий анонс и кнопка на лендинг. kind — место на сайте: home (главная), result (экран результата),
   profile (страницы профилей); у каждого места свой вопрос и текст, клик по кнопке — цель Метрики cv-promo-<kind>.
   Общий для сборки (главная, страницы профилей) и страницы теста (экран результата). Без текстов или адреса — пусто. */
function cvPromoHTML(o){
  var P=o.P, esc=o.esc, X=P && P[o.kind];
  if(!X || !o.href) return '';
  return '<aside class="cvpromo no-print"><div><span class="cvtag">'+esc(P.tag)+'</span><h2>'+esc(X.h)+'</h2><p>'+esc(X.p)+'</p>'+
    (P.note ? '<p class="cvnote">'+esc(P.note)+'</p>' : '')+'</div>'+
    '<a class="btn" href="'+esc(o.href)+'" data-goal="cv-promo-'+o.kind+'">'+esc(P.button)+'</a></aside>';
}
/* Подписка на рассылку (с 2026-10-22, по просьбе заказчика): поле e-mail, «Подписаться», галочки согласия на обработку данных (c.sub.pdHtml)
   и на рассылку. Собирает только сама страница (c.sub), в сборке формы нет. Подписка действует после подтверждения по ссылке из письма. */
function subHTML(c){
  var s=c.sub, t=c.t, esc=c.esc;
  if(!s) return '';
  return '<section class="share nlbox" id="nlBox"><h2>'+esc(t('nl.title'))+'</h2><p>'+esc(t('nl.text'))+'</p>'+
    '<form class="form nlform" id="nlForm" autocomplete="on" novalidate><div class="nlfields">'+
      '<div class="nlrow"><input type="email" id="nlEm" name="email" class="ym-disable-keys" autocomplete="email" inputmode="email" required maxlength="120" placeholder="'+esc(t('nl.emailLabel'))+'" aria-label="'+esc(t('nl.emailLabel'))+'" value="'+esc(s.email||'')+'">'+
        '<button class="btn" type="submit">'+esc(t('nl.button'))+'</button></div>'+
      (s.pdHtml ? '<label class="check"><input type="checkbox" id="nlPd" name="consent"><span>'+s.pdHtml+'</span></label>' : '')+
      '<label class="check"><input type="checkbox" id="nlOk" name="subscribe"><span>'+esc(t('nl.consent'))+'</span></label></div>'+
      '<p class="small sendstatus" id="nlStatus" aria-live="polite" hidden></p>'+
    '</form></section>';
}
/* Текст под тестом (content.home): как считается результат, короткие вопросы, 16 профилей — закрывает интент «что за тест» на странице, где его проходят.
   mid — блоки между короткими вопросами и списком 16 профилей (анонс сервиса резюме, подписка) */
function homeHTML(c, mid){
  var L=c.L, t=c.t, esc=c.esc, H=L.content && L.content.home, links=c.links||{}, arr=L.dir==='rtl'?'←':'→';
  mid = mid || '';
  if(!H) return mid;
  var P=['D','DI','DC','DS','I','ID','IS','IC','S','SI','SC','SD','C','CD','CS','CI'];
  return '<section class="home-more">'+
    // «Что вы получите» — вернувшемуся посетителю с карточкой результата здесь, остальным — под кнопкой теста (homeGetHTML)
    (c.lastCard ? '<h2>'+esc(H.getTitle)+'</h2><ul>'+H.get.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>' : '')+
    '<h2>'+esc(H.calcTitle)+'</h2><p>'+esc(H.calc)+(links.results ? ' <a href="'+esc(links.results)+'">'+t('nav.results')+' '+arr+'</a>' : '')+'</p>'+
    '<h2>'+esc(H.faqTitle)+'</h2>'+H.faq.map(function(x){ return '<h3>'+esc(x.q)+'</h3><p>'+esc(x.a)+'</p>'; }).join('')+
    (links.faq ? '<p><a href="'+esc(links.faq)+'">'+t('nav.faq')+' '+arr+'</a></p>' : '')+
    (mid ? '</section>'+mid+'<section class="home-more">' : '')+
    (links.profile ? '<h2>'+esc(H.profilesTitle)+'</h2><p class="chips">'+P.map(function(k){ var pr=L.profiles[k];
      return '<a href="'+esc(links.profile(k))+'"><span class="pill" dir="ltr" style="--kp:var(--'+k[0].toLowerCase()+');--ks:var(--'+(k[1]||k[0]).toLowerCase()+')"><span class="p">'+k[0]+'</span>'+(k[1]?'<span class="s">'+k[1]+'</span>':'')+'</span> '+esc(pr.name)+'</a>'; }).join('')+'</p>' : '')+
    '</section>';
}
if (typeof module !== 'undefined' && module.exports) { module.exports = introHTML; module.exports.cvPromoHTML = cvPromoHTML; module.exports.sampleCardHTML = sampleCardHTML; }
