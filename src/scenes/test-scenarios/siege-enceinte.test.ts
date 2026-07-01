import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { scenario } from './siege-enceinte';
import { WALL_ROW } from './siege-enceinte.ascii';
import { combatDistance } from '../../state/footprint';
import { lineOfSightCover } from '../../state/lineOfSight';
import { isWalkable, wallBetween, setStructureDown, heightAt } from '../../state/scene';
import { placeCombatant } from '../../state/spawn';
import { reachable, pathTo } from '../../state/path';
import { buildAiInput } from '../../state/combatFlow';
import { servingCrewPresent } from '../../state/shipPostes';
import { chooseEnemyAction } from '../../state/ai';
import { isStructure } from '../../engine/structures';
import { woundsFromHit } from '../../engine/woundsCalc';
import type { Weapon } from '../../engine/types';

/**
 * Siège à grande échelle (siege-enceinte) — vérif LOGIQUE headless : champ profond, rivière+pont, enceinte à
 * corps de garde, chemin de ronde épais, batterie qui brèche la porte (IA cible la structure), défenseurs
 * PNJ alliés-IA, combat vertical.
 */
describe('Siège — défendre la muraille (siege-enceinte)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('carte PROFONDE 30×46, 2 niveaux ; champ d\'approche ≫ cour modeste', () => {
    const s = scenario.scene;
    expect(s.dimensions).toEqual({ w: 30, h: 46 });
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    // Champ assaillant (y0 → mur y38 = 38 cases) PROFOND ; cour défenseur (y38..45 = 8 cases) MODESTE.
    expect(WALL_ROW).toBe(38);
    expect(s.dimensions.h - WALL_ROW).toBeLessThan(WALL_ROW); // cour ≪ champ
  });

  it('enceinte : PORTE flush dans la ligne du mur + courtine en pierre ; chemin de ronde rejoint par une RAMPE (plus d’escalier ni de hauteur de mur)', () => {
    const s = scenario.scene;
    const gate = s.walls!.filter((w) => w.structure === 'porte-de-ville');
    expect(gate.length).toBeGreaterThan(0);
    expect(gate.every((w) => w.y === WALL_ROW && w.side === 'N')).toBe(true); // ouverture DANS la ligne d'enceinte
    // La verticalité du rempart est sa COUCHE z1 (4 m), pas un champ `WallSeg.height` (retiré du contrat).
    expect(s.walls!.every((w) => !('height' in w))).toBe(true);
    expect(s.walls!.some((w) => w.structure === 'mur-en-pierre')).toBe(true); // courtine en pierre
    // Plus AUCUN escalier explicite : on gagne le chemin de ronde (z1, 4 m) par une RAMPE de la cour —
    // une bande de hauteurs croissantes ≤ 1 m/case sur la couche 0, franchie par le pathfinding (surfaceLink).
    expect((s as { stairs?: unknown }).stairs).toBeUndefined();
    const h0 = s.layers.find((l) => l.z === 0)!.height!;
    const idx = (x: number, y: number) => y * s.dimensions.w + x;
    expect(h0[idx(14, 42)]).toBe(1); // pied de la rampe (cour)
    expect(h0[idx(14, 39)]).toBe(4); // sommet de la rampe (rejoint le chemin de ronde à 4 m)
    // Connexité : depuis la cour (z0) on atteint le CHEMIN DE RONDE (z1) — par la rampe, en changeant de couche.
    const path = pathTo(s, { x: 14, y: 43, z: 0 }, { x: 8, y: WALL_ROW, z: 1 }, { blocked: new Set() });
    expect(path).not.toBeNull();
    expect(path!.some((p) => (p.z ?? 0) === 1)).toBe(true); // le trajet passe bien sur la couche 1
  });

  it('PORTE = STRUCTURE brèchable, PAS une porte ouvrable : intacte elle bloque passage+BFS cour↔champ ; abattue, la BRÈCHE rouvre', () => {
    const s = scenario.scene;
    const gate = s.walls!.filter((w) => w.structure === 'porte-de-ville');
    expect(gate.length).toBeGreaterThan(0);
    expect(gate.every((w) => !w.door)).toBe(true); // PAS de door:true → wallIsOpen = structureIsDown SEUL (pas d'ouverture par défaut)
    const g = gate[0]; // arête N de (g.x, WALL_ROW) : sépare la cour (y=WALL_ROW) du champ (y=WALL_ROW-1)
    // Intacte : passage runtime bloqué ET le BFS ne traverse pas (structure debout = barrière de planification).
    expect(wallBetween(s, g.x, WALL_ROW, g.x, WALL_ROW - 1)).toBe(true);
    expect(reachable(s, { x: g.x, y: WALL_ROW, z: 0 }, 1, { blocked: new Set() }).has(`${g.x},${WALL_ROW - 1}`)).toBe(false);
    // Abattue (brèche) : passage ET BFS rouverts.
    const breached = setStructureDown(s, g.x, WALL_ROW, 'N', 0, true);
    expect(wallBetween(breached, g.x, WALL_ROW, g.x, WALL_ROW - 1)).toBe(false);
    expect(reachable(breached, { x: g.x, y: WALL_ROW, z: 0 }, 1, { blocked: new Set() }).has(`${g.x},${WALL_ROW - 1}`)).toBe(true);
  });

  it('TUNNEL franchissable : un chemin z0 CHAMP→COUR par la porte est BLOQUÉ intact, OUVERT à la brèche', () => {
    // Le corps de garde est un tunnel de 2 cases au z0 SOUS le chemin de ronde (y37 = bouche champ, y38 = bouche
    // cour, toutes deux marchables) ; l'arête de porte (N de y38) le coupe au milieu tant qu'elle TIENT. Un
    // combattant marche du CHAMP (y36) jusque sous l'arche, mais ne FRANCHIT vers la COUR (y39) qu'une fois abattue.
    const s = scenario.scene;
    const gate = s.walls!.filter((w) => w.structure === 'porte-de-ville');
    const gx = gate[0].x; // colonne de porte (x14)
    const field = { x: gx, y: WALL_ROW - 2, z: 0 }; // (14,36) côté CHAMP
    const cour = { x: gx, y: WALL_ROW + 1, z: 0 };   // (14,39) côté COUR
    // Les deux bouches du tunnel (z0 sous le rempart) ET les seuils sont des cases STANDABLES.
    for (const t of [field, { x: gx, y: WALL_ROW - 1, z: 0 }, { x: gx, y: WALL_ROW, z: 0 }, cour])
      expect(isWalkable(s, t.x, t.y, 0)).toBe(true);
    // INTACTE : aucun chemin champ→cour (toute la ligne d'enceinte est murée, la porte coupe le tunnel).
    expect(pathTo(s, field, cour, { blocked: new Set() })).toBeNull();
    // ABATTUE : le chemin existe et TRAVERSE bien les deux cases du tunnel sous l'arche (y37 puis y38).
    const breached = setStructureDown(s, gx, WALL_ROW, 'N', 0, true);
    const path = pathTo(breached, field, cour, { blocked: new Set() });
    expect(path).not.toBeNull();
    const onPath = (x: number, y: number) => path!.some((p) => p.x === x && (p.z ?? 0) === 0 && p.y === y);
    expect(onPath(gx, WALL_ROW - 1)).toBe(true); // bouche CHAMP (y37) franchie
    expect(onPath(gx, WALL_ROW)).toBe(true);     // bouche COUR (y38) franchie
  });

  it('rivière (eau infranchissable) traversée par un PONT (planches) qui canalise l\'assaut', () => {
    const s = scenario.scene;
    expect(isWalkable(s, 0, 20, 0)).toBe(false);   // eau au bord = infranchissable
    expect(isWalkable(s, 14, 20, 0)).toBe(true);   // pont (planches) au centre = franchissable
    expect(isWalkable(s, 15, 21, 0)).toBe(true);
  });

  it('défenseur z=1 ↔ assaillant z=0 : distance verticale (pas de mêlée à travers le vide), LdV de tir dégagée', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const scene = useGame.getState().scene!;
    const hero = b.combatants.find((c) => c.kind === 'hero' && !c.inert)!;
    // Placement PRODUCTION : `placeCombatant` stampe la hauteur métrique `pos.h` (= 4 m, chemin de ronde z1)
    // depuis le relief de la scène — c'est ce `h` (pas le z discret) que lit `combatDistance`.
    hero.pos = { x: 8, y: WALL_ROW, z: 1 };         // sur le chemin de ronde, au-dessus de la courtine
    placeCombatant(hero, scene, hero.pos);           // RAFRAÎCHIT pos.h depuis le relief (4 m) — comme en production
    const foot = { x: 8, y: WALL_ROW - 1, h: heightAt(scene, 8, WALL_ROW - 1, 0) }; // assaillant au pied du mur (z=0, 0 m)
    // Δhauteur 4 m ÷ 2 m/case = 2 cases de séparation verticale → distance 2 (mêlée refusée à travers le vide).
    expect(combatDistance(hero, { pos: foot } as never)).toBe(2);
    expect(lineOfSightCover(scene, hero.pos, { x: 8, y: 10 }, []).blocked).toBe(false); // pilonne le champ
  });

  it('BATTERIE assaillante : le canon de siège BRÈCHE la porte tout seul (IA cible la structure)', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const canon = b.combatants.find((c) => c.id === 'enemy-assaut-0')!; // canonnier (index 0) qui SERT le canon
    expect(canon.weapons.some((w) => w.type === 'ranged')).toBe(true); // pièce servie au spawn (poste de l'affût)
    // L'ARTILLERIE assaillante est un AFFÛT inerte rendu comme un ENGIN (pas un brigand) : espèce DÉRIVÉE de
    // la ref (canon-petit), aucune apparence forcée, servi par le brigand → neutralisé en tuant l'équipage.
    const affut = b.combatants.find((c) => c.id === 'empl-assaut-canon')!;
    expect(affut.inert).toBe(true);
    expect(affut.bodyShape).toBe('engin');
    expect(affut.species).toBe('canon-petit'); // rig engin dérivé de la ref (plus d'appearance.species forcé)
    expect(b.order).not.toContain('empl-assaut-canon'); // affût inerte → aucun tour propre
    const entCanon = scenario.scene.entities.find((e) => e.id === 'empl-assaut-canon')!;
    expect(entCanon.ref).toBe('canon-petit');
    expect(entCanon.appearance).toBeUndefined(); // l'apparence d'engin se dérive de `ref`, rien n'est stocké
    const input = buildAiInput(canon, useGame.getState);
    expect(input.structures?.some((st) => st.creatureId === 'porte-de-ville')).toBe(true); // la porte est une cible
    const action = chooseEnemyAction(input);
    expect(action.kind).toBe('shoot');
    const tgt = b.combatants.find((c) => c.id === (action as { targetId: string }).targetId);
    expect(tgt && isStructure(tgt)).toBe(true); // … et c'est bien la STRUCTURE (porte) qui est visée
  });

  it('DÉFENSEURS : archers PNJ alliés-IA (agissent seuls) ; pièces INERTES servies (hors tour)', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const archer = b.combatants.find((c) => c.id === 'def-archer-0')!;
    expect(archer.kind).toBe('hero');         // côté héros
    expect(archer.aiControlled).toBe(true);    // … mais piloté par l'IA (le joueur ne le micro-gère pas)
    expect(archer.weapons.some((w) => w.type === 'ranged')).toBe(true); // armé d'un arc
    const baliste = b.combatants.find((c) => c.id === 'empl-baliste')!;
    expect(baliste.inert).toBe(true);
    // RAW-pur (AA p.122-123) : un engin de siège n'a AUCUNE Blessure → NON-destructible. Un coup ÉNORME (999)
    // inflige 0 (immune via le garde `target.inert`) — on le neutralise en tuant l'équipage, pas en le frappant.
    const coup: Weapon = { name: 'Canon', type: 'ranged', damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'siege' }] };
    expect(woundsFromHit(coup, baliste, 'corps', 999)).toBe(0);
    expect(b.order).not.toContain('empl-baliste'); // affût inerte → aucun tour
    expect(b.order).toContain('def-archer-0');     // … mais l'archer allié-IA A un tour (joué par l'IA)
    // La pièce est SERVIE d'office par son équipage PNJ (alliée-IA) qui TIRE la pièce (pas un arc).
    const crew = b.combatants.find((c) => c.id === 'crew-baliste')!;
    expect(crew.aiControlled).toBe(true);
    expect(crew.mannedPoste?.item.trappingId).toBe('baliste');
    expect(crew.weapons.find((w) => w.type === 'ranged')?.name).toMatch(/[Bb]aliste/); // SEULE arme à distance = la baliste
  });

  it('ÉQUIPAGE QUALIFIÉ : chaque servant a la Projectiles du Groupe de SA pièce → compte dans l’effectif (AA l.3900)', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    // Servant de baliste (rempart) : Groupe Arbalète → qualifié → effectif ≥ 1 (plus de « Chef présent, 0 effectif »).
    const crewBal = b.combatants.find((c) => c.id === 'crew-baliste')!;
    expect(crewBal.skills.some((s) => s.skillId === 'projectiles' && s.spec === 'Arbalète')).toBe(true);
    expect(servingCrewPresent(crewBal, b.combatants)).toBeGreaterThanOrEqual(1);
    // Servant de canon (rempart) : Groupe Poudre noire.
    const crewCan = b.combatants.find((c) => c.id === 'crew-canon')!;
    expect(crewCan.skills.some((s) => s.skillId === 'projectiles' && s.spec === 'Poudre noire')).toBe(true);
    expect(servingCrewPresent(crewCan, b.combatants)).toBeGreaterThanOrEqual(1);
    // Canonnier de siège assaillant (enemy-assaut-0, brigand) : Groupe Poudre noire → la batterie tire qualifiée.
    const canonnier = b.combatants.find((c) => c.id === 'enemy-assaut-0')!;
    expect(canonnier.skills.some((s) => s.skillId === 'projectiles' && s.spec === 'Poudre noire')).toBe(true);
    expect(servingCrewPresent(canonnier, b.combatants)).toBeGreaterThanOrEqual(1);
    // Servant de catapulte assaillant (enemy-assaut-1) : Groupe Catapulte.
    const cataCrew = b.combatants.find((c) => c.id === 'enemy-assaut-1')!;
    expect(cataCrew.skills.some((s) => s.skillId === 'projectiles' && s.spec === 'Catapulte')).toBe(true);
    expect(servingCrewPresent(cataCrew, b.combatants)).toBeGreaterThanOrEqual(1);
  });
});
