# [完了報告 / 変更内容まとめ] 画像切り抜き・リサイズ統一・WebP変換ツールの作成

## 概要
`rembg`, `u2netp`, `OpenCV`, `Pillow` を連携させ、建物・空・炎・廃車などの背景除去・要素抽出・アスペクト比維持リサイズ・透過 WebP 形式変換を一括で行う自動化スクリプト [tools/image_processor.py](file:///c:/Users/vivid/OneDrive/デスクトップ/survive/tools/image_processor.py) を作成しました。

作成したツールは `survive` (スナイパー視点アクション) 用の `public/images/snipe/` レイヤー素材自動生成に対応しています。

---

## 主な追加・変更成果物

1. **切り抜き・WebP変換ツールスクリプト**: [tools/image_processor.py](file:///c:/Users/vivid/OneDrive/デスクトップ/survive/tools/image_processor.py)
   - **全自動背景除去**: `rembg` の高速軽量モデル `u2netp` (デフォルト) により、建物や廃車の複雑な輪郭を高速切り抜き。
   - **自動バウンディングボックス抽出**: `OpenCV` を用いて透過後の要素部分のみを自動判定・ジャストサイズへクロップ。
   - **アスペクト比維持リサイズ＆統一**: `Pillow` を用いて、指定サイズ（デフォルト: 1920x1080）の透明キャンバスに綺麗にレイアウト配置（`contain` / `cover` / `stretch` モード選択可）。
   - **レイヤープリフィックス機能**: `layer1_bg_`, `layer2_mid_`, `layer3_fg_` 等の接頭辞を統一付与してバッチ保存。

2. **依存関係ファイル**: [tools/requirements.txt](file:///c:/Users/vivid/OneDrive/デスクトップ/survive/tools/requirements.txt)
   - `rembg`, `pillow`, `opencv-python`, `onnxruntime` などの必要パッケージ定義。

3. **タスク管理とアーカイブ整理**:
   - `20260729c.md` を [archive/20260729c.md](file:///c:/Users/vivid/OneDrive/デスクトップ/survive/archive/20260729c.md) へ移動。
   - [todo.md](file:///c:/Users/vivid/OneDrive/デスクトップ/survive/todo.md) を最新状態に集約更新。

---

## ツールの使用例

### 1. 初回依存パッケージのインストール
```bash
pip install -r tools/requirements.txt
```

### 2. スナイパー視点レイヤー画像の一括生成
元画像を `./raw_images` フォルダに配置し、以下のコマンドを実行するだけで `vampire-survivor-game/public/images/snipe/` に透過 WebP 画像が自動保存されます。

```bash
# 中景（建物・構造物）の透過 WebP 生成例
python tools/image_processor.py --input ./raw_images --prefix layer2_mid_ --width 1920 --height 1080
```

---

## GitHub プッシュ完了
本日の変更およびツール作成内容をステージング・コミットし、`origin/main` に正常に Push 完了いたしました。
