# スナイプアクション用 レイヤー画像（WebP）配置ディレクトリガイド

このフォルダ（`vampire-survivor-game/src/public/images/snipe/`）は、スナイプアクションモーダルにおける3層レイヤー構造（z-indexの重ね合わせ）による立体感・奥行き演出用の WebP 画像を配置するフォルダです。

---

## 📁 命名規則・z-index 階層仕様

プログラム側で自動判定・重ね合わせがスムーズに行えるよう、ファイル名にプレフィックス（接頭辞）を付与してください。

| レイヤー階層 | プレフィックス | CSS (z-index) | 用途・描写内容 | 推奨ファイル名例 |
| :--- | :--- | :--- | :--- | :--- |
| **Layer 1 (最背面 / 奥)** | `layer1_bg_` | `z-index: 10` | 遠景・空・雲・遠くの街並み | `layer1_bg_sky_day.webp`<br>`layer1_bg_sky_night.webp` |
| **Layer 2 (中景 / メイン)** | `layer2_mid_` | `z-index: 20` | 主な建物・廃墟・透過窓枠・敵ターゲット | `layer2_mid_building.webp`<br>`layer2_mid_ruins.webp` |
| **Layer 3 (前景 / 手前)** | `layer3_fg_` | `z-index: 30` | 手前の瓦礫・車両・フェンス・スコープ照準 | `layer3_fg_vehicles.webp`<br>`layer3_fg_fence.webp` |

---

## 💡 デザイン・実装時のワンポイント

1. **透過処理（PNG / WebP）**:
   - `Layer 2 (中景)` や `Layer 3 (前景)` に配置する WebP 画像は、背景や窓枠部分をアルファ透過（Transparent）にしておくことで、奥のレイヤー（`Layer 1` の空や `Layer 2` の建物）が隙間や窓から覗く立体演出が可能になります。
2. **パターン切り替え**:
   - `layer1_bg_patternA.webp`, `layer1_bg_patternB.webp` のように命名しておくことで、ランダム選出や時間帯・天候に応じた視界切り替えが容易になります。
