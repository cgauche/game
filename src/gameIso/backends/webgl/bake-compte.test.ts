/**
 * COMPTEURS DU BAKE — la garde de PROVENANCE de la géométrie du monde (#1176, C6).
 *
 * Ce que tient ce fichier n'est pas une politique de rendu : c'est un TÉMOIN CHIFFRÉ. Toute passe qui
 * touche la conversion monde (`worldTris`), les builders du pivot, les catalogues d'épaisseur ou les
 * scènes étalons doit voir ici, en un run, si elle a bougé la masse de triangles — et de combien.
 *
 * POURQUOI ELLE EXISTE : un lot de C6 (épaisseurs en donnée) a été annoncé « géométrie inchangée » en
 * comparant des compteurs à une baseline PÉRIMÉE (relevée avant #1300). Le fond était juste, la
 * PROVENANCE était fausse — et rien dans l'arbre ne pouvait le dire. Une table de compteurs datée, elle,
 * le dit : elle rougit sur l'écart réel, pas sur celui qu'on croit mesurer.
 *
 * POLITIQUE DE MISE À JOUR — la seule admise :
 *  - un changement de CONTENU d'une scène étalon, ou un changement de géométrie VOULU (épaisseur
 *    authorée, nouvelle face émise par un builder, volume d'une part de mur) met à jour la table DANS
 *    LE MÊME COMMIT, avec la mesure et sa raison au message ;
 *  - un ajustement AVEUGLE des nombres « pour faire passer la garde » est exactement ce que ce fichier
 *    existe pour rendre impossible : la valeur REÇUE que l'échec affiche est la mesure courante, mais
 *    elle ne devient un témoin qu'accompagnée de la raison du déplacement.
 *
 * DEUX étalons sont figés au chiffre : une carte de ville MEUBLÉE (hub de l'arène) et une SALLE nue
 * (zone 13 de l'arène — plancher de comparaison). La carte de ROUTE longue (diligence) est couverte
 * SANS chiffre : sa carte bouge encore sous le pinceau (`EN_AUTHORING` ci-dessous, arbitrage #1447).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bakeWorldGeometry } from './sceneMeshes';
import { parseProject } from '../../../state/worldMap';
import { sceneMetresPerTile, type Scene } from '../../../state/scene';
import { scenario as diligence } from '../../../scenes/test-scenarios/diligence';

const projet: Scene[] = parseProject(
  JSON.parse(readFileSync(join(__dirname, '../../../scenes/arene/arene-projet.json'), 'utf8')),
).scenes;
const sceneDuProjet = (id: string): Scene => {
  const s = projet.find((x) => x.id === id);
  if (!s) throw new Error(`scène étalon absente du projet : ${id}`);
  return s;
};

/** Compteurs MESURÉS au bake — la sortie EXACTE que la table ci-dessous fige. */
function compteursDe(scene: Scene): { sommets: number; triangles: number; spans: number } {
  const baked = bakeWorldGeometry(scene, sceneMetresPerTile(scene));
  const sommets = baked.geometry.getAttribute('position').count;
  return { sommets, triangles: sommets / 3, spans: baked.spans.length };
}

/** TABLE DATÉE — mesurée le 2026-08-14 à l'arbre C6 (champ continu de visibilité + épaisseurs en
 *  donnée). `spans` = une face du pivot ; `triangles` = ce que le GPU dessine ; `sommets` = l'index
 *  IDENTITÉ (aucun sommet partagé, donc exactement 3 par triangle). */
const ETALONS: [string, () => Scene, { sommets: number; triangles: number; spans: number }][] = [
  // Ré-étalonnées 2026-09-01 (#1644) : les onze recettes volumiques du LOT A (tonneau, caisse, coffre,
  // étagère, chaise, banc, tabouret, urne, pile de tonneaux, table, table longue) font sortir en FACES
  // monde des décors que ces deux scènes posaient jusque-là en billboards — hub 4446 → 6346 faces,
  // zone13 1440 → 1474.
  ['arene-hub', () => sceneDuProjet('arene-hub'), { sommets: 70056, triangles: 23352, spans: 6346 }],
  ['arene-zone13', () => sceneDuProjet('arene-zone13'), { sommets: 8832, triangles: 2944, spans: 1474 }],
];

/** EN AUTHORING — scènes SORTIES du compte exact le temps que leur carte bouge sous le pinceau : un
 *  témoin chiffré n'a de sens que sur une carte stabilisée, sinon il rougit à chaque coup de pinceau
 *  d'une session d'authoring et bloque le tronc. Arbitrage 2026-08-21 (#1447), verbatim de
 *  l'utilisateur : « C'est absurde d'avoir un guard qui bloque totalement la diligence alors qu'elle
 *  n'est même pas finalisé ».
 *  RÉ-ENTRÉE : ré-étalonner à la FINALISATION de la carte — recopier les valeurs REÇUES dans
 *  `ETALONS` et dire dans le commit ce qui les a déplacées. Les invariants SANS chiffre ci-dessous
 *  (index identité, hiérarchie des régimes) continuent de couvrir ces scènes. */
const EN_AUTHORING: [string, () => Scene, string][] = [
  ['la-diligence', () => diligence.scene, 'carte en cours d’authoring'],
];

/** Toutes les scènes couvertes — étalonnées au chiffre ou en authoring. */
const SCENES: [string, () => Scene][] = [
  ...ETALONS.map(([id, charger]): [string, () => Scene] => [id, charger]),
  ...EN_AUTHORING.map(([id, charger]): [string, () => Scene] => [id, charger]),
];

const GUIDE =
  'compteurs de bake mesurés 2026-08-14 (arbre C6) — si la SCÈNE ou la géométrie a changé VOLONTAIREMENT, ' +
  'recopie la valeur REÇUE ci-dessus dans `ETALONS` ET dis dans le commit CE QUI l’a déplacée (épaisseur ' +
  'authorée, face neuve d’un builder, contenu de scène). Sinon, c’est une dérive de géométrie non voulue : ' +
  'ne touche pas la table, trouve la cause.';

describe('COMPTEURS DU BAKE — la masse de géométrie de chaque scène étalon', () => {
  for (const [id, charger, attendu] of ETALONS)
    it(`${id} : ${attendu.triangles} triangles / ${attendu.spans} faces, au compte exact`, () => {
      expect(compteursDe(charger()), GUIDE).toEqual(attendu);
    });

  it('une scène EN AUTHORING quitte le compte exact SANS quitter la couverture', () => {
    for (const [id, , raison] of EN_AUTHORING) {
      expect(ETALONS.some(([n]) => n === id), `${id} — ${raison}`).toBe(false);
      expect(SCENES.some(([n]) => n === id), `${id} — ${raison}`).toBe(true);
    }
  });

  it('l’index reste IDENTITÉ sur les trois : 3 sommets par triangle, aucun partage', () => {
    for (const [id, charger] of SCENES) {
      const c = compteursDe(charger());
      expect(c.sommets, id).toBe(c.triangles * 3);
    }
  });

  it('les trois régimes sont bien DISTINCTS (une salle nue ne pèse pas une ville meublée)', () => {
    const triangles = (id: string) => compteursDe(SCENES.find(([n]) => n === id)![1]()).triangles;
    expect(triangles('arene-zone13')).toBeLessThan(triangles('arene-hub'));
    expect(triangles('arene-hub')).toBeLessThan(triangles('la-diligence'));
  });
});
