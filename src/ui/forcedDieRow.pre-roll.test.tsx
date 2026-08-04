// @vitest-environment jsdom
/**
 * Champ « Dé fixé » AVANT le jet, monté pour de VRAI (`RollRow` + `rowForcedDie`, le câblage exact
 * d'une modale : `CastModal` dérive le sélecteur pour ses rangées d'Opposition/Contre-sort). La saisie
 * doit LANCER le jet puis y substituer la valeur — un sélecteur pré-jet rendu sans déclencheur de jet
 * n'écrit nulle part (bug de recette : le champ était rendu mais mort sur ces rangées).
 * Patron réel du repo pour les tests interactifs : `createRoot`/`act` (pas de `@testing-library`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { seedBattleRng } from '../state/battleRng';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { rowForcedDie } from './forcedDieRow';
import { RollRow } from './RollRow';
import { Modal } from './Modal';
import { testPending } from './breakdown';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'X', name: 'X', label: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [],
    species: 'humains-reiklander',
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

const ATT = C({ id: 'A', label: 'Att', resilience: 2 });
const DEF = C({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 } });
/** Le MÊME combattant côté vue : le portrait de rangée compose un rig, dont l'arme de fixture (nom
 *  seul, hors registre) n'est pas résoluble — la vue n'en a pas besoin, le flux si. */
const VIEW = { ...ATT, weapons: [] } as Combatant;

/** Attaque NON LANCÉE (aucun résultat) : l'état exact d'une rangée pré-jet. */
function setupPreRoll() {
  seedBattleRng(7);
  useGame.setState({
    battle: { combatants: [ATT, DEF], log: [], order: ['A', 'B'], turn: 0, round: 1 } as never,
    pendingAttack: { attackerId: 'A', targetId: 'B', location: null, result: null } as never,
  });
}

/** Ce que fait le vrai résolveur quand on lance : pose un résultat (dé 88, raté). */
function resolveRoll() {
  const p = useGame.getState().pendingAttack!;
  useGame.setState({
    pendingAttack: {
      ...p,
      result: {
        hit: false, attackerRoll: 88, netSL: -4, critical: false, advantageTo: 'defender',
        defenderDefeated: false, log: 'raté',
        attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 88, success: false, sl: -4 },
      },
    } as never,
  });
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetDesFixes();
  useGame.setState({
    pendingAttack: null, pendingDefense: null, pendingCast: null, pendingTrample: null, battle: null,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  resetDesFixes();
});

/** UNE frappe dans un `<input type=number>` contrôlé par React (le commit ne s'y fait pas — #955). */
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Geste TERMINAL du champ : c'est LUI qui commet la valeur saisie. */
function pressEnter(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
}

/** Saisie CLAVIER complète : chaque caractère frappé l'un après l'autre, puis Entrée. */
function typeAndCommit(input: HTMLInputElement, value: string) {
  let acc = '';
  for (const ch of value) {
    acc += ch;
    type(input, acc);
  }
  pressEnter(input);
}

const dieInput = () => host.querySelector('input.rm-die-input') as HTMLInputElement | null;

