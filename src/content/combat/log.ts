import type { Act } from '@/core/acts';
import { formatBig } from '@/core/format';

/**
 * What the player READS about what just happened. German, because it is
 * content rather than code.
 *
 * It lives here for the same reason the rejection messages do: a sentence can
 * be reworded without touching a rule, and a rule can be tested without
 * asserting on prose.
 */
export function logLine(act: Act): string {
  switch (act.kind) {
    case 'deployment': {
      const where = `Stellung ${act.tower + 1}`;
      const what = act.replaced
        ? `${act.unit.displayName} löst ${act.replaced.displayName} auf ${where} ab`
        : `${act.unit.displayName} bezieht ${where}`;
      return act.damage
        ? `${what} — ${formatBig(act.damage)} Wucht`
        : what;
    }
    case 'volley': {
      const volleys = act.settlement.volleys;
      const formations = act.settlement.formations.length
        ? ` · ${act.settlement.formations.map(f => f.displayName).join(', ')}`
        : '';
      return `${volleys === 1 ? 'Eine Salve' : `${formatBig(volleys)} Salven`}`
        + ` · ${formatBig(act.damage)} Wucht${formations}`
        + (act.overkill ? ` · ${formatBig(act.overkill)} verpufft` : '');
    }
    case 'exchanged':
      return act.cost
        ? `${act.removed} Karten getauscht für ${act.cost} Tatendrang`
        : `${act.removed} Karten getauscht — umsonst`;
    case 'reshuffled':
      return `Ablage gemischt: ${act.count} Karten zurück im Stapel`;
    case 'roundEnded':
      return `Runde ${act.round} vorbei`;
    case 'roundBegan':
      return `Runde ${act.round}`;
    case 'ended':
      return act.outcome === 'victory'
        ? 'Der Feind ist zerschlagen.'
        : 'Die Belagerung hält. Die Burg steht, der Feind auch.';
  }
}
