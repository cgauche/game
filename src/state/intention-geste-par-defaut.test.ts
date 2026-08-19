/**
 * UNE INTENTION ARMÉE NE CHANGE RIEN AU GESTE DU CHAMP (#1411, P0-A).
 *
 * Arbitrage fondateur (utilisateur, 2026-08-16, verbatim, cf. `localIntent.ts` en-tête) : « Ca ne
 * change pas les actions par défaut sur le grid comme le déplacement/attaque, ou la charge/course,
 * c'est juste pour qu'on les selectionner volontairement depuis l'interface. Car actuellement pour
 * charger, il est difficile de connaitre la distance. »
 *
 * L'intention est donc un AFFICHAGE de portée, et rien d'autre : elle vaut confirmation du clic (la
 * case a été choisie sciemment) et se dissout, mais elle n'ARBITRE aucun geste. Ce contrat POSITIF
 * verrouille les trois faces de cette non-intervention, celles qu'une « loi du refus » cassait :
 *  (a) le geste par défaut de la case cliquée se commet, quelle que soit l'intention armée ;
 *  (b) un MODE DE CIBLAGE actif (téléportation, poussée, pose de zone…) garde son commit-CASE ;
 *  (c) la Course armée sur une case lointaine part bien en Course.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { computeRunReach, displayedReach } from './combatFlow';
import { runAction } from './actionRegistry';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

/** Même combat témoin que `intention-portee.test.ts` : un héros au tour ENTIER, ennemis parqués loin. */
function setup() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'enemy')) e.pos = { x: 20 + i++, y: 20 };
  H.pos = { x: 6, y: 10 };
  const turn = b.order.indexOf(H.id);
  useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false, preview: null }, localIntent: null });
  return { H };
}

const get = () => useGame.getState();

/** Une case de la zone de COURSE hors de la Marche. */
function caseDeCourse(): { x: number; y: number } {
  const marche = displayedReach(get);
  const k = [...computeRunReach(get).keys()].find((c) => !marche.has(c))!;
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

beforeEach(() => {
  useGame.setState({ battle: null, pendingAttack: null, pendingRun: null, pendingCascade: null, localIntent: null });
});

describe('(a) le geste par défaut de la case se commet, quelle que soit l’intention armée', () => {
  it('Charge armée + case de la zone de COURSE → la Course s’ouvre, comme sans intention', () => {
    setup();
    const loin = caseDeCourse();
    runAction('charge', get);
    get().battleClickTile(loin);
    expect(get().pendingRun ?? get().pendingCascade, 'le geste par défaut du champ a été ARBITRÉ par l’intention').toBeTruthy();
    expect(get().localIntent, 'le clic dissout l’intention (elle a servi : montrer la portée)').toBeNull();
  });

  it('Charge armée + case de MARCHE → le Mouvement se commet, comme sans intention', () => {
    const { H } = setup();
    const [x, y] = [...displayedReach(get).keys()].map((k) => k.split(',').map(Number)).find(([a, b]) => a !== 6 || b !== 10)!;
    runAction('charge', get);
    get().battleClickTile({ x, y });
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x, y });
    expect(get().localIntent).toBeNull();
  });

  it('la MÊME case, SANS intention, donne exactement le même geste (l’intention n’ajoute que la confirmation)', () => {
    const { H } = setup();
    const [x, y] = [...displayedReach(get).keys()].map((k) => k.split(',').map(Number)).find(([a, b]) => a !== 6 || b !== 10)!;
    get().battleClickTile({ x, y }, { confirm: true });
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x, y });
  });
});

describe('(b) un MODE DE CIBLAGE garde son commit-CASE sous une intention armée', () => {
  it('mode Téléportation + intention de Mouvement armée : la case du MODE se commet (hors portée de Marche comprise)', () => {
    const { H } = setup();
    const b = get().battle!;
    const dest = { x: 19, y: 3 }; // très loin : jamais dans la portée peinte par l'intention
    expect(displayedReach(get).has(`${dest.x},${dest.y}`), 'témoin : la case est bien hors de la Marche').toBe(false);
    runAction('mouvement', get);
    useGame.setState({ battle: { ...b, action: 'teleport', reachable: new Map([[`${dest.x},${dest.y}`, 1]]) } });
    get().battleClickTile(dest);
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'le commit-CASE du mode n’a pas été atteint').toEqual(dest);
    expect(get().battle!.action, 'le mode ne s’est pas refermé : son commit n’a pas tourné').toBeNull();
  });
});

describe('(c) chaque intention laisse passer SON geste', () => {
  it('Course armée + case lointaine → Course réelle', () => {
    setup();
    const loin = caseDeCourse();
    runAction('course', get);
    get().battleClickTile(loin);
    expect(get().pendingRun ?? get().pendingCascade).toBeTruthy();
    expect(get().localIntent).toBeNull();
  });

  it('Mouvement armé + case de Marche → déplacement, sans second tap', () => {
    const { H } = setup();
    const [x, y] = [...displayedReach(get).keys()].map((k) => k.split(',').map(Number)).find(([a, b]) => a !== 6 || b !== 10)!;
    runAction('mouvement', get);
    get().battleClickTile({ x, y });
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x, y });
  });
});
