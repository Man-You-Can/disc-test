// Стенд: какие запросы счётчик веб-аналитики отправляет со страниц сайта — без выхода в сеть.
//   curl -o /tmp/tag.js "https://mc.yandex.ru/metrika/tag.js?id=<yandexMetrikaId из site.config.json>"
//   node scripts/analytics-stand.js /tmp/tag.js [порт=8770] [папка сайта=docs]
// Отдаёт собранный сайт, подставляя в страницы сохранённый скрипт счётчика и перехватчик: все запросы к хостам счётчика
// (fetch, XMLHttpRequest, sendBeacon, картинки, скрипты) уходят на этот же сервер и записываются; в систему аналитики не уходит ничего.
//   http://localhost:8770/__mc/dump  — записанные запросы: адрес страницы, page-url, page-ref (хэш обрезан до длины) и в каких
//                                      параметрах или теле найден хэш с данными (#r=…, #u=…); поле leaks — сколько таких запросов
//   http://localhost:8770/__mc/reset — очистить запись
// Проверять с выдуманным кодом результата: страница с #r=…, смена языка, обновление, «Назад», 404, страница отчёта, отписка (#u=…).
// Запись посещений на стенде не запускается: её запросы стенд не проверяет.
const http = require('http'), fs = require('fs'), path = require('path');
const tagFile = path.resolve(process.argv[2] || 'tag.js'), port = +(process.argv[3] || 8770), root = path.resolve(process.argv[4] || path.join(__dirname, '..', 'docs'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
let log = [];
const SHIM = `<script>
(function(){
  function isMc(u){ try{ var x = new URL(String(u), location.href); return /(^|\\.)(yandex\\.[a-z.]+|yandexsport\\.ru|webvisor\\.(org|com)|yastatic\\.net)$/.test(x.hostname); }catch(e){ return false; } }
  function txt(b){ try{ if(b==null) return ''; if(typeof b==='string') return b; if(b instanceof URLSearchParams) return b.toString();
    if(b instanceof ArrayBuffer) return new TextDecoder('latin1').decode(new Uint8Array(b)); if(ArrayBuffer.isView(b)) return new TextDecoder('latin1').decode(b);
    if(b instanceof FormData){ var s=[]; b.forEach(function(v,k){ s.push(k+'='+v); }); return s.join('&'); } return '['+Object.prototype.toString.call(b)+']'; }catch(e){ return '[err]'; } }
  var realFetch = window.fetch.bind(window);
  function rec(kind,u,body){
    var payload = JSON.stringify({kind:kind, url:String(new URL(String(u), location.href).href), body:txt(body), href:location.href, ref:document.referrer, t:Math.round(performance.now())});
    realFetch('/__mc/log', {method:'POST', body:payload, keepalive:true}).catch(function(){});
    if(body instanceof Blob){ body.text().then(function(s){ realFetch('/__mc/log', {method:'POST', body:JSON.stringify({kind:kind+'-blob', url:String(u), body:s, href:location.href, ref:document.referrer, t:Math.round(performance.now())}), keepalive:true}); }); }
    return '/__mc/answer?kind='+kind;
  }
  window.fetch = function(input, init){ var u = typeof input==='string' ? input : (input && input.url);
    if(isMc(u)){ return realFetch(rec('fetch', u, init && init.body)); } return realFetch(input, init); };
  var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m,u){ if(isMc(u)){ this.__mc = String(u); var a=[].slice.call(arguments); a[0]='GET'; a[1]='/__mc/answer?kind=xhr'; return xo.apply(this,a); } return xo.apply(this,arguments); };
  XMLHttpRequest.prototype.send = function(b){ if(this.__mc){ rec('xhr', this.__mc, b); return xs.call(this); } return xs.apply(this,arguments); };
  if(navigator.sendBeacon){ var sb = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function(u,b){ if(isMc(u)){ rec('beacon', u, b); return true; } return sb(u,b); }; }
  ['HTMLImageElement','HTMLScriptElement','HTMLIFrameElement'].forEach(function(n){
    var P = window[n].prototype, d = Object.getOwnPropertyDescriptor(P,'src'); if(!d) return;
    Object.defineProperty(P,'src',{configurable:true, enumerable:d.enumerable, get:function(){ return d.get.call(this); },
      set:function(v){ if(isMc(v)){ var orig = String(v); v = rec(n==='HTMLImageElement'?'img':n==='HTMLScriptElement'?'script':'iframe', v); if(n==='HTMLScriptElement') v = '/__mc/script?name=' + encodeURIComponent(new URL(orig, location.href).pathname.split('/').pop()); } d.set.call(this,v); }});
  });
})();
</script>`;
function finds(s) {   // где в строке встречается хэш с личными данными (в чистом или закодированном виде)
  const out = []; let v = String(s || '');
  for (let i = 0; i < 3; i++) { if (/#(r|u)=|[#&]r=DISC1|DISC1\.eyJ/.test(v)) { out.push('enc' + i); break; } try { const d = decodeURIComponent(v); if (d === v) break; v = d; } catch (e) { break; } }
  return out.length > 0;
}
function analyse() {
  return log.map((e, i) => {
    let u, params = {}; try { u = new URL(e.url); u.searchParams.forEach((v, k) => { params[k] = v; }); } catch (x) { u = { pathname: e.url, host: '?' }; }
    const leak = Object.keys(params).filter(k => finds(params[k]));
    const bi = params['browser-info'] || '', flags = (bi.match(/(?:^|:)(pv|ar|nb|pa|ln|dl|wv|cm)[:]1/g) || []).map(s => s.replace(/^:/, '').replace(':1', ''));
    const cut = s => { s = String(s == null ? '' : s); const k = s.indexOf('#'); return k < 0 ? s : s.slice(0, k) + '#<cut:' + (s.length - k) + '>'; };
    return { i, kind: e.kind, t: e.t, endpoint: u.host + String(u.pathname).replace(/\d{6,}/, 'ID'), flags: flags.join(','), page: cut(e.href), docRef: cut(e.ref),
      nohit: params.nohit || '', 'page-url': cut(params['page-url']), 'page-ref': cut(params['page-ref']), leakParams: leak, leakBody: finds(e.body), leakPath: finds(String(u.pathname)), bodyLen: (e.body || '').length };
  });
}
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }); res.end(body); };
  if (p === '/__mc/log') { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { log.push(JSON.parse(b)); } catch (e) {} send(200, 'application/json', '{}'); }); return; }
  if (p === '/__mc/answer') { let st = { pcs: '0' }; try { st = JSON.parse(/mcSettings=(\{.*?\}),ytmConfig=/.exec(fs.readFileSync(tagFile, 'utf8').slice(0, 4000))[1]); } catch (e) {}
    return send(200, 'application/json', JSON.stringify({ settings: Object.assign(st, { eu: 0, hittoken: 'harness' }), userData: {} })); }
  if (p === '/__mc/tag.js') return send(200, 'text/javascript; charset=utf-8', fs.readFileSync(tagFile));
  if (p === '/__mc/script') { const f = path.join(path.dirname(tagFile), path.basename(new URL(req.url, 'http://x').searchParams.get('name') || 'x')); return fs.existsSync(f) ? send(200, 'text/javascript; charset=utf-8', fs.readFileSync(f)) : send(404, 'text/plain', 'no script'); }
  if (p === '/__mc/reset') { log = []; return send(200, 'text/plain', 'reset'); }
  if (p === '/__mc/dump') { const a = analyse(); return send(200, 'application/json', JSON.stringify({ total: a.length, leaks: a.filter(x => x.leakParams.length || x.leakBody || x.leakPath).length, rows: a }, null, 1)); }
  let file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) return send(403, 'text/plain', '');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) { if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); } file = path.join(file, 'index.html'); }
  let code = 200; if (!fs.existsSync(file)) { code = 404; file = path.join(root, '404.html'); }
  const ext = path.extname(file);
  if (ext === '.html') {
    let h = fs.readFileSync(file, 'utf8').split('https://mc.yandex.ru/metrika/tag.js').join('/__mc/tag.js');
    h = h.replace(/<head[^>]*>/i, m => m + SHIM);
    return send(code, types[ext], h);
  }
  send(code, types[ext] || 'application/octet-stream', fs.readFileSync(file));
}).listen(port, () => console.log('harness on http://localhost:' + port + ' root=' + root));
