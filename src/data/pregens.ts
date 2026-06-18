/**
 * Personnages pré-tirés — générés par la méthode officielle (createHero) avec une graine fixe pour
 * la reproductibilité. Le joueur peut en prendre un sans passer par le créateur.
 *
 * Les DÉFINITIONS (espèce/carrière/seed/talent/sorts…) vivent dans `pregens.json` (éditable, comme
 * `creatures.json`) ; ce module = type + chargement + fabrique (`createHero`). Ajouter un pré-tiré =
 * éditer le JSON, jamais ce fichier.
 */
import { Combatant } from '../engine/types';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { findSpell, findSpeciesById, pregens } from './index';

export interface PregenDef {
  name: string;
  /** `id` STABLE de l'espèce (`SpeciesData.id`). */
  species: string;
  /** `id` STABLE de la carrière (`CareerData.id`). */
  career: string;
  seed: number;
  motivation: string;
  /** Talent de carrière CHOISI (libellé concret) — sans lui, createHero prend la 1ʳᵉ entrée du
   *  Niveau, qui n'est PAS forcément le talent d'incantation requis (Magie mineure, Béni…). */
  careerTalent?: string;
  /** Sorts/prières connus (libellés de src/data/spells.json). */
  spells?: string[];
  /** Sexe visuel (cosmétique ; aucune incidence de règles). Défaut 'M'. */
  sex?: 'M' | 'F';
  /** Morphologie 0..1 (cosmétique). Défaut 0.5. */
  build?: number;
}

export function makePregens(): Combatant[] {
  // Résilient : un pré-tiré fautif est ignoré plutôt que de faire planter l'écran.
  const out: Combatant[] = [];
  for (const d of pregens) {
    try {
      const hero = createHero({
        speciesId: d.species,
        careerId: d.career,
        name: d.name,
        motivation: d.motivation,
        careerTalent: d.careerTalent,
        rng: makeRNG(d.seed),
        id: `pregen-${d.seed}`,
      });
      if (d.spells?.length) hero.spells = d.spells.map((l) => findSpell(l)?.id ?? l); // libellés (def) → ids runtime
      // appearance.species = clé de rig (LIBELLÉ d'espèce, résolu depuis l'id) ≠ Combatant.species (id rules).
      hero.appearance = { species: findSpeciesById(d.species)?.label ?? d.species, sex: d.sex ?? 'M', build: d.build ?? 0.5 };
      out.push(hero);
    } catch (e) {
      console.error(`Pré-tiré « ${d.name} » ignoré :`, e);
    }
  }
  return out;
}

/**
 * Équipe « showcase » de l'Arène — DÉLIBÉRÉMENT choisie (PAS `slice(0, 4)`, qui donnerait
 * Soldat/Tueur/Sorcier/Prêtre : aucune arme à distance + deux soigneurs redondants). Les quatre
 * piliers couvrent un maximum de règles DISTINCTES, au Niveau de Carrière 1 :
 *  • Soldat (Reiklander) — mêlée Corps à corps (Base), tanke ; achète bouclier (Parade défensive)
 *    et mailles (PA / Encombrement / pénalité de port) chez le maître d'arène.
 *  • Tueur (Nain) — Frénésie + Sans peur (immunité Peur Troll/Ogre/mort-vivant) + Guérison en
 *    combat + Maniement de deux armes ; exerce toute la couche Psychologie + soin + Détermination.
 *  • Sorcier (Reiklander) — magie arcanique offensive (Fléchette/Choc) + Incident (miscast) ET
 *    Corps à corps (Armes d'hast) avec le Bâton de combat → PROUVE en jeu la Spécialisation d'arme
 *    (Jalon 2 : Armes d'hast ≠ Base).
 *  • Chasseur (Elfe sylvain) — Projectiles (Fronde) + munitions (Pierre ×10) → bandes de portée,
 *    rechargement, Spécialisation de tir. Seul porteur d'arme à distance du groupe.
 * Marchandage/Évaluation n'existent sur aucune carrière martiale de Niveau 1 : `partyBest` retombe
 * sur la Caractéristique brute (Soc/Int) — le marchand reste pleinement jouable (le Sorcier, Int
 * élevée, évalue le butin magique).
 */
const ARENA_SEEDS = [101, 202, 707, 303]; // Soldat · Tueur · Sorcier · Chasseur
export function makeArenaParty(): Combatant[] {
  const all = makePregens();
  return ARENA_SEEDS.map((s) => all.find((h) => h.id === `pregen-${s}`)).filter((h): h is Combatant => !!h);
}
