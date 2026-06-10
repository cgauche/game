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
  // Handlers de flux générés (rollFlow/rollFlows) : ils RÉSOLVENT un jet → seuls les résolveurs
  // de modale (*Roll/*Reroll/…) ont le droit de les invoquer. Les primitives ci-dessus, déplacées
  // dans les specs `rollFlows.ts`, ne sont atteignables QUE par ces handlers (garantie structurelle).
  'FLOWS.',
];
const RESOLVER = /(Roll|Reroll|BonusSL|ForceSuccess|Confirm|Cancel)$/;
// `deviationApply` est le résolveur de la modale de Déviation Critique (le joueur a déjà choisi
// Dévier/Subir) : il applique un résultat DÉJÀ décidé via applyAttackResult — comme defenseConfirm,
// le jet de la table des Critiques n'est qu'une conséquence, pas un Test offrant un choix au joueur.
// `startCombat` tire l'Initiative (I+1d10) en début de combat (l'ordre est lu dans la frise d'initiative (InitiativeStrip),
// plus de modale d'Initiative depuis R2) — un jet d'entretien, sans Chance.
// `surgeryPass`/`surgeryBandage`/`surgeryStopBleed` sont des résolveurs de la modale de Chirurgie (Test
// ÉTENDU, LDB 10 l.154) : leurs boutons (« Opérer une passe », « Bander », « Hémorragie ») tirent un jet
// de Guérison et gardent la modale ouverte — ce sont des jets DE la modale ouverte, comme healRoll.
const EXTRA_OK = new Set(['resolveTest', 'disengageConfirmA', 'disengageFlee', 'dismissReveal', 'deviationApply', 'startCombat', 'advanceTime', 'surgeryPass', 'surgeryBandage', 'surgeryStopBleed']);
// Dette temporaire (résolue au fil des tâches) — VIDÉE : tous les jets héros/conséquences sont en modale.
const TODO = new Set<string>([]);

function storeActions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /^ {2}(\w+):\s*\([^)]*\)\s*=>\s*(\{)?/gm;
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
