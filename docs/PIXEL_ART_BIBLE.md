# Pixel Art Bible

The rules every asset obeys. No individual asset invents its own.

This document is normative: `src/rendering/artRules.ts` carries the same
numbers as code, and `src/tests/artRules.test.ts` fails if the two drift apart.

---

## 1. Camera projection — UNCHANGED, and that is deliberate

The battlefield keeps the perspective the game already has. This is not
inherited debt; it is the one part of the look that already works, and every
new asset is built to fit it rather than the other way round.

```
tile width   TW = 44
tile height  TH = 22          (a 2:1 diamond)

screenX = (col - row) · TW/2 + originX
screenY = (col + row) · TH/2 + originY

grid     20 × 20
```

A 2:1 diamond is the classic pixel-art isometric ratio: a tile edge steps two
pixels across for every one down, so a 1-pixel diagonal line is exact and never
has to be dithered.

**Towers stand at column 7, rows 1 / 5 / 9 / 13 / 17**, two by two tiles each.
The wall runs down column 7; the enemy approaches from column 18–19. The castle
is therefore left of centre and the world comes to it from the right — the
composition carries the game's core idea, and it stays.

## 2. Internal resolution and scaling

```
logical stage      960 × 768 at 1× (grows with the window, see §3)
pixel scale        integer only: 1×, 2×, 3× — never 1.5×
sampling           nearest neighbour, everywhere, no exceptions
rounding           every sprite lands on a whole logical pixel
```

Non-integer scale is what turns pixel art into mush. Where the window does not
divide evenly, the *letterbox* grows — the pixels do not.

## 3. Sizes

Measured in logical pixels, at 1×.

| Thing | Height | Notes |
|---|---|---|
| Foot soldier, rank 1–3 | 22–24 | militia, the shortest silhouettes |
| Foot soldier, rank 4–9 | 24–26 | helmets and mail add mass, not height |
| Foot soldier, rank 10–13 | 26–28 | elite reads through width and detail |
| Crew-served engine | 30–44 | the machine dominates, the crew serves it |
| Tower platform | 2 × 2 tiles | 88 wide at the diamond's waist |
| Tower, ground to crenellation | 70–96 | by type |
| Banner pole | +18 above its mount | |

A unit may never be scaled to signal rank. **Rank reads through armour,
helmet, weapon craftsmanship, cloth and stance** — a rank 13 that is simply
bigger is a rank 1 with a magnifying glass.

## 4. Light

**One sun, from the upper right.** It never moves, and no asset is ever lit
from anywhere else.

```
warm (lit)      #fff4d4
cool (shadow)   #3b3566

top face        base mixed 30 % toward warm
right face      base mixed  6 % toward warm
left face       base mixed 36 % toward cool
```

Contact shadows fall to the **lower left**, opposite the sun. A shadow is a
flattened diamond on the ground plane, never a drop shadow in screen space.

## 5. Outlines

- Silhouette outline: one pixel, a darkened version of the adjacent material —
  never pure black, never a uniform outline colour across materials.
- Interior lines: only where two materials meet and the value difference alone
  would not read at gameplay distance.
- No outline on the lit top face. The eye reads the light there, not a border.

## 6. Palette

Colour is meaning. The world is earth, stone, wood and iron; **saturated colour
is reserved** for banners, heraldry, fire and damage. A battlefield where
everything is colourful is a battlefield where nothing is important.

| Family | Range | Steps |
|---|---|---|
| Earth | `#3a2e20` → `#8a7351` | 5 |
| Grass, worn | `#2f3a22` → `#6d7a45` | 4 |
| Stone | `#4a4a52` → `#a8a49a` | 5 |
| Wood | `#332017` → `#8a6a42` | 4 |
| Iron | `#2a2d33` → `#b9bec6` | 5 |
| Cloth, muted | `#5a3a3a` → `#6a5a3a` | 3 |
| **Heraldic** | `#a8261f`, `#2f5fa8`, `#4f7a3a`, `#e3b552` | flat |
| **Fire** | `#5a1a08` → `#ffd98a` | 5 |

A single sprite uses at most **12 colours**, and at most **5 per material**.
Fewer values, read further.

## 7. Materials

| Material | Treatment |
|---|---|
| Stone | Blocky value clusters, no speckle. Mortar lines only on the lit face. |
| Wood | Grain as 1px broken lines along the length, never across. |
| Iron | Two-value with one bright specular pixel. Highlight on the upper-right edge. |
| Cloth | Broad, soft-edged value shapes; folds are shapes, not lines. |
| Leather | Mid values, low contrast; it must not compete with iron. |
| Earth | Clustered dithering, only between two adjacent ramp steps. |

Dithering is allowed **only** between neighbouring steps of one ramp, and never
across more than a third of a surface.

## 8. Anchors

Every sprite has a **ground anchor**: the point where it touches the tile.

```
anchor            bottom centre of the footprint
ground anchor y   the tile's centre on the ground plane
```

**Every frame of an animation shares the same ground anchor.** A unit's feet do
not move because it is firing. Attack motion happens in the upper body, the
arms, the weapon and the machine — never by moving the whole sprite.

## 9. Sockets

Beyond the anchor, a unit visual declares the points the presentation needs:

| Socket | Meaning |
|---|---|
| `muzzle` | where a projectile is born: bowstring, crossbow nut, sling cup, barrel mouth |
| `recoilPivot` | the point the recoil rotates or translates about |
| `smoke` | where smoke and muzzle flash appear |
| `banner` | where a heraldic mark may be mounted |

A projectile never starts at a sprite's centre, its feet, or the tower's middle.

## 10. Recoil follows the world

Recoil is **opposite the firing vector, in screen space**, derived from the
projection — never a generic vertical nudge.

```
fire direction   normalise(screen(target) − screen(muzzle))
recoil offset    −fireDirection · strength
```

A gun firing toward the lower right recoils toward the upper left. The strength
belongs to the weapon family, not to the sprite.

## 11. Animation

```
frame rate        8 fps for looping idles, 12 fps for firing
idle              2–4 frames, and rare — a castle is not a screensaver
fire              4–8 frames
recovery          2–4 frames
```

Timing is **presentation only**. No animation length may change an outcome: by
the time a frame is drawn, the simulation has already decided everything.

## 12. Layers

Explicit and ordered. Never creation order.

```
0  GROUND          terrain, paths, tracks
1  DECORATION      debris, bushes, craters
2  CASTLE_BACK     what stands behind the garrison
3  TOWERS          the five platforms
4  UNITS           the garrison
5  PROJECTILES     in flight
6  ENEMIES         the approaching army
7  IMPACTS         hits, dust, splinters
8  CASTLE_FRONT    parapet edges that must occlude the garrison
9  WORLD_FX        smoke columns, weather
10 FLOATING_TEXT   damage, formation names
```

Within a layer, depth sorts by `col + row` (back to front on the ground plane),
ties broken by `col`, then by a stable id. Deterministic: the same state always
produces the same order.
