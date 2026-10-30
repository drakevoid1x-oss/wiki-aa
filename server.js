// ويكي - سيرفر بدون أي مكتبات خارجية (Node فقط)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const PUB = path.join(__dirname, 'public');
let db = { users: {}, msgs: [] };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
let dirty = false;
const save = () => { dirty = false; try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (e) { console.error(e.message); } };
setInterval(() => dirty && save(), 2000);
['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => { save(); process.exit(); }));

const clients = new Map(); // username -> Set(res)
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const norm = s => String(s || '').trim().replace(/^@/, '').replace(/\s+/g, '').toLowerCase().slice(0, 24);
const auth = (u, t) => !!(db.users[u] && t && db.users[u].token === t);
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
const readBody = req => new Promise(ok => {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 300000) req.destroy(); });
  req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { ok({}); } });
});
const visible = (m, u) => m.c === 'all' || m.p.includes(u);
const push = (u, m) => (clients.get(u) || new Set()).forEach(r => r.write('data: ' + JSON.stringify(m) + '\n\n'));

async function api(req, res, url) {
  if (url.pathname === '/api/login' && req.method === 'POST') {
    const b = await readBody(req), u = norm(b.username), n = String(b.name || '').trim().slice(0, 30);
    if (!u || !n) return json(res, 400, { error: 'اكتب الاسم واسم المستخدم' });
    const ex = db.users[u];
    if (!ex) { const token = crypto.randomUUID(); db.users[u] = { name: n, token }; dirty = true; return json(res, 200, { token, name: n, username: u }); }
    if (b.token && b.token === ex.token) return json(res, 200, { token: ex.token, name: ex.name, username: u });
    return json(res, 409, { error: 'اسم المستخدم مأخوذ، اختار غيره' });
  }
  if (url.pathname === '/api/user') return json(res, 200, { exists: !!db.users[norm(url.searchParams.get('u'))] });
  if (url.pathname === '/api/send' && req.method === 'POST') {
    const b = await readBody(req), u = norm(b.username);
    if (!auth(u, b.token)) return json(res, 401, { error: 'غير مسجل' });
    const to = b.to === 'all' ? 'all' : norm(b.to);
    if (to !== 'all' && !db.users[to]) return json(res, 404, { error: 'المستخدم غير موجود' });
    const x = typeof b.x === 'string' ? b.x.slice(0, 1000) : '';
    const s = typeof b.s === 'string' && /^data:image\/(webp|png|jpeg);base64,/.test(b.s) && b.s.length < 150000 ? b.s : '';
    if (!x && !s) return json(res, 400, { error: 'رسالة فارغة' });
    const m = { id: Date.now() + '_' + crypto.randomBytes(3).toString('hex'), c: to === 'all' ? 'all' : [u, to].sort().join('|'), p: to === 'all' ? ['all'] : [u, to], u, n: db.users[u].name, t: Date.now(), x, s };
    db.msgs.push(m); if (db.msgs.length > 5000) db.msgs.splice(0, db.msgs.length - 5000); dirty = true;
    if (to === 'all') clients.forEach((_, k) => push(k, m)); else m.p.forEach(k => push(k, m));
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/events') {
    const u = norm(url.searchParams.get('u'));
    if (!auth(u, url.searchParams.get('t'))) return json(res, 401, { error: 'غير مسجل' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
    res.write('data: ' + JSON.stringify(db.msgs.filter(m => visible(m, u)).slice(-300)) + '\n\n');
    if (!clients.has(u)) clients.set(u, new Set());
    clients.get(u).add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(ping); const s = clients.get(u); if (s) { s.delete(res); if (!s.size) clients.delete(u); } });
    return;
  }
  json(res, 404, { error: 'not found' });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    let f = path.join(PUB, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d);
    });
  } catch (e) { res.writeHead(500); res.end(); }
}).listen(PORT, () => console.log('ويكي شغال على المنفذ ' + PORT));
