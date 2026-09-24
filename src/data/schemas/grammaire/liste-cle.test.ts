/**
 * Contrats de la CLÉ D'ÉLÉMENT de liste (#1897) — la marque que pose `listeCle`, le compteur
 * anti-perte (la descente unique `descendre`), la complétude du schéma de projet, et l'unicité prouvée à
 * la porte.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SCHEMA_DEFS } from '../_registry.generated';
import { SCHEMA_DEFS_SCENES } from '../_registry-scenes.generated';
import { projetSchema } from '../defs-scenes/projet';
import { sceneSchema } from '../defs-scenes/scene';
import { validateDocument, cheminLisible } from '../validate';
import { parseProject, ProjetRefuse } from '../../../state/worldMap';
import areneProjet from '../../../scenes/arene/arene-projet.json';
import { cleDe, clesPosees, clesRetrouvees, listeCle } from './liste-cle';
import { defDe, descendre, enfantsDe } from './descente';

/** Les listes à clé posées par les MODULES de schéma, avant tout test : la référence du compteur. */
const poseesParLesDefs = [...clesPosees()];

describe('compteur de clés — le seul détecteur du zéro SILENCIEUX', () => {
  it('une liste à clé `.superRefine`-ée HORS fabrique perd sa marque : la marche ne la retrouve plus', () => {
    const liste = listeCle(z.strictObject({ id: z.string() }), 'id');
    const clone = liste.superRefine(() => undefined);
    expect(cleDe(liste)?.nom).toBe('id');
    expect(cleDe(clone)).toBeUndefined();
    expect(clesPosees()).toContain(liste);
    expect(clesRetrouvees(z.strictObject({ l: clone }))).toEqual(new Set());
    expect(clesRetrouvees(z.strictObject({ l: liste.optional() }))).toEqual(new Set([liste]));
  });

  it('la marche des defs des DEUX racines retrouve TOUTE liste à clé posée par un module de schéma', () => {
    expect(poseesParLesDefs.length, 'aucune liste à clé posée : le compteur ne mesurerait rien').toBeGreaterThan(0);
    const retrouvees = new Set<object>();
    for (const { schema } of [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES]) for (const n of clesRetrouvees(schema)) retrouvees.add(n);
    const perdues = poseesParLesDefs.filter((n) => !retrouvees.has(n)).map((n) => cleDe(n)?.nom);
    expect(perdues, 'liste(s) à clé posée(s) puis clonée(s) hors fabrique (`.min`/`.refine` APRÈS `listeCle`) : leur clé ne nomme plus rien').toEqual([]);
  });
});

/**
 * Listes d'objets du schéma de projet dont l'élément déclare `id` SANS en être l'identité : l'`id` y
 * DÉSIGNE une entrée d'un autre document (référence de catalogue), la liste n'a pas de clé propre.
 * Clé = chemin de la marche, branches d'union effacées.
 */
const LISTES_DE_REFERENCES: Readonly<Record<string, string>> = {
  '.scenes[].triggers[].when.of[]': 'conditions composées : `id` d’un objet/talent désigné',
  '.scenes[].entities[].statblock.traits[]': 'références de Traits (`traits.json`)',
  '.scenes[].entities[].statblock.skills[]': 'références de Compétences (`skills.json`)',
  '.scenes[].entities[].statblock.talents[]': 'références de Talents (`talents.json`)',
  '.scenes[].entities[].upgrades[]': 'références d’Améliorations navales (`naval-traits.json`)',
  '.scenes[].entities[].combat.skills[]': 'références de Compétences (`skills.json`)',
  '.narratif.cloture.when.of[]': 'conditions composées : `id` d’un objet/talent désigné',
  '.worldMap.routes[].perils[].effects[]': 'effets de scène : `id` d’une cible désignée',
  '.narratif.presetsPnj[].profil.traits[]': 'références de Traits (`traits.json`)',
  '.narratif.presetsPnj[].profil.optionals[]': 'références de Traits optionnels (`traits.json`)',
  '.narratif.presetsPnj[].profil.optionals[].grant[]': 'octrois : `id` de Compétence/Talent désigné',
  '.narratif.presetsPnj[].profil.skills[]': 'références de Compétences (`skills.json`)',
  '.narratif.presetsPnj[].profil.talents[]': 'références de Talents (`talents.json`)',
  '.narratif.presetsPnj[].profil.trappings[]': 'références de Possessions (`trappings.json`)',
  '.narratif.presetsPnj[].profil.trappings[].qualities[]': 'références d’Atouts/Défauts (`qualities.json`)',
  '.narratif.presetsPnj[].profil.trappings[].choice[]': 'références de Possessions (`trappings.json`)',
};

/** Clés d'objet d'un élément de liste, à travers enveloppes ET branches d'union. */
function clesDeLElement(noeud: unknown, vus = new Set<unknown>()): string[] {
  const def = defDe(noeud);
  if (!def || vus.has(noeud)) return [];
  vus.add(noeud);
  if (def.shape) return Object.keys(def.shape);
  if (def.options) return [...new Set(def.options.flatMap((o) => clesDeLElement(o, vus)))];
  const enveloppe = enfantsDe(noeud).find((e) => e.segment === '');
  return enveloppe ? clesDeLElement(enveloppe.noeud, vus) : [];
}

