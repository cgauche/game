import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combatant } from '../engine/types';
import { EtatPanel } from './EtatPanel';
import { ETAT_ANCHOR_CRITIQUES, ETAT_ANCHOR_CORRUPTION, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_MUTATIONS, ETAT_ANCHOR_TRAUMAS, ETAT_ANCHOR_PSYCHOLOGIE, ETAT_ANCHOR_ENCOMBREMENT } from './sheetAlarms';

/** Héros minimal, patron `sheetAlarms.test.ts`/`CharacterSheet.test.tsx` (mkHero). */
const mkHero = (mut?: (c: Combatant) => void): Combatant => {
  const c = {
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'humains-reiklander',
    career: 'soldat',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    conditions: [],
    skills: [],
    talents: [],
    movement: 4,
    items: [],
  } as unknown as Combatant;
  mut?.(c);
  return c;
};

/** Héros AFFLIGÉ : 1 critique subi (Tête, LDB), 1 État, Corruption, 1 trauma, 1 maladie, 1 mutation,
 *  1 affliction psy (Peur active) et une Surcharge — les 7 rubriques ancrées. */
const afflictedHero = (): Combatant =>
  mkHero((c) => {
    c.critEntriesSuffered = ['blessure-spectaculaire'];
    c.conditions = [{ name: 'assourdi', value: 1 } as never];
    c.corruption = 2;
    c.traumas = [{ label: 'Bras cassé', location: 'brasG', desc: 'Description verbatim du trauma.' } as never];
    c.diseases = [{ name: 'infection-mineure', symptoms: [], phase: 'active', minutesLeft: 100, durationMinutes: 100 } as never];
    c.mutations = [{ id: 'pattes-d-animaux', label: 'Pattes d’animaux', desc: '+1 Mouvement', kind: 'physique', roll: 1, passive: [{ op: 'moveMod', mod: 1 }] } as never];
    c.psychState = [{ type: 'peur', indice: 2, calmeDR: 0 } as never];
    c.items = [{ uid: 'x', kind: 'misc', enc: 999, qualities: [] } as never];
  });

describe('EtatPanel', () => {
  it('héros affligé : les 7 rubriques sont ancrées, la prose est rendue, aucune rubrique vide', () => {
    const html = renderToStaticMarkup(<EtatPanel hero={afflictedHero()} />);
    for (const anchor of [ETAT_ANCHOR_CRITIQUES, ETAT_ANCHOR_CORRUPTION, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_MUTATIONS, ETAT_ANCHOR_TRAUMAS, ETAT_ANCHOR_PSYCHOLOGIE, ETAT_ANCHOR_ENCOMBREMENT]) {
      expect(html, `ancre manquante : ${anchor}`).toContain(`id="${anchor}"`);
    }
    // Prose verbatim (règle 5) — au moins le trauma et la mutation portent leur texte (« Mouvement »
    // auto-lié en `CodexRef` par `<Prose>` — le texte voisin « +1 » reste, la doctrine RAG l'atteste).
    expect(html).toContain('Description verbatim du trauma.');
    expect(html).toContain('+1 ');
    // Un GameOp = une rangée (doctrine #295) : le moveMod de la mutation est rendu en chip.
    expect(html).toContain('gagne +1 en Mouvement');
    // Aucun état « Rien à signaler » sur un héros affligé.
    expect(html).not.toContain('Rien à signaler');
  });

  it('héros sain : « Rien à signaler », aucune ancre de rubrique d’affliction', () => {
    const html = renderToStaticMarkup(<EtatPanel hero={mkHero()} />);
    expect(html).toContain('Rien à signaler');
    for (const anchor of [ETAT_ANCHOR_CRITIQUES, ETAT_ANCHOR_CORRUPTION, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_MUTATIONS, ETAT_ANCHOR_TRAUMAS, ETAT_ANCHOR_PSYCHOLOGIE, ETAT_ANCHOR_ENCOMBREMENT]) {
      expect(html, `ancre inattendue : ${anchor}`).not.toContain(`id="${anchor}"`);
    }
  });
});
