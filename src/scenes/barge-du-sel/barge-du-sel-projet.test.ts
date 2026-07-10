import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseProject } from '../../state/worldMap';
import { validateScene, type Warning } from '../../state/validateScene';
import { sceneMetresPerTile, type Scene, type Effect } from '../../state/scene';
import { findCreatureById, findVehicleById, findNavalTrait, findCrewRoleById } from '../../data';
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

  it('« La Louve grise » est une coque ALLIÉE armée d’UN canon à tribord, servable en jeu (crewIds vide)', () => {
    const sc = project.find((s) => s.id === 'barge-du-sel-embuscade')!;
    const louve = sc.entities.find((e) => e.id === 'louve-grise')!;
    expect(findVehicleById(louve.ref!)?.hull, 'la Louve grise est une coque').toBeTruthy();
    expect(louve.postes).toHaveLength(1);
    expect(louve.postes![0].side).toBe('tribord');
    expect(louve.postes![0].crewIds).toEqual([]); // aucun héros connu à l'authoring (#222)
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
    expect(v.name).toBe('La Louve grise');
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
      if (e.type === 'journal' && jargonPattern.test(e.text)) bad.push(`journal: "${e.text}"`);
      if (e.type === 'setObjective' && jargonPattern.test(e.text)) bad.push(`objectif: "${e.text}"`);
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

  it('la grille d’ABORDAGE tourne à l’échelle de combat CANONIQUE (2 m/case), pas à l’échelle MER', () => {
    // Le moteur tactique fixe 1 case = 2 m pour l'Allonge/l'engagement (reachTiles, LDB 15 l.55) ET les bandes
    // de portée d100 (rangeBandAt). Une échelle MER (metresPerTile≥4) sur une grille d'abordage désynchronise la
    // bordée (mesurée en mètres, batteryAffordance) des tirs de pièce (2 m/case en dur) et met la bordée hors de
    // portée (canon 75 m : 12 cases = 120 m à 10 m/case ⇒ refus). L'abordage reste donc à 2 m/case ; l'échelle
    // mer est réservée aux scènes de TRAVERSÉE.
    const embuscade = project.find((s) => s.id === 'barge-du-sel-embuscade')! as any;
    expect(embuscade.metresPerTile).toBeUndefined(); // défaut = 2 m/case
    expect(sceneMetresPerTile(embuscade)).toBe(2);
  });

  it('scene() FORWARDE `metresPerTile` au MapSpec compilé quand une scène (traversée) en demande une', () => {
    // Plumbing FIXÉ (lib.mjs déstructure + forwarde metresPerTile) : le champ n'est plus silencieusement perdu —
    // une future scène de TRAVERSÉE (mer ouverte) héritera réellement de son échelle. La grille d'abordage, elle,
    // ne le déclare pas (test ci-dessus).
    const sc = makeScene({ id: 'tmp-mer', nom: 'Mer ouverte', base: 'eau', rows: ['====', '===='], metresPerTile: 8 });
    expect(sceneMetresPerTile(sc)).toBe(8);
  });
});
