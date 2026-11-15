// قعدة ساعتك: سيرفر بسيط يعرض القعدة ويجمع الإحصائيات (أرقام فقط، بلا أسماء ولا صور)
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DATA = process.env.STATS_FILE || path.join(__dirname, 'stats.json');
const NAMES = { P: 'ساعة الحنين', N: 'ساعة الأمس', H: 'ساعة الآن', F: 'ساعة الانتظار', U: 'ساعة الغد' };
const EVENTS = { start: 'بدأ', done: 'أنهى', save: 'حفظ الصورة', share: 'شارك', offline: 'نزّل نسخة أوفلاين', install: 'ضغط تنزيل كتطبيق' };

let stats = { visits: 0, ev: {}, top: { P: 0, N: 0, H: 0, F: 0, U: 0 }, balSum: 0, days: {} };
try { stats = Object.assign(stats, JSON.parse(fs.readFileSync(DATA, 'utf8'))); } catch (e) {}
// ترحيل من النسخة القديمة
if (stats.starts) { stats.ev.start = (stats.ev.start || 0) + stats.starts; delete stats.starts; }
if (stats.done && typeof stats.done === 'number') { stats.ev.done = (stats.ev.done || 0) + stats.done; delete stats.done; }

let dirty = false;
setInterval(() => { if (dirty) { dirty = false; fs.writeFile(DATA, JSON.stringify(stats), () => {}); } }, 5000);
const today = () => new Date().toISOString().slice(0, 10);
const bump = (k) => { const d = today(); stats.days[d] = stats.days[d] || {}; stats.days[d][k] = (stats.days[d][k] || 0) + 1; dirty = true; };

app.use(express.json({ limit: '2kb' }));
app.get(['/', '/index.html'], (req, res, next) => { stats.visits++; bump('visit'); next(); });
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); } }));

app.post('/api/e', (req, res) => {
  const b = req.body || {};
  if (!EVENTS[b.t]) return res.status(204).end();
  stats.ev[b.t] = (stats.ev[b.t] || 0) + 1; bump(b.t);
  if (b.t === 'done') {
    if (stats.top[b.top] != null) stats.top[b.top]++;
    const bal = Number(b.bal);
    if (bal >= 0 && bal <= 100) stats.balSum += bal;
  }
  dirty = true;
  res.status(204).end();
});

const page = (title, body) => `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font-family:system-ui;background:#F4F5F8;color:#1D2230;max-width:620px;margin:0 auto;padding:24px 16px}
h1{font-size:24px}h2{font-size:17px;margin-top:24px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.c{background:#fff;border-radius:14px;padding:14px;text-align:center}
.c b{display:block;font-size:28px}table{width:100%;margin-top:8px;background:#fff;border-radius:14px;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #eee;text-align:right}
.m{color:#6E7385;font-size:13px}</style>${body}</html>`;
const summary = () => {
  const done = stats.ev.done || 0;
  const tops = Object.entries(stats.top).sort((a, b) => b[1] - a[1]);
  return { done, tops, avg: done ? Math.round(stats.balSum / done) : 0 };
};

// إحصائيات عامة مختصرة
app.get('/stats', (req, res) => {
  const { done, tops, avg } = summary();
  const rows = tops.map(([k, v]) => `<tr><td>${NAMES[k]}</td><td>${v}</td><td>${done ? Math.round(100 * v / done) : 0}%</td></tr>`).join('');
  res.type('html').send(page('إحصائيات قعدة ساعتك', `<h1>إحصائيات قعدة ساعتك</h1>
<div class="g"><div class="c"><b>${stats.visits}</b>زيارة</div><div class="c"><b>${stats.ev.start || 0}</b>بدأ</div><div class="c"><b>${done}</b>أنهى</div></div>
<p>متوسط توازن الساعات: <b>${avg}%</b> · أكثر نتيجة: <b>${done ? NAMES[tops[0][0]] : '—'}</b></p>
<table><tr><th>الساعة</th><th>العدد</th><th>النسبة</th></tr>${rows}</table>`));
});

// صفحة الإدارة بمفتاح: /admin?key=...
app.get('/admin', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).type('html').send(page('دخول', '<h1>صفحة الإدارة</h1><p>هذه الصفحة تحتاج المفتاح: <code>/admin?key=المفتاح</code>. المفتاح موجود في إعدادات الخدمة على Render باسم ADMIN_KEY.</p>'));
  const { done, tops, avg } = summary();
  const ev = Object.entries(EVENTS).map(([k, n]) => `<tr><td>${n}</td><td>${stats.ev[k] || 0}</td></tr>`).join('');
  const days = Object.keys(stats.days).sort().reverse().slice(0, 14).map(d => { const x = stats.days[d]; return `<tr><td>${d}</td><td>${x.visit || 0}</td><td>${x.start || 0}</td><td>${x.done || 0}</td><td>${x.share || 0}</td></tr>`; }).join('');
  const rows = tops.map(([k, v]) => `<tr><td>${NAMES[k]}</td><td>${v}</td><td>${done ? Math.round(100 * v / done) : 0}%</td></tr>`).join('');
  const rate = stats.ev.start ? Math.round(100 * done / stats.ev.start) : 0;
  res.type('html').send(page('إدارة قعدة ساعتك', `<h1>إدارة قعدة ساعتك</h1>
<div class="g"><div class="c"><b>${stats.visits}</b>زيارة</div><div class="c"><b>${done}</b>أنهى</div><div class="c"><b>${rate}%</b>نسبة الإكمال</div></div>
<p>متوسط توازن الساعات: <b>${avg}%</b></p>
<h2>الأحداث</h2><table>${ev}</table>
<h2>توزيع النتائج</h2><table><tr><th>الساعة</th><th>العدد</th><th>النسبة</th></tr>${rows}</table>
<h2>آخر 14 يوماً</h2><table><tr><th>اليوم</th><th>زيارات</th><th>بدأ</th><th>أنهى</th><th>شارك</th></tr>${days}</table>
<p class="m">أرقام فقط، بلا أسماء ولا صور. الصور لا تُرسل إلى السيرفر أبداً.</p>`));
});

app.get('/health', (req, res) => res.send('ok'));
app.listen(PORT, () => console.log('قعدة ساعتك تعمل على المنفذ ' + PORT));
