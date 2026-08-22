#!/usr/bin/env python3
"""
image_processor.py
rembg / OpenCV / Pillow を使用して、画像から背景（建物、空、炎、廃車など）を全自動で切り抜き、
バウンディングボックス抽出・リサイズ統一を行い、透過 WebP 形式で保存するツール。
survive / vampire-survivor-game のスナイパー視点レイヤー作成に対応。
"""

import os
import sys
import argparse
from pathlib import Path
from typing import Optional, Tuple, List
import numpy as np
from PIL import Image


try:
    from rembg import remove, new_session
except ImportError:
    remove = None

try:
    import cv2
except ImportError:
    cv2 = None


def crop_bounding_box(pil_img: Image.Image, margin: int = 0) -> Image.Image:
    """
    OpenCV を使用してアルファチャンネルの不透明領域（切り抜き対象）を自動検出し、
    バウンディングボックスでトリミングします。
    """
    if cv2 is None:
        # cv2 が利用不可の場合は Pillow の getbbox を使用
        bbox = pil_img.getbbox()
        if bbox:
            return pil_img.crop(bbox)
        return pil_img

    img_np = np.array(pil_img)
    if img_np.shape[2] < 4:
        return pil_img

    alpha = img_np[:, :, 3]
    coords = cv2.findNonZero(alpha)
    if coords is None:
        return pil_img

    x, y, w, h = cv2.boundingRect(coords)
    
    # マージン適用
    img_h, img_w = img_np.shape[:2]
    x_min = max(0, x - margin)
    y_min = max(0, y - margin)
    x_max = min(img_w, x + w + margin)
    y_max = min(img_h, y + h + margin)

    cropped_np = img_np[y_min:y_max, x_min:x_max]
    return Image.fromarray(cropped_np)


def remove_color_key(
    pil_img: Image.Image,
    target_r: int,
    target_g: int,
    target_b: int,
    tolerance: int = 30,
    feather: int = 0,
    contiguous_only: bool = True,
    seed_x: Optional[int] = None,
    seed_y: Optional[int] = None,
    edge_aware: bool = True
) -> Image.Image:
    """
    指定したRGB色とその近似色を透明化します。
    - contiguous_only = True: クリックした地点と連続している（隣接する）同色領域のみを境界線（エッジ）まで透過（被写体内部の色飛びを防止）
    - edge_aware = True: OpenCV Cannyエッジ検出を併用し、被写体の輪郭・境界線を越えて透明化が侵入するのを防ぐ
    - contiguous_only = False: 画像全体から指定色を透過
    """
    img_np = np.array(pil_img.convert("RGBA"))
    h, w = img_np.shape[:2]

    # 1. 連続領域のみ（クリック地点からの FloodFill / 境界線判定）
    if contiguous_only and cv2 is not None and seed_x is not None and seed_y is not None:
        # 範囲チェック
        sx = max(0, min(w - 1, seed_x))
        sy = max(0, min(h - 1, seed_y))

        # RGB 3チャンネルで作業
        bgr = cv2.cvtColor(img_np[:, :, :3], cv2.COLOR_RGB2BGR)

        # FloodFill 用マスク (h+2, w+2)
        ff_mask = np.zeros((h + 2, w + 2), np.uint8)
        
        # エッジ検出による境界壁の作成（オプション）
        if edge_aware:
            gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            # エッジ部分をマスク壁(1)として設定
            ff_mask[1:h+1, 1:w+1] = np.where(edges > 0, 1, 0).astype(np.uint8)

        # クリック位置から同一色領域を探索して塗りつぶし
        tol = int(tolerance)
        flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE
        cv2.floodFill(
            bgr,
            ff_mask,
            (sx, sy),
            (0, 0, 0),
            (tol, tol, tol),
            (tol, tol, tol),
            flags
        )

        # マスク抽出 (1:h+1, 1:w+1 のうち 255 のピクセルが透明化対象)
        mask_transparent = (ff_mask[1:h+1, 1:w+1] == 255)

    else:
        # 全体の一致色を透明化
        r, g, b = img_np[:, :, 0], img_np[:, :, 1], img_np[:, :, 2]
        diff_r = np.abs(r.astype(int) - target_r)
        diff_g = np.abs(g.astype(int) - target_g)
        diff_b = np.abs(b.astype(int) - target_b)
        dist = np.sqrt(diff_r**2 + diff_g**2 + diff_b**2)
        mask_transparent = dist <= tolerance

    if feather > 0 and cv2 is not None:
        mask_u8 = (mask_transparent.astype(np.uint8)) * 255
        inv_mask = cv2.bitwise_not(mask_u8)
        blurred_mask = cv2.GaussianBlur(inv_mask, (feather * 2 + 1, feather * 2 + 1), 0)
        img_np[:, :, 3] = np.minimum(img_np[:, :, 3], blurred_mask)
    else:
        img_np[mask_transparent, 3] = 0

    return Image.fromarray(img_np)


