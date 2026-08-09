/**
 * RULE_REF (#1078 LOT B3a) — deux gardes.
 *
 * 1. INTÉGRITÉ : chaque entrée pointe une fiche Codex qui EXISTE, par id stable. Re-pointer une
 *    entrée ailleurs (ou renommer l'entrée de donnée) échoue ici.
 * 2. CLIQUET NOMINATIF : le stock des producteurs de `ModLine` SANS `ref` est ÉNUMÉRÉ,
 *    `fichier:label` par `fichier:label`. Lier une règle de plus retire sa ligne du stock (la liste
 *    DÉCROÎT) ; en pousser une nouvelle SANS `ref` échoue immédiatement.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { RULE_REF, type RuleId } from './ruleRefs';
import { codexLookupById } from '../ui/compendium/registry';

describe('RULE_REF — la référence pointe une fiche Codex réelle', () => {
  it('chaque règle référencée existe au catalogue, par id STABLE', () => {
    for (const [rule, ref] of Object.entries(RULE_REF) as [RuleId, { category: string; id: string }][]) {
      expect(codexLookupById(ref.category, ref.id), `RULE_REF['${rule}'] → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
    }
  });
});

/** Fichiers du moteur/état qui POUSSENT des `ModLine` (le vocabulaire y est littéral). */
const PRODUCER_FILES = [
  'src/engine/characteristics.ts',
  'src/engine/combat.ts',
  'src/engine/conditions.ts',
  'src/engine/grapple.ts',
  'src/engine/skills.ts',
  'src/engine/weatherTestMod.ts',
  'src/state/combatFlow.ts',
  'src/state/commandTeam.ts',
  'src/state/mount.ts',
  'src/state/travelFlow.ts',
  'src/state/travelPostes.ts',
];

/** Littéral de `ModLine` : `{ label: …, value: … }` — hors POSITIONS DE TYPE (`value: number`). */
const MODLINE_LITERAL = /\{ label: (?!string)[^}]*?value: (?!number\b)[^}]*?\}/g;

/** Le stock MESURÉ des producteurs SANS `ref`, un par `fichier:label` (source de vérité du cliquet). */
function refLessProducers(): string[] {
  const out: string[] = [];
  for (const f of PRODUCER_FILES) {
    const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(MODLINE_LITERAL)) {
      if (m[0].includes('ref:')) continue;
      const label = /label: ([^,]+),/.exec(m[0])?.[1] ?? '?';
      out.push(`${f} · ${label}`);
    }
  }
  return out.sort();
}

/**
 * CLIQUET — stock des `ModLine` SANS `ref`. Les pools d'octroyeurs ont TOUS été levés (#1117 L4) :
 * `PassiveMod` porte l'identité Codex de sa source (`src`), et chaque site rend UNE ligne par
 * composante réelle, à son nom — pénalités d'État (`combatTestPenaltyParts`), bonus à l'attaquant
 * (`meleeAttackerBonusLines`), aura anti-Sort (`castWardLine`). Ce qui BLOQUE le reste est MESURÉ :
 *  - libellés DÉRIVÉS d'une donnée déjà nommée ailleurs (météo de scène, force des Vents, lignes
 *    volatiles de Caractéristique) : leur référence se dérive de cette donnée, pas d'une règle.
 */
const RATCHET = [
  'src/engine/characteristics.ts · best.label',
  'src/engine/characteristics.ts · e.label',
  'src/engine/characteristics.ts · p.label',
  'src/engine/characteristics.ts · worst.label',
  "src/engine/combat.ts · 'Neige épaisse'",
  "src/engine/combat.ts · 'Rapide'",
  "src/state/combatFlow.ts · 'Contrecoup'",
  "src/state/combatFlow.ts · 'Vents de Magie'",
  'src/state/combatFlow.ts · sc.label',
  'src/state/combatFlow.ts · sc.label',
  "src/state/commandTeam.ts · 'Commandant d’équipe'",
  "src/state/travelFlow.ts · 'pas de course'",
  "src/state/travelPostes.ts · 'Tests physiques'",
].sort();

describe('Cliquet — les ModLine SANS règle liée sont ÉNUMÉRÉES et décroissent (#1078)', () => {
  it('le stock mesuré est EXACTEMENT le stock déclaré (lier une règle = retirer sa ligne)', () => {
    const measured = refLessProducers();
    const added = measured.filter((x) => !RATCHET.includes(x));
    const removed = RATCHET.filter((x) => !measured.includes(x));
    expect(added, 'NOUVELLE ModLine sans `ref` : donne-lui son entrée RULE_REF (ou son id d’entité)').toEqual([]);
    expect(removed, 'règle désormais liée : retire sa ligne du cliquet (il ne fait que décroître)').toEqual([]);
  });

  it('le stock ne peut que DÉCROÎTRE (plafond collé)', () => {
    expect(refLessProducers().length).toBeLessThanOrEqual(RATCHET.length);
  });
});
