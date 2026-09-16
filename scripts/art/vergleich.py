#!/usr/bin/env python3
"""
Bildvergleich gegen die gesicherte Grundlage.

Eine Sichtprüfung, die aus "sieht anders aus" besteht, findet nichts wieder.
Diese hier sagt, WELCHE Aufnahme sich geändert hat und um wie viel — und
schreibt eine Differenzkarte, damit man die Stelle sieht statt sie zu suchen.

    python3 scripts/art/vergleich.py            # alle
    python3 scripts/art/vergleich.py kanone     # eine

Rückgabewert 1, wenn sich etwas über der Schwelle geändert hat. Die Schwelle
ist bewusst nicht null: der Weichzeichner einer Schriftkante darf sich um einen
Grauwert unterscheiden, ohne die Prüfung rot zu machen.
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError:  # pragma: no cover
    print("Pillow fehlt.", file=sys.stderr)
    raise SystemExit(2)

WURZEL = Path(__file__).resolve().parents[2]
AUFNAHMEN = WURZEL / "docs" / "blick"
GRUNDLAGE = AUFNAHMEN / "grundlage"
KARTEN = AUFNAHMEN / "unterschied"

# Ab wie viel geänderten Bildpunkten es der Rede wert ist.
SCHWELLE_ANTEIL = 0.001
# Ab welcher Kanaldifferenz ein Bildpunkt als geändert gilt.
SCHWELLE_WERT = 8


def vergleiche(name: str) -> tuple[float, int]:
    neu = Image.open(AUFNAHMEN / f"{name}.png").convert("RGB")
    alt = Image.open(GRUNDLAGE / f"{name}.png").convert("RGB")
    if neu.size != alt.size:
        return (1.0, -1)

    unterschied = ImageChops.difference(neu, alt)
    # Der größte Kanalunterschied je Bildpunkt, damit eine Farbverschiebung
    # nicht durch Mittelung verschwindet.
    r, g, b = unterschied.split()
    stark = ImageChops.lighter(ImageChops.lighter(r, g), b)
    punkte = stark.point(lambda v: 255 if v >= SCHWELLE_WERT else 0)
    geaendert = sum(1 for v in punkte.getdata() if v)
    gesamt = neu.size[0] * neu.size[1]

    if geaendert:
        KARTEN.mkdir(parents=True, exist_ok=True)
        # Rot auf schwarz: wo es sich geändert hat, und sonst nichts.
        karte = Image.merge("RGB", (punkte, Image.new("L", neu.size, 0),
                                    Image.new("L", neu.size, 0)))
        karte.save(KARTEN / f"{name}.png")

    return (geaendert / gesamt, geaendert)


def main() -> int:
    if not GRUNDLAGE.exists():
        print("Keine Grundlage. Erst: node scripts/blick.mjs --grundlage")
        return 0

    gewaehlt = sys.argv[1:]
    namen = sorted(p.stem for p in GRUNDLAGE.glob("*.png"))
    if gewaehlt:
        namen = [n for n in namen if n in gewaehlt]

    schlimm = 0
    for name in namen:
        if not (AUFNAHMEN / f"{name}.png").exists():
            print(f"  {name:<18} FEHLT")
            schlimm += 1
            continue
        anteil, punkte = vergleiche(name)
        if punkte == -1:
            print(f"  {name:<18} GRÖSSE GEÄNDERT")
            schlimm += 1
        elif anteil > SCHWELLE_ANTEIL:
            print(f"  {name:<18} {anteil * 100:6.2f} % ({punkte} Punkte)")
            schlimm += 1
        else:
            print(f"  {name:<18} gleich")

    neu = {p.stem for p in AUFNAHMEN.glob("*.png")} - set(
        p.stem for p in GRUNDLAGE.glob("*.png"))
    for name in sorted(neu):
        print(f"  {name:<18} NEU (noch keine Grundlage)")

    print()
    if schlimm:
        print(f"{schlimm} Aufnahme(n) geändert. Karten in docs/blick/unterschied/")
        return 1
    print("Alles wie in der Grundlage.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
