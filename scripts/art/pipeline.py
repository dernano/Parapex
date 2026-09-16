#!/usr/bin/env python3
"""
The asset pipeline: SOURCE ART -> NORMALISED -> ATLAS -> MANIFEST.

    python3 scripts/art/pipeline.py [--strict]

Reads every PNG under assets/source/, checks it against assets/specs.json,
normalises it onto the family's frame at the family's anchor, packs the
survivors into an atlas and writes a manifest the game imports.

THE POINT IS THE REJECTION. An image generator, and a tired human, will both
produce assets that break the art bible: the wrong canvas, a background that
is not transparent, a palette from another game, a silhouette that does not
touch its own anchor. A pipeline that accepts those quietly produces a game
where every asset is slightly wrong and nobody can say why. So every check
below either passes or names the file, the rule and the measurement.

Missing slots are reported too. A required asset that does not exist yet is
listed as MISSING rather than filled in with something, because a gap one can
see is worth more than a placeholder one forgets.
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SPECS = json.loads((ROOT / 'assets' / 'specs.json').read_text(encoding='utf-8'))
SOURCE = ROOT / 'assets' / 'source'
BUILD = ROOT / 'assets' / 'build'

STRICT = '--strict' in sys.argv


def hex_of(pixel):
    return '#%02x%02x%02x' % pixel[:3]


def palette_set():
    out = set()
    for ramp in SPECS['palette'].values():
        out.update(c.lower() for c in ramp)
    return out


ALLOWED = palette_set()


class Finding:
    """One thing wrong with one asset. Carries the measurement, not a verdict."""

    def __init__(self, path, rule, detail, fatal=True):
        self.path = path
        self.rule = rule
        self.detail = detail
        self.fatal = fatal

    def __str__(self):
        mark = 'ABGELEHNT' if self.fatal else 'Hinweis  '
        return f'  {mark}  {self.path}\n             {self.rule}: {self.detail}'


def inspect(path: Path, family: str, spec: dict):
    """Everything that can be measured about one source image."""
    findings = []
    image = Image.open(path).convert('RGBA')
    width, height = image.size
    frame = spec['frame']

    # 1. Canvas. Larger is allowed and trimmed; smaller cannot be centred honestly.
    if width > frame['w'] * 4 or height > frame['h'] * 4:
        findings.append(Finding(path.name, 'Leinwand',
            f'{width}x{height} ist mehr als das Vierfache des Rahmens '
            f"{frame['w']}x{frame['h']} — vermutlich Konzeptbild statt Anlage"))

    # 2. Background. Pixel art for this game is cut out, always.
    corners = [image.getpixel(p) for p in
               ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1))]
    opaque_corners = [c for c in corners if c[3] > 16]
    if len(opaque_corners) >= 3:
        findings.append(Finding(path.name, 'Hintergrund',
            'drei oder mehr Ecken sind deckend — der Hintergrund wurde nicht entfernt'))

    # 3. Palette. Counted, and the strays are named.
    colours = {}
    for count, pixel in image.getcolors(maxcolors=1 << 20) or []:
        if pixel[3] < 16:
            continue
        colours[hex_of(pixel)] = colours.get(hex_of(pixel), 0) + count
    if len(colours) > spec['maxColours']:
        worst = sorted(colours.items(), key=lambda kv: -kv[1])[:spec['maxColours'] + 3]
        findings.append(Finding(path.name, 'Palette',
            f"{len(colours)} Farben, erlaubt sind {spec['maxColours']}. "
            f"Häufigste: {', '.join(c for c, _ in worst[:6])}"))
    strays = [c for c in colours if c not in ALLOWED]
    if strays:
        findings.append(Finding(path.name, 'Palette',
            f'{len(strays)} Farben stehen nicht in der Bibel: '
            + ', '.join(sorted(strays)[:6]), fatal=STRICT))

    # 4. Is there anything there at all?
    box = image.getbbox()
    if box is None:
        findings.append(Finding(path.name, 'Inhalt', 'das Bild ist vollständig leer'))
        return image, findings

    # 5. Silhouette. A soldier that fills its frame edge to edge has no
    #    negative space around it and will look pasted onto the tower.
    solid = sum(1 for _, p in (image.getcolors(1 << 20) or []) if p[3] > 128)
    filled = (box[2] - box[0]) * (box[3] - box[1])
    if filled and filled / (width * height) > 0.92:
        findings.append(Finding(path.name, 'Silhouette',
            'füllt über 92 % des Rahmens — zu wenig Luft um die Figur', fatal=False))

    return image, findings


def normalise(image: Image.Image, spec: dict) -> Image.Image:
    """
    Trim, then place on the family's frame at the family's anchor.

    The anchor is the contract: the point that touches the tile. Everything in
    the renderer — depth order, contact shadow, muzzle socket, recoil pivot —
    is measured from it, so it is set here once rather than guessed per sprite.
    """
    box = image.getbbox()
    if box:
        image = image.crop(box)
    frame, anchor = spec['frame'], spec['anchor']
    canvas = Image.new('RGBA', (frame['w'], frame['h']), (0, 0, 0, 0))
    # Bottom centre of the trimmed art onto the declared anchor.
    x = anchor['x'] - image.width // 2
    y = anchor['y'] - image.height + 1
    canvas.paste(image, (x, y), image)
    return canvas


def pack(frames):
    """
    A simple shelf packer. Deterministic: same input, same atlas, so a diff of
    the manifest shows what actually changed rather than a reshuffle.
    """
    frames = sorted(frames, key=lambda f: (-f['image'].height, f['id']))
    width = 256
    shelves, x, y, shelf_h = [], 0, 0, 0
    placed = []
    for frame in frames:
        w, h = frame['image'].size
        if x + w > width:
            y += shelf_h
            x, shelf_h = 0, 0
        placed.append({**frame, 'x': x, 'y': y})
        x += w
        shelf_h = max(shelf_h, h)
    height = y + shelf_h
    atlas = Image.new('RGBA', (width, max(1, height)), (0, 0, 0, 0))
    for frame in placed:
        atlas.paste(frame['image'], (frame['x'], frame['y']))
    return atlas, placed


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    findings, frames, present = [], [], set()

    for family, spec in SPECS['families'].items():
        for path in sorted((SOURCE / family).rglob('*.png')) if (SOURCE / family).exists() else []:
            slot = str(path.relative_to(SOURCE / family).with_suffix(''))
            present.add(f'{family}/{slot}')
            image, found = inspect(path, family, spec)
            findings.extend(found)
            if any(f.fatal for f in found):
                continue
            frames.append({'id': f'{family}/{slot}', 'family': family,
                           'image': normalise(image, spec)})

    missing = []
    for family, slots in SPECS['required'].items():
        if family == '_note':
            continue
        for slot in slots:
            if f'{family}/{slot}' not in present:
                missing.append(f'{family}/{slot}')

    atlas, placed = pack(frames)
    atlas.save(BUILD / 'combat.png')
    manifest = {
        '_note': 'Generated by scripts/art/pipeline.py. Do not hand-edit.',
        'atlas': 'combat.png',
        'size': {'w': atlas.width, 'h': atlas.height},
        'frames': {
            f['id']: {
                'x': f['x'], 'y': f['y'],
                'w': f['image'].width, 'h': f['image'].height,
                'anchor': SPECS['families'][f['family']]['anchor'],
                'family': f['family'],
            } for f in placed
        },
        'missing': sorted(missing),
    }
    (BUILD / 'combat.json').write_text(json.dumps(manifest, indent=1) + '\n', encoding='utf-8')

    rejected = sum(1 for f in findings if f.fatal)
    print(f'{len(frames)} Anlagen gepackt, {rejected} abgelehnt, {len(missing)} Plätze leer.')
    for finding in findings:
        print(finding)
    if missing:
        print('\nFEHLENDE PFLICHTPLÄTZE (nicht ersetzt, sondern gemeldet):')
        for slot in missing:
            print(f'  {slot}')
    return 1 if (rejected and STRICT) else 0


def selftest() -> int:
    """
    Does the rejection actually reject?

    Three fixtures under scripts/art/selftest/: one that obeys the bible, one
    whose background was never removed, one painted from another game's
    palette. A pipeline that has never been seen to refuse anything is a
    pipeline that will wave through the first bad batch.
    """
    here = Path(__file__).resolve().parent / 'selftest'
    cases = [('good.png', False), ('opaque-background.png', True), ('alien-palette.png', True)]
    spec = SPECS['families']['unit']
    failures = []
    for name, should_reject in cases:
        _, found = inspect(here / name, 'unit', spec)
        rejected = any(f.fatal for f in found)
        mark = 'ok  ' if rejected == should_reject else 'FEHL'
        reasons = ', '.join(sorted({f.rule for f in found if f.fatal})) or '—'
        print(f'  {mark} {name:24} abgelehnt={rejected} ({reasons})')
        if rejected != should_reject:
            failures.append(name)
    print('  Selbsttest bestanden.' if not failures else f'  SELBSTTEST GEFALLEN: {failures}')
    return 1 if failures else 0


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    sys.exit(main())
