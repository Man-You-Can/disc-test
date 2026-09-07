/* График профиля DISC (SVG). Один код для страницы отчёта (в браузере) и для сборки
   (примеры результата на страницах профилей). sc = {most, least, net} по ключам D/I/S/C,
   show = {most, least, net} — какие линии рисовать, o = {label, colorVar, keys}. */
function graphSVG(sc, show, o){
  var KEYS = o.keys || ['D','I','S','C'], colorVar = o.colorVar;
  var W=380,H=252,Lm=34,R=14,T=14,B=32,pw=W-Lm-R,ph=H-T-B;
  function x(i){ return (Lm+pw*(i+0.5)/4).toFixed(1); }
  function y(v){ return (T+ph*(24-v)/24).toFixed(1); }
  var g='';
  [0,6,12,18,24].forEach(function(v){
    var mid = v===12;
    g+='<line x1="'+Lm+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="'+(mid?'var(--line-strong)':'var(--line)')+'" stroke-width="'+(mid?1.5:1)+'"'+(mid?' stroke-dasharray="4 3"':'')+'/>';
    g+='<text x="'+(Lm-7)+'" y="'+(+y(v)+3.5)+'" text-anchor="end" class="ax">'+v+'</text>';
  });
  KEYS.forEach(function(k,i){ g+='<text x="'+x(i)+'" y="'+(H-9)+'" text-anchor="middle" class="kl" fill="'+colorVar(k)+'">'+k+'</text>'; });
  var series=[
    {key:'most', cls:'s1', vals:KEYS.map(function(k){ return sc.most[k]; })},
    {key:'least', cls:'s2', vals:KEYS.map(function(k){ return 24-sc.least[k]; })},
    {key:'net', cls:'s3', vals:KEYS.map(function(k){ return (sc.net[k]+24)/2; })}
  ];
  series.forEach(function(s){
    if(!show[s.key]) return;
    g+='<polyline class="'+s.cls+'" points="'+s.vals.map(function(v,i){ return x(i)+','+y(v); }).join(' ')+'"/>';
    s.vals.forEach(function(v,i){
      var main = s.key==='net';
      g+='<circle class="'+s.cls+'" cx="'+x(i)+'" cy="'+y(v)+'" r="'+(main?5.5:3.5)+'" fill="'+(main?colorVar(KEYS[i]):'var(--surface)')+'"'+(main?'':' stroke="var(--muted)"')+'/>';
    });
  });
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+(o.label||'')+'">'+g+'</svg>';
}
if (typeof module !== 'undefined' && module.exports) module.exports = graphSVG;
