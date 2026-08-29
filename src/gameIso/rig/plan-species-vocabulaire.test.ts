/**
 * VOLET 1 — l'espace d'espèces DÉCLARÉ par les gabarits corporels est un sous-ensemble du
 * vocabulaire d'ids DÉRIVÉ des registres. `speciesNames()` d'un plan expose des `appearance.species`
 * (ids stables) : un libellé d'affichage y est une valeur qui ne résout dans aucun registre exact.
 * Cf. [[game-ids-internes-libelles-display-multilangue]] ; garde jumelle sur la DONNÉE :
 * `src/data/refs-migrated.test.ts` (« appearance.species — id stable »).
 * Périmètre : l'espace DÉCLARÉ. L'espace ÉMIS au runtime (resolveRender/rigSpeciesId) est le volet 2.
 *
 * ⚠ Le `VOCAB` ci-dessous est PROVISOIRE : c'est une union LARGE de 6 registres, posée pour ce volet 1.
 * LA définition du vocabulaire d'ids d'espèce (type fermé vs garde sur la DONNÉE, p. ex.
 * `VALID_SPECIES = species ∪ créatures`) est la question OUVERTE de #1537 — ce volet ne la tranche pas.
 * En particulier `SWARM_FORMS` y est admis alors que `appearance.species` ne déclare pas les nuées :
 * l'`it` de MORSURE ci-dessous fige ce qu'un retrait des nuées coûterait (le plan swarm sort 8 ids).
 * Retrait d'UNE source du vocabulaire — violations mesurées le 2026-08-29 : species 0, créatures 100,
 * raceAppearance 20, formes de nuée 8, véhicules 0, siegeRig 0 (3 sources sur 6 sont inertes ici).
 */
import { describe, it, expect } from 'vitest';
import { PLAN_LIST } from './plans/_registry.generated';
import { creatureSpeciesOptions, bipedSpeciesNames } from './creatures';
import { SWARM_FORMS } from './swarm/forms';
import { species, raceAppearance, vehicles, trappings } from '../../data';

/** Vocabulaire CANONIQUE des ids d'espèce — DÉRIVÉ des 6 registres, jamais authoré ici. */
const VOCAB = new Set<string>([
  ...species.map((s) => s.id),
  ...creatureSpeciesOptions().map((o) => o.id),
  ...raceAppearance.map((r) => r.id),
  ...Object.keys(SWARM_FORMS),
  ...vehicles.map((v) => v.id),
  ...trappings.map((t) => t.siegeRig).filter((r): r is string => typeof r === 'string'),
]);

describe('espace d’espèces DÉCLARÉ par les gabarits ⊆ vocabulaire dérivé', () => {
  it('témoins : le vocabulaire porte les IDS, pas les libellés', () => {
    expect(VOCAB.has('humain')).toBe(true);
    expect(VOCAB.has('Humain')).toBe(false);
    expect(VOCAB.size).toBeGreaterThan(50);
  });

  it('∀ plan, speciesNames() ne contient que des ids du vocabulaire', () => {
    const bad: string[] = [];
    for (const p of PLAN_LIST)
      for (const n of p.speciesNames())
        if (!VOCAB.has(n)) bad.push(`plan « ${p.id} » : « ${n} » hors vocabulaire (species.json ∪ defs rig ∪ raceAppearance ∪ formes de nuée ∪ véhicules ∪ siegeRig)`);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('MORSURE — vocabulaire privé des formes de nuée : le plan swarm sort EXACTEMENT ses ids', () => {
    const formes = Object.keys(SWARM_FORMS);
    const sansNuees = new Set([...VOCAB].filter((id) => !formes.includes(id)));
    // Attendu DÉRIVÉ : les formes qu'AUCUN autre registre ne porte (jamais une liste en dur).
    const attendu = formes.filter((f) => !sansNuees.has(f)).map((f) => `swarm:${f}`).sort();
    const bad: string[] = [];
    for (const p of PLAN_LIST)
      for (const n of p.speciesNames())
        if (!sansNuees.has(n)) bad.push(`${p.id}:${n}`);
    expect(bad.sort(), 'la garde ne mord plus : retirer les formes de nuée du vocabulaire ne sort RIEN').toEqual(attendu);
    expect(attendu.length, 'le coût mesuré d’un retrait des nuées du vocabulaire (#1537) a changé — re-mesurer avant de le figer').toBe(8);
  });

  it('l’espace bipède est DÉRIVÉ du registre (non vide, ids de def)', () => {
    const noms = bipedSpeciesNames();
    expect(noms.length, 'bipedSpeciesNames() est vide — la dérivation du registre est débranchée').toBeGreaterThan(0);
    const ids = new Set(creatureSpeciesOptions().map((o) => o.id));
    for (const n of noms) expect(ids.has(n), `« ${n} » n’est pas un id de def de créature`).toBe(true);
  });
});
