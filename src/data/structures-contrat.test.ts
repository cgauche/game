import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classerValeur,
  mesurerEnveloppe,
  scannerDonnees,
  scannerRedeclarations,
  MARQUE_HORS_STRATE,
} from '../../scripts/docs/lib/structures-scan.mjs';
import {
  ANGLES_MORTS,
  CONCEPTS,
  LOTS_CONNUS,
  LOT_CLE_RESERVEE,
  lotDeForme,
  signature,
} from '../../scripts/docs/lib/structures-lexique.mjs';
import { choixDeclares, introspecterDefs } from '../../scripts/docs/lib/zod-introspect.mjs';
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
    'Les documents authorés des deux racines `src/data` et `src/scenes`, leurs schémas zod du registre, et les littéraux ' +
    'd’objet zod des defs. La référence est ANCRÉE SUR L’INDEX DES IDS, scopé par dataset : le champ porteur est mesuré ' +
    '(clé du parent), jamais déclaré, et la résolution se mesure par SITE (dataset, champ, clé).',
  angleMort: ANGLES_MORTS,
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
const FAMILLES = new Map(introspecterDefs(SCHEMA_DEFS).map((d) => [d.file, d.famille]));
const CHOIX = choixDeclares(SCHEMA_DEFS);
const scan = scannerDonnees(ROOT, FAMILLES, CHOIX);
const { redeclarations } = scannerRedeclarations(ROOT);

/** Un ensemble de lignes en texte, trié — les diffs de vitest restent lisibles. */
const lignes = (xs: string[]): string[] => [...xs].sort();

/**
 * DATE unique du stock : elle entre dans la clé comparée. Re-dater une ligne pour la faire passer
 * n'est donc plus possible — la ligne se compare, date comprise, à la mesure du jour du lot.
 */
const DATE_STOCK = '2026-08-23';
/** `lot` et `date` ENTRENT dans la clé comparée (#1465 F1) ; le LOT attendu se DÉDUIT du concept. */
type Trace = { lot?: string; date?: string };
const trace = (x: Trace, lot: string) => ` | ${x.lot ?? lot} | ${x.date ?? DATE_STOCK}`;
const cleForme = (
  f: {
    concept: string;
    dataset: string;
    champ: string;
    signature: string;
    statut: string;
    strate: string;
    occurrences: number;
    cibles?: readonly string[];
  } & Trace,
) =>
  `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature} | ${f.statut} | ${f.strate} | ${f.occurrences}` +
  trace(f, lotDeForme(f.concept, f.signature, f.cibles ?? []));
const cleOrpheline = (o: { dataset: string; champ: string; signature: string; motif: string; occurrences: number } & Trace) =>
  `${o.dataset} | ${o.champ} | ${o.signature} | ${o.motif} | ${o.occurrences}` +
  trace(o, o.motif === 'clé de référence non résolue' ? 'L1a #1466' : 'L1b #1467');
/**
 * CLIQUET des signatures hors strate (#1465) : elles ne sont pas au stock — la table EXHAUSTIVE
 * de `docs/structures-donnees.md` EST la liste de référence, et ce plafond garde son COMPTE.
 */
const PLAFOND_HORS_STRATE = 1116;
const cleInvisible = (o: { dataset: string; champ: string; signature: string }) =>
  `${o.dataset} | ${o.champ} | ${o.signature}`;

