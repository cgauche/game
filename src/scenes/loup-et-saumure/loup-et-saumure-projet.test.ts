import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseProject } from '../../state/worldMap';
import { validateScene, type Warning } from '../../state/validateScene';
import type { Scene } from '../../state/scene';
import { findCreatureById, findVehicleById } from '../../data';

/**
 * « Le Loup et la Saumure » — projet de données pures GÉNÉRÉ par `scripts/loup-et-saumure/generate.mjs`
 * (source canonique = le générateur, comme `scripts/arene/generate.mjs` → `arene-projet.json`) : ce test
 * verrouille que le JSON produit est VALIDE (transitions/dialogues/ids/carte du monde) et que chaque
 * combattant référence une vraie créature OU un vrai navire (`vehicles.json`) du catalogue — la campagne
 * navale enrôle des COQUES (`ref` de `vehicles.json`), absentes du bestiaire par construction.
 */
const doc = parseProject(JSON.parse(readFileSync(join(__dirname, 'loup-et-saumure-projet.json'), 'utf8')));
const project: Scene[] = doc.scenes;

/** Toutes les entités ENRÔLÉES dans une rencontre (celles référencées par `EncounterDef.members`). */
function enrolledEntities(scene: Scene) {
  const byId = new Map(scene.entities.map((e) => [e.id, e] as const));
  return scene.encounters.flatMap((enc) => (enc.members ?? []).map((m) => byId.get(m.entityId)!));
}

describe('Le Loup et la Saumure — projet de données (naval, zéro code applicatif)', () => {
  it('5 scènes dans l’ordre des actes : quai de départ, cogue, escale, Olg, épilogue', () => {
    expect(project.map((s) => s.id)).toEqual([
      'ls-quai-salzenmund',
      'ls-abordage-cogue',
      'ls-quai-erengrad',
      'ls-abordage-olg',
      'ls-epilogue-salzenmund',
    ]);
  });

  it('CARTE DU MONDE : Salzenmund ⇄ Erengrad, DEUX routes maritimes (aller/retour), chacune avec son embuscade', () => {
    const wm = doc.worldMap!;
    expect(wm.places.map((p) => p.id)).toEqual(['salzenmund', 'erengrad']);
    for (const p of wm.places) {
      expect(p.port, `port de ${p.id}`).toBeTruthy();
      expect(p.port!.taille).toBe(4);
      expect(p.port!.richesse).toBe(4);
    }
    expect(wm.routes).toHaveLength(2);
    expect(wm.routes.every((r) => r.sea)).toBe(true);
    expect(wm.routes.every((r) => r.km === 550)).toBe(true); // 550 milles RAW (synopsis de référence)
    const ambushScenes = wm.routes.map((r) => r.ambush?.scene).sort();
    expect(ambushScenes).toEqual(['ls-abordage-cogue', 'ls-abordage-olg']);
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

  it('les DEUX combats navals enrôlent une coque ALLIÉE (le Grimm) et une coque ENNEMIE, chacune avec des postes servables', () => {
    for (const [sceneId, allyId, enemyId] of [
      ['ls-abordage-cogue', 'grimm', 'cogue'],
      ['ls-abordage-olg', 'grimm2', 'serpent-de-sel'],
    ] as const) {
      const sc = project.find((s) => s.id === sceneId)!;
      const ally = sc.entities.find((e) => e.id === allyId)!;
      const enemy = sc.entities.find((e) => e.id === enemyId)!;
      expect(findVehicleById(ally.ref!)?.hull, `${allyId} est une coque`).toBeTruthy();
      expect(findVehicleById(enemy.ref!)?.hull, `${enemyId} est une coque`).toBeTruthy();
      // Postes SANS chef pré-assigné (servables en jeu par les héros — cf. `state/shipPostes.ts`
      // servablePostes/serveAtPoste) : aucun id de héros n'est connu à l'authoring de campagne.
      expect((ally.postes ?? []).length).toBeGreaterThan(0);
      for (const p of ally.postes ?? []) expect(p.crewIds).toEqual([]);
    }
  });

  it('la Dent de Manann (cogue) porte son équipage exposé (crewIds) référencé par de vraies entités', () => {
    const sc = project.find((s) => s.id === 'ls-abordage-cogue')!;
    const cogue = sc.entities.find((e) => e.id === 'cogue')!;
    expect(cogue.crewIds!.length).toBeGreaterThan(0);
    const entIds = new Set(sc.entities.map((e) => e.id));
    for (const id of cogue.crewIds!) expect(entIds.has(id), `équipage exposé ${id}`).toBe(true);
  });

  it('Olg Blóðsalt (référence exacte du bestiaire, MDG 07) est bien le boss de l’abordage final', () => {
    const sc = project.find((s) => s.id === 'ls-abordage-olg')!;
    const olg = sc.entities.find((e) => e.id === 'olg')!;
    expect(olg.ref).toBe('olg-blodsalt');
    expect(findCreatureById('olg-blodsalt')).toBeTruthy();
    const enc = sc.encounters.find((e) => e.id === 'enc-olg')!;
    expect(enc.members!.some((m) => m.entityId === 'olg' && m.side === 'enemy')).toBe(true);
  });

  it('la commission de Köhler est la PRÉMISSE assumée : accepter donne l’avance ET le Grimm (setVessel)', () => {
    const sc = project.find((s) => s.id === 'ls-quai-salzenmund')!;
    const dlg = sc.dialogues.find((d) => d.id === 'dlg-kohler')!;
    const accept = dlg.nodes.flatMap((n) => n.choices).find((c) => /Accepter la commission/.test(c.text))!;
    const steps = accept.flow!.kind === 'seq' ? accept.flow!.steps : [];
    const types = steps.map((s) => (s.kind === 'do' ? s.effect.type : s.kind));
    expect(types).toEqual(expect.arrayContaining(['giveMoney', 'setVessel', 'setFlag', 'journal']));
  });

  it('VITRINE : un Test (Intuition) et un Test ÉTENDU (réparation de coque) sont bien mis en scène', () => {
    const erengrad = project.find((s) => s.id === 'ls-quai-erengrad')!;
    const salzenmund = project.find((s) => s.id === 'ls-quai-salzenmund')!;
    const hasTest = (scene: Scene) => scene.dialogues.some((d) => d.nodes.some((n) => n.choices.some((c) => c.flow?.kind === 'test')));
    expect(hasTest(salzenmund) || hasTest(erengrad)).toBe(true);
    const reparation = erengrad.dialogues.find((d) => d.id === 'dlg-reparation')!;
    const choice = reparation.nodes[0].choices.find((c) => c.flow?.kind === 'seq' && c.flow.steps.some((s) => s.kind === 'do' && s.effect.type === 'extendedTest'));
    expect(choice, 'extendedTest présent').toBeTruthy();
  });

  it('chaque combat enrôlé spawn sur une case MARCHABLE de la carte (footprint des coques compris)', () => {
    const bad: string[] = [];
    for (const sc of project)
      for (const e of enrolledEntities(sc)) {
        const { x, y } = e.pos;
        const inBounds = x >= 0 && y >= 0 && x < sc.dimensions.w && y < sc.dimensions.h;
        if (!inBounds) bad.push(`${sc.id}:${e.id}@(${x},${y})`);
      }
    expect(bad).toEqual([]);
  });
});
