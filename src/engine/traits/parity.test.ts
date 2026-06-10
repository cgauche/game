import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TRAITS } from './registry';
import { parseTrait } from './dispatch';

/**
 * Parité des Traits de créature (LDB 85) — garde-fou anti-empilement, sur le modèle de
 * `qualities/dispatch.test.ts` : CHAQUE trait de `traits.json` est soit une def du registre,
 * soit couvert AILLEURS (creatureAttacks/psychology/spawn — listé avec sa raison), soit
 * journal/MJ en conscience. Toute nouvelle donnée non couverte fait échouer ce test.
 */

// Couverts par un AUTRE sous-système (pas de def — la raison est documentée ici).
const COUVERT_AILLEURS = new Map<string, string>([
  // Attaques naturelles et armement — engine/creatureAttacks.ts + spawn.weaponsFromTraits
  ['À distance', 'arme dérivée au spawn (weaponsFromTraits)'],
  ['Arme', 'arme dérivée au spawn (weaponsFromTraits)'],
  ['Attaque caudale', 'attaque gratuite (creatureAttacks.ts)'],
  ['Cornes', 'attaque gratuite à la Charge (creatureAttacks.ts)'],
  ['Morsure', 'attaque gratuite (creatureAttacks.ts)'],
  ['Souffle', 'attaque de zone (creatureAttacks.ts + combatFlow)'],
  ['Tentacules', 'attaques gratuites par tentacule, count× à coût 0 (creatureAttacks.ts + aiCreatureFreeAttacks)'],
  ['Étreinte glaciale', 'attaque-Action magique (creatureAttacks.ts + combatFlow)'],
  ['Langue préhensile', 'attaque gratuite à distance (creatureAttacks.ts)'],
  ['Hurlement fantomatique', 'cri de zone (creatureAttacks.ts + combatFlow)'],
  ['Regard pétrifiant', 'attaque-Action (creatureAttacks.ts + combatFlow)'],
  ['Vomissement', 'attaque de zone (creatureAttacks.ts + combatFlow)'],
  ['Venin', 'Empoisonné sur PB infligés (creatureAttacks.venomDifficulty + combatFlow)'],
  ['Constricteur', 'Empêtré sur touche (combatFlow.applyFreeAttackEffects)'],
  ['Vampirique', 'drain de PB sur Morsure (combatFlow.applyFreeAttackEffects)'],
  ['Se cabrer', 'couvert par le Piétinement existant (LDB 85 — trampleTarget)'],
  // Profil dérivé au spawn — state/spawn.ts
  ['Armure', 'PA plats au spawn (armourFromTraits)'],
  ['Taille', 'catégorie de Taille au spawn (sizeFromTraits) + sous-système Taille'],
  ['Nuée', 'swarmFromTraits (×5 PB, +10 CC, immunité psy, Frappe Mortelle…)'],
  // Psychologie — engine/psychology.ts (parsePsychTraits)
  ['Peur', 'causesPeur (parsePsychTraits)'],
  ['Terreur', 'causesTerreur (parsePsychTraits)'],
  ['Frénésie', 'isFrenzyCapable + flux de Frénésie'],
  ['Animosité', 'trait psy ciblé (parsePsychTraits)'],
  ['Haine', 'trait psy ciblé (parsePsychTraits)'],
  ['Préjugé', 'trait psy ciblé (parsePsychTraits)'],
  ['Effrayé', 'trait psy ciblé ≈ Peur 0 (parsePsychTraits)'],
  ['Immunité Psychologique', 'psychImmune (parsePsychTraits)'],
  // Afflictions transmises — engine/disease.ts + state/corruptionFlow.ts
  ['Maladie', 'contraction post-combat (disease.ts — Lot D)'],
  ['Infecté', 'Blessure Purulente post-combat (disease.ts — Lot D)'],
  ['Corruption', 'exposition du groupe (corruptionFlow — Lot E)'],
]);

// Journal/MJ EN CONSCIENCE : pas d'effet moteur câblable sans système support — la desc (verbatim)
// est affichée à l'inspecteur ; rien d'inventé.
const JOURNAL_MJ = new Map<string, string>([
  ['Amphibie', 'pas de coût de déplacement aquatique (terrain binaire walkable)'],
  ['Arboricole', 'bonus Escalade/Discrétion en forêt — pas de biome forêt mécanisé'],
  ['Limicole', 'pas de terrain marécageux à pénalité de Mouvement'],
  ['Grimpant', 'pas de système d’escalade (surfaces verticales)'],
  ['Pisteur', 'Pistage hors combat — arbitrage MJ'],
  ['Dressé', 'dressages spécifiques (Divertir/Garder/Monture…) — arbitrage MJ'],
  ['Béni', 'Bénédictions de PNJ — pas de liste de prières dans la donnée (MJ)'],
  ['Miracles', 'Miracles de PNJ — pas de liste dans la donnée (MJ)'],
  ['Lanceur de Sorts', 'la donnée bestiaire ne liste pas les sorts connus → choix d’AUTEUR (éditeur : spells du spawn/statbloc) ; l’IA incante enemy.spells'],
  ['Mort-vivant', 'marqueur (consommé par Hurlement fantomatique, les Groupes et les contractions)'],
  ['Increvable', 'recousue/ressuscitée post-combat — arbitrage MJ'],
]);

describe('parité — tout Trait de traits.json est couvert (def, ailleurs, ou journal en conscience)', () => {
  it('aucun trait de la donnée ne tombe dans un trou', () => {
    const path = fileURLToPath(new URL('../../data/traits.json', import.meta.url));
    const all = JSON.parse(readFileSync(path, 'utf8')) as { label: string }[];
    const missing = all
      .map((t) => t.label)
      .filter((l) => !TRAITS[l] && !COUVERT_AILLEURS.has(l) && !JOURNAL_MJ.has(l));
    expect(missing).toEqual([]);
  });
  it('pas de double-couverture def + allowlist (une seule source de vérité par trait)', () => {
    const dupes = [...COUVERT_AILLEURS.keys(), ...JOURNAL_MJ.keys()].filter((l) => TRAITS[l]);
    expect(dupes).toEqual([]);
  });
  it('parseTrait normalise Indice/argument/casse', () => {
    expect(parseTrait('Démoniaque 8+')).toEqual({ key: 'Démoniaque', indice: 8, arg: undefined });
    expect(parseTrait('Toile 40')).toEqual({ key: 'Toile', indice: 40, arg: undefined });
    expect(parseTrait('Immunité (Poison)')).toEqual({ key: 'Immunité', indice: undefined, arg: 'Poison' });
    expect(parseTrait('À Sang-froid')?.key).toBe('À sang-froid'); // casse de la donnée ≠ clé canonique
    expect(parseTrait('Vol 100')).toEqual({ key: 'Vol', indice: 100, arg: undefined });
    expect(parseTrait('Trait inconnu')).toBeNull();
  });
});
