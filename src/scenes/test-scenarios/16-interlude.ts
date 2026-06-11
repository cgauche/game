import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { Combatant } from '../../engine/types';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Soldat (Recrue = Argent 1) : Revenus corrects et banque « Investir » autorisée (LDB 23). */
function veteran(): Combatant {
  const h = createHero({
    speciesLabel: 'Humains (Reiklander)',
    careerLabel: 'Soldat',
    name: 'Vétéran (test)',
    motivation: 'Test',
    rng: makeRNG(1601),
    id: 'test-interlude-veteran',
  });
  h.xp = 300; // de quoi tenter un Apprentissage particulier (Talent hors carrière)
  h.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.55 };
  return h;
}

/** Artisan : Compétence Métier → l'Activité Artisanat (Test étendu) est jouable. */
function artisan(): Combatant {
  const h = createHero({
    speciesLabel: 'Nains', // un forgeron nain, évidemment
    careerLabel: 'Artisan',
    name: 'Forgeron (test)',
    motivation: 'Test',
    rng: makeRNG(1602),
    id: 'test-interlude-forgeron',
  });
  if (!h.skills.some((s) => /^métier/i.test(s.name))) {
    h.skills.push({ name: 'Métier (Forgeron)', characteristic: 'Dex', advances: 10 });
  }
  h.appearance = { species: 'Nains', sex: 'M', build: 0.7 };
  return h;
}

const scene = arena({ id: 'test-interlude', nom: 'Entre deux aventures — Activités & Événements', w: 12, h: 8, heroStart: { x: 2, y: 4 } });
scene.startMessage = 'Marchez sur le cercle : la bourse se remplit puis l’interlude s’ouvre (Événements d100, Activités — Revenus, Artisanat, banque, apprentissage, commande — puis Argent à gaspiller).';
scene.entities.push({ id: 'cercle', kind: 'prop', ref: 'cercle-runique', pos: { x: 6, y: 4 } });
scene.triggers = [
  {
    id: 'interlude',
    rect: { x: 5, y: 3, w: 3, h: 3 },
    once: true,
    effects: [
      { type: 'giveMoney', gold: 30 },
      { type: 'journal', text: 'Votre dernière aventure vous a rapporté 30 couronnes — dépensez-les bien, le reste s’évaporera.' },
      { type: 'interlude', weeks: 3 },
    ],
  },
];

export const scenario: TestScenario = {
  id: 'interlude',
  order: 16,
  icon: '🍺',
  title: 'Entre deux aventures',
  tests: 'Événement d100 par héros, 3 Activités (Revenus, Artisanat étendu, banque invest/planque, Apprentissage, commande Exotique), Argent à gaspiller, le temps passe (LDB 22-23).',
  partyNote: 'Vétéran (Argent 1, 300 PX) + Forgeron nain (Métier 10)',
  makeParty: () => [veteran(), artisan()],
  scene,
};
