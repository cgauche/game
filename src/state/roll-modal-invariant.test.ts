import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou « un jet = une modale » (invariante projet) : aucune action du store ne doit RÉSOUDRE
 * un jet aléatoire en ligne. Elle doit ouvrir une modale `pending*` (jet différé) ou pousser une
 * révélation (`pendingReveals`). Seuls les résolveurs de modale (Lancer/Chance/Appliquer) tirent.
 *
 * Heuristique : on scanne le corps DIRECT de chaque action du store ; un appel à une primitive de
 * résolution dans une action non-whitelistée = violation. La whitelist est une convention de
 * suffixe (`*Roll`/`*Confirm`/…) + des extras explicites. (Test statique sur le texte source.)
 */
const STORE = readFileSync(fileURLToPath(new URL('./store.ts', import.meta.url)), 'utf8');

const PRIMITIVES = [
  'battleRng(', 'rollTest(', 'rollOups(', 'rollMiscast(', 'rollCritical(',
  'resolveTrample(', 'resolveFocus(', 'resolveBackstabAttack(', 'resolveMelee(',
  'resolveRanged(', 'resolveCasting(', 'resolveMagicMissile(', 'opposedTest(',
  'applyAttackResult(', 'applyTrample(', 'applyMiscast(', 'focusSpell(',
];
const RESOLVER = /(Roll|Reroll|BonusSL|ForceSuccess|Confirm|Cancel)$/;
const EXTRA_OK = new Set(['resolveTest', 'disengageConfirmA', 'disengageFlee', 'dismissReveal']);
// Dette temporaire (résolue au fil des tâches) — à VIDER au fur et à mesure.
const TODO = new Set<string>([
  'startCombat', // Lot B T8 → initiative en révélation
]);

function storeActions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /^  (\w+):\s*\([^)]*\)\s*=>\s*(\{)?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (m[2]) {
      let depth = 1, i = re.lastIndex;
      while (i < src.length && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
      out.push({ name, body: src.slice(re.lastIndex, i) });
    } else {
      out.push({ name, body: src.slice(re.lastIndex, src.indexOf('\n', re.lastIndex)) });
    }
  }
  return out;
}

describe('Invariante « un jet = une modale »', () => {
  const actions = storeActions(STORE);

  it('extrait un nombre plausible d’actions du store', () => {
    expect(actions.length).toBeGreaterThan(30);
  });

  for (const { name, body } of actions) {
    const offenders = PRIMITIVES.filter((p) => body.includes(p));
    const allowed = RESOLVER.test(name) || EXTRA_OK.has(name) || TODO.has(name);
    it(`${name} ne résout pas de jet en ligne`, () => {
      if (allowed) return;
      expect(offenders, `${name} appelle ${offenders.join(', ')} — ouvre une modale pending*/pousse une révélation`).toEqual([]);
    });
  }
});
