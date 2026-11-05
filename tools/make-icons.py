#!/usr/bin/env python3
"""Genere les icones PNG de WifiPro sans dependance externe."""
import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

RINGS = [(0.160, 0.048), (0.285, 0.052), (0.410, 0.056)]
DOT = 0.075
SAMPLES = 3


def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def png_bytes(size, rows):
    raw = b"".join(b"\x00" + row for row in rows)
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return (
        signature
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def make_icon(size):
    cx = size / 2.0
    cy = size * 0.70
    step = SAMPLES * SAMPLES
    rows = []

    for y in range(size):
        row = bytearray()
        for x in range(size):
            acc_r = acc_g = acc_b = 0
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    px = x + (sx + 0.5) / SAMPLES
                    py = y + (sy + 0.5) / SAMPLES

                    t = py / size
                    r = int(11 + (18 - 11) * t)
                    g = int(122 + (178 - 122) * t)
                    b = int(76 + (111 - 76) * t)

                    dx = px - cx
                    dy = py - cy
                    dist = math.hypot(dx, dy)
                    white = dist <= DOT * size

                    if not white and dy < 0:
                        angle = math.degrees(math.atan2(-dy, dx))
                        if 28.0 <= angle <= 152.0:
                            for ring, thickness in RINGS:
                                if abs(dist - ring * size) <= thickness * size * 0.5:
                                    white = True
                                    break

                    if white:
                        r = g = b = 255

                    acc_r += r
                    acc_g += g
                    acc_b += b

            row += bytes((acc_r // step, acc_g // step, acc_b // step))
        rows.append(bytes(row))

    return png_bytes(size, rows)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (180, 192, 512):
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        with open(path, "wb") as fh:
            fh.write(make_icon(size))
        print("ecrit", path)


if __name__ == "__main__":
    main()
