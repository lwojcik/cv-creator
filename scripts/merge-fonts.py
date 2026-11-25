"""Merge the latin and latin-ext subsets of DM Sans into one file per weight.

Separate subsets make Chrome embed two fonts for a word like "Łukasz", which some PDF parsers then read as "Ł ukasz".
Usage (after npm install): pip install fonttools brotli && python3 scripts/merge-fonts.py
"""
import shutil
import tempfile
from pathlib import Path

from fontTools.merge import Merger
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
package = root / 'node_modules/@fontsource/dm-sans'
out = root / 'fonts'
out.mkdir(exist_ok=True)

for face in ('300-normal', '400-normal', '400-italic', '600-normal', '700-normal'):
    stamp = None
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for subset in ('latin', 'latin-ext'):
            font = TTFont(package / f'files/dm-sans-{subset}-{face}.woff2', recalcTimestamp=False)
            font.flavor = None
            stamp = stamp or (font['head'].created, font['head'].modified)
            part = f'{tmp}/{subset}.ttf'
            font.save(part)
            parts.append(part)
        merged = Merger().merge(parts)
        # Keep the output identical between runs: the merger stamps the current time.
        merged.recalcTimestamp = False
        merged['head'].created, merged['head'].modified = stamp
        merged.flavor = 'woff2'
        merged.save(out / f'dm-sans-{face}.woff2')

shutil.copy(package / 'LICENSE', out / 'LICENSE')
