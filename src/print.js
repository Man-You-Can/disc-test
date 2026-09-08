/* Печатная версия теста (PDF): опросник на 24 блока, ключ к стилям, таблица подсчёта, правило
   определения профиля и описание 16 профилей. Используется scripts/make-pdf.js: HTML печатается
   headless Chrome в src/assets/pdf/disc-test-<язык>.pdf, а сборка кладёт файлы в docs/pdf/. */
function printHTML(c){
  var L=c.L, t=c.t, esc=c.esc, KEYS=c.KEYS, PROFILE_KEYS=c.PROFILE_KEYS, BLOCK_KEYS=c.BLOCK_KEYS, url=c.url, fontsCss=c.fontsCss||'', fontFamily=c.fontFamily||'sans-serif';
  var strip=function(s){ return String(s).replace(/<br\s*\/?>/g,' ').replace(/<[^>]+>/g,''); };
  var most=strip(t('test.mostHead')), least=strip(t('test.leastHead'));
  var box='<span class="box"></span>';
  var blocks=L.blocks.map(function(b,i){
    var order=BLOCK_KEYS[i].split('');
    return '<section class="block"><h3>'+esc(t('print.block',{n:i+1}))+'</h3><table><thead><tr><th class="c">+</th><th class="c">−</th><th></th></tr></thead><tbody>'+
      order.map(function(k){ return '<tr><td class="c">'+box+'</td><td class="c">'+box+'</td><td>'+esc(b[k])+'</td></tr>'; }).join('')+'</tbody></table></section>';
  }).join('');
  var keyTable=function(from,to){
    return '<table class="key"><thead><tr><th>'+esc(t('print.keyBlock'))+'</th><th colspan="4">'+esc(t('print.keyRows'))+'</th></tr></thead><tbody>'+
      BLOCK_KEYS.slice(from,to).map(function(o,i){ return '<tr><td class="n">'+(from+i+1)+'</td>'+o.split('').map(function(k){ return '<td class="c">'+k+'</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table>';
  };
  var count='<table class="count"><thead><tr><th>'+esc(t('print.styleHead'))+'</th><th>'+esc(t('print.countMost'))+'</th><th>'+esc(t('print.countLeast'))+'</th><th>'+esc(t('print.countNet'))+'</th></tr></thead><tbody>'+
    KEYS.map(function(k){ return '<tr><td><b class="k">'+k+'</b> '+esc(L.keys[k])+'</td><td class="w"></td><td class="w"></td><td class="w"></td></tr>'; }).join('')+'</tbody></table>';
  var profiles='<div class="profiles">'+PROFILE_KEYS.map(function(k){ var p=L.profiles[k]; return '<div class="prof"><b>'+k+'</b> <strong>'+esc(p.name)+'</strong><p>'+esc(p.summary)+'</p></div>'; }).join('')+'</div>';
  return '<!doctype html><html lang="'+L.lang+'" dir="'+L.dir+'"><head><meta charset="utf-8"><title>'+esc(t('print.title'))+'</title><style>'+fontsCss+'\n'+CSS.replace('__FONT__',fontFamily)+'</style></head><body>'+
    '<header class="head"><div class="brand"><span class="dots"><i class="d"></i><i class="i"></i><i class="s"></i><i class="c"></i></span>'+esc(L.brand)+'</div><div class="url">'+esc(url)+'</div></header>'+
    '<h1>'+esc(t('print.title'))+'</h1><p class="sub">'+esc(L.ui.footer)+'</p>'+
    '<div class="fields"><div><span>'+esc(t('print.name'))+':</span><i></i></div><div><span>'+esc(t('print.date'))+':</span><i></i></div></div>'+
    '<div class="how"><h2>'+esc(t('print.howTitle'))+'</h2><p>'+esc(t('print.howText'))+'</p><p class="legend"><b>+</b> '+esc(most)+' &nbsp;&nbsp;&nbsp; <b>−</b> '+esc(least)+'</p></div>'+
    '<div class="blocks">'+blocks+'</div>'+
    '<div class="pb"></div>'+
    '<h2>'+esc(t('print.keyTitle'))+'</h2><p>'+esc(t('print.keyText'))+'</p><div class="keys">'+keyTable(0,12)+keyTable(12,24)+'</div>'+
    '<h2>'+esc(t('print.countTitle'))+'</h2><p>'+esc(t('print.countText'))+'</p>'+count+
    '<h2>'+esc(t('print.decodeTitle'))+'</h2><p>'+esc(t('print.decodeText'))+'</p>'+
    '<div class="pb"></div>'+
    '<h2 class="first">'+esc(t('print.profilesTitle'))+'</h2>'+profiles+
    '<p class="online">'+esc(t('print.online',{url:url}))+'</p>'+
    '</body></html>';
}
var CSS='@page{size:A4;margin:13mm 13mm 15mm}*{box-sizing:border-box}body{font-family:__FONT__;font-size:10.5pt;line-height:1.35;color:#111;margin:0}'+
  'h1{font-size:19pt;margin:5mm 0 1mm}h2{font-size:13.5pt;margin:6mm 0 2mm}h2.first{margin-top:0}h3{font-size:10.5pt;margin:0 0 1.5mm}p{margin:0 0 2.5mm}'+
  '.head{display:flex;justify-content:space-between;align-items:center;font-size:9.5pt;color:#555;border-bottom:1px solid #ccc;padding-bottom:2mm}'+
  '.brand{font-weight:600;color:#111;display:flex;align-items:center;gap:2mm}.dots{display:inline-grid;grid-template-columns:1fr 1fr;gap:1px}.dots i{width:2.2mm;height:2.2mm;border-radius:50%;display:block}'+
  '.dots .d{background:#C9453D}.dots .i{background:#D6961F}.dots .s{background:#3A9A69}.dots .c{background:#3B6FB6}.url{direction:ltr}'+
  '.sub{color:#555;margin-bottom:3mm}.fields{display:flex;gap:8mm;margin:3mm 0 4mm}.fields div{flex:1;display:flex;align-items:flex-end;gap:2mm}.fields i{flex:1;border-bottom:1px solid #333;height:6mm}'+
  '.how{border:1px solid #bbb;border-radius:2mm;padding:3mm 4mm;margin-bottom:4mm}.how h2{margin:0 0 1.5mm;font-size:11pt}.how p:last-child{margin:0}'+
  '.legend b{display:inline-block;width:5mm;height:5mm;line-height:4.4mm;text-align:center;border:1.2px solid #333;border-radius:0.8mm;font-weight:600}'+
  '.blocks{display:grid;grid-template-columns:1fr 1fr;gap:3mm 6mm;align-items:start}'+
  '.block{break-inside:avoid;page-break-inside:avoid;border:1px solid #ccc;border-radius:2mm;padding:2mm 2.5mm}.block table{width:100%;border-collapse:collapse}'+
  '.block th{font-weight:600;font-size:9.5pt;color:#555;padding:0 0 1mm;text-align:start}.block td{padding:0.9mm 0.5mm;vertical-align:middle;border-top:1px solid #eee}.block .c{width:7mm;text-align:center}'+
  '.box{display:inline-block;width:4.5mm;height:4.5mm;border:1.2px solid #333;border-radius:0.8mm;vertical-align:middle}'+
  '.pb{break-before:page;page-break-before:always}'+
  '.keys{display:flex;gap:8mm;margin-bottom:3mm}.keys table{flex:1;border-collapse:collapse;font-size:10pt}.keys th,.keys td{border:1px solid #bbb;padding:0.8mm 1.5mm;text-align:center}.keys td.n{font-weight:600;background:#f2f2f2}'+
  '.count{border-collapse:collapse;width:100%;margin-bottom:3mm}.count th,.count td{border:1px solid #bbb;padding:1.8mm 2mm;text-align:start}.count th{background:#f2f2f2;font-weight:600;font-size:9.5pt}.count td.w{width:22%}.count .k{display:inline-block;min-width:5mm}'+
  '.profiles{column-count:2;column-gap:6mm}.prof{break-inside:avoid;margin-bottom:2.8mm}.prof b{display:inline-block;min-width:8mm;font-weight:700;color:#3B6FB6}.prof p{font-size:9.5pt;color:#333;margin:0.5mm 0 0}'+
  '.online{margin-top:5mm;padding-top:2mm;border-top:1px solid #ccc;font-size:9.5pt;color:#555}';
if (typeof module !== 'undefined' && module.exports) module.exports = printHTML;
