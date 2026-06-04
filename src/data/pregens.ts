/**
 * Personnages pré-tirés — générés par la méthode officielle (createHero) avec
 * une graine fixe pour la reproductibilité. Le joueur peut en prendre un sans
 * passer par le créateur.
 */
import { Combatant } from '../engine/types';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

interface PregenDef {
  name: string;
  species: string;
  career: string;
  seed: number;
  motivation: string;
  /** Sorts/prières connus (libellés de src/data/spells.json). */
  spells?: string[];
  /** Sexe visuel (cosmétique ; aucune incidence de règles). Défaut 'M'. */
  sex?: 'M' | 'F';
  /** Morphologie 0..1 (cosmétique). Défaut 0.5. */
  build?: number;
}

// Les 4 premiers composent l'équipe « Test rapide » : on y inclut un Sorcier
// (Sorts via Langue (Magick)) et un Prêtre (Prières via Prière) pour exercer la
// couche magie au combat.
const DEFS: PregenDef[] = [
  { name: 'Sigmund Reikhardt', species: 'Humains (Reiklander)', career: 'Soldat', seed: 101, motivation: 'Devoir' },
  { name: 'Grunni Pierre-de-Fer', species: 'Nains', career: 'Tueur', seed: 202, motivation: 'Honte (Malédiction du Tueur)' },
  {
    name: 'Wilhelmina Faust',
    species: 'Humains (Reiklander)',
    career: 'Sorcier',
    seed: 707,
    motivation: 'Connaissance',
    spells: ['Fléchette', 'Choc'],
    sex: 'F',
    build: 0.42,
  },
  {
    name: 'Frère Anselm',
    species: 'Humains (Reiklander)',
    career: 'Prêtre',
    seed: 808,
    motivation: 'Foi',
    spells: ['Bénédiction de Guérison', 'Bénédiction de Bataille'],
  },
  { name: 'Aelindra Feuille-d’Argent', species: 'Elfes sylvains', career: 'Chasseur', seed: 303, motivation: 'Nature' },
  { name: 'Rosa Brandt', species: 'Humains (Reiklander)', career: 'Apothicaire', seed: 404, motivation: 'Connaissance', sex: 'F', build: 0.45 },
  { name: 'Klein Bürger', species: 'Halflings', career: 'Voleur', seed: 505, motivation: 'Curiosité' },
  { name: 'Otto Hammerfest', species: 'Humains (Reiklander)', career: 'Répurgateur', seed: 606, motivation: 'Foi' },
];

export function makePregens(): Combatant[] {
  // Résilient : un pré-tiré fautif est ignoré plutôt que de faire planter l'écran.
  const out: Combatant[] = [];
  for (const d of DEFS) {
    try {
      const hero = createHero({
        speciesLabel: d.species,
        careerLabel: d.career,
        name: d.name,
        motivation: d.motivation,
        rng: makeRNG(d.seed),
        id: `pregen-${d.seed}`,
      });
      if (d.spells?.length) hero.spells = [...d.spells];
      hero.appearance = { species: d.species, sex: d.sex ?? 'M', build: d.build ?? 0.5 };
      out.push(hero);
    } catch (e) {
      console.error(`Pré-tiré « ${d.name} » ignoré :`, e);
    }
  }
  return out;
}
