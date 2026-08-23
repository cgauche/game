import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { classerValeur, mesurerEnveloppe, scannerDonnees, scannerRedeclarations } from '../../scripts/docs/lib/structures-scan.mjs';
import { CONCEPTS, signature } from '../../scripts/docs/lib/structures-lexique.mjs';
import { introspecterDefs } from '../../scripts/docs/lib/zod-introspect.mjs';
import { SCHEMA_DEFS } from './schemas/_registry.generated';
import {
  STRUCTURES_CIBLES,
  STRUCTURES_ENVELOPPE,
  STRUCTURES_FORMES,
  STRUCTURES_HOMONYMES,
  STRUCTURES_OPS,
  STRUCTURES_ORPHELINES,
  STRUCTURES_REDECLARATIONS,
} from '../../scripts/guards/lib/structuresStock.mjs';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — sous quelle FORME chaque concept est-il écrit dans la donnée (dataset, champ porteur mesuré, signature) ? ' +
    'B — le stock NOMINATIF de ce qui reste à migrer, ligne par ligne, avec son compte d’occurrences. ' +
    'C — chaque ligne porte le LOT qui l’éteint (L1a #1466 FK · L1b #1467 enveloppe · L1c #1468 ops · ' +
    'L1d #1469 source · L2 refs de Compétence · L3 Talent/Trait/Objet · L4 Valeurs), et part avec sa migration.',
  primitive:
    '`scannerDonnees` / `scannerRedeclarations` (`scripts/docs/lib/structures-scan.mts`). Ce scan lit la DONNÉE JSON ' +
    'des deux racines (`src/data`, `src/scenes`) et l’AST des `src/data/schemas/defs/*.ts` — il ne passe donc PAS par ' +
    '`readCorpus` (`scripts/guards/lib/sourceCorpus.mjs`), qui ne lit que du CODE.',
  perimetre:
    'Les 124 documents authorés des deux racines, leurs schémas zod du registre, et les littéraux d’objet zod des defs. ' +
    'La référence est ANCRÉE SUR L’INDEX DES IDS : le champ porteur est mesuré (clé du parent), jamais déclaré.',
  angleMort: [
    'COLLISIONS d’ids : le même id vit dans plusieurs datasets — la résolution est AMBIGUË (jamais fausse), la colonne « cibles » liste tous les datasets atteignables.',
    'Un `label` qui est aussi un id peut faire résoudre un `{text}` narratif vers une entité homonyme (mesuré au doc).',
    'La résolvabilité d’un `{text}` ne vérifie AUCUN type d’entité attendu : c’est un candidat, pas un verdict.',
    'Le partage d’un SITE (dataset, champ, clé) tranche entre référence cassée et document embarqué : un site dont la part de résolution frôle la moitié est un angle mort.',
    'Deux comparateurs de `water-exposure.json` (`<=`/`>=` sous `woundsRemaining`/`woundsLost`) échappent à `conditionSchema` et restent comptés en op.',
    'Les sauvegardes ne sont pas comptées : le périmètre est le document AUTHORÉ, `saves` a sa propre politique de version.',
    'Un concept exprimé en SCALAIRE hors liste (`species: "humain"`) est mesuré sous la forme `id-nu`, sans signature d’objet.',
    '`kind` est polysémique et n’est pas dédoublonné (Condition, Flow, événement de mer, pion de scène).',
    'Le classement est ORDONNÉ : une VALEUR (reconnue à son noyau) passe avant une RÉFÉRENCE ; un objet qui recoupe deux concepts n’est compté qu’une fois.',
    'Le scan AST ne voit pas les clés ajoutées par `.extend(...)`, ni un schéma composé par une fabrique, ni les defs hors du dossier `defs/`.',
    'Le candidat « schéma commun » est apparié par SIGNATURE EXACTE : un candidat à examiner, jamais un verdict.',
    'Les portes MOTEUR (`src/engine`, `src/state`) sont hors périmètre : ce contrat parle de la DONNÉE et de ses schémas.',
    'La candidature `plage` est STRUCTURELLE (élément de tableau à `min`/`max` numériques) : un `{min,max}` porté par un champ hors tableau n’est pas mesuré comme plage.',
  ],
  baseline: {
    fichier: 'scripts/guards/lib/structuresStock.mjs',
    decroissant: true,
    raison:
      'Le stock EST le dénominateur du chantier #1463 : chaque ligne se solde par une migration vers la forme cible, ' +
      'et part dans le MÊME commit. Une ligne neuve est une dérive, jamais une exception à inscrire.',
  },
  ticket: '#1465',
} as const;

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
/** UN seul scan pour tout le fichier : le test consomme la mesure, il ne relit jamais les JSON. */
const scan = scannerDonnees(ROOT, new Map(introspecterDefs(SCHEMA_DEFS).map((d) => [d.file, d.famille])));
const { redeclarations } = scannerRedeclarations(ROOT);

