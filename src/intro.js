/* Разметка стартового экрана. Один и тот же код используют сборка (build.js кладёт готовый HTML
   в страницу, чтобы поисковики видели текст без JavaScript) и сама страница (перерисовка
   с сохранёнными именем, e-mail, незавершённым прохождением и прошлым результатом). */
function introHTML(c){
  var L=c.L, t=c.t, esc=c.esc, KEYS=c.KEYS, colorVar=c.colorVar, who=c.who||{}, progDone=c.progDone||0, lastDate=c.lastDate||'';
  var links=c.links||{};
  return '<div class="eyebrow">'+t('intro.eyebrow')+'</div>'+
    '<h1>'+t('intro.h1')+'</h1>'+
    '<p class="lead">'+t('intro.lead')+'</p>'+
    '<div class="tiles">'+KEYS.map(function(k){ return '<div class="tile" style="--k:'+colorVar(k)+'"><b>'+k+'</b><strong>'+esc(L.keys[k])+'</strong><span>'+esc(L.short[k])+'</span></div>'; }).join('')+'</div>'+
    '<div class="card">'+
      '<h2>'+t('intro.howTitle')+'</h2>'+
      '<p>'+t('intro.howText')+'</p>'+
      '<form class="form" id="startForm" autocomplete="on">'+
        '<div class="field"><label for="nm">'+t('intro.nameLabel')+'<span class="req" aria-hidden="true">*</span></label><input type="text" id="nm" name="name" class="ym-disable-keys" autocomplete="name" required maxlength="80" value="'+esc(who.name||'')+'"></div>'+
        '<div class="field"><label for="em">'+t('intro.emailLabel')+'<span class="req" aria-hidden="true">*</span></label><input type="email" id="em" name="email" class="ym-disable-keys" autocomplete="email" inputmode="email" required maxlength="120" value="'+esc(who.email||'')+'"><span class="hint">'+t('intro.emailHint')+'</span></div>'+
        '<div class="actions"><button class="btn" type="submit">'+t('intro.start')+'</button>'+
          (progDone ? '<button class="link" type="button" id="resume">'+t('intro.resume',{n:progDone})+'</button>' : '')+
        '</div>'+
      '</form>'+
    '</div>'+
    (lastDate ? '<p class="small muted" style="margin-top:14px"><button class="link" id="showLast" type="button">'+t('intro.showLast',{date:esc(lastDate)})+'</button></p>' : '')+
    '<section class="styles-intro"><h2>'+t('intro.stylesTitle')+'</h2><div class="stylegrid">'+
      KEYS.map(function(k){ var st=L.styles[k], pr=L.profiles[k];
        return '<article class="stylecard" style="--k:'+colorVar(k)+'"><h3><span class="k">'+k+'</span>'+esc(L.keys[k])+' · '+esc(pr.name)+'</h3><p>'+esc(pr.summary)+'</p><div class="traits">'+st.traits.map(function(x){ return '<span>'+esc(x)+'</span>'; }).join('')+'</div>'+
          (links.profile ? '<a class="more" href="'+esc(links.profile(k))+'">'+t('pages.profile.more',{name:esc(pr.name)})+'</a>' : '')+'</article>'; }).join('')+
    '</div>'+(links.styles ? '<p class="all"><a href="'+esc(links.styles)+'">'+t('nav.styles')+' →</a> · <a href="'+esc(links.profiles)+'">'+t('nav.profiles')+' →</a></p>' : '')+'</section>';
}
if (typeof module !== 'undefined' && module.exports) module.exports = introHTML;