describe('« Dé fixé » PRÉ-jet — le champ écrit vraiment (option ON, héros piloté)', () => {
  it('la saisie LANCE le jet puis substitue la valeur au d100', () => {
    setDesFixes(true);
    setupPreRoll();
    const calls: string[] = [];
    const die = rowForcedDie(
      useGame.getState(),
      'attack',
      { actor: ATT, rolled: false, interactive: true, onRoll: () => { calls.push('roll'); resolveRoll(); } },
      false,
    );
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled={false}
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
          onRoll={() => { calls.push('roll'); resolveRoll(); }}
        />,
      );
    });
    const input = dieInput();
    expect(input).not.toBeNull();
    typeAndCommit(input!, '33');
    expect(calls).toEqual(['roll']);
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(33);
    expect(useGame.getState().pendingAttack!.fixed).toBe(true);
  });

  it('commit TERMINAL (#955) : les frappes de « 50 » ne lancent RIEN ; Entrée lance UNE fois, avec 50', () => {
    setDesFixes(true);
    setupPreRoll();
    const calls: string[] = [];
    const onRoll = () => { calls.push('roll'); resolveRoll(); };
    const die = rowForcedDie(
      useGame.getState(),
      'attack',
      { actor: ATT, rolled: false, interactive: true, onRoll },
      false,
    );
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled={false}
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
          onRoll={onRoll}
        />,
      );
    });
    const input = dieInput()!;
    type(input, '5');
    type(input, '50');
    expect(calls, 'une frappe qui lance = le « 5 » de « 50 » résout le Test').toEqual([]);
    expect(useGame.getState().pendingAttack!.result, 'aucun jet ne doit exister avant le geste terminal').toBeNull();
    expect(input.value, 'la frappe reste lisible dans le champ tant qu’elle n’est pas commise').toBe('50');
    pressEnter(input);
    expect(calls, 'Entrée lance UNE fois').toEqual(['roll']);
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(50);
    expect(useGame.getState().pendingAttack!.fixed).toBe(true);
  });

  it('le champ est VIDE et s’annonce « Fixer le dé » — aucune valeur pré-remplie, aucune marque de provenance', () => {
    setDesFixes(true);
    setupPreRoll();
    const die = rowForcedDie(
      useGame.getState(),
      'attack',
      { actor: ATT, rolled: false, interactive: true, onRoll: () => resolveRoll() },
      false,
    );
    expect(die.forcedRoll!.roll, 'un « 1 » pré-rempli ment : rien n’est fixé avant la saisie').toBeNull();
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled={false}
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
          onRoll={() => resolveRoll()}
          onForce={() => {}}
        />,
      );
    });
    const input = dieInput()!;
    expect(input.value).toBe('');
    expect(input.getAttribute('placeholder')).toBeTruthy();
    // L'ÉTIQUETTE du champ est une OFFRE, jamais la marque « ce jet a été fixé ».
    expect(host.querySelector('.rm-die-pick > label')?.textContent).toContain('Fixer le dé');
    expect(host.textContent).not.toContain('Dé fixé');
    expect(host.querySelector('.prow-fixed-mark')).toBeNull();
    // Hiérarchie : le choix de RÈGLE (Résilience) précède l'offre de CONFORT dans la zone d'actions.
    const act0 = host.querySelector('.prow-act')!;
    const kids = [...act0.children];
    const iResil = kids.findIndex((k) => (k.textContent ?? '').includes('Résilience'));
    const iChamp = kids.findIndex((k) => k.classList.contains('rm-die-pick'));
    expect(iResil).toBeGreaterThanOrEqual(0);
    expect(iChamp).toBeGreaterThan(iResil);
  });

  it('POST-résolution fixée : UNE seule surface — l’étiquette du champ devient « Dé fixé », la pastille ne double pas', () => {
    setDesFixes(true);
    setupPreRoll();
    resolveRoll();
    useGame.getState().attackSetForcedRoll(33);
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: true, interactive: true, onRoll: null }, true);
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
        />,
      );
    });
    // Le champ PORTE la marque (libellé d'ÉTAT) et garde sa valeur éditable : pas de pastille en plus.
    const label = host.querySelector('.rm-die-pick > label')!;
    expect(label.textContent).toContain('Dé fixé');
    expect(label.textContent).not.toContain('Fixer le dé');
    expect((host.querySelector('input.rm-die-input') as HTMLInputElement).value).toBe('33');
    expect(host.querySelector('.prow-fixed-mark'), 'pastille EN PLUS du champ : deux surfaces pour un seul fait').toBeNull();
    expect((host.textContent ?? '').split('Dé fixé').length - 1).toBe(1);
  });

  it('sans déclencheur de jet, AUCUN champ pré-jet n’est rendu (jamais d’affordance morte)', () => {
    setDesFixes(true);
    setupPreRoll();
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: false, interactive: true, onRoll: null }, false);
    expect(die.forcedRoll).toBeUndefined();
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled={false}
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
        />,
      );
    });
    expect(dieInput()).toBeNull();
  });

  it('UNE seule marque « Dé fixé » à l’écran : l’en-tête du sélecteur, pas un doublon de rangée', () => {
    setDesFixes(true);
    setupPreRoll();
    resolveRoll();
    useGame.getState().attackSetForcedRoll(33);
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: true, interactive: true, onRoll: null }, true);
    expect(die.fixedMark).toBe(true);
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
        />,
      );
    });
    const occurrences = (host.textContent ?? '').split('Dé fixé').length - 1;
    expect(occurrences).toBe(1);
  });
});

/** jsdom ne calcule aucune géométrie : sans rect non nul, `Modal` juge le bouton primaire invisible
 *  et son raccourci Entrée ne partirait JAMAIS — le test passerait pour la mauvaise raison. */
function makeVisible(el: HTMLElement) {
  el.getClientRects = (() => [{ width: 80, height: 24 }] as unknown as DOMRectList) as HTMLElement['getClientRects'];
}

describe('« Dé fixé » PRÉ-jet — le champ DANS une vraie modale', () => {
  /** Le câblage complet : `Modal` (son écouteur Entrée au document) + la rangée + son sélecteur. */
  function mountInModal(onRoll: () => void, applies: string[]) {
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: false, interactive: true, onRoll }, false);
    act(() => {
      root.render(
        <Modal title="Attaque" variant="roll">
          <RollRow
            actor={VIEW}
            row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
            rolled={false}
            interactive
            forcedRoll={die.forcedRoll}
            fixedMark={die.fixedMark}
            rollFrisson={false}
            onRoll={onRoll}
          />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => applies.push('apply')}>Appliquer</button>
          </div>
        </Modal>,
      );
    });
    makeVisible(host.querySelector<HTMLElement>('.modal-actions .btn-primary')!);
    return dieInput()!;
  }

  it('Entrée pose le dé et RIEN d’autre : un jet à 50, zéro clic sur l’action primaire', () => {
    setDesFixes(true);
    setupPreRoll();
    const calls: string[] = [];
    const applies: string[] = [];
    const input = mountInModal(() => { calls.push('roll'); resolveRoll(); }, applies);
    act(() => input.focus());
    expect(document.activeElement, 'la frappe doit partir DU champ').toBe(input);
    typeAndCommit(input, '50');
    expect(calls, 'Entrée lance UNE fois').toEqual(['roll']);
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(50);
    expect(applies, 'Entrée validerait la modale PAR-DESSUS le dé posé').toEqual([]);
  });

  it('quitter le champ sans Entrée ne lance RIEN : le brouillon retombe, aucun dé n’est posé', () => {
    setDesFixes(true);
    setupPreRoll();
    const calls: string[] = [];
    const input = mountInModal(() => { calls.push('roll'); resolveRoll(); }, []);
    act(() => input.focus());
    type(input, '5');
    type(input, '50');
    act(() => { input.blur(); input.dispatchEvent(new FocusEvent('blur', { bubbles: false })); });
    expect(calls, 'le blur COMMET = cliquer « Annuler » roule le dé qu’on annule').toEqual([]);
    expect(useGame.getState().pendingAttack!.result, 'aucun jet ne doit exister').toBeNull();
    expect(input.value, 'le brouillon abandonné revient à la dernière valeur commise (aucune)').toBe('');
  });
});
