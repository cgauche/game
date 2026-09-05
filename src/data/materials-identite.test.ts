import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { propMaterials, roofMaterials, reliefMaterials, structureAppearances } from './index';
import { propMaterial } from '../gameIso/catalog/propMaterials';
import { roofMaterial } from '../gameIso/catalog/roofs';
import { reliefMaterial } from '../gameIso/catalog/relief';
import { TERRAIN_DEFS } from '../state/terrain/_registry.generated';

/**
 * IDENTITÉ D'UNE MATIÈRE DU MONDE (#1686 lot 1) — l'identité est le couple (DOMAINE, id), et l'id est
 * UNIQUE dans TOUT le périmètre GARDÉ des matières : `prop`, `roof`, `relief`.
 * `MaterialRef.domain` en déclare CINQ (`src/gameIso/builders/types.ts:34` : terrain, relief,
 * structure, roof, prop) ; les deux autres sont hors du périmètre de ce lot — `terrain` est déclaré
 * en modules TS (`src/state/terrain/defs`, registre généré) et rejoint le chantier #1690, `structure`
 * porte son propre dataset d'apparence (`structureAppearance.json`), pas un catalogue de matières.
 * Leurs collisions d'id VIVANTES sont mesurées et tenues au cliquet en fin de fichier, jamais tues.
 * Un homonyme se COMPOSE (`prop-ardoise` / `toit-ardoise`), il ne se distingue pas par le domaine du
 * lecteur : deux entrées de même id dans un espace de noms unique ne sont plus séparables une fois
 * les catalogues fusionnés.
 *
 * Le contrat est DÉRIVÉ des datasets (aucune liste d'ids récitée ici) et il porte le TIE-BREAK : les
 * trois catalogues résolvent par `catalogEntry` sur un index construit à l'identique
 * (`Object.fromEntries`), donc un id en double y ferait gagner la DERNIÈRE déclaration en silence.
 * L'unicité gardée ici rend ce départage sans objet, et laisse UN seul chemin de résolution.
 */
const CATALOGUES: { fichier: string; domaine: string; entrees: readonly { id: string }[]; resout: (id: string) => { id: string } }[] = [
  { fichier: 'propMaterials.json', domaine: 'prop', entrees: propMaterials, resout: propMaterial },
  { fichier: 'roofMaterials.json', domaine: 'roof', entrees: roofMaterials, resout: roofMaterial },
  { fichier: 'reliefMaterials.json', domaine: 'relief', entrees: reliefMaterials, resout: reliefMaterial },
];

/** Ids apparaissant plus d'une fois dans une liste, avec leur cardinal. */
function doublons(ids: readonly string[]): string[] {
  const compte = new Map<string, number>();
  for (const id of ids) compte.set(id, (compte.get(id) ?? 0) + 1);
  return [...compte].filter(([, n]) => n > 1).map(([id, n]) => `${id} ×${n}`);
}