/** La table hors strate du doc COMMITTÉ (HEAD), bornée par `MARQUE_HORS_STRATE`. */
const horsStrateDuDoc = (): Set<string> => {
  const chemin = 'docs/structures-donnees.md';
  const versions: string[] = [];
  try {
    versions.push(execFileSync('git', ['show', `HEAD:${chemin}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }));
  } catch {
    /* pas de HEAD lisible (worktree neuf) : la version de travail fait référence. */
  }
  versions.push(readFileSync(join(ROOT, chemin), 'utf8'));
  const cles = new Set<string>();
  for (const md of versions) {
    const debut = md.indexOf(MARQUE_HORS_STRATE.debut);
    const fin = md.indexOf(MARQUE_HORS_STRATE.fin);
    if (debut < 0 || fin <= debut) continue;
    for (const ligne of md.slice(debut, fin).split('\n')) {
      const cellules = ligne.split('|').map((c) => c.trim().replace(/^`|`$/g, '').replace(/\\\|/g, '|'));
      if (cellules.length !== 6 || !/^\d+$/.test(cellules[4])) continue;
      cles.add(`${cellules[1]} | ${cellules[2]} | ${cellules[3]}`);
    }
    if (cles.size) break;
  }
  return cles;
};

const cleOp = (o: { op: string; signature: string; dataset: string; occurrences: number } & Trace) =>
  `${o.op} | ${o.signature} | ${o.dataset} | ${o.occurrences}` + trace(o, 'L1c #1468');

describe('structures de la donnée — stock nominatif décroissant (#1463 L0)', () => {
  it('l’en-tête de garde est structuré (#1475) : question A→B→C, primitive, périmètre, angles morts, baseline, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('structures-scan.mts');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER les deux racines mesurées.').toMatch(/src\/data.*src\/scenes/s);
    expect(GARDE.angleMort, 'les angles morts se lisent dans UNE source (`ANGLES_MORTS`), jamais recopiés.').toBe(ANGLES_MORTS);
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

  it('cliquet HORS STRATE : le COMPTE de signatures ne fait que décroître, les neuves sont NOMMÉES', () => {
    const reference = horsStrateDuDoc();
    expect(
      reference.size,
      'la table EXHAUSTIVE des signatures hors strate est introuvable dans `docs/structures-donnees.md` ' +
        '(bornes `MARQUE_HORS_STRATE`) — sans elle le cliquet n’a plus de liste de référence : régénérer le doc.',
    ).toBeGreaterThan(0);
    const neuves = lignes(scan.invisibles.filter((o) => !reference.has(cleInvisible(o))).map(cleInvisible));
    expect(
      scan.invisibles.length,
      `signatures HORS STRATE en HAUSSE (${scan.invisibles.length} > ${PLAFOND_HORS_STRATE}) — une structure neuve ` +
        'se pose à la forme CIBLE du lexique. Signature(s) NEUVE(s), absentes de la table du doc de référence :\n' +
        (neuves.join('\n') || '(aucune : la hausse vient d’occurrences reventilées, comparer la table du doc)'),
    ).toBeLessThanOrEqual(PLAFOND_HORS_STRATE);
  });

  it('signatures d’OPS : observé == stock (dénominateur du lot L1c #1468)', () => {
    expect(
      lignes(scan.ops.map(cleOp)),
      'écart entre les signatures d’op OBSERVÉES et `STRUCTURES_OPS` — `gameOpSchema` ne valide rien, ce stock EST le dénominateur de la strate Ops.',
    ).toEqual(lignes(STRUCTURES_OPS.map(cleOp)));
  });

  it('homonymes nominatifs : observé == stock', () => {
    const cle = (h: { cle: string; classes: readonly string[]; occurrences: number } & Trace) =>
      `${h.cle} | ${[...h.classes].sort().join('/')} | ${h.occurrences}` + trace(h, LOT_CLE_RESERVEE[h.cle] ?? 'L4 #1463');
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
    } & Trace) =>
      `${e.role} | ${e.cle} | ${e.motif}${e.detail ? `:${e.detail}` : ''} | ${e.document} › ${e.chemin} | ${e.entrees}` +
      trace(e, e.role === 'source' ? 'L1d #1469' : 'L1b #1467');
    expect(
      lignes(scan.enveloppe.map(cle)),
      'écart entre les divergences d’ENVELOPPE observées et `STRUCTURES_ENVELOPPE` — le dénominateur du lot L1b (#1467) : absences sur les ENTRÉES DE RACINE, clés divergentes partout, y compris sur les documents EMBARQUÉS.',
    ).toEqual(lignes(STRUCTURES_ENVELOPPE.map(cle)));
  });

  it('redéclarations locales dans les defs : observé == stock (keyé par def | champ | concept | signature)', () => {
    const cle = (r: { def: string; champ: string; concept: string; signature: string; statut: string; commun: string }) =>
      `${r.def} | ${r.champ} | ${r.concept} | ${r.signature} | ${r.statut} | ${r.commun}`;
    const compte = new Map<string, { r: (typeof redeclarations)[number]; n: number }>();
    for (const r of redeclarations) {
      const vu = compte.get(cle(r)) ?? { r, n: 0 };
      compte.set(cle(r), { r, n: vu.n + 1 });
    }
    const observees = [...compte].map(([k, { r, n }]) => `${k} | ${n}` + trace({}, lotDeForme(r.concept, r.signature)));
    const stockees = STRUCTURES_REDECLARATIONS.map((r) => `${cle(r)} | ${r.occurrences}` + trace(r, lotDeForme(r.concept, r.signature)));
    expect(
      lignes(observees),
      'écart entre les redéclarations OBSERVÉES (AST des `src/data/schemas/defs/*.ts`) et `STRUCTURES_REDECLARATIONS` — une forme partagée se déclare UNE fois dans `common.ts`. Le CHAMP entre dans la clé : sans lui, des littéraux de champs différents s’agrègent en une ligne.',
    ).toEqual(lignes(stockees));
  });

  it('les sept stocks ne font que DÉCROÎTRE (aucune ligne neuve hors migration)', () => {
    const mesure = [
      // #1443 (mobilier volumique) : trois lignes s'ajoutent au dénominateur, chacune INSTANCE d'une
      // famille déjà stockée et rangée dans son lot — `ref` id-nu d'un pion de scène (L3, comme les
      // 306 des trois autres scènes), `primitives {material+…}` (L3, comme `walls`/`masses`),
      // `source` absente de `propMaterials.json` (L1d, comme `lightTones.json`).
      ['STRUCTURES_CIBLES', STRUCTURES_CIBLES.length, 15],
      ['STRUCTURES_FORMES', STRUCTURES_FORMES.length, 675],
      ['STRUCTURES_HOMONYMES', STRUCTURES_HOMONYMES.length, 6],
      ['STRUCTURES_REDECLARATIONS', STRUCTURES_REDECLARATIONS.length, 102],
      ['STRUCTURES_ENVELOPPE', STRUCTURES_ENVELOPPE.length, 165],
      ['STRUCTURES_ORPHELINES', STRUCTURES_ORPHELINES.length, 93],
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

  it('chaque ligne porte un LOT CONNU, et les comptes PAR LOT ne font que décroître', () => {
    const parLot = new Map<string, number>();
    const toutes = [
      ...STRUCTURES_FORMES,
      ...STRUCTURES_HOMONYMES,
      ...STRUCTURES_REDECLARATIONS,
      ...STRUCTURES_ENVELOPPE,
      ...STRUCTURES_ORPHELINES,
      ...STRUCTURES_OPS,
    ];
    for (const l of toutes) parLot.set(l.lot, (parLot.get(l.lot) ?? 0) + 1);
    expect(
      [...parLot.keys()].filter((l) => !(LOTS_CONNUS as readonly string[]).includes(l)).sort(),
      'lot(s) inconnu(s) : un dénominateur ne se range que dans l’un des 7 lots d’extinction (`LOTS_CONNUS`).',
    ).toEqual([]);
    // Cliquet PAR LOT : réaffecter une ligne d’un lot à un autre fait DÉBORDER le lot d’arrivée.
    const plafonds: Record<string, number> = {
      'L1a #1466': 16,
      'L1b #1467': 205,
      'L1c #1468': 403,
      'L1d #1469': 66,
      'L2 #1463': 138,
      'L3 #1463': 392,
      'L4 #1463': 224,
    };
    expect(
      [...parLot].filter(([lot, n]) => n > plafonds[lot]).map(([lot, n]) => `${lot} ${n} > ${plafonds[lot]}`),
      'lot(s) qui ont GONFLÉ — une ligne ne change pas de lot sans revue, et un lot ne grossit pas sans dérive.',
    ).toEqual([]);
    expect(toutes.length, 'le dénominateur total du chantier ne fait que décroître.').toBeLessThanOrEqual(1444);
  });

  it('les ANGLES MORTS ont UNE source : le lexique, recopié nulle part (test, stock, doc)', () => {
    const stock = readFileSync(join(ROOT, 'scripts/guards/lib/structuresStock.mjs'), 'utf8');
    const doc = readFileSync(join(ROOT, 'docs/structures-donnees.md'), 'utf8');
    expect(
      ANGLES_MORTS.filter((a) => !stock.includes(a)),
      'l’en-tête de `structuresStock.mjs` ne porte plus les angles morts de `ANGLES_MORTS` — la copie a divergé.',
    ).toEqual([]);
    expect(
      ANGLES_MORTS.filter((a) => !doc.includes(a)),
      'le § « Périmètre mesuré et angles morts » de `docs/structures-donnees.md` a divergé de `ANGLES_MORTS`.',
    ).toEqual([]);
  });

  it('MUTATION par champ : chaque champ de chaque stock entre dans la clé comparée', () => {
    const mute = (v: unknown) => (typeof v === 'number' ? v + 999 : Array.isArray(v) ? [...v, 'ZZZ'] : `${v}~MUTE`);
    const cleHomonyme = (h: { cle: string; classes: readonly string[]; occurrences: number } & Trace) =>
      `${h.cle} | ${[...h.classes].sort().join('/')} | ${h.occurrences}` + trace(h, LOT_CLE_RESERVEE[h.cle] ?? 'L4 #1463');
    const cleEnveloppe = (e: { role: string; cle: string; motif: string; detail: string; document: string; chemin: string; entrees: number } & Trace) =>
      `${e.role} | ${e.cle} | ${e.motif}${e.detail ? `:${e.detail}` : ''} | ${e.document} › ${e.chemin} | ${e.entrees}` +
      trace(e, e.role === 'source' ? 'L1d #1469' : 'L1b #1467');
    const cleRedeclaration = (r: { def: string; champ: string; concept: string; signature: string; statut: string; commun: string; occurrences: number } & Trace) =>
      `${r.def} | ${r.champ} | ${r.concept} | ${r.signature} | ${r.statut} | ${r.commun} | ${r.occurrences}` +
      trace(r, lotDeForme(r.concept, r.signature));
    const stocks: Array<[string, readonly Record<string, unknown>[], (x: never) => string, string[]]> = [
      ['STRUCTURES_CIBLES', STRUCTURES_CIBLES, ((c: { concept: string; signature: string; date: string }) => `${c.concept} | ${c.signature} | ${c.date}`) as never, ['concept', 'signature', 'date']],
      ['STRUCTURES_FORMES', STRUCTURES_FORMES, cleForme as never, ['concept', 'dataset', 'champ', 'signature', 'statut', 'strate', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_HOMONYMES', STRUCTURES_HOMONYMES, cleHomonyme as never, ['cle', 'classes', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_REDECLARATIONS', STRUCTURES_REDECLARATIONS, cleRedeclaration as never, ['def', 'champ', 'concept', 'signature', 'statut', 'commun', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_ENVELOPPE', STRUCTURES_ENVELOPPE, cleEnveloppe as never, ['role', 'cle', 'motif', 'detail', 'document', 'chemin', 'entrees', 'lot', 'date']],
      ['STRUCTURES_ORPHELINES', STRUCTURES_ORPHELINES, cleOrpheline as never, ['dataset', 'champ', 'signature', 'motif', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_OPS', STRUCTURES_OPS, cleOp as never, ['op', 'signature', 'dataset', 'occurrences', 'lot', 'date']],
    ];
    const aveugles: string[] = [];
    for (const [nom, arr, cle, champs] of stocks) {
      const base = lignes(arr.map(cle as (x: unknown) => string)).join('\n');
      for (const champ of champs) {
        const i = arr.findIndex((x) => x[champ] !== undefined && x[champ] !== '' && x[champ] !== null);
        if (i < 0) {
          aveugles.push(`${nom}.${champ} (aucune ligne ne le porte)`);
          continue;
        }
        const copie = arr.map((x, j) => (j === i ? { ...x, [champ]: mute(x[champ]) } : x));
        if (lignes(copie.map(cle as (x: unknown) => string)).join('\n') === base) aveugles.push(`${nom}.${champ}`);
      }
    }
    expect(
      aveugles,
      'champ(s) de stock HORS de la clé comparée : les muter laisse la garde verte — le pilotage du chantier reposerait sur un champ non gardé (#1465 F1).',
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
    ['careerLevels.json', 'ref', 'ref>id,spec', 'skills.json'],
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

describe('`{text}` : la forme DÉCLARÉE ne couvre que l’irréductible narratif (#1463 L0, #624)', () => {
  const forme = (source: typeof scan, signature: string) =>
    source.formes.find(
      (f) => f.concept === 'reference' && f.dataset === 'careerLevels.json' && f.champ === 'trappings' && f.signature === signature,
    );

  it('un `{text}` dont le libellé RÉSOUT est `text (résolvable)` divergente ; « Sa Honte » reste `text` declaree', () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-text-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      const temoin = scannerDonnees(copie, FAMILLES, CHOIX);
      expect(temoin.formes.length, 'la COPIE non mutée ne mesure pas comme l’arbre.').toBe(scan.formes.length);
      expect(forme(temoin, 'text'), 'la forme `text` déclarée a disparu du témoin.').toMatchObject({ statut: 'declaree' });
      expect(forme(temoin, 'text (résolvable)'), 'la forme `text (résolvable)` a disparu du témoin.').toMatchObject({
        statut: 'divergente',
        strate: 'Référence',
      });

      const chemin = join(copie, 'src/data/careerLevels.json');
      const niveaux = JSON.parse(readFileSync(chemin, 'utf8')) as Array<Record<string, unknown>>;
      // « Dague » EST le `label` du trapping `dague` ; « Sa Honte » n’est le libellé d’aucune entité.
      niveaux[0].trappings = [...(niveaux[0].trappings as unknown[]), { text: 'Dague' }, { text: 'Sa Honte' }];
      writeFileSync(chemin, JSON.stringify(niveaux), 'utf8');
      const apres = scannerDonnees(copie, FAMILLES, CHOIX);

      expect(
        forme(apres, 'text (résolvable)')!.occurrences - forme(temoin, 'text (résolvable)')!.occurrences,
        '`{text:"Dague"}` sous `trappings` doit être classé `text (résolvable)` : un texte qui résout vers un `label` est une référence à migrer en `{id}` (#624), pas du narratif déclaré.',
      ).toBe(1);
      expect(
        forme(apres, 'text')!.occurrences - forme(temoin, 'text')!.occurrences,
        '`{text:"Sa Honte"}` doit rester la forme `text` DECLARÉE : l’irréductible narratif ne se migre pas.',
      ).toBe(1);
      expect(
        forme(apres, 'text (résolvable)')!.cibles,
        'la forme résolvable doit IMPRIMER le dataset où le libellé a été trouvé.',
      ).toContain('trappings.json');
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});

describe('contrôle POSITIF côté DONNÉE : le détecteur MORD (#1465 F21)', () => {
  it('trois dérives injectées dans une COPIE de l’arbre sont VUES : forme neuve, orpheline neuve, op neuve', () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-contrat-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      const temoin = scannerDonnees(copie, FAMILLES, CHOIX);
      const cleF = (f: { concept: string; dataset: string; champ: string; signature: string; statut: string; occurrences: number }) =>
        `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature} | ${f.statut} | ${f.occurrences}`;
      const cleO = (o: { dataset: string; champ: string; signature: string; motif: string }) =>
        `${o.dataset} | ${o.champ} | ${o.signature} | ${o.motif}`;
      const cleOpSonde = (o: { op: string; signature: string; dataset: string }) => `${o.op} | ${o.signature} | ${o.dataset}`;
      expect(
        temoin.formes.length,
        'la COPIE non mutée ne mesure pas comme l’arbre : le contrôle positif ne prouverait rien.',
      ).toBe(scan.formes.length);

      const chemin = join(copie, 'src/data/axes.json');
      const axes = JSON.parse(readFileSync(chemin, 'utf8')) as Array<Record<string, unknown>>;
      axes[0].sondes = [{ skillIdent: 'athletisme', poids: 3 }]; // graphie de référence NEUVE
      axes[0].opsSonde = [{ op: 'sondeJuge', talentId: 'affable', valeur: 1 }]; // op NEUVE à ref à plat
      axes[0].casses = [{ machinId: 'ceci-n-existe-pas' }]; // FK morte : clé …Id qui ne résout vers rien
      writeFileSync(chemin, JSON.stringify(axes), 'utf8');

      const apres = scannerDonnees(copie, FAMILLES, CHOIX);
      const formesNeuves = apres.formes.filter((f) => !temoin.formes.some((g) => cleF(g) === cleF(f))).map(cleF);
      const orphelinesNeuves = apres.orphelines.filter((o) => !temoin.orphelines.some((q) => cleO(q) === cleO(o))).map(cleO);
      const opsNeuves = apres.ops.filter((o) => !temoin.ops.some((q) => cleOpSonde(q) === cleOpSonde(o))).map(cleOpSonde);

      expect(formesNeuves, 'une GRAPHIE de référence neuve (`skillIdent`) n’est pas vue : le stock ne mordrait pas.').toContain(
        'reference | axes.json | sondes | skillIdent+… | divergente | 1',
      );
      expect(orphelinesNeuves, 'une FK morte (`machinId`) n’est pas vue : le motif `clé de référence non résolue` serait inatteignable.').toContain(
        'axes.json | casses | machinId | clé de référence non résolue',
      );
      expect(opsNeuves, 'une op NEUVE à ref à plat n’est pas vue : le dénominateur de la strate Ops serait aveugle.').toContain(
        'sondeJuge | op,talentId,valeur | axes.json',
      );
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});
