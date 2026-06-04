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
}

const DEFS: PregenDef[] = [
  { name: 'Sigmund Reikhardt', species: 'Humains (Reiklander)', career: 'Soldat', seed: 101, motivation: 'Devoir' },
  { name: 'Grunni Pierre-de-Fer', species: 'Nains', career: 'Tueur', seed: 202, motivation: 'Honte (Malédiction du Tueur)' },
  { name: 'Aelindra Feuille-d’Argent', species: 'Elfes sylvains', career: 'Chasseur', seed: 303, motivation: 'Nature' },
  { name: 'Rosa Brandt', species: 'Humains (Reiklander)', career: 'Apothicaire', seed: 404, motivation: 'Connaissance' },
  { name: 'Klein Bürger', species: 'Halflings', career: 'Voleur', seed: 505, motivation: 'Curiosité' },
  { name: 'Otto Hammerfest', species: 'Humains (Reiklander)', career: 'Répurgateur', seed: 606, motivation: 'Foi' },
];

export function makePregens(): Combatant[] {
  // Résilient : un pré-tiré fautif est ignoré plutôt que de faire planter l'écran.
  const out: Combatant[] = [];
  for (const d of DEFS) {
    try {
      out.push(
        createHero({
          speciesLabel: d.species,
          careerLabel: d.career,
          name: d.name,
          motivation: d.motivation,
          rng: makeRNG(d.seed),
          id: `pregen-${d.seed}`,
        }),
      );
    } catch (e) {
      console.error(`Pré-tiré « ${d.name} » ignoré :`, e);
    }
  }
  return out;
}
