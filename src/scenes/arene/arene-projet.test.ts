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

/** Résout les membres d'une rencontre en leurs entités (le profil — ref/statblock/apparence/arme —
 *  vit sur l'entité ; le membre porte camp/monture ; traits/sorts/aléa vivent sur `entity.combat`).
 *  Rend la forme « ennemi » à plat que lisaient les tests avant la fusion members/entités. */
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

  it('le BOURG est TOUT-EN-SCÈNE : 4 GRANDS bâtiments (toits + murs d’arête + porte) + les 4 marchands DEDANS + médecin sur la place', () => {
    // Modèle unique : un bâtiment = un `Roof` (cutaway `roofHidden`) posé sur des `WallSeg` d'arête
    // (mur-en-bois) percés d'une porte, son INTÉRIEUR (PNJ/marchand/props) DANS l'empreinte. Plus aucune
    // scène-intérieur séparée ni transition — le cutaway révèle l'intérieur quand un allié entre.
    const hub = project.find((s) => s.id === 'arene-hub')!;
    expect((hub.roofs ?? []).length).toBeGreaterThanOrEqual(4); // taverne, chapelle, forge, échoppe
    const walls = (hub.walls ?? []).filter((w): w is WallSeg & { side: 'N' | 'E' } => w.side === 'N' || w.side === 'E');
    const solid = walls.filter((w) => w.structure);
    const doors = walls.filter((w) => w.door);
    expect(solid.length).toBeGreaterThan(0);          // les bâtiments sont CLÔTURÉS par des murs d'arête
    expect(doors.length).toBeGreaterThanOrEqual(4);   // 4 bâtiments desservis par une porte vers la place
    // un mur `structure` BLOQUE le passage ; une porte est FRANCHISSABLE (arête ouverte)
    const across = (w: WallSeg & { side: 'N' | 'E' }) => (w.side === 'N' ? { x: w.x, y: w.y - 1 } : { x: w.x + 1, y: w.y });
    expect(wallBetween(hub, solid[0].x, solid[0].y, across(solid[0]).x, across(solid[0]).y)).toBe(true);
    expect(wallBetween(hub, doors[0].x, doors[0].y, across(doors[0]).x, across(doors[0]).y)).toBe(false);
    // Les 4 archétypes marchands vivent DANS le Bourg (tavernière/armurier/herboriste dans leur bâtiment,
    // médecin sous sa tente sur la place) — plus AUCUN marchand dans une scène séparée.
    const hubArchetypes = hub.entities.map((e) => e.merchant?.archetype).filter(Boolean);
    expect(hubArchetypes).toEqual(expect.arrayContaining(['taverniere', 'armurier', 'herboriste', 'medecin']));
  });

  it('BÂTIMENTS : id d’auteur ET libellé de toit préservés (RoomSpec.id/label → roof), pas d’id frais anonyme', () => {
    // La compilation (`buildScene`/`addBuilding`) préserve l'id d'auteur (`taverne`…) et pose le libellé de
    // survol sur `roof.label` — sinon les toits deviendraient des `roof-N` anonymes sans nom lisible.
    const hub = project.find((s) => s.id === 'arene-hub')!;
    const taverne = (hub.roofs ?? []).find((r) => r.id === 'taverne');
    expect(taverne, 'toit d’id d’auteur « taverne »').toBeTruthy();
    expect(taverne!.label).toBe('Taverne « Au Trophée »');
    const prevot = project.find((s) => s.id === 'arene-exp-village')!.roofs?.find((r) => r.id === 'maison-prevot');
    expect(prevot?.label).toBe('Logis du prévôt'); // id ET label d'auteur survivent à la compilation
  });

  it('EMBUSCADE : une rencontre `hidden` enrôle des entités INVISIBLES jusqu’au combat (combat.hiddenUntilCombat)', () => {
    // Régression du gap EncounterSpec.hidden : sans lui, les détrousseurs seraient visibles avant le combat.
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
    // `transitionBack` a disparu du projet : le Bourg est TOUT-EN-SCÈNE (plus de scène-intérieur ni de
    // `sortie` qui y ramenait). Les zones/expéditions reviennent au Bourg par `transition` (destination
    // explicite), pas `transitionBack`.
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
    expect(all.some((e) => e.randomChars)).toBe(true); // −10 + 2d10 au spawn (LDB 78)
    expect(all.some((e) => e.side === 'ally' && !e.mount)).toBe(true); // allié de scène à PIED
  });

  it('VITRINE météo/ambiance : ≥3 météos, musiques de scène, et des INTÉRIEURS tout-en-scène (toits→cutaway)', () => {
    const weathers = new Set(project.map((s) => s.weather ?? 'clair'));
    expect(weathers.size).toBeGreaterThanOrEqual(3); // clair + pluie + brouillard
    expect(project.some((s) => s.music?.ambient)).toBe(true);
    // TOUT-EN-SCÈNE : les intérieurs ne sont plus des scènes `ambiance:'interieur'` séparées mais des
    // empreintes de bâtiment (toit `Roof` → cutaway `roofHidden`) DANS une scène extérieure. On vérifie
    // que le Bourg porte bien ces intérieurs et que le projet reste cohérent en ambiance (extérieur).
    expect((project.find((s) => s.id === 'arene-hub')!.roofs ?? []).length).toBeGreaterThanOrEqual(4);
    expect(project.every((s) => s.ambiance !== 'interieur'), 'plus de scène-intérieur séparée').toBe(true);
  });

  it('GRANDES cartes tactiques : chaque zone de l’échelle fait ≥ 24×16 (8× l’ancienne surface au max)', () => {
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
    // Régression (retour utilisateur) : avant, UN combat suffisait à mettre tout le groupe en
    // full plate (~31 co/tête). On verrouille : la somme de TOUT l'argent distribuable du projet
    // (victoires + fouilles + dialogues, optionnels compris) reste sous ~100 co — soit ~3 plates
    // en finissant ABSOLUMENT tout — et la zone 1 ne paie qu'en pistoles.
    let totalSb = 0; // tout en sous de bronze (1 co = 240 sb, 1 pa = 12 sb)
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
            if (!inBounds || !isWalkable(sc, x, y)) bad.push(`${sc.id}:${e.ref ?? e.statblock?.name ?? '?'}@(${x},${y})`);
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
    // L'arène fait découvrir un large bestiaire et des Traits canoniques pas encore tous codés mais déjà
    // présents en DONNÉES (« ça reste des systèmes qu'on veut tester »). On vérifie qu'ils sont référencés.
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
