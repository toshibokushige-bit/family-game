# -*- coding: utf-8 -*-
"""template.html の __PIX__ に pix.json を注入して index.html を生成する。
ホームボタンは注入後も保持される(ビルド後に inject_home.py が冪等に効く)。
"""
import json, pathlib, subprocess, sys

here = pathlib.Path(__file__).resolve().parent
root = here.parent.parent

tpl = (here / 'template.html').read_text(encoding='utf-8')
pix = (here / 'pix.json').read_text(encoding='utf-8')

if '__PIX__' not in tpl:
    sys.exit('ERROR: template.html に __PIX__ プレースホルダがありません')

out = tpl.replace('__PIX__', pix)
(here / 'index.html').write_text(out, encoding='utf-8')
print(f'built index.html ({len(out):,} bytes)')

# ホームボタンを 再注入(冪等)
subprocess.run([sys.executable, str(root / 'tools' / 'inject_home.py')], check=True)
