/**
 * Contrat du schéma de PROJET DE SCÈNE (#1466 T3-a) — la porte UNIQUE du seam `parseProject`, qui a
 * remplacé les quatre validateurs manuscrits. On y verrouille, sur un projet-JOUET minimal :
 *  - la FORME reçue par le seam, AVANT `normalizeScene`/`resolvePortRef` (collections absentes,
 *    port SPARSE `{ref}`) — VERTE, sinon le schéma refuserait un document que l'app charge ;
 *  - les QUATRE sémantiques, chacune ROUGE avec le CHEMIN et l'id fautif : FK `activeAxes`,
 *    invariants du narratif, FK intra-document `presetId`, invariant d'IDENTITÉ ;
 *  - le `schema` littéral courant (un document non migré n'entre pas par cette porte).
 */
import { describe, it, expect } from 'vitest';
import { projetSchema } from './projet';
import { narratifSchema } from './narratif';

type Jouet = Record<string, unknown>;

const sceneMinimale = (over: Jouet = {}): Jouet => ({
  id: 'scene-1',
  nom: 'Une salle',
  desc: 'Scène minimale de fixture.',
  dimensions: { w: 4, h: 4 },
  ...over,
});

const projet = (over: Jouet = {}): Jouet => ({
  schema: 5,
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [sceneMinimale()],
  ...over,
});

/** Chemins + messages des issues, pour asserter que l'erreur NOMME le fautif. */
const fautes = (valeur: unknown, schema: typeof projetSchema | typeof narratifSchema = projetSchema) => {
  const res = schema.safeParse(valeur);
  expect(res.success).toBe(false);
  return res.success ? [] : res.error.issues.map((i) => `${i.path.join('.')} :: ${i.message}`);
};

describe('projetSchema — la FORME que voit le seam (avant normalizeScene/resolvePortRef)', () => {
  it('un projet minimal parse : les collections que `normalizeScene` comble sont OPTIONNELLES', () => {
    const res = projetSchema.safeParse(projet());
    expect(res.success, res.success ? '' : JSON.stringify(res.error.issues.slice(0, 3))).toBe(true);
  });

  it('une scène SANS `entities` (document antérieur, comblé par `normalizeScene`) est VALIDE', () => {
    expect(projetSchema.safeParse(projet()).success).toBe(true);
    expect('entities' in sceneMinimale()).toBe(false);
  });

  it('un `port` SPARSE `{ ref }` (avant `resolvePortRef`) est VALIDE ; sans `ref`, le profil est exigé EN ENTIER', () => {
    const carte = (port: Jouet) => ({
      id: 'carte',
      nom: 'Le monde',
      places: [{ id: 'lieu-1', label: 'Port', pos: { x: 1, y: 2 }, scene: 'scene-1', port }],
      routes: [],
    });
    expect(projetSchema.safeParse(projet({ worldMap: carte({ ref: 'marienburg', lighthouse: true }) })).success).toBe(true);
    expect(fautes(projet({ worldMap: carte({ taille: 3 }) }))).toEqual([
      expect.stringContaining('worldMap.places.0.port.richesse'),
      expect.stringContaining('worldMap.places.0.port.production'),
    ]);
  });

  it('`schema: 2` est REFUSÉ (littéral 3 — un document non migré n\'entre pas par cette porte)', () => {
    expect(fautes(projet({ schema: 2 }))[0]).toContain('schema');
  });

  it('une clé inconnue sur une scène est REFUSÉE (schéma STRICT)', () => {
    expect(fautes(projet({ scenes: [sceneMinimale({ inventedField: 'poison' })] }))).toEqual([
      'scenes.0 :: Unrecognized key: "inventedField"',
    ]);
  });
});

