"""Rebuild the approved generated sheets with Pillow; no network or chroma key."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CELL = (320, 224)
ANCHOR = (192, 210)
SCALE = 0.66
SHEETS = {
    "shuriken": {
        "size": (1254, 1254), "rows": [0, 420, 830, 1254], "scale": .49,
        "columns": {0: [0, 313, 627, 940, 1254], 1: [0, 313, 645, 967, 1254], 2: [0, 313, 627, 940, 1254]},
        "roots": [141, 136, 122, 129, 142, 130, 123, 129, 153, 147, 130, 129],
        "states": ["idle", "fire", "hurt"],
    },
    "barrel": {
        "rows": [0, 370, 715, 1024], "scale": .56,
        "columns": {2: [0, 384, 730, 1125, 1536]},
        "roots": [244, 204, 201, 197, 189, 190, 227, 175, 188, 146, 150, 180],
        "states": ["walk", "attack", "fall"],
        "gear": [(242, 240, 8), (216, 235, 8), (211, 240, 8), (209, 236, 6),
                 (214, 200, -22), (217, 196, -24), (230, 215, 30), (211, 205, -15)],
        "arms": [
            [(85, 177), (192, 166), (207, 183), (137, 200), (128, 233), (80, 233)],
            [(59, 173), (163, 164), (183, 184), (108, 198), (103, 226), (55, 226)],
            [(53, 175), (154, 165), (180, 184), (102, 202), (97, 234), (50, 234)],
            [(43, 175), (148, 166), (167, 183), (91, 199), (89, 231), (40, 231)],
            [(119, 90), (200, 125), (222, 141), (270, 147), (264, 173), (214, 171), (143, 166), (145, 137), (116, 121)],
            [(76, 62), (169, 115), (206, 132), (250, 146), (237, 177), (188, 161), (94, 143), (91, 112), (161, 130), (130, 102), (76, 87)],
            [(22, 137), (100, 160), (157, 168), (190, 158), (209, 182), (164, 203), (62, 208), (54, 174), (98, 183), (24, 162)],
            [(69, 109), (147, 142), (176, 150), (215, 148), (225, 178), (164, 181), (96, 167), (94, 141), (67, 133)],
        ],
        "near_arms": [
            [(159, 210), (216, 198), (247, 185), (267, 193), (258, 217), (213, 230), (183, 251), (157, 245)],
            [(157, 205), (219, 185), (246, 180), (253, 204), (218, 223), (174, 241), (151, 231)],
            [(136, 213), (193, 201), (223, 185), (245, 194), (234, 221), (188, 237), (159, 253), (132, 246)],
            [(148, 209), (208, 192), (231, 184), (250, 195), (237, 218), (195, 234), (163, 246), (145, 236)],
        ],
    },
    "courier": {
        "rows": [0, 370, 700, 1024], "scale": .56,
        "columns": {2: [0, 384, 720, 1125, 1536]},
        "roots": [200, 220, 208, 212, 232, 211, 207, 196, 194, 145, 142, 171],
        "states": ["walk", "attack", "fall"],
        "gear": [(139, 257, 0), (146, 247, -4), (143, 255, 2), (143, 253, -2),
                 (151, 217, 0), (142, 212, -8), (153, 225, -3), (144, 216, 0)],
        "hands": [(177, 229), (183, 221), (177, 231), (181, 227),
                  (190, 187), (179, 179), (194, 196), (183, 188)],
    },
    "cactus": {
        "size": (1448, 1086), "rows": [0, 362, 724, 1086], "scale": .56,
        "roots": [194, 183, 174, 165, 194, 181, 171, 164, 192, 181, 172, 164],
        "states": ["idle", "fire", "hurt"],
    },
    "storm": {
        "rows": [0, 341, 683, 1024], "scale": .58,
        "roots": [216, 212, 170, 166, 209, 187, 163, 178, 211, 204, 182, 165],
        "states": ["idle", "fire", "hurt"],
    },
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


def clean_alpha(image):
    image = image.convert("RGBA")
    image.putalpha(image.getchannel("A").point(lambda a: round(max(0, min(1, (a - 12) / 241)) * 255)))
    return image


def load_props(source):
    image = clean_alpha(Image.open(source))
    if image.size != (1536, 1024):
        raise ValueError("Unexpected approved prop sheet size")
    props = {}
    for index, name in enumerate(["barrel", "courier"]):
        cell = image.crop((index * 768, 0, (index + 1) * 768, 1024))
        bounds = cell.getchannel("A").getbbox()
        if not bounds or bounds[0] == 0 or bounds[2] == 768:
            raise ValueError(f"{name}: prop touches its source boundary")
        props[name] = cell.crop(bounds)
    return props


def equip(body, name, spec, index, prop):
    if index >= 8:
        return body
    cx, cy, angle = spec["gear"][index]
    width = 145 if name == "barrel" else 130
    size = (width, round(prop.height * width / prop.width))
    overlay = prop.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    hole = Image.new("L", size)
    if name == "barrel":
        ImageDraw.Draw(hole).ellipse((width * .17, size[1] * .04, width * .81, size[1] * .17), fill=255)
    overlay = overlay.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    hole = hole.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    point = (round(cx - overlay.width / 2), round(cy - overlay.height / 2))
    result = body.copy()
    result.alpha_composite(overlay, point)
    foreground = Image.new("L", body.size)
    foreground.paste(hole, point)
    brush = ImageDraw.Draw(foreground)
    if name == "barrel":
        brush.polygon(spec["arms"][index], fill=255)
        if index < 4:
            brush.polygon(spec["near_arms"][index], fill=255)
    else:
        hx, hy = spec["hands"][index]
        brush.ellipse((hx - 35, hy - 22, hx + 25, hy + 25), fill=255)
    layer = body.copy()
    layer.putalpha(ImageChops.multiply(body.getchannel("A"), foreground))
    result.alpha_composite(layer)
    return result


def build(names, source_dir, suffix, props_source):
    output = ROOT / "assets" / "sprites"
    output.mkdir(parents=True, exist_ok=True)
    report = {"cell": CELL, "anchor": ANCHOR, "sourceScale": SCALE, "sheets": {}}
    report_path = output / "alignment.json"
    if report_path.exists():
        report["sheets"].update(json.loads(report_path.read_text(encoding="utf-8"))["sheets"])
    props = load_props(props_source) if props_source else {}
    for name in names:
        spec = SHEETS[name]
        image = Image.open(source_dir / f"{name}{suffix}").convert("RGBA")
        expected_size = spec.get("size", (1536, 1024))
        if image.size != expected_size:
            raise ValueError(f"{name}: expected the approved {expected_size} sheet")
        column_width = image.width // 4
        # The source contains near-transparent RGB haze, not a solid background.
        image = clean_alpha(image)
        atlas = Image.new("RGBA", (CELL[0] * 4, CELL[1] * 3))
        bare_atlas = Image.new("RGBA", atlas.size) if "gear" in spec else None
        if bare_atlas is not None and name not in props:
            raise ValueError(f"{name}: approved props required; pass --props-source")
        frames = []
        for index in range(12):
            row, col = divmod(index, 4)
            columns = spec.get("columns", {}).get(row, [n * column_width for n in range(5)])
            source_rect = (columns[col], spec["rows"][row], columns[col + 1], spec["rows"][row + 1])
            cell = image.crop(source_rect)
            bounds = cell.getchannel("A").getbbox()
            if not bounds or bounds[0] == 0 or bounds[1] == 0 or bounds[2] == cell.width or bounds[3] == cell.height:
                raise ValueError(f"{name}/{index}: frame intersects a source cell boundary")
            anchor_x = col * column_width + spec["roots"][index] - source_rect[0]
            contact_y = bounds[3]
            source_bounds = bounds
            source_root = [anchor_x, contact_y]
            flipped = index in spec.get("flip", [])
            if flipped:
                cell = cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                anchor_x = cell.width - anchor_x
                bounds = cell.getchannel("A").getbbox()
            bare_cell = cell.copy()
            if bare_atlas is not None:
                cell = equip(cell, name, spec, index, props[name])
                bounds = cell.getchannel("A").getbbox()
            cropped = cell.crop(bounds)
            scale = spec.get("scale", SCALE)
            size = (round(cropped.width * scale), round(cropped.height * scale))
            resized = cropped.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")
            left = ANCHOR[0] + round((bounds[0] - anchor_x) * scale)
            top = ANCHOR[1] + round((bounds[1] - contact_y) * scale)
            if left < 3 or top < 3 or left + size[0] > CELL[0] - 3 or top + size[1] > ANCHOR[1] + 1:
                raise ValueError(f"{name}/{index}: aligned frame is clipped")
            atlas.alpha_composite(resized, (col * CELL[0] + left, row * CELL[1] + top))
            if bare_atlas is not None:
                bare_crop = bare_cell.crop(source_bounds)
                bare_size = (round(bare_crop.width * scale), round(bare_crop.height * scale))
                bare_resized = bare_crop.convert("RGBa").resize(bare_size, Image.Resampling.LANCZOS).convert("RGBA")
                bare_atlas.alpha_composite(bare_resized, (
                    col * CELL[0] + ANCHOR[0] + round((source_bounds[0] - anchor_x) * scale),
                    row * CELL[1] + ANCHOR[1] - bare_size[1]))
            frames.append({
                "state": spec["states"][row], "column": col, "sourceCell": source_rect,
                "sourceBounds": source_bounds, "sourceRoot": source_root, "scale": scale, "flipped": flipped,
                "alignedBounds": [left, top, left + size[0], top + size[1]],
            })
        destination = output / f"{name}.png"
        atlas.save(destination, optimize=True)
        if bare_atlas is not None:
            bare_atlas.save(output / f"{name}-bare.png", optimize=True)
        report["sheets"][name] = frames
        print(f"{name}: 12 frames, {atlas.width}x{atlas.height}, {destination.stat().st_size / 1024:.1f} KiB")
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if props:
        gear_atlas = Image.new("RGBA", (640, 224))
        for index, name in enumerate(["barrel", "courier"]):
            prop = props[name]
            width = round((145 if name == "barrel" else 130) * .56)
            size = (width, round(prop.height * width / prop.width))
            resized = prop.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")
            gear_atlas.alpha_composite(resized, (index * 320 + 160 - size[0] // 2, 112 - size[1] // 2))
        gear_atlas.save(output / "desert-gear.png", optimize=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--names", nargs="+", choices=SHEETS,
                        default=[name for name in SHEETS if name not in {"cactus", "storm", "barrel", "courier", "shuriken"}])
    parser.add_argument("--source-dir", type=Path, default=ROOT / "art-source")
    parser.add_argument("--suffix", default="-source.png")
    parser.add_argument("--props-source", type=Path)
    parser.add_argument("--shuriken-projectile", type=Path)
    args = parser.parse_args()
    build(args.names, args.source_dir, args.suffix, args.props_source)
    if args.shuriken_projectile:
        image = clean_alpha(Image.open(args.shuriken_projectile))
        if image.size != (1254, 1254):
            raise ValueError("Unexpected approved shuriken projectile size")
        # The circular hub is at (627, 615), not the file's center.
        image = image.crop((157, 145, 1097, 1085))
        image = image.convert("RGBa").resize((128, 128), Image.Resampling.LANCZOS).convert("RGBA")
        image.save(ROOT / "assets" / "sprites" / "shuriken-projectile.png", optimize=True)
