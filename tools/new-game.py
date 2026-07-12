# -*- coding: utf-8 -*-
"""あたらしいゲームの雛形をつくる。

  python3 tools/new-game.py <id> "<タイトル>" [--emoji 🎯] [--color '#3d78c9']

やること:
  1. games/<id>/ をつくり、単一HTMLの雛形と run_sim.js を置く
  2. games.json に エントリを 追記する(ハブに 自動で ならぶ)
既存の id があれば なにもしない(安全)。
"""
import argparse, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

TEMPLATE = '''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet">
<style>
  html,body{{margin:0;padding:0;background:#12081f;height:100%;overflow:hidden;touch-action:none;
    font-family:'DotGothic16','Hiragino Kaku Gothic ProN',monospace;-webkit-user-select:none;user-select:none;}}
  #wrap{{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;}}
  canvas{{image-rendering:pixelated;max-width:100vw;max-height:100vh;}}
</style>
</head>
<body>
<div id="wrap"><canvas id="cv"></canvas></div>
<script>
'use strict';
const HEADLESS = (typeof window === 'undefined' || typeof globalThis.__SIM__ !== 'undefined');

/* =========================================================
   {title}
   かぞくゲームシリーズ

   シリーズのお作法:
     - 単一HTMLで完結させる
     - localStorage は つかわない(セーブは あいことば方式)
     - テキストは ひらがな主体
     - スマホ(タッチ)と PC(キーボード)の 両対応
   ========================================================= */

const BAL = {{
  VIEW_W: 960, VIEW_H: 540,
}};

const Game = {{
  state: 'title',
  update(dt){{
    // TODO: ゲームロジック
  }},
}};

/* ---------------- 描画 ---------------- */
let cv, ctx;
function draw(){{
  const W = BAL.VIEW_W, H = BAL.VIEW_H;
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = "40px 'DotGothic16',monospace";
  ctx.fillText('{title}', W/2, H/2);
  ctx.font = "18px 'DotGothic16',monospace";
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillText('これから つくるよ!', W/2, H/2 + 44);
}}

/* ---------------- 起動 ---------------- */
if(!HEADLESS){{
  cv = document.getElementById('cv');
  cv.width = BAL.VIEW_W; cv.height = BAL.VIEW_H;
  ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  function fit(){{
    const s = Math.min(window.innerWidth/BAL.VIEW_W, window.innerHeight/BAL.VIEW_H);
    cv.style.width = (BAL.VIEW_W*s)+'px';
    cv.style.height = (BAL.VIEW_H*s)+'px';
  }}
  window.addEventListener('resize', fit); fit();

  let last = performance.now(), acc = 0;
  const STEP = 1/60;
  function loop(now){{
    acc += Math.min(0.1, (now-last)/1000); last = now;
    while(acc >= STEP){{ Game.update(STEP); acc -= STEP; }}
    draw();
    requestAnimationFrame(loop);
  }}
  requestAnimationFrame(loop);
}}

if(typeof module !== 'undefined'){{
  module.exports = {{ Game, BAL }};
}}
</script>
</body>
</html>
'''

RUN_SIM = '''// run_sim.js — {title} 検証ゲート
// つかいかた: node run_sim.js
//
// ★このファイルの やくわり★
//   ゲームを ヘッドレスで じどうプレイして、こわれていないかを たしかめる。
//   コードを かえたら かならず これを とおしてから commit する。
'use strict';
globalThis.__SIM__ = true;
const fs = require('fs');

// index.html から <script> を ぬきだして 読みこむ
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = html.match(/<script>([\\s\\S]*?)<\\/script>/);
if(!m) throw new Error('index.html に <script> が みつかりません');

const mod = {{ exports: {{}} }};
new Function('module','exports','require','setTimeout','setInterval','clearInterval',
  m[1])(mod, mod.exports, require, f=>f(), ()=>0, ()=>{{}});

const {{ Game, BAL }} = mod.exports;

// ---- ゲート ----
let ok = true;
function gate(name, pass){{
  console.log(`  ${{pass ? 'PASS' : 'FAIL'}}  ${{name}}`);
  if(!pass) ok = false;
}}

console.log('=== {title} 検証 ===');
gate('モジュールが よみこめる', !!Game && !!BAL);
gate('update() が よべる', (()=>{{
  try {{ Game.update(1/60); return true; }} catch(e) {{ console.log('   ', e.message); return false; }}
}})());

// TODO: ゲームが できたら ゲートを ふやす
//   例) クリアできるか / スタックしないか / セーブの往復が あうか

console.log(ok ? 'GATE: ALL PASS' : 'GATE: FAIL');
process.exit(ok ? 0 : 1);
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('id', help='フォルダ名になる英字ID (例: racer)')
    ap.add_argument('title', help='ゲームタイトル (例: ひがしやまレーサー)')
    ap.add_argument('--emoji', default='🎮')
    ap.add_argument('--color', default='#5a4aa0')
    ap.add_argument('--accent', default='#ffd94d')
    ap.add_argument('--desc', default='これから つくるよ!')
    args = ap.parse_args()

    gid = args.id.strip()
    if not gid.replace('-', '').replace('_', '').isalnum():
        sys.exit(f'ERROR: id は英数字にしてください: {gid}')

    gdir = ROOT / 'games' / gid
    if gdir.exists():
        sys.exit(f'ERROR: すでに games/{gid} があります')

    gdir.mkdir(parents=True)
    (gdir / 'index.html').write_text(TEMPLATE.format(title=args.title), encoding='utf-8')
    (gdir / 'run_sim.js').write_text(RUN_SIM.format(title=args.title), encoding='utf-8')

    # games.json に 追記
    reg_path = ROOT / 'games.json'
    reg = json.loads(reg_path.read_text(encoding='utf-8'))
    n = len(reg) + 1
    reg.append({
        'id': gid,
        'title': args.title,
        'sub': f'だい{n}だん',
        'desc': args.desc,
        'tags': ['しんさく'],
        'color': args.color,
        'accent': args.accent,
        'emoji': args.emoji,
    })
    reg_path.write_text(
        json.dumps(reg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    # ホームボタンを 注入
    sys.path.insert(0, str(ROOT / 'tools'))
    import inject_home
    inject_home.inject(gdir / 'index.html')

    print(f'created games/{gid}/')
    print(f'  index.html   雛形')
    print(f'  run_sim.js   検証ゲート')
    print(f'updated games.json (ハブに ならびます)')
    print()
    print('つぎに やること:')
    print(f'  1. games/{gid}/index.html を 実装する')
    print(f'  2. games/{gid}/run_sim.js に ゲートを ふやす')
    print(f'  3. node games/{gid}/run_sim.js が PASS したら commit')


if __name__ == '__main__':
    main()
