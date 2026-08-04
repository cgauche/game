import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveRender } from './bodyPlan';
import { entityRigProfileFor } from './enemyProfile';
import { pickBackend } from '../pickBackend';
import { resetDiagOnce } from './devDiag';
import { useGame } from '../../state/store';
import type { Scene, SceneEntity } from '../../state/scene';

/**
 * Les sites de diagnostic du pipeline de rendu sont rappelés à deux régimes : les tokens de COMBAT sont
 * rebâtis hors memo à chaque rendu du stage (`combatantObjs`, IsoStage.tsx:313), soit ~60/s pendant une
 * marche ; les FIGURANTS passent par un memo (`figurantObjs`, IsoStage.tsx:257) et se rejouent au pas ou
 * au changement d'état de combat. Le diagnostic d'un défaut de donnée se dit UNE FOIS PAR SUJET — et
 * TOUS les sujets défectueux parlent, y compris ceux qui n'ont aucune réf à se mettre sous la clé (#936).
 */
const ent = (id: string): SceneEntity => ({ id, kind: 'personnage', pos: { x: 0, y: 0 }, label: 'Sans espèce' });

describe('diagnostics de rendu — une fois par sujet, jamais par frame (#936)', () => {
  let err: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetDiagOnce();
    err = vi.spyOn(console, 'error').mockImplementation(() => {});
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    err.mockRestore();
    warn.mockRestore();
  });

  it('60 résolutions du MÊME sujet sans espèce (une seconde de rendu) → 1 seul [bodyPlan]', () => {
    for (let i = 0; i < 60; i++) resolveRender(undefined, undefined, 'sujet-sans-espece');
    expect(err).toHaveBeenCalledTimes(1);
  });

  it('un sujet AUTRE se dit toujours (la mémoire est par sujet, pas une fenêtre de temps)', () => {
    resolveRender(undefined, undefined, 'sujet-a');
    resolveRender(undefined, undefined, 'sujet-b');
    resolveRender(undefined, undefined, 'sujet-a');
    expect(err).toHaveBeenCalledTimes(2);
  });

  it('60 rendus de la MÊME entité sans réf ni Espèce → 1 seul [rig]', () => {
    for (let i = 0; i < 60; i++) entityRigProfileFor(ent('figurant-muet'));
    expect(err.mock.calls.filter((c) => String(c[0]).startsWith('[rig]'))).toHaveLength(1);
  });

  it('60 pickBackend d’une entité à ref irrésoluble → 1 seul [pickBackend]', () => {
    const e: SceneEntity = { ...ent('ref-cassee'), ref: 'ref-totalement-inconnue' };
    for (let i = 0; i < 60; i++) pickBackend({ kind: 'sceneEntity', ent: e });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  // Collision de clés : sans sujet posé, TOUS les personnages sans réf partagent la même clé (vide) et
  // un seul parle — 12 défauts sur 13 muets à la mesure. La clé porte donc `<scène>/<idEntité>`.
  it('13 personnages SANS réf d’une même scène → 13 [bodyPlan] (aucun sujet avalé par le premier)', () => {
    useGame.setState({ scene: { id: 'scene-a' } as Scene });
    for (let i = 0; i < 13; i++) pickBackend({ kind: 'sceneEntity', ent: ent(`muet-${i}`) });
    const dits = err.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[bodyPlan]'));
    expect(dits).toHaveLength(13);
    expect(new Set(dits).size).toBe(13); // chaque message NOMME son sujet
  });

  it('le MÊME id d’entité dans DEUX scènes → 2 [bodyPlan] (les ids ne sont uniques que par scène)', () => {
    useGame.setState({ scene: { id: 'echeance' } as Scene });
    pickBackend({ kind: 'sceneEntity', ent: ent('aubergiste') });
    useGame.setState({ scene: { id: 'marche-equipement' } as Scene });
    pickBackend({ kind: 'sceneEntity', ent: ent('aubergiste') });
    expect(err.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[bodyPlan]'))).toHaveLength(2);
  });
});
