import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { emptyScene, type Scene } from '../../state/scene';
import { validateScene } from '../../state/validateScene';
import { changePropRef, deleteSel, moveSel, eraseAt } from './editorState';
import {
  editEntity,
  editEntityCombat,
  moveEntityTo,
  removeEntity,
  seatOccupant,
  setPosteCrew,
  setPosteSide,
  setPosteEngine,
} from '../../state/sceneEdit';

/**
 * INVARIANT DE SOCLE #2 — UN SEUL SEAM D'ASSISE.
 *
 * Toute mutation d'éditeur qui touche une entité EXISTANTE (pos, facing, z, ref, suppression — meuble
 * OU corps) traverse `normaliseAssises`. Le défaut que cette garde ferme n'est pas une liste de
 * primitives : c'est la CLASSE « une Nᵉ porte d'écriture d'`entities` s'ouvre et contourne l'assise ».
 * Précédent mesuré : le `<select>` Orientation de l'inspecteur écrivait `entities` en direct, et
 * tourner un meuble attablé produisait un document que `validateScene` refuse.
 *
 * Deux propriétés la rendent réfutable :
 *  - le périmètre se DÉRIVE de la SOURCE (toute fonction exportée de `sceneEdit.ts`/`editorState.ts`
 *    dont le corps réécrit/filtre `entities` ou patche une entité) — aucune liste tenue à la main ;
 *  - l'oracle est le VALIDATEUR DU DOCUMENT (`validateScene`), pas une reformulation de la règle.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SOURCES = ['src/state/sceneEdit.ts', 'src/ui/editor/editorState.ts'];

/** Retire commentaires de ligne et de bloc — un motif interdit CITé en prose n'est pas une écriture. */
const sansCommentaires = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/**
 * Découpe un module en primitives EXPORTées : nom → corps (jusqu'à l'export suivant, quel qu'il
 * soit — `type`, `interface`, `const`… : la borne doit être la plus proche, sans quoi un corps
 * avale le voisin). Les deux formes réelles du dépôt sont couvertes : `export function f(…)` ET
 * `export const f = (…) => …` — une garde qui ne connaît que la première s'évalue à la syntaxe
 * choisie par l'écrivain, pas à ce qu'il fait.
 */
