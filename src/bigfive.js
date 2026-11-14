/* Тест «Большая пятёрка» (/<язык>/big-five/, с 2026-11-14, по решению заказчика; сначала только русская версия — content.bigfive в локали).
   Вопросник — BFAS (Big Five Aspect Scales; DeYoung, Quilty, Peterson, 2007): 100 утверждений из открытого банка IPIP (ipip.ori.org —
   разрешено любое использование, в том числе коммерческое), 10 аспектов по 10 утверждений, ответ — по шкале 1–5. Перевод — свой
   (content.bigfive.items, ключи — код аспекта и номер утверждения в порядке страницы BFAS на сайте IPIP: сначала прямые, потом обратные).
   Место среди других («выше, чем у N из 100») — по средним и разбросу из Weisberg, DeYoung, Hirsh (2011), табл. 2, сырые баллы мужчин и
   женщин поровну (около 2600 англоязычных участников): приблизительно, о чём говорит текст на экране (content.bigfive.result.note).
   Всё считается в браузере; на сервер ничего не уходит. Ответы и прогресс — в disc.bf, последний результат — в disc.bfLast
   (тексты о данных говорят о хранении ответов, прогресса и последнего результата в браузере). Цели: bf-start, bf-finish, bf-disc. */
function initBigFive(o){
  var T = o.T, esc = o.esc, lsGet = o.lsGet, lsSet = o.lsSet, $ = function(id){ return document.getElementById(id); };
  var track = function(g){ if(window.discTrack) window.discTrack(g); };
  var fmt = function(s, v){ return String(s).replace(/\{(\w+)\}/g, function(m, k){ return v && k in v ? v[k] : m; }); };
  // аспекты по чертам; POS — сколько первых утверждений аспекта прямые (остальные — обратные), как на странице BFAS
  var TRAITS = [['O', ['IT','OP']], ['C', ['IN','OR']], ['E', ['EN','AS']], ['A', ['CO','PO']], ['N', ['VO','WI']]];   // порядок OCEAN
  var POS = {VO:6, WI:6, CO:5, PO:4, IN:4, OR:6, EN:5, AS:6, IT:6, OP:6};
  // нормы [среднее, ст. отклонение] по шкале 1–5: Weisberg, DeYoung, Hirsh (2011), Frontiers in Psychology 2:178, табл. 2 (мужчины и женщины поровну)
  var NORM_MF = {EN:[3.40,.66,3.56,.68], AS:[3.34,.64,3.28,.68], CO:[3.78,.60,4.04,.56], PO:[3.52,.61,3.74,.61], IN:[3.25,.68,3.21,.73],
    OR:[3.38,.61,3.49,.63], VO:[2.63,.75,2.86,.77], WI:[2.73,.69,3.02,.71], IT:[3.62,.61,3.48,.63], OP:[3.57,.61,3.74,.60],
    E:[3.37,.55,3.42,.59], A:[3.65,.50,3.89,.50], C:[3.32,.54,3.35,.58], N:[2.68,.65,2.94,.67], O:[3.60,.51,3.61,.52]};
  var NORM = {};
  Object.keys(NORM_MF).forEach(function(k){ var x = NORM_MF[k], d = (x[0] - x[2]) / 2;
    NORM[k] = [(x[0] + x[2]) / 2, Math.sqrt((x[1] * x[1] + x[3] * x[3]) / 2 + d * d)]; });
  // порядок показа — перемешан один раз и закреплён (два утверждения одного аспекта подряд не идут)
  var ORDER = ["VO9","OP3","OR4","IN7","PO4","CO6","AS5","EN9","IN1","CO5","AS10","WI8","IT1","VO7","WI3","IN10","OR1","WI10","AS1","EN8",
    "AS8","EN3","PO1","IN3","CO8","IT9","OP6","VO5","OP4","VO2","AS3","EN1","PO8","EN4","IT7","PO9","IT8","AS4","CO4","IN4",
    "OR7","OP5","EN10","CO2","OR9","PO7","CO10","WI9","EN5","VO8","WI5","OP10","AS9","OR2","IT5","IN6","OR10","IN5","OP8","WI4",
    "IT10","OP7","PO2","OP9","PO10","VO3","CO9","VO6","WI7","IT6","CO1","WI1","OP2","VO10","EN7","AS2","WI6","CO7","OR5","PO3",
    "IT3","AS6","CO3","IN8","PO6","EN6","VO1","IT4","PO5","OR3","AS7","IN2","EN2","IT2","OR6","WI2","VO4","OR8","OP1","IN9"];
  var PER = 10, PAGES = ORDER.length / PER, N = ORDER.length;
  var app = $('bfApp'), about = $('bfAbout');
  if(!app) return;

  function blank(){ return {v: 1, a: new Array(N + 1).join('0'), p: 0}; }
  function load(){ var s = lsGet('disc.bf'); return s && s.v === 1 && typeof s.a === 'string' && s.a.length === N && /^[0-5]+$/.test(s.a) ? s : null; }
  function answered(s){ return s.a.replace(/0/g, '').length; }
  function setAns(s, i, v){ s.a = s.a.slice(0, i) + v + s.a.slice(i + 1); }

  // норм. распределение: доля людей ниже z (Абрамовиц — Стиган, 7.1.26)
  function cdf(z){ var t = 1 / (1 + .3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-z * z / 2);
    return z < 0 ? (1 - y) / 2 : (1 + y) / 2; }
  function pctl(key, raw){ var nm = NORM[key]; return Math.max(1, Math.min(99, Math.round(100 * cdf((raw - nm[0]) / nm[1])))); }
  function score(a){
    var asp = {}, raw = {};
    Object.keys(POS).forEach(function(k){ raw[k] = 0; });
    ORDER.forEach(function(id, i){ var k = id.slice(0, 2), n = +id.slice(2), v = +a.charAt(i); raw[k] += n <= POS[k] ? v : 6 - v; });
    Object.keys(raw).forEach(function(k){ raw[k] /= 10; asp[k] = pctl(k, raw[k]); });
    var tr = {};
    TRAITS.forEach(function(t){ tr[t[0]] = pctl(t[0], (raw[t[1][0]] + raw[t[1][1]]) / 2); });
    return {tr: tr, asp: asp};
  }
  function level(p){ return p <= 15 ? 0 : p <= 35 ? 1 : p <= 64 ? 2 : p <= 84 ? 3 : 4; }
  function tier(p){ return p <= 35 ? 'low' : p >= 65 ? 'high' : 'mid'; }
  function top(){ try{ window.scrollTo(0, Math.max(0, app.getBoundingClientRect().top + window.pageYOffset - 70)); }catch(e){} }
  function showAbout(on){ if(about) about.hidden = !on; }

  /* ---- стартовый экран: продолжить / прошлый результат ---- */
  function intro(){
    showAbout(true);
    var s = load(), last = lsGet('disc.bfLast'), html = app.getAttribute('data-intro') ? null : app.innerHTML;
    if(html !== null){ app.setAttribute('data-intro', '1'); app._intro = html; }
    app.innerHTML = app._intro;
    var box = $('bfStartBox');
    if(!box) return;
    var n = s ? answered(s) : 0;
    var parts = [];
    if(s && n > 0 && n < N) parts.push('<button type="button" class="btn" id="bfResume">' + esc(fmt(T.resume, {n: n, total: N})) + '</button>' +
      '<button type="button" class="linkbtn" id="bfRestart">' + esc(T.restart) + '</button>');
    else parts.push('<button type="button" class="btn" id="bfStart">' + esc(T.start) + '</button>');
    if(last && typeof last.a === 'string' && last.a.length === N) parts.push('<p class="bf-last"><button type="button" class="linkbtn" id="bfShowLast">' + esc(T.showLast) + '</button></p>');
    box.innerHTML = parts.join('');
    var b;
    if((b = $('bfStart'))) b.onclick = function(){ var x = blank(); lsSet('disc.bf', x); track('bf-start'); test(x); };
    if((b = $('bfResume'))) b.onclick = function(){ test(s); };
    if((b = $('bfRestart'))) b.onclick = function(){ var x = blank(); lsSet('disc.bf', x); track('bf-start'); test(x); };
    if((b = $('bfShowLast'))) b.onclick = function(){ result(last); };
  }

  /* ---- тест: 10 страниц по 10 утверждений, ответ 1–5 ---- */
  function test(s){
    showAbout(false);
    var p = Math.min(s.p || 0, PAGES - 1);
    // первая страница с неотвеченным утверждением, если вернулись к незаконченному тесту
    for(var q = 0; q < PAGES; q++){ if(s.a.slice(q * PER, q * PER + PER).indexOf('0') >= 0){ p = Math.min(p, q); break; } }
    page(s, p);
  }
  function page(s, p){
    s.p = p; lsSet('disc.bf', s);
    var from = p * PER, n = answered(s);
    var h = '<div class="bf-test"><div class="bf-prog" aria-hidden="true"><i style="width:' + Math.round(100 * n / N) + '%"></i></div>' +
      '<p class="bf-meta"><span>' + esc(fmt(T.step, {n: p + 1, total: PAGES})) + '</span><span id="bfCount">' + esc(fmt(T.count, {n: n, total: N})) + '</span></p>' +
      (p === 0 ? '<p class="bf-hint">' + esc(T.hint) + '</p>' : '') + '<ol class="bf-items" start="' + (from + 1) + '">';
    for(var i = from; i < from + PER; i++){
      var id = ORDER[i], v = +s.a.charAt(i);
      h += '<li class="bf-item' + (v ? ' done' : '') + '" id="bfI' + i + '"><p class="bf-q" id="bfQ' + i + '">' + esc(T.items[id]) + '</p>' +
        '<div class="bf-scale" role="radiogroup" aria-labelledby="bfQ' + i + '">';
      for(var k = 1; k <= 5; k++) h += '<label class="bf-opt"><input type="radio" name="bf' + i + '" value="' + k + '"' + (v === k ? ' checked' : '') + '><span class="dot" aria-hidden="true"></span><span class="sr">' + esc(T.scale[k - 1]) + '</span></label>';
      h += '</div><div class="bf-ends" aria-hidden="true"><span>' + esc(T.scale[0]) + '</span><span>' + esc(T.scale[4]) + '</span></div></li>';
    }
    h += '</ol><p class="bf-err" id="bfErr" role="alert" hidden>' + esc(T.needAll) + '</p><div class="bf-nav">' +
      (p > 0 ? '<button type="button" class="btn secondary" id="bfBack">' + esc(T.back) + '</button>' : '<span></span>') +
      '<button type="button" class="btn" id="bfNext">' + esc(p === PAGES - 1 ? T.finish : T.next) + '</button></div></div>';
    app.innerHTML = h;
    top();
    app.querySelectorAll('.bf-scale input').forEach(function(inp){
      inp.addEventListener('change', function(){
        var i = +inp.name.slice(2);
        setAns(s, i, inp.value); lsSet('disc.bf', s);
        var li = $('bfI' + i); if(li) li.className = 'bf-item done';
        var c = answered(s); $('bfCount').textContent = fmt(T.count, {n: c, total: N});
        app.querySelector('.bf-prog i').style.width = Math.round(100 * c / N) + '%';
        $('bfErr').hidden = true;
        // к следующему неотвеченному на этой странице
        for(var j = i + 1; j < from + PER; j++){ if(s.a.charAt(j) === '0'){ var nx = $('bfI' + j);
          if(nx && nx.getBoundingClientRect().top > window.innerHeight * .6) try{ nx.scrollIntoView({behavior: 'smooth', block: 'center'}); }catch(e){}
          break; } }
      });
    });
    var b;
    if((b = $('bfBack'))) b.onclick = function(){ page(s, p - 1); };
    $('bfNext').onclick = function(){
      var miss = s.a.slice(from, from + PER).indexOf('0');
      if(miss >= 0){ $('bfErr').hidden = false; var li = $('bfI' + (from + miss)); if(li) try{ li.scrollIntoView({behavior: 'smooth', block: 'center'}); }catch(e){} return; }
      if(p < PAGES - 1) return page(s, p + 1);
      var r = {a: s.a, d: Date.now()};
      lsSet('disc.bfLast', r); lsSet('disc.bf', null); track('bf-finish');
      result(r);
    };
  }

  /* ---- результат ---- */
  function bar(p){ return '<span class="bf-bar" aria-hidden="true"><i style="width:' + p + '%"></i><b style="left:' + p + '%"></b></span>'; }
  function result(r){
    showAbout(false);
    var sc = score(r.a), R = T.result, d = '';
    try{ d = new Date(r.d).toLocaleDateString(o.loc || 'ru-RU', {day: 'numeric', month: 'long', year: 'numeric'}); }catch(e){}
    var h = '<div class="bf-res"><div class="eyebrow">' + esc(R.eyebrow) + '</div><h2 class="bf-h">' + esc(R.title) + '</h2>' +
      (d ? '<p class="muted small">' + esc(fmt(R.date, {date: d})) + '</p>' : '') + '<p>' + esc(R.lead) + '</p>' +
      // сводка: пять черт на одной диаграмме
      '<div class="card bf-sum"><h3>' + esc(R.summary) + '</h3>' + TRAITS.map(function(t){ var k = t[0], p = sc.tr[k];
        return '<div class="bf-srow"><span class="nm">' + esc(T.traits[k].name) + '</span>' + bar(p) + '<span class="v">' + p + '</span></div>'; }).join('') +
      '<p class="muted small bf-scalecap">' + esc(R.scaleCap) + '</p></div>';
    TRAITS.forEach(function(t){ var k = t[0], p = sc.tr[k], TR = T.traits[k];
      h += '<section class="card bf-trait"><h3>' + esc(TR.name) + ' <span class="muted">· ' + esc(TR.en) + '</span></h3>' +
        '<p class="bf-pos"><strong>' + esc(fmt(R.above, {n: p})) + '</strong> · ' + esc(R.levels[level(p)]) + '</p>' + bar(p) +
        '<p class="muted small bf-what">' + esc(TR.what) + '</p><p>' + esc(TR[tier(p)]) + '</p><div class="bf-asps">' +
        t[1].map(function(a){ var q = sc.asp[a], A = T.aspects[a];
          return '<div class="bf-asp"><p class="bf-an"><strong>' + esc(A.name) + '</strong> <span class="muted small">' + esc(fmt(R.aboveShort, {n: q})) + '</span></p>' + bar(q) +
            '<p class="small">' + esc(A[tier(q) === 'high' ? 'high' : tier(q) === 'low' ? 'low' : 'mid']) + '</p></div>'; }).join('') + '</div></section>';
    });
    h += '<p class="muted small bf-note">' + esc(R.note) + '</p>' +
      '<aside class="card bf-disc"><h3>' + esc(R.disc.title) + '</h3><p>' + esc(R.disc.text) + '</p><p><a class="btn" href="' + esc(o.home) + '" data-goal="bf-disc">' + esc(R.disc.button) + '</a></p></aside>' +
      '<p class="bf-again"><button type="button" class="linkbtn" id="bfAgain">' + esc(R.again) + '</button></p></div>';
    app.innerHTML = h;
    top();
    // цель ссылки на тест DISC: page.html вешает data-goal только на ссылки, которые есть при загрузке
    var dl = app.querySelector('a[data-goal="bf-disc"]'); if(dl) dl.addEventListener('click', function(){ track('bf-disc'); });
    $('bfAgain').onclick = function(){ var x = blank(); lsSet('disc.bf', x); track('bf-start'); test(x); };
  }

  intro();
}
