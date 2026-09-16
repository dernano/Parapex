import { Application, Container, Graphics } from 'pixi.js';
import { LAYERS, TILE_HEIGHT, TILE_WIDTH, type LayerName } from './artRules';
import { facesOf, placeholderFor, type Shape } from './placeholderAtlas';
import { PARTICLE_COLOURS, type ParticleKind } from './effects/particles';
import type { Scene, SceneNode } from './SceneGraph';

/** A particle is one chunky square. Scale and alpha come from the scene. */
function buildParticle(node: SceneNode): Graphics {
  const kind = node.sprite.split('/')[1] as ParticleKind;
  const colours = PARTICLE_COLOURS[kind] ?? PARTICLE_COLOURS.smoke;
  const colour = colours[Number(node.detail?.palette ?? 0) % colours.length]!;
  const g = new Graphics();
  g.rect(-2, -2, 4, 4).fill(colour);
  return g;
}

/**
 * The ground shadow under an arcing shot. It shrinks as the shot climbs, which
 * is what actually reads as height.
 */
function buildShotShadow(node: SceneNode): Graphics {
  const height = Number(node.detail?.height ?? 0);
  const shrink = Math.max(0.3, 1 - height / 160);
  const g = new Graphics();
  g.ellipse(0, 0, 5 * shrink, 2.5 * shrink).fill({ color: 0x1a1510, alpha: 0.45 });
  return g;
}

/**
 * Pixi binding. Thin on purpose.
 *
 * The scene has already decided WHAT is drawn, WHERE, in WHICH layer and in
 * WHAT order. This file's only job is to put that on a GPU. Everything
 * interesting is testable in Node because it happens before this file runs —
 * and Pixi stays the renderer rather than becoming the architecture.
 *
 * Nothing here reads game state, and nothing here may ever change any.
 */

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  /** Integer only. Non-integer scale is what turns pixel art into mush. */
  readonly scale?: number;
  readonly background?: string;
}

export class BattlefieldRenderer {
  private readonly app: Application;
  private readonly layers = new Map<LayerName, Container>();
  /** Sprite per node id, so a frame reuses rather than rebuilds. */
  private readonly drawn = new Map<string, Graphics>();
  private readonly world = new Container();

  private constructor(app: Application) {
    this.app = app;
  }

  static async create(options: RendererOptions): Promise<BattlefieldRenderer> {
    const app = new Application();
    await app.init({
      canvas: options.canvas,
      width: options.width,
      height: options.height,
      background: options.background ?? '#0b0908',
      antialias: false,
      // Nearest neighbour everywhere. No exceptions, per the bible.
      roundPixels: true,
      autoDensity: false,
      resolution: 1,
    });

    const renderer = new BattlefieldRenderer(app);
    app.stage.addChild(renderer.world);
    const scale = Math.max(1, Math.round(options.scale ?? 1));
    renderer.world.scale.set(scale);

    /*
     * The layers exist as containers from the start, in order. A renderer
     * whose z-order depends on the sequence of calls is a renderer that will
     * one day draw a soldier behind the ground he stands on.
     */
    for (const name of LAYERS) {
      const container = new Container();
      container.label = name;
      renderer.layers.set(name, container);
      renderer.world.addChild(container);
    }
    return renderer;
  }

  /** Draw a scene. Nodes that vanished are removed; the rest are moved. */
  render(scene: Scene): void {
    const seen = new Set<string>();

    for (const node of scene.nodes) {
      seen.add(node.id);
      let sprite = this.drawn.get(node.id);
      if (!sprite) {
        sprite = this.build(node);
        this.drawn.set(node.id, sprite);
        this.layers.get(node.layer)!.addChild(sprite);
      }
      sprite.position.set(node.screen.x, node.screen.y);
      // Particles change size and opacity every frame; rebuild only those.
      if (node.kind === 'particle') {
        sprite.alpha = Number(node.detail?.opacity ?? 1);
        const size = Number(node.detail?.size ?? 2);
        sprite.scale.set(size / 4);
      }
      // Within a layer, order is the scene's, not the creation order.
      sprite.zIndex = node.depth;
    }

    for (const [id, sprite] of this.drawn) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.drawn.delete(id);
    }
    for (const container of this.layers.values()) container.sortableChildren = true;
  }

  private build(node: SceneNode): Graphics {
    if (node.kind === 'particle') return buildParticle(node);
    if (node.kind === 'projectileShadow') return buildShotShadow(node);
    const placeholder = placeholderFor(node.sprite);
    const g = new Graphics();
    for (const shape of placeholder.shapes) paint(g, shape);
    // The sprite hangs from its ground anchor, so every frame of an animation
    // keeps the same contact point with the tile.
    g.pivot.set(placeholder.anchor.x, placeholder.anchor.y);
    return g;
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}

function diamond(g: Graphics, cx: number, cy: number, w: number, h: number, fill: string): void {
  g.moveTo(cx, cy - h / 2)
    .lineTo(cx + w / 2, cy)
    .lineTo(cx, cy + h / 2)
    .lineTo(cx - w / 2, cy)
    .closePath()
    .fill(fill);
}

function paint(g: Graphics, shape: Shape): void {
  if (shape.kind === 'diamond') {
    diamond(g, shape.cx, shape.cy, shape.w, shape.h, shape.fill);
    return;
  }
  if (shape.kind === 'rect') {
    g.rect(shape.x, shape.y, shape.w, shape.h).fill(shape.fill);
    return;
  }
  // A block: left face, right face, lit top — the sun from the upper right.
  const { top, right, left } = facesOf(shape.base);
  const halfW = shape.w / 2;
  const halfH = shape.h / 2;
  const topY = shape.cy - shape.depth;

  g.moveTo(shape.cx - halfW, shape.cy - halfH)
    .lineTo(shape.cx, shape.cy)
    .lineTo(shape.cx, shape.cy - shape.depth)
    .lineTo(shape.cx - halfW, shape.cy - halfH - shape.depth)
    .closePath().fill(left);

  g.moveTo(shape.cx + halfW, shape.cy - halfH)
    .lineTo(shape.cx, shape.cy)
    .lineTo(shape.cx, shape.cy - shape.depth)
    .lineTo(shape.cx + halfW, shape.cy - halfH - shape.depth)
    .closePath().fill(right);

  diamond(g, shape.cx, topY - halfH, shape.w, shape.h, top);
}

export { TILE_HEIGHT, TILE_WIDTH };
