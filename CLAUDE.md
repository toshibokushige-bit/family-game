# ひがしやま かぞくゲームシリーズ

家族（たいち／けんと／のぞみ／えりか／ゆうし）で遊ぶブラウザゲーム集。
`index.html`（ハブ）から各ゲームへ飛ぶ。GitHubにpushすると自動デプロイされる。

---

## リポジトリ構成

```
.
├── index.html          ハブ。games.json を読んでカードを自動生成する（触る必要は基本ない）
├── games.json          ★ゲーム定義。新作はここに1件足すだけでハブに並ぶ
├── games/<id>/
│   ├── index.html      公開される完成品（単一HTML・これが実際に遊ばれる）
│   ├── template.html   ソース。__PIX__ にドット絵JSONを注入して index.html を作る
│   ├── sprites_gen.py  ドット絵オーサリング → pix.json を出力
│   ├── pix.json        生成物（直接編集しない）
│   ├── build.py        template.html + pix.json → index.html
│   └── run_sim.js      ★検証ゲート（ヘッドレスでゲームを自動プレイして品質を確認）
├── shared/             シリーズ共通の資産（様式・ライブラリ）
└── tools/
    ├── new-game.py     新作の雛形を生成する
    └── inject_home.py  各ゲームに「ゲームセンターへもどる」ボタンを注入（冪等）
```

---

## 鉄則（必ず守る）

1. **`run_sim.js` を通さずに commit / push しない。**
   ゲームのロジックやバランスを変えたら、必ずそのゲームの検証ゲートを実行し、
   全項目 PASS を確認する。落ちたまま push するのは禁止。

   ```bash
   cd games/dash && node run_sim.js
   ```

2. **`games/<id>/index.html` を直接編集しない**（ビルド成果物のため）。
   ロジックは `template.html`、ドット絵は `sprites_gen.py` を直す。
   直したら必ず再ビルドする。

   ```bash
   cd games/dash
   python3 sprites_gen.py   # ドット絵を変えたときだけ（pix.json を再生成）
   python3 build.py         # template.html + pix.json → index.html
   node run_sim.js          # ゲート
   ```

   ※ ranger / quest / survivors は単一HTMLで完結しており template を持たない。
     これらは `index.html` を直接編集してよい（ただし後述の「ホームボタン」を消さないこと）。

3. **ホームボタンを消さない。**
   各ゲームの `</body>` 直前に `<!-- HOME_BUTTON -->` で始まるブロックがある。
   ハブへ戻る導線なので削除しない。もし消えたら再注入する。

   ```bash
   python3 tools/inject_home.py
   ```

4. **ドット絵は必ず目視確認する。**
   `sprites_gen.py` はプレビューPNGを出力する。生成しただけで終わらせず、
   実際に画像を見て崩れていないか確認してから組み込む。

---

## 新作を追加する手順

```bash
python3 tools/new-game.py <id> "<タイトル>"
```

これで `games/<id>/` の雛形と `games.json` への追記が行われる。
あとは中身を実装し、`run_sim.js` を書いてゲートを整える。

---

## シリーズの様式（守るべきお作法）

- **単一HTML**で完結させる（外部依存はGoogle Fontsまで）
- **`localStorage` は使わない**。進行の保存は**あいことば**（パスワード）方式
- テキストは**ひらがな主体**（子供が読む前提）
- スマホ（タッチ）とPC（キーボード）の両対応
- BGM・SEはWeb Audio APIのチップチューンで自前生成
- 5人のキャラクターはシリーズ共通の設定を持つ（`shared/series-style.md` 参照）

---

## デプロイ

`main` ブランチに push すると自動で公開される。
特別な操作は不要で、**push = リリース**。

```bash
git add -A
git commit -m "dash: ボスのHPを調整"
git push
```
