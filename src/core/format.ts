/**
 * Numbers the way the player reads them.
 *
 * It lives in `core/` because BOTH the renderer and the content layer need it,
 * and content is a rule layer that may not reach into rendering. The
 * architecture guard caught exactly that the moment the combat log wanted to
 * write a damage figure: a formatting helper had quietly become a reason for
 * the rules to depend on the screen.
 *
 * German decimal comma, because that is what the rest of the game speaks.
 */
export function formatBig(value: number): string {
  const n = Math.round(value);
  if (n < 10_000) return n.toLocaleString('de-DE');
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace('.', ',')}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n < 1_000_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  return `${(n / 1_000_000_000_000).toFixed(1).replace('.', ',')}T`;
}
