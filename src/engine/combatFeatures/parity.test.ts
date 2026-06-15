import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COMBAT_FEATURES } from './registry';

/**
 * Parité des TALENTS (LDB 10) — garde-fou anti-empilement, sur le modèle de
 * `qualities/dispatch.test.ts` : CHAQUE talent de `talents.json` est soit une def du registre
 * (effet de jeu câblé), soit couvert AILLEURS (création/attributs, magie, flux dédiés — raison
 * documentée), soit narratif/MJ EN CONSCIENCE (la desc verbatim est affichée sur la fiche).
 */

// Talents de CRÉATION/ATTRIBUTS pilotés par les données (talentEffects.ts : addCharacteristic /
// addSkill / Blessures / Chance / Détermination / Mouvement) — appliqués à l'acquisition.
const CREATION = new Set([
  'Affable', 'Chanceux', 'Doigts de fée', 'Dur à cuire', 'Guerrier né', 'Imperturbable', 'Obstiné',
  'Perspicace', 'Réflexes foudroyants', 'Tireur de précision', 'Très fort', 'Très résistant',
  'Véloce', 'Vivacité', 'Artiste', 'Maître artisan', 'Oreille absolue', 'Sorcier !', 'Voyageur aguerri',
  'Talent aléatoire', // méta-talent de création (tirage d100)
]);

// Couverts par un AUTRE sous-système (raison documentée — pas de def pour éviter la double source).
const COUVERT_AILLEURS = new Map<string, string>([
  ['Âme pure', 'seuil de Corruption +niveau (corruption.corruptionThresholdExceeded)'],
  ['Costaud', "limite d'Encombrement +2×niveau (items.maxEncumbrance)"],
  ['Petit', 'Taille (Petite) appliquée par l’espèce (Halfling…)'],
  ['Massif', 'Taille appliquée par l’espèce (Ogre)'],
  ['Acrobaties équestres', "annule le −20 d'Esquive en selle (mount.mountedDodgePenalty)"],
  ['Chirurgie', 'mode de soin chirurgical (healing/partyFlow : opérer fracture majeure/amputation)'],
  ['Vision nocturne', "annule la pénalité d'obscurité (combatFlow.seesInDark)"],
  ['Frénésie', 'capacité de Frénésie (psychology.isFrenzyCapable + flux frenzy)'],
  ['Diction instinctive', 'pas d’Imparfaite sur double réussi de Langue (Magick) (applyCast)'],
  ['Magie des Arcanes', 'apprentissage des sorts (grimoire.ts — hors périmètre sorts)'],
  ['Magie mineure', 'apprentissage des sorts (grimoire.ts — hors périmètre sorts)'],
  ['Magie du Chaos', 'apprentissage des sorts (grimoire.ts — hors périmètre sorts)'],
  ['Béni', 'Bénédictions de la divinité (grimoire/spellspecs — hors périmètre sorts)'],
  ['Invocation', 'Miracles du culte (grimoire/spellspecs — hors périmètre sorts)'],
  ['Bénédiction de Tzeentch', 'Sort unique offert (grimoire.ts — hors périmètre sorts)'],
]);

// Narratifs / arbitrage MJ — EN CONSCIENCE : pas d'effet moteur câblable sans inventer (économie
// d'aventure, scènes sociales libres, activités entre aventures…). La desc (verbatim LDB 10) est
// affichée sur la fiche du personnage.
const NARRATIF_MJ = new Set([
  'Affinité avec les animaux', 'Attirant', 'Baratiner', 'Bon marcheur', 'Bricoleur', 'Brouet',
  'Caïd', 'Cavalier émérite', 'Claquer le fouet', 'Concocter', 'Contorsionniste',
  'Contrôle de la Frénésie', 'Coopératif', 'Coude-à-coude', 'Criminel', 'Destinée',
  "Détection d'artefact", 'Discret', 'Distraire', 'Doué en calcul', 'Effraction', 'Empreint d’Ulgu',
  "Empreint d'Ulgu", 'Empreint de la Magie', 'Ergoteur', 'Escroquer', 'Exaltant', 'Faire la manche',
  'Feinte', 'Ferveur ardente', 'Flagellant', 'Flairer les ennuis', 'Frappe précise', 'Frappe réactive',
  'Grimpeur', 'Guide fluvial', 'Haine', 'Haine sacrée', 'Identité secrète', 'Imitation',
  'Impitoyable', 'Inébranlable', 'Infatigable', 'Insignifiant', 'Intrigant', 'Lecture sur les lèvres',
  'Lire sur les lèvres', 'Lire/Écrire', 'Linguistique', 'Loup de mer', 'Mage de guerre',
  'Magnum Opus', 'Mains agiles', 'Maître en déguisement', 'Maîtrise des dés', 'Marinier',
  'Menteur', 'Nageur endurant', 'Nanti', 'Noblesse', 'Nomade', 'Numismate', 'Œil du chasseur',
  'Orateur', 'Pas de côté', 'Perception de la magie', 'Persévérant', 'Pêcheur', 'Pied marin',
  'Pilote', 'Présence imposante', 'Prévoyant', "Rat d'égout", 'Résistance',
  'Saut carpé', 'Savant', 'Savoir-vivre', 'Seconde vue', 'Seigneur de guerre', 'Sens aiguisé',
  "Sens de l'orientation", 'Sixième sens', 'Souplesse féline', 'Suborneur', 'Tour des souvenirs',
  'Trappeur', 'Travailleur qualifié', 'Tricheur', 'Vice', 'Visions sacrées', 'Volonté de fer',
  'Battement', 'Désarmer', 'Assaut féroce', // manœuvres d'Action dédiées — différées (UI/flux propres)
  'Combattant au contact', 'Combattant en espace clos', // règles optionnelles (Combat au contact p.297) / espaces clos non modélisés
  'Disciple du changement', 'Double vie', // talents de culte du Chaos (EDO) — Mutation/double carrière, non câblés (classe Chaos hors création joueur)
  "Commandant d'équipe", // Aux Armes : coordonne une équipe d'arme de siège (Projectiles partagés) — lié aux armes d'équipe, non modélisé → narratif/MJ
]);

describe('parité — tout Talent de talents.json est couvert (def, création, ailleurs, ou MJ en conscience)', () => {
  it('aucun talent de la donnée ne tombe dans un trou', () => {
    const path = fileURLToPath(new URL('../../data/talents.json', import.meta.url));
    const all = JSON.parse(readFileSync(path, 'utf8')) as { label: string }[];
    const missing = all
      .map((t) => t.label)
      .filter((l) => !COMBAT_FEATURES[l] && !CREATION.has(l) && !COUVERT_AILLEURS.has(l) && !NARRATIF_MJ.has(l));
    expect(missing).toEqual([]);
  });
  it('pas de double-couverture def + allowlist', () => {
    const dupes = [...CREATION, ...COUVERT_AILLEURS.keys(), ...NARRATIF_MJ].filter((l) => COMBAT_FEATURES[l]);
    expect(dupes).toEqual([]);
  });
});
