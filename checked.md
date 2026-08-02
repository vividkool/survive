# checked.md

## 🏁 完了済みのタスク
- [x] **スナイプ用レイヤー画像（WebP）格納フォルダおよび命名規則の策定 (2026-07-29)**: `public/images/snipe/` を作成し、`layer1_bg_`（奥/z-10）、`layer2_mid_`（中景/z-20）、`layer3_fg_`（手前/z-30）の階層別プリフィックス命名規約と配置ガイドガイドラインを整備。
- [x] **画像切り抜き＆WebP変換自動化ツールの作成 (rembg/Pillow/u2netp/OpenCV)**:
  - rembg (u2netp/u2net) による建物・空・炎・廃車等の全自動エッジ切り抜き・背景透過処理。
  - OpenCV による切り抜き要素の自動バウンディングボックス抽出・中央トリミング。
  - Pillow による解像度指定統一リサイズおよび透過 WebP 高効率保存機能 (`tools/image_processor.py`)。出力パスバグを修正。