describe('identité des matières du monde — (domaine, id), id unique sur tout le périmètre', () => {
  it('le périmètre GARDÉ est bien les TROIS catalogues de matières, tous peuplés', () => {
    expect(CATALOGUES.map((c) => c.domaine)).toEqual(['prop', 'roof', 'relief']);
    for (const c of CATALOGUES) expect(c.entrees.length, c.fichier).toBeGreaterThan(0);
  });

  it.each(CATALOGUES.map((c) => [c.fichier, c] as const))('%s : aucun id répété DANS le catalogue', (fichier, c) => {
    const repetes = doublons(c.entrees.map((e) => e.id));
    expect(repetes, `${fichier} : id(s) en double — ${repetes.join(', ')}`).toEqual([]);
  });

  it('aucun id partagé ENTRE catalogues — un homonyme porte un id composé', () => {
    const parId = new Map<string, string[]>();
    for (const c of CATALOGUES) for (const e of c.entrees) parId.set(e.id, [...(parId.get(e.id) ?? []), c.fichier]);
    const partages = [...parId].filter(([, f]) => f.length > 1).map(([id, f]) => `${id} : ${f.join(' + ')}`);
    expect(partages, `id(s) partagé(s) entre catalogues — ${partages.join(' ; ')}`).toEqual([]);
  });

  it.each(CATALOGUES.map((c) => [c.fichier, c] as const))(
    '%s : chaque id se résout par SON accesseur vers SON entrée (chemin unique `catalogEntry`)',
    (fichier, c) => {
      for (const e of c.entrees) expect(c.resout(e.id), `${fichier} : ${e.id}`).toBe(e);
    },
  );

  /**
   * RÉGRESSION que le lot INTERDIT : le retour aux ids NUS. `ardoise` porté à la fois par le
   * catalogue de toiture et par celui de décor est exactement l'état d'avant la migration
   * `2026-09-05-1686-ardoise-ids-composes.mjs` — il doit être ROUGE ici, sous son nom.
   */
  it('un retour aux ids NUS (`ardoise` en `roof` ET en `prop`) est REFUSÉ, nominativement', () => {
    const nu = (fichier: string, entrees: readonly { id: string }[], compose: string) =>
      entrees.map((e) => (e.id === compose ? { fichier, id: 'ardoise' } : { fichier, id: e.id }));
    const regresse = [
      ...nu('roofMaterials.json', roofMaterials, 'toit-ardoise'),
      ...nu('propMaterials.json', propMaterials, 'prop-ardoise'),
      ...reliefMaterials.map((e) => ({ fichier: 'reliefMaterials.json', id: e.id })),
    ];
    const parId = new Map<string, string[]>();
    for (const e of regresse) parId.set(e.id, [...(parId.get(e.id) ?? []), e.fichier]);
    const partages = [...parId].filter(([, f]) => f.length > 1).map(([id]) => id);
    expect(partages, 'la fixture de régression ne reproduit plus l’homonyme — la garde ne mesure rien').toEqual([
      'ardoise',
    ]);
    // Et la MÊME logique, jouée sur le dépôt, ne rend rien : c'est ce que les ids composés achètent.
    expect(roofMaterials.map((e) => e.id)).toContain('toit-ardoise');
    expect(propMaterials.map((e) => e.id)).toContain('prop-ardoise');
    expect([...roofMaterials, ...propMaterials].map((e) => e.id)).not.toContain('ardoise');
  });
});

/**
 * CLIQUET DÉCROISSANT des collisions HORS périmètre gardé — dérivé des CINQ domaines de
 * `MaterialRef.domain`, pas des trois que la garde ci-dessus tient. Ces homonymes vivent : aucun
 * lecteur ne s'y trompe aujourd'hui, parce que chacun résout dans le domaine de la FACE qu'il peint
 * (`src/gameIso/backends/webgl/faceColors.ts:47` et `src/gameIso/authoring/floorsSvg.ts:61,72` pour
 * une face de relief, `src/gameIso/backends/webgl/faceRelief.ts:35` pour une face de structure).
 * Le jour où les catalogues fusionnent en UN espace de noms, ils cessent d'être séparables : le stock
 * ci-dessous ne peut donc que DÉCROÎTRE, et une collision de plus est rouge sous son nom.
 */
const COLLISIONS_HORS_PERIMETRE = [
  'pierre : relief + terrain',
  'porte : structure + terrain',
  'terre : relief + terrain',
];

describe('collisions d’id sur les CINQ domaines — cliquet décroissant', () => {
  const DOMAINES: Record<string, readonly string[]> = {
    prop: propMaterials.map((e) => e.id),
    relief: reliefMaterials.map((e) => e.id),
    roof: roofMaterials.map((e) => e.id),
    structure: structureAppearances.map((e) => e.id),
    terrain: TERRAIN_DEFS.map((e) => e.id),
  };

  it('les domaines mesurés sont EXACTEMENT ceux que `MaterialRef.domain` déclare', () => {
    const source = readFileSync('src/gameIso/builders/types.ts', 'utf8');
    const union = /domain:\s*((?:'[a-z]+'\s*\|\s*)*'[a-z]+')/.exec(source);
    expect(union, '`MaterialRef.domain` ne se lit plus comme une union de littéraux').not.toBeNull();
    const declares = [...union![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(declares).toEqual(Object.keys(DOMAINES).sort());
  });

  it('le stock nominatif des collisions vivantes est EXACT — une de plus est rouge, une résolue le fait baisser', () => {
    const parId = new Map<string, string[]>();
    for (const [domaine, ids] of Object.entries(DOMAINES))
      for (const id of ids) parId.set(id, [...(parId.get(id) ?? []), domaine]);
    const mesure = [...parId]
      .filter(([, d]) => d.length > 1)
      .map(([id, d]) => `${id} : ${[...d].sort().join(' + ')}`)
      .sort();
    expect(
      mesure,
      'collision NOUVELLE → composer l’id (patron `toit-ardoise`/`prop-ardoise`) ; collision RÉSOLUE → ' +
        'retirer sa ligne de COLLISIONS_HORS_PERIMETRE, le stock ne remonte jamais',
    ).toEqual(COLLISIONS_HORS_PERIMETRE);
  });
});
