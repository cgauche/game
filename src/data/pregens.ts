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
      // Libellés (def AUTHORING, lisibles) → ids STABLES au runtime ; un libellé non résolu est ÉCARTÉ
      // (jamais réinjecté tel quel — pas de repli libellé : le runtime ne connaît QUE des ids).
      if (d.spells?.length) hero.spells = d.spells.map((l) => findSpell(l)?.id).filter((id): id is string => !!id);
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
/**
 * Sélection d'un groupe de scénario — API UNIQUE et intention-révélante. Remplace les patterns fragiles
 * accrétés (`makePregens().slice(0, n)` qui dépend de l'ordre du JSON et donne le groupe SANS arme à
 * distance dénoncé ci-dessus ; `find(p => p.name…)` par nom ; indexation ad hoc de `makePregens()`).
 * Les pré-tirés portent un seed STABLE (`id = pregen-<seed>`) ; on les nomme par les clés lisibles de
 * `PREGEN` (une par carrière du roster). `pregenParty(...)` construit le roster UNE fois.
 */
export const PREGEN = {
  soldat: 101, tueur: 202, sorcier: 707, pretre: 808,
  chasseur: 303, apothicaire: 404, voleur: 505, repurgateur: 606,
} as const;

/** Groupe EXPLICITE par seeds (ordre = ordre des arguments) — la façon CANONIQUE de composer une équipe
 *  de scénario. Ex. `pregenParty(PREGEN.soldat, PREGEN.chasseur)`. Lève si un seed est inconnu (plutôt
 *  qu'un `undefined` silencieux d'un `find`/`slice` raté). */
export function pregenParty(...seeds: number[]): Combatant[] {
  const all = makePregens();
  return seeds.map((s) => {
    const h = all.find((p) => p.id === `pregen-${s}`);
    if (!h) throw new Error(`Pré-tiré pregen-${s} introuvable (PREGEN/pregens.json)`);
    return h;
  });
}

/** UN pré-tiré par son seed (copie fraîche). Ex. `pregen(PREGEN.soldat)`. */
export function pregen(seed: number): Combatant {
  return pregenParty(seed)[0];
}

/** Équipe « showcase » de l'Arène — les 4 piliers (cf. ci-dessus) couvrant un max de règles distinctes. */
export function makeShowcaseParty(): Combatant[] {
  return pregenParty(PREGEN.soldat, PREGEN.tueur, PREGEN.sorcier, PREGEN.chasseur);
}
