import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou « tout migrer » — chantier d'unification des événements/réactions de combat.
 * (cf. docs/combat-events-coherence.md — Recensement Lot 0.)
 *
 * Compte les SITES RÉACTIFS codés PAR-NOM (État/trait/talent/atout d'arme) dans les fichiers-cibles :
 * une réaction de combat (pénalité d'État, dégâts par round, bonus à l'attaquant, Riposte, Cleave,
 * infection, contenu de trait/talent caché dans un hook…) doit devenir de la DONNÉE
 * (`TriggeredEffect`/`passive`), pas une branche impérative nommant l'entité.
 *
 * MODE Lot 0 = REPORT-ONLY / CLIQUET : la baseline est GELÉE au recensement initial ; le test échoue
 * seulement si un fichier DÉPASSE sa baseline (= nouveau hardcode = régression). À CHAQUE lot de
 * migration, on ABAISSE la baseline du fichier concerné (Lot 4 → conditions.ts ; Lot 4bis → roundHooks ;
 * Lot 6 → combatFlow). **Au Lot 8** : baselines à 0 (sauf prédicats GÉNÉRIQUES de machinerie, hors regex)
 * et bascule en scan strict élargi à tout `engine`/`state`.
 *
 * NB : les regex ne ciblent QUE des marqueurs réactifs (`hasRiposte`, `hasTraitKey(`, `isUnstable`,
 * `stacks(c, COND.`…). Les PRÉDICATS GÉNÉRIQUES de machinerie qui lisent un État sans produire son
 * effet propre (`isOutOfAction`, `inDeathCondition`, `canTakeAction`, `tickDeath`…) ne sont PAS comptés :
 * ils restent légitimes (règle universelle de l'arène, ne nomment pas un effet d'entité éditable).
 */
const here = (f: string) => fileURLToPath(new URL(f, import.meta.url));
const read = (f: string) => readFileSync(here(f), 'utf8');

/** Retire les commentaires (les ids/noms en commentaire ne sont pas du code réactif). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

interface Target {
  name: string;
  src: string;
  /** Marqueurs réactifs par-nom (code). */
  reactive: RegExp;
  /** Lignes à EXCLURE (prédicats génériques de machinerie / déclarations / imports). */
  exclude?: RegExp;
  /** Baseline GELÉE (Lot 0). À abaisser au lot de migration ; 0 au Lot 8. */
  baseline: number;
  /** Lot qui résorbe ce fichier. */
  lot: string;
}

const TARGETS: Target[] = [
  {
    name: 'engine/conditions.ts',
    src: read('../engine/conditions.ts'),
    reactive: /hasCondition\(c, COND\.|hasCondition\(target, COND\.|stacks\(c, COND\./,
    // Prédicats GÉNÉRIQUES de machinerie (mort/gating universels) — ne nomment pas un effet d'entité éditable.
    exclude: /isOutOfAction|inDeathCondition|c\.dead|roundsAtZero|return !hasCondition|return hasCondition\(c, COND\.surpris\)/,
    // 30 → 27 (meleeAttackerBonus → incomingAttackMod data) → 11 (combatTestPenalty/testStatePenalty →
    // testMod data combatOnly/movementOnly/exceptSkills + perStack). Reste : par-round/évasion (endOfRound),
    // gating, et prédicats de mort (exclus). Cible Lot 4 finale : 0.
    baseline: 11,
    lot: 'Lot 4',
  },
  {
    name: 'state/combat/roundHooks.ts',
    src: read('./combat/roundHooks.ts'),
    reactive: /isUnstable|isBestial|hasPerturbingAura|suffocationTick|id: '(unstable|bestial-fire-fear|perturbing-aura|determination)/,
    baseline: 11,
    lot: 'Lot 4bis',
  },
  {
    name: 'state/combatFlow.ts',
    src: read('./combatFlow.ts'),
    reactive: /hasRiposte|hasChampionDefense|applySonneMeleeAdvantage|hasTraitKey\(|banishedAtZero|autoCleave|maybeHeroCleave|isUnstable|isBestial|hasPerturbingAura|suffocationTick/,
    exclude: /^\s*import|export function (autoCleave|maybeHeroCleave|applySonneMeleeAdvantage)/,
    baseline: 14,
    lot: 'Lot 6',
  },
];

function countReactive(t: Target): number {
  return stripComments(t.src)
    .split('\n')
    .filter((l) => t.reactive.test(l) && !(t.exclude && t.exclude.test(l)))
    .length;
}

describe('garde-fou « tout migrer » — réactions de combat hardcodées (cliquet, report-only Lot 0)', () => {
  for (const t of TARGETS) {
    it(`${t.name} (${t.lot}) : sites réactifs par-nom ≤ baseline (${t.baseline})`, () => {
      const n = countReactive(t);
      expect(
        n,
        `${t.name} : ${n} sites réactifs par-nom (baseline gelée ${t.baseline}). ` +
          `Si > baseline → nouveau hardcode (régression). Si migration faite → ABAISSER la baseline.`,
      ).toBeLessThanOrEqual(t.baseline);
    });
  }
});
