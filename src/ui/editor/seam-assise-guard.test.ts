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

/** Découpe un module en fonctions exportées : nom → corps (jusqu'à l'export suivant). */
function exportedBodies(rel: string): Map<string, string> {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const out = new Map<string, string>();
  const heads = [...src.matchAll(/^export function (\w+)\s*(?:<[^>]*>)?\(/gm)];
  heads.forEach((m, i) => {
    const debut = m.index!;
    const fin = i + 1 < heads.length ? heads[i + 1].index! : src.length;
    out.set(m[1], src.slice(debut, fin));
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

  it('aucun COMPOSANT de `src/ui/**` n’écrit `entities` en direct', () => {
    // Le défaut I1 était exactement là : un `onChange` de composant réécrivait `scene.entities` sans
    // passer par une primitive. Deux formes interdites — l'écriture mécanique (`patchEntity`) et le
    // littéral `entities:` qui remappe/filtre la collection. Les primitives elles-mêmes (`.ts` de
    // `editorState`/`sceneEdit`) sont couvertes par le balayage structurel ci-dessus.
    const INTERDIT = [/\bpatchEntity(Combat)?\(/, /entities:\s*\w+\.entities\.(map|filter)\(/];
    const fautifs: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.tsx$/.test(e.name) || /\.test\.tsx$/.test(e.name)) continue;
        fs.readFileSync(p, 'utf8').split('\n').forEach((ligne, i) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(ligne) || /^import\b/.test(ligne.trim())) return;
          if (INTERDIT.some((re) => re.test(ligne)))
            fautifs.push(`${path.relative(ROOT, p).replace(/\\/g, '/')}:${i + 1}`);
        });
      }
    };
    walk(path.join(ROOT, 'src', 'ui'));
    expect(fautifs, `écriture d’entité en direct depuis un composant :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('ce balayage de composants n’est PAS vacant — il rougit sur la forme qu’il interdit', () => {
    const INTERDIT = [/\bpatchEntity(Combat)?\(/, /entities:\s*\w+\.entities\.(map|filter)\(/];
    const forme = "    setScene({ ...scene, entities: scene.entities.map((e) => (e.id === ent.id ? { ...e, ...patch } : e)) });";
    expect(INTERDIT.some((re) => re.test(forme))).toBe(true);
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
