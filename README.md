# ひがしやま かぞくゲームセンター

家族で遊ぶブラウザゲーム集。ハブから4本のゲームへ行き来できる。

| ゲーム | 内容 |
|---|---|
| ひがしやまレンジャー | シリーズ第1弾・アクション |
| ひがしやまクエスト | 第2弾・RPG（まおうのとう） |
| ひがしやまサバイバーズ | 第3弾・サバイバル |
| ひがしやまダッシュ! | 第4弾・オートランアクション |

---

## ローカルで動かす

**`index.html` をダブルクリックしても動きません。**
ハブが `games.json` を fetch するため、HTTPサーバー経由で開く必要があります。

```bash
python3 -m http.server 8000
```

→ ブラウザで http://localhost:8000 を開く

（各ゲーム単体、例えば `games/dash/index.html` は直接開いても動きます）

---

## 公開する（初回だけ）

### GitHub Pages を使う場合（publicリポジトリ）

1. GitHubにこのリポジトリをpush
2. リポジトリの **Settings → Pages** を開く
3. **Source** を `Deploy from a branch` にし、`main` / `/ (root)` を選んで Save
4. 1〜2分で `https://<ユーザー名>.github.io/<リポジトリ名>/` に公開される

### Cloudflare Pages を使う場合（privateのままでも無料）

1. Cloudflare にログイン → **Workers & Pages → Create → Pages**
2. **Connect to Git** でこのリポジトリを選ぶ
3. ビルド設定は**空のまま**でOK（ビルド不要な静的サイトのため）
   - Build command: （空欄）
   - Build output directory: `/`
4. Deploy → `https://<プロジェクト名>.pages.dev` に公開される

---

## 更新する（毎回）

push するだけで自動的に公開されます。**push = リリース**。

```bash
git add -A
git commit -m "dash: ボスのHPを調整"
git push
```

---

## iPhoneでアプリのように遊ぶ

1. Safariで公開URLを開く
2. 共有ボタン → **「ホーム画面に追加」**
3. アイコンがホーム画面に並び、全画面で起動する

---

## 開発する

Claude Code で開くと、`CLAUDE.md` のルールに沿って作業できます。

```bash
# 検証（コードを変えたら必ず通す）
cd games/dash && node run_sim.js

# ダッシュを再ビルド（template.html や sprites_gen.py を変えたとき）
cd games/dash
python3 sprites_gen.py   # ドット絵を変えたときだけ
python3 build.py

# 新作をつくる
python3 tools/new-game.py racer "ひがしやまレーサー" --emoji 🏎️
```

詳しくは [CLAUDE.md](CLAUDE.md) と [shared/series-style.md](shared/series-style.md) を参照。
