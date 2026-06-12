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
// medicFlow.ts : les actions de l'INFIRMERIE (délégations du store) — scannées aussi, sinon un jet
// en ligne pourrait s'y cacher derrière la délégation.
const MEDIC = readFileSync(fileURLToPath(new URL('./medicFlow.ts', import.meta.url)), 'utf8');

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
// `*DarkPact` : Sombre Pacte (LDB 19 l.41) — bouton de la modale ouverte, au même titre que la
// Chance (« +1 Corruption pour relancer ») : un résolveur de modale, pas un jet en ligne.
const RESOLVER = /(Roll|Reroll|BonusSL|ForceSuccess|Confirm|Cancel|DarkPact)$/;
// `deviationApply` est le résolveur de la modale de Déviation Critique (le joueur a déjà choisi
// Dévier/Subir) : il applique un résultat DÉJÀ décidé via applyAttackResult — comme defenseConfirm,
// le jet de la table des Critiques n'est qu'une conséquence, pas un Test offrant un choix au joueur.
// `startCombat` tire l'Initiative (I+1d10) en début de combat (l'ordre est lu dans la frise d'initiative (InitiativeStrip),
// plus de modale d'Initiative depuis R2) — un jet d'entretien, sans Chance.
// `medicSurgeryPass` est le résolveur « Opérer (une passe) » de l'INFIRMERIE (Chirurgie = Test
// ÉTENDU, LDB 10 l.154) : il tire un jet de Guérison et garde la modale ouverte — un jet DE la
// modale ouverte, comme healRoll. (Bander/Hémorragie pendant l'opération passent désormais par
// pendingHeal — flux de jet complet.)
// `resolveCorruption` est le résolveur (« Continuer ») de la modale d'exposition corruptrice — le
// Test a déjà été lancé/relancé dans la modale ; le Test de Résistance du SEUIL (LDB 19 l.80) est
// une conséquence subie, révélée au joueur (pendingReveals, kind 'mutation'), comme un Critique.
const EXTRA_OK = new Set(['resolveTest', 'resolveCorruption', 'disengageConfirmA', 'disengageFlee', 'dismissReveal', 'deviationApply', 'startCombat', 'advanceTime', 'medicSurgeryPass']);
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

/** Fonctions exportées d'un MODULE de flux (medicFlow…) : `export function nom(...) { corps }`. */
function moduleActions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /^export function (\w+)\(/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    // ferme d'abord la PARENTHÈSE de signature (les types des params peuvent contenir des accolades),
    // puis la 1re accolade qui suit = début du corps.
    let p = 1, j = re.lastIndex;
    while (j < src.length && p > 0) { if (src[j] === '(') p++; else if (src[j] === ')') p--; j++; }
    const open = src.indexOf('{', j);
    let depth = 1, i = open + 1;
    while (i < src.length && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
    out.push({ name: m[1], body: src.slice(open + 1, i) });
  }
  return out;
}

describe('Invariante « un jet = une modale »', () => {
  const actions = [...storeActions(STORE), ...moduleActions(MEDIC)];

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