/** Un ensemble de lignes en texte, trié — les diffs de vitest restent lisibles. */
const lignes = (xs: string[]): string[] => [...xs].sort();

const cleForme = (f: { concept: string; dataset: string; champ: string; signature: string; statut: string; strate: string; occurrences: number }) =>
  `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature} | ${f.statut} | ${f.strate} | ${f.occurrences}`;
const cleOrpheline = (o: { dataset: string; champ: string; signature: string; motif: string; occurrences: number }) =>
  `${o.dataset} | ${o.champ} | ${o.signature} | ${o.motif} | ${o.occurrences}`;
const cleOp = (o: { op: string; signature: string; dataset: string; occurrences: number }) =>
  `${o.op} | ${o.signature} | ${o.dataset} | ${o.occurrences}`;

describe('structures de la donnée — stock nominatif décroissant (#1463 L0)', () => {
  it('l’en-tête de garde est structuré (#1475) : question A→B→C, primitive, périmètre, angles morts, baseline, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('structures-scan.mts');
    expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(10);
    expect(GARDE.baseline).toMatchObject({ fichier: 'scripts/guards/lib/structuresStock.mjs', decroissant: true });
    expect(GARDE.ticket).toBe('#1465');
  });

  it('signatures CIBLES : lexique == `STRUCTURES_CIBLES` (une cible ne se décrète pas dans le lexique)', () => {
    const auLexique = CONCEPTS.flatMap((c) =>
      c.signatures.filter((s) => s.statut === 'cible').map((s) => `${c.id} | ${s.sig}`),
    );
    expect(
      lignes(auLexique),
      'le lexique déclare des signatures `cible` que `STRUCTURES_CIBLES` ne connaît pas (ou l’inverse) — faire passer une graphie en cible la sort du dénominateur : ça se décide au STOCK, pas d’un mot du lexique.',
    ).toEqual(lignes(STRUCTURES_CIBLES.map((c) => `${c.concept} | ${c.signature}`)));
  });

  it('formes à éteindre : observé == stock (présence, statut, strate ET occurrences)', () => {
    const observees = scan.formes
      .filter((f) => f.statut === 'historique' || f.statut === 'divergente')
      .map(cleForme);
    expect(
      lignes(observees),
      'écart entre les formes OBSERVÉES et `STRUCTURES_FORMES` — une ligne en trop côté observé est une dérive neuve (elle se migre), une ligne en trop côté stock est périmée (elle se retire). Le `statut` et la `strate` entrent dans la clé : un statut menteur rougit.',
    ).toEqual(lignes(STRUCTURES_FORMES.map(cleForme)));
  });

  it('signatures ORPHELINES (hors strate) : observé == stock', () => {
    expect(
      lignes(scan.orphelines.map(cleOrpheline)),
      'écart entre les signatures ORPHELINES observées et `STRUCTURES_ORPHELINES` — un objet qui annonce une référence et ne résout vers rien se compte, il ne se tait pas.',
    ).toEqual(lignes(STRUCTURES_ORPHELINES.map(cleOrpheline)));
  });

  it('signatures d’OPS : observé == stock (dénominateur du lot L1c #1468)', () => {
    expect(
      lignes(scan.ops.map(cleOp)),
      'écart entre les signatures d’op OBSERVÉES et `STRUCTURES_OPS` — `gameOpSchema` ne valide rien, ce stock EST le dénominateur de la strate Ops.',
    ).toEqual(lignes(STRUCTURES_OPS.map(cleOp)));
  });

  it('homonymes nominatifs : observé == stock', () => {
    const cle = (h: { cle: string; classes: readonly string[]; occurrences: number }) =>
      `${h.cle} | ${[...h.classes].sort().join('/')} | ${h.occurrences}`;
    const observees = scan.homonymes.map((h) => cle({ cle: h.cle, classes: h.classes, occurrences: h.total }));
    expect(
      lignes(observees),
      'écart entre les homonymes OBSERVÉS et `STRUCTURES_HOMONYMES` — un nom de concept est RÉSERVÉ à son type (#1463 S2).',
    ).toEqual(lignes(STRUCTURES_HOMONYMES.map(cle)));
  });

  it('divergences d’enveloppe (racine ET documents embarqués) : observé == stock', () => {
    const cle = (e: {
      role: string;
      cle: string;
      motif: string;
      detail: string;
      document: string;
      chemin: string;
      entrees: number;
    }) => `${e.role} | ${e.cle} | ${e.motif}${e.detail ? `:${e.detail}` : ''} | ${e.document} › ${e.chemin} | ${e.entrees}`;
    expect(
      lignes(scan.enveloppe.map(cle)),
      'écart entre les divergences d’ENVELOPPE observées et `STRUCTURES_ENVELOPPE` — le dénominateur du lot L1b (#1467) : absences sur les ENTRÉES DE RACINE, clés divergentes partout, y compris sur les documents EMBARQUÉS.',
    ).toEqual(lignes(STRUCTURES_ENVELOPPE.map(cle)));
  });

  it('redéclarations locales dans les defs : observé == stock (keyé par def | champ | concept | signature)', () => {
    const cle = (r: { def: string; champ: string; concept: string; signature: string; statut: string; commun: string }) =>
      `${r.def} | ${r.champ} | ${r.concept} | ${r.signature} | ${r.statut} | ${r.commun}`;
    const compte = new Map<string, number>();
    for (const r of redeclarations) compte.set(cle(r), (compte.get(cle(r)) ?? 0) + 1);
    const observees = [...compte].map(([k, n]) => `${k} | ${n}`);
    const stockees = STRUCTURES_REDECLARATIONS.map((r) => `${cle(r)} | ${r.occurrences}`);
    expect(
      lignes(observees),
      'écart entre les redéclarations OBSERVÉES (AST des `src/data/schemas/defs/*.ts`) et `STRUCTURES_REDECLARATIONS` — une forme partagée se déclare UNE fois dans `common.ts`. Le CHAMP entre dans la clé : sans lui, des littéraux de champs différents s’agrègent en une ligne.',
    ).toEqual(lignes(stockees));
  });

  it('les sept stocks ne font que DÉCROÎTRE (aucune ligne neuve hors migration)', () => {
    const mesure = [
      ['STRUCTURES_CIBLES', STRUCTURES_CIBLES.length, 15],
      ['STRUCTURES_FORMES', STRUCTURES_FORMES.length, 780],
      ['STRUCTURES_HOMONYMES', STRUCTURES_HOMONYMES.length, 6],
      ['STRUCTURES_REDECLARATIONS', STRUCTURES_REDECLARATIONS.length, 101],
      ['STRUCTURES_ENVELOPPE', STRUCTURES_ENVELOPPE.length, 160],
      ['STRUCTURES_ORPHELINES', STRUCTURES_ORPHELINES.length, 90],
      ['STRUCTURES_OPS', STRUCTURES_OPS.length, 403],
    ] as const;
    const gonfles = mesure.filter(([, n, plafond]) => n > plafond).map(([nom, n, plafond]) => `${nom} ${n} > ${plafond}`);
    expect(
      gonfles,
      'stock(s) qui ont GONFLÉ — une structure neuve se pose à la forme CIBLE du lexique, elle ne se stocke pas ; une cible neuve se décide en revue.',
    ).toEqual([]);
  });

  it('chaque ligne du stock porte sa DATE et son LOT d’extinction', () => {
    const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const sansDate = [
      ...STRUCTURES_CIBLES.filter((c) => !dateOk(c.date)).map((c) => `cible ${c.concept} ${c.signature}`),
      ...STRUCTURES_FORMES.filter((f) => !dateOk(f.date)).map(cleForme),
      ...STRUCTURES_HOMONYMES.filter((h) => !dateOk(h.date)).map((h) => h.cle),
      ...STRUCTURES_ENVELOPPE.filter((e) => !dateOk(e.date)).map((e) => `${e.role} | ${e.cle} | ${e.document}`),
      ...STRUCTURES_REDECLARATIONS.filter((r) => !dateOk(r.date)).map((r) => r.def),
      ...STRUCTURES_ORPHELINES.filter((o) => !dateOk(o.date)).map(cleOrpheline),
      ...STRUCTURES_OPS.filter((o) => !dateOk(o.date)).map(cleOp),
    ];
    expect(sansDate, 'ligne(s) de stock sans date au format AAAA-MM-JJ').toEqual([]);
    const sansLot = [
      ...STRUCTURES_FORMES.filter((f) => !f.lot?.trim()).map(cleForme),
      ...STRUCTURES_HOMONYMES.filter((h) => !h.lot?.trim()).map((h) => h.cle),
      ...STRUCTURES_ENVELOPPE.filter((e) => !e.lot?.trim()).map((e) => `${e.role} | ${e.cle} | ${e.document} › ${e.chemin}`),
      ...STRUCTURES_REDECLARATIONS.filter((r) => !r.lot?.trim()).map((r) => `${r.def} | ${r.signature}`),
      ...STRUCTURES_ORPHELINES.filter((o) => !o.lot?.trim()).map(cleOrpheline),
      ...STRUCTURES_OPS.filter((o) => !o.lot?.trim()).map(cleOp),
    ];
    expect(
      sansLot,
      'ligne(s) de stock sans LOT d’extinction — un dénominateur sans propriétaire ne se solde jamais (#1465 F3).',
    ).toEqual([]);
  });

  it('les deux racines de documents sont scannées', () => {
    const racines = new Set(scan.documents.map((d) => d.racine));
    expect([...racines].sort()).toEqual(['src/data', 'src/scenes']);
    expect(scan.documents.filter((d) => d.racine === 'src/scenes').length).toBeGreaterThan(0);
  });
});

