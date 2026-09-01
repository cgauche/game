import { flowEffects, flowHasTest, walkFlow, EMPTY_FLOW, type Flow } from '../../state/flow';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateScene } from '../../state/validateScene';
import { parseProject } from '../../state/worldMap';
import { isWalkable, wallBetween, type Scene, type WallSeg } from '../../state/scene';
import { findCreatureById, trappings } from '../../data';
import { traitLabels } from '../../engine/traits/dispatch';
import { MERCHANTS } from '../../state/merchants/index';
import { entitySize } from '../../state/spawn';
import { footprintTiles, sizeFootprint } from '../../state/footprint';
import { terrainWalkable } from '../../state/terrain';

/** Terrain de base d'une zone = tuile la PLUS fréquente (le sol remplit la grille ; murs/eau = minorité). */
function baseTerrain(tiles: string[]): string {
  const count: Record<string, number> = {};
  for (const t of tiles) count[t] = (count[t] ?? 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * L'arène est un PROJET de données pures (créable/éditable dans l'éditeur) qui tourne sur le moteur
 * existant — aucun code applicatif dédié. Ce test verrouille que le JSON est VALIDE (transitions,
 * dialogues, ids) et que chaque ennemi référence une vraie créature du bestiaire (sinon mannequin B10).
 */
const doc = parseProject(JSON.parse(readFileSync(join(__dirname, 'arene-projet.json'), 'utf8')));
const project: Scene[] = doc.scenes;

/** Résout les membres d'une rencontre en leurs entités. */
function enemiesOf(scene: Scene, enc: Scene['encounters'][number]) {
  const byId = new Map(scene.entities.map((e) => [e.id, e] as const));
  return (enc.members ?? []).map((m) => {
    const ent = byId.get(m.entityId)!;
    return {
      ref: ent.ref, statblock: ent.statblock, pos: ent.pos, appearance: ent.appearance, weapon: ent.weapon,
      side: m.side, mount: m.mount, ridesEntityId: m.ridesEntityId,
      optionals: ent.combat?.optionals, spells: ent.combat?.spells, randomChars: ent.combat?.randomChars,
      hidden: ent.combat?.hiddenUntilCombat ?? false,
    };
  });
}
const ALL_ENEMIES = project.flatMap((s) => s.encounters.flatMap((e) => enemiesOf(s, e)));
const buildingMasses = (scene: Scene) => (scene.architecture ?? []).flatMap((body) => body.masses);
const terrainCounts = (scene: Scene) => {
  const counts: Record<string, number> = {};
  for (const tile of scene.layers[0].tiles) counts[tile] = (counts[tile] ?? 0) + 1;
  return counts;
};

describe('Arène — projet de données (zéro code applicatif)', () => {
  it('18 scènes : entrée zone1, Bourg TOUT-EN-SCÈNE (0 intérieur séparé), 13 zones, 3 expéditions, 1 embuscade de route', () => {
    expect(project).toHaveLength(18);
    expect(project[0].id).toBe('arene-zone1');
    const ids = project.map((s) => s.id);
    expect(ids).toContain('arene-hub');
    expect(ids).toContain('arene-zone13'); // L'Antre du Dragon (finale)
    // TOUT-EN-SCÈNE : les 4 bâtiments (taverne/chapelle/forge/échoppe) sont des empreintes DANS `arene-hub`,
    // plus AUCUNE scène-intérieur `arene-int-*` séparée.
    expect(ids.some((id) => /^arene-int-/.test(id))).toBe(false);
    expect(ids).toEqual(expect.arrayContaining(['arene-exp-foret', 'arene-exp-marais', 'arene-exp-village'])); // expéditions (#T2)
    expect(ids).toContain('arene-route-embuscade'); // cible du « Attaqués ! »
    const zones = ids.filter((id) => /^arene-zone\d+$/.test(id));
    expect(new Set(zones).size).toBe(13);
  });

  it('CARTE DU MONDE (#T2) : lieux→scènes valides, modes payants, péripéties d’auteur, embuscades', () => {
    const wm = doc.worldMap!;
    expect(wm.places.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(project.map((s) => s.id));
    for (const p of wm.places) expect(ids.has(p.scene), `lieu ${p.id} → ${p.scene}`).toBe(true);
    expect(wm.routes.some((r) => r.modes.includes('diligence'))).toBe(true); // transport payant RAW
    expect(wm.routes.some((r) => (r.perils ?? []).length > 0)).toBe(true); // péripéties d'auteur
    expect(wm.routes.some((r) => r.ambush)).toBe(true); // « Attaqués ! » → scène de combat
    expect(wm.routes.some((r) => r.perilDie != null)).toBe(true); // seuil d10 surchargé par route
  });

  it('les deux corps bâtis portent 9 BuildingMass (le legacy `Scene.roofs` a été purgé, #822), à murs/portes/sols inchangés', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const village = project.find((s) => s.id === 'arene-exp-village')!;
    expect(buildingMasses(hub)).toHaveLength(4);
    expect(buildingMasses(village)).toHaveLength(5);
    expect(buildingMasses(hub).length + buildingMasses(village).length).toBe(9);
    expect('roofs' in hub).toBe(false);
    expect('roofs' in village).toBe(false);
    expect(hub.walls).toHaveLength(178);
    expect(village.walls).toHaveLength(66);
    expect(hub.walls?.filter((wall) => wall.door).map(({ x, y, side }) => ({ x, y, side }))).toEqual([
      { x: 10, y: 13, side: 'N' },
      { x: 40, y: 14, side: 'N' },
      { x: 8, y: 27, side: 'N' },
      { x: 41, y: 27, side: 'N' },
    ]);
    expect(village.walls?.filter((wall) => wall.door).map(({ x, y, side }) => ({ x, y, side }))).toEqual([
      { x: 4, y: 5, side: 'N' },
      { x: 13, y: 5, side: 'N' },
      { x: 21, y: 4, side: 'E' },
      { x: 24, y: 16, side: 'E' },
      { x: 7, y: 15, side: 'E' },
    ]);
    expect(hub.walls?.filter((wall) => wall.structure)).toHaveLength(174);
    expect(village.walls?.filter((wall) => wall.structure)).toHaveLength(61);
    expect(hub.walls?.filter((wall) => wall.window)).toHaveLength(53);
    expect(village.walls?.filter((wall) => wall.window)).toHaveLength(16);
    expect(terrainCounts(hub)).toEqual({
      dalle: 94, herbe: 993, mur: 172, pave: 340, porte: 4, marbre: 49, plancher: 348,
    });
    expect(terrainCounts(village)).toEqual({
      planches: 56, herbe: 4, terre: 635, mur: 112, pave: 9,
    });
  });

  it('le BOURG est TOUT-EN-SCÈNE : murs d’arête, portes, marchands et ornements explicites', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const walls = (hub.walls ?? []).filter((w): w is WallSeg & { side: 'N' | 'E' } => w.side === 'N' || w.side === 'E');
    const solid = walls.filter((w) => w.structure);
    const doors = walls.filter((w) => w.door);
    expect(solid.length).toBeGreaterThan(0);
    expect(doors).toHaveLength(4);
    const across = (w: WallSeg & { side: 'N' | 'E' }) => (w.side === 'N' ? { x: w.x, y: w.y - 1 } : { x: w.x + 1, y: w.y });
    expect(wallBetween(hub, solid[0].x, solid[0].y, across(solid[0]).x, across(solid[0]).y)).toBe(true);
    expect(wallBetween(hub, doors[0].x, doors[0].y, across(doors[0]).x, across(doors[0]).y)).toBe(false);
    const hubArchetypes = hub.entities.map((e) => e.merchant?.archetype).filter(Boolean);
    expect(hubArchetypes).toEqual(expect.arrayContaining(['taverniere', 'armurier', 'herboriste', 'medecin']));
    // Étal de l'échoppe : reste une entité de décor (mobilier de rue posé devant la boutique).
    const ornaments = hub.entities.filter((entity) => entity.id.startsWith('orn-'));
    expect(ornaments.map(({ id, kind, pos, facing, ref }) => ({ id, kind, pos, facing, ref }))).toEqual([
      { id: 'orn-echoppe-etal', kind: 'prop', pos: { x: 41, y: 26 }, facing: 'N', ref: 'etal-marche' },
    ]);
    // Enseigne/clocheton/cheminée : DONNÉE D'ARCHITECTURE (`FacadeFeature`) portée par le corps de leur
    // bâtiment, ancrée sur une arête RÉELLE de ce corps (aucune entité de scène pour ces trois-là).
    const featureOf = (kind: string) =>
      hub.architecture!.flatMap((body) => body.facades)
        .flatMap((facade) => facade.features ?? []).find((feature) => feature.kind === kind)!;
    const isPhysicalWall = (edge: { x: number; y: number; side: string }) =>
      hub.walls?.some((w) => w.x === edge.x && w.y === edge.y && w.side === edge.side);
    const sign = featureOf('sign');
    expect(sign.id).toBe('enseigne');
    expect(sign.edge).toEqual({ x: 10, y: 13, side: 'N' });
    expect(isPhysicalWall(sign.edge)).toBe(true);
    expect(hub.walls?.find((w) => w.x === sign.edge.x && w.y === sign.edge.y && w.side === sign.edge.side)?.door).toBe(true);
    const belfry = featureOf('belfry');
    expect(belfry.id).toBe('clocheton');
    expect(belfry.edge).toEqual({ x: 40, y: 14, side: 'N' });
    expect(isPhysicalWall(belfry.edge)).toBe(true);
    const chimney = featureOf('chimney');
    expect(chimney.id).toBe('cheminee');
    expect(chimney.edge).toEqual({ x: 2, y: 31, side: 'E' });
    expect(isPhysicalWall(chimney.edge)).toBe(true);
    const byOrnamentId = new Map(ornaments.map((entity) => [entity.id, entity] as const));
    const massOf = (massId: string) => buildingMasses(hub).find((mass) => mass.id === massId)!.footprint[0];
    const inside = (pos: { x: number; y: number }, foot: { x: number; y: number; w: number; h: number }) =>
      pos.x >= foot.x && pos.x < foot.x + foot.w && pos.y >= foot.y && pos.y < foot.y + foot.h;
    expect(inside(byOrnamentId.get('orn-echoppe-etal')!.pos, massOf('echoppe'))).toBe(false);
    expect(hub.walls?.find((wall) => wall.door && wall.x === 10 && wall.y === 13 && wall.side === 'N')).toBeTruthy();
    expect(hub.walls?.find((wall) => wall.door && wall.x === 41 && wall.y === 27 && wall.side === 'N')).toBeTruthy();
    expect(byOrnamentId.get('orn-echoppe-etal')!.pos).toEqual({ x: 41, y: 26 });
  });

  it('ARCHITECTURE : le corps du Bourg et de Felsbach portent leurs masses nommées', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const bourg = hub.architecture?.find((body) => body.id === 'bourg');
    expect(bourg?.label).toBe('Le Bourg de l’Arène');
    expect(bourg?.masses.map((mass) => mass.id).sort()).toEqual(['chapelle', 'echoppe', 'forge', 'taverne']);
    const village = project.find((s) => s.id === 'arene-exp-village')!;
    const felsbach = village.architecture?.find((body) => body.id === 'felsbach');
    expect(felsbach?.label).toBe('Felsbach — village pesteux');
    expect(felsbach?.masses.map((mass) => mass.id).sort()).toEqual(['maison-1', 'maison-2', 'maison-3', 'maison-4', 'maison-prevot']);
  });

  it('EMBUSCADE : une rencontre `hidden` enrôle des entités INVISIBLES jusqu’au combat (combat.hiddenUntilCombat)', () => {
    const embuscade = project.find((s) => s.id === 'arene-route-embuscade')!;
    const enc = embuscade.encounters.find((e) => e.id === 'enc-embuscade')!;
    const byId = new Map(embuscade.entities.map((e) => [e.id, e] as const));
    const spawned = (enc.members ?? []).map((m) => byId.get(m.entityId)!);
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.every((e) => e.combat?.hiddenUntilCombat === true), 'tous cachés jusqu’au combat').toBe(true);
  });

  it('VITRINE des systèmes : tous les Effets clés sont mis en scène quelque part dans le projet', () => {
    const used = new Set<string>();
    let hasTestNode = false;
    const walk = (flow: Flow) => walkFlow(flow, (node) => {
      if (node.kind === 'do') {
        used.add(node.effect.type);
        if (node.effect.type === 'delayedEffect') walk(node.effect.flow);
      } else if (node.kind === 'test') hasTestNode = true;
    });
    for (const s of project) {
      for (const t of s.triggers) walk(t.flow);
      for (const e of s.encounters) walk(e.onVictory ?? EMPTY_FLOW);
      for (const ent of s.entities) if (ent.interact) walk(ent.interact.flow);
      for (const d of s.dialogues) for (const n of d.nodes) for (const c of n.choices) if (c.flow) walk(c.flow);
    }
    expect(hasTestNode, 'un nœud Test (jet → branches) mis en scène').toBe(true);
    for (const type of [
      'giveTrapping', 'giveMoney', 'giveXp', 'startCombat', 'transition',
      'startDialogue', 'journal', 'document', 'setTime', 'openMerchant', 'medicalAid', 'restoreFortune',
      'rest', 'mealParty', 'inflictNightmares', 'inflictDisease', 'giveSin', 'corruptionExposure',
      'learnSpell', 'interlude', 'setFlag', 'endDialogue',
    ]) expect(used.has(type), `effet « ${type} » mis en scène`).toBe(true);
  });

  it('VITRINE des rencontres : sorciers ennemis (spells), traits optionnels édités, stats aléatoires, allié à pied', () => {
    const all = ALL_ENEMIES;
    expect(all.some((e) => (e.spells ?? []).length > 0)).toBe(true); // lanceur de sorts ennemi (IA incante)
    expect(all.some((e) => (e.optionals ?? []).length > 0)).toBe(true); // traits facultatifs (LDB 76)
    expect(all.some((e) => e.randomChars)).toBe(true); // −10 + 2d10 au spawn (LDB 77 l.108)
    expect(all.some((e) => e.side === 'ally' && !e.mount)).toBe(true); // allié de scène à PIED
  });

  it('VITRINE météo/ambiance : ≥3 météos, musiques de scène et intérieurs liés aux sections de toit', () => {
    const weathers = new Set(project.map((s) => s.weather ?? 'clair'));
    expect(weathers.size).toBeGreaterThanOrEqual(3); // clair + pluie + brouillard
    expect(project.some((s) => s.music?.ambient)).toBe(true);
    expect(buildingMasses(project.find((s) => s.id === 'arene-hub')!)).toHaveLength(4);
    expect(project.every((s) => s.ambiance !== 'interieur'), 'plus de scène-intérieur séparée').toBe(true);
  });

  it('GRANDES cartes tactiques : chaque zone de l’échelle fait ≥ 24×16', () => {
    for (const s of project.filter((x) => /^arene-zone\d+$/.test(x.id))) {
      expect(s.dimensions.w * s.dimensions.h, `${s.id} (${s.dimensions.w}×${s.dimensions.h})`).toBeGreaterThanOrEqual(24 * 16);
    }
    const finale = project.find((s) => s.id === 'arene-zone13')!;
    expect(finale.dimensions.w * finale.dimensions.h).toBeGreaterThanOrEqual(40 * 28 - 1); // l'antre voit GRAND
  });

  it('FOUILLE : des décors interactifs (interact) répartis dans ≥8 scènes, certains piégés (test imbriqué)', () => {
    const withInteract = project.filter((s) => s.entities.some((e) => e.interact));
    expect(withInteract.length).toBeGreaterThanOrEqual(8);
    const trapped = project.flatMap((s) => s.entities.filter((e) => e.interact && flowHasTest(e.interact.flow)));
    expect(trapped.length).toBeGreaterThanOrEqual(2); // fouilles à risque (maladie/réveil du dragon…)
  });

  it('ÉCONOMIE : la vie est chère — l’or TOTAL du projet reste < 3 plates complètes ; l’XP est généreuse', () => {
    // La somme de tout l'argent distribuable du projet reste sous ~100 co, soit ~3 plates
    // en finissant ABSOLUMENT tout — et la zone 1 ne paie qu'en pistoles.
    let totalSb = 0; // tout en sous de cuivre (1 CO = 240 sc, 1 pistole = 12 sc)
    const walk = (flow: Flow) => walkFlow(flow, (node) => {
      if (node.kind !== 'do') return;
      const e = node.effect as any;
      if (e.type === 'giveMoney') totalSb += (e.gold ?? 0) * 240 + (e.silver ?? 0) * 12 + (e.brass ?? 0);
      if (e.type === 'delayedEffect') walk(e.flow);
    });
    for (const s of project) {
      for (const t of s.triggers) walk(t.flow);
      for (const e of s.encounters) walk(e.onVictory ?? EMPTY_FLOW);
      for (const ent of s.entities) if (ent.interact) walk(ent.interact.flow);
      for (const d of s.dialogues) for (const n of d.nodes) for (const c of n.choices) if (c.flow) walk(c.flow);
    }
    expect(totalSb).toBeLessThanOrEqual(100 * 240);
    const z1 = project[0].encounters.find((e) => e.id === 'enc-zone1')!;
    const z1money = flowEffects(z1.onVictory!).find((e) => e.type === 'giveMoney') as any;
    expect(z1money.gold ?? 0).toBe(0); // l'échauffement paie en PISTOLES
    // XP : chaque victoire de zone vaut ≥100 PX (progression sentie à CHAQUE combat),
    // et l'échelle complète en cumule ≥2500.
    let ladder = 0;
    for (let n = 1; n <= 13; n++) {
      const z = project.find((s) => s.id === `arene-zone${n}`)!;
      const xp = flowEffects(z.encounters.find((e) => e.id === `enc-zone${n}`)!.onVictory!).find((e) => e.type === 'giveXp') as any;
      expect(xp.amount, `XP zone${n}`).toBeGreaterThanOrEqual(100);
      ladder += xp.amount;
    }
    expect(ladder).toBeGreaterThanOrEqual(2500);
  });

  it('AUBERGE : dormir au Trophée (dialogue tavernière DANS le Bourg) ouvre la modale de Repos en contexte auberge (chambres/repas PAR HÉROS, prix RAW dans la modale)', () => {
    // TOUT-EN-SCÈNE : le dialogue de la Tavernière (`dlg-taverne`) vit dans `arene-hub`.
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const choices = hub.dialogues.find((d) => d.id === 'dlg-taverne')!.nodes.flatMap((n) => n.choices);
    const sleeps = choices.filter((c) => c.flow && flowEffects(c.flow).some((e) => e.type === 'rest'));
    expect(sleeps.length).toBeGreaterThanOrEqual(1);
    for (const c of sleeps) {
      expect(c.cost, 'plus de forfait sur le choix — les prix vivent dans la modale').toBeUndefined();
      expect(flowEffects(c.flow!).some((e) => e.type === 'rest' && (e as { lodging?: string }).lodging === 'auberge'), 'contexte auberge').toBe(true);
    }
    // L'offre de repos (bouton 🌙) : le Bourg (dont la taverne, tout-en-scène) = auberge ; zones = repos interdit.
    expect(hub.rest?.auberge).toBe(true);
    const zone1 = project.find((s) => s.id === 'arene-zone1')!;
    expect(!!zone1.rest && !zone1.rest.auberge && !zone1.rest.maison && !zone1.rest.camp, 'pas de bivouac dans l’arène').toBe(true);
    // La grand-route de Felsbach a des relais : la halte de nuit du voyage propose l'auberge.
    expect(doc.worldMap?.routes.find((r) => r.id === 'route-felsbach')?.inns).toBe(true);
  });

  it('BUTIN magique : au moins un giveTrapping avec qualités magiques NON identifiées (vitrine Évaluation)', () => {
    let found = false;
    const walk = (flow: Flow) => walkFlow(flow, (node) => {
      if (node.kind !== 'do') return;
      const e = node.effect as any;
      if (e.type === 'giveTrapping' && e.identified === false && (e.qualities ?? []).length > 0) found = true;
      if (e.type === 'delayedEffect') walk(e.flow);
    });
    for (const s of project) for (const ent of s.entities) if (ent.interact) walk(ent.interact.flow);
    expect(found).toBe(true);
  });

  it('validateScene(projet + carte du monde) ne lève AUCUNE erreur (transitions/dialogues/ids/lieux OK)', () => {
    const errors = validateScene(project, doc.worldMap).filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
  });

  it('chaque ennemi référence une vraie créature (pas de mannequin B10)', () => {
    const missing: string[] = [];
    for (const sc of project)
      for (const enc of sc.encounters)
        for (const e of enemiesOf(sc, enc))
          if (e.ref && !findCreatureById(e.ref)) missing.push(`${sc.id}:${e.ref}`);
    expect(missing).toEqual([]);
  });

  it('chaque ennemi spawn sur une EMPREINTE entière DANS la carte et MARCHABLE (mur/eau/décor exclus)', () => {
    // Footprint complet (Grande 2×2 / Énorme 3×3 / Monstrueuse 4×4) : toutes les cases occupées doivent
    // être dans la carte ET marchables — sinon un grand monstre déborde sur un mur (placement incohérent).
    const bad: string[] = [];
    for (const sc of project)
      for (const enc of sc.encounters)
        for (const e of enemiesOf(sc, enc)) {
          const size = entitySize(e);
          for (const { x, y } of footprintTiles(e.pos, sizeFootprint(size))) {
            const inBounds = x >= 0 && y >= 0 && x < sc.dimensions.w && y < sc.dimensions.h;
            if (!inBounds || !isWalkable(sc, x, y)) bad.push(`${sc.id}:${e.ref ?? e.statblock?.label ?? '?'}@(${x},${y})`);
          }
        }
    expect(bad).toEqual([]);
  });

  it('couvre les types de rencontre ÉTENDUS : Surprise/embuscade, Nuée (statbloc), Terreur, Test interactif', () => {
    const encs = project.flatMap((s) => s.encounters);
    expect(encs.some((e) => e.surprise === 'party')).toBe(true); // embuscade
    expect(ALL_ENEMIES.some((en) => (en.statblock?.traits ?? []).some((t) => t.id === 'nuee'))).toBe(true); // Nuée = statbloc custom
    expect(ALL_ENEMIES.some((en) => en.ref === 'spectre-de-cairn')).toBe(true); // créature Terreur
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const hasTest = hub.dialogues.some((d) => d.nodes.some((n) => n.choices.some((c) => c.flow && flowHasTest(c.flow))));
    expect(hasTest).toBe(true); // nœud Flow `test` (Crochetage) avec branches succès/échec
  });

  it('une zone met en scène la CAVALERIE : un cavalier pré-monté + un cheval libre allié (montable)', () => {
    expect(ALL_ENEMIES.some((e) => e.ridesEntityId != null)).toBe(true); // cavalier pré-monté (réf stable vers sa monture)
    expect(ALL_ENEMIES.some((e) => e.mount && e.side === 'ally')).toBe(true); // monture LIBRE côté héros
  });

  it('FINALE : un boss MONSTRUEUX (4×4) au SOUFFLE de ténèbres (statbloc inline)', () => {
    const dragon = ALL_ENEMIES.find((e) => e.statblock?.size === 'monstrueuse');
    expect(dragon, 'un ennemi de Taille Monstrueuse').toBeTruthy();
    expect((dragon!.statblock!.traits ?? []).some((t) => t.id === 'souffle')).toBe(true); // attaque de Souffle
  });

  it('chaque zone est UNIQUE : terrains de base distincts (campagne démo)', () => {
    const zones = project.filter((s) => s.id.startsWith('arene-zone'));
    const bases = zones.map((z) => baseTerrain(z.layers[0].tiles)); // sol dominant de la zone
    expect(new Set(bases).size).toBeGreaterThanOrEqual(10); // ≥10 sols différents sur 13 zones
  });

  it('VRAIS MURS : chaque zone est CLÔTURÉE par une structure (mur/eau/sous-bois), pas un champ vide', () => {
    // Un layout tactique cohérent est borné par des tuiles INFRANCHISSABLES : murs de pierre (intérieur),
    // sous-bois/eau (marais). On exige une masse structurelle ≥ périmètre minimal — preuve d'une enceinte
    // (et de structure interne), pas un empilement d'objets sur un sol vide.
    for (const sc of project.filter((s) => s.id.startsWith('arene-zone'))) {
      const structural = sc.layers[0].tiles.filter((t) => !terrainWalkable(t)).length;
      const { w, h } = sc.dimensions;
      expect(structural, `${sc.id} doit être clôturé`).toBeGreaterThanOrEqual(w + h); // ~un demi-périmètre au moins
    }
  });

  it('VITRINE du bestiaire & des Traits (même non codés) : Champion, Corruption, Démoniaque, Venin, Taille', () => {
    // L'arène fait découvrir un large bestiaire et des Traits canoniques dont certains restent non
    // mécanisés mais déjà présents en DONNÉES (« ça reste des systèmes qu'on veut tester »). On vérifie
    // qu'ils sont référencés.
    const refs = new Set(ALL_ENEMIES.map((en) => en.ref).filter(Boolean));
    expect(refs.size).toBeGreaterThanOrEqual(30); // large vitrine (≥30 créatures distinctes)
    // Traits canoniques (LDB 85) portés par les créatures référencées.
    const traitsOf = (ref?: string): string[] => (ref ? traitLabels(findCreatureById(ref)?.traits) : []);
    const allTraits = [...refs].flatMap((r) => traitsOf(r as string));
    for (const trait of [/^Champion$/, /^Corruption \(/, /^Démoniaque/, /^Venin$/]) {
      expect(allTraits.some((t) => trait.test(t)), `Trait ${trait}`).toBe(true);
    }
    // Une créature MONSTRUEUSE (Dragon, statbloc) + une Énorme (Vouivre, par ref) au moins.
    const sizes = ALL_ENEMIES.map((en) => entitySize(en));
    expect(sizes).toContain('monstrueuse');
    expect(sizes).toContain('enorme');
  });

  it('les ennemis d’une vague sont RÉPARTIS (pas tous dans la même colonne)', () => {
    for (const sc of project.filter((s) => s.id.startsWith('arene-zone'))) {
      const xs = new Set(enemiesOf(sc, sc.encounters[0]).map((e) => e.pos.x));
      expect(xs.size, sc.id).toBeGreaterThanOrEqual(2); // au moins 2 colonnes distinctes
    }
  });

  it('boucle complète : chaque zone se solde par un retour au hub (transition)', () => {
    for (const z of project.filter((s) => s.id.startsWith('arene-zone'))) {
      const ov = flowEffects(z.encounters[0]?.onVictory ?? EMPTY_FLOW);
      expect(ov.some((e) => e.type === 'transition' && e.scene === 'arene-hub')).toBe(true);
      expect(ov.some((e) => e.type === 'setFlag')).toBe(true);
    }
  });

  it('le Maître ouvre la zone suivante via flags (porte gated zoneN_clear) — 13 portes', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const door = hub.dialogues.find((d) => d.id === 'dlg-hub')!;
    const choices = door.nodes.flatMap((n) => n.choices);
    const doors = choices.filter((c) => c.flow && flowEffects(c.flow).some((e) => e.type === 'transition' && /^arene-zone\d+$/.test(e.scene)));
    expect(doors.length).toBe(13);
    expect(doors.every((c) => /clear/.test(c.when?.kind === 'flag' ? c.when.expr : ''))).toBe(true);
  });

  it('les CONTRATS d’expédition : proposition gated progression, prime gated contrat_*_fait', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const dlg = hub.dialogues.find((d) => d.id === 'dlg-hub')!;
    const choices = dlg.nodes.flatMap((n) => n.choices);
    for (const key of ['foret', 'marais', 'village']) {
      expect(choices.some((c) => (c.when?.kind === 'flag' ? c.when.expr : '').includes(`!contrat_${key}`)), `proposition ${key}`).toBe(true);
      expect(choices.some((c) => (c.when?.kind === 'flag' ? c.when.expr : '').includes(`contrat_${key}_fait`)), `prime ${key}`).toBe(true);
      // et une rencontre d'expédition pose bien le flag _fait
      const setters = project.flatMap((s) => s.encounters.flatMap((e) => flowEffects(e.onVictory ?? EMPTY_FLOW)));
      expect(setters.some((e) => e.type === 'setFlag' && e.flag === `contrat_${key}_fait`), `flag contrat_${key}_fait`).toBe(true);
    }
  });

  it('FINALE de campagne : le titre de champion délivre un document ET un interlude (LDB 22-23)', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const dlg = hub.dialogues.find((d) => d.id === 'dlg-hub')!;
    const champion = dlg.nodes.flatMap((n) => n.choices).find((c) => (c.when?.kind === 'flag' ? c.when.expr : '').includes('zone13_clear'))!;
    expect(champion).toBeTruthy();
    const types = (champion.flow ? flowEffects(champion.flow) : []).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['document', 'interlude', 'giveXp']));
  });

  it('le hub a un Médecin (LDB 75) qui vend des soins ET des prothèses, curatifs garantis', () => {
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const medecin = hub.entities.find((e) => e.id === 'medecin');
    expect(medecin?.merchant?.archetype).toBe('medecin');
    const arch = MERCHANTS['medecin'];
    expect(arch).toBeTruthy();
    expect(arch.category.subTypes).toContain('herbes-et-potions'); // id de Groupe
    expect(arch.category.subTypes).toContain('protheses');
    // tous les articles garantis (curated, par id) référencent un vrai trapping de la base
    for (const id of arch.curated ?? []) expect(trappings.some((t) => t.id === id), id).toBe(true);
  });
});
