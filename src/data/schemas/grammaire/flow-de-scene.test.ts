/**
 * Le `flowSchema` de la GRAMMAIRE n'est PAS le Flow de SCÈNE (#1466, sonde du juge promue en garde).
 *
 * `flowSchema` est `Flow<EffectOp>` : sa feuille `do` porte un `EffectOp` (`{ type: 'ops', ops }`),
 * le vocabulaire du MOTEUR. Le Flow de scène est `Flow<Effect>` : sa feuille porte l'union `Effect`
 * de `state/scene.ts` (`startCombat`, `transition`, `journal`…). Réutiliser le premier pour valider
 * le second rejetterait TOUTES les feuilles authorées — ce test le mesure sur la donnée réelle, pour
 * que le lot T3-b compose un `sceneFlowSchema` propre au lieu de recycler celui de la grammaire.
 * La `Condition`, elle, est bien PARTAGÉE (même algèbre des deux côtés).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { flowSchema, effectOpSchema, conditionSchema } from './mecanique';
import { effectSchema, sceneFlowSchema } from '../defs-scenes/effets';

const RACINE = fileURLToPath(new URL('../../../scenes/', import.meta.url));
const PROJETS = [
  'arene/arene-projet.json',
  'barge-du-sel/barge-du-sel-projet.json',
  'diligence/diligence-projet.json',
  'loup-et-saumure/loup-et-saumure-projet.json',
];

/** Toutes les feuilles `{ kind:'do', effect }` des Flows authorés des 4 projets. */
function feuillesDo(): unknown[] {
  const out: unknown[] = [];
  const marche = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(marche);
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.kind === 'do' && o.effect) out.push(o.effect);
    Object.values(o).forEach(marche);
  };
  for (const p of PROJETS) marche(JSON.parse(readFileSync(RACINE + p, 'utf8')));
  return out;
}

describe('grammaire — `flowSchema` (Flow<EffectOp>) ≠ Flow de scène (Flow<Effect>)', () => {
  const feuilles = feuillesDo();

  it('le corpus de mesure est peuplé (les 4 projets portent des Flows authorés)', () => {
    expect(feuilles.length).toBe(343);
  });

  it('POSITIF — les 343 feuilles `do` réelles passent TOUTES `effectSchema` (le vocabulaire de scène)', () => {
    const refusees = feuilles
      .map((e, i) => ({ i, e, r: effectSchema.safeParse(e) }))
      .filter((x) => !x.r.success)
      .map((x) => `#${x.i} ${JSON.stringify(x.e).slice(0, 120)}`);
    expect(refusees, 'une feuille authorée refusée par `effectSchema` : la donnée ou le schéma ment.').toEqual([]);
  });

  it('POSITIF — un Flow de scène entier passe `sceneFlowSchema`, celui-là même que `flowSchema` refuse', () => {
    const flow = { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'startCombat', encounter: 'enc-1' } }] };
    expect(sceneFlowSchema.safeParse(flow).success).toBe(true);
    expect(flowSchema.safeParse(flow).success).toBe(false);
  });

  it('AUCUNE feuille `do` de scène ne passe `effectOpSchema` — le vocabulaire est disjoint', () => {
    const acceptees = feuilles.filter((e) => effectOpSchema.safeParse(e).success);
    expect(acceptees, 'une feuille de scène acceptée par la feuille MOTEUR : vérifier le vocabulaire').toEqual([]);
  });

  it('un Flow de scène entier est donc REFUSÉ par `flowSchema`, sur le `type` de sa feuille', () => {
    const res = flowSchema.safeParse({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'startCombat', encounter: 'enc-1' } }] });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].path.join('.')).toBe('steps.0.effect.type');
  });

  it('la `Condition`, elle, est PARTAGÉE : celle d\'une scène passe `conditionSchema`', () => {
    expect(conditionSchema.safeParse({ kind: 'flag', expr: 'porte-ouverte' }).success).toBe(true);
  });
});