describe('projetSchema — les quatre sémantiques du seam, chacune NOMMÉE', () => {
  it('(a) `activeAxes` référence un axe inconnu de axes.json → rouge nommant l\'index et l\'id', () => {
    expect(fautes(projet({ activeAxes: ['negoce', 'plongee-sous-marine'] }))).toEqual([
      'activeAxes.1 :: activeAxes référence un axe inconnu de axes.json : « plongee-sous-marine ».',
    ]);
  });

  it('(b) `indice.affaireId` orphelin → rouge nommant le chemin et l\'affaire manquante', () => {
    const narratif = {
      affaires: [{ id: 'affaire-a', titre: 'Le Marché noir' }],
      indices: [{ id: 'indice-1', affaireId: 'affaire-fantome', kind: 'indice', titre: 'x', stades: [{ id: 's1', prose: '' }] }],
      presetsPnj: [],
      objets: [],
    };
    expect(fautes(projet({ narratif }))).toEqual([
      'narratif.indices.0.affaireId :: l\'indice « indice-1 » référence une affaire inconnue « affaire-fantome ».',
    ]);
  });

  it('(b bis) un id de preset qui COLLISIONNE avec la règle globale → rouge nommé', () => {
    const narratif = {
      affaires: [],
      indices: [],
      presetsPnj: [{ id: 'gobelin', base: 'gobelin' }],
      objets: [],
    };
    expect(fautes(projet({ narratif }))).toEqual([
      'narratif.presetsPnj.0.id :: l\'id de preset PNJ « gobelin » collisionne avec un id de la règle globale (créature/possession).',
    ]);
  });

  it('(b ter) un preset sans base ni profil → rouge nommé (contrat de `presetPnjSchema`)', () => {
    const narratif = { affaires: [], indices: [], presetsPnj: [{ id: 'le-borgne' }], objets: [] };
    expect(fautes(projet({ narratif }))).toEqual([
      'narratif.presetsPnj.0 :: le preset PNJ « le-borgne » n\'a ni base ni profil (au moins l\'un des deux est requis).',
    ]);
  });

  it('(c) `entity.presetId` sans preset déclaré → rouge nommant la scène ET l\'entité', () => {
    const scenes = [sceneMinimale({ entities: [{ id: 'pnj-1', kind: 'personnage', pos: { x: 1, y: 1 }, presetId: 'le-borgne' }] })];
    expect(fautes(projet({ scenes }))).toEqual([
      'scenes.0.entities.0.presetId :: l\'entité « pnj-1 » de la scène « scene-1 » référence un preset de PNJ inconnu « le-borgne » (narratif.presetsPnj).',
    ]);
  });

  it('(c bis) le MÊME `presetId`, déclaré au narratif, est VALIDE', () => {
    const scenes = [sceneMinimale({ entities: [{ id: 'pnj-1', kind: 'personnage', pos: { x: 1, y: 1 }, presetId: 'le-borgne' }] })];
    const narratif = {
      affaires: [],
      indices: [],
      presetsPnj: [{ id: 'le-borgne', profil: { char: { CC: 40 }, traits: [] } }],
      objets: [],
    };
    expect(projetSchema.safeParse(projet({ scenes, narratif })).success).toBe(true);
  });

  it('(d) identité PLATE : `label` vide → rouge nommant le champ à la RACINE', () => {
    expect(fautes(projet({ id: 'ma-campagne', label: '', versionContenu: 1 }))).toEqual([
      'label :: label doit être une chaîne non vide.',
    ]);
  });

  it('(d bis) identité TOUT-OU-RIEN : le trio incomplet est rouge, chaque manquant NOMMÉ', () => {
    // Ce que la poche `meta` garantissait par construction (strictObject à 3 clés requises) : aplatie,
    // l'exigence deviendrait trois champs optionnels indépendants (#1467 L1b V-formeProjet).
    const attendu = (k: string) =>
      `${k} :: identité de campagne INCOMPLÈTE : « ${k} » est requis dès qu'un autre champ du trio \`id\`/\`label\`/\`versionContenu\` est présent.`;
    expect(fautes(projet({ id: 'ma-campagne' }))).toEqual([attendu('label'), attendu('versionContenu')]);

    // MATRICE — le déclencheur est N'IMPORTE LEQUEL des 6 champs d'identité, pas seulement le trio.
    // Étalon : sous la poche `meta` (strictObject à 3 clés requises), `{ icon }` seul était DÉJÀ
    // rouge. Un refine qui ne regarderait que le trio laisserait passer les accessoires orphelins.
    expect(projetSchema.safeParse(projet()).success, 'aucune identité = brouillon LÉGITIME').toBe(true);
    expect(projetSchema.safeParse(projet({ id: 'c', label: 'C', versionContenu: 1 })).success, 'trio complet').toBe(true);
    for (const accessoire of [{ icon: 'scenario/village' }, { desc: 'Une prose.' }, { auteur: 'Une autrice' }]) {
      const nom = Object.keys(accessoire)[0];
      expect(fautes(projet(accessoire)), `« ${nom} » seul doit exiger le trio`).toEqual([
        attendu('id'), attendu('label'), attendu('versionContenu'),
      ]);
    }
    // Un accessoire ACCOMPAGNÉ du trio complet reste vert.
    expect(projetSchema.safeParse(projet({ id: 'c', label: 'C', versionContenu: 1, icon: 'scenario/village' })).success).toBe(true);
  });

  it('(d ter) la poche `meta` et le `version` RACINE sont REFUSÉS par le SCEAU de l’enveloppe plate', () => {
    // Portée EXACTE de cette assertion : elle juge `projetSchema` SEUL. Par le seam réel, un `version`
    // racine n'arrive JAMAIS jusqu'ici (`parseProject` l'écrase puis le purge avant de valider —
    // mesuré par `state/projet-migration-4-vers-5.test.ts`). Le sceau est donc la garde du document
    // AU REPOS : un `.json` authioré/exporté à la mauvaise forme est nommé à la porte du schéma,
    // plutôt que d'être absorbé en silence par le seam.
    expect(fautes(projet({ version: 1 })).join(' ')).toMatch(/version/);
    expect(fautes(projet({ meta: { id: 'c', label: 'C', version: 1 } })).join(' ')).toMatch(/meta/);
  });
});

