"""Rebuild the approved generated sheets with Pillow; no network or chroma key."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CELL = (320, 224)
ANCHOR = (192, 210)
SCALE = 0.66
SHEETS = {
    "pea": {
        "rows": [0, 350, 660, 1024],
        "roots": [199, 193, 179, 173, 194, 195, 177, 173, 197, 190, 186, 176],
        "states": ["idle", "fire", "hurt"],
    },
    "sleepy": {
        "rows": [0, 350, 687, 1024],
        "roots": [232, 205, 200, 203, 237, 223, 244, 208, 213, 257, 291, 289],
        "states": ["walk", "attack", "fall"],
    },
    "sun": {
        "rows": [0, 334, 665, 1024], "scale": .61, "flip": [2],
        "roots": [203, 190, 207, 164, 203, 190, 202, 165, 193, 190, 202, 164],
        "states": ["idle", "produce", "hurt"],
    },
    "wall": {
        "rows": [0, 346, 678, 1024], "scale": .61,
        "roots": [204, 204, 198, 193, 203, 203, 200, 192, 204, 204, 198, 193],
        "states": ["idle", "guard", "cracked"],
    },
    "frost": {
        "rows": [0, 346, 672, 1024], "scale": .61,
        "columns": {1: [0, 384, 731, 1164, 1536]},
        "roots": [168, 177, 177, 176, 194, 177, 177, 173, 200, 193, 181, 173],
        "states": ["idle", "fire", "hurt"],
    },
    "bomb": {
        "rows": [0, 343, 682, 1024], "scale": .61, "flip": [2, 3],
        "roots": [201, 206, 177, 178, 200, 203, 183, 181, 202, 202, 183, 183],
        "states": ["idle", "prime", "burst"],
    },
    "jelly": {
        "rows": [0, 377, 706, 1024], "scale": .61,
        "columns": {1: [0, 400, 793, 1178, 1536], 2: [0, 374, 720, 1111, 1536]},
        "roots": [229, 225, 200, 196, 241, 258, 221, 210, 243, 225, 264, 286],
        "states": ["walk", "attack", "fall"],
    },
    "roller": {
        "rows": [0, 360, 693, 1024], "scale": .61,
        "columns": {2: [0, 384, 723, 1124, 1536]},
        "roots": [221, 206, 193, 222, 255, 227, 219, 215, 230, 242, 267, 272],
        "states": ["walk", "attack", "fall"],
    },
    "umbrella": {
        "rows": [0, 354, 690, 1024], "scale": .61,
        "columns": {1: [0, 368, 793, 1163, 1536]},
        "roots": [274, 240, 235, 237, 259, 297, 274, 258, 269, 177, 270, 282],
        "states": ["walk", "attack", "fall"],
    },
    "twin": {
        "rows": [0, 349, 666, 1024], "scale": .61,
        "roots": [208, 202, 190, 186, 208, 201, 192, 185, 208, 200, 189, 186],
        "states": ["idle", "fire", "hurt"],
    },
    "thorn": {
        "rows": [0, 341, 674, 1024], "scale": .58,
        "columns": {1: [0, 384, 750, 1152, 1536]},
        "roots": [165, 164, 152, 151, 167, 158, 151, 156, 174, 168, 162, 165],
        "states": ["idle", "fire", "hurt"],
    },
    "pumpkin": {
        "rows": [0, 336, 674, 1024], "scale": .58,
        "columns": {1: [0, 384, 768, 1190, 1536]},
        "roots": [198, 204, 193, 179, 220, 205, 195, 185, 198, 199, 189, 189],
        "states": ["idle", "fire", "hurt"],
    },
    "lantern": {
        "rows": [0, 336, 666, 1024], "scale": .61,
        "roots": [176, 176, 175, 174, 174, 173, 172, 170, 179, 138, 179, 172],
        "states": ["idle", "produce", "hurt"],
    },
    "iron": {
        "rows": [0, 345, 682, 1024], "scale": .60,
        "roots": [220, 192, 185, 157, 214, 191, 177, 158, 218, 194, 177, 157],
        "states": ["idle", "guard", "cracked"],
    },
}


def build():
    output = ROOT / "assets" / "sprites"
    output.mkdir(parents=True, exist_ok=True)
    report = {"cell": CELL, "anchor": ANCHOR, "sourceScale": SCALE, "sheets": {}}
    for name, spec in SHEETS.items():
        image = Image.open(ROOT / "art-source" / f"{name}-source.png").convert("RGBA")
        if image.size != (1536, 1024):
            raise ValueError(f"{name}: expected the approved 1536x1024 sheet")
        # The source contains near-transparent RGB haze, not a solid background.
        image.putalpha(image.getchannel("A").point(lambda a: round(max(0, min(1, (a - 12) / 241)) * 255)))
        atlas = Image.new("RGBA", (CELL[0] * 4, CELL[1] * 3))
        frames = []
        for index in range(12):
            row, col = divmod(index, 4)
            columns = spec.get("columns", {}).get(row, [0, 384, 768, 1152, 1536])
            source_rect = (columns[col], spec["rows"][row], columns[col + 1], spec["rows"][row + 1])
            cell = image.crop(source_rect)
            bounds = cell.getchannel("A").getbbox()
            if not bounds or bounds[0] == 0 or bounds[1] == 0 or bounds[2] == cell.width or bounds[3] == cell.height:
                raise ValueError(f"{name}/{index}: frame intersects a source cell boundary")
            anchor_x = col * 384 + spec["roots"][index] - source_rect[0]
            contact_y = bounds[3]
            source_bounds = bounds
            source_root = [anchor_x, contact_y]
            flipped = index in spec.get("flip", [])
            if flipped:
                cell = cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                anchor_x = cell.width - anchor_x
                bounds = cell.getchannel("A").getbbox()
            cropped = cell.crop(bounds)
            scale = spec.get("scale", SCALE)
            size = (round(cropped.width * scale), round(cropped.height * scale))
            resized = cropped.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")
            left = ANCHOR[0] + round((bounds[0] - anchor_x) * scale)
            top = ANCHOR[1] - size[1]
            if left < 3 or top < 3 or left + size[0] > CELL[0] - 3:
                raise ValueError(f"{name}/{index}: aligned frame is clipped")
            atlas.alpha_composite(resized, (col * CELL[0] + left, row * CELL[1] + top))
            frames.append({
                "state": spec["states"][row], "column": col, "sourceCell": source_rect,
                "sourceBounds": source_bounds, "sourceRoot": source_root, "scale": scale, "flipped": flipped,
                "alignedBounds": [left, top, left + size[0], top + size[1]],
            })
        destination = output / f"{name}.png"
        atlas.save(destination, optimize=True)
        report["sheets"][name] = frames
        print(f"{name}: 12 frames, {atlas.width}x{atlas.height}, {destination.stat().st_size / 1024:.1f} KiB")
    (output / "alignment.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