describe('la référence est ANCRÉE sur l’index des ids (contrats positifs)', () => {
  const occurrence = (dataset: string, champ: string, sig: string) =>
    scan.formes.find((f) => f.concept === 'reference' && f.dataset === dataset && f.champ === champ && f.signature === sig);

  it.each([
    ['creatures.json', 'skills', 'id,value', 'skills.json'],
    ['careerLevels.json', 'ref', 'id,spec', 'skills.json'],
    ['aa-criticals.json', 'ops', 'id,value+…', 'etats.json'],
    ['arene-projet.json', 'members', 'entityId', 'arene-projet.json'],
    ['maladies.json', 'symptoms', 'symptomId', 'symptoms.json'],
    ['activities.json', 'ops', 'tableId+…', 'tables.json'],
  ])('%s › %s {%s} est une occurrence de référence dont la cible résout vers %s', (dataset, champ, sig, cible) => {
    const f = occurrence(dataset, champ, sig);
    expect(f, `aucune occurrence de référence mesurée sous \`${dataset} › ${champ} {${sig}}\` — le champ porteur est MESURÉ, pas déclaré.`).toBeTruthy();
    expect(f!.occurrences).toBeGreaterThan(0);
    expect(f!.cibles, 'la référence ne résout vers aucun document : l’index des ids ne la porte pas.').toContain(cible);
  });

  it('un `{id,label}` de spécialisation n’est JAMAIS un champ de référence (anti-circularité)', () => {
    expect(
      scan.champsDeReference,
      '`specs` est devenu un champ porteur de références : le contre-exemple canonique du lexique (`{id,label}` = un DOCUMENT embarqué) a basculé — c’est la circularité que la passe 4 supprime.',
    ).not.toContain('specs');
    for (const champ of ['skills', 'ops', 'members', 'symptoms'])
      expect(scan.champsDeReference, `le champ \`${champ}\` porte des références mesurées et devrait être vu.`).toContain(champ);
    expect(
      CONCEPTS.filter((c) => 'vocabulaire' in c || 'marqueurs' in c || 'champsPorteurs' in c || 'seuil' in c).map((c) => c.id),
      'un concept redéclare un VOCABULAIRE ou une liste de champs porteurs : c’est le mécanisme circulaire que la passe 4 supprime — un champ porteur se MESURE.',
    ).toEqual([]);
  });

  it('les 452 refs à plat dans les ops sont VUES : aucune n’est orpheline sous un `op`', () => {
    const refsDansOps = scan.formes.filter((f) => f.concept === 'reference' && (f.champ === 'ops' || f.champ === 'onFail'));
    expect(refsDansOps.reduce((a, f) => a + f.occurrences, 0)).toBeGreaterThan(400);
    expect(
      refsDansOps.every((f) => f.statut === 'divergente' || f.statut === 'historique'),
      'une ref à plat dans une op est une DIVERGENCE : la cible L1c est une ref EMBOÎTÉE (`{op, skill: {id}}`).',
    ).toBe(true);
  });

  it('une ENTRÉE DE RACINE n’est jamais orpheline (les 90 faux orphelins de `props.json` sont morts)', () => {
    expect(scan.orphelines.filter((o) => o.champ === '(racine)')).toEqual([]);
  });

  it('la clé d’identité d’un document n’est pas comptée comme une référence à lui-même', () => {
    const auto = scan.formes.filter((f) => f.concept === 'reference' && f.champ === 'id' && f.signature === 'id-nu');
    expect(auto, 'un document se référencerait lui-même par sa propre clé d’identité.').toEqual([]);
  });
});

