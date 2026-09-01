import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseProject, routesFrom, visiblePlaces } from '../../state/worldMap';
import type { ConditionCtx } from '../../engine/flowCore';
import { chebyshev } from '../../engine/grid';
import { validateScene, type Warning } from '../../state/validateScene';
import { sceneMetresPerTile, isMerScene, type Scene, type Effect } from '../../state/scene';
import { findCreatureById, findVehicleById, findNavalTrait, findCrewRoleById } from '../../data';
import { rigSpeciesVocab } from '../../gameIso/rig/appearance';
import { TENUE_BY_ID } from '../../gameIso/rig/parts/tenues';
// @ts-expect-error — outil d'auteur .mjs sans types (lib.mjs) ; on n'exerce que le forward de metresPerTile.
import { scene as makeScene } from '../../../scripts/campagne/lib.mjs';

/**
 * « La Barge du Sel » — mini-campagne navale GÉNÉRÉE par `scripts/barge-du-sel/generate.mjs` (issue #218,
 * expérience auteur : source canonique = le générateur, patron `loup-et-saumure-projet.test.ts`). Verrouille
 * que le JSON produit est VALIDE et que chaque pièce demandée par le brief est bien câblée : le navire du
 * groupe (« La Louve grise », 2 matelots salariés, un canon à tribord), l'embuscade de pirates à mi-route
 * (coque type cogue avec un trait naval du catalogue, reddition à 40 % de Blessures), et l'objectif courant
 * posé au départ.
 */
const doc = parseProject(JSON.parse(readFileSync(join(__dirname, 'barge-du-sel-projet.json'), 'utf8')));
const project: Scene[] = doc.scenes;

/** Toutes les entités ENRÔLÉES dans une rencontre (celles référencées par `EncounterDef.members`). */
function enrolledEntities(scene: Scene) {
  const byId = new Map(scene.entities.map((e) => [e.id, e] as const));
  return scene.encounters.flatMap((enc) => (enc.members ?? []).map((m) => byId.get(m.entityId)!));
}

/** Marche UN Flow (feuille `do`, `seq`, `if`, `test`) et collecte ses `Effect`. */
function walkFlow(flow: any, out: Effect[]) {
  if (!flow) return;
  if (flow.kind === 'do') out.push(flow.effect);
  else if (flow.kind === 'seq') for (const s of flow.steps) walkFlow(s, out);
  else if (flow.kind === 'if') { walkFlow(flow.then, out); walkFlow(flow.else, out); }
  else if (flow.kind === 'test') { walkFlow(flow.success, out); walkFlow(flow.fail, out); }
}

/** Tous les `Effect` posés dans un `flow` de la campagne — triggers et onVictory des rencontres, toutes
 *  scènes confondues (cette mini-campagne n'a pas de dialogues). */
function allEffects(): Effect[] {
  const out: Effect[] = [];
  for (const sc of project) {
    for (const t of sc.triggers) walkFlow(t.flow, out);
    for (const enc of sc.encounters) walkFlow(enc.onVictory, out);
    for (const e of sc.entities) if (e.interact?.flow) walkFlow(e.interact.flow, out);
  }
  return out;
}

