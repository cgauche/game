import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combatant } from '../engine/types';
import { AdvancementPanel } from './CharacterSheet';

/** Héros « Agitateur » niveau 1 (« Pamphlétaire ») avec 1000 PX, Charme (in-carrière) + Esquive (hors). */
const hero = (): Combatant =>
  ({
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'Humains (Reiklander)',
    career: 'Agitateur',
    careerLevel: 1,
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { name: 'Charme', characteristic: 'Soc', advances: 0 },
      { name: 'Esquive', characteristic: 'Ag', advances: 0 },
    ],
    talents: [],
    movement: 4,
    xp: 1000,
    charAdvances: {},
  }) as unknown as Combatant;

describe('AdvancementPanel (rendu)', () => {
  it('rend le bandeau PX, les Caractéristiques, Compétences, Talents et le bloc Carrière', () => {
    const html = renderToStaticMarkup(<AdvancementPanel hero={hero()} />);
    // Bandeau PX + octroi
    expect(html).toContain('PX disponibles');
    expect(html).toContain('1000');
    // Caractéristiques : coût in-carrière (CT = 25) ET hors-carrière (CC = 50)
    expect(html).toContain('Capacité de Combat');
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