function exportedBodies(rel: string): Map<string, string> {
  const src = sansCommentaires(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  const out = new Map<string, string>();
  const bornes = [...src.matchAll(/^export\b.*$/gm)];
  bornes.forEach((m, i) => {
    const nomme = /^export (?:async )?function (\w+)/.exec(m[0]) ?? /^export const (\w+)\s*[:=]/.exec(m[0]);
    if (!nomme) return;
    const debut = m.index!;
    const fin = i + 1 < bornes.length ? bornes[i + 1].index! : src.length;
    out.set(nomme[1], src.slice(debut, fin));
  });
  return out;
}

/** Écrit-elle une entité EXISTANTE ? (réécriture/filtre d'`entities`, ou patch d'entité) */
const muteUneEntite = (body: string) =>
  /entities:\s*\w+\.entities\.(map|filter)\(/.test(body) || /\bpatchEntity(Combat)?\(/.test(body);

/** Traverse-t-elle le seam ? Directement, ou par une primitive qui le fait (fermeture transitive). */
function traverseLeSeam(bodies: Map<string, string>, nom: string, vus = new Set<string>()): boolean {
  if (vus.has(nom)) return false;
  vus.add(nom);
  const body = bodies.get(nom);
  if (!body) return false;
  if (/\bnormaliseAssises\(/.test(body)) return true;
  for (const autre of bodies.keys())
    if (autre !== nom && new RegExp(`\\b${autre}\\(`).test(body) && traverseLeSeam(bodies, autre, vus)) return true;
  return false;
}

/**
 * CLIQUET NOMMÉ — les écrivains d'entité qui NE traversent PAS le seam. Chacun porte sa raison ; la
 * liste ne peut que décroître, et un écrivain nouveau y échoue tant qu'il n'est pas classé.
 * `patchEntity`/`patchEntityCombat` sont les écritures MÉCANIQUES sur lesquelles le seam est bâti :
 * elles ne peuvent pas se composer à travers lui. Leur usage direct depuis `src/ui/**` est fermé par
 * le troisième test.
 */
const HORS_SEAM: Record<string, string> = {
  patchEntity: 'écriture mécanique — le seam la compose (editEntity), elle ne peut pas le composer',
  patchEntityCombat: 'écriture mécanique — le seam la compose (editEntityCombat)',
};

describe('INVARIANT #2 — un seul seam d’assise pour toute mutation d’entité', () => {
  it('toute primitive exportée qui mute une entité existante traverse `normaliseAssises`', () => {
    const manquantes: string[] = [];
    for (const rel of SOURCES) {
      const bodies = exportedBodies(rel);
      for (const [nom, body] of bodies) {
        if (!muteUneEntite(body) || HORS_SEAM[nom]) continue;
        if (!traverseLeSeam(bodies, nom)) manquantes.push(`${rel} :: ${nom}`);
      }
    }
    expect(manquantes, `écrivain(s) d’entité hors seam :\n${manquantes.join('\n')}`).toEqual([]);
  });

  it('le balayage n’est PAS vacant — il voit les écrivains réels des deux modules', () => {
    const vus = new Map<string, string[]>();
    for (const rel of SOURCES)
      vus.set(rel, [...exportedBodies(rel)].filter(([, body]) => muteUneEntite(body)).map(([nom]) => nom));
    for (const attendu of ['patchEntity', 'patchEntityCombat', 'editEntity', 'editEntityCombat', 'moveEntityTo', 'removeEntity'])
      expect(vus.get('src/state/sceneEdit.ts'), `${attendu} devrait être vu comme écrivain d’entité`).toContain(attendu);
    expect(vus.get('src/ui/editor/editorState.ts')).toContain('deleteSel');
  });

  it('le cliquet ne porte aucune entrée PÉRIMÉE (primitive disparue ou rentrée dans le rang)', () => {
    const tous = new Map<string, string>();
    for (const rel of SOURCES) for (const [nom, body] of exportedBodies(rel)) tous.set(nom, body);
    for (const nom of Object.keys(HORS_SEAM)) {
      expect(tous.has(nom), `${nom} n’existe plus — retire-le de HORS_SEAM`).toBe(true);
      expect(muteUneEntite(tous.get(nom)!), `${nom} ne mute plus d’entité — retire-le de HORS_SEAM`).toBe(true);
    }
  });

  /**
   * Écrit-on `entities` en DIRECT dans ce texte de module ? Rend les motifs fautifs, vides sinon.
   *
   * Trois pièges mesurés, tous fermés ici :
   *  - le scan PAR LIGNE laissait passer la forme en DEUX temps (`const suivantes = scene.entities
   *    .map(…)` puis `entities: suivantes`) — l'analyse porte donc sur le texte ENTIER ;
   *  - `scene.entities.map(…)` est aussi la lecture LICITE d'une liste à afficher : seule la
   *    valeur posée SUR la clé `entities:` d'un littéral compte, directement ou par sa variable ;
   *  - un ajout (`entities: […scene.entities, ent]`) ne peut invalider aucune assise : il passe.
   */
  function ecrituresDirectes(texte: string): string[] {
    const src = sansCommentaires(texte);
    const fautifs: string[] = [];
    for (const m of src.matchAll(/\bpatchEntity(?:Combat)?\(/g)) fautifs.push(m[0]);
    for (const m of src.matchAll(/(?<![.\w$])entities\s*:\s*([^,;\n]+)/g)) {
      const valeur = m[1].trim();
      if (/^\[/.test(valeur)) continue; // ajout : jamais destructeur pour une assise
      if (/\.entities\s*\.\s*(map|filter)\s*\(/.test(valeur)) { fautifs.push(m[0].trim()); continue; }
      const via = /^(\w+)/.exec(valeur);
      if (via && new RegExp(`(?:const|let|var)\\s+${via[1]}\\s*(?::[^=]+)?=[^;\\n]*\\.entities\\s*\\.\\s*(?:map|filter)\\s*\\(`).test(src))
        fautifs.push(`${m[0].trim()}  (via ${via[1]})`);
    }
    return fautifs;
  }

  /**
   * CLIQUET NOMMÉ du balayage d'interface. `editorState.ts` EST le module de primitives d'édition de
   * `src/ui` : ses écritures d'`entities` sont couvertes par le balayage structurel ci-dessus, qui
   * exige d'elles la traversée du seam. Aucun autre fichier de `src/ui/**` n'a le droit d'écrire.
   */
  const UI_PRIMITIVES = ['src/ui/editor/editorState.ts'];

  it('aucun fichier de `src/ui/**` n’écrit `entities` en direct', () => {
    // Le défaut I1 était exactement là : un `onChange` de composant réécrivait `scene.entities` sans
    // passer par une primitive. Le balayage couvre `.ts` ET `.tsx` : un module utilitaire de
    // `src/ui/**` n'est pas moins une porte qu'un composant.
    const fautifs: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) continue;
        const rel = path.relative(ROOT, p).replace(/\\/g, '/');
        if (UI_PRIMITIVES.includes(rel)) continue;
        for (const motif of ecrituresDirectes(fs.readFileSync(p, 'utf8'))) fautifs.push(`${rel} :: ${motif}`);
      }
    };
    walk(path.join(ROOT, 'src', 'ui'));
    expect(fautifs, `écriture d’entité en direct depuis l’interface :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('le cliquet d’interface ne porte aucune entrée PÉRIMÉE', () => {
    for (const rel of UI_PRIMITIVES) {
      expect(fs.existsSync(path.join(ROOT, rel)), `${rel} n’existe plus`).toBe(true);
      expect(
        ecrituresDirectes(fs.readFileSync(path.join(ROOT, rel), 'utf8')).length,
        `${rel} n’écrit plus d’entité — retire-le de UI_PRIMITIVES`,
      ).toBeGreaterThan(0);
    }
  });

  it('le balayage d’interface voit les TROIS formes du défaut, et laisse passer la lecture', () => {
    // (a) une ligne, (b) deux lignes par variable, (c) l'écriture mécanique.
    expect(ecrituresDirectes('setScene({ ...s, entities: s.entities.map((e) => e) });')).toHaveLength(1);
    expect(ecrituresDirectes('const suivantes = scene.entities.map((e) => e);\nsetScene({ ...s, entities: suivantes });')).toHaveLength(1);
    expect(ecrituresDirectes('setScene(patchEntity(s, id, patch));')).toHaveLength(1);
    // Lecture d'une liste à afficher, et ajout : licites.
    expect(ecrituresDirectes('const pnjs = scene.entities.filter((e) => e.kind === 1);')).toEqual([]);
    expect(ecrituresDirectes('return { ...scene, entities: [...scene.entities, ent] };')).toEqual([]);
    // Un motif CITÉ en commentaire n'est pas une écriture.
    expect(ecrituresDirectes('// jamais entities: scene.entities.map((e) => e) ici')).toEqual([]);
  });

  /**
   * ORACLE COMPORTEMENTAL — chaque primitive d'édition d'entité, appliquée à une scène HOSTILE
   * (meuble attablé + recoin cerné de murs), rend un document que `validateScene` accepte.
   */
  describe('aucune primitive ne rend un document que `validateScene` refuse', () => {
    /** Table ronde attablée en (2,2) ; colonne x≥6 murée, avec un recoin d'UNE case en (7,7). */
    function hostile(): Scene {
      const s = emptyScene(10, 10);
      const tiles: string[] = new Array(100).fill('plancher');
      for (let y = 0; y < 10; y++) for (let x = 6; x < 10; x++) tiles[y * 10 + x] = 'mur';
      tiles[7 * 10 + 7] = 'plancher';
      s.layers = [{ z: 0, tiles: tiles as Scene['layers'][number]['tiles'] }];
      s.entities = [
        { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'table-ronde-4-tabourets', facing: 'N' },
        { id: 'pnj-1', kind: 'personnage', pos: { x: 2, y: 1 } },
        { id: 'affut-1', kind: 'prop', pos: { x: 4, y: 4 }, postes: [{ trappingId: 'canon-petit' }] },
      ];
      s.seatAssignments = { 'table-1': { nord: { kind: 'entity', entityId: 'pnj-1' } } };
      return s;
    }
    const AUCUN_HEROS: ReadonlySet<string> = new Set();
    const erreurs = (s: Scene) => validateScene([s]).filter((w) => w.level === 'error').map((w) => w.message);

    const GESTES: Record<string, (s: Scene) => Scene> = {
      'moveSel — pousse le MEUBLE dans le recoin cerné': (s) => moveSel(s, { type: 'entity', id: 'table-1' }, { x: 7, y: 7 }),
      'moveSel — arrache le CORPS de son abord': (s) => moveSel(s, { type: 'entity', id: 'pnj-1' }, { x: 5, y: 9 }),
      'moveEntityTo — pousse le MEUBLE dans le recoin cerné': (s) => moveEntityTo(s, 'table-1', { x: 7, y: 7 }),
      'deleteSel — retire le meuble': (s) => deleteSel(s, { type: 'entity', id: 'table-1' }),
      'deleteSel — retire le corps': (s) => deleteSel(s, { type: 'entity', id: 'pnj-1' }),
      'removeEntity — retire le meuble': (s) => removeEntity(s, 'table-1'),
      'eraseAt — gomme le meuble': (s) => eraseAt(s, { x: 2, y: 2 }),
      'changePropRef — le nouveau type n’offre plus de place': (s) => changePropRef(s, 'table-1', 'tonneau'),
      'editEntity — TOURNE le meuble': (s) => editEntity(s, 'table-1', { facing: 'SE' }),
      'editEntity — MONTE le meuble d’un étage': (s) => editEntity(s, 'table-1', { z: 1 }),
      'editEntity — renomme le corps': (s) => editEntity(s, 'pnj-1', { label: 'Aubergiste' }),
      'editEntityCombat — cache le corps jusqu’au combat': (s) => editEntityCombat(s, 'pnj-1', { hiddenUntilCombat: true }),
      'setPosteCrew — arme l’affût': (s) => setPosteCrew(s, 'affut-1', ['pnj-1']),
      'setPosteSide — pose l’arc de tir': (s) => setPosteSide(s, 'affut-1', 'babord'),
      'setPosteEngine — change l’engin': (s) => setPosteEngine(s, 'affut-1', 'canon-petit'),
      'seatOccupant — rassoit le corps': (s) => seatOccupant(s, 'table-1', 'est', { kind: 'entity', entityId: 'pnj-1' }, AUCUN_HEROS).scene,
    };

    // Sans cela, un « 0 erreur » ne prouverait rien : la scène de départ doit déjà être valide.
    it('la scène hostile de départ est un document VALIDE', () => {
      expect(erreurs(hostile())).toEqual([]);
    });

    for (const [nom, geste] of Object.entries(GESTES)) {
      it(nom, () => {
        expect(erreurs(geste(hostile()))).toEqual([]);
      });
    }
  });
});
