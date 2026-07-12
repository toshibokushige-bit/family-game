# -*- coding: utf-8 -*-
"""各ゲームのHTMLに「ゲームセンターへもどる」ボタンを注入する。
ゲーム本体のコードには一切触らず、</body>直前に独立したオーバーレイを足すだけ。
何度実行しても二重に入らない(冪等)。
"""
import sys, pathlib

MARK = '<!-- HOME_BUTTON -->'

SNIPPET = MARK + '''
<style>
  #homeBtn{
    position:fixed; top:env(safe-area-inset-top,8px); left:8px; z-index:99999;
    display:flex; align-items:center; gap:6px;
    padding:8px 14px; border-radius:999px;
    background:rgba(20,10,35,.72); color:#ffd94d;
    font-family:'DotGothic16','Hiragino Maru Gothic ProN',sans-serif;
    font-size:15px; line-height:1; text-decoration:none;
    border:2px solid rgba(255,217,77,.6);
    -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px);
    opacity:.45; transition:opacity .15s;
  }
  #homeBtn:hover,#homeBtn:active{opacity:1;}
</style>
<a id="homeBtn" href="../../index.html">&#8962; ゲームセンター</a>
'''

def inject(path: pathlib.Path) -> str:
    html = path.read_text(encoding='utf-8')
    if MARK in html:
        return 'skip (already)'
    if '</body>' not in html:
        return 'SKIP: no </body>'
    html = html.replace('</body>', SNIPPET + '\n</body>', 1)
    path.write_text(html, encoding='utf-8')
    return 'injected'

if __name__ == '__main__':
    root = pathlib.Path(__file__).resolve().parent.parent
    for game in sorted((root / 'games').iterdir()):
        f = game / 'index.html'
        if f.exists():
            print(f'{game.name:12s} {inject(f)}')
