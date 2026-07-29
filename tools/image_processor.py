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
    parser.add_argument("--output", "-o", default="../vampire-survivor-game/public/images/snipe", help="出力ディレクトリ")
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
