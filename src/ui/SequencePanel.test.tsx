// @vitest-environment jsdom
/**
 * LE TABLEAU DE MARQUE (#1279 S1) — monté POUR DE VRAI dans la fenêtre de manche (`CascadeBody`,
 * patron `CascadeTableMode.test.tsx`) sur une partie de Bras de fer réelle. Mesuré AVANT ce lot : la
 * fenêtre d'une manche ne disait NI le score, NI le rang de manche (les cumuls vivent dans l'état de
 * séquence, que rien ne rendait) — une partie de six manches était aveugle.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from '../state/battleRng';
import { CascadeBody } from './CascadeModal';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
const get = useGame.getState.bind(useGame);

function render() {
  act(() => { root.render(<CascadeBody />); });
}

/** Pose le DR de chaque rangée de la manche ouverte, puis la clôt (aucun dé : l'affichage est en cause). */
function poseManche(sl: Record<string, number>): void {
  const pc = get().pendingCascade!;
  const band = pc.participants[0];
  const rows = band.participants!.map((r) => ({
    ...r, result: { roll: 11, target: r.target!, sl: sl[r.id], success: true },
  }));
  act(() => {
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants: rows }] } });
    get().cascadeNext();
  });
}

const board = () => host.querySelector('[data-seq-board]');
const bandeTitre = () => host.querySelector('.creator-band-head h3')?.textContent ?? '';
const compteur = () => host.querySelector('.creator-band-right')?.textContent ?? '';
const texte = () => host.textContent ?? '';

beforeEach(() => {
  seedBattleRng(3);
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, sequence: null } as never);
});

describe('SequencePanel — une partie de Bras de fer n’est plus aveugle', () => {
  function partie(): [Combatant, Combatant] {
    const [a, b] = makePregens().slice(0, 2) as [Combatant, Combatant];
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    return [a, b];
  }

  it('la fenêtre de manche PORTE le score des deux camps, la cible et le rang de manche', () => {
    const [a, b] = partie();
    render();
    expect(board(), 'le tableau de marque est monté dans la fenêtre').not.toBeNull();
    expect(bandeTitre()).toContain('Le bras de fer');
    expect(compteur()).toContain('Manche 1');
    expect(texte(), 'les deux camps sont nommés').toContain(a.label);
    expect(texte()).toContain(b.label);
    expect(texte(), 'cumul sur la cible du Test étendu (l.34)').toContain('0/10 DR');

    poseManche({ [a.id]: 4, [b.id]: 1 });
    render();
    expect(compteur(), 'la manche a avancé').toContain('Manche 2');
    // Le cumul MONTRÉ est celui de l'état de séquence (DR de la manche + Bonus de Force, l.34).
    const cum = get().sequence!.cum as Record<string, number>;
    expect(cum.player).toBeGreaterThan(0);
    expect(texte()).toContain(`${cum.player}/10 DR`);
    expect(texte()).toContain(`${cum.opponent}/10 DR`);
  });

  it('aucune séquence en cours : aucun tableau de marque (la fenêtre n’invente pas de score)', () => {
    const [a] = makePregens().slice(0, 1) as [Combatant];
    useGame.setState({ party: [a] });
    // Dominos contre la salle : une manche UNIQUE sans cible de cumul — rien à suivre d'une manche à
    // l'autre (un jeu de LANCERS, lui, a un passage en cours à montrer : il porte un tableau).
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'abstract', value: 40 } });
    render();
    expect(get().pendingCascade, 'la fenêtre de manche est bien ouverte').not.toBeNull();
    expect(board()).toBeNull();
  });

  /** JEU D'ÉQUIPE (Middenball l.121) : le tableau de marque dit les BUTS de chaque camp et, en note,
   *  la SOMME de DR du dernier tour — celle qui décide le but. Le panneau ne dérive rien : ces deux
   *  grandeurs viennent du `board` du système. */
  it('Middenball : le tableau de marque porte le score PAR ÉQUIPE (buts) et la somme du tour', () => {
    const party = makePregens().slice(0, 2) as Combatant[];
    useGame.setState({ party });
    get().playTavernGame({ gameId: 'middenball', challengerId: party[0].id, opponent: { kind: 'abstract', value: 35 } });
    // Un tour joué : options tranchées, puis 11 rangées à 3 DR contre 11 à 1 DR.
    for (let i = 0; i < 4; i++) {
      const cur = get().pendingCascade?.participants[get().pendingCascade!.cursor];
      if (!cur || cur.kind !== 'tavern-option') break;
      act(() => { get().cascadeChoose(cur.id, '0'); get().cascadeNext(); });
    }
    const pc = get().pendingCascade!;
    const idx = pc.participants.findIndex((s) => s.kind === 'tavern-round');
    const band = pc.participants[idx];
    const rows = band.participants!.map((r) => ({
      ...r, result: { roll: 11, target: r.target!, sl: r.id.startsWith('figurant-o-') ? 1 : 3, success: true },
    }));
    const participants = [...pc.participants];
    participants[idx] = { ...band, participants: rows };
    act(() => {
      useGame.setState({ pendingCascade: { ...pc, participants, cursor: idx } });
      get().cascadeNext();
    });
    render();

    expect(board(), 'le tableau de marque est monté').not.toBeNull();
    expect(bandeTitre()).toContain('Middenball');
    expect(compteur(), 'six tours, deux mi-temps').toContain('Manche 2/6');
    expect(compteur()).toContain('phase 1/2');
    expect(texte()).toContain('Votre équipe');
    expect(texte(), 'la SOMME du tour est dite en note').toContain('33 DR au dernier tour');
    expect(texte()).toContain('11 DR au dernier tour');
    const buts = [...host.querySelectorAll('[data-seq-score] b')].map((n) => n.textContent);
    expect(buts, 'un but pour le camp qui a dépassé 25, aucun pour l’autre').toEqual(['1', '0']);
  });
});
