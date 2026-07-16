import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combatant } from '../engine/types';
import { AdvancementPanel } from './CharacterSheet';
import { BackgroundPanel } from './BackgroundPanel';
import { casterTalents } from '../engine/grimoire';

/** Héros « Agitateur » niveau 1 (« Pamphlétaire ») avec 1000 PX, Charme (in-carrière) + Esquive (hors). */
const hero = (): Combatant =>
  ({
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'humains-reiklander',
    career: 'agitateur',
    careerLevel: 1,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { skillId: 'charme', characteristic: 'sociabilite', advances: 0 },
      { skillId: 'esquive', characteristic: 'agilite', advances: 0 },
    ],
    talents: [],
    movement: 4,
    xp: 1000,
    charAdvances: {},
    motivation: 'Devoir',
    details: { age: 27, ambitionShort: 'Survivre à la prochaine campagne', ambitionLong: 'Commander sa propre compagnie' },
  }) as unknown as Combatant;

describe('AdvancementPanel (rendu)', () => {
  it('rend le bandeau PX, les Caractéristiques, Compétences, Talents et le bloc Carrière', () => {
    const html = renderToStaticMarkup(<AdvancementPanel hero={hero()} />);
    // Bandeau PX collant (total en tête de l'onglet Avancement)
    expect(html).toContain('Expérience disponibles');
    expect(html).toContain('1000');
    // Caractéristiques : coût in-carrière (CT = 25) ET hors-carrière (CC = 50) — rangée en
    // <CharValue> (libellé COURT + popover Codex de la caractéristique)
    expect(html).toContain('char-value');
    expect(html).toContain('CC');
    expect(html).toContain('25 PX');
    expect(html).toContain('50 PX');
    // Pastilles in/hors carrière
    expect(html).toContain('carrière');
    // Compétences : connue + acquérable
    expect(html).toContain('Charme');
    expect(html).toContain('Ragot'); // compétence de carrière non connue → acquérable
    expect(html).toContain('Apprendre');
    // Talents de carrière acquérables
    expect(html).toContain('Sociable');
    expect(html).toContain('Acquérir');
    // Bloc Carrière
    expect(html).toContain('Pamphlétaire');
    expect(html).toContain('niveau en cours');
    expect(html).toContain('changer de carrière');
  });

  it('grise un achat quand les PX sont insuffisants', () => {
    const broke = { ...hero(), xp: 5 } as Combatant;
    const html = renderToStaticMarkup(<AdvancementPanel hero={broke} />);
    expect(html).toContain('disabled'); // boutons d'achat désactivés (coût > 5 PX)
  });
});

describe('Gate Magie & Foi (#492 bug 2)', () => {
  it('un Béni SANS Bénédiction mémorisée reste un lanceur (casterTalents, pas juste spells.length)', () => {
    const beni: Combatant = { ...hero(), spells: [], talents: [{ talentId: 'beni', spec: 'sigmar', times: 1 }] } as Combatant;
    // `isCaster` de CharacterSheet lit CE calcul — un Béni sans sort mémorisé encore ne doit
    // pas perdre son onglet Magie & Foi ni son compteur de Péché.
    expect((beni.spells?.length ?? 0) > 0).toBe(false);
    expect(casterTalents(beni).length).toBeGreaterThan(0);
  });
});

describe('BackgroundPanel (rendu)', () => {
  it('affiche la bio en lecture seule (âge) et les champs éditables (motivation + ambitions)', () => {
    const html = renderToStaticMarkup(<BackgroundPanel hero={hero()} />);
    // Bio lecture seule : âge présent → affiché ; les champs absents (yeux/cheveux) ne sont pas inventés.
    expect(html).toContain('27 ans');
    expect(html).not.toContain('Yeux');
    // Champs éditables (Motivation + Ambitions court/long) avec leurs valeurs.
    expect(html).toContain('Motivation');
    expect(html).toContain('Devoir'); // value de l'<input> motivation
    expect(html).toContain('Survivre à la prochaine campagne'); // ambition court terme
    expect(html).toContain('Commander sa propre compagnie'); // ambition long terme
    expect(html).toContain('Modifiable hors combat');
  });
});
