/* QR-код (ISO/IEC 18004) без сторонних библиотек: байтовый режим, уровень коррекции M, версии 1–10 (до 213 байт).
   Нужен печатной версии теста (src/print.js → scripts/make-pdf.js) и материалам для ведущих. Алгоритм — по открытому описанию
   стандарта (построение как в библиотеке Nayuki «QR Code generator»). qrSVG(text, o) → строка <svg> из квадратов модулей
   с полем в 4 модуля; o.dark — цвет, o.size — размер в CSS-единицах. Проверка распознавания — scripts/qr-check.swift. */
var QR_ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // кодовых слов коррекции на блок, уровень M, версии 1–10
var QR_BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];          // число блоков, уровень M

function qrMatrix(text){
  var bytes = [], s = unescape(encodeURIComponent(String(text)));   // UTF-8
  for(var i=0;i<s.length;i++) bytes.push(s.charCodeAt(i));
  var rawModules = function(v){ var r=(16*v+128)*v+64; if(v>=2){ var n=Math.floor(v/7)+2; r-=(25*n-10)*n-55; if(v>=7) r-=36; } return r; };
  var dataCw = function(v){ return Math.floor(rawModules(v)/8) - QR_ECC_M[v]*QR_BLOCKS_M[v]; };
  var ver = 0;
  for(var v=1; v<=10; v++){ if(4 + (v<10?8:16) + bytes.length*8 <= dataCw(v)*8){ ver=v; break; } }
  if(!ver) throw new Error('QR: слишком длинный текст');
  // поток данных: режим «байты», длина, данные, конец, выравнивание, заполнители 0xEC/0x11
  var bits = [];
  var put = function(val, len){ for(var k=len-1;k>=0;k--) bits.push((val>>>k)&1); };
  put(4,4); put(bytes.length, ver<10?8:16); bytes.forEach(function(b){ put(b,8); });
  var cap = dataCw(ver)*8;
  put(0, Math.min(4, cap-bits.length)); put(0, (8-bits.length%8)%8);
  for(var pad=0xEC; bits.length<cap; pad^=0xEC^0x11) put(pad,8);
  var data = []; for(i=0;i<bits.length;i+=8){ var b=0; for(var j=0;j<8;j++) b=(b<<1)|bits[i+j]; data.push(b); }
  // коррекция ошибок Рида — Соломона, поле GF(2^8) с многочленом 0x11D
  var mul = function(x,y){ var z=0; for(var k=7;k>=0;k--){ z=(z<<1)^((z>>>7)*0x11D); z^=((y>>>k)&1)*x; } return z; };
  var eccLen = QR_ECC_M[ver], nBlocks = QR_BLOCKS_M[ver];
  var div = []; for(i=0;i<eccLen-1;i++) div.push(0); div.push(1);
  var root = 1;
  for(i=0;i<eccLen;i++){ for(j=0;j<div.length;j++){ div[j]=mul(div[j],root); if(j+1<div.length) div[j]^=div[j+1]; } root=mul(root,2); }
  var rem = function(d){ var r=div.map(function(){ return 0; }); d.forEach(function(x){ var f=x^r.shift(); r.push(0); div.forEach(function(c,k){ r[k]^=mul(c,f); }); }); return r; };
  var rawCw = Math.floor(rawModules(ver)/8), nShort = nBlocks - rawCw%nBlocks, shortLen = Math.floor(rawCw/nBlocks), blocks = [], k = 0;
  for(i=0;i<nBlocks;i++){ var d = data.slice(k, k+shortLen-eccLen+(i<nShort?0:1)); k+=d.length; var e = rem(d); if(i<nShort) d.push(0); blocks.push(d.concat(e)); }
  var all = [];
  for(i=0;i<blocks[0].length;i++) for(j=0;j<blocks.length;j++) if(i!==shortLen-eccLen || j>=nShort) all.push(blocks[j][i]);
  // матрица: служебные узоры, затем данные, затем маска с наименьшим штрафом
  var size = ver*4+17, M = [], F = [];
  for(i=0;i<size;i++){ M.push([]); F.push([]); for(j=0;j<size;j++){ M[i].push(false); F[i].push(false); } }
  var setF = function(x,y,dark){ M[y][x]=dark; F[y][x]=true; };
  for(i=0;i<size;i++){ setF(6,i,i%2===0); setF(i,6,i%2===0); }
  var finder = function(x,y){ for(var dy=-4;dy<=4;dy++) for(var dx=-4;dx<=4;dx++){ var dist=Math.max(Math.abs(dx),Math.abs(dy)), xx=x+dx, yy=y+dy;
    if(xx>=0&&xx<size&&yy>=0&&yy<size) setF(xx,yy,dist!==2&&dist!==4); } };
  finder(3,3); finder(size-4,3); finder(3,size-4);
  var align = [];
  if(ver>1){ var na=Math.floor(ver/7)+2, step=Math.ceil((ver*4+4)/(na*2-2))*2; align=[6]; for(var pos=size-7; align.length<na; pos-=step) align.splice(1,0,pos); }
  align.forEach(function(ay,ii){ align.forEach(function(ax,jj){
    if((ii===0&&jj===0)||(ii===0&&jj===align.length-1)||(ii===align.length-1&&jj===0)) return;
    for(var dy=-2;dy<=2;dy++) for(var dx=-2;dx<=2;dx++) setF(ax+dx,ay+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1); }); });
  var formatBits = function(mask){ var d=(0<<3)|mask, r=d; for(var t=0;t<10;t++) r=(r<<1)^((r>>>9)*0x537); return ((d<<10)|r)^0x5412; };   // уровень M = 00
  var drawFormat = function(mask){ var fb=formatBits(mask), g=function(t){ return ((fb>>>t)&1)!==0; };
    for(var t=0;t<=5;t++) setF(8,t,g(t)); setF(8,7,g(6)); setF(8,8,g(7)); setF(7,8,g(8)); for(t=9;t<15;t++) setF(14-t,8,g(t));
    for(t=0;t<8;t++) setF(size-1-t,8,g(t)); for(t=8;t<15;t++) setF(8,size-15+t,g(t)); setF(8,size-8,true); };
  drawFormat(0);
  if(ver>=7){ var r7=ver; for(i=0;i<12;i++) r7=(r7<<1)^((r7>>>11)*0x1F25); var vb=(ver<<12)|r7;
    for(i=0;i<18;i++){ var bit=((vb>>>i)&1)!==0, a=size-11+i%3, c=Math.floor(i/3); setF(a,c,bit); setF(c,a,bit); } }
  var n = 0;
  for(var right=size-1; right>=1; right-=2){ if(right===6) right=5;
    for(var vert=0; vert<size; vert++) for(j=0;j<2;j++){ var x=right-j, up=((right+1)&2)===0, y=up?size-1-vert:vert;
      if(!F[y][x] && n<all.length*8){ M[y][x]=((all[n>>>3]>>>(7-(n&7)))&1)!==0; n++; } } }
  var maskFn = [function(x,y){return (x+y)%2===0;}, function(x,y){return y%2===0;}, function(x){return x%3===0;}, function(x,y){return (x+y)%3===0;},
    function(x,y){return (Math.floor(x/3)+Math.floor(y/2))%2===0;}, function(x,y){return x*y%2+x*y%3===0;},
    function(x,y){return (x*y%2+x*y%3)%2===0;}, function(x,y){return ((x+y)%2+x*y%3)%2===0;}];
  var applyMask = function(m){ for(var y=0;y<size;y++) for(var x=0;x<size;x++) if(!F[y][x] && maskFn[m](x,y)) M[y][x]=!M[y][x]; };
  var penalty = function(){ var p=0, x, y, run, dark=0;
    var lines = function(get){ for(var a=0;a<size;a++){ run=1; for(var b=1;b<size;b++){ if(get(a,b)===get(a,b-1)){ run++; if(run===5) p+=3; else if(run>5) p++; } else run=1; }
      for(b=0;b+10<size;b++){ var s=''; for(var t=0;t<11;t++) s+=get(a,b+t)?'1':'0'; if(s==='10111010000'||s==='00001011101') p+=40; } } };
    lines(function(a,b){ return M[a][b]; }); lines(function(a,b){ return M[b][a]; });
    for(y=0;y<size-1;y++) for(x=0;x<size-1;x++){ var c=M[y][x]; if(c===M[y][x+1]&&c===M[y+1][x]&&c===M[y+1][x+1]) p+=3; }
    for(y=0;y<size;y++) for(x=0;x<size;x++) if(M[y][x]) dark++;
    p += Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10; return p; };
  var best=0, bestP=Infinity;
  for(var m=0;m<8;m++){ applyMask(m); drawFormat(m); var pp=penalty(); if(pp<bestP){ bestP=pp; best=m; } applyMask(m); }
  applyMask(best); drawFormat(best);
  return M;
}

function qrSVG(text, o){
  o = o || {};
  var M = qrMatrix(text), n = M.length, q = 4, d = '';
  for(var y=0;y<n;y++) for(var x=0;x<n;x++) if(M[y][x]) d += 'M'+(x+q)+' '+(y+q)+'h1v1h-1z';
  var s = n+q*2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+s+' '+s+'"'+(o.size?' width="'+o.size+'" height="'+o.size+'"':'')+' shape-rendering="crispEdges" role="img"'+
    (o.label?' aria-label="'+String(o.label).replace(/"/g,'&quot;')+'"':'')+'><rect width="'+s+'" height="'+s+'" fill="#fff"/><path d="'+d+'" fill="'+(o.dark||'#000')+'"/></svg>';
}
if (typeof module !== 'undefined' && module.exports) { module.exports = qrSVG; module.exports.qrMatrix = qrMatrix; }
