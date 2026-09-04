import { describe, it, expect } from 'vitest';
import { scenario } from './ecuries-clayonnage';
import { scenario as diligence } from './diligence';
import { lineOfSightCover, type LosMemo } from '../../state/lineOfSight';
import { wallBetween, areteOcculteEntre, structureAt, type Scene } from '../../state/scene';
import type { Pt } from '../../state/path';
import { useGame } from '../../state/store';
import { buildAiInput } from '../../state/combatFlow';
import { chooseEnemyAction } from '../../state/ai';
import { seedBattleRng } from '../../state/battleRng';
import { isStructure } from '../../engine/structures';

/**
 * Le banc de RECETTE des écuries : il fige les faits GÉOMÉTRIQUES que la recette navigateur va lire à
 * l'écran (#1680, lot 15-B). Chaque adversaire de la rencontre sert une preuve, et chaque preuve se
 * mesure ici sur la MÊME scène que celle qui sera jouée.
 */

/** Cases où `startCombat` pose les héros : (`partyPos.x - 1`, `partyPos.y + i`) depuis le `heroStart`. */
const HEROS = [{ x: 24, y: 31 }, { x: 24, y: 32 }];
const GOBELIN_VOISIN = { x: 23, y: 29 };
const ARCHER = { x: 19, y: 32 };
const GOBELIN_DERRIERE_MUR = { x: 26, y: 31 };

const scene = scenario.scene;
const posDe = (label: string) => scene.entities.find((e) => e.label === label)!.pos!;

describe('Écuries de la Diligence — voir par-dessus le clayonnage', () => {
  it('pose le groupe dans les écuries SANS toucher la scène de campagne partagée', () => {
    expect(scene.entities.find((e) => e.kind === 'heroStart')!.pos).toEqual({ x: 25, y: 31 });
    expect(diligence.scene.entities.find((e) => e.kind === 'heroStart')!.pos).toEqual({ x: 17, y: 2 });
    expect(diligence.scene.encounters).toEqual([]);
  });

  it('poste les trois adversaires aux cases de leurs preuves', () => {
    expect(posDe('Gobelin de la stalle voisine')).toEqual(GOBELIN_VOISIN);
    expect(posDe('Archer gobelin de la stalle sud-ouest')).toEqual(ARCHER);
    expect(posDe('Gobelin derrière le mur de la remise')).toEqual(GOBELIN_DERRIERE_MUR);
  });

  it('arme le tireur du groupe d’une arme à DISTANCE (l’arc en main, pas la fronde rangée)', () => {
    const tireur = scenario.makeParty()[0];
    expect(tireur.weapons.some((w) => w.type === 'ranged')).toBe(true);
  });

  it('(c) le tir par-dessus la séparation de box PART — l’arête est du clayonnage, infranchissable et non occultante', () => {
    const arete = structureAt(scene, 23, 30, 'E', 0);
    expect(arete?.structure).toBe('cloture-en-clayonnage');
    expect(wallBetween(scene, 23, 30, 24, 30)).toBe(true); // on ne PASSE pas
    expect(areteOcculteEntre(scene, 23, 30, 24, 30)).toBe(false); // on VOIT
    for (const h of HEROS) {
      expect(lineOfSightCover(scene, h, GOBELIN_VOISIN, [])).toEqual({ blocked: false, cover: 'none' });
    }
  });

  it('(d) le tireur adverse posté derrière une AUTRE cloison de box voit le groupe (et réciproquement)', () => {
    expect(structureAt(scene, 19, 32, 'E', 0)?.structure).toBe('cloture-en-clayonnage');
    for (const h of HEROS) {
      expect(lineOfSightCover(scene, ARCHER, h, []).blocked).toBe(false);
      expect(lineOfSightCover(scene, h, ARCHER, []).blocked).toBe(false);
    }
  });

  it('contre-épreuve : à distance comparable, le mur à ossature en bois REFUSE la Ligne de Vue', () => {
    expect(structureAt(scene, 25, 31, 'E', 0)?.structure).toBe('mur-a-ossature-en-bois');
    for (const h of HEROS) {
      expect(lineOfSightCover(scene, h, GOBELIN_DERRIERE_MUR, []).blocked).toBe(true);
    }
  });
});

/**
 * HORS SIÈGE — la rencontre des écuries ne déclare PAS `siege` : les 668 structures de la scène
 * (cloisons de box, murs, portes) existent bel et bien en combattants, mais aucune n'entre dans le
 * choix de cible de l'IA. Le contrat est POSITIF et NOMMÉ : chacun des trois adversaires vise un
 * PERSONNAGE, et l'Archer Gobelin — celui que la scène arme d'un arc — TIRE sur `pregen-303`.
 */