def apply_magic_eraser(
    pil_img: Image.Image,
    mask_img: Optional[Image.Image] = None,
    mode: str = "inpaint",
    inpaint_radius: int = 5
) -> Image.Image:
    """
    消しゴムマジック機能:
    - mode = 'inpaint': マスクで指定された人物や不要物を、周囲の背景テクスチャで違和感なく塗りつぶして消去 (OpenCV Telea / Navier-Stokes Inpainting)
    - mode = 'ai_subject': ブラシやAIで人物・被写体のエッジを認識し、その物体だけを背景から正確に透明化（くり抜き）
    """
    src_rgba = pil_img.convert("RGBA")
    src_np = np.array(src_rgba)
    h, w = src_np.shape[:2]

    # マスク画像がある場合
    if mask_img is not None:
        mask_rgba = mask_img.convert("RGBA").resize((w, h), Image.Resampling.NEAREST)
        mask_np = np.array(mask_rgba)
        # 白(255)で塗られた部分または赤ブラシ部分をマスク(255)に
        binary_mask = np.where((mask_np[:, :, 0] > 100) & (mask_np[:, :, 3] > 30), 255, 0).astype(np.uint8)
    else:
        # マスクが無い場合はAIで被写体を検出
        if remove is not None:
            ai_cut = remove(src_rgba)
            ai_alpha = np.array(ai_cut)[:, :, 3]
            binary_mask = np.where(ai_alpha > 50, 255, 0).astype(np.uint8)
        else:
            return pil_img

    if mode == "inpaint" and cv2 is not None:
        # BGRカラーで背景補完 (cv2.inpaint)
        bgr = cv2.cvtColor(src_np[:, :, :3], cv2.COLOR_RGB2BGR)
        # INPAINT_TELEA アルゴリズムで自然に修復
        inpainted_bgr = cv2.inpaint(bgr, binary_mask, inpaint_radius, cv2.INPAINT_TELEA)
        inpainted_rgb = cv2.cvtColor(inpainted_bgr, cv2.COLOR_BGR2RGB)
        
        # アルファチャンネルは維持（元の不透明度）
        result_np = np.dstack((inpainted_rgb, src_np[:, :, 3]))
        return Image.fromarray(result_np)
    
    elif mode == "transparent":
        # マスク部分を透明化
        src_np[binary_mask == 255, 3] = 0
        return Image.fromarray(src_np)

    return pil_img


def flip_image(pil_img: Image.Image, direction: str = "horizontal") -> Image.Image:
    """
    画像の反転処理 (direction: 'horizontal' 左右反転, 'vertical' 上下反転)
    """
    if direction == "horizontal":
        return pil_img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    elif direction == "vertical":
        return pil_img.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    return pil_img




def apply_mask_transparency(pil_img: Image.Image, mask_img: Image.Image) -> Image.Image:
    """
    ユーザーが描画したマスク画像（白色＝透過対象）を使って透明化します。
    塗った部分（白ピクセル）のアルファ値のみを 0 に設定します。
    """
    src_rgba = pil_img.convert("RGBA")
    mask_rgba = mask_img.convert("RGBA").resize(src_rgba.size, Image.Resampling.NEAREST)
    
    src_np = np.array(src_rgba)
    mask_np = np.array(mask_rgba)
    
    # mask_npの赤チャンネルまたは不透明度または輝度をチェック
    # mask_data は白(255,255,255)で塗られた部分が消去対象
    erase_mask = (mask_np[:, :, 0] > 128) & (mask_np[:, :, 3] > 50)
    
    # 該当ピクセルのアルファ（透明度）を0に
    src_np[erase_mask, 3] = 0
    
    return Image.fromarray(src_np)




