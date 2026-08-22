# checked.md

## 🏁 完了済みのタスク
- [x] **スナイプ用レイヤー画像（WebP）格納フォルダおよび命名規則の策定 (2026-07-29)**: `public/images/snipe/` を作成し、`layer1_bg_`（奥/z-10）、`layer2_mid_`（中景/z-20）、`layer3_fg_`（手前/z-30）の階層別プリフィックス命名規約と配置ガイドガイドラインを整備。
- [x] **画像切り抜き＆WebP変換自動化ツールの作成 (rembg/Pillow/u2netp/OpenCV)**:
  - rembg (u2netp/u2net) による建物・空・炎・廃車等の全自動エッジ切り抜き・背景透過処理。
  - OpenCV による切り抜き要素の自動バウンディングボックス抽出・中央トリミング。
- [x] **WebP画像加工・透過Webスタジオの構築 (`tools/run_studio.bat`, `tools/server.py`, `tools/static/index.html`) (2026-08-22)**:
  - 画像アップロード、サイズ変換、WebP出力の一括処理＆個別ステップ処理
  - 多彩な透過指定（AI自動 / スポイト色抜き / ブラシ消しゴム）
  - エッジ検出・輪郭ストップ型スポイト透過（FloodFill & Cannyエッジ連携）による被写体内部保護
  - 🪄 消しゴムマジック機能（OpenCV Inpaintingによる不要物消去と背景テクスチャ自動補完）
  - ↔️ 左右反転・↕️ 上下反転および Undo（元に戻す）/ 初期化 履歴管理
  - surviveスナイプ用サイズプリセット（全景1000x480 / レイヤー1000x180 / アイコン256x256）
  - ゲーム内ディレクトリ（`vampire-survivor-game/public/images/snipe/`）への直接書き出し対応


