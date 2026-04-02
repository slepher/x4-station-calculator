import argparse
import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}


def contours_to_svg(mask, outpath, width, height):
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_TC89_KCOS)
    paths = []
    for c in contours:
        eps = 0.8
        approx = cv2.approxPolyDP(c, eps, True)
        pts = approx[:, 0, :]
        if len(pts) < 3:
            continue
        d = f"M {pts[0][0]} {pts[0][1]} " + " ".join(f"L {x} {y}" for x, y in pts[1:]) + " Z"
        paths.append(d)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" shape-rendering="geometricPrecision">
  <rect width="{width}" height="{height}" fill="#000"/>
  <path d="{' '.join(paths)}" fill="#fff" fill-rule="evenodd"/>
</svg>'''
    open(outpath, 'w', encoding='utf-8').write(svg)


def build_output_path(input_path: Path, output: str | None, output_dir: str | None, multi_input: bool):
    if output:
        output_path = Path(output)
        if output_path.exists() and output_path.is_dir():
            return output_path / f"{input_path.stem}.svg"
        if str(output).endswith(os.sep):
            return output_path / f"{input_path.stem}.svg"
        if multi_input:
            raise ValueError("--output must be a directory when multiple input files are provided")
        return output_path
    if output_dir:
        output_path = Path(output_dir)
        return output_path / f"{input_path.stem}.svg"
    return input_path.with_suffix(".svg")


def convert_image(input_path: str, output_path: Path):
    img = np.array(Image.open(input_path).convert('RGBA'))
    height, width = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_RGBA2GRAY)
    alpha = img[:, :, 3]
    mask = ((gray > 180) & (alpha > 0)).astype(np.uint8) * 255
    output_path.parent.mkdir(parents=True, exist_ok=True)
    contours_to_svg(mask, str(output_path), width, height)
    return str(output_path)


def resolve_input_paths(inputs: list[str]):
    resolved = []
    for raw_input in inputs:
        input_path = Path(raw_input)
        if not input_path.exists():
            raise FileNotFoundError(f"Input path does not exist: {input_path}")
        if input_path.is_dir():
            image_files = sorted(
                path for path in input_path.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
            )
            if not image_files:
                raise ValueError(f"No supported image files found in directory: {input_path}")
            resolved.extend(image_files)
            continue
        resolved.append(input_path)
    return resolved


def parse_args():
    parser = argparse.ArgumentParser(description="Convert PNG icons to simplified SVG using OpenCV contours.")
    parser.add_argument("inputs", nargs="+", help="One or more input image paths.")
    parser.add_argument("-o", "--output", help="Output SVG path, or output directory when used with multiple inputs.")
    parser.add_argument("--output-dir", help="Directory for generated SVG files.")
    args = parser.parse_args()
    if args.output and args.output_dir:
        parser.error("--output and --output-dir cannot be used together")
    return args


def main():
    args = parse_args()
    input_paths = resolve_input_paths(args.inputs)
    outputs = []
    for input_path in input_paths:
        output_path = build_output_path(
            input_path,
            args.output,
            args.output_dir,
            multi_input=len(input_paths) > 1,
        )
        outputs.append(convert_image(str(input_path), output_path))
    print(outputs)


if __name__ == "__main__":
    main()
