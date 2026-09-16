import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { LAYERS, TILE_HEIGHT, TILE_WIDTH, type LayerName } from './artRules';
import { facesOf, placeholderFor, type PlaceholderSprite, type Shape } from './placeholderAtlas';
import { PARTICLE_COLOURS, type ParticleKind } from './effects/particles';
import { visualForProjectile } from './effects/projectileVisual';
import { UNIT_VISUALS } from './units/UnitVisual';
import { fireDirection, toScreen } from './WorldTransform';
import type { ArtRegister } from './artHooks';
import type { PresentationSettings } from './presentation/settings';
import type { Scene, SceneNode } from './SceneGraph';

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
  const visual = visualForProjectile(String(node.detail?.kind ?? 'arrow'));
  const shrink = Math.max(0.3, 1 - height / 160) * visual.shadowScale;
  const g = new Graphics();
  g.ellipse(0, 0, 5 * shrink, 2.5 * shrink).fill({ color: 0x1a1510, alpha: 0.45 });
  return g;
}

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  /** Integer only. Non-integer scale is what turns pixel art into mush. */
  readonly scale?: number;
  readonly background?: string;
  /**
   * Where missing source art is reported. Without one the renderer still
   * draws placeholders — it just stops saying which drawings are owed.
   */
  readonly art?: ArtRegister;
}

export class BattlefieldRenderer {
  private readonly app: Application;
  private readonly layers = new Map<LayerName, Container>();
  /** Drawn thing per node id, so a frame reuses rather than rebuilds. */
  private readonly drawn = new Map<string, Container>();
  private readonly world = new Container();
  /** Everything the debug toggles put on top. Rebuilt every frame; it is small. */
  private readonly overlay = new Container();
  private readonly art: ArtRegister | null;
  private count = 0;

