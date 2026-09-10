/**
 * UN SEUL MODÈLE D'UTILISABILITÉ (#1687) — `estUtilisable(scene, ent) = actionsDe(scene, ent).length > 0`.
 *
 * Les scènes sont FABRIQUÉES ici (doctrine : jamais une scène de campagne UTILISÉE comme fixture).
 * Le dernier `describe` fait exception et LIT les paquets livrés, mais en PLANCHER : il n'asserte
 * aucun contenu ni aucun nombre récité — il asserte une ÉGALITÉ DÉRIVÉE (« aucune entité livrée ne
 * devient muette »), qui reste vraie quand l'auteur ajoute ou retire des entités.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyScene, type Scene, type SceneEntity } from './scene';
import { placesJouables, seatSlotsOf } from './seating';
import { actionsDe, estUtilisable } from './usable';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';

/** Meuble de référence du catalogue app-owned : 4 places cardinales. */
const TABLE = 'table-ronde-4-tabourets';

function scene(entities: SceneEntity[]): Scene {
  const s = emptyScene(12, 12);
  s.entities = entities;
  return s;
}

const tabouret = (over: Partial<SceneEntity> = {}): SceneEntity =>
  ({ id: 'table-1', kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, ...over }) as SceneEntity;

const ids = (sc: Scene, e: SceneEntity) => actionsDe(sc, e).map((a) => a.id);

describe('actionsDe — les CAPACITÉS D’INSTANCE se dérivent sans rien activer', () => {
  it('un PNJ à `dialogueId` est utilisable SANS `usable`', () => {
    const pnj: SceneEntity = { id: 'p', kind: 'personnage', pos: { x: 1, y: 1 }, dialogueId: 'd1' };
    const sc = scene([pnj]);
    expect(ids(sc, pnj)).toEqual(['parler']);
    expect(estUtilisable(sc, pnj)).toBe(true);
  });

  it('marchand, jeu de taverne et fouille comptent chacun pour une action, cumulables', () => {
    const pnj: SceneEntity = {
      id: 'p', kind: 'personnage', pos: { x: 1, y: 1 },
      dialogueId: 'd1',
      merchant: { archetype: 'marchand-general' },
      tavernGame: { gameId: 'imperatrice-ecarlate' },
      interact: { flow: { kind: 'seq', steps: [] } },
    };
    const sc = scene([pnj]);
    expect(ids(sc, pnj)).toEqual(['parler', 'commercer', 'jouer', 'fouiller']);
  });

  it('un décor NU n’offre rien — il n’est pas utilisable', () => {
    const caisse: SceneEntity = { id: 'c', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau' };
    const sc = scene([caisse]);
    expect(actionsDe(sc, caisse)).toEqual([]);
    expect(estUtilisable(sc, caisse)).toBe(false);
  });
});

describe('actionsDe — l’ASSISE ne s’ouvre qu’à l’ACTIVATION de l’instance (verbatim 2026-09-09)', () => {
  it('un meuble à places SANS `usable` n’est PAS utilisable, et ses places ne sont pas JOUABLES', () => {
    const t = tabouret();
    const sc = scene([t]);
    expect(actionsDe(sc, t)).toEqual([]);
    expect(estUtilisable(sc, t)).toBe(false);
    expect(placesJouables(sc, 'table-1')).toEqual([]);
  });

  it('le MÊME meuble ACTIVÉ offre « S’asseoir », et ses places deviennent jouables', () => {
    const t = tabouret({ usable: {} });
    const sc = scene([t]);
    expect(actionsDe(sc, t).map((a) => ({ id: a.id, origine: a.origine }))).toEqual([{ id: 'sasseoir', origine: 'assise' }]);
    expect(estUtilisable(sc, t)).toBe(true);
    expect(placesJouables(sc, 'table-1')).toHaveLength(4);
  });

  it('la GÉOMÉTRIE ne dépend d’aucune activation : `seatSlotsOf` rend la MÊME chose des deux côtés', () => {
    const sans = scene([tabouret()]);
    const avec = scene([tabouret({ usable: {} })]);
    expect(seatSlotsOf(sans, 'table-1')).toHaveLength(4);
    expect(seatSlotsOf(avec, 'table-1')).toEqual(seatSlotsOf(sans, 'table-1'));
  });

  it('une entité ACTIVÉE dont le TYPE n’a aucune place n’en tire aucune action (l’activation n’invente rien)', () => {
    const caisse: SceneEntity = { id: 'c', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau', usable: {} };
    const sc = scene([caisse]);
    expect(actionsDe(sc, caisse)).toEqual([]);
  });
});

/**
 * PLANCHER — aucune instance LIVRÉE ne devient muette (#1687, méthode de la sonde du juge).
 *
 * Lecture des 4 paquets livrés en PLANCHER, jamais en assertion de contenu : l'égalité comparée est
 * DÉRIVÉE des deux côtés (offre AVANT le lot = capacités d'instance + places du TYPE ; offre APRÈS =
 * `estUtilisable`). Aucun nombre n'est récité — ajouter une entité à une campagne ne rougit pas ce
 * test, retirer une offre à une entité livrée, si.
 */
describe('PLANCHER — les entités des paquets livrés gardent leur offre', () => {
  const RACINE = join(process.cwd(), 'src/scenes');
  const PROJETS = listerDossier(RACINE)
    .map((nom: string) => join(RACINE, nom, `${nom}-projet.json`))
    .filter((p: string) => {
      try { readFileSync(p); return true; } catch { return false; }
    });

  it('les paquets livrés sont lisibles (sans quoi le plancher ne mesure rien)', () => {
    expect(PROJETS.length).toBeGreaterThan(0);
  });

  it.each(PROJETS)('%s : chaque entité qui offrait quelque chose AVANT offre encore', (chemin: string) => {
    const doc = JSON.parse(readFileSync(chemin, 'utf8')) as { scenes: { id: string; entities?: SceneEntity[] }[] };
    const muettes: string[] = [];
    let offrantes = 0;
    for (const sc of doc.scenes) {
      const s = scene((sc.entities ?? []) as SceneEntity[]);
      for (const e of s.entities) {
        // L'offre d'AVANT le lot, telle que la sonde du juge la mesurait : les capacités d'instance,
        // plus les places que le TYPE porte (l'assise était alors une propriété du TYPE seul).
        const avant = !!e.dialogueId || !!e.merchant || !!e.interact || !!e.tavernGame
          || (e.kind === 'prop' && seatSlotsOf(s, e.id).length > 0);
        if (!avant) continue;
        offrantes++;
        if (!estUtilisable(s, e)) muettes.push(`${sc.id} › ${e.id}`);
      }
    }
    expect(offrantes, `${chemin} : aucune entité offrante — le plancher ne mesure rien`).toBeGreaterThan(0);
    expect(muettes, 'entités livrées devenues MUETTES').toEqual([]);
  });
});
