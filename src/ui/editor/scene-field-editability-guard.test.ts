import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  auditSceneFieldEditability,
  orphanFields,
  sceneScope,
  repoProgram,
  virtualProgram,
  VIRTUAL_ROOT,
} from '../../../scripts/guards/lib/sceneFieldEditability.mjs';

/**
 * GARDE #841 — « toute donnée de la scène s'édite au clic, sans dépendre d'une IA » (directive
 * utilisateur du 2026-07-26, verbatim : « Assure toi toujours qu'on doit pouvoir éditer toutes les
 * données de la scene, on ne doit pas dépendre d'une IA »).
 *
 * Le défaut que cette garde ferme n'est pas une liste de 22 champs — c'est la CLASSE : un champ peut
 * naître au modèle, être lu par le moteur, et n'avoir pour seul écrivain le compilateur d'authoring
 * (`mapSpec.ts`) ou un script. Rien ne casse ; l'auteur découvre le trou en cherchant le contrôle qui
 * n'existe pas.
 *
 * Deux propriétés font que cette garde MESURE quelque chose, et elles sont éprouvées ici :
 *  - le périmètre se DÉRIVE du type `Scene` par le TypeChecker (types imbriqués, unions, littéraux
 *    anonymes, `Record<K,V>` compris) — aucune liste de types tenue à la main ;
 *  - le crédit d'écriture est RATTACHÉ AU TYPE porteur : un `{ once: … }` de symptôme de maladie ou
 *    un `{ flags }` passé en lecture à un contexte d'évaluation ne crédite aucun champ de `Scene`.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..');

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

/**
 * CLIQUET DÉCROISSANT — les champs du document de scène qu'AUCUN contrôle d'interface n'écrit
 * aujourd'hui. La liste NOMME chaque trou (jamais une exemption par forme de fichier, de type ou de
 * nom) et l'assertion est une ÉGALITÉ : un trou nouveau échoue, un trou comblé échoue aussi tant que
 * la ligne n'est pas retirée. Elle ne peut donc que décroître.
 *
 * `Scene.flags` (`src/state/scene.ts:706`) : `setSceneFlags` (`src/state/sceneEdit.ts:481`) est
 * complet, testé et ré-exporté par `src/ui/editor/editorState.ts:52` — et appelé par aucun composant.
 * Mesure du 2026-07-26 : 43 primitives de `sceneEdit.ts` atteintes depuis `src/ui/**`, 4 non
 * atteintes (`setSceneFlags`, `patchEntityCombat`, `putLayer`, `addBuilding`) ; seule la première
 * laisse un champ sans aucun autre écrivain d'interface.
 */
const TROUS_CONNUS = ['Scene.flags'];

