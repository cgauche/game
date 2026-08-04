// @vitest-environment jsdom
/**
 * #1078 LOT B2 (correction de contrat, décision utilisateur 2026-08-04) — l'A→B d'une fenêtre de jet
 * est le BANDEAU canonique (`VsHeader` : portraits + flèche annotée), jamais une phrase « A écrase B ».
 * Le Piétinement (LDB 85 l.320) est un VRAI face-à-face entre deux `Combatant` : contrat mesuré à
 * l'ÉCRAN (montage réel, patron `createRoot`/`act` du repo). Le COÛT annoncé sur la flèche est un
 * prérequis de RESSOURCE (jamais un modificateur de la ligne) et suit « Se cabrer » (l.314).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { RollShell } from './RollShell';
import { useTrampleJetProps } from './jetProps/useTrampleJetProps';
import { BattementModal } from './BattementModal';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, label: id, kind: 'enemy', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 2, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 0, fortune: 0,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4, traits: [],
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

function TrampleHost() {
  const props = useTrampleJetProps();
  return props ? <RollShell {...props} /> : null;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, pendingTrample: null, pendingBattement: null } as never);
});

const screen = () => (host.textContent ?? '').replace(/\s+/g, ' ');

const open = (movementUsed = 0) => {
  const beast = mk('Destrier');
  const prey = mk('Fantassin', { kind: 'hero' } as Partial<Combatant>);
  useGame.setState({
    battle: { combatants: [beast, prey], movementUsed, over: false },
    pendingTrample: { attackerId: beast.id, targetId: prey.id, result: null },
  } as never);
  act(() => root.render(<TrampleHost />));
};

describe('Piétinement — l’A→B est le bandeau, pas une phrase', () => {
  it('bandeau `VsHeader` complet (portraits + flèche), aucun « X écrase Y »', () => {
    open();
    const vs = host.querySelectorAll('.rm-vs');
    expect(vs, 'un bandeau d’opposition, un seul').toHaveLength(1);
    expect(vs[0].children, 'A → B : les deux portraits encadrent la flèche').toHaveLength(3);
    expect(screen(), 'plus aucun A→B TEXTUEL').not.toContain('écrase');
  });

  it('le COÛT est annoncé sur la flèche (1 Avantage — LDB 85 l.320)', () => {
    open();
    expect(host.querySelector('.rm-vs-arrow')?.textContent?.replace(/\s+/g, ' ')).toContain('Piétinement · coûte 1 Avantage');
  });
});

/**
 * COÛT du Piétinement — le libellé de la flèche EST la voie de paiement (prédicat partagé
 * `trampleFreeMove`, `state/combatFlow`) : « Se cabrer » (LDB 85 l.314, trait `se-cabrer` : « Pour une
 * Action de Mouvement… ») n'ouvre la voie gratuite que si l'Action de Mouvement est ENTIÈRE. Un écran
 * qui annonçait « coûte 1 Avantage » sans rien débiter est le défaut verrouillé ici.
 */
describe('Piétinement — le coût annoncé est le coût PAYÉ', () => {
  const arrow = () => (host.querySelector('.rm-vs-arrow')?.textContent ?? '').replace(/\s+/g, ' ');
  const openCabrer = (movementUsed: number) => {
    const beast = mk('Destrier', { traits: [{ id: 'se-cabrer' }] } as unknown as Partial<Combatant>);
    const prey = mk('Fantassin');
    useGame.setState({
      battle: { combatants: [beast, prey], movementUsed, over: false },
      pendingTrample: { attackerId: beast.id, targetId: prey.id, result: null },
    } as never);
    act(() => root.render(<TrampleHost />));
  };

  it('Se cabrer + Action de Mouvement ENTIÈRE : la voie gratuite est annoncée', () => {
    openCabrer(0);
    expect(arrow()).toContain('coûte une Action de Mouvement');
  });

  it('Se cabrer mais Mouvement DÉJÀ dépensé : retour à la voie ordinaire (1 Avantage)', () => {
    openCabrer(3);
    expect(arrow()).toContain('coûte 1 Avantage');
  });
});

/**
 * Battement (LDB 10 l.103 / AA 13 l.17) — Action de Corps à corps contre un adversaire : VRAI
 * face-à-face entre deux `Combatant`, donc bandeau, jamais « X bat l'arme de Y ».
 */
describe('Battement — l’A→B est le bandeau, pas une phrase', () => {
  it('bandeau complet + coût annoncé sur la flèche ; aucune phrase composée', () => {
    const attacker = mk('Bretteur', { kind: 'hero' } as Partial<Combatant>);
    const foe = mk('Rufian');
    useGame.setState({
      battle: { combatants: [attacker, foe], over: false },
      pendingBattement: { attackerId: attacker.id, foeId: foe.id, result: null },
    } as never);
    act(() => root.render(<BattementModal />));
    const vs = host.querySelectorAll('.rm-vs');
    expect(vs, 'un bandeau d’opposition, un seul').toHaveLength(1);
    expect(vs[0].children, 'A → B : les deux portraits encadrent la flèche').toHaveLength(3);
    expect(host.querySelector('.rm-vs-arrow')?.textContent).toContain('Battement');
    expect(screen(), 'plus aucun A→B TEXTUEL').not.toContain("bat l'arme de");
  });
});
