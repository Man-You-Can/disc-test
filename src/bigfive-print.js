/* Бланк теста «Большая пятёрка» для печати (с 2026-11-16, по просьбе заказчика; пока русская версия): 100 утверждений в порядке онлайн-теста,
   таблица подсчёта (номера утверждений по аспектам, обратные — со звёздочкой), таблица уровней и описание черт и аспектов.
   Используется scripts/make-bigfive-pdf.js: HTML печатается headless Chrome в src/assets/pdf/big-five-test-<язык>.pdf, сборка кладёт файл в docs/pdf/.
   Тексты — content.bigfive.paper.print, утверждения и описания — content.bigfive; порядок, ключи и нормы — из src/bigfive.js (c.K). */
function bigfivePrintHTML(c){
  var L=c.L, B=L.content.bigfive, P=B.paper.print, K=c.K, esc=c.esc, url=c.url, testUrl=c.testUrl, qr=c.qr, fontsCss=c.fontsCss||'', fontFamily=c.fontFamily||'sans-serif';
  var fmt=function(s, v){ return String(s).replace(/\{(\w+)\}/g, function(m, k){ return v && k in v ? v[k] : m; }); };
  var site=url.replace(/^https?:\/\//,'').replace(/\/$/,'');
  var bare=function(u){ return String(u).replace(/^https?:\/\//,'').replace(/\?.*$/,''); };
  var qrBox=function(u){ return '<div class="qr">'+qr(u,{dark:'#111'})+'</div>'; };
  var link=function(u){ var b=esc(bare(u)); return '<a href="'+esc(u)+'">'+b+'</a>'; };
  // номер утверждения на бланке — его место в порядке онлайн-теста (1–100)
  var pos={}; K.ORDER.forEach(function(id, i){ pos[id]=i+1; });
  var rev=function(id){ return +id.slice(2) > K.POS[id.slice(0,2)]; };
  // уровень по сумме — тем же расчётом, что онлайн (pctl и level из src/bigfive.js)
  var ranges=function(key, from, to, div){ var r=[[],[],[],[],[]];
    for(var x=from; x<=to; x++){ r[K.level(K.pctl(key, x/div))].push(x); }
    return r.map(function(a){ return a.length ? (a.length>1 ? a[0]+'–'+a[a.length-1] : ''+a[0]) : '—'; }); };
  var cap=function(s){ s=String(s); return s.charAt(0).toUpperCase()+s.slice(1); };
  var circles=[1,2,3,4,5].map(function(n){ return '<td class="o"><span>'+n+'</span></td>'; }).join('');
  var items='<table class="items"><thead><tr><th class="n">№</th><th></th>'+B.scale.map(function(s, i){ return '<th class="sc"><b>'+(i+1)+'</b>'+esc(s)+'</th>'; }).join('')+'</tr></thead><tbody>'+
    K.ORDER.map(function(id, i){ return '<tr><td class="n">'+(i+1)+'</td><td class="t">'+esc(B.items[id])+'</td>'+circles+'</tr>'; }).join('')+'</tbody></table>';
  var score='<table class="score"><thead><tr><th>'+esc(P.colScale)+'</th><th colspan="10"></th><th class="s">'+esc(P.colAspect)+'</th><th class="s">'+esc(P.colTrait)+'</th></tr></thead><tbody>'+
    K.TRAITS.map(function(t){ return t[1].map(function(a, j){
      var ids=Object.keys(pos).filter(function(id){ return id.slice(0,2)===a; }).sort(function(x, y){ return pos[x]-pos[y]; });
      return '<tr'+(j===0?' class="first"':'')+'><td class="nm">'+(j===0?'<b>'+esc(B.traits[t[0]].name)+'</b>':'')+'<span>'+esc(B.aspects[a].name)+'</span></td>'+
        ids.map(function(id){ return '<td class="cell"><i>'+pos[id]+(rev(id)?'*':'')+'</i></td>'; }).join('')+'<td class="sum"></td>'+(j===0?'<td class="sum tr" rowspan="2"></td>':'')+'</tr>'; }).join(''); }).join('')+'</tbody></table>';
  var lv=B.result.levels;
  var levels='<table class="levels"><thead><tr><th></th>'+lv.map(function(s){ return '<th>'+esc(cap(s))+'</th>'; }).join('')+'</tr></thead><tbody>'+
    K.TRAITS.map(function(t){ return '<tr class="tr"><td><b>'+esc(B.traits[t[0]].name)+'</b></td>'+ranges(t[0], 20, 100, 20).map(function(x){ return '<td>'+x+'</td>'; }).join('')+'</tr>'+
      t[1].map(function(a){ return '<tr><td class="as">'+esc(B.aspects[a].name)+'</td>'+ranges(a, 10, 50, 10).map(function(x){ return '<td>'+x+'</td>'; }).join('')+'</tr>'; }).join(''); }).join('')+'</tbody></table>';
  var meaning='<div class="meaning">'+K.TRAITS.map(function(t){ var T=B.traits[t[0]];
    return '<section class="mt"><h3>'+esc(T.name)+' <span>('+esc(T.en)+')</span></h3><p>'+esc(T.what)+'</p>'+t[1].map(function(a){ var A=B.aspects[a];
      return '<div class="ma"><b>'+esc(A.name)+'</b><p><em>'+esc(P.high)+':</em> '+esc(A.high)+'</p><p><em>'+esc(P.low)+':</em> '+esc(A.low)+'</p></div>'; }).join('')+'</section>'; }).join('')+'</div>';
  return '<!doctype html><html lang="'+L.lang+'" dir="'+L.dir+'"><head><meta charset="utf-8"><title>'+esc(P.title)+'</title><style>'+fontsCss+'\n'+CSS.replace('__FONT__',fontFamily)+'</style></head><body>'+
    // шапка с логотипом и адресом на каждом листе — как в бланке DISC (src/print.js)
    '<header class="head"><div class="brand"><span class="dots"><i class="d"></i><i class="i"></i><i class="s"></i><i class="c"></i></span>'+esc(L.brand)+'</div><div class="url">'+esc(site)+'</div></header>'+
    '<table class="pgwrap"><thead><tr><td><div class="hspace"></div></td></tr></thead><tbody><tr><td>'+
    '<h1>'+esc(P.title)+'</h1><p class="sub">'+esc(P.sub)+'</p>'+
    '<div class="fields"><div><span>'+esc(P.name)+':</span><i></i></div><div><span>'+esc(P.date)+':</span><i></i></div></div>'+
    '<div class="cta">'+qrBox(testUrl)+'<div><b>'+esc(P.ctaTitle)+'</b><p>'+esc(fmt(P.ctaText, {url: '\u0000'})).replace('\u0000', link(testUrl))+'</p></div></div>'+
    '<div class="how"><h2>'+esc(P.howTitle)+'</h2><p>'+esc(P.howText)+'</p></div>'+
    items+
    '<div class="pb"></div><h2 class="first">'+esc(P.scoreTitle)+'</h2><p>'+esc(P.scoreText)+'</p>'+score+
    '<div class="qrrow">'+qrBox(testUrl)+'<div><b>'+esc(P.qrTitle)+'</b><p>'+esc(P.qrText)+'</p></div></div>'+
    '<div class="pb"></div><h2 class="first">'+esc(P.levelsTitle)+'</h2><p>'+esc(P.levelsText)+'</p>'+levels+
    '<h2>'+esc(P.meaningTitle)+'</h2>'+meaning+
    '<p class="note">'+esc(fmt(P.note, {site: site}))+'</p>'+
    '</td></tr></tbody></table></body></html>';
}
var CSS='@page{size:A4;margin:8mm 13mm 12mm}*{box-sizing:border-box}body{font-family:__FONT__;font-size:10pt;line-height:1.35;color:#111;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
  'h1{font-size:19pt;margin:0 0 1mm}h2{font-size:13.5pt;margin:6mm 0 2mm}h2.first{margin-top:0}h3{font-size:11pt;margin:0 0 1mm}p{margin:0 0 2.5mm}a{color:#3B6FB6;text-decoration:none;white-space:nowrap}'+
  '.head{position:fixed;top:0;left:0;right:0;height:8mm;background:#fff;display:flex;justify-content:space-between;align-items:center;font-size:9.5pt;color:#555;border-bottom:1px solid #ccc}'+
  '.pgwrap{width:100%;border-collapse:collapse}.pgwrap>thead>tr>td,.pgwrap>tbody>tr>td{padding:0;border:0}.hspace{height:12mm}'+
  '.brand{font-weight:600;color:#111;display:flex;align-items:center;gap:2mm}.dots{display:inline-grid;grid-template-columns:1fr 1fr;gap:1px}.dots i{width:2.2mm;height:2.2mm;border-radius:50%;display:block}'+
  '.dots .d{background:#C9453D}.dots .i{background:#D6961F}.dots .s{background:#3A9A69}.dots .c{background:#3B6FB6}'+
  '.sub{color:#555;margin-bottom:3mm}.fields{display:flex;gap:8mm;margin:3mm 0 4mm}.fields div{flex:1;display:flex;align-items:flex-end;gap:2mm}.fields i{flex:1;border-bottom:1px solid #333;height:6mm}'+
  '.cta,.qrrow{display:flex;gap:4mm;align-items:center;border:1.5px solid #3B6FB6;background:#EEF3FA;border-radius:2mm;padding:2mm 4mm 2mm 2.5mm;margin-bottom:4mm;break-inside:avoid}'+
  '.cta b,.qrrow b{font-size:11pt}.cta p,.qrrow p{margin:0.8mm 0 0}.qrrow{margin-top:4mm}'+
  '.qr{flex:none;width:21mm}.qr svg{display:block;width:21mm;height:21mm}'+
  '.how{border:1px solid #bbb;border-radius:2mm;padding:3mm 4mm;margin-bottom:4mm}.how h2{margin:0 0 1.5mm;font-size:11pt}.how p{margin:0}'+
  '.items{width:100%;border-collapse:collapse}.items thead th{font-weight:400;font-size:7pt;line-height:1.15;color:#555;vertical-align:bottom;padding:0 0.5mm 1.5mm;border-bottom:1.2px solid #333}'+
  '.items th.sc{width:15mm;text-align:center;overflow-wrap:normal;word-break:normal;hyphens:none}.items th.sc b{display:block;font-size:9.5pt;color:#111}.items th.n,.items td.n{width:8.5mm;text-align:center;color:#555}'+
  '.items td{border-bottom:1px solid #e2e2e2;padding:0.62mm 0.5mm;vertical-align:middle}.items tr{break-inside:avoid}.items td.t{padding-inline-end:2mm}'+
  '.items td.o{text-align:center}.items td.o span{display:inline-block;width:5mm;height:5mm;line-height:4.6mm;border:1px solid #888;border-radius:50%;font-size:8pt;color:#555;text-align:center}'+
  '.items tbody tr:nth-child(10n) td{border-bottom:1.2px solid #999}'+
  '.pb{break-before:page;page-break-before:always}'+
  '.score{width:100%;border-collapse:collapse;margin-top:2mm}.score th{font-size:8.5pt;font-weight:600;color:#555;text-align:start;padding:0 1mm 1mm}.score th.s{text-align:center;width:16mm;line-height:1.15}'+
  '.score td{border:1px solid #999;padding:0}.score td.nm{width:38mm;padding:1mm 1.5mm;font-size:9pt;line-height:1.2}.score td.nm b{display:block;font-size:9.5pt}.score td.nm span{color:#333}'+
  '.score tr.first td{border-top:1.6px solid #333}.score td.cell{width:10.6mm;height:11mm;vertical-align:top}.score td.cell i{display:block;font-style:normal;font-size:7pt;color:#555;padding:0.4mm 0 0 0.8mm}'+
  '.score td.sum{width:16mm;background:#f4f4f4}.score td.sum.tr{background:#EEF3FA}'+
  '.levels{width:100%;border-collapse:collapse;font-size:9pt}.levels th{font-size:8pt;font-weight:600;color:#555;padding:0 1mm 1mm;text-align:center;line-height:1.15}'+
  '.levels td{border-bottom:1px solid #ddd;padding:1mm;text-align:center}.levels td:first-child{text-align:start;width:46mm}.levels tr.tr td{border-top:1.4px solid #333;background:#f4f4f4}.levels td.as{padding-inline-start:4mm;color:#333}'+
  '.meaning{column-count:2;column-gap:6mm}.mt{break-inside:avoid;margin-bottom:3.5mm}.mt h3 span{font-weight:400;color:#555}.mt>p{font-size:9pt;color:#333;margin:0 0 1.5mm}'+
  '.ma{margin:0 0 1.8mm}.ma b{font-size:9.5pt;color:#3B6FB6}.ma p{font-size:8.8pt;margin:0.3mm 0 0;color:#333}.ma em{font-style:normal;color:#666}'+
  '.note{margin-top:4mm;padding-top:2mm;border-top:1px solid #ccc;font-size:8.5pt;color:#555}';
if (typeof module !== 'undefined' && module.exports) module.exports = bigfivePrintHTML;
