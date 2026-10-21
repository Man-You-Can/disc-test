#!/usr/bin/env node
// Личные зацепки в карточке вернувшегося посетителя на стартовом экране (extHooks в src/template.html) обещают то, что расширенный отчёт
// разбирает по числам участника. Правила выбора должны совпадать с правилами сборщика отчёта — private/extended-report/build-report.py
// (папка вне этого репозитория). Скрипт прогоняет 20 000 сгенерированных результатов через функции сайта и через сборщик
// и сравнивает: профиль, самую низкую шкалу, слои ответов, вариант вторичного стиля, умеренный и сбалансированный профиль.
// Запускать после правки extHooks, score, classify или правил выбора блоков в сборщике: node scripts/check-hooks.js
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), builder = path.join(root, 'private', 'extended-report', 'build-report.py');
if (!fs.existsSync(builder)) { console.log('private/extended-report/build-report.py не найден — сверять не с чем, проверка пропущена'); process.exit(0); }
const tpl = fs.readFileSync(path.join(root, 'src', 'template.html'), 'utf8');
function fn(name) { // текст функции из шаблона, по парным скобкам
  const i = tpl.indexOf('function ' + name + '('); if (i < 0) throw new Error('в шаблоне нет функции ' + name);
  for (let k = tpl.indexOf('{', i), d = 0; k < tpl.length; k++) { if (tpl[k] === '{') d++; else if (tpl[k] === '}' && !--d) return tpl.slice(i, k + 1); }
}
const BLOCK_KEYS = JSON.parse(/var BLOCK_KEYS = (\[[^\]]+\]);/.exec(tpl)[1].replace(/'/g, '"'));
const KEYS = ['D', 'I', 'S', 'C'], L = { keys: { D: 'D', I: 'I', S: 'S', C: 'C' } }, BLOCKS = BLOCK_KEYS.map(ks => ks.split('').map(k => ({ k })));
// предел «не больше трёх строк» снимается: сверяются все зацепки, а не первые три
const F = eval('(function(){' + fn('pct') + fn('score') + fn('classify') + fn('extHooks').replace('out.slice(0,3)', 'out') + 'return {score:score, classify:classify, extHooks:extHooks};})()');
const H = { low: 'low:{k}:{pct}', flat: 'flat', moderate: 'moderate:{k}:{pct}', pairMid: 'pairMid:{a}{b}', pairClose: 'pairClose:{a}{b}', pairEqual: 'pairEqual:{a}{b}',
  pairEdge: 'pairEdge:{a}{b}', pureHigh: 'pureHigh:{k}:{pct}', layersDiff: 'layersDiff:{a}{b}', layersSame: 'layersSame:{k}' };
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const lines = [];
for (let n = 0; n < 20000; n++) {
  // веса стилей: каждый шестой результат ровный, остальные со сдвигом — чтобы встретились все варианты
  const w = { D: 1, I: 1, S: 1, C: 1 }, v = { D: 1, I: 1, S: 1, C: 1 }, mode = n % 6;
  if (mode) { w[KEYS[Math.floor(rnd() * 4)]] += rnd() * 3 * mode; w[KEYS[Math.floor(rnd() * 4)]] += rnd() * 4; v[KEYS[Math.floor(rnd() * 4)]] += rnd() * 5; v[KEYS[Math.floor(rnd() * 4)]] += rnd() * 2; }
  const m = [], l = [];
  for (let i = 0; i < 24; i++) {
    const pick = (wt, not) => { let tot = 0; BLOCKS[i].forEach((it, j) => { if (j !== not) tot += wt[it.k]; }); let x = rnd() * tot;
      for (let j = 0; j < 4; j++) { if (j === not) continue; x -= wt[BLOCKS[i][j].k]; if (x <= 0) return j; } return not === 3 ? 2 : 3; };
    const mi = pick(w, -1); m.push(mi); l.push(pick(v, mi));
  }
  const sc = F.score({ m, l }), cls = F.classify(sc);
  lines.push(m.join('') + ' ' + l.join('') + ' ' + cls.key + ' ' + (cls.flat ? 1 : 0) + ' ' + F.extHooks(sc, cls, H).join(','));
}
const PY = `
import sys, importlib.util, collections
spec = importlib.util.spec_from_file_location('br', sys.argv[1]); br = importlib.util.module_from_spec(spec); spec.loader.exec_module(br)
KEYS = br.KEYS; bad = 0; n = 0; kinds = collections.Counter()
for line in open(sys.argv[2], encoding='utf-8'):
    m, l, key, flat, got = line.rstrip('\\n').split(' ')
    a = br.analyze({'m': m, 'l': l}); pct = a['pct']; exp = []
    if a['flat']: exp.append('flat')
    exp.append('low:%s:%d' % (a['low'], pct[a['low']]))
    if not a['flat']:
        top_most = max(KEYS, key=lambda k: (a['most'][k], a['net'][k]))
        top_least = min(KEYS, key=lambda k: (a['least'][k], -a['net'][k]))
        if top_most == top_least: exp.append('layersSame:' + top_most)
        elif a['least'][top_most] - a['least'][top_least] >= 3: exp.append('layersDiff:' + top_most + top_least)
        if a['gap']: exp.append('pair%s:%s%s' % (a['gap'].capitalize(), a['lead'], a['second']))
        elif pct[a['second']] > 60: exp.append('pureHigh:%s:%d' % (a['second'], pct[a['second']]))
        if pct[a['lead']] <= 70: exp.append('moderate:%s:%d' % (a['lead'], pct[a['lead']]))
    n += 1
    for k in exp: kinds[k.split(':')[0]] += 1
    if ','.join(exp) != got or a['profile'] != key or str(int(a['flat'])) != flat:
        bad += 1
        if bad <= 5: print('РАСХОЖДЕНИЕ', m, l, '| сайт:', key, got, '| сборщик:', a['profile'], ','.join(exp))
missing = [k for k in ('low','flat','moderate','pairMid','pairClose','pairEqual','pairEdge','pureHigh','layersDiff','layersSame') if not kinds[k]]
print('результатов: %d, расхождений: %d' % (n, bad)); print('варианты:', dict(kinds))
if missing: print('не встретились варианты:', ', '.join(missing))
sys.exit(1 if bad or missing else 0)
`;
const tmp = path.join(os.tmpdir(), 'disc-hooks-' + process.pid + '.txt');
fs.writeFileSync(tmp, lines.join('\n') + '\n');
const r = spawnSync('python3', ['-c', PY, builder, tmp], { stdio: 'inherit' });
fs.unlinkSync(tmp);
if (r.status !== 0) { console.error('✗ зацепки сайта расходятся с правилами сборщика отчёта'); process.exit(1); }
console.log('✓ зацепки сайта совпадают с правилами сборщика отчёта');