def resize_and_pad(pil_img: Image.Image, target_width: int, target_height: int, fit_mode: str = "contain") -> Image.Image:
    """
    アスペクト比を維持しつつ指定サイズに統一します。
    fit_mode:
        - "contain": 枠内に収まるようリサイズし透明背景の中央に配置
        - "cover": 枠全体を覆うように拡大/縮小
        - "stretch": 指定サイズにそのままリサイズ
    """
    if fit_mode == "stretch":
        return pil_img.resize((target_width, target_height), Image.Resampling.LANCZOS)

    src_w, src_h = pil_img.size
    ratio_w = target_width / src_w
    ratio_h = target_height / src_h

    if fit_mode == "cover":
        ratio = max(ratio_w, ratio_h)
    else:  # contain
        ratio = min(ratio_w, ratio_h)

    new_w = int(src_w * ratio)
    new_h = int(src_h * ratio)
    resized = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    if fit_mode == "cover":
        # 中央クロップ
        left = (new_w - target_width) // 2
        top = (new_h - target_height) // 2
        return resized.crop((left, top, left + target_width, top + target_height))
    else:  # contain
        # 透明なキャンバスに配置
        canvas = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
        offset_x = (target_width - new_w) // 2
        offset_y = (target_height - new_h) // 2
        canvas.paste(resized, (offset_x, offset_y))
        return canvas


def process_images(
    input_dir: str,
    output_dir: str,
    model_name: str = "u2netp",
    width: int = 1920,
    height: int = 1080,
    prefix: str = "",
    crop_bounds: bool = True,
    quality: int = 80,
    fit_mode: str = "contain"
):
    """
    指定ディレクトリ内の画像を一括処理します。
    """
    in_path = Path(input_dir)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    if remove is None:
        print("[ERROR] rembg がインストールされていません。'pip install rembg' を実行してください。")
        sys.exit(1)

    print(f"[*] rembg モデル '{model_name}' を初期化中...")
    session = new_session(model_name)

    extensions = ("*.png", "*.jpg", "*.jpeg", "*.bmp", "*.webp")
    image_files = []
    for ext in extensions:
        image_files.extend(in_path.glob(ext))

    if not image_files:
        print(f"[!] '{input_dir}' に処理対象の画像が見つかりませんでした。")
        return

    print(f"[*] 計 {len(image_files)} 枚の画像を処理開始します...")

    for img_file in image_files:
        print(f" -> 処理中: {img_file.name}")
        try:
            input_img = Image.open(img_file).convert("RGBA")
            
            # 1. 背景切り抜き (rembg)
            cut_img = remove(input_img, session=session)

            # 2. 自動バウンディングボックス・クロップ (OpenCV / Pillow)
            if crop_bounds:
                cut_img = crop_bounding_box(cut_img)

            # 3. リサイズ・アスペクト比維持調整
            final_img = resize_and_pad(cut_img, width, height, fit_mode=fit_mode)

            # 4. WebP 保存
            out_filename = f"{prefix}{img_file.stem}.webp"
            save_path = out_path / out_filename
            final_img.save(save_path, "WEBP", quality=quality)
            print(f"    [OK] 保存完了: {save_path}")

        except Exception as e:
            print(f"    [ERROR] {img_file.name} の処理に失敗しました: {e}")

    print("\n[SUCCESS] すべての画像処理が完了しました！")


def main():
    parser = argparse.ArgumentParser(
        description="survive スナイプ視点用 画像自動切り抜き＆サイズ統一 WebP 変換ツール"
    )
    parser.add_argument("--input", "-i", default="./raw_images", help="入力画像ディレクトリ (デフォルト: ./raw_images)")
    parser.add_argument("--output", "-o", default="./vampire-survivor-game/public/images/snipe", help="出力ディレクトリ")
    parser.add_argument("--model", "-m", default="u2netp", choices=["u2netp", "u2net", "u2net_human_seg"], help="rembg AIモデル (デフォルト: u2netp 高速版)")
    parser.add_argument("--width", "-W", type=int, default=1920, help="統一する幅 (px)")
    parser.add_argument("--height", "-H", type=int, default=1080, help="統一する高さ (px)")
    parser.add_argument("--prefix", "-p", default="", help="出力ファイル名のプリフィックス (例: layer1_bg_)")
    parser.add_argument("--no-crop", action="store_true", help="切り抜き要素の自動トリミング（バウンディングボックス抽出）をオフにする")
    parser.add_argument("--fit-mode", choices=["contain", "cover", "stretch"], default="contain", help="リサイズ時のフィッティングモード")
    parser.add_argument("--quality", "-q", type=int, default=80, help="WebP画質 (0-100)")

    args = parser.parse_args()

    process_images(
        input_dir=args.input,
        output_dir=args.output,
        model_name=args.model,
        width=args.width,
        height=args.height,
        prefix=args.prefix,
        crop_bounds=not args.no_crop,
        quality=args.quality,
        fit_mode=args.fit_mode
    )


if __name__ == "__main__":
    main()
