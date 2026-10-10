// Локальный просмотр собранного сайта: node scripts/serve.js [port]
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'docs'), port = +(process.argv[2] || 8765);
const mockOrders = {};   // заказы заглушки оплаты (/mock-pay): живут, пока работает сервер
const types = { '.html': 'text/html; charset=utf-8', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && (p === '/mock-send' || p === '/mock-fail')) { // заглушка для локальной проверки отправки результата (письмо + база)
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      let j = null; try { j = JSON.parse(body); } catch (e) {}
      if (j && j.action === 'contact') console.log('mock-send contact:', j.name, '<' + j.email + '>', (j.files || []).map(f => f.name + ' (' + Math.round((f.data || '').length * 3 / 4 / 1024) + ' KB)').join(', ') || 'no files', 'hp=' + JSON.stringify(j.hp || ''));
      else console.log('mock-send:', body.slice(0, 200));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      // subscribed — как у настоящего скрипта: согласие на рассылку записано (в запросе subscribe:true или action:'subscribe')
      res.end(JSON.stringify(p === '/mock-send' ? { ok: true, saved: true, subscribed: !!(j && (j.subscribe === true || j.action === 'subscribe')) } : { ok: false, error: 'mock failure', saved: true }));
    }); return;
  }
  // Заглушка сервера оплаты для локальной проверки покупки расширенного отчёта (README → «Оплата расширенного отчёта»):
  // PAY_ENDPOINT=http://localhost:<порт>/mock-pay LANGS=ru node build.js. /mock-pay — заказ создаётся, «платёжная страница» с кнопками
  // «Оплатить» и «Отклонить»; статус: paid сразу после оплаты, sent через 8 секунд. /mock-pay-fail — сервер отказал.
  if (p.startsWith('/mock-pay')) {
    const q = new URL(req.url, 'http://x').searchParams, send = (code, type, body, head) => { res.writeHead(code, Object.assign({ 'Content-Type': type, 'Access-Control-Allow-Origin': '*' }, head)); res.end(body); };
    const json = o => send(200, 'application/json', JSON.stringify(o)), o = mockOrders[q.get('order')];
    if (req.method === 'POST' && (p === '/mock-pay/order' || p === '/mock-pay-fail/order')) {
      let body = ''; req.on('data', c => body += c); req.on('end', () => {
        let j = {}; try { j = JSON.parse(body); } catch (e) {}
        console.log('mock-pay order:', j.email, 'source=' + j.source, 'lang=' + j.lang, 'code=' + String(j.code || '').slice(0, 24) + '…');
        if (p === '/mock-pay-fail/order') return json({ ok: false, error: 'mock failure' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(j.email || '')) || String(j.email).length > 64) return json({ ok: false, error: 'bad email' });
        if (!/^DISC1\.[A-Za-z0-9_-]+$/.test(String(j.code || ''))) return json({ ok: false, error: 'bad code' });
        const d = new Date(), order = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        // куда «банк» вернёт покупателя: страница отчёта, с которой пришёл заказ (…/extended-report/), иначе русская версия
        let back = '/ru/extended-report/'; try { back = new URL(req.headers.referer).pathname.replace(/extended-report\/.*$/, 'extended-report/'); } catch (e) {}
        mockOrders[order] = { key: Math.random().toString(36).slice(2), paid: 0, back };
        json({ ok: true, order, key: mockOrders[order].key, url: '/mock-pay/form?order=' + order });
      }); return;
    }
    if (p === '/mock-pay/form' && o) return send(200, 'text/html; charset=utf-8', '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Заглушка платёжной страницы</title>' +
      '<body style="font:16px/1.5 system-ui,sans-serif;max-width:420px;margin:48px auto;padding:0 16px"><h1 style="font-size:22px">Заглушка платёжной страницы</h1>' +
      '<p>Заказ ' + q.get('order') + '. Настоящая страница банка здесь не открывается: это локальная проверка.</p>' +
      '<p><a href="/mock-pay/paid?order=' + q.get('order') + '" id="mockPay">Оплатить</a> · <a href="' + o.back + 'failed/?order=' + q.get('order') + '" id="mockDecline">Отклонить</a></p></body>');
    if (p === '/mock-pay/paid' && o) { o.paid = o.paid || Date.now(); return send(302, 'text/plain', '', { Location: o.back + 'thanks/?order=' + q.get('order') }); }
    if (p === '/mock-pay/status') return json(o && o.key === q.get('key') ? { ok: true, status: !o.paid ? 'new' : Date.now() - o.paid < 8000 ? 'paid' : 'sent' } : { ok: false, error: 'not found' });
    return send(404, 'text/plain', 'not found');
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
