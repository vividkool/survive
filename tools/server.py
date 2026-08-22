
import io
import os
import json
import base64
from pathlib import Path
from typing import Optional, List
import numpy as np
from PIL import Image


import io
import os
import json
import base64
from pathlib import Path
from typing import Optional, List
import numpy as np
from PIL import Image

from flask import Flask, request, jsonify, send_from_directory

# 既存の画像処理関数をインポート
import image_processor as ip

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=str(STATIC_DIR))

SNIPE_OUTPUT_DIR = Path(__file__).parent.parent / "vampire-survivor-game" / "public" / "images" / "snipe"


@app.route("/")
def serve_index():
    return send_from_directory(str(STATIC_DIR), "index.html")


@app.route("/api/process-step", methods=["POST"])
@app.route("/api/process", methods=["POST"])
def process_step():
    """
    ステップごとの個別処理（透過のみ / リサイズのみ / 保存WebPのみ / 一括）
    """

    try:
        step = request.form.get("step", "all") # 'transparent', 'resize', 'export', 'all'
        
        # 入力画像：ファイルアップロード または Base64
        pil_img = None
        if "file" in request.files and request.files["file"].filename:
            pil_img = Image.open(request.files["file"].stream).convert("RGBA")
        elif "image_base64" in request.form and request.form["image_base64"]:
            b64_str = request.form["image_base64"]
            header, encoded = b64_str.split(",", 1) if "," in b64_str else ("", b64_str)
            pil_img = Image.open(io.BytesIO(base64.b64decode(encoded))).convert("RGBA")
        else:
            return jsonify({"detail": "処理対象の画像データがありません"}), 400

        # パラメータ取得
        transparency_mode = request.form.get("transparency_mode", "none")
        target_color = request.form.get("target_color", "#ffffff")
        tolerance = int(request.form.get("tolerance", 30))
        feather = int(request.form.get("feather", 0))
        contiguous_only = request.form.get("contiguous_only", "true") == "true"
        edge_aware = request.form.get("edge_aware", "true") == "true"
        seed_x = int(request.form.get("seed_x")) if request.form.get("seed_x") else None
        seed_y = int(request.form.get("seed_y")) if request.form.get("seed_y") else None
        flip_dir = request.form.get("flip_dir", "horizontal")

        mask_data = request.form.get("mask_data", None)
        crop_bounds = request.form.get("crop_bounds") == "true"
        width = int(request.form.get("width", 1000))
        height = int(request.form.get("height", 480))
        fit_mode = request.form.get("fit_mode", "cover")
        quality = int(request.form.get("quality", 80))
        save_to_game = request.form.get("save_to_game") == "true"
        filename = request.form.get("filename", "")

        # 0. 反転処理ステップ
        if step == "flip":
            pil_img = ip.flip_image(pil_img, direction=flip_dir)

        # 0.5 消しゴムマジック処理ステップ (OpenCV Inpainting)
        if step == "magic_eraser":
            mask_img = None
            if mask_data:
                header, encoded = mask_data.split(",", 1) if "," in mask_data else ("", mask_data)
                mask_bytes = base64.b64decode(encoded)
                mask_img = Image.open(io.BytesIO(mask_bytes))
            pil_img = ip.apply_magic_eraser(pil_img, mask_img=mask_img, mode="inpaint")

        # 1. 透過処理ステップ
        if step in ("transparent", "all"):
            if transparency_mode == "ai":
                if ip.remove is not None:
                    session = ip.new_session("u2netp")
                    pil_img = ip.remove(pil_img, session=session)
            elif transparency_mode == "color_key" and target_color:
                hex_col = target_color.lstrip("#")
                if len(hex_col) == 6:
                    r = int(hex_col[0:2], 16)
                    g = int(hex_col[2:4], 16)
                    b = int(hex_col[4:6], 16)
                    pil_img = ip.remove_color_key(
                        pil_img, r, g, b,
                        tolerance=tolerance,
                        feather=feather,
                        contiguous_only=contiguous_only,
                        seed_x=seed_x,
                        seed_y=seed_y,
                        edge_aware=edge_aware
                    )
            elif transparency_mode == "mask" and mask_data:
                header, encoded = mask_data.split(",", 1) if "," in mask_data else ("", mask_data)
                mask_bytes = base64.b64decode(encoded)
                mask_img = Image.open(io.BytesIO(mask_bytes))
                pil_img = ip.apply_mask_transparency(pil_img, mask_img)

            if crop_bounds and transparency_mode != "none":
                pil_img = ip.crop_bounding_box(pil_img)



        # 2. リサイズ処理ステップ
        if step in ("resize", "all"):
            if fit_mode != "none":
                pil_img = ip.resize_and_pad(pil_img, width, height, fit_mode=fit_mode)

        # 3. WebP出力 & 保存ステップ
        output_buffer = io.BytesIO()
        pil_img.save(output_buffer, format="WEBP", quality=quality)
        output_buffer.seek(0)

        saved_path = None
        orig_name = filename or "image.webp"
        out_name = orig_name if orig_name.endswith(".webp") else f"{Path(orig_name).stem}.webp"

        if (step == "export" or step == "all") and save_to_game:
            SNIPE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            target_path = SNIPE_OUTPUT_DIR / out_name
            with open(target_path, "wb") as f_out:
                f_out.write(output_buffer.getvalue())
            saved_path = str(target_path)
            output_buffer.seek(0)

        base64_webp = base64.b64encode(output_buffer.getvalue()).decode("utf-8")

        return jsonify({
            "status": "success",
            "step": step,
            "filename": out_name,
            "width": pil_img.width,
            "height": pil_img.height,
            "size_bytes": len(output_buffer.getvalue()),
            "saved_path": saved_path,
            "image_base64": f"data:image/webp;base64,{base64_webp}"
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"detail": str(e)}), 500


if __name__ == "__main__":
    print("=" * 60)
    print(" Survive WebP Processing Studio")
    print(" Access http://localhost:8000 in your browser")
    print("=" * 60)
    app.run(host="127.0.0.1", port=8000, debug=False)