describe('narratifSchema — un id VIDE est refusé dans les QUATRE registres, chemin nommé', () => {
  const narratif = (over: Jouet = {}): Jouet => ({ affaires: [], indices: [], presetsPnj: [], objets: [], ...over });
  const indice = (over: Jouet = {}): Jouet => ({ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'x', stades: [{ id: 'stade-1', prose: '' }], ...over });

  it('affaire : `id` vide', () => {
    expect(fautes(narratif({ affaires: [{ id: '', titre: 'Le Marché noir' }] }), narratifSchema)).toEqual([
      'affaires.0.id :: affaires[].id : id vide.',
    ]);
  });

  it('indice : `id` vide', () => {
    const doc = narratif({ affaires: [{ id: 'affaire-a', titre: 'x' }], indices: [indice({ id: '' })] });
    expect(fautes(doc, narratifSchema)).toEqual(['indices.0.id :: indices[].id : id vide.']);
  });

  it('stade d\'indice : `id` vide', () => {
    const doc = narratif({ affaires: [{ id: 'affaire-a', titre: 'x' }], indices: [indice({ stades: [{ id: '', prose: '' }] })] });
    expect(fautes(doc, narratifSchema)).toEqual(['indices.0.stades.0.id :: indices[].stades[].id : id vide.']);
  });

  it('preset PNJ : `id` vide', () => {
    expect(fautes(narratif({ presetsPnj: [{ id: '', base: 'gobelin' }] }), narratifSchema)).toEqual([
      'presetsPnj.0.id :: presetsPnj[].id : id vide.',
    ]);
  });

  it('objet : `id` vide (contrôle — la même exigence, déjà tenue par `raffineNarratif`)', () => {
    expect(fautes(narratif({ objets: [{ id: '' }] }), narratifSchema)).toEqual([
      'objets.0.id :: un objet n\'a pas d\'id.',
    ]);
  });
});