  private constructor(app: Application, art: ArtRegister | null) {
    this.app = app;
    this.art = art;
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

    const renderer = new BattlefieldRenderer(app, options.art ?? null);
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
      container.sortableChildren = true;
      renderer.layers.set(name, container);
      renderer.world.addChild(container);
    }
    // Above every layer, and outside the art contract: the debug overlay is
    // not part of the game's look and must never be mistaken for it.
    renderer.overlay.label = 'DEBUG';
    renderer.world.addChild(renderer.overlay);
    return renderer;
  }

  /** How many things the last frame put on the GPU. For the budget overlay. */
  spriteCount(): number {
    return this.count;
  }

  /** Draw a scene. Nodes that vanished are removed; the rest are moved. */
  render(scene: Scene, settings?: PresentationSettings): void {
    const seen = new Set<string>();

    for (const node of scene.nodes) {
      seen.add(node.id);
      let sprite = this.drawn.get(node.id);
      if (!sprite || this.stale(node)) {
        sprite?.destroy({ children: true });
        sprite = this.build(node);
        this.drawn.set(node.id, sprite);
        this.layers.get(node.layer)!.addChild(sprite);
        this.shapes.set(node.id, this.signature(node));
      }
      sprite.position.set(node.screen.x, node.screen.y);

      // Particles change size and opacity every frame; those are cheap writes.
      if (node.kind === 'particle') {
        sprite.alpha = Number(node.detail?.opacity ?? 1);
        sprite.scale.set(Number(node.detail?.size ?? 2) / 4);
      } else if (node.kind === 'ghost') {
        sprite.alpha = Number(node.detail?.opacity ?? 0.5);
      } else if (node.kind === 'projectile') {
        // An oriented shot faces the line it is travelling along, in SCREEN
        // space — see `angleDetail`. The unoriented ones ignore this.
        const visual = visualForProjectile(String(node.detail?.kind ?? 'arrow'));
        sprite.rotation = visual.oriented ? Number(node.detail?.angle ?? 0) : 0;
      } else if (node.kind === 'formation') {
        // The standards rise into place rather than appearing.
        const raise = Number(node.detail?.raise ?? 1);
        sprite.alpha = raise;
        sprite.position.set(node.screen.x, node.screen.y + Math.round((1 - raise) * 10));
      } else if (node.kind === 'floating') {
        const progress = Number(node.detail?.progress ?? 0);
        sprite.alpha = Math.max(0, 1 - progress * progress);
        sprite.position.set(node.screen.x, node.screen.y - Math.round(progress * 24));
      }

      // Within a layer, order is the scene's, not the creation order.
      sprite.zIndex = node.depth;
    }

    for (const [id, sprite] of this.drawn) {
      if (seen.has(id)) continue;
      sprite.destroy({ children: true });
      this.drawn.delete(id);
      this.shapes.delete(id);
    }

    this.count = this.drawn.size;
    this.drawDebug(scene, settings);
  }

  /* ---------- Building ---------- */

  /** A node's build-time signature. When it changes, the sprite is rebuilt. */
  private readonly shapes = new Map<string, string>();

  private signature(node: SceneNode): string {
    return [
      node.sprite,
      node.detail?.scale ?? '',
      node.detail?.colour ?? '',
      node.detail?.accent ?? '',
      node.text ?? '',
    ].join('|');
  }

  private stale(node: SceneNode): boolean {
    return this.shapes.get(node.id) !== this.signature(node);
  }

  private build(node: SceneNode): Container {
    if (node.kind === 'particle') return buildParticle(node);
    if (node.kind === 'projectileShadow') return buildShotShadow(node);
    if (node.text !== undefined && (node.kind === 'floating' || node.kind === 'formation')) {
      return this.buildText(node);
    }

    const placeholder = this.placeholder(node);
    const g = new Graphics();
    for (const shape of placeholder.shapes) paint(g, shape);
    // The sprite hangs from its ground anchor, so every frame of an animation
    // keeps the same contact point with the tile.
    g.pivot.set(placeholder.anchor.x, placeholder.anchor.y);
    return g;
  }

  /**
   * The placeholder for a slot, and the report that it IS a placeholder.
   *
   * Every slot drawn from this atlas is art somebody still owes. Recording it
   * here rather than at the call sites means nothing can quietly opt out of
   * being counted.
   */
  private placeholder(node: SceneNode): PlaceholderSprite {
    this.art?.miss(node.sprite);
    return placeholderFor(node.sprite, {
      scale: Number(node.detail?.scale ?? 1),
      ...(node.detail?.colour ? { colour: String(node.detail.colour) } : {}),
      ...(node.detail?.accent ? { accent: String(node.detail.accent) } : {}),
    });
  }

  private buildText(node: SceneNode): Container {
    const size = Number(node.detail?.size ?? 12);
    const colour = String(node.detail?.colour ?? '#e3d2a4');
    const label = new Text({
      text: node.text ?? '',
      style: new TextStyle({
        fontFamily: 'Courier New, monospace',
        fontSize: size,
        fontWeight: 'bold',
        fill: colour,
        stroke: { color: '#1a1510', width: 3 },
        letterSpacing: 1,
      }),
    });
    label.anchor.set(0.5, 1);
    label.resolution = 1;
    return label;
  }

  /* ---------- The debug overlay ---------- */

  /**
   * Everything the workbench draws on top so that a rendering fault has a NAME.
   *
   * This is the difference between "it looks wrong" and "the muzzle socket is
   * eleven pixels left of the barrel". It is rebuilt whole each frame, which
   * would be wasteful for the world and is nothing for a handful of crosses.
   */
  private drawDebug(scene: Scene, settings?: PresentationSettings): void {
    this.overlay.removeChildren().forEach(child => child.destroy({ children: true }));
    const debug = settings?.debug;
    if (!debug) return;
    if (!debug.anchors && !debug.sockets && !debug.worldVectors
      && !debug.bounds && !debug.layers) return;

    const g = new Graphics();

    if (debug.layers) {
      /*
       * One translucent wash per layer, in a fixed hue order. A thing in the
       * wrong layer stops being a subtle depth bug and becomes a differently
       * coloured object.
       */
      for (const node of scene.nodes) {
        const index = LAYERS.indexOf(node.layer);
        g.rect(node.screen.x - 2, node.screen.y - 2, 4, 4)
          .fill({ color: LAYER_TINTS[index % LAYER_TINTS.length]!, alpha: 0.5 });
      }
    }

    for (const node of scene.nodes) {
      if (debug.bounds && BOUNDED.has(node.kind)) {
        const placeholder = placeholderFor(node.sprite,
          { scale: Number(node.detail?.scale ?? 1) });
        g.rect(
          node.screen.x - placeholder.anchor.x,
          node.screen.y - placeholder.anchor.y,
          placeholder.width, placeholder.height,
        ).stroke({ color: 0x4f7a3a, width: 1, alpha: 0.7 });
      }

      if (debug.anchors && ANCHORED.has(node.kind)) {
        g.moveTo(node.screen.x - 4, node.screen.y).lineTo(node.screen.x + 4, node.screen.y)
          .moveTo(node.screen.x, node.screen.y - 4).lineTo(node.screen.x, node.screen.y + 4)
          .stroke({ color: 0xffd98a, width: 1 });
      }

      if (node.kind !== 'unit') continue;
      const branch = String(node.detail?.branch ?? 'bow');
      const visual = UNIT_VISUALS[branch as keyof typeof UNIT_VISUALS];
      if (!visual) continue;
      const scale = Number(node.detail?.scale ?? 1);
      const placeholder = placeholderFor(node.sprite, { scale });

      if (debug.sockets) {
        // Where the projectile is actually born. If this is not on the weapon,
        // nothing downstream can look right however good the art is.
        const muzzle = {
          x: node.screen.x - placeholder.anchor.x + visual.sockets.muzzle.x * scale,
          y: node.screen.y - placeholder.height + visual.sockets.muzzle.y * scale,
        };
        g.circle(muzzle.x, muzzle.y, 2).fill(0xa8261f);
        g.circle(
          node.screen.x - placeholder.anchor.x + visual.sockets.recoilPivot.x * scale,
          node.screen.y - placeholder.height + visual.sockets.recoilPivot.y * scale,
          1.5,
        ).fill(0x2f5fa8);
      }

      if (debug.worldVectors) {
        /*
         * The firing vector and its opposite, both computed from the
         * projection. Drawn because intuition is wrong here: on a 2:1 diamond
         * a shot "to the right" travels down the screen, and a recoil that
         * merely nudged upward would be wrong in every direction.
         */
        const to = { col: 18, row: 9 };
        const direction = fireDirection(node.world, to, scene.camera);
        const origin = toScreen(node.world, scene.camera);
        g.moveTo(origin.x, origin.y)
          .lineTo(origin.x + direction.x * 40, origin.y + direction.y * 40)
          .stroke({ color: 0x4f7a3a, width: 1 });
        g.moveTo(origin.x, origin.y)
          .lineTo(origin.x - direction.x * 16, origin.y - direction.y * 16)
          .stroke({ color: 0xa8261f, width: 1 });
      }
    }

    this.overlay.addChild(g);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}

const ANCHORED = new Set(['unit', 'tower', 'parapet', 'enemy', 'ghost']);
const BOUNDED = new Set(['unit', 'tower', 'parapet', 'enemy', 'projectile', 'ghost']);

/** One colour per layer, in LAYERS order. */
const LAYER_TINTS = [
  0x3a2e20, 0x58663a, 0x4a4a52, 0x7a7a80, 0xe3b552,
  0xffd98a, 0xa8261f, 0xc25a15, 0xb9bec6, 0x2f5fa8, 0xffffff,
];

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