describe('les concepts de VALEUR sont reconnus à leur noyau (contrats positifs)', () => {
  const sig = (o: object) => signature(Object.keys(o));
  const classement = (o: object, champ = '') => classerValeur(sig(o), Object.keys(o), { champ });

  it('`{gold,silver}` est une monnaie historique, `{brass,gold,silver}` la cible', () => {
    expect(classement({ gold: 1, silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'historique' });
    expect(classement({ brass: 1, gold: 1, silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'cible' });
    expect(classement({ book: 'ldb', page: 12 })).toMatchObject({ concept: 'source', statut: 'cible' });
  });

  it('un coefficient saisonnier sous `price` est un PRIX déclaré, jamais une monnaie à éteindre', () => {
    expect(classement({ printemps: 1, ete: 0.5, automne: 0.25, hiver: 0.5 }, 'price')).toMatchObject({
      concept: 'prix',
      statut: 'declaree',
    });
    expect(
      STRUCTURES_FORMES.filter((f) => f.concept === 'monnaie' && /automne|dice/.test(f.signature)),
      'un multiplicateur saisonnier (ou un prix TIRÉ) était stocké comme « monnaie à éteindre » : ce lot d’extinction est insoldable — une saison ne devient pas une bourse.',
    ).toEqual([]);
  });

  it('`{min,max}` n’est une plage que comme ÉLÉMENT DE TABLEAU à bornes numériques', () => {
    const cles = ['min', 'max'];
    expect(classerValeur('max,min', cles, { champ: 'params', candidats: ['plage'] })).toMatchObject({ concept: 'plage', statut: 'cible' });
    expect(classerValeur('max,min', cles, { champ: 'params' })).toBeNull();
    expect(classerValeur('manannD10,max,min', ['min', 'max', 'manannD10'], { champ: 'impressed' })).toBeNull();
  });

  it('une clé RÉSERVÉE encore homonyme ne force aucun concept (`count`, `cost`, `skill`)', () => {
    expect(classement({ count: 2, id: 'x' }, 'trappings')).toBeNull();
    expect(classement({ cost: 3, weightEnc: 1 }, 'install')).toBeNull();
  });
});

describe('l’enveloppe : ce qu’un document doit porter (contrats positifs)', () => {
  const cle = (c: string, classe: string, n: number) => ({ cle: c, n, parClasse: [{ classe, n }] });

  it('une ENTRÉE DE RACINE sans `id`/`label`/`source` sort en divergences ; conforme, elle sort vide', () => {
    const neuf = mesurerEnveloppe([
      { document: 'neuf.json', chemin: '(entrées)', portee: 'racine', famille: 'entité', nbEntrees: 3, cles: [cle('code', 'string', 3), cle('nom', 'string', 3)] },
    ]);
    expect(neuf.map((e) => `${e.role} | ${e.cle} | ${e.motif}`).sort()).toEqual([
      'identité | id | clé absente',
      'identité | nom | clé divergente',
      'libellé | label | clé absente',
      'libellé | nom | clé divergente',
      'source | source | clé absente',
    ]);
    const conforme = mesurerEnveloppe([
      {
        document: 'ok.json',
        chemin: '(entrées)',
        portee: 'racine',
        famille: 'entité',
        nbEntrees: 3,
        cles: [cle('id', 'string', 3), cle('label', 'string', 3), cle('desc', 'string', 3), cle('source', 'object', 3)],
      },
    ]);
    expect(conforme).toEqual([]);
  });

  it('un document EMBARQUÉ n’est sommé de rien : seules ses clés DIVERGENTES comptent', () => {
    const embarque = mesurerEnveloppe([
      { document: 'flow.json', chemin: 'steps[].effect', portee: 'embarqué', famille: 'entité', nbEntrees: 5, cles: [cle('text', 'string', 5), cle('title', 'string', 5), cle('type', 'string', 5)] },
    ]);
    expect(embarque.map((e) => `${e.role} | ${e.cle} | ${e.motif}`).sort()).toEqual([
      'libellé | title | clé divergente',
      'prose | text | clé divergente',
    ]);
  });

  it('l’enveloppe descend sous l’entrée : un document EMBARQUÉ est mesuré sous son chemin', () => {
    const embarques = scan.groupesEnveloppe.filter((g) => g.portee === 'embarqué');
    expect(embarques.length, 'aucun document embarqué mesuré — la borne de profondeur est revenue.').toBeGreaterThan(0);
    expect(
      scan.groupesEnveloppe.filter((g) => g.portee === 'racine').length,
      'les entrées de racine et les documents embarqués se comptent SÉPARÉMENT.',
    ).toBe(scan.documents.length);
  });

  it('§5 : les Conditions retirées du compte d’ops sont celles qui PORTAIENT un `op`', () => {
    expect(scan.totalConditionsAvecOp + scan.totalOps, 'objets portant un `op` = ops de jeu + Conditions à `op`.').toBe(2181);
    expect(scan.totalConditionsSansOp, 'des Conditions sans `op` n’ont jamais été comptées en op : elles ne se « retirent » pas.').toBe(185);
  });
});
