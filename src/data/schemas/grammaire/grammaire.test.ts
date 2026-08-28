/**
 * Contrats de la GRAMMAIRE de document (#1466 L1a) — ce que les fabriques `document()` et `ref()`
 * garantissent PAR CONSTRUCTION, verrouillé au TYPE et au RUNTIME.
 *
 * Les cas POSITIFS sont bâtis sur des entrées RÉELLES de `src/data/*.json` (jamais un id inventé) :
 * ils prouvent du même coup que le registre généré `_ids.generated.ts` et la donnée s'accordent.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { z } from 'zod';
import skillsJson from '../../skills.json';
import talentsJson from '../../talents.json';
import { document, CLES_ENVELOPPE, type Exposition } from './document';
import { ref, refs, specRef, pick, typedRef, idDe, cibleDe, estSpecialisable, TYPES, type Id, type SignatureById } from './ref';
import { slotsDe } from './slots';
import { SANS_LIVRE } from './sans-livre';

type EntreeASpecs = { id: string; specs?: { id: string }[]; specsSource?: string };
const UNE_COMPETENCE = skillsJson[0] as { id: string };
const UNE_COMPETENCE_GROUPEE = (skillsJson as EntreeASpecs[]).find((s) => s.specs?.length)!;
const UN_TALENT_A_SPECS = (talentsJson as EntreeASpecs[]).find((t) => t.specs?.length)!;
const declareDesSpecs = (e: EntreeASpecs) => !!(e.specs?.length || e.specsSource);

const SOURCE_REELLE = { book: 'livre-de-base', page: 118 };
const EXPOSITION: Exposition = { codex: { keys: ['talents'] }, edit: { dataset: 'talents.json' } };

describe('document() — enveloppe posée par la fabrique', () => {
  const fiche = document(
    'talent',
    'entite',
    { max: z.number(), tests: z.string().optional() },
    { max: { label: 'Maximum' }, tests: { label: 'Tests', hint: 'Compétences concernées' } },
    EXPOSITION,
  );
  const DOC_COMPLET = { id: 'ambidextre', type: 'talent', label: 'Ambidextre', source: SOURCE_REELLE, max: 2 };

  it('rend un handle FERMÉ (type, famille, méta, exposition) dont le schéma parse un document complet', () => {
    expect(fiche.type).toBe('talent');
    expect(fiche.famille).toBe('entite');
    expect(fiche.meta.max.label).toBe('Maximum');
    expect(fiche.exposition).toEqual(EXPOSITION);
    expect(fiche.variantes).toEqual([]);
    expect(fiche.entree.safeParse(DOC_COMPLET).success).toBe(true);
  });

  it('refuse un champ inconnu (strictObject) et un document sans `source`', () => {
    expect(fiche.entree.safeParse({ id: 'a', type: 'talent', label: 'A', source: SOURCE_REELLE, inconnu: 1 }).success).toBe(false);
    expect(fiche.entree.safeParse({ id: 'a', type: 'talent', label: 'A', max: 2 }).success).toBe(false);
  });

  it('rend `source` optionnelle pour un type de la liste SANS LIVRE, et pour lui seul', () => {
    const [typeSansLivre] = Object.keys(SANS_LIVRE);
    const rendu = document(typeSansLivre, 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION);
    expect(rendu.schema.safeParse({ id: 'x', type: typeSansLivre, label: 'X', valeur: 1 }).success).toBe(true);
    const typeHorsListe = 'type-jouet-hors-liste';
    expect(SANS_LIVRE[typeHorsListe]).toBeUndefined();
    const exige = document(typeHorsListe, 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION);
    expect(exige.schema.safeParse({ id: 'x', type: typeHorsListe, label: 'X', valeur: 1 }).success).toBe(false);
    expect(exige.schema.safeParse({ id: 'x', type: typeHorsListe, label: 'X', valeur: 1, source: SOURCE_REELLE }).success).toBe(true);
  });

  it('exige une PROVENANCE : `source` OU `maison`, jamais NI L’UN NI L’AUTRE (#1467 L1b)', () => {
    const nu = { id: 'a', type: 'talent', label: 'A', max: 2 };
    // Sans provenance : refusé, et l'erreur NOMME le document et le champ attendu.
    const ko = fiche.entree.safeParse(nu);
    expect(ko.success).toBe(false);
    expect(JSON.stringify(ko.error)).toMatch(/document\('talent'\).*maison/);
    // `maison` SEULE suffit : un arbitrage hors canon est une provenance, pas un trou.
    expect(fiche.entree.safeParse({ ...nu, maison: 'le canon ne chiffre pas ce point' }).success).toBe(true);
    // `source` seule suffit ; les DEUX ensemble restent légitimes (mesuré : 28 entrées, 9 fichiers).
    expect(fiche.entree.safeParse({ ...nu, source: SOURCE_REELLE }).success).toBe(true);
    expect(fiche.entree.safeParse({ ...nu, source: SOURCE_REELLE, maison: 'précision maison' }).success).toBe(true);
    // `maison` VIDE ne prouve rien : `.min(1)` STRUCTUREL, jamais une garde dans le refine.
    expect(fiche.entree.safeParse({ ...nu, maison: '' }).success).toBe(false);
  });

  it('REFUSE `maison` BOOLÉEN — un DRAPEAU ne dit aucune raison, l’enveloppe en exige une', () => {
    const nu = { id: 'a', type: 'talent', label: 'A', max: 2 };
    // Le TYPE porte le contrat : `maison` est la raison en clair, jamais un vrai/faux.
    expect(fiche.entree.safeParse({ ...nu, maison: true }).success).toBe(false);
    expect(fiche.entree.safeParse({ ...nu, source: SOURCE_REELLE, maison: true }).success).toBe(false);
    // ... et le drapeau ne satisfait donc PAS le refine de provenance : l'entrée reste sans source.
    const ko = fiche.entree.safeParse({ ...nu, maison: true });
    expect(JSON.stringify(ko.error)).toMatch(/maison/);
  });

  it('`affinerEntree` reçoit un nœud PRÉ-sceau dont le `.shape` porte `maison` (composable)', () => {
    let vues: string[] = [];
    const doc = document(
      'talent',
      'entite',
      { max: z.number() },
      { max: { label: 'Maximum' } },
      EXPOSITION,
      {
        affinerEntree: (e) => {
          vues = Object.keys(e.shape);
          return e;
        },
      },
    );
    // Le refine de provenance est posé AVANT `affinerEntree` : il ne doit pas avoir scellé le nœud,
    // sans quoi tout def qui compose un raffinement perdrait `.shape` (et `variants-integrity` avec).
    expect(vues).toContain('maison');
    expect(vues).toContain('source');
    expect(doc.cles).toContain('maison');
  });

  it('REFUSE une clé d’enveloppe redéclarée dans `champs`, en la nommant', () => {
    expect(() =>
      // @ts-expect-error — `label` est une clé d'ENVELOPPE : le mapped type l'annule en `never`.
      document('jouet', 'entite', { label: z.string() }, { label: { label: 'Libellé' } }, EXPOSITION),
    ).toThrow(/« label » est une clé d'ENVELOPPE/);
    expect(CLES_ENVELOPPE).toContain('label');
  });

  it('REFUSE un champ sans méta d’édition, et une méta sans champ', () => {
    expect(() =>
      // @ts-expect-error — la méta de `max` manque : `MetaDesChamps` l'exige.
      document('jouet', 'entite', { max: z.number() }, {}, EXPOSITION),
    ).toThrow(/le champ « max » n'a pas de méta/);
    expect(() =>
      // @ts-expect-error — méta orpheline : aucune clé `autre` dans `champs`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' }, autre: { label: 'Autre' } }, EXPOSITION),
    ).toThrow(/méta d'édition « autre » sans champ/);
  });

  it('EXIGE une exposition Codex/éditeur déclarée (clés, ou exemption motivée)', () => {
    expect(() =>
      // @ts-expect-error — `codex` vide : ni `keys` ni `exempt`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, { codex: {}, edit: { object: 'single' } }),
    ).toThrow(/`codex` exige/);
    expect(() =>
      // @ts-expect-error — `edit` vide : ni `dataset`, ni `object`, ni `none`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, { codex: { keys: ['x'] }, edit: {} }),
    ).toThrow(/`edit` exige/);
    const exempte = document(
      'jouet',
      'config',
      { max: z.number() },
      { max: { label: 'Max' } },
      { codex: { exempt: { kind: 'vocabulaire-app-interne', raison: 'vocabulaire du moteur, jamais lu par le joueur' } }, edit: { none: 'dérivé' } },
    );
    expect(exempte.exposition.edit).toEqual({ none: 'dérivé' });
  });

  it('n’expose AUCUN nœud extensible en aval : `.extend` et `.shape` absents AU RUNTIME', () => {
    const nu = fiche.entree as unknown as Record<string, unknown>;
    expect(nu.extend).toBeUndefined();
    expect(nu.shape).toBeUndefined();
    // « AUCUN nœud » vaut pour TOUT ce que le handle rend, l'entrée PARTIELLE comprise.
    const patch = fiche.entreePartielle as unknown as Record<string, unknown>;
    expect(patch.extend).toBeUndefined();
    expect(patch.shape).toBeUndefined();
    expect(() =>
      // @ts-expect-error — le schéma sort en `z.ZodType` : pas d'`.extend` sur le handle.
      fiche.entree.extend({ ajout: z.string() }),
    ).toThrow();
    const parse: z.infer<typeof fiche.entree> = fiche.entree.parse(DOC_COMPLET);
    expect((parse as { max: number }).max).toBe(2);
    expect(fiche.entree.safeParse({ ...DOC_COMPLET, max: 'deux' }).success).toBe(false);
  });
});

describe('document() — variantes réglées composées par la fabrique', () => {
  const jouet = document(
    'talent',
    'entite',
    { max: z.number(), tests: z.string().optional() },
    { max: { label: 'Maximum' }, tests: { label: 'Tests' } },
    EXPOSITION,
    { variantes: ['desc', 'source', 'max'] },
  );
  const BASE = { id: 'ambidextre', type: 'talent', label: 'Ambidextre', source: SOURCE_REELLE, max: 2 };

  it('accepte un patch PARTIEL des champs déclarés, sous sa garde `when`', () => {
    expect(jouet.variantes).toEqual(['desc', 'source', 'max']);
    expect(jouet.entree.safeParse({ ...BASE, variants: [{ when: { rule: 'aa-group-advantage' }, max: 4 }] }).success).toBe(true);
  });

  it('REFUSE un champ hors liste, et une variante sans `when`', () => {
    expect(jouet.entree.safeParse({ ...BASE, variants: [{ when: { rule: 'r' }, tests: 'Ténacité' }] }).success).toBe(false);
    expect(jouet.entree.safeParse({ ...BASE, variants: [{ max: 4 }] }).success).toBe(false);
  });

  it('REFUSE tout `variants` à un document qui n’en déclare aucun, et un champ republiable inconnu', () => {
    const sansVariante = document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(sansVariante.entree.safeParse({ ...BASE, variants: [{ when: { rule: 'r' }, max: 4 }] }).success).toBe(false);
    expect(() =>
      document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, { variantes: ['inexistant'] }),
    ).toThrow(/« inexistant » est déclaré republiable/);
  });
});

describe('document() — emballage du DATASET par famille (#1467 L1b)', () => {
  const REPLIQUES = {
    // Réplique de forme d'un def `entite` (talents.json) — jamais le vrai def : c'est la FABRIQUE qu'on mesure.
    entite: document('talent', 'entite', { max: z.number() }, { max: { label: 'Maximum' } }, EXPOSITION),
    // Réplique d'un def `config` (objet unique dans son fichier).
    config: document('config-jouet', 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION),
    // Réplique d'un def `record` (decorPalette : record de chaînes hex).
    record: document('palette-jouet', 'record', {}, {}, EXPOSITION, { valeurRecord: z.string().regex(/^#[0-9a-f]{6}$/) }),
    // Réplique d'un def `table` (#1467 L1b V-FLIP-TABLE) : `die?` est un champ du def, `entries` est
    // POSÉE par la fabrique depuis `options.ligneTable` — comme `entries` l'est en famille `record`.
    table: document(
      'table-jouet',
      'table',
      { die: z.string().optional() },
      { die: { label: 'Dé' } },
      EXPOSITION,
      { ligneTable: z.strictObject({ min: z.number(), max: z.number(), label: z.string() }) },
    ),
  };
  const ENV = (type: string) => ({ id: 'x', type, label: 'X', source: SOURCE_REELLE });

  it('famille `entite` : le dataset est un TABLEAU d’entrées', () => {
    const { schema } = REPLIQUES.entite;
    expect(schema.safeParse([{ ...ENV('talent'), max: 2 }]).success).toBe(true);
    expect(schema.safeParse({ ...ENV('talent'), max: 2 }).success).toBe(false);
    expect(schema.safeParse([{ ...ENV('talent'), max: 2, inconnu: 1 }]).success).toBe(false);
    expect(schema.safeParse([{ ...ENV('talent'), max: 'deux' }]).success).toBe(false);
  });

  it('famille `config` : le dataset est l’ENTRÉE seule', () => {
    const { schema } = REPLIQUES.config;
    expect(schema.safeParse({ ...ENV('config-jouet'), valeur: 3 }).success).toBe(true);
    expect(schema.safeParse([{ ...ENV('config-jouet'), valeur: 3 }]).success).toBe(false);
    expect(schema.safeParse({ ...ENV('config-jouet'), valeur: 3, inconnu: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...ENV('config-jouet'), valeur: 'trois' }).success).toBe(false);
  });

  it('famille `record` : ENVELOPPE + `entries`, chaque valeur validée', () => {
    const { schema } = REPLIQUES.record;
    const base = { ...ENV('palette-jouet'), entries: { bois: '#8b5a2b', pierre: '#7a7a7a' } };
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, inconnu: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...base, entries: { bois: 'marron' } }).success).toBe(false);
    expect(schema.safeParse({ ...base, entries: { '': '#8b5a2b' } }).success).toBe(false);
  });

  it('famille `table` : TABLEAU de documents, chacun à `die?` optionnel et `entries` POSÉE par la fabrique', () => {
    const { schema } = REPLIQUES.table;
    const t = { ...ENV('table-jouet'), entries: [{ min: 1, max: 10, label: 'Rien' }] };
    expect(schema.safeParse([t]).success).toBe(true);
    expect(schema.safeParse([{ ...t, die: '1d100' }]).success).toBe(true);
    // Le fichier porte une LISTE de documents : le document nu n'est pas le dataset.
    expect(schema.safeParse(t).success).toBe(false);
    // `entries` est une LISTE ordonnée (là où la famille `record` en fait une map).
    expect(schema.safeParse([{ ...t, entries: {} }]).success).toBe(false);
    // Chaque rangée est validée par `ligneTable`, et le sceau refuse la clé en trop.
    expect(schema.safeParse([{ ...t, entries: [{ min: 1, max: 10 }] }]).success).toBe(false);
    expect(schema.safeParse([{ ...t, entries: [{ min: 1, max: 10, label: 'Rien', inconnu: 1 }] }]).success).toBe(false);
  });

  it('`ligneTable` : EXIGÉ par la famille `table`, REFUSÉ partout ailleurs, en nommant le document', () => {
    expect(() => document('table-nue', 'table', {}, {}, EXPOSITION)).toThrow(
      /document\('table-nue'\) : la famille « table » exige `ligneTable`/,
    );
    expect(() => document('config-ligne', 'config', {}, {}, EXPOSITION, { ligneTable: z.number() })).toThrow(
      /`ligneTable` n'a de sens que pour la famille « table » \(ici « config »\)/,
    );
  });

  it('un def `table` qui redéclare `entries` dans ses `champs` est REFUSÉ (la fabrique la pose)', () => {
    expect(() =>
      document('table-doublon', 'table', { entries: z.array(z.number()) }, { entries: { label: 'Rangées' } }, EXPOSITION, {
        ligneTable: z.number(),
      }),
    ).toThrow(/la fabrique pose « entries » pour la famille « table »/);
  });

  it('le SCEAU tient sur TOUT nœud rendu (dataset de chaque famille, entrée, entrée partielle)', () => {
    const scelle = (n: unknown) => {
      const nu = n as Record<string, unknown>;
      expect(nu.extend).toBeUndefined();
      expect(nu.shape).toBeUndefined();
      expect(typeof (nu as { partial?: unknown }).partial).toBe('undefined');
      expect(() => (nu as { partial: () => unknown }).partial()).toThrow();
    };
    scelle((REPLIQUES.entite.schema as unknown as { element: unknown }).element);
    scelle((REPLIQUES.table.schema as unknown as { element: unknown }).element);
    scelle(REPLIQUES.config.schema);
    scelle(REPLIQUES.record.schema);
    scelle(REPLIQUES.entite.entree);
    scelle(REPLIQUES.record.entree);
    // Le nœud PARTIEL est scellé lui aussi : un `.partial()` nu rouvrirait `.extend` par le voisin.
    scelle(REPLIQUES.entite.entreePartielle);
    scelle(REPLIQUES.record.entreePartielle);
  });

  it('`entreePartielle` accepte le PATCH que le nœud scellé rend impossible, et `cles` liste les clés top-level', () => {
    const { entreePartielle, cles } = REPLIQUES.entite;
    expect(entreePartielle.safeParse({ max: 2 }).success).toBe(true);
    expect(entreePartielle.safeParse({}).success).toBe(true);
    expect(entreePartielle.safeParse({ inconnu: 1 }).success).toBe(false);
    // Consommateur mesuré `defs-scenes/narratif.ts:49` : `.partial().optional()` — le sceau le sert.
    expect(entreePartielle.optional().safeParse(undefined).success).toBe(true);
    expect(entreePartielle.optional().safeParse({ max: 2 }).success).toBe(true);
    expect(cles).toEqual(['id', 'type', 'label', 'labelF', 'desc', 'source', 'alsoIn', 'maison', 'icon', 'max']);
    // En famille `table` comme en `record`, `entries` EST un champ de l'entrée.
    expect(REPLIQUES.table.cles).toContain('die');
    expect(REPLIQUES.table.cles).toContain('entries');
    // En famille `record`, `entries` EST un champ de l'entrée : `cles` ne ment pas sur la forme.
    expect(REPLIQUES.record.cles).toContain('entries');
  });

  it('`affinerEntree` MORD sur l’entrée, sans rouvrir le sceau', () => {
    const borne = document(
      'talent',
      'entite',
      { max: z.number() },
      { max: { label: 'Maximum' } },
      EXPOSITION,
      { affinerEntree: (e) => e.superRefine((v, ctx) => { if ((v as { max: number }).max > 3) ctx.addIssue({ code: 'custom', message: 'max plafonné à 3' }); }) },
    );
    expect(borne.schema.safeParse([{ ...ENV('talent'), max: 2 }]).success).toBe(true);
    const ko = borne.schema.safeParse([{ ...ENV('talent'), max: 9 }]);
    expect(ko.success).toBe(false);
    expect(JSON.stringify(ko.error)).toContain('max plafonné à 3');
    expect((borne.entree as unknown as Record<string, unknown>).extend).toBeUndefined();
    expect((borne.schema as unknown as { element: Record<string, unknown> }).element.extend).toBeUndefined();
  });

  it('`affinerDataset` MORD sur le dataset (unicité d’ids), sans rouvrir le sceau', () => {
    const unique = document(
      'talent',
      'entite',
      { max: z.number() },
      { max: { label: 'Maximum' } },
      EXPOSITION,
      {
        affinerDataset: (d) =>
          d.superRefine((v, ctx) => {
            const ids = (v as { id: string }[]).map((e) => e.id);
            if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'id dupliqué' });
          }),
      },
    );
    expect(unique.schema.safeParse([{ ...ENV('talent'), max: 1 }, { ...ENV('talent'), id: 'y', max: 2 }]).success).toBe(true);
    const ko = unique.schema.safeParse([{ ...ENV('talent'), max: 1 }, { ...ENV('talent'), max: 2 }]);
    expect(ko.success).toBe(false);
    expect(JSON.stringify(ko.error)).toContain('id dupliqué');
    expect((unique.entree as unknown as Record<string, unknown>).extend).toBeUndefined();
  });

  it('`affinerEntree` MORD AUSSI en famille `record` : l’entrée y est le DOCUMENT (enveloppe + `entries`)', () => {
    const palette = document(
      'palette-jouet',
      'record',
      {},
      {},
      EXPOSITION,
      {
        valeurRecord: z.string(),
        affinerEntree: (e) =>
          e.superRefine((v, ctx) => {
            if (!Object.keys((v as { entries: Record<string, string> }).entries).length) {
              ctx.addIssue({ code: 'custom', message: 'AFFINER-A-MORDU' });
            }
          }),
      },
    );
    expect(palette.schema.safeParse({ ...ENV('palette-jouet'), entries: { bois: '#000000' } }).success).toBe(true);
    const ko = palette.schema.safeParse({ ...ENV('palette-jouet'), entries: {} });
    expect(ko.success).toBe(false);
    expect(JSON.stringify(ko.error)).toContain('AFFINER-A-MORDU');
  });

  it('`cleRecord` FERME l’univers des clés quand le def le déclare (patron `teintesJeu`)', () => {
    const teintes = document('palette-jouet', 'record', {}, {}, EXPOSITION, {
      cleRecord: z.enum(['bois', 'pierre']),
      valeurRecord: z.string(),
    });
    const toutes = { bois: '#000000', pierre: '#ffffff' };
    expect(teintes.schema.safeParse({ ...ENV('palette-jouet'), entries: toutes }).success).toBe(true);
    expect(teintes.schema.safeParse({ ...ENV('palette-jouet'), entries: { ...toutes, lave: '#000000' } }).success).toBe(false);
    // zod 4.4.3, mesuré : une clé ÉNUMÉRÉE rend le record EXHAUSTIF — une clé déclarée qui manque est
    // refusée. C'est la forme du def réel `defs/teintesJeu.ts:134` (`z.record(z.enum(TEINTE_KEYS), …)`).
    expect(teintes.schema.safeParse({ ...ENV('palette-jouet'), entries: { bois: '#000000' } }).success).toBe(false);
    expect(() =>
      document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, { cleRecord: z.string() }),
    ).toThrow(/`cleRecord` n'a de sens que pour la famille « record »/);
  });

  it('REFUSE un champ `entries` déclaré par un def `record` : la fabrique le pose, en le nommant', () => {
    expect(() =>
      document('palette-jouet', 'record', { entries: z.string() }, { entries: { label: 'Entrées' } }, EXPOSITION, {
        valeurRecord: z.string(),
      }),
    ).toThrow(/la fabrique pose « entries »/);
  });

  it('`valeurRecord` : EXIGÉ par la famille `record`, REFUSÉ partout ailleurs, en nommant le document', () => {
    expect(() => document('palette-jouet', 'record', {}, {}, EXPOSITION)).toThrow(/« record » exige `valeurRecord`/);
    expect(() =>
      document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, { valeurRecord: z.string() }),
    ).toThrow(/`valeurRecord` n'a de sens que pour la famille « record » \(ici « entite »\)/);
  });
});

describe('ref() — id validé AU PARSE contre le registre généré', () => {
  it('accepte un id RÉEL de son dataset et le brande', () => {
    const noeud = ref('skill');
    expect(noeud.safeParse({ id: UNE_COMPETENCE.id }).success).toBe(true);
    const idParse = idDe('skill').parse(UNE_COMPETENCE.id);
    const attendu: Id<'skill'> = idParse;
    expect(attendu).toBe(UNE_COMPETENCE.id);
  });

  it('REFUSE un id inventé en nommant le type, l’id et le dataset', () => {
    const res = ref('skill').safeParse({ id: 'competence-qui-n-existe-pas' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/ref\('skill'\).*competence-qui-n-existe-pas.*skills\.json/);
  });

  it('compose FERMÉ avec les champs du porteur (`extra`) et refuse le reste', () => {
    const possede = ref('skill', { advances: z.number() });
    expect(possede.safeParse({ id: UNE_COMPETENCE.id, advances: 3 }).success).toBe(true);
    expect(possede.safeParse({ id: UNE_COMPETENCE.id, advances: 3, value: 40 }).success).toBe(false);
  });

  it('`refs()` valide chaque id de la liste, `typedRef()` résout selon le `type` porté', () => {
    expect(refs('skill').safeParse([UNE_COMPETENCE.id]).success).toBe(true);
    expect(refs('skill').safeParse([UNE_COMPETENCE.id, 'inconnu']).success).toBe(false);
    expect(typedRef().safeParse({ type: 'skill', id: UNE_COMPETENCE.id }).success).toBe(true);
    expect(typedRef().safeParse({ type: 'talent', id: UNE_COMPETENCE.id }).success).toBe(false);
  });

  it('`pick()` accepte « n parmi » et le tirage sur table, jamais les deux', () => {
    const p = pick('skill');
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }] }).success).toBe(true);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }], table: { id: 'x' } }).success).toBe(false);
  });

  it('la MARCHE retrouve la référence à son path exact (source de l’intégrité référentielle générique)', () => {
    const jouet = z.array(z.strictObject({ comp: ref('skill'), sorts: refs('spell').optional() }));
    expect(slotsDe('src/data', 'jouet.json', jouet)).toEqual([
      { root: 'src/data', dataset: 'jouet.json', path: '[].comp.id', type: 'skill', espece: 'id', cardinalite: 'liste' },
      { root: 'src/data', dataset: 'jouet.json', path: '[].sorts[]', type: 'spell', espece: 'id', cardinalite: 'liste' },
    ]);
    expect(cibleDe('skill')).toBe('skills.json');
  });
});

describe('specRef() — spécialisation ouverte vs pool fermé', () => {
  it('Compétence : spécialisation OUVERTE (`LDB 09 l.40`) — une spec créée passe', () => {
    expect(TYPES.skill.specsOpen).toBe(true);
    const r = specRef('skill');
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id, spec: 'une-specialisation-creee' }).success).toBe(true);
  });

  it('Talent : pool FERMÉ — une spec déclarée passe, une spec hors pool est nommée', () => {
    expect(TYPES.talent.specsOpen).toBe(false);
    const r = specRef('talent');
    expect(r.safeParse({ id: UN_TALENT_A_SPECS.id, spec: UN_TALENT_A_SPECS.specs![0].id }).success).toBe(true);
    const res = r.safeParse({ id: UN_TALENT_A_SPECS.id, spec: 'spec-hors-pool' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/spec-hors-pool.*talents\.json/);
  });

  it('« spec » XOR « choix » : jamais les deux, jamais aucun', () => {
    const r = specRef('skill');
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id, choix: true }).success).toBe(true);
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id, spec: 'a', choix: true }).success).toBe(false);
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id }).success).toBe(false);
  });

  it('REFUSE « spec » sur une Compétence qui n’est pas Groupée (`LDB 09 l.36-40`)', () => {
    const athletisme = (skillsJson as EntreeASpecs[]).find((s) => s.id === 'athletisme')!;
    expect(declareDesSpecs(athletisme)).toBe(false);
    expect(estSpecialisable('skill', 'athletisme')).toBe(false);
    const res = specRef('skill').safeParse({ id: 'athletisme', spec: 'bidon' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/ne déclare aucune spécialisation/);

    const savoir = (skillsJson as EntreeASpecs[]).find((s) => s.id === 'savoir')!;
    expect(declareDesSpecs(savoir)).toBe(true);
    expect(specRef('skill').safeParse({ id: 'savoir', spec: 'loi' }).success).toBe(true);
  });

  it('REFUSE « choix » quand l’univers de specs de l’entité est VIDE', () => {
    const aleatoire = (talentsJson as EntreeASpecs[]).find((t) => t.id === 'talent-aleatoire')!;
    expect(declareDesSpecs(aleatoire)).toBe(false);
    expect(specRef('talent').safeParse({ id: 'talent-aleatoire', choix: true }).success).toBe(false);
    expect(specRef('talent').safeParse({ id: 'talent-aleatoire', choix: [] }).success).toBe(false);
    expect(specRef('talent').safeParse({ id: 'talent-aleatoire', choix: ['x'] }).success).toBe(false);
  });

  it('un Talent à pool DÉRIVÉ (`specsSource`) est spécialisable et résout ses specs réelles', () => {
    const magie = (talentsJson as EntreeASpecs[]).find((t) => t.id === 'magie-des-arcanes')!;
    expect(magie.specsSource).toBeTruthy();
    expect(magie.specs).toBeUndefined();
    expect(estSpecialisable('talent', 'magie-des-arcanes')).toBe(true);
    expect(specRef('talent').safeParse({ id: 'magie-des-arcanes', spec: 'gueule' }).success).toBe(true);
    expect(specRef('talent').safeParse({ id: 'magie-des-arcanes', spec: 'domaine-inexistant' }).success).toBe(false);
  });
});

describe('byId — le type et l’id doivent s’accorder', () => {
  it('refuse à la COMPILATION un id d’un autre type', () => {
    const byId: SignatureById = (type, id) => `${type}:${String(id)}`;
    const idCompetence = idDe('skill').parse(UNE_COMPETENCE.id);
    expect(byId('skill', idCompetence)).toBe(`skill:${UNE_COMPETENCE.id}`);
    // @ts-expect-error — un `Id<'skill'>` n'est pas un `Id<'talent'>` (`NoInfer` fige le type).
    byId('talent', idCompetence);
  });

  it("la porte zod FRAPPE la marque de type — `Id<'skill'>` en sortie, jamais un `string` nu", () => {
    expectTypeOf(idDe('skill').parse(UNE_COMPETENCE.id)).toEqualTypeOf<Id<'skill'>>();
    expectTypeOf(idDe('talent').parse(UN_TALENT_A_SPECS.id)).not.toEqualTypeOf<Id<'skill'>>();
    expectTypeOf<string>().not.toEqualTypeOf<Id<'skill'>>();
    const idCompetence = idDe('skill').parse(UNE_COMPETENCE.id);
    // @ts-expect-error — la marque de type ferme l'affectation croisée entre deux types d'entité.
    const idTalent: Id<'talent'> = idCompetence;
    expect(idTalent).toBe(UNE_COMPETENCE.id);
  });
});
