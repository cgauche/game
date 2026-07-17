// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combatant } from '../engine/types';
import { AdvancementPanel, CharacterSheet } from './CharacterSheet';
import { BackgroundPanel } from './BackgroundPanel';
import { casterTalents } from '../engine/grimoire';
import { useGame } from '../state/store';

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

describe('CharacterSheet — colonne PRÉSENCE (#492 arbitrage 2026-07-17)', () => {
  // Rendu CLIENT (jsdom + createRoot), pas `renderToStaticMarkup` : la fiche lit `useGame` en
  // continu (hero courant, onglet…) — la snapshot SERVEUR de `useSyncExternalStore` ne reflète pas
  // un `useGame.setState` fait juste avant un rendu SSR (le hook lirait l'état INITIAL du store,
  // pas le nôtre) ; un montage client s'abonne réellement au store, comme en jeu.
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  function mount(node: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(node); });
    return container.innerHTML;
  }
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('la colonne rend la figurine en pied + Blessures, sans compagnie/caracs/ressources', () => {
    const h = hero();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    const html = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    expect(html).toContain('sheet-portrait');
    expect(html).toContain('charprev'); // figurine en pied (CharacterPreview), plus de médaillon PortraitTile
    expect(html).toContain('Blessures');
    expect(html).not.toContain('frame-row'); // rangée de compagnie MORTE dans la fiche (pt.2)
    expect(html).not.toContain('Caractéristiques'); // caracs SORTIES de la colonne (déplacées en tête de Compétences)
    expect(html).not.toContain('Destin'); // ressources (FateChips) SORTIES de la colonne
  });

  it('boîte-figurine grand format (`FigTile fig="hero"`) + arc de vie intégré, plaque « Blessures » MORTE, colonne à structure figée (#492 lot « colonne présence »)', () => {
    const h = hero();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'possessions' });
    mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    const aside = container.querySelector('.sheet-aside')!;
    expect(aside.querySelector('.fig-tile.hero')).toBeTruthy(); // rig GRAND FORMAT (plus `lg`/`spotlight`)
    const arc = aside.querySelector('.vital-arc');
    expect(arc).toBeTruthy(); // arc de vie SOUS la boîte-figurine, remplace la plaque
    expect(arc?.textContent).toContain('12');
    expect(arc?.textContent).toContain('Blessures');
    expect(aside.innerHTML).not.toContain('title="Blessures"'); // ancienne plaque (`.stat-chip.pv`) MORTE
    // structure figée : SANS alarme ni Soins éligibles, la colonne n'a qu'UN enfant direct (le bloc
    // portrait figurine+arc+identité) — un enfant de plus signalerait un ajout non voulu (scroll de fait).
    expect(aside.children.length).toBe(1);
  });

  it('l’arc de vie VIT : re-rend au switch de héros et après un soin (ratio/teinte suivent `hero.wounds`)', () => {
    const blesse = { ...hero(), wounds: { current: 4, max: 12 } } as Combatant;
    useGame.setState({ party: [blesse], battle: null, sheetId: blesse.id, sheetTab: 'possessions' });
    mount(<CharacterSheet heroId={blesse.id} onClose={() => {}} />);
    let arc = container.querySelector('.sheet-aside .vital-arc');
    expect(arc?.textContent).toContain('4');
    expect(arc?.textContent).toContain('/ 12');

    // Soin (mutation directe du party courant) : la fiche relit `useGame`, l'arc doit suivre.
    act(() => {
      useGame.setState((s) => ({ party: s.party.map((c) => (c.id === blesse.id ? { ...c, wounds: { current: 9, max: 12 } } : c)) }));
    });
    arc = container.querySelector('.sheet-aside .vital-arc');
    expect(arc?.textContent).toContain('9');
    expect(arc?.textContent).toContain('/ 12');
  });

  it('tête de l’onglet Compétences & Talents : CharStatsGrid + Mouvement + Destin·Chance/Résilience·Détermination', () => {
    const h = { ...hero(), fate: 2, fortune: 1, resilience: 1, resolve: 0 } as Combatant;
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'competences' });
    const html = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    expect(html).toContain('char-stats'); // CharStatsGrid
    expect(html).toContain('Mouvement');
    expect(html).toContain('Destin');
  });

  it('premier onglet = Compétences & Talents (ordre + défaut d’ouverture, arbitrage 2026-07-17)', () => {
    const h = hero();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: null, sheetAlarmsSeen: {} });
    const html = mount(<CharacterSheet heroId={h.id} onClose={() => {}} />);
    const tabnav = container.querySelector('.sheet-tabnav')!;
    const firstTab = tabnav.querySelector('[role="tab"]');
    expect(firstTab?.textContent).toContain('Compétences & Talents');
    // Défaut (aucune alarme sur ce héros sain) : l'onglet Compétences & Talents s'affiche, pas État.
    expect(html).toContain('char-stats');
    expect(firstTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('règle d’atterrissage inchangée : une alarme NOUVELLE force toujours l’onglet État', () => {
    const alarme = { ...hero(), corruption: 3 } as Combatant;
    useGame.setState({ party: [alarme], battle: null, sheetId: alarme.id, sheetTab: null, sheetAlarmsSeen: {} });
    mount(<CharacterSheet heroId={alarme.id} onClose={() => {}} />);
    expect(useGame.getState().sheetTab).toBe('etat');
  });

  it('gangrène du cadre : `data-corruption` posé selon le seuil de Corruption', () => {
    const clean = hero();
    useGame.setState({ party: [clean], battle: null, sheetId: clean.id, sheetTab: 'etat' });
    const htmlClean = mount(<CharacterSheet heroId={clean.id} onClose={() => {}} />);
    expect(htmlClean).toContain('data-corruption="none"');

    // BFM/BE = 30 → bonus 3 chacun, seuil = 6 : 3 Points de Corruption reste SOUS le seuil (« ronge »).
    const corrupted = { ...hero(), corruption: 3 } as Combatant;
    useGame.setState({ party: [corrupted], battle: null, sheetId: corrupted.id, sheetTab: 'etat' });
    const htmlCorrupted = mount(<CharacterSheet heroId={corrupted.id} onClose={() => {}} />);
    expect(htmlCorrupted).toContain('data-corruption="ronge"');
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