describe('La Barge du Sel — mini-campagne navale (zéro code applicatif)', () => {
  it('3 scènes dans l’ordre : quai de départ, embuscade, îlot', () => {
    expect(project.map((s) => s.id)).toEqual(['barge-du-sel-quai', 'barge-du-sel-embuscade', 'barge-du-sel-ilot']);
  });

  it('CARTE DU MONDE : 2 lieux, UNE route maritime courte, embuscade ancrée à MI-ROUTE (at 0.5)', () => {
    const wm = doc.worldMap!;
    expect(wm.places.map((p) => p.id)).toEqual(['quai-du-sel', 'ilot-du-sel']);
    expect(wm.routes).toHaveLength(1);
    const route = wm.routes[0];
    expect(route.sea).toBe(true);
    expect(route.km).toBeLessThanOrEqual(50); // route « courte »
    expect(route.ambush?.scene).toBe('barge-du-sel-embuscade');
    expect(route.ambush?.encounter).toBe('enc-embuscade-sel');
    expect(route.ambush?.at).toBe(0.5); // ancrée à MI-ROUTE, déterministe (#212)
  });

  it('validateScene(projet + carte du monde) ne lève AUCUNE erreur', () => {
    const errors = validateScene(project, doc.worldMap).filter((w: Warning) => w.level === 'error');
    expect(errors).toEqual([]);
  });

  it('chaque combattant enrôlé référence une vraie CRÉATURE ou un vrai NAVIRE (vehicles.json)', () => {
    const missing: string[] = [];
    for (const sc of project)
      for (const e of enrolledEntities(sc))
        if (e.ref && !findCreatureById(e.ref) && !findVehicleById(e.ref)?.hull) missing.push(`${sc.id}:${e.ref}`);
    expect(missing).toEqual([]);
  });

  it('chaque CustomStatblock d’auteur porte son label (spawn.ts:322 lit sb.label sans repli)', () => {
    const missing: string[] = [];
    for (const sc of project)
      for (const e of sc.entities)
        if (e.statblock && !e.statblock.label) missing.push(`${sc.id}:${e.id}`);
    expect(missing).toEqual([]);
  });

  /**
   * Une entité `personnage` n'a d'apparence à résoudre que par sa RÉF (créature/véhicule du catalogue)
   * ou par son ESPÈCE (`appearance.species`) : `entityRigProfileFor` (`src/gameIso/rig/enemyProfile.ts:270-274`)
   * n'en dérive AUCUNE sans l'une des deux, et le rendu signale l'entité muette en dev. Le contrat
   * porte sur TOUT le paquet — l'équipage exposé des deux coques compris.
   */
  it('toute entité PERSONNAGE résout son apparence : réf de catalogue OU Espèce du rig (tenue résolue)', () => {
    const muettes: string[] = [];
    const inconnues: string[] = [];
    for (const sc of project)
      for (const e of sc.entities) {
        if (e.kind !== 'personnage') continue;
        const species = e.appearance?.species;
        if (!e.ref && !species) muettes.push(`${sc.id}:${e.id} (${e.label ?? 'sans libellé'})`);
        if (species && !rigSpeciesVocab().has(species)) inconnues.push(`${sc.id}:${e.id} espèce « ${species} »`);
        if (e.appearance?.tenue && !TENUE_BY_ID[e.appearance.tenue]) inconnues.push(`${sc.id}:${e.id} tenue « ${e.appearance.tenue} »`);
      }
    expect(muettes, 'entité(s) de personnage sans réf NI Espèce — le rig n’a rien à dessiner et le rendu le signale en dev').toEqual([]);
    expect(inconnues, 'espèce/tenue hors des registres du rig — l’apparence retombe en repli muet').toEqual([]);
  });

  it('« La Louve grise » est une coque ALLIÉE armée de deux bordées + une chasse de proue (crewIds de poste vide)', () => {
    const sc = project.find((s) => s.id === 'barge-du-sel-embuscade')!;
    const louve = sc.entities.find((e) => e.id === 'louve-grise')!;
    expect(findVehicleById(louve.ref!)?.hull, 'la Louve grise est une coque').toBeTruthy();
    expect(louve.postes!.map((p) => p.side)).toEqual(['tribord', 'babord', 'proue']); // deux bordées + chasse de proue
    for (const p of louve.postes!) expect(p.crewIds).toEqual([]); // équipage ABSTRAIT à la Mer (aucun héros à l'authoring, #222)
  });

  it('DOTATION DE BORD (#241) : le canon de la Louve grise porte un coffre à munitions (ammo qty>0) et une sélection (ammoUid) valide', () => {
    const sc = project.find((s) => s.id === 'barge-du-sel-embuscade')!;
    const louve = sc.entities.find((e) => e.id === 'louve-grise')!;
    for (const p of louve.postes ?? []) {
      expect(p.ammo, `${p.trappingId} : coffre à munitions posé`).toBeTruthy();
      expect(p.ammo!.length).toBeGreaterThan(0);
      for (const a of p.ammo!) {
        expect(a.kind).toBe('ammo');
        expect(a.qty ?? 0).toBeGreaterThan(0);
      }
      expect(p.ammo!.some((a) => a.uid === p.ammoUid), `${p.trappingId} : ammoUid dans le stock`).toBe(true);
    }
  });

  it('la cogue pirate porte un TRAIT NAVAL du catalogue (upgrades) et son équipage exposé (crewIds)', () => {
    const sc = project.find((s) => s.id === 'barge-du-sel-embuscade')!;
    const cogue = sc.entities.find((e) => e.id === 'cogue-pirate')!;
    expect(findVehicleById(cogue.ref!)?.hull, 'la cogue pirate est une coque').toBeTruthy();
    expect(cogue.upgrades, 'trait naval posé').toBeTruthy();
    expect(cogue.upgrades!.length).toBeGreaterThan(0);
    for (const u of cogue.upgrades!) expect(findNavalTrait(u.id), `trait naval « ${u.id} » existe au catalogue`).toBeTruthy();
    expect(cogue.crewIds!.length).toBeGreaterThan(0);
    const entIds = new Set(sc.entities.map((e) => e.id));
    for (const id of cogue.crewIds!) expect(entIds.has(id), `équipage exposé ${id}`).toBe(true);
  });

  it('REDDITION : enc-embuscade-sel porte woundsThreshold sur la cogue pirate à 40 % de Blessures', () => {
    const sc = project.find((s) => s.id === 'barge-du-sel-embuscade')!;
    const vc = sc.encounters.find((e) => e.id === 'enc-embuscade-sel')!.victoryCondition;
    expect(vc).toEqual({ type: 'woundsThreshold', targetId: 'cogue-pirate', belowPercent: 40 });
    expect(sc.entities.some((e) => e.id === 'cogue-pirate')).toBe(true);
  });

  it('le setVessel du départ porte le NOM D’INSTANCE « La Louve grise » et un roster de 2 matelots salariés valide', () => {
    const setVesselEffects = allEffects().filter((e): e is Extract<Effect, { type: 'setVessel' }> => e.type === 'setVessel');
    expect(setVesselEffects).toHaveLength(1);
    const v = setVesselEffects[0];
    expect(v.vehicleId).toBe('loup-imperial');
    expect(v.label).toBe('La Louve grise');
    expect(v.crew, 'roster salarié posé').toBeTruthy();
    for (const hire of v.crew!) {
      expect(hire.count).toBeGreaterThan(0);
      expect(findCrewRoleById(hire.roleId), `rôle d’équipage « ${hire.roleId} » existe (crew-roles.json)`).toBeTruthy();
    }
    const totalCrew = v.crew!.reduce((n, h) => n + h.count, 0);
    expect(totalCrew).toBe(2); // « 2 matelots salariés » — pas d'id "matelot" au catalogue, cf. journal
  });

  it('OBJECTIF COURANT posé AU DÉPART (id STABLE), mis à jour à la victoire, vidé à l’arrivée', () => {
    const objs = allEffects().filter((e): e is Extract<Effect, { type: 'setObjective' }> => e.type === 'setObjective');
    expect(objs.length).toBeGreaterThanOrEqual(2);
    for (const o of objs) expect(o.id).toBe('barge-du-sel-mission');
    const quai = project.find((s) => s.id === 'barge-du-sel-quai')!;
    const departEffects: Effect[] = [];
    for (const t of quai.triggers) walkFlow(t.flow, departEffects);
    expect(departEffects.some((e) => e.type === 'setObjective'), 'objectif posé au départ').toBe(true);
    const clears = allEffects().filter((e): e is Extract<Effect, { type: 'clearObjective' }> => e.type === 'clearObjective');
    expect(clears.length).toBeGreaterThan(0);
  });

  it('ROUTAGE : l’embuscade RESTITUE le voyage (aucune transition en dur dans son onVictory)', () => {
    const sc = project.find((s) => s.id === 'barge-du-sel-embuscade')!;
    const enc = sc.encounters.find((e) => e.id === 'enc-embuscade-sel')!;
    const eff: Effect[] = [];
    walkFlow(enc.onVictory, eff);
    expect(eff.some((e) => e.type === 'transition')).toBe(false);
  });

  it('ZÉRO jargon technique dans les textes joueur (journal, objectifs)', () => {
    const jargonPattern = /`|INEXPRIMABLE|CONTOURN|\bstate\.|\bvessel\.|\bTODO\b|seaVoyageFlow|op:'testMod'|engine\/ops\.ts|adjustManann|adjustVessel|setVessel|setObjective|saboteurDR|factorId|woundsThreshold|MDG \d+ l\.\d/;
    const bad: string[] = [];
    for (const e of allEffects()) {
      if (e.type === 'journal' && jargonPattern.test(e.desc)) bad.push(`journal: "${e.desc}"`);
      if (e.type === 'setObjective' && jargonPattern.test(e.desc)) bad.push(`objectif: "${e.desc}"`);
    }
    expect(bad).toEqual([]);
  });

  it('chaque combattant enrôlé spawn sur une case MARCHABLE de la carte (footprint des coques compris)', () => {
    const bad: string[] = [];
    for (const sc of project)
      for (const e of enrolledEntities(sc)) {
        const { x, y } = e.pos;
        const inBounds = x >= 0 && y >= 0 && x < sc.dimensions.w && y < sc.dimensions.h;
        if (!inBounds) bad.push(`${sc.id}:${e.id}@(${x},${y})`);
      }
    expect(bad).toEqual([]);
  });

  it('l’embuscade tourne à l’échelle MER (10 m/case) — modèle NAVIRE-UNITÉ (MDG 13)', () => {
    // Combat naval OPÉRATIONNEL (couche Mer, plan combat-naval-modele §1bis) : 1 case = 10 m = 1 point de Distance
    // (MDG 13 l.362) → portées canon 50/75/150 m = 5/7,5/15 cases. Les coques agissent en UNITÉ (Tests
    // d'équipage, équipage passager) ; l'IA de coque manœuvre + fait feu. Les armes PERSO (rangeBandAt 2 m/case) ne
    // tirent PAS ici : leurs porteurs sont passagers (hors ordre) → l'échelle Mer ne les concerne jamais.
    const embuscade = project.find((s) => s.id === 'barge-du-sel-embuscade')! as any;
    expect(embuscade.metresPerTile).toBe(10);
    expect(sceneMetresPerTile(embuscade)).toBe(10);
    expect(isMerScene(embuscade)).toBe(true);
  });

  it('scene() FORWARDE `metresPerTile` au MapSpec compilé quand une scène (traversée) en demande une', () => {
    // Plumbing FIXÉ (lib.mjs déstructure + forwarde metresPerTile) : le champ n'est plus silencieusement perdu —
    // une future scène de TRAVERSÉE (mer ouverte) héritera réellement de son échelle. La grille d'abordage, elle,
    // ne le déclare pas (test ci-dessus).
    const sc = makeScene({ id: 'tmp-mer', nom: 'Mer ouverte', base: 'eau', rows: ['====', '===='], metresPerTile: 8 });
    expect(sceneMetresPerTile(sc)).toBe(8);
  });
});

/**
 * CHAÎNE NARRATIVE du chapitre (#684 gating de carte + #717 ouverture/clôture) — la campagne de test
 * porte les DEUX outils sur de la donnée réelle : le cap donné au quai révèle l'îlot ET sa route,
 * l'accostage pose le drapeau que lit la clôture.
 */
const ctx = (flags: Record<string, boolean> = {}): ConditionCtx => ({ flags, gameTime: 0 });
const CAP = 'sel-cap-donne';
const ACCOSTE = 'sel-ilot-accoste';

/** Effets d'un trigger nommé, quelle que soit la scène qui le porte. */
function triggerEffects(sceneId: string, triggerId: string): Effect[] {
  const sc = project.find((s) => s.id === sceneId)!;
  const trig = sc.triggers.find((t) => t.id === triggerId)!;
  const out: Effect[] = [];
  walkFlow(trig.flow, out);
  return out;
}

describe('chaîne narrative — le cap RÉVÈLE la route, l’accostage FERME le chapitre', () => {
  it('le lieu et la route de l’îlot portent le MÊME `when`, et la route dit sa raison au joueur', () => {
    const wm = doc.worldMap!;
    const ilot = wm.places.find((p) => p.id === 'ilot-du-sel')!;
    const route = wm.routes.find((r) => r.id === 'route-quai-ilot')!;
    expect(ilot.when).toEqual({ kind: 'flag', expr: CAP });
    expect(route.when).toEqual(ilot.when);
    expect(route.refus?.length ?? 0).toBeGreaterThan(0);
  });

  it('axe NŒUD : sans le cap, l’îlot n’existe pas sur la carte ; avec, il apparaît', () => {
    const wm = doc.worldMap!;
    expect(visiblePlaces(wm, ctx()).map((p) => p.id)).toEqual(['quai-du-sel']);
    expect(visiblePlaces(wm, ctx({ [CAP]: true })).map((p) => p.id)).toEqual(['quai-du-sel', 'ilot-du-sel']);
  });

  it('axe ARÊTE : sans le cap, aucune route ne part du quai ; avec, la traversée est offerte', () => {
    const wm = doc.worldMap!;
    expect(routesFrom(wm, 'quai-du-sel', ctx())).toEqual([]);
    expect(routesFrom(wm, 'quai-du-sel', ctx({ [CAP]: true })).map((r) => r.id)).toEqual(['route-quai-ilot']);
  });

  it('le drapeau du cap se pose sur le CHEMIN d’embarquement : le rect du trigger touche le décor qui ouvre la carte', () => {
    const effets = triggerEffects('barge-du-sel-quai', 'barge-du-sel-cap-donne');
    expect(effets.some((e) => e.type === 'setFlag' && e.flag === CAP)).toBe(true);

    const quai = project.find((s) => s.id === 'barge-du-sel-quai')!;
    const rect = quai.triggers.find((t) => t.id === 'barge-du-sel-cap-donne')!.rect;
    const embarquement = quai.entities.find((e) => {
      const eff: Effect[] = [];
      walkFlow(e.interact?.flow, eff);
      return eff.some((x) => x.type === 'openWorldMap');
    })!;
    // Le décor d'embarquement s'interagit à une adjacence de Chebyshev ≤ 1 (`interactEntity`) : si le
    // rect ne le TOUCHAIT pas, un joueur pourrait embarquer sans jamais poser le drapeau — la route
    // resterait fermée pour toujours. Ce contrat mord si le décor est un jour déplacé.
    const distances: number[] = [];
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++)
        distances.push(chebyshev({ x, y }, embarquement.pos));
    expect(Math.min(...distances)).toBeLessThanOrEqual(1);
  });

  it('l’accostage pose le drapeau que la CLÔTURE authorée relit', () => {
    const effets = triggerEffects('barge-du-sel-ilot', 'barge-du-sel-arrivee');
    expect(effets.some((e) => e.type === 'setFlag' && e.flag === ACCOSTE)).toBe(true);
    expect(doc.narratif.cloture!.when).toEqual({ kind: 'flag', expr: ACCOSTE });
  });

  it('l’OUVERTURE existe et est renseignée — sans elle, la borne du chapitre reste nulle et le récap ne compte AUCUN PX', () => {
    const o = doc.narratif.ouverture!;
    expect(o.titre.length).toBeGreaterThan(0);
    expect(o.pitch.length).toBeGreaterThan(0);
  });
});