describe('IA hors siège — aucune décision ne porte sur une structure (écuries)', () => {
  /** Rejoue l'ouverture de combat des écuries et rend le tour d'IA de chaque ennemi, dans l'ordre du roster. */
  const decisionsDesEnnemis = () => {
    seedBattleRng(1234);
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('enc-clayonnage');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    return b.combatants.filter((c) => c.kind === 'enemy').map((e) => {
      useGame.setState({ battle: { ...useGame.getState().battle!, turn: b.order.indexOf(e.id), acted: false, action: null, movementUsed: 0 } });
      const input = buildAiInput(e, useGame.getState);
      const action = chooseEnemyAction(input) as { kind: string; targetId?: string; thenTargetId?: string };
      const cible = b.combatants.find((c) => c.id === (action.targetId ?? action.thenTargetId));
      return { ennemi: e, input, action, cible };
    });
  };

  it('la rencontre ne déclare AUCUN siège : les structures ne sont pas offertes à l’IA', () => {
    const enc = scenario.scene.encounters!.find((e) => e.id === 'enc-clayonnage')!;
    expect(enc.siege).toBeUndefined();
    const lignes = decisionsDesEnnemis();
    expect(lignes.length).toBe(3);
    expect(useGame.getState().battle!.combatants.filter(isStructure).length).toBeGreaterThan(600);
    for (const { ennemi, input, cible } of lignes) {
      expect(input.structures ?? [], `${ennemi.label} reçoit des structures en entrée`).toEqual([]);
      expect(cible, `${ennemi.label} décide sans cible`).toBeTruthy();
      expect(isStructure(cible!), `${ennemi.label} vise ${cible!.label}`).toBe(false);
    }
  });

  it('l’Archer Gobelin TIRE sur Aelindra (pregen-303) — décision nommée, pas « une structure quelconque »', () => {
    const archer = decisionsDesEnnemis().find((l) => l.ennemi.label === 'Archer Gobelin')!;
    expect(archer.action.kind).toBe('shoot');
    expect(archer.action.targetId).toBe('pregen-303');
  });
});

/**
 * Le MÉMO de Ligne de Vue du tour d'IA (`makeLosMemo`, posé par `buildAiInput`) est PORTEUR : sa clé
 * couple `from` ET `to`, parce que le verdict de LdV n'est pas symétrique (couvert d'adjacence,
 * `lineOfSightCover`). Les écuries sont la scène où ça se voit : le gobelin de la stalle voisine
 * pose des dizaines de milliers de questions `from → to` derrière du clayonnage et un mur à
 * ossature. Contrat POSITIF : avec le mémo réel, la décision est celle du calcul direct ; avec un
 * mémo dont la clé OUBLIE `from`, elle DIVERGE — le couple est donc bien ce qui porte le verdict.
 */
describe('IA — le mémo de Ligne de Vue du tour est PORTEUR (clé from→to)', () => {
  /** Le mémo FAUTIF : même corps que `makeLosMemo`, clé AMPUTÉE de `from`. */
  const memoAmnesique = (sc: Scene, smoke: Pt[]): LosMemo => {
    const cache = new Map<string, ReturnType<typeof lineOfSightCover>>();
    const cover = (from: Pt, to: Pt) => {
      const k = `${to.x},${to.y},${to.z ?? 0}`; // OUBLIE `from`
      let v = cache.get(k);
      if (v === undefined) { v = lineOfSightCover(sc, from, to, [], smoke); cache.set(k, v); }
      return v;
    };
    return { cover, clear: (f, t) => !cover(f, t).blocked };
  };

  it('un mémo dont la clé OUBLIE `from` fait DIVERGER la décision du gobelin de la stalle voisine', () => {
    seedBattleRng(1234);
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('enc-clayonnage');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const gobelin = b.combatants.find((c) => c.kind === 'enemy' && c.pos!.x === GOBELIN_VOISIN.x && c.pos!.y === GOBELIN_VOISIN.y)!;
    expect(gobelin).toBeTruthy();
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(gobelin.id), acted: false, action: null, movementUsed: 0 } });
    const input = buildAiInput(gobelin, useGame.getState);
    expect(input.losMemo).toBeTruthy(); // `buildAiInput` pose bien le mémo du tour

    const avecMemoReel = chooseEnemyAction(input);
    // (a) le mémo réel ne change RIEN au verdict : même décision que le calcul direct (sans mémo).
    expect(avecMemoReel).toEqual(chooseEnemyAction({ ...input, losMemo: undefined }));
    // (b) …et la clé from→to est PORTEUSE : l'amputer change la décision.
    expect(chooseEnemyAction({ ...input, losMemo: memoAmnesique(input.scene, input.smoke ?? []) }))
      .not.toEqual(avecMemoReel);
  });
});
