import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The dependency direction, enforced rather than described.
 *
 * "A bad architecture split into 40 files is still bad architecture." These
 * tests are what stops the split from being cosmetic: they fail the build when
 * a layer reaches somewhere it is not allowed to reach, which is the only
 * reason such a rule ever survives contact with a deadline.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const FILES = sourceFiles(SRC).map(path => ({
  path: relative(SRC, path).replaceAll('\\', '/'),
  text: readFileSync(path, 'utf8'),
}));

/** Every module specifier a file imports from, type-only imports included. */
function importsOf(text: string): string[] {
  const out: string[] = [];
  const pattern = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(pattern)) {
    if (match[1]) out.push(match[1]);
  }
  return out;
}

describe('dependency direction', () => {
  it('finds source files at all', () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('nothing under src/ imports the legacy tree', () => {
    const offenders = FILES
      .filter(f => importsOf(f.text).some(s => s.includes('quelle/')))
      .map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it('simulation and content never import a renderer or the DOM', () => {
    const forbidden = ['pixi.js', '@/rendering', '@/ui', '@/animation', '@/app'];
    const offenders: string[] = [];
    for (const file of FILES) {
      if (!file.path.startsWith('simulation/') && !file.path.startsWith('content/')
        && !file.path.startsWith('core/')) continue;
      for (const specifier of importsOf(file.text)) {
        if (forbidden.some(f => specifier === f || specifier.startsWith(`${f}/`))) {
          offenders.push(`${file.path} -> ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the rules never touch document, window or a timer', () => {
    // Matches real uses, not the word inside a comment sentence.
    const banned = /\b(document|window|requestAnimationFrame|setTimeout|setInterval)\s*[.(]/;
    const offenders: string[] = [];
    for (const file of FILES) {
      if (!file.path.startsWith('simulation/') && !file.path.startsWith('content/')
        && !file.path.startsWith('core/')) continue;
      const code = file.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (banned.test(code)) offenders.push(file.path);
    }
    expect(offenders).toEqual([]);
  });

  it('the rules never roll unseeded randomness', () => {
    /*
     * Math.random() is how a run stops being reproducible. Everything that
     * affects gameplay goes through the seeded Rng (Phase 2b); this test is
     * here from the start so the rule can never be broken quietly.
     */
    const offenders: string[] = [];
    for (const file of FILES) {
      if (!file.path.startsWith('simulation/') && !file.path.startsWith('content/')
        && !file.path.startsWith('core/')) continue;
      const code = file.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (/Math\s*\.\s*random/.test(code)) offenders.push(file.path);
    }
    expect(offenders).toEqual([]);
  });
});