describe('#841 — chaque champ du document de scène a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR', () => {
  it('aucun champ n’est joignable seulement par le pipeline d’authoring, hors cliquet nommé', () => {
    const orphelins = orphanFields(auditSceneFieldEditability(ROOT));
    // Rendu en TEXTE : l'échec doit NOMMER les champs et leur `fichier:ligne`, pas afficher « …(9) ».
    const detail = orphelins
      .map((r) => `${r.id} (${r.at}) — écrivains : ${r.pipeline.join(', ') || 'AUCUN'}`)
      .join('\n');
    expect(ids(orphelins).sort(), detail).toEqual([...TROUS_CONNUS].sort());
  });

  it('crédite une écriture qui traverse `Array.map` — sonde réelle : `SceneEffectZone.tiles` ← `mapSpec.ts`', () => {
    // Un littéral rendu par un callback de `map` perd sa freshness : `getContextualType` ne le
    // rattache à rien, et `tsc` lui-même ne signale pas la suppression du champ écrit. Un champ
    // vivant y était donc rapporté « écrivains : AUCUN » — un faux négatif qui invite à supprimer du
    // code vivant. `src/state/mapSpec.ts:902` (`const namedZones: SceneEffectZone[] = […].map(…)`)
    // est la sonde : l'annotation de la collection porte le type, la garde doit la lire.
    const rows = auditSceneFieldEditability(ROOT);
    const zone = (field: string) => rows.find((r) => r.id === `SceneEffectZone.${field}`);
    for (const field of ['tiles', 'area', 'id', 'label', 'z']) {
      expect(zone(field)?.pipeline, `SceneEffectZone.${field} sans écrivain de pipeline`).toContain(
        'src/state/mapSpec.ts'
      );
    }
    // Le littéral IMBRIQUÉ dans ce même retour de callback est crédité aussi — mais seulement sur le
    // membre d'union réellement écrit (`kind: 'rect'`), jamais sur `disc`.
    expect(zone('area.w')?.pipeline).toContain('src/state/mapSpec.ts');
    expect(zone('area.radius')?.pipeline).not.toContain('src/state/mapSpec.ts');
  });

  it('NON VACANTE (c) : à travers `Array.map`, seule l’annotation de la COLLECTION crédite — pas un homonyme', () => {
    const program = virtualProgram({
      'src/state/scene.ts': `export interface SceneEffectZone { id: string; tiles: number[] }
export interface Scene { id: string; effectZones: SceneEffectZone[]; layers: SceneEffectZone[] }\n`,
      // (a) annotation de collection, (b) type de retour annoté, (c) `push` dans un tableau annoté,
      // (d) `map` imbriqué — les quatre formes réelles du dépôt.
      'src/ui/Zonage.ts': `import type { Scene, SceneEffectZone } from '../state/scene';
declare const blocs: { key: string; cells: number[]; sous: { key: string; cells: number[] }[] }[];
declare function setScene(s: Scene): void;

export const zoner = (s: Scene): Scene => {
  const zones: SceneEffectZone[] = blocs.map((b) => ({ id: b.key, tiles: b.cells }));
  setScene({ ...s, effectZones: zones });
  return s;
};

function calques(): SceneEffectZone[][] {
  return blocs.map((b) => b.sous.map((c) => ({ id: c.key, tiles: c.cells })));
}

export const empiler = (s: Scene): Scene => {
  const layers: SceneEffectZone[] = [];
  for (const groupe of calques()) layers.push(...groupe);
  layers.push({ id: 'socle', tiles: [] });
  return { ...s, layers, id: s.id };
};\n`,
      // Même forme de littéral, même dossier, même `Array.map` — mais l'annotation désigne un type
      // ÉTRANGER qui partage `id` et `tiles`. Aucun crédit ne doit lui être attribué.
      'src/ui/Calque.ts': `interface RegionDeCalque { id: string; tiles: number[] }
declare const blocs: { key: string; cells: number[] }[];
declare function tracer(regions: RegionDeCalque[]): void;
export const tracerCalque = () => {
  const regions: RegionDeCalque[] = blocs.map((b) => ({ id: b.key, tiles: b.cells }));
  tracer(regions);
};\n`,
    });
    const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
    expect(ids(orphanFields(rows))).toEqual([]);
    for (const id of ['SceneEffectZone.id', 'SceneEffectZone.tiles']) {
      expect(rows.find((r) => r.id === id)?.authors, id).toEqual(['src/ui/Zonage.ts']);
    }
  });

  it('le périmètre se dérive du type `Scene` — types imbriqués, unions et littéraux anonymes compris', () => {
    const scope = sceneScope(repoProgram(ROOT), ROOT);
    const all = new Set(ids(scope));
    // Champs qu'un scanner limité aux interfaces atteignables « à la main » manque : ils vivent dans
    // des types que seule la traversée du type `Scene` ramène.
    for (const id of [
      'Scene.dimensions.w', // littéral anonyme d'une propriété
      'Scene.entryPoints.x', // valeur d'un Record<K,V>
      'Dialogue.nodes',
      'DialogueNode.choices',
      'DialogueChoice.cost.gold',
      'EncounterDef.victoryCondition',
      'EncounterMember.ridesEntityId',
      'WallClimb.requiresGrimpeur',
      'FacadeFeature.edge',
      'RoofDefaults.pitchDeg',
      'SceneEffectZone.area.radius', // membre `disc` de l'union ZoneArea
      'EncounterDef.victoryCondition.belowPercent', // membre de l'union VictoryCondition
    ]) {
      expect(all, `${id} hors du périmètre dérivé`).toContain(id);
    }
  });

  it('NON VACANTE (a) : un champ frais, écrit par personne, est rapporté orphelin', () => {
    const program = virtualProgram({
      'src/state/scene.ts': `export interface Scene {
  id: string;
  champFraisSansControle?: string;
}\n`,
      'src/ui/Editeur.ts': `import type { Scene } from '../state/scene';
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
    expect(ids(rows).sort()).toEqual(['Scene.champFraisSansControle', 'Scene.id']);
    expect(ids(orphanFields(rows))).toEqual(['Scene.champFraisSansControle']);
  });

  it('NON VACANTE (b) : un champ dont le seul « écrivain » est un HOMONYME d’un autre type reste orphelin', () => {
    const program = virtualProgram({
      'src/state/scene.ts': `export interface Scene {
  id: string;
  flags: Record<string, boolean>;
}\n`,
      // Deux littéraux de forme IDENTIQUE, dans le même dossier d'éditeur : seul celui dont le type
      // porteur est `Scene` écrit la scène. L'autre remplit le contexte d'évaluation d'un `when`.
      'src/ui/Editeur.ts': `import type { Scene } from '../state/scene';
interface ContexteDeCondition { flags: Record<string, boolean>; gameTime: number }
declare function evalCondition(ctx: ContexteDeCondition): boolean;

export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });
export const visible = (flags: Record<string, boolean>, gameTime: number) =>
  evalCondition({ flags, gameTime });\n`,
    });
    const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
    expect(ids(orphanFields(rows))).toEqual(['Scene.flags']);
    // …et le témoin positif du même fichier : `id` est bien crédité, la garde n'est pas aveugle.
    expect(rows.find((r) => r.id === 'Scene.id')?.authors).toEqual(['src/ui/Editeur.ts']);
  });

  it('le crédit suit les MAPPINGS du chemin d’édition réel (`Partial<T>`, patch passé en argument)', () => {
    const program = virtualProgram({
      'src/state/scene.ts': `export interface WallSeg { x: number; window?: boolean }
export interface Scene { walls: WallSeg[] }\n`,
      'src/ui/Inspecteur.ts': `import type { Scene, WallSeg } from '../state/scene';
declare function patchWall(s: Scene, i: number, patch: Partial<WallSeg>): Scene;
declare function setScene(s: Scene): void;
export const cocherFenetre = (s: Scene, i: number, v: boolean) => setScene(patchWall(s, i, { window: v }));
export const poserMur = (s: Scene, x: number): Scene => ({ ...s, walls: [...s.walls, { x }] });\n`,
    });
    const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
    expect(ids(orphanFields(rows))).toEqual([]);
  });

  // Reconstitution du défaut RÉEL de `Scene.flags` : `sceneEdit.ts` n'est pas une interface. Une
  // primitive qui y vit peut être complète, testée et ré-exportée par l'éditeur sans qu'aucun
  // composant ne l'appelle — le travail s'arrête à la porte de l'interface, et seul un APPELANT
  // distingue ce cas d'un vrai chemin d'édition.
  const PONT = {
    'src/state/scene.ts': `export interface Scene { id: string; flags: Record<string, boolean>; notes: string }\n`,
    'src/state/sceneEdit.ts': `import type { Scene } from './scene';
export function setSceneFlags(s: Scene, patch: Record<string, boolean>): Scene {
  return { ...s, flags: { ...s.flags, ...patch } };
}
export function setNotes(s: Scene, v: string): Scene {
  return { ...s, notes: v };
}\n`,
    'src/ui/editor/editorState.ts': `export { setSceneFlags, setNotes } from '../../state/sceneEdit';\n`,
  };

  it('NON VACANTE (d) : une primitive hors interface RÉ-EXPORTÉE mais jamais APPELÉE ne crédite rien', () => {
    const program = virtualProgram({
      ...PONT,
      // L'inspecteur appelle `setNotes` et n'appelle jamais `setSceneFlags` — exactement l'état du
      // dépôt au 2026-07-26. Le ré-export n'est PAS un appelant.
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../state/scene';
import { setNotes } from './editorState';
declare function setScene(s: Scene): void;
export const saisirNotes = (s: Scene, v: string) => setScene(setNotes(s, v));
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
    expect(ids(orphanFields(rows))).toEqual(['Scene.flags']);
    // Témoins positifs : la primitive APPELÉE crédite, et l'écriture directe de l'interface aussi.
    expect(rows.find((r) => r.id === 'Scene.notes')?.authors).toEqual(['src/state/sceneEdit.ts']);
    expect(rows.find((r) => r.id === 'Scene.id')?.authors).toEqual(['src/ui/editor/Inspecteur.ts']);
  });

  it('NON VACANTE (e) : un HOMONYME appelé depuis l’interface ne réveille pas la primitive muette', () => {
    const program = virtualProgram({
      ...PONT,
      // Même NOM, autre module (hors chemin de l'auteur) : la fermeture d'appels résout un SYMBOLE,
      // pas un nom — l'appel ci-dessous ne rend pas `sceneEdit.setSceneFlags` atteignable.
      'src/state/runtimeFlags.ts': `import type { Scene } from './scene';
export function setSceneFlags(s: Scene, patch: Record<string, boolean>): Scene {
  return { ...s, flags: patch };
}\n`,
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../state/scene';
import { setNotes } from './editorState';
import { setSceneFlags } from '../../state/runtimeFlags';
declare function setScene(s: Scene): void;
export const saisirNotes = (s: Scene, v: string) => setScene(setNotes(s, v));
export const basculer = (s: Scene, k: string) => setScene(setSceneFlags(s, { [k]: true }));
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    expect(ids(orphanFields(auditSceneFieldEditability(VIRTUAL_ROOT, program)))).toEqual(['Scene.flags']);
  });

  it('un APPELANT d’interface, même indirect via une autre primitive appelée, crédite', () => {
    const program = virtualProgram({
      ...PONT,
      // Chaîne `Inspecteur → setNotes → setSceneFlags` : l'atteignabilité est TRANSITIVE.
      'src/state/sceneEdit.ts': `import type { Scene } from './scene';
export function setSceneFlags(s: Scene, patch: Record<string, boolean>): Scene {
  return { ...s, flags: { ...s.flags, ...patch } };
}
export function setNotes(s: Scene, v: string): Scene {
  return setSceneFlags({ ...s, notes: v }, { touche: true });
}\n`,
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../state/scene';
import { setNotes } from './editorState';
declare function setScene(s: Scene): void;
export const saisirNotes = (s: Scene, v: string) => setScene(setNotes(s, v));
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    expect(ids(orphanFields(auditSceneFieldEditability(VIRTUAL_ROOT, program)))).toEqual([]);
  });
});
