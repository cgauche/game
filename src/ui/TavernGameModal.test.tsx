// @vitest-environment jsdom
/**
 * La table de taverne ouverte par le PNJ qui PROPOSE la partie (`SceneEntity.tavernGame`, `NADJ 04 l.72`) :
 * elle s'ouvre sur SON offre, et elle CÈDE à la modale de jet tant que l'arbitre en tient une — une
 * situation = une modale (`docs/ajouter-un-flux-de-jet.md`).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { useGame } from '../state/store';
import { pregenParty, PREGEN } from '../data/pregens';
import { setRule, resetRule } from '../engine/policy';
import { seedBattleRng } from '../state/battleRng';
import { pickActiveModalKey } from '../state/modalArbiter';
import { scenario } from '../scenes/test-scenarios/taverne-profil-standard';
import { TavernGameModal } from './TavernGameModal';
import { ActiveModal } from './ActiveModal';

const PNJ = 'habitue-bras-de-fer';
const g = useGame.getState;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  useGame.setState(useGame.getInitialState(), true);
  setRule('tavern-games', true);
  seedBattleRng(7);
  const dlg = scenario.scene.dialogues.find((d) => d.id === 'dlg-bras-de-fer')!;
  useGame.setState({
    party: pregenParty(PREGEN.soldat, PREGEN.chasseur),
    scene: scenario.scene,
    dialogue: { dialogue: dlg, nodeId: dlg.start, speakerId: PNJ },
  } as never);
});
afterEach(demonterRacines);
afterAll(() => { resetRule('tavern-games'); });

/** Le joueur choisit « Relever le défi. » dans le dialogue du PNJ — le geste réel. */
const releverLeDefi = () => act(() => { g().chooseDialogue(0); });

describe('Taverne — la table s’ouvre sur l’offre du PNJ qui la propose', () => {
  it('le choix du dialogue ouvre la table AU NOM du proposeur', () => {
    releverLeDefi();
    expect(g().tavernGames?.npcId).toBe(PNJ);
  });

  it('le jeu OFFERT et son offreur sont présélectionnés à l’écran', () => {
    releverLeDefi();
    const { container } = monterRacine(<TavernGameModal />);
    const texte = container.ownerDocument.body.textContent ?? '';
    expect(texte).toContain('Habitué de la salle : valeur de jeu 30');
    expect(texte).toContain('Test opposé : Force');
  });
});

describe('Taverne — une situation = une modale', () => {
  it('pendant la manche, seule la modale de jet est à l’écran : la table cède', () => {
    releverLeDefi();
    const [soldat] = g().party;
    act(() => { g().playTavernGame({ gameId: 'bras-de-fer', challengerId: soldat.id, opponent: { kind: 'npc', id: PNJ } }); });
    expect(pickActiveModalKey(g()), 'l’arbitre tient la manche').toBe('cascade');
    monterRacine(<><ActiveModal /><TavernGameModal /></>);
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1);
    expect(document.querySelector('.tavern-modal')).toBeNull();
  });
});