/** Listes d'objets du schéma dont l'élément déclare `id`, avec leur chemin et leur marque de clé. */
function listesAId(schema: unknown): { chemin: string; cle?: string }[] {
  const out: { chemin: string; cle?: string }[] = [];
  descendre([schema], ({ noeud, def, path }) => {
    if (def.type === 'array' && clesDeLElement(def.element).includes('id')) out.push({ chemin: `${path.replace(/\|\d+/g, '')}[]`, cle: cleDe(noeud)?.nom });
  });
  return out;
}

describe('complétude — toute liste d’objets à `id` du schéma de projet DÉCLARE sa clé, ou se dit liste de RÉFÉRENCES', () => {
  const listes = listesAId(projetSchema);

  it('la marche VOIT les listes à `id` (une marche aveugle rendrait la garde vacueuse)', () => {
    expect(listes.map((l) => l.chemin)).toEqual(expect.arrayContaining(['.scenes[]', '.scenes[].entities[]', '.narratif.affaires[]']));
  });

  it('aucune liste à `id` n’est muette : clé déclarée par `listeCle`, ou exemption NOMMÉE', () => {
    const muettes = listes.filter((l) => l.cle === undefined && !(l.chemin in LISTES_DE_REFERENCES)).map((l) => l.chemin);
    expect(muettes, 'liste(s) d’objets à `id` sans clé : l’envelopper dans `listeCle(…, \'id\')` à son def, ou l’exempter comme liste de RÉFÉRENCES').toEqual([]);
  });

  it('une exemption ne couvre qu’une liste RÉELLE et SANS clé : la liste des références ne peut que décroître', () => {
    const parChemin = new Map(listes.map((l) => [l.chemin, l.cle]));
    const mortes = Object.keys(LISTES_DE_REFERENCES).filter((c) => !parChemin.has(c) || parChemin.get(c) !== undefined);
    expect(mortes).toEqual([]);
  });
});

describe('unicité PROUVÉE à la porte — un id répété dans une liste à clé est refusé, l’id nommé', () => {
  type Carte = { id: string; label: string; places: unknown[]; routes: unknown[] };
  type Doc = { scenes: Record<string, unknown[]>[]; worldMap?: Carte };
  const doublon = (muter: (d: Doc) => void): Doc => {
    const d = structuredClone(areneProjet) as unknown as Doc;
    muter(d);
    return d;
  };
  const repete = <T,>(liste: T[]): void => {
    liste.push(structuredClone(liste[0]));
  };
  const lieu = { id: 'lieu-1', label: 'Lieu', pos: { x: 1, y: 1 }, scene: 'arene-zone1' };
  const route = { id: 'route-1', a: 'lieu-1', b: 'lieu-1', km: 1, modes: ['pied'] };
  const noeud = { id: 'n1', desc: 'x', choices: [] };
  const CAS: [string, (d: Doc) => void, string][] = [
    ['une entité', (d) => repete(d.scenes[0].entities), 'entities'],
    ['un déclencheur', (d) => { d.scenes[0].triggers = [{ id: 't1', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'seq', steps: [] } }]; repete(d.scenes[0].triggers); }, 'triggers'],
    ['un nœud de dialogue', (d) => { d.scenes[0].dialogues = [{ id: 'd1', start: 'n1', nodes: [noeud, noeud] }]; }, 'nodes'],
    ['un lieu', (d) => { d.worldMap = { id: 'carte', label: 'Carte', places: [lieu, lieu], routes: [] }; }, 'places'],
    ['une route', (d) => { d.worldMap = { id: 'carte', label: 'Carte', places: [lieu], routes: [route, route] }; }, 'routes'],
  ];

  it.each(CAS)('%s en double : `projetSchema` et `parseProject` la refusent', (_nom, muter, liste) => {
    const doc = doublon(muter);
    const fautes = validateDocument(projetSchema, doc);
    expect(fautes?.map((f) => `${cheminLisible(f.lieu)}: ${f.message}`)).toEqual([expect.stringMatching(new RegExp(`${liste} « [^»]+ »: « [^»]+ » dupliqué`))]);
    let refus: unknown;
    try {
      parseProject(doc);
    } catch (e) {
      refus = e;
    }
    expect(refus).toBeInstanceOf(ProjetRefuse);
    expect((refus as ProjetRefuse).fautes.map((f) => f.code)).toEqual(['custom']);
  });

  it('`sceneSchema` seul refuse une entité répétée (la scène VIVANTE de l’éditeur passe par lui)', () => {
    const scene = doublon((d) => repete(d.scenes[0].entities)).scenes[0];
    expect(validateDocument(sceneSchema, scene)?.map((f) => f.message)).toEqual([expect.stringMatching(/dupliqué : « id » identifie l’élément/)]);
  });
});
