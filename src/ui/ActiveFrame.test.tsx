// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { setRule, resetRule } from '../engine/policy';
import { useGame, type BattleState } from '../state/store';
import { ActiveFrame } from './ActiveFrame';
import { ActionBar } from './ActionBar';
import type { Combatant } from '../engine/types';

const BASE_CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const c = (over: Partial<Combatant>) =>
  ({
    id: 'h', name: 'H', kind: 'hero', wounds: { current: 8, max: 12 }, conditions: [], advantage: 0,
    weapons: [], skills: [], items: [], movement: 4,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    characteristics: { ...BASE_CHARS },
    ...over,
  }) as unknown as Combatant;

describe('ActiveFrame — jauges crantées à taille fixe', () => {
  it('Avantage : toujours 10 crans, remplis = min(adv, 10)', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({ advantage: 13 })} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={2} moveMax={4} />);
    const adv = html.split('af-adv')[1].split('</span>')[0];
    expect((adv.match(/class="on"/g) ?? []).length).toBe(10); // clampé au plafond
    expect((adv.match(/class="(on|off)"/g) ?? []).length).toBe(10); // taille fixe
  });

  it('Mouvement : crans = budget du tour ; Action verticale présente pour un héros', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({})} ring="#fff" isHero actAvail={1} actMax={2} moveLeft={3} moveMax={5} />);
    const move = html.split('af-move')[1].split('</span>')[0];
    expect((move.match(/class="(on|off)"/g) ?? []).length).toBe(5);
    expect((move.match(/class="on"/g) ?? []).length).toBe(3);
    expect(html).toContain('af-action');
  });

  it('vie via la tuile-portrait UNIFIÉE : EXACTEMENT une surface de vie dans le cadre', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({})} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={0} moveMax={0} />);
    expect((html.match(/ptile-gauge/g) ?? []).length).toBe(1); // la vie vient de PortraitTile, une seule fois
  });

  it('ennemi : pas de jauges Action/Mouvement, mais vie + Avantage visibles', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({ kind: 'enemy', advantage: 2 })} ring="#f00" isHero={false} actAvail={0} actMax={0} moveLeft={0} moveMax={0} />);
    expect(html).not.toContain('af-action');
    expect(html).not.toContain('af-move');
    expect(html).toContain('ptile-gauge'); // vie via la tuile unifiée
    expect(html).toContain('af-adv');
  });
});

/** Le résumé de ressources SEUL (hors `title`/`aria-label` des jauges, qui portent déjà des `n/m`). */
const resources = (html: string) => {
  const after = html.split('Ressources du tour')[1];
  expect(after, 'aucune liste « Ressources du tour » rendue').toBeTruthy();
  return after.split('</dl>')[0];
};

