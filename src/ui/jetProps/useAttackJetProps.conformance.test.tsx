// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { Combatant, Weapon } from '../../engine/types';
import { openAttackCascade } from '../../state/combatFlow';
import { useGame, type BattleState } from '../../state/store';
import { testScene } from '../../scenes/test-fixture';
import { RollShell } from '../RollShell';
import { useAttackJetProps } from './useAttackJetProps';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const characteristics = {
  'capacite-de-combat': 45,
  'capacite-de-tir': 40,
  force: 35,
  endurance: 35,
  initiative: 30,
  agilite: 40,
  dexterite: 30,
  intelligence: 30,
  'force-mentale': 30,
  sociabilite: 30,
};
const sword = {
  name: 'Épée',
  label: 'Épée',
  type: 'melee',
  damage: { plusBF: true, flat: 0, bare: true },
  uid: 'sword',
  qualities: [],
} as unknown as Weapon;

function combatant(id: string, label: string, kind: 'hero' | 'enemy', x: number): Combatant {
  return {
    id,
    name: label,
    label,
    kind,
    characteristics: { ...characteristics },
    conditions: [],
    traumas: [],
    engagedWith: [],
    skills: [],
    talents: [],
    items: [],
    weapons: [sword],
    advantage: 0,
    size: 'moyenne',
    pos: { x, y: 0 },
    wounds: { current: 18, max: 18 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    species: 'humains-reiklander',
    bodyShape: 'humanoide',
    movement: 4,
  } as unknown as Combatant;
}

function Probe() {
  const props = useAttackJetProps();
  return props ? <RollShell {...props} /> : null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

function renderAttack(): HTMLDivElement {
  const attacker = combatant('attacker', 'Elsa', 'hero', 0);
  const target = combatant('target', 'Gobelin', 'enemy', 1);
  const battle = {
    combatants: [attacker, target],
    order: [attacker.id, target.id],
    baseOrder: [attacker.id, target.id],
    turn: 0,
    round: 1,
    action: null,
    selectedSpellId: null,
    reachable: new Map(),
    movementUsed: 0,
    movedPreAction: false,
    acted: false,
    log: [],
    over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle,
    mode: 'battle',
    scene: testScene,
    pendingAttack: null,
    pendingCascade: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
  });
  openAttackCascade(
    useGame.getState,
    useGame.setState,
    { attackerId: attacker.id, targetId: target.id, location: null, result: null, weaponUid: sword.uid },
    'Attaque',
    'action/attack',
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Probe />));
  return host;
}

describe('Attaque — contrat d’affichage Z0–Z15', () => {
  it('rend une seule modale avec le titre nu, le sous-titre composé et un unique A→B', () => {
    const view = renderAttack();
    const dialogs = view.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].querySelector('h3')?.textContent).toBe('Attaque');
    expect(dialogs[0].querySelector('.rm-subtitle')?.textContent).toBe('Elsa — Attaque (Corps à corps)');
    expect(dialogs[0].querySelectorAll('.rm-vs')).toHaveLength(1);
    expect(dialogs[0].textContent).not.toContain('Round 1');
    expect(dialogs[0].textContent).not.toContain('Groupe');
  });
});
