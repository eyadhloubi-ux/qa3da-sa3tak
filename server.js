// قعدة ساعتك — سيرفر بسيط يعرض المنتج ويجمع الإحصائيات (كم واحد جرّب، وأكثر نتيجة)
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = process.env.STATS_FILE || path.join(__dirname, 'stats.json');
const NAMES = { P: 'ساعة الحنين', N: 'ساعة الأمس', H: 'ساعة الآن', F: 'ساعة الانتظار', U: 'ساعة الغد' };

let stats = { visits: 0, starts: 0, done: 0, top: { P: 0, N: 0, H: 0, F: 0, U: 0 }, balSum: 0 };
try { stats = Object.assign(stats, JSON.parse(fs.readFileSync(DATA, 'utf8'))); } catch (e) {}
let dirty = false;
setInterval(() => { if (dirty) { dirty = false; fs.writeFile(DATA, JSON.stringify(stats), () => {}); } }, 5000);

app.use(express.json({ limit: '2kb' }));
app.get('/', (req, res, next) => { stats.visits++; dirty = true; next(); });
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.post('/api/e', (req, res) => {
  const b = req.body || {};
  if (b.t === 'start') stats.starts++;
  if (b.t === 'done') {
    stats.done++;
    if (stats.top[b.top] != null) stats.top[b.top]++;
    const bal = Number(b.bal);
    if (bal >= 0 && bal <= 100) stats.balSum += bal;
  }
  dirty = true;
  res.status(204).end();
});

app.get('/stats', (req, res) => {
  const tops = Object.entries(stats.top).sort((a, b) => b[1] - a[1]);
  const avg = stats.done ? Math.round(stats.balSum / stats.done) : 0;
  const rows = tops.map(([k, v]) => `<tr><td>${NAMES[k]}</td><td>${v}</td><td>${stats.done ? Math.round(100 * v / stats.done) : 0}%</td></tr>`).join('');
  res.type('html').send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>إحصائيات قعدة ساعتك</title><style>body{font-family:system-ui;background:#EEECE6;color:#1D2230;max-width:520px;margin:0 auto;padding:24px 16px}
h1{font-size:24px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.c{background:#fff;border-radius:14px;padding:14px;text-align:center}
.c b{display:block;font-size:28px}table{width:100%;margin-top:16px;background:#fff;border-radius:14px;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #eee;text-align:right}</style>
<h1>إحصائيات قعدة ساعتك</h1><div class="g"><div class="c"><b>${stats.visits}</b>زيارة</div><div class="c"><b>${stats.starts}</b>بدأ</div><div class="c"><b>${stats.done}</b>أنهى</div></div>
<p>متوسط توازن الساعات: <b>${avg}%</b></p><table><tr><th>الساعة</th><th>العدد</th><th>النسبة</th></tr>${rows}</table>
<p style="color:#737784;font-size:13px">أكثر نتيجة: <b>${stats.done ? NAMES[tops[0][0]] : '—'}</b></p></html>`);
});

app.get('/health', (req, res) => res.send('ok'));
app.listen(PORT, () => console.log('قعدة ساعتك تعمل على المنفذ ' + PORT));
