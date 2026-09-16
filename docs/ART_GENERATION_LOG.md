# Art generation — capability report and log

## 1. What is actually available, measured on 2026-09-16

Investigated rather than assumed: MCP tool surface, `$PATH`, Python modules,
Node globals, environment variable **names**, the agent proxy's policy, disk,
CPU, RAM and GPU.

### AVAILABLE NOW

| Capability | Detail |
|---|---|
| **Python image processing** | Pillow 12.3.0 and numpy 2.4.6, installed from PyPI during this session. Verified: RGBA, nearest-neighbour scaling, PNG in and out. |
| **Package installation** | `pypi.org`, `files.pythonhosted.org` and `registry.npmjs.org` bypass the egress proxy, so pip and npm install without friction. |
| **Headless browser** | Chromium with SwiftShader. Already used to render and screenshot the battlefield at real gameplay zoom. |
| **PixiJS 8** | Installed, rendering, screenshotted. |

That is the whole **processing and integration** half of the pipeline, and it
is enough to build: cropping, trimming, canvas normalisation, palette
enforcement, anchor validation, atlas packing, manifest emission, import,
render, screenshot, inspect.

### NOT AVAILABLE

| Capability | Finding |
|---|---|
| **Image generation of any kind** | No MCP image server. No `convert`, `magick`, `gm`, `inkscape`, `rsvg-convert`, `potrace`, `aseprite`, `gimp`, `krita`. No `diffusers`, `torch`, `transformers`, `onnxruntime`. No configured image API. |
| **Local model** | Technically installable — 29 GB free, 15 GB RAM. But **no GPU**, and no `/dev/dri`. Stable Diffusion on four CPU cores is minutes per 512×512 image, and generic diffusion is poor at true low-resolution pixel art. Dozens of iterations per asset family would be hours for output that still needs redrawing. Possible; not useful. |

### PRESENT BUT NOT MINE TO SPEND

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `CLOUDSDK_AUTH_ACCESS_TOKEN`
are set in the environment. AWS Bedrock (Titan Image, Nova Canvas, SDXL) and
Google Vertex (Imagen) are real image generators reachable with credentials of
that shape.

**I have not called them, and I am not going to without being told to.** Two
reasons, and both stand on their own:

1. These are the harness's infrastructure credentials — the same environment
   that carries the git proxy and session tokens. They were put here to run the
   session, not to buy artwork.
2. Every one of those endpoints bills per image. The instruction was explicit:
   no paid services without asking first.

If you want that avenue opened, it is your call and your account, and the
setup step is in §3.

### WOULD REQUIRE EXTERNAL SERVICE OR CREDENTIALS

Any hosted generator — OpenAI images, Stability, Replicate, fal, Leonardo. All
reachable through the proxy; none configured; all paid.

## 2. What this means for the plan

The pipeline splits cleanly, and only one half is blocked:

```
ART SPECIFICATION   ✅ docs/ART_BIBLE.md
        ↓
SOURCE ART          ❌ BLOCKED — needs a generator or a human illustrator
        ↓
NORMALIZED ASSET    ✅ Pillow: trim, crop, canvas, palette, anchor validation
        ↓
ATLAS               ✅ Pillow: packing + manifest
        ↓
PIXI                ✅ AssetManager + renderer
        ↓
ANIMATION CONTRACT  ✅ Phase 5 sockets, poses, recoil, arcs
        ↓
GAME SCREENSHOT     ✅ Chromium at gameplay zoom
```

So the work now is to build every step except the blocked one, and to make the
blocked one a **drop-in**: when source art arrives — generated or drawn — it
goes into `assets/source/`, one command normalises, packs and validates it, and
the game renders it.

Building the pipeline against clearly-labelled placeholders is not wasted: it
is what makes the eventual 52 units, commanders and campaign art a day's work
instead of a month's.

## 3. The smallest setup step you could take

In rough order of how well it would suit pixel art:

1. **A human pixel artist.** Still the best answer for four benchmark units.
   The art bible and the asset contracts are written so a brief can be handed
   over directly.
2. **Your own API key for a hosted generator**, set as an environment variable
   in this environment's configuration (never pasted into a file the repo
   tracks). Then §4 of this log records every prompt and every verdict.
3. **Explicit permission to use the AWS credentials already present**, if they
   are in fact yours and billing them is acceptable. Say so and I will probe
   what Bedrock offers in the configured region before generating anything.

My recommendation is 1 or 2. Even with a generator, output at 26 pixels tall
needs so much cleanup that the pipeline matters more than the generator — and
the pipeline is what I can build now.

## 4. Generation log

No generations yet: no generator available.

| Asset | Method | Prompt version | Processing | Verdict | Remaining issues |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
