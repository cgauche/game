import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TRAITS } from './registry';
import { parseTrait, EXTRA_TRAIT_LABELS } from './dispatch';
import { slugId } from '../../data/slug';

/**
 * Parité des Traits de créature (LDB 85). Le registre `TRAITS` est désormais DÉRIVÉ 1:1 de la donnée
 * (`traits.json`) — il n'y a plus de `defs/` mécaniques. Ce garde-fou vérifie donc :
 *  1. la DÉRIVATION est totale : chaque trait de `traits.json` est présent dans `TRAITS` (par id) ;
 *  2. la mécanique de CHAQUE trait est portée par un sous-système identifié — soit `dispatch`
 *     (capabilities/passive lus par les helpers), soit un AUTRE sous-système (creatureAttacks /
 *     psychology / disease / corruption), soit journal/MJ en conscience. Les maps ci-dessous
 *     DOCUMENTENT cette propriété (qui porte quoi) ; une nouvelle donnée non listée fait échouer (2).
 *  3. les `EXTRA_TRAIT_LABELS` (libellés canonicalisés HORS donnée pour fiabiliser l'aval) résolvent
 *     bien via le parseur.
 */

// Traits dont la mécanique vit AILLEURS que dans les helpers de `dispatch` (la raison est documentée).
const COUVERT_AILLEURS = new Map<string, string>([
  // Attaques naturelles et armement — engine/creatureAttacks.ts + spawn.weaponsFromTraits (grantsManeuvers)
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
  ['Venin', 'Empoisonné sur PB infligés — `effects` AUTHORÉ du trait (Test de Résistance paramétré par l’arg, fireTriggers onHit)'],
  ['Constricteur', 'Empêtré sur touche — `effects` AUTHORÉ du trait (condition empetre, escapeStrength=Force, fireTriggers onHit)'],
  ['Vampirique', 'drain de PB sur Morsure (combatFlow.applyFreeAttackEffects — gating « kind=morsure » sans Condition Flow)'],
  ['Se cabrer', 'couvert par le Piétinement existant (LDB 85 — trampleTarget)'],
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
  ['Rongeur', 'marqueur rongeur → Fièvre du Rongeur si aussi Infecté (woundedByRodent, contraction post-combat)'],
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
  // Traits des Horreurs de Tzeentch (EDO) — flavor de statbloc sans système support, desc verbatim.
  ['Marque de Tzeentch', 'Mutations du statbloc — fixées par l’auteur/MJ (l’éditeur pose les Mutations de la créature) ; pas de génération runtime'],
  ['Dédoublement', 'scission en 2 horreurs bleues à la mort/Critique — pas de spawn-on-death dans le moteur (MJ/auteur)'],
  ['Feu de Tzeentch', 'aura de feu entre Horreurs du même type — pas de système d’aura inter-créatures (MJ)'],
]);

// Traits dont la mécanique est portée par les helpers de `dispatch` (capabilities/passive/effects/
// grantsManeuvers de la donnée). Tout trait de traits.json qui n'est NI ici NI dans les maps ci-dessus
// échoue le test de couverture — on n'oublie aucun trait dans un trou.
const DISPATCH = new Set<string>([
  'À sang-froid', 'Affamé', 'Armure', 'Belliqueux', 'Bestial', 'Bond', 'Brutal', 'Champion', 'Coriace',
  'Corruption mentale', 'Démoniaque', 'Élite', 'Endurant', 'Éthéré', 'Fabriqué', 'Foulée', 'Furtif',
  'Grand', 'Immunité', 'Infravision', 'Insensible à la douleur', 'Instable', 'Intelligent', 'Magique',
  'Meneur', 'Mutation', 'Nerveux', 'Nuée', 'Parasité', 'Perturbant', 'Protection', 'Rage', 'Rapide',
  'Régénération', 'Résistance à la Magie', 'Rusé', 'Sang corrosif', 'Stupide', 'Taille', 'Territorial',
  'Toile', 'Vision nocturne', 'Vol',
]);

function allTraitLabels(): string[] {
  const path = fileURLToPath(new URL('../../data/traits.json', import.meta.url));
  return (JSON.parse(readFileSync(path, 'utf8')) as { label: string }[]).map((t) => t.label);
}

describe('parité — registre des Traits dérivé de traits.json', () => {
  it('la dérivation est totale : chaque trait de traits.json est dans TRAITS (par id)', () => {
    const missing = allTraitLabels().filter((l) => !TRAITS[slugId(l)]);
    expect(missing).toEqual([]);
  });

  it('chaque trait de traits.json est couvert par un sous-système identifié (dispatch / ailleurs / journal)', () => {
    const uncovered = allTraitLabels().filter(
      (l) => !DISPATCH.has(l) && !COUVERT_AILLEURS.has(l) && !JOURNAL_MJ.has(l),
    );
    expect(uncovered).toEqual([]);
  });

  it('une seule source de couverture par trait (pas de double-classement)', () => {
    const seen = new Map<string, number>();
    for (const l of [...DISPATCH, ...COUVERT_AILLEURS.keys(), ...JOURNAL_MJ.keys()]) {
      seen.set(l, (seen.get(l) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([l]) => l);
    expect(dupes).toEqual([]);
  });

  it('chaque EXTRA_TRAIT_LABEL (libellé canonicalisé hors donnée) résout via le parseur', () => {
    const unresolved = EXTRA_TRAIT_LABELS.filter((l) => !parseTrait(l));
    expect(unresolved).toEqual([]);
  });

  it('parseTrait normalise Indice/argument/casse', () => {
    expect(parseTrait('Démoniaque 8+')).toEqual({ id: 'demoniaque', indice: 8, arg: undefined });
    expect(parseTrait('Toile 40')).toEqual({ id: 'toile', indice: 40, arg: undefined });
    expect(parseTrait('Immunité (Poison)')).toEqual({ id: 'immunite', indice: undefined, arg: 'Poison' });
    expect(parseTrait('À Sang-froid')?.id).toBe('a-sang-froid'); // casse de la donnée ≠ id canonique
    expect(parseTrait('Vol 100')).toEqual({ id: 'vol', indice: 100, arg: undefined });
    expect(parseTrait('Nuée')?.id).toBe('nuee');
    expect(parseTrait('Taille (Énorme)')).toEqual({ id: 'taille', indice: undefined, arg: 'Énorme' });
    expect(parseTrait('Armure 4')).toEqual({ id: 'armure', indice: 4, arg: undefined });
    expect(parseTrait('Trait inconnu')).toBeNull();
  });
});
