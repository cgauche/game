/**
 * GARDE de RÉSOLVABILITÉ des références de tenue (#223 — le trou par lequel `ruraux` en dur, id d'une
 * classe supprimée, a survécu). Toute valeur `tenue` du jeu — `creatures.json[].appearance.tenue`,
 * `raceAppearance.json[].tenue`, et `perso.tenue` des defs de créature (registre) —
 * doit être ABSENTE, `'nu'`, ou un id présent dans `TENUE_BY_ID` (tenue SPÉCIFIQUE existante). Un id
 * qui n'existe pas (faute de frappe) ou qui pointe une des tenues d'ARCHÉTYPE DE CLASSE supprimées
 * (décision utilisateur 2026-07-21 : classe sans def → corps Nu) échoue ICI, avec la liste
 * « entité → id fantôme » — plutôt que de tomber en Nu silencieux au rendu.
 *
 * Contrat POSITIF, sans liste d'exception : une réf fantôme se re-route vers la tenue spécifique
 * existante la plus proche (lore), elle ne s'ajoute pas à une liste tolérée.
 */
import { describe, it, expect } from 'vitest';
import { TENUE_BY_ID } from './index';
import { creatures, raceAppearance } from '../../../../data';
import { CREATURES } from '../../creatures/_registry.generated';

/** Une valeur de tenue est résolvable si absente (le porteur reste Nu), `'nu'`, ou un id spécifique. */
function resolves(value: string | undefined): boolean {
  return value == null || value === 'nu' || value in TENUE_BY_ID;
}

/** Toutes les réfs de tenue du jeu, avec leur porteur (pour un message d'échec actionnable). */
function allTenueRefs(): { where: string; tenue: string | undefined }[] {
  const refs: { where: string; tenue: string | undefined }[] = [];
  for (const c of creatures)
    if (c.appearance?.tenue != null) refs.push({ where: `creatures.json » ${c.id}`, tenue: c.appearance.tenue });
  for (const r of raceAppearance)
    if (r.tenue != null) refs.push({ where: `raceAppearance.json » ${r.id}`, tenue: r.tenue });
  // `CreatureDef.race` est un id de race (string) → la tenue de cette race vit dans raceAppearance.json,
  // déjà couverte par la boucle ci-dessus ; côté def seule `perso.tenue` porte une réf de tenue.
  for (const d of CREATURES)
    if (d.perso?.tenue != null) refs.push({ where: `creature-def » ${d.id} (perso.tenue)`, tenue: d.perso.tenue });
  return refs;
}

describe('résolvabilité des références de tenue (data-driven, ids STABLES)', () => {
  it('toute réf de tenue est absente, « nu », ou un id présent dans TENUE_BY_ID — aucune tenue fantôme', () => {
    const fantomes = allTenueRefs()
      .filter((r) => !resolves(r.tenue))
      .map((r) => `${r.where} → « ${r.tenue} »`);
    expect(fantomes, `réfs de tenue introuvables au registre :\n${fantomes.join('\n')}`).toEqual([]);
  });
});