describe('ActiveFrame — économie du tour nommée en texte', () => {
  it('Action / Mouvement / Avantage : libellé, valeur et aperçu avant → après', () => {
    const html = renderToStaticMarkup(
      <ActiveFrame
        c={c({ advantage: 2 })} ring="#fff" isHero
        actAvail={1} actMax={1} moveLeft={4} moveMax={4}
        spendAction={1} spendMove={2} gainAdv={1}
      />,
    );
    const dl = resources(html);
    expect(dl).toContain('Action');
    expect(dl).toContain('1 → 0');
    expect(dl).toContain('Mouvement');
    expect(dl).toContain('4 → 2');
    expect(dl).toContain('Avantage');
    expect(dl).toContain('2 → 3');
    expect(html).not.toContain('Réaction'); // le HUD n'invente aucune économie que le moteur ne porte pas
    expect(html).toContain('af-action'); // les jauges crantées restent
    expect(html).toContain('ptile-gauge');
  });

  it('sans aperçu : la valeur courante seule, avec son maximum', () => {
    const html = renderToStaticMarkup(
      <ActiveFrame c={c({ advantage: 2 })} ring="#fff" isHero actAvail={1} actMax={2} moveLeft={3} moveMax={5} />,
    );
    const dl = resources(html);
    expect(dl).toContain('1/2');
    expect(dl).toContain('3/5');
    expect(dl).not.toContain('→');
  });

  it('ressource à zéro : état TEXTUEL (utilisée / épuisé), pas seulement une couleur', () => {
    const html = renderToStaticMarkup(
      <ActiveFrame c={c({})} ring="#fff" isHero actAvail={0} actMax={1} moveLeft={0} moveMax={4} />,
    );
    const dl = resources(html);
    expect(dl).toContain('utilisée');
    expect(dl).toContain('épuisé');
    expect(dl).toContain('data-spent="true"');
  });

  it('Avantage au-dessus du plafond effectif : la valeur RÉELLE, jamais la valeur clampée', () => {
    setRule('combat-advantage-cap-bi', true); // plafond = Bonus d'Initiative (LDB 14 l.197)
    try {
      const html = renderToStaticMarkup(
        <ActiveFrame c={c({ advantage: 5 })} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={4} moveMax={4} />,
      );
      const dl = resources(html);
      expect(dl).toContain('5/3'); // Initiative 30 → BI 3 ; l'Avantage réel vaut 5
      expect(dl).not.toContain('3/3');
    } finally {
      resetRule('combat-advantage-cap-bi');
    }
  });

  it('plafond d’Avantage nul : aucune ligne Avantage (comme la jauge, qui ne rend rien)', () => {
    setRule('combat-advantage-cap-bi', true);
    try {
      const bi0 = c({ characteristics: { ...BASE_CHARS, initiative: 5 } }); // BI 0
      const html = renderToStaticMarkup(
        <ActiveFrame c={bi0} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={4} moveMax={4} />,
      );
      expect(resources(html)).not.toContain('Avantage');
      expect(html).not.toContain('af-adv');
    } finally {
      resetRule('combat-advantage-cap-bi');
    }
  });

  it('Mouvement bloqué (budget nul en début de tour) : aucune ligne Mouvement, aucun « épuisé »', () => {
    const html = renderToStaticMarkup(
      <ActiveFrame c={c({})} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={0} moveMax={0} />,
    );
    const dl = resources(html);
    expect(dl).not.toContain('Mouvement');
    expect(dl).not.toContain('épuisé');
  });

  it('aperçu sans effet (gain au plafond) : forme « n/m », jamais une flèche dégénérée', () => {
    const html = renderToStaticMarkup(
      <ActiveFrame c={c({ advantage: 10 })} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={4} moveMax={4} gainAdv={1} />,
    );
    const dl = resources(html);
    expect(dl).toContain('10/10');
    expect(dl).not.toContain('→');
  });

  it('dépense déjà consommée : « utilisée » sans flèche (0/1 − 1 ne rend rien)', () => {
    const html = renderToStaticMarkup(
      <ActiveFrame c={c({})} ring="#fff" isHero actAvail={0} actMax={1} moveLeft={4} moveMax={4} spendAction={1} />,
    );
    const dl = resources(html);
    expect(dl).toContain('0/1');
    expect(dl).toContain('utilisée');
    expect(dl).not.toContain('→');
  });
});

/** Barre d'action MONTÉE pour de vrai sur le store RÉEL (patron `createRoot`/`act` du repo) : c'est
 *  l'ÉCRAN qui est jugé. Le rendu SSR ne convient PAS ici — zustand sert son état INITIAL à
 *  `getServerSnapshot`, donc `battle` y vaut null et la barre ne monte pas. */
let host: HTMLDivElement;
let root: Root;

function monterActionBar() {
  const hero = c({
    id: 'grimm', label: 'Grimm', career: 'agitateur', pos: { x: 0, y: 0 },
    talents: [], traumas: [], engagedWith: [], size: 'moyenne', species: 'humains-reiklander', bodyShape: 'humanoide',
  }) as unknown as Combatant;
  useGame.setState({
    battle: {
      combatants: [hero], order: ['grimm'], baseOrder: ['grimm'], turn: 0, round: 1, action: null,
      selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
      log: [], over: null, preview: null,
    } as unknown as BattleState,
    mode: 'battle', party: [hero], pendingRoundStart: null, pendingAttack: null, pendingCast: null,
    pendingCleave: null, pendingDualStrike: null, pendingSiegeAim: null, hoverDelta: null,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
  act(() => { root.render(<ActionBar />); });
}

describe('ActionBar — l’identité du combattant actif est RENDUE', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useGame.setState({ battle: null, party: [], mode: 'menu' } as never);
  });

  it('nom en <strong> et carrière, dans le panneau latéral du cadre actif', () => {
    monterActionBar();
    const side = host.querySelector('.ab-actor-side');
    expect(side, 'aucun panneau latéral rendu').toBeTruthy();
    expect(side!.querySelector('strong')?.textContent).toBe('Grimm');
    expect(side!.textContent).toContain('Agitateur');
  });

  it('les contrôles du tour restent montés : slots et Fin du tour', () => {
    monterActionBar();
    expect(host.querySelector('.ab-slots'), 'aucune grille de slots rendue').toBeTruthy();
    expect(host.textContent).toContain('Fin du tour');
  });
});
