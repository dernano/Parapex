import type { Texture } from 'pixi.js';
import { Assets, Rectangle, Texture as PixiTexture } from 'pixi.js';

/**
 * Where source art enters the game.
 *
 * `scripts/art/pipeline.py` writes `assets/build/combat.json` and
 * `combat.png`; this reads them. Nothing in the renderer knows a file path —
 * it asks for `unit/bow/longbowman` and gets a texture with the anchor the
 * pipeline measured.
 *
 * THE FALLBACK IS LOUD, NOT SILENT. A slot with no art yet renders as its
 * labelled placeholder AND is reported by `missing()`, so "we still owe this
 * one a drawing" is a list one can read rather than something one notices in
 * a screenshot months later.
 */

export interface FrameEntry {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** The point that touches the tile, in the frame's own pixels. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly family: string;
}

export interface AtlasManifest {
  readonly atlas: string;
  readonly size: { readonly w: number; readonly h: number };
  readonly frames: Readonly<Record<string, FrameEntry>>;
  /** Required slots with no source art. The pipeline lists them; we surface them. */
  readonly missing: readonly string[];
}

export class AssetManager {
  private manifest: AtlasManifest | null = null;
  private sheet: Texture | null = null;
  private readonly cut = new Map<string, Texture>();

  /** Load the combat atlas. Returns false when there is no art yet at all. */
  async load(base = '/assets/'): Promise<boolean> {
    try {
      const manifest = await fetch(`${base}combat.json`).then(r => r.json()) as AtlasManifest;
      this.manifest = manifest;
      if (Object.keys(manifest.frames).length === 0) return false;
      this.sheet = await Assets.load(`${base}${manifest.atlas}`);
      return true;
    } catch {
      // No atlas built yet. That is a normal state while art is outstanding,
      // not an error — the renderer falls back and `missing()` says what for.
      return false;
    }
  }

  /** The texture for a slot, or null when that slot has no art yet. */
  texture(id: string): Texture | null {
    const cached = this.cut.get(id);
    if (cached) return cached;
    const frame = this.manifest?.frames[id];
    if (!frame || !this.sheet) return null;
    const cut = new PixiTexture({
      source: this.sheet.source,
      frame: new Rectangle(frame.x, frame.y, frame.w, frame.h),
    });
    this.cut.set(id, cut);
    return cut;
  }

  anchor(id: string): { x: number; y: number } | null {
    return this.manifest?.frames[id]?.anchor ?? null;
  }

  /** Required slots still waiting on a drawing. */
  missing(): readonly string[] {
    return this.manifest?.missing ?? [];
  }

  /** How much of the slice is actually authored. For the debug overlay. */
  coverage(): { have: number; want: number } {
    const have = Object.keys(this.manifest?.frames ?? {}).length;
    return { have, want: have + this.missing().length };
  }
}
