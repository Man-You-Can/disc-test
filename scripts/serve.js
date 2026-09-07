// Локальный просмотр собранного сайта: node scripts/serve.js [port]
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'docs'), port = +(process.argv[2] || 8765);
const types = { '.html': 'text/html; charset=utf-8', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && (p === '/mock-send' || p === '/mock-fail')) { // заглушка для локальной проверки отправки результата (письмо + база)
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      let j = null; try { j = JSON.parse(body); } catch (e) {}
      if (j && j.action === 'contact') console.log('mock-send contact:', j.name, '<' + j.email + '>', (j.files || []).map(f => f.name + ' (' + Math.round((f.data || '').length * 3 / 4 / 1024) + ' KB)').join(', ') || 'no files', 'hp=' + JSON.stringify(j.hp || ''));
      else console.log('mock-send:', body.slice(0, 200));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(p === '/mock-send' ? { ok: true, saved: true } : { ok: false, error: 'mock failure', saved: true }));
    }); return;
  }
  let file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); const nf = path.join(root, '404.html'); return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found'); } // 404.html может отсутствовать в момент пересборки docs/
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}).listen(port, () => console.log('serving docs/ on http://localhost:' + port));
