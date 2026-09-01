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
  LOTS_DE_PEUPLEMENT,
  LOT_CLE_RESERVEE,
  lotDeForme,
  signature,
} from '../../scripts/docs/lib/structures-lexique.mjs';
import { choixDeclares, introspecterDefs } from '../../scripts/docs/lib/zod-introspect.mjs';
import { CLES_ENVELOPPE } from './schemas/grammaire/document';

/**
 * Clés que `document()` pose sur TOUT document, sans qu'aucun def ne les demande — DÉRIVÉES de
 * `CLES_ENVELOPPE`, jamais re-tapées.
 *
 * `variants` en est EXCLUE et c'est la seule : la fabrique ne la pose que si le def le DEMANDE
 * (`options.variantes`, `document.ts` — « un document sans `variantes` n'admet aucun `variants` »).
 * Elle reste donc une DÉCLARATION du def, comme n'importe quel champ de `champs` : un def qui
 * l'active sans qu'aucune entrée ne la porte est bien « un schéma plus large que sa donnée », et sa
 * dette se compte. Mesuré au 2026-08-28 : 3 defs l'activent — `spells` (18 entrées porteuses),
 * `talents` (12), `traits` (0/131, dette réelle).
 */
const CLES_POSEES_INCONDITIONNELLEMENT: readonly string[] = (CLES_ENVELOPPE as readonly string[]).filter((k) => k !== 'variants');
import { defsDeDocument } from '../../scripts/docs/lib/slots-registre.mjs';
import {
  STRUCTURES_CIBLES,
  STRUCTURES_DEFAUT,
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
/** Le DÉCLARÉ couvre les DEUX racines (#1466 L1a) — jointure par BASENAME, comme le scan key. */
const DEFS = defsDeDocument();
/** UN seul scan pour tout le fichier : le test consomme la mesure, il ne relit jamais les JSON. */
const DECLARES = introspecterDefs(DEFS);
const FAMILLES = new Map(DECLARES.map((d) => [d.file, d.famille]));
const CHOIX = choixDeclares(DEFS);
const scan = scannerDonnees(ROOT, FAMILLES, CHOIX);
const { redeclarations } = scannerRedeclarations(ROOT);

/** Un ensemble de lignes en texte, trié — les diffs de vitest restent lisibles. */
const lignes = (xs: string[]): string[] => [...xs].sort();

/**
 * DATE par DÉFAUT d'une ligne de stock : elle entre dans la clé comparée. Sur les stocks dont la
 * ligne OBSERVÉE ne reprend PAS le pilotage — tous sauf `STRUCTURES_FORMES` —, re-dater une ligne
 * pour la faire passer est impossible : elle se compare, date comprise, à la mesure du jour du lot.
 * Sur `STRUCTURES_FORMES`, `lot`/`motif`/`date` sont du PILOTAGE que `cleFormeObservee` reprend du
 * stock par le SITE : la sonde ne les mesure pas, ils se DÉCIDENT en revue (angle mort déclaré,
 * `ANGLES_MORTS` de `scripts/docs/lib/structures-lexique.mts`).
 */
const DATE_STOCK = '2026-08-23';
/**
 * `lot`, `motif` et `date` ENTRENT dans la clé comparée (#1465 F1) ; le LOT attendu se DÉDUIT du
 * concept quand la ligne n'en déclare pas. Ces trois champs sont du PILOTAGE : ils se DÉCIDENT en
 * revue, la sonde ne les mesure pas — c'est pourquoi la forme observée les reprend du stock
 * (`pilotageDeForme` ci-dessous).
 */
type Trace = { lot?: string; date?: string; motif?: string };
const trace = (x: Trace, lot: string) => ` | ${x.lot ?? lot} | ${x.date ?? DATE_STOCK}`;
/** LOT par défaut d'une divergence d'ENVELOPPE observée (le stock, lui, le porte ligne à ligne) :
 *  une absence sur les ENTRÉES DE RACINE part en `L1d #1469`, une clé divergente en `L1b #1467`. */
const lotEnveloppe = (e: { role: string }) => (e.role === 'source' ? 'L1d #1469' : 'L1b #1467');
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
  trace(f, lotDeForme(f.concept, f.signature, f.cibles ?? [])) +
  (f.motif ? ` | ${f.motif}` : '');
/** SITE d'une forme : ce qui l'identifie indépendamment de sa mesure et de son pilotage. */
const siteDeForme = (f: { concept: string; dataset: string; champ: string; signature: string }) =>
  `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature}`;
/** Le stock des formes, typé pour la lecture de son PILOTAGE (`lot`, `motif`, `date`). */
const FORMES: readonly (Parameters<typeof cleForme>[0])[] = STRUCTURES_FORMES;
/**
 * LOTISSEMENT déclaré d'un site, repris par la forme OBSERVÉE. Le lot déduit de `lotDeForme` lit la
 * colonne `cibles`, qui liste TOUS les datasets atteignables (angle mort des COLLISIONS d'ids) : une
 * ligne dont le concept réel n'est pas celui-là se re-lotit en revue et porte son `motif`. Un site
 * que le stock ne connaît pas garde son lot déduit — une dérive neuve entre avec son heuristique.
 */
const pilotageDeForme = new Map(FORMES.map((f) => [siteDeForme(f), { lot: f.lot, motif: f.motif, date: f.date }]));
const cleFormeObservee = (f: Parameters<typeof cleForme>[0]) => cleForme({ ...f, ...pilotageDeForme.get(siteDeForme(f)) });
const cleOrpheline = (o: { dataset: string; champ: string; signature: string; motif: string; occurrences: number } & Trace) =>
  `${o.dataset} | ${o.champ} | ${o.signature} | ${o.motif} | ${o.occurrences}` +
  trace(o, o.motif === 'clé de référence non résolue' ? 'L1a #1466' : '#1553');
/**
 * PILOTAGE (`lot`, `date`) d'une ORPHELINE, repris du stock par SITE — MÊME patron que
 * `pilotageDeForme` ci-dessous : la sonde ne mesure ni le lot ni la date (angle mort déclaré). Sans
 * cette reprise, toute ligne était sommée de porter la date GLOBALE du stock, et une entrée née plus
 * tard ne pouvait être verte qu'en MENTANT sur sa date de naissance. Les deux champs restent gardés :
 * une ligne du stock que la mesure n'observe plus reste rouge, et le test de MUTATION par champ
 * (ci-dessous) prouve qu'ils entrent toujours dans la clé comparée.
 */
const siteOrpheline = (o: { dataset: string; champ: string; signature: string }) => `${o.dataset} | ${o.champ} | ${o.signature}`;
const pilotageOrpheline = new Map(STRUCTURES_ORPHELINES.map((o) => [siteOrpheline(o), { lot: o.lot, date: o.date }]));
const cleOrphelineObservee = (o: Parameters<typeof cleOrpheline>[0]) => cleOrpheline({ ...o, ...pilotageOrpheline.get(siteOrpheline(o)) });
/**
 * CLIQUET des signatures hors strate (#1465) : elles ne sont pas au stock — la table EXHAUSTIVE
 * de `docs/structures-donnees.md` EST la liste de référence, et ce plafond garde son COMPTE.
 */
// Vague console #1411/#1426 distante, réconciliation post-rebase : `actions.json` gagne une entrée
// et le champ `hote` — la donnée est committée, le cliquet la rattrape (1116→1118).
// #1466 L1a volet A (1118→1119) : le DÉCLARÉ couvre désormais `src/scenes`, donc les discriminants
// des 4 projets se FERMENT — `loup-et-saumure-projet.json › threat {camp,tier}` cesse d'être compté
// comme référence `tier+…` (sa valeur est un littéral d'enum du schéma) et tombe hors strate. C'est
// le MÊME objet qui change de classement, pas une structure neuve : le dénominateur des formes
// décroît de 8 lignes dans le même geste.
// #1467 L1b V-P1 (1119→1120) : `donnees.manifest.json › rubriques` passe `nom` → `label`, donc sa
// signature `entrees,nom` (divergente, au stock) devient `entrees,label` (forme CIBLE du lexique,
// hors strate). MÊME objet, nouveau classement — le stock perd 12 lignes dans le même geste
// (identité+libellé `nom` des 3 manifestes, `id` de careerLevels/calendarPhases/raw.manifest,
// `key` de calendarPhases, `label` absent de primitives/systemes).
// L2 #1548, commit 3c (1120→1135) : AUCUNE structure neuve — les 334 références de Compétence qui
// s'emboîtent en `skill: { id, spec? }` posent chacune un OBJET là où il n'y avait qu'une chaîne, et
// ces objets sont à la forme CIBLE (`id` / `id,spec`) : ils sont HORS STRATE par construction. Les
// signatures nommées par la garde (`bonus,op,skill`, `mod,op,skill`, `blocked,op,skill`…) sont les
// PAYLOADS D'OP qui, ayant perdu leur `spec` frère ou leur `skill` chaîne, rejoignent la table hors
// strate. Le dénominateur À ÉTEINDRE, lui, décroît de 16 lignes dans le même geste (cf. cliquets).
// L2 #1548, commit 3d (1135→1137) : AUCUNE structure neuve — `talents.json › reverseFailed` porte
// désormais une LISTE nommée `skills` là où `skill` désignait tantôt une réf, tantôt une liste. La
// clé cessant d'être un nom de concept RÉSERVÉ, ses deux signatures (`skills`, `capDR,skills`)
// quittent le dénominateur à éteindre (`STRUCTURES_ORPHELINES` 106→104) et rejoignent la table hors
// strate. MÊMES objets, nouveau classement.
// L2 #1548, commit 4 (1137→1139) : AUCUNE structure neuve — l'avancement quitte ses quatre graphies
// enveloppantes, et le « A ou B » des listes s'écrit `{pick, of}`, une signature CIBLE du lexique.
// Les trois signatures NOMMÉES par la garde sont ce re-classement : `careerLevels.json › skills
// {of,pick}`, `careerLevels.json › talents {of,pick}`, `species.json › talents {of,pick}` — les
// MÊMES 45 objets qui s'écrivaient `{choice}`. +3 donc, et −1 : `species.json › choice
// {specOptions,wildcard}` MEURT (le joker à options bornées s'écrit `{id, choix: [ids]}`, forme
// CIBLE, et ne pose plus d'objet sous `choice`). +2 net, 1137 → 1139. Le dénominateur À ÉTEINDRE,
// lui, perd 19 lignes dans le même geste (cf. les cliquets par lot ci-dessous).
// #862 (1139→1142) : AUCUNE structure neuve — `mutations.json` porte pour la première fois un
// `effects` de déclencheur (Haine sporadique, `onDayStart`), et ses TROIS objets d'enveloppe sont les
// formes CIBLES déjà écrites par `traits.json`/`talents.json` : `effects {flow,on,trigger}`,
// `flow {effect,kind}`, `effect {on,ops,type}` — mesurées une par une contre la table du doc.
// #674 (1142→1144) : AUCUNE structure neuve — la RÉ-EXPOSITION (EDOC 08 l.122 : « Les Personnages
// atteints du rhume qui sont à nouveau exposés à la pluie ou à la neige voient la durée de la maladie
// prolongée de 1d10 jours ») devient une propriété de `maladies.json`, et son temps s'écrit à la
// graphie DÉJÀ posée par `incubation`/`duration` : `reExposition {prolonge}` + `prolonge {dice,unit}`
// (le `DiseaseTime` du fichier). Les deux signatures NOMMÉES par la garde sont ces deux enveloppes.
// #684 L4 (1144ⅆ1146) : AUCUNE structure neuve — le premier tronçon de carte du chapitre 1 pose deux
// objets aux formes DÉJÀ déclarées par le schéma de carte (`defs-scenes/worldmap.ts`) : le gating de
// nœud `when {expr,kind}` (l'algèbre `Condition` du moteur) et le Déplacement d'auteur par mode
// `speed {diligence}` (`MapRoute.speed`). Les deux signatures NOMMÉES par la garde sont ces deux-là.
// #717 (1146→1147) : AUCUNE structure neuve — le CADRE du chapitre pose deux objets aux formes DÉJÀ
// déclarées par le schéma du narratif (`defs-scenes/narratif.ts`) : `cloture {sousTitre,titre,when}`,
// dont le `when` est l'algèbre `Condition` déjà comptée pour le gating de carte, et l'enveloppe
// `narratif` qui gagne ses deux clés OPTIONNELLES. Solde net +1 (la signature `narratif` précédente,
// sans cadre, disparaît au profit de celle-ci).
// #684+#717 sur « La Barge du Sel » (1147→1149) : AUCUNE structure neuve — les MÊMES formes, portées
// par un second paquet. Signatures nommées par la garde : `when {expr,kind}` (l'algèbre `Condition`
// du moteur, portée par le lieu, la route et la clôture), `ouverture {ambiance,pitch,sousTitre,titre}`
// (`ouvertureSchema`), `cloture {sousTitre,titre,when}` (`clotureSchema`) et l'enveloppe `narratif`
// qui gagne ses deux clés optionnelles (`defs-scenes/narratif.ts`, #717) — solde net +2, la signature
// `narratif` sans cadre de ce paquet disparaissant au profit de celle-ci. Bump RÉVISABLE : la
// déclaration de ces formes en CIBLE au lexique est proposée à la vague enveloppe.
// #1463 L-monnaie-3 (1149→1152) : AUCUNE structure neuve — l'effet `giveMoney` cesse d'ÉTALER ses
// dénominations et porte sa charge sous `montant` (`giveMoneySchema`, `defs-scenes/effets.ts`), comme
// `giveXp.amount`. Les 3 signatures NOMMÉES par la garde sont la MEME enveloppe `{montant, type}`, une
// par projet porteur ; ce qu'elles remplacent (`{gold,type}`, `{silver,type}`, `{gold,silver,type}`)
// était compté DIVERGENT au stock des formes, d'où la hausse ici et la baisse de 8 lignes là-bas.
// #1463 L-monnaie-4 (1152→1157) : AUCUNE structure neuve — le nom `cost` rend son type. Sept formes
// quittent `STRUCTURES_ORPHELINES` (elles n'y étaient QUE parce que le NOM `cost` est réservé) et
// rejoignent le hors-strate à l'identique : `install {installation}` / `{installation,weightEnc}`,
// `flow {advantageCost,…}`, `advantageDefenseReaction {avantage}`, `prosthesisTraining` ×3 — d'où la
// hausse ici et la baisse de 7 lignes (29 occurrences) là-bas. Trois autres sont des RENOMMAGES 1:1
// (`cost|bands` → `installation|bands`, `cost|bands,per`, `ops {cost,…}` → `ops {advantageOrMovement,…}`),
// et DEUX enveloppes à clef unique DISPARAISSENT, aplaties sur leur porteur (`qualities cost {advantage}`,
// `talents cost {advantageOrMovement}`). Solde net +7 − 2 = +5.
const PLAFOND_HORS_STRATE = 1157;
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
      .map(cleFormeObservee);
    expect(
      lignes(observees),
      'écart entre les formes OBSERVÉES et `STRUCTURES_FORMES` — une ligne en trop côté observé est une dérive neuve (elle se migre), une ligne en trop côté stock est périmée (elle se retire). Le `statut` et la `strate` entrent dans la clé : un statut menteur rougit.',
    ).toEqual(lignes(STRUCTURES_FORMES.map(cleForme)));
  });

  it('signatures ORPHELINES (hors strate) : observé == stock', () => {
    expect(
      lignes(scan.orphelines.map(cleOrphelineObservee)),
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
      trace(e, lotEnveloppe(e));
    expect(
      lignes(scan.enveloppe.map(cle)),
      'écart entre les divergences d’ENVELOPPE observées et `STRUCTURES_ENVELOPPE` — absences sur les ENTRÉES DE RACINE (`L1d #1469`), clés divergentes partout (`L1b #1467`), y compris sur les documents EMBARQUÉS.',
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
    // PILOTAGE (`lot`, `date`) repris du stock par SITE — MÊME patron que `pilotageDeForme` et
    // `pilotageOrpheline` : la sonde ne mesure ni le lot ni la date. Sans cette reprise, toute ligne
    // était sommée de porter la date GLOBALE du stock, et une ligne née plus tard ne pouvait être
    // verte qu'en MENTANT sur sa date de naissance. Les deux champs restent gardés : une ligne du
    // stock que l'AST n'observe plus reste rouge, et le test de MUTATION par champ (ci-dessous)
    // prouve qu'ils entrent toujours dans la clé comparée.
    const pilotage = new Map(STRUCTURES_REDECLARATIONS.map((r) => [cle(r), { lot: r.lot, date: r.date }]));
    const observees = [...compte].map(
      ([k, { r, n }]) => `${k} | ${n}` + trace(pilotage.get(k) ?? {}, lotDeForme(r.concept, r.signature)),
    );
    const stockees = STRUCTURES_REDECLARATIONS.map((r) => `${cle(r)} | ${r.occurrences}` + trace(r, lotDeForme(r.concept, r.signature)));
    expect(
      lignes(observees),
      'écart entre les redéclarations OBSERVÉES (AST des `src/data/schemas/defs/*.ts`) et `STRUCTURES_REDECLARATIONS` — une forme partagée se déclare UNE fois dans la grammaire (`src/data/schemas/grammaire/`). Le CHAMP entre dans la clé : sans lui, des littéraux de champs différents s’agrègent en une ligne.',
    ).toEqual(lignes(stockees));
  });

  /**
   * CONTRAT du côté DÉCLARÉ : un document SCELLÉ par la fabrique `document()` — `pipe` à la racine —
   * rend ses clés. La SORTIE d'un tel pipe est un `transform`, qui n'en porte AUCUNE : un relevé qui
   * la prend pour entrée rend 0 clé sur TOUTE la famille config/record, et les deux volets qui
   * comparent déclaré × observé (clés jamais observées, forme déclarée jamais posée) se taisent au
   * lieu de mordre. La lecture se fait donc sur le nœud PORTEUR du pipe.
   */
  it('un document SCELLÉ par `document()` déclare ses clés — jamais zéro', () => {
    const scelles = DECLARES.filter((d) => d.racine.startsWith('pipe<'));
    expect(scelles.length, 'aucun document scellé au registre : le contrat ci-dessous ne mesurerait rien.').toBeGreaterThan(40);
    // Les SEULS documents scellés sans clé à rendre sont les deux records de valeur SCALAIRE :
    // `decorPalette.ts:18,31` et `teintesJeu.ts:140` déclarent `{}` champs et une `valeurRecord`
    // chaîne (palettes hex). La liste est NOMINATIVE, pas un filtre : un muet de plus sort par son
    // nom — c'est ainsi que se voit un relevé qui lirait la SORTIE du pipe (un `transform` sans clé)
    // au lieu de son nœud PORTEUR.
    expect(
      scelles.filter((d) => Object.keys(d.cles).length === 0).map((d) => `${d.file} (${d.note})`).sort(),
      'document(s) scellé(s) rendant ZÉRO clé déclarée — `introspecterDefs` (`scripts/docs/lib/zod-introspect.mts`) doit lire le nœud PORTEUR du pipe.',
    ).toEqual(['decorPalette.json (non-objet(string))', 'teintesJeu.json (non-objet(string))']);
    // Nominatif : un `config` (`crew-morale.ts:18-48`) et un `record` enveloppé rendent LEURS clés,
    // pas seulement celles que la fabrique pose d'office.
    expect(Object.keys(DECLARES.find((d) => d.file === 'crew-morale.json')!.cles).sort()).toEqual(
      expect.arrayContaining(['base', 'bands', 'factors']),
    );
    expect(Object.keys(DECLARES.find((d) => d.file === 'sizes.json')!.cles).length).toBeGreaterThan(0);
  });

  it('formes DÉCLARÉES jamais observées, sans lot de peuplement : observé == stock', () => {
    const cle = (x: { dataset: string; cle: string; date?: string }) => `${x.dataset} | ${x.cle} | ${x.date ?? DATE_STOCK}`;
    const observees: string[] = [];
    const parFichier = new Map(DECLARES.map((d) => [d.file, d]));
    for (const d of scan.documents) {
      const dec = parFichier.get(d.nom);
      if (!dec) continue;
      const vues = new Set(d.clesNiveau1.map((k) => k.cle));
      // Les clés posées INCONDITIONNELLEMENT par la fabrique (`document.ts`) sortent de la question
      // posée ici (un SCHÉMA plus large que sa donnée) : un `labelF` ou un `icon` qu'un dataset
      // n'emploie pas ne se « solde » pas — il n'y a rien à retirer d'un def qui ne l'a pas écrit.
      // Sans ce filtre, la restauration de couverture du sceau `pipe` (`zod-introspect.mts`, même
      // lot) en aurait versé 298 au stock, tous inertes.
      for (const c of Object.keys(dec.cles).filter((k) => !vues.has(k) && !CLES_POSEES_INCONDITIONNELLEMENT.includes(k)))
        observees.push(cle({ dataset: d.nom, cle: c, date: STRUCTURES_DEFAUT.find((s) => s.dataset === d.nom && s.cle === c)?.date }));
    }
    expect(
      lignes(observees),
      'écart entre les clés DÉCLARÉES JAMAIS OBSERVÉES et `STRUCTURES_DEFAUT` — un schéma plus large que la donnée se solde en retirant le champ ou en écrivant la donnée. Un déclaré-avant-posé ASSUMÉ ne se stocke PAS ici : il porte un lot de peuplement et s’ÉMET (`LOTS_DE_PEUPLEMENT`, doc §2.4 table B).',
    ).toEqual(lignes(STRUCTURES_DEFAUT.map(cle)));
  });

  /**
   * Ce que l'exclusion COÛTE, MESURÉ (#1467 L1b V-FLIP-ENTITE-b) — pas déclaré en prose. Une clé
   * ajoutée à `CLES_POSEES_INCONDITIONNELLEMENT` fait TAIRE toutes les dettes qu'elle porte : le
   * filtre se relit donc ici clé par clé, sur la mesure.
   *
   * `variants` est le cas qui a MORDU : rangée d'abord parmi les clés d'office, elle escamotait
   * `traits.json › variants` — une dette réelle, l'option étant DEMANDÉE par le def et portée par
   * 0 des 131 entrées. Le test ci-dessous gèle les deux comptes : sans `variants` dans l'exclusion
   * (l'état courant) le relevé en a UNE de plus, et cette une-là est nommée.
   */
  it('l’exclusion des clés d’office ne cache AUCUNE dette d’option — son coût est mesuré, clé par clé', () => {
    const releve = (exclues: readonly string[]) => {
      const out: string[] = [];
      const parFichier = new Map(DECLARES.map((d) => [d.file, d]));
      for (const d of scan.documents) {
        const dec = parFichier.get(d.nom);
        if (!dec) continue;
        const vues = new Set(d.clesNiveau1.map((k) => k.cle));
        for (const c of Object.keys(dec.cles).filter((k) => !vues.has(k) && !exclues.includes(k))) out.push(`${d.nom} | ${c}`);
      }
      return out.sort();
    };
    const courant = releve(CLES_POSEES_INCONDITIONNELLEMENT);
    const avecVariants = releve(CLES_ENVELOPPE as readonly string[]);
    expect(
      courant.filter((l) => !avecVariants.includes(l)),
      'exclure `variants` ne doit escamoter QUE la dette d’option de `traits.json` — une seconde ligne signalerait une clé d’office mal rangée.',
    ).toEqual(['traits.json | variants']);
    expect(CLES_POSEES_INCONDITIONNELLEMENT).not.toContain('variants');
    expect(courant.length - avecVariants.length, 'le delta d’exclusion vaut EXACTEMENT une ligne').toBe(1);
  });

  it('`cible-declaree` ne se STOCKE nulle part : c’est une ÉMISSION du doc, pas un dénominateur', () => {
    const stock = readFileSync(join(ROOT, 'scripts/guards/lib/structuresStock.mjs'), 'utf8');
    expect(
      /statut:\s*["']cible-declaree["']/.test(stock),
      'une ligne `cible-declaree` est entrée au stock : elle CROÎTRAIT (une forme se déclare avant d’être posée), et rendrait menteurs `GARDE.baseline.decroissant` et le cliquet des huit stocks.',
    ).toBe(false);
    expect(Object.keys(LOTS_DE_PEUPLEMENT).length, 'aucun lot de peuplement déclaré : la table B du doc serait vide de sens.').toBeGreaterThan(0);
  });

  it('les huit stocks ne font que DÉCROÎTRE (aucune ligne neuve hors migration)', () => {
    const mesure = [
      // #1443 (mobilier volumique) : trois lignes s'ajoutent au dénominateur, chacune INSTANCE d'une
      // famille déjà stockée et rangée dans son lot — `ref` id-nu d'un pion de scène (L3, comme les
      // 306 des trois autres scènes), `primitives {material+…}` (L3, comme `walls`/`masses`),
      // `source` absente de `propMaterials.json` (L1d, comme `lightTones.json`).
      // #1466 T3-b (dons de `giveTrapping`) : deux lignes s'ajoutent au dénominateur, chacune
      // INSTANCE de la famille déjà stockée `arene-projet.json › effect {<réf>,type}` (`encounter,type`,
      // `entityId,type`, `scene,type`, `spell,type`…) et rangée dans le MÊME lot L3. Elles n'existaient
      // pas AVANT la migration parce que le champ portait un LIBELLÉ, qui n'ouvre aucune référence :
      // c'est la donnée qui ENTRE dans la strate mesurée, pas une dérive de forme.
      // #1466 T3-b (migration qualités LIBELLÉ→id) : une ligne s'ajoute au dénominateur — le tableau
      // résolu DEVIENT une forme refs/ids-nus mesurée (ligne nominative `arene-projet.json › qualities`),
      // rangée dans le MÊME lot L3 : la donnée ENTRE dans la strate, ce n'est pas une dérive de forme.
      // #1466 L1a volet A : le DÉCLARÉ couvre les 2 racines — la fermeture des discriminants de
      // scène retire 8 lignes de formes (`ambiance`/`weather`/`threat` des 4 projets : leurs valeurs
      // sont des littéraux d'enum du schéma, elles n'ouvrent plus de référence). Le cliquet SUIT la
      // baisse : 679 → 671, sinon la marge regagnée servirait à absorber une dérive future.
      // Cliquet REMONTÉ 15 → 16 (L2 #1548, commit 0) : `refs / ids-nus` reçoit le statut `cible`. DESIGN
      // v2 S2 (#1463, commentaire du 2026-08-23) : « `refs(type)` = liste d'ids nus brandée (75 champs
      // `string[]`) » — la liste d'ids nus EST la forme visée, ce qui reste à faire est le TYPAGE du
      // champ. Une cible neuve se décide en revue : celle-ci porte sa citation et sa date.
      // Cliquet REMONTÉ 16 → 19 (L2 #1548, commit 4bis) : trois graphies reçoivent le statut `cible`
      // AU SITE du statbloc (`id,value`, `id,spec,value`, `choix,id,value`). Une cible neuve se
      // décide en revue : celles-ci portent leur citation (#1463, « `value` = le seul nom du NOMBRE
      // IMPRIMÉ au statbloc ») et leur date au stock, et leur réserve ouverte y est dite.
      // Cliquet REMONTÉ 19 → 21 (L4 #1463, vague `plage`, 2026-08-31) : deux graphies reçoivent le
      // statut `cible`, et aucune donnée ne bouge pour ça. (1) `plage | max,min+…` : la cible d'une
      // rangée de table est TRANCHÉE — fourchette PLATE `{min, max}` + `findTableEntry`
      // (`src/engine/tables.ts`, primitive de la table CLAUDE.md), et la charge utile d'une rangée
      // (102 charges distinctes mesurées) est INHÉRENTE : c'est ce que le suffixe `+…` de la
      // projection nomme, pas une divergence. Mesuré 2026-08-31 : 1441 objets à deux bornes, TOUS
      // `min,max` — zéro `from/to`, zéro `de/a`, zéro `low/high` — et ZÉRO `{range:{min,max}}`, la
      // cible emboîtée que le lexique déclarait n'existait NULLE PART (#1463 S1 amendé 2026-08-31,
      // motif au pilotage). (2) `bornes | max,min+…` : concept NEUF du lexique, les 23 objets de
      // `reglesOptionnelles.json` étaient comptés `plage divergente` par MISCLASSEMENT — ce sont les
      // bornes du DOMAINE d'un réglage (co-présence `default`/`step`), aucun d100 ne les traverse.
      // (3) `monnaie` × 6 sous-signatures (#1463 L-monnaie-3) : `moneyPartialSchema` déclare les 3
      // dénominations OPTIONNELLES et `toMoney` complète à 0 — un coût authoré qui n'écrit que ce
      // qu'il chiffre est à la forme cible. Les variantes `+…` restent HORS cibles : un étalement se
      // migre, il ne se blanchit pas.
      ['STRUCTURES_CIBLES', STRUCTURES_CIBLES.length, 27],
      // Cliquet DESCENDU 671 → 670 (#1467 L1b V-P7) : le statbloc à `size` d'`arene-projet.json` quitte
      // ce stock — le profil embarqué s'ANNONCE (`type: 'statblock'`) et sa forme est déclarée champ par
      // champ (`defs-scenes/communs.ts`), donc sa signature n'est plus lue comme une référence non
      // résolue. Il réapparaît à `STRUCTURES_ORPHELINES` ci-dessous : même objet, autre stock.
      // Cliquet DESCENDU 670 → 594 (L2 #1548, commit 0) : les 76 lignes `refs / ids-nus` quittent le
      // dénominateur avec la cible ci-dessus — aucune donnée ne bouge, c'est le LEXIQUE qui reconnaît
      // la forme déjà posée. Le cliquet SUIT la baisse.
      // Cliquet DESCENDU 594 → 587 (L2 #1548, commit 3b) : la graphie `skillId` MEURT de la donnée —
      // 8 lignes de référence de Compétence s'éteignent (activities ×2, axes ×2, crew-roles ×2,
      // talents, creatures.grant : 92 occurrences migrées vers la forme canonique `{id, spec?}`),
      // 1 ligne neuve apparaît (`creatures.json › spec` mesuré en id nu). Les conteneurs de TEST
      // gardent leur ligne (lot L4) : seule la référence DEDANS s'est emboîtée. Le cliquet SUIT.
      // Cliquet DESCENDU 587 → 557 (L2 #1548, commit 3c) : les FRÈRES PLATS `skill`+`spec` MEURENT de la
      // donnée — 334 références de Compétence s'emboîtent en `skill: { id, spec? }` sur 21 documents, si
      // bien que 31 lignes de graphie plate s'éteignent (ops `skillMod`/`skillDRBonus`/`castPenalty`/
      // `corruptionExposure`, conteneurs de Test, `talents.matches`/`reverseFailed`, `tavernGames`) et
      // qu'1 ligne neuve apparaît (`domains.json › test` : la même entrée, sa signature perdant le `spec`
      // frère — `difficulty,skill+…` → `difficulty,skill`). Le cliquet SUIT.
      // Cliquet REMONTÉ 557 → 558 (L2 #1548, commit 3d) : AUCUNE dérive neuve — la valeur de Test du
      // PNJ soigneur (`medicalAid`) ÉTAIT un NOMBRE nu, INVISIBLE à ce scan qui ne mesure que des
      // références ; devenue la référence de statbloc `{id, value}` de la racine scènes, elle entre au
      // dénominateur à la MÊME graphie historique que ses 4 562 sœurs (`creatures.json › skills`). Le
      // dénominateur GLOBAL, lui, DÉCROÎT : 557+106 = 663 → 558+104 = 662.
      // Cliquet DESCENDU 558 → 557 (L2 #1548, geste modèle) : les DEUX pseudo-PNJ de l'effet
      // `medicalAid` meurent de la donnée — la valeur de Guérison recopiée (`skill {id,value}`, 2
      // occurrences) s'éteint AVEC sa signature d'effet (`effect entityId,skill,type+…` → `entityId,type+…`),
      // et les 2 soigneurs de l'arène RÉFÉRENCENT désormais leur fiche de bestiaire (`ref id-nu` :
      // 291 → 293, la graphie déjà canonique du pion de scène). Une ligne de moins au stock.
      // Cliquet DESCENDU 557 → 538 (L2 #1548, commit 4) : les QUATRE graphies enveloppantes du champ
      // d'AVANCEMENT meurent de la donnée (careerLevels + species, 4 462 nœuds) — 20 lignes
      // s'éteignent (les 6 enveloppes `ref>…`/`wildcard>…` du lot L2, et les 14 lignes de graphie
      // côté champ porteur `skills`/`talents`), 1 ligne neuve apparaît (`species.json › of {random}` :
      // les 2 tirages qui vivaient en branche de `choice` vivent en branche de `pick`). Le cliquet SUIT.
      // Cliquet REMONTÉ 538 → 540 (#862) : deux lignes s'ajoutent au dénominateur, chacune INSTANCE
      // d'une famille déjà stockée et rangée dans son lot — `mutations.json › ops` reçoit les deux
      // graphies de référence de Trait que `mutations.json › passive` porte déjà (`traitId+…`,
      // `argFrom,traitId+…`, L3). C'est la donnée qui ENTRE dans la strate mesurée (le dataset n'avait
      // aucune op authorée avant le re-ciblage quotidien de Haine sporadique), pas une dérive de forme.
      // Cliquet DESCENDU 540 → 534 (L2 #1548, commit 4bis) : les 6 lignes de référence de Compétence
      // sous `skills` d'un STATBLOC (bestiaire ×2, `barge-du-sel` ×2, `loup-et-saumure` ×2 — 5 996
      // occurrences) sortent du dénominateur : ce sont des CIBLES au site (cf. `STRUCTURES_CIBLES`).
      // RECLASSEMENT, pas migration — aucune de ces 5 996 occurrences n'est réécrite ; ce que le
      // commit MIGRE, ce sont les 59 sentinelles textuelles qui vivaient DANS ces lignes.
      // Cliquet REMONTÉ 534 → 538 (#674, 2026-08-31) : la Pneumonie et le Rhume commun (EDOC 08
      // l.94-122) ENTRENT dans la strate mesurée avec deux champs que `maladies.json` ne portait pas
      // — `mutation {into+…}`, `dailyTest {difficulty+…}` — et deux conteneurs d'ops (`onFail`,
      // `otherwise`, tous deux `disease,symptomId+…`). Chacune est l'INSTANCE d'une famille déjà
      // stockée et rangée dans son lot (L3 pour les 3 références, L4 pour le Test) : donnée neuve, pas
      // forme neuve.
      // Cliquet REMONTÉ 538 → 541 (#684 L4, 2026-08-31) : le premier tronçon de carte du chapitre 1
      // fait ENTRER `diligence-projet.json` dans la strate des références de CARTE — `a`, `b`, `scene`
      // en `id-nu`, les trois lignes que les trois autres projets portent déjà pour leur worldMap,
      // rangées dans le MÊME lot L3. Donnée neuve à la forme déjà stockée, pas forme neuve : leur
      // extinction est celle de la fabrique de référence du schéma de carte (L2/L3 #1473), pour les
      // quatre projets à la fois.
      // Cliquet DESCENDU 541 → 480 (L4 #1463, vague `plage`, 2026-08-31) : les 61 lignes `plage`
      // (1421 occurrences) sortent du dénominateur — la fourchette PLATE `{min, max}` est la CIBLE
      // (cf. `STRUCTURES_CIBLES` ci-dessus), et ces objets y étaient déjà. AUCUNE de ces 1421
      // occurrences n'est réécrite : le suffixe `+…` que la projection leur donnait n'était pas une
      // divergence de graphie, c'était la charge utile INHÉRENTE d'une rangée de table. Le cliquet
      // SUIT la baisse, sinon la marge regagnée servirait à absorber une dérive future.
      // Cliquet REMONTÉ 480 → 481 (équipage de la Louve grise, 3fe450675, 2026-09-01) : les entités d'équipage de la barge portent
      // `appearance {species, tenue}`, la ligne SŒUR de celles que `loup-et-saumure`, `arene` et
      // `creatures.json` portent déjà (même concept, même lot L3). Donnée neuve à la forme déjà
      // stockée, pas forme neuve : son extinction est celle d'`entityAppearanceSchema`
      // (`src/data/schemas/grammaire/valeurs.ts`), où `species`/`tenue` sont des `z.string()` nus —
      // aucun `idDe(...)`, donc aucun slot, pour AUCUN des quatre porteurs.
      // Cliquet REMONTÉ 481 → 483 (équipage du Grimm et statblocs d'auteur de l'arène, 2026-09-01) : le MÊnE trou
      // étendu aux deux paquets restants — `loup-et-saumure` gagne la ligne `species,tenue` (équipage adverse
      // anonyme des deux abordages), `arene` la ligne `species` (les statblocs d'auteur Nuée de rats / Dragon
      // des ténèbres, sans tenue : une bête ne s'habille pas). Deux lignes SŒURS de plus, même lot, même
      // extinction qu'au cliquet précédent — donnée neuve à la forme déjà stockée, pas forme neuve.
      ['STRUCTURES_FORMES', STRUCTURES_FORMES.length, 483],
      // 8ᵉ stock, né du volet A : les clés déclarées jamais observées des DEUX racines (dont 5
      // apportées par les 4 projets de scène qui entrent au déclaré).
      // Cliquet DESCENDU 24 → 23 (#1467 L1b V-FLIP-ENTITE-c) : `creatures.json › group` est SOLDÉ —
      // 0 porteur en donnée ET 0 consommateur mesuré, le champ MEURT du def. Le cliquet SUIT la
      // baisse (même doctrine qu'à `STRUCTURES_FORMES` ci-dessus).
      // Cliquet REMONTÉ 23 → 27 (#1467 L1b V-formeProjet) : c'est la COUVERTURE du relevé qui a
      // changé, pas la donnée ni les defs — même mécanique que `STRUCTURES_REDECLARATIONS` ci-dessous.
      // Ce scan mesure les clés de RACINE d'un document ; `auteur` (identité de campagne #766,
      // optionnelle, portée par 0 des 4 projets committés) vivait sous la poche `meta`, où il lui
      // échappait. L'aplatissement de l'enveloppe le SURFACE sur les 4 documents. La donnée est
      // INCHANGÉE : aucun projet n'en portait avant, aucun n'en porte après.
      // Cliquet DESCENDU 27 → 26 (#684 L4, 2026-08-31) : `diligence-projet.json › worldMap` cesse
      // d'être un déclaré-jamais-observé — le document PORTE sa carte. Le cliquet suit la baisse.
      // Cliquet REMONTÉ 26 → 27 : c'est la COUVERTURE du relevé qui revient, pas la donnée qui
      // régresse. `introspecterDefs` prenait pour entrée d'un `pipe` à la racine sa SORTIE — un
      // `transform` sans clés : les 45 documents scellés par `document()` rendaient ZÉRO clé
      // déclarée. Le relevé lit désormais le PORTEUR du pipe, et les 8 clés des 4 `*-projet.json`
      // (`activeAxes`, `auteur`) redeviennent mesurables. Mesure du doc §2.4 : 370 → 621 clés
      // déclarées-jamais-observées, dont 243 posées d'office par la fabrique, hors dénominateur ici
      // (`CLES_POSEES_INCONDITIONNELLEMENT`) — ces 8-là sont les seules à entrer au stock.
      ['STRUCTURES_DEFAUT', STRUCTURES_DEFAUT.length, 27],
      // Cliquet DESCENDU 6 → 5 : le stock est à 5 depuis un lot antérieur et la marge n'avait pas été
      // reprise. Aucune raison de garder un cran libre : il servirait à absorber un homonyme neuf.
      // … et 5 → 4 (L2 #1548, commit 3d) : l'homonyme `skill` MEURT — la clé n'a plus qu'UNE classe
      // (object) dans les deux racines (coûts en PX renommés, valeur de Test emboîtée, `null` devenu
      // absence, liste renommée `skills`).
      ['STRUCTURES_HOMONYMES', STRUCTURES_HOMONYMES.length, 4],
      // Cliquet REMONTÉ 102 → 108 (#1467 L1b V-FLIP-ENTITE-b) : c'est la COUVERTURE du relevé qui a
      // changé, pas la donnée ni les defs. `litterauxZod` (structures-scan.mts) visite désormais
      // l'argument `champs` de `document()` — forme DOMINANTE (43 defs adoptés) qu'il ne voyait pas :
      // 8 déclarations SURFACÉES (7 `entries` de defs config/table + `interludeEvents` min/max, qui
      // était stockée AVANT l'adoption et revit à l'identique). Sans l'extension, l'adoption faisait
      // DISPARAÎTRE des lignes et ce cliquet lisait la perte comme un solde.
      // Cliquet DESCENDU 108 → 105 (L2 #1548, commit 3b) : `activities.ts`, `axes.ts` et
      // `crew-roles.ts` ne redéclarent plus leur propre objet de référence de Compétence — ils
      // composent la grammaire (`refOuSpec('skill')`, `grammaire/ref.ts`). Le cliquet SUIT.
      // Cliquet DESCENDU 105 → 104 (L2 #1548, commit 4bis) : `creatures.ts` ne redéclare plus son
      // objet de référence de Compétence — il compose `refOuSpec('skill', {value})`, comme le fait
      // désormais `defs-scenes/communs.ts`. Le cliquet SUIT.
      // Cliquet REMONTÉ 104 → 105 (#674, 2026-08-31) : `maladies.ts` déclare le Test quotidien de la
      // Pneumonie (`dailyTest {difficulty+…}`, EDOC 08 l.104) avec son propre objet, comme le font
      // encore les autres porteurs de Test du même lot L4. La ligne s'éteindra avec eux.
      // Cliquet REMONTÉ 105 → 107 (L4 #1463, vague `plage`, 2026-08-31) — deux lignes ENTRENT, et
      // c'est l'empreinte de la migration P2 sur les defs, pas une dérive de forme : `weather.json`
      // et `advancementCosts.json` encodaient leurs tables par la BORNE HAUTE SEULE (19 + 15 rangées,
      // borne basse reconstruite par POSITION, donc ni authorée ni éditable). Leurs deux bornes étant
      // désormais en donnée (EDOC 08 l.52-59 ; LDB 07 l.56-70), leurs deux schémas déclarent le
      // littéral `{min, max, …}` — ils rejoignent la famille des 30 defs qui le redéclarent déjà.
      // RESTE NOMMÉ : le schéma PARTAGÉ (P1, `grammaire/valeurs.ts`) éteint les 32 d'un coup ; ces
      // deux lignes-là sont à éteindre AVEC elles, pas séparément.
      // Cliquet DESCENDU 107 → 97 (L4 #1463, vague `plage`, LOT P1-a) : les deux bornes d'une rangée
      // de table se déclarent UNE fois — `plageSchema` (`grammaire/valeurs.ts`) — et les schémas de
      // RANGÉE la composent PAR SHAPE (`z.strictObject({ ...plageSchema.shape, … })`, graphie unique
      // de dérivation tenue par `grammaire-guard.test.ts`). Dix lignes SORTENT : sept par composition
      // (criticals, aa-criticals, localisation — une ligne à 2 occurrences —, structure-criticals,
      // water-exposure › diseases, mutationTables › ranges, obsessions › entries), trois par ADOPTION
      // NUE, les deux bornes y étant toute la charge utile (sea-navigation, tavernGames › libre et
      // › targetRange). `shipCritEntrySchema` (grammaire) porte river/ship-criticals, déjà hors stock.
      // Le scanner ne résout PAS un spread : la garde est le test POSITIF de composition
      // (`grammaire/formes-partagees.test.ts`), qui refuse une rangée sans borne AU SCHÉMA PARTAGÉ et
      // à chacun des 9 documents adoptants. Le cliquet SUIT la baisse.
      // Cliquet DESCENDU 97 → 88 (LOT P1-b, même graphie) : les rangées de table de MAGIE et les tables
      // générales composent à leur tour `plageSchema` par la SHAPE — miscast › entries,
      // arcane-phenomena › tables[].rows, vents-tourbillonnants › entries, tables › rows,
      // interludeEvents (racine), drunkenness › entries, weather › seasons[].ranges, tavernGames › table
      // et › pot.rows. TROIS lignes RESTENT au stock, refusées AVEC leur mesure : `oups.ts` et
      // `reglesOptionnelles.ts` portent des bornes OPTIONNELLES (le premier hors table pour `misfire`, le
      // second relève du concept `bornes` d'un réglage), `advancementCosts.ts` a une borne haute
      // `nullable` (dernière bande ouverte). Le gate reste POSITIF (`grammaire/formes-partagees.test.ts`,
      // +10 sites à la porte réelle `validateDataset`), le scanner ne résolvant pas un spread.
      // Cliquet DESCENDU 88 → 76 (LOT P1-c, même graphie) : les rangées de table de MER, de ROUTE et de
      // BATAILLE composent à leur tour `plageSchema` par la SHAPE — artillery-misfire › entries,
      // crew-morale › bands, driving-mishap › entries, land-cargo › wineQuality et › rumours,
      // mass-battle › hazards, naval-progression › entries, river-navigation › windForces/windDirections
      // (même `bandRow`), sea-events › boardEvents/portEvents (même `seaEventDef`) et › fastVoyage.paliers,
      // sea-weather › table et › roseDesVents, steam-breakdown (racine). La famille `plage` est à son
      // ÉTAT TERMINAL : TROIS lignes restent, chacune refusée AVEC sa mesure — `oups.ts` (bornes
      // OPTIONNELLES, le `kind` misfire est hors table), `advancementCosts.ts` (borne haute `nullable`,
      // dernière bande ouverte) et `water-exposure.ts` (les deux bornes y sont celles d'un PRÉDICAT
      // `auto.{kind:'woundsLost', op:'between'}` sur des Blessures perdues — aucune rangée tirable,
      // aucun `findTableEntry` ; la table du document, `diseases`, compose depuis P1-a).
      ['STRUCTURES_REDECLARATIONS', STRUCTURES_REDECLARATIONS.length, 76],
      // Cliquets DESCENDUS 165 → 77 et 93 → 91 : même geste. Le dénominateur d'enveloppe a fondu au
      // fil des vagues d'adoption (l'enveloppe étant POSÉE, ses divergences s'éteignent) sans que le
      // plafond suive ; 88 crans libres auraient absorbé en silence la régression de tout un lot.
      // Cliquet DESCENDU 77 → 73 (#1467 L1b V-formeProjet) : les 4 lignes « identité | `id` | clé
      // absente » des projets sont SOLDéES — l'enveloppe aplatie pose `id`/`label` à la RACINE des 4
      // documents. Le cliquet SUIT la baisse.
      // Cliquet DESCENDU 73 → 58 (#1467 L1b V-P7) : les 14 lignes « `nom` | clé divergente » des 4
      // projets sont SOLDÉES (le libellé de scène et de carte prend sa graphie `label`, `schema` 5 → 6),
      // et la 15ᵉ part avec la ligne FORMES ci-dessus. Le cliquet SUIT la baisse.
      // … et 58 → 56 : `title` reçoit son RÔLE PROPRE au lexique (« sous-titre », forme cible), donc
      // `creatures.json` (490) et `gods.json` (40) ne sont plus comptés en graphie divergente du libellé.
      // … et 56 → 52 (L2 #1548) : les 4 lignes `progression-schemas.derived.json` sont SOLDÉES — la
      // marque de niveau nomme sa Caractéristique `characteristic`, graphie de RÉFÉRENCE.
      // … et 52 → 47 (#1552 lot 3) : le rôle `source` déclare son ALTERNATIVE `maison`, comme la
      // grammaire l'exige déjà (`document.ts:402-413` : `source` OU `maison`, jamais ni l'un ni
      // l'autre). Les 4 documents dont TOUTES les entrées portent `maison` sortent du
      // dénominateur — les 3 projets authorés (`arene`, `barge-du-sel`, `loup-et-saumure`) et
      // `axes.json` (9/9 entrées `maison`). AUCUNE donnée n'est touchée : c'est le lexique qui
      // cessait de mesurer une divergence là où le schéma, lui, est satisfait.
      ['STRUCTURES_ENVELOPPE', STRUCTURES_ENVELOPPE.length, 47],
      // Cliquet REMONTÉ 91 → 92 (#1467 L1b V-P7) : AUCUNE dérive neuve — c'est le statbloc à `size`
      // d'`arene-projet.json` qui ARRIVE de `STRUCTURES_FORMES` (sa signature gagne `type`, elle ne se
      // confond plus avec les deux autres). La somme des deux stocks est CONSTANTE : 671 + 91 = 670 + 92.
      // Cliquet REMONTÉ 92 → 106 (L2 #1548, commit 3c) : AUCUNE dérive neuve — ce sont 14 lignes qui
      // ARRIVENT de `STRUCTURES_FORMES` (−31 ci-dessus). Un conteneur dont la valeur de `skill` ÉTAIT un
      // id résolvable ouvrait une référence AU CONTENEUR ; la référence étant désormais l'objet EMBOÎTÉ,
      // elle se compte sur LUI (forme CIBLE `{id}`, hors dénominateur) et le conteneur, qui annonce
      // encore une clé réservée sans résoudre lui-même, tombe ici. MÊME objet, autre stock — le
      // dénominateur GLOBAL décroît de 16 lignes (587+92 = 679 → 557+106 = 663).
      // Cliquet DESCENDU 106 → 104 (L2 #1548, commit 3d) : les 2 conteneurs `talents.json ›
      // reverseFailed` sortent — leur clé n'est plus le nom de concept RÉSERVÉ `skill` mais `skills`,
      // la LISTE que le champ porte toujours. Le cliquet SUIT la baisse.
      // Cliquet REMONTÉ 104 → 105 (#717) : l'OUVERTURE cérémonielle du chapitre 1 est une enveloppe
      // EMBARQUÉE qui porte sa `source` (le pitch est un verbatim EDO, règle stricte 5) sans résoudre
      // elle-même — même famille que les blocs sourcés déjà stockés ici. Une ligne de PLUS à éteindre,
      // qui tombera avec le volet #1553 (les sources embarquées), pas une dérive de forme.
      ['STRUCTURES_ORPHELINES', STRUCTURES_ORPHELINES.length, 105],
      // Cliquet DESCENDU 403 → 400 (L2 #1548, commit 3c) : 5 signatures d'op portant le `spec` FRÈRE
      // s'éteignent (`bonus,op,skill,spec` de spells/tables, `blocked,op,rounds,skill`/`mod,op,rounds,skill`
      // de spells dont le `skill: "all"` disparaît au profit de l'ABSENCE) et 2 se fondent dans des
      // signatures existantes. Le cliquet SUIT la baisse.
      // Cliquet REMONTÉ 400 → 402 (#862) : deux signatures d'op neuves, chacune INSTANCE d'une famille
      // déjà stockée — `removeTrait {op,traitId}` (l'INVERSE de `grantTrait {op,traitId}`) et
      // `grantTrait {durationHours,op,traitId}` (même patron que `condition {durationHours,id,op,value}`).
      // Cliquet REMONTÉ 402 → 404 (#674, 2026-08-31) : deux signatures d'op neuves, portées par le
      // cycle quotidien de la Pneumonie — `aggravateSymptom {disease,op,otherwise,severity,symptomId}`
      // et `grantSymptom {disease,op,symptomId}` (EDOC 08 l.104-108). Chacune est une op AUTHORÉE de
      // `maladies.json`, dataset qui n'en portait qu'une (`diseaseTestMod`).
      ['STRUCTURES_OPS', STRUCTURES_OPS.length, 404],
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
      ...STRUCTURES_DEFAUT.filter((d) => !dateOk(d.date)).map((d) => `défaut ${d.dataset} ${d.cle}`),
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
      `lot(s) inconnu(s) : un dénominateur ne se range que dans l’un des ${LOTS_CONNUS.length} lots d’extinction (\`LOTS_CONNUS\`).`,
    ).toEqual([]);
    // Cliquet PAR LOT BIDIRECTIONNEL (patron `assertRatchet`, `src/ui/ui-ratchets.test.ts`) : un plafond PAR
    // lot connu, réel > plafond = dérive, réel < plafond = plafond PÉRIMÉ à abaisser au réel mesuré.
    // L2 #1548 commit 0 — c'est le LOTISSEMENT qui bouge, pas le terrain (aucun `src/data/**.json`,
    // aucun `src/scenes/**` touché) :
    //   • `L2 #1463` 141 → 57 : 23 lignes `ids-nus` sortent du dénominateur (cible neuve) et 62 lignes
    //     se re-lotissent en L3 — leur concept réel n'est pas la Compétence (règle, carrière, espèce,
    //     tenue, trait, talent, domaine, sous-type d'objet, pion de scène…) : `lotDeForme` les lisait
    //     L2 par COLLISION d'ids (angle mort déclaré). Chacune porte son `motif`.
    //   • `L3 #1463` 389 → 397 : +62 reçues, −53 `ids-nus` sorties, −1 partie en L2
    //     (`tavernGames.json › spec`, SPÉCIALISATION de Compétence — DESIGN v2 : « L2 … + `spec`
    //     pool/ouverte », et le `skill` frère du même document est déjà L2). Ce lot GROSSIT sans
    //     dérive : les lignes viennent d'un autre lot du même stock, la somme des deux baisse de 76.
    const plafonds: Record<string, number> = {
      'L1a #1466': 23,
      'L1b #1467': 0,
      // L1c #1468 : 403 → 400 (commit 3c) — cf. le cliquet `STRUCTURES_OPS` ci-dessus.
      // … puis 400 → 402 (#862) : cf. le cliquet `STRUCTURES_OPS` ci-dessus.
      // … puis 402 → 404 (#674) : cf. le cliquet `STRUCTURES_OPS` ci-dessus.
      'L1c #1468': 404,
      // L1d #1469 : 62 → 61 (#1552) — « La Diligence » CITE désormais son folio à la racine
      // (`ennemi-dans-l-ombre` 12, la référence que son bloc narratif portait déjà en profondeur) ;
      // sa ligne « source | clé absente » est SOLDÉE.
      // … puis 61 → 57 (#1552 lot 3) : le rôle `source` déclare son alternative `maison` et les 4
      // documents qui la portent sur TOUTES leurs entrées sortent du dénominateur (cf. le cliquet
      // `STRUCTURES_ENVELOPPE` ci-dessus).
      'L1d #1469': 59 /* +2 : alsoIn creatures/species posés par e89a836d3 SANS leur ligne de stock (sillage C1 #1457) — le lot RE-GONFLE à titre de dérive relevée, à SOLDER par la vague L1d (#1469) */,
      // L2 #1463 : 57 → 48 (commit 3b) — les 9 lignes de référence de Compétence à graphie `skillId`
      // (donnée + defs) meurent ; ce qui reste du lot est la référence PLATE `skill: "<id>"` des ops.
      // … puis 48 → 18 (commit 3c) : cette référence PLATE MEURT à SON TOUR — 30 lignes s'éteignent avec
      // l'emboîtement `skill: { id, spec? }` (cf. le cliquet `STRUCTURES_FORMES` ci-dessus).
      // … puis 18 → 16 (geste modèle) : les 2 lignes du pseudo-PNJ soigneur quittent le lot — la
      // valeur de Guérison recopiée MEURT (`skill {id,value}`), et la signature de l'effet qui la
      // portait n'annonce plus qu'une entité (elle passe donc en `L3`, +1 ci-dessous : même mécanique
      // de transfert entre lots du MÊME stock, somme des deux en BAISSE 415 → 414).
      // … puis 16 → 10 (commit 4) : les 6 dernières lignes du lot sont les enveloppes `{ref:{…}}` et
      // `{wildcard:{…}}` de l'AVANCEMENT (careerLevels + species) — la référence y est désormais À
      // PLAT, régime de spécialisation compris (`{id}`, `{id, spec}`, `{id, choix}`).
      // … puis 10 → 4 (commit 4bis) : les 6 lignes `skills {id,value}`/`{id,spec,value}` des statblocs
      //     passent CIBLE au site et sortent du dénominateur (cf. le cliquet `STRUCTURES_FORMES`).
      'L2 #1463': 4,
      'L2 #1548': 0,
      // L3 #1463 : 398 → 385 (commit 4) — le MÊME geste éteint les 14 lignes de graphie du champ
      // d'avancement côté PORTEUR (`skills`/`talents` à signature `ref`/`wildcard`/`choice`, et les
      // `choice>…` de leurs branches) et en pose UNE : `species.json › of {random}`, les 2 tirages
      // qui vivaient en branche de `choice` et vivent maintenant en branche de `pick`. La branche
      // `{random}` NE migre PAS (sa cible `{pick, table}` est le lot L4) : elle reste traçée ici et
      // sur `species.json › talents {random}` (×19).
      // … puis 385 → 387 (#862) : cf. le cliquet `STRUCTURES_FORMES` ci-dessus (les deux graphies de
      // référence de Trait sous `mutations.json › ops`).
      // … puis 387 → 386 (commit 4bis) : la redéclaration `creatures.ts {id,spec,value}` s'éteint —
      // le def compose `refOuSpec('skill', {value})`.
      // … puis 386 → 389 (#674) : les 3 références de la Pneumonie/du Rhume commun — `mutation`
      // (maladie visée), `onFail` et `otherwise` (maladie + symptôme de chaque op). Cf. le cliquet
      // `STRUCTURES_FORMES` ci-dessus.
      // … puis 389 → 392 (#684 L4) : `a`, `b`, `scene` du premier tronçon de carte du chapitre 1 —
      // les trois références de CARTE que les trois autres projets portent déjà, même lot.
      // … puis 392 → 393 (équipage de la Louve grise, 3fe450675) : `barge-du-sel-projet.json › appearance {species, tenue}` — la
      // ligne sœur de `loup-et-saumure`/`arene`/`creatures.json`, même concept, même lot.
      // … puis 393 → 395 (équipage du Grimm et statblocs d'auteur de l'arène, 2026-09-01) :
      // `loup-et-saumure-projet.json › appearance {species, tenue}` et `arene-projet.json › appearance {species}` —
      // les deux dernières lignes sœurs du même concept, même lot.
      'L3 #1463': 395,
      // L4 #1463 : 220 → 219 (commit 3b) — les deux formes de `activities.json › skills` fusionnent en
      // une seule dès que la référence sort de leur signature.
      // … puis 219 → 221 (#674) : le Test quotidien de la Pneumonie compte DEUX fois — sa forme en
      // donnée (`maladies.json › dailyTest`) et sa redéclaration au def (`maladies.ts › dailyTest`).
      // L4 #1463 : 221 → 162 (vague `plage`, 2026-08-31). −61 lignes de FORMES (les rangées de table
      // à fourchette plate passent CIBLE, cf. le cliquet `STRUCTURES_FORMES` ci-dessus) et +2 lignes
      // de REDÉCLARATIONS (`weather.ts`, `advancementCosts.ts` — leurs schémas déclarent désormais le
      // littéral à DEUX bornes, empreinte de la migration P2 ; cf. le cliquet
      // `STRUCTURES_REDECLARATIONS`). Solde net −59.
      // … puis 162 → 152 (vague `plage`, LOT P1-a) : les 10 lignes de REDÉCLARATIONS des rangées de
      // table « critiques & corps » sortent — leurs schémas composent `plageSchema` par la SHAPE, ou
      // l'adoptent nu quand les deux bornes sont toute la charge utile.
      // … puis 152 → 143 (LOT P1-b) : les 9 lignes de REDÉCLARATIONS des rangées de table de magie et
      // des tables générales sortent à leur tour, par composition de `plageSchema`.
      // … puis 143 → 131 (LOT P1-c) : les 12 lignes de REDÉCLARATIONS des rangées de table de mer, de
      // route et de bataille sortent à leur tour, par composition de `plageSchema`.
      // … puis 131 → 130 (L-monnaie-1) : `activities.minInvest` compose `moneyPartialSchema` de la
      // grammaire (`grammaire/valeurs.ts`) au lieu de re-taper `{gold}`.
      // … puis 130 → 121 (L-monnaie-2) : la clé `bronze` meurt (5 lignes de FORMES, 455 montants) et
      // les 4 catalogues composent le `moneySchema` de la grammaire (4 REDÉCLARATIONS).
      // … puis 121 → 113 (L-monnaie-3) : les 8 dernières lignes de FORMES du concept monnaie sortent
      // (53 occurrences) — 44 `giveMoney` enveloppés dans `montant`, et les 9 montants PARTIELS
      // (`activities.minInvest`, coûts de choix d'arène) reconnus CIBLES par le lexique. Le concept
      // monnaie ne pèse plus AUCUNE ligne au stock des formes.
      // … puis 113 → 112 (L-monnaie-4) : l'HOMONYME `cost` sort — le nom ne porte plus que la monnaie
      // (8 tarifs d'arène), les 85 porteurs d'un autre type ayant reçu le nom de ce qu'ils chiffrent.
      'L4 #1463': 112,
      // #1553 : 92 → 106 (commit 3c) — le lot des ORPHELINES reçoit les 14 conteneurs qui quittent
      // `L2 #1463` (−30 ci-dessus) : mêmes objets, autre stock, somme des deux en BAISSE.
      // … puis 106 → 104 (commit 3d) — `talents.json › reverseFailed` sort du lot : sa clé `skills`
      // n'est plus un nom de concept réservé.
      // … puis 104 → 105 (#717) — l'ouverture du chapitre 1 et sa `source` embarquée (même motif).
      // … puis 105 → 98 (#1463 L-monnaie-4) — 7 lignes sortent : elles n'étaient ORPHELINES que par le
      // NOM `cost`, rendu à son type (naval `install` ×2, `qualities.flow`, `advantageDefenseReaction`,
      // `prosthesisTraining` ×3 ; 29 occurrences).
      '#1553': 98,
    };
    expect(
      Object.keys(plafonds).sort(),
      'les plafonds par lot et `LOTS_CONNUS` sont le MÊME ensemble : un lot sans plafond n’est cliqueté par rien.',
    ).toEqual([...LOTS_CONNUS].sort());
    const reel = (lot: string) => parLot.get(lot) ?? 0;
    expect(
      Object.keys(plafonds).filter((lot) => reel(lot) > plafonds[lot]).map((lot) => `${lot} ${reel(lot)} > ${plafonds[lot]}`),
      'lot(s) qui ont GONFLÉ — une ligne ne change pas de lot sans revue, et un lot ne grossit pas sans dérive.',
    ).toEqual([]);
    expect(
      Object.keys(plafonds).filter((lot) => reel(lot) < plafonds[lot]).map((lot) => `${lot} : plafond PÉRIMÉ ${plafonds[lot]}, abaisser à ${reel(lot)}`),
      'plafond(s) PÉRIMÉ(S) — le terrain gagné se VERROUILLE : abaisser le plafond au réel mesuré.',
    ).toEqual([]);
  });

  /**
   * Le lot d'une ligne se DÉDUIT du concept (`lotDeForme`), et cette déduction lit la colonne
   * `cibles` — qui liste TOUS les datasets atteignables, COLLISIONS d'ids comprises (angle mort
   * déclaré). Une ligne dont le concept réel n'est pas celui que la déduction lui prête se re-lotit
   * en revue ; ce test rend cette divergence NOMMÉE et BIDIRECTIONNELLE : pas de re-lotissement
   * muet, pas de `motif` sur une ligne que rien ne fait diverger.
   */
  it('un LOT qui DIVERGE de la déduction porte son MOTIF — et un MOTIF suppose une divergence', () => {
    const deduit = new Map(scan.formes.map((f) => [siteDeForme(f), lotDeForme(f.concept, f.signature, f.cibles ?? [])]));
    const diverge = (f: { concept: string; dataset: string; champ: string; signature: string } & Trace) =>
      deduit.has(siteDeForme(f)) && f.lot !== deduit.get(siteDeForme(f));
    expect(
      FORMES.filter((f) => diverge(f) && !f.motif?.trim()).map(cleForme),
      'ligne(s) re-loties SANS motif — un lot qui contredit la déduction NOMME le concept réel de la ligne, sinon le lotissement du chantier n’est plus relisible.',
    ).toEqual([]);
    expect(
      FORMES.filter((f) => f.motif?.trim() && !diverge(f)).map(cleForme),
      'ligne(s) portant un `motif` que rien ne fait diverger — un motif justifie une décision de revue, il ne décore pas une ligne que la déduction range déjà là.',
    ).toEqual([]);
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
      trace(e, lotEnveloppe(e));
    const cleRedeclaration = (r: { def: string; champ: string; concept: string; signature: string; statut: string; commun: string; occurrences: number } & Trace) =>
      `${r.def} | ${r.champ} | ${r.concept} | ${r.signature} | ${r.statut} | ${r.commun} | ${r.occurrences}` +
      trace(r, lotDeForme(r.concept, r.signature));
    const stocks: Array<[string, readonly Record<string, unknown>[], (x: never) => string, string[]]> = [
      ['STRUCTURES_CIBLES', STRUCTURES_CIBLES, ((c: { concept: string; signature: string; date: string }) => `${c.concept} | ${c.signature} | ${c.date}`) as never, ['concept', 'signature', 'date']],
      ['STRUCTURES_FORMES', STRUCTURES_FORMES, cleForme as never, ['concept', 'dataset', 'champ', 'signature', 'statut', 'strate', 'occurrences', 'lot', 'motif', 'date']],
      ['STRUCTURES_DEFAUT', STRUCTURES_DEFAUT, ((d: { dataset: string; cle: string; date: string }) => `${d.dataset} | ${d.cle} | ${d.date}`) as never, ['dataset', 'cle', 'date']],
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
        // Champ qu'AUCUNE ligne ne porte encore (`STRUCTURES_ENVELOPPE.detail` depuis l'extinction du
        // dernier `type divergent`, #1467 L1b V-P3) : le scan le produit toujours
        // (`structures-scan.mts:967`), il doit donc entrer dans la clé LE JOUR où une ligne le
        // portera — on l'INJECTE sur la première ligne, la cécité de la clé restant mesurée pareil.
        const cible = i < 0 ? 0 : i;
        const valeur = i < 0 ? 'PORTE' : mute(arr[cible][champ]);
        const copie = arr.map((x, j) => (j === cible ? { ...x, [champ]: valeur } : x));
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
    ['careerLevels.json', 'skills', 'id,spec', 'skills.json'],
    ['careerLevels.json', 'skills', 'choix,id', 'skills.json'],
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

  it('un montant PARTIEL est une monnaie à la forme cible, comme le montant complet', () => {
    // `moneyPartialSchema` (3 dénominations optionnelles) + `toMoney` : un coût authoré n'écrit que ce
    // qu'il chiffre — les 6 sous-signatures non vides sont CIBLES (#1463 L-monnaie-3).
    expect(classement({ gold: 1, silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'cible' });
    expect(classement({ silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'cible' });
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

  it('une ENTRÉE DE RACINE sans `id`/`type`/`label`/`source` sort en divergences ; conforme, elle sort vide', () => {
    const neuf = mesurerEnveloppe([
      { document: 'neuf.json', chemin: '(entrées)', portee: 'racine', famille: 'entité', nbEntrees: 3, cles: [cle('code', 'string', 3), cle('nom', 'string', 3)] },
    ]);
    expect(neuf.map((e) => `${e.role} | ${e.cle} | ${e.motif}`).sort()).toEqual([
      'identité | id | clé absente',
      'identité | nom | clé divergente',
      'libellé | label | clé absente',
      'libellé | nom | clé divergente',
      'source | source | clé absente',
      'type de document | type | clé absente',
    ]);
    const conforme = mesurerEnveloppe([
      {
        document: 'ok.json',
        chemin: '(entrées)',
        portee: 'racine',
        famille: 'entité',
        nbEntrees: 3,
        cles: [cle('id', 'string', 3), cle('type', 'string', 3), cle('label', 'string', 3), cle('desc', 'string', 3), cle('source', 'object', 3)],
      },
    ]);
    expect(conforme).toEqual([]);
  });

  /**
   * La PROVENANCE est une ALTERNATIVE dans la grammaire — `source` OU `maison`, jamais ni l'un ni
   * l'autre (`src/data/schemas/grammaire/document.ts:402-413`). Le lexique la mesure comme telle :
   * un document maison est CONFORME, un document qui ne dit RIEN reste au dénominateur.
   */
  it('le rôle `source` est satisfait par son ALTERNATIVE `maison` — mais rien ne remplace les deux', () => {
    const groupe = (doc: string, provenance: ReturnType<typeof cle>[]) => ({
      document: doc, chemin: '(entrées)', portee: 'racine' as const, famille: 'entité', nbEntrees: 2,
      cles: [cle('id', 'string', 2), cle('type', 'string', 2), cle('label', 'string', 2), ...provenance],
    });
    const provenance = (doc: string, cles: ReturnType<typeof cle>[]) =>
      mesurerEnveloppe([groupe(doc, cles)]).map((e) => `${e.role} | ${e.cle} | ${e.motif}`);

    expect(provenance('folio.json', [cle('source', 'object', 2)]), 'la CIBLE satisfait le rôle.').toEqual([]);
    expect(provenance('maison.json', [cle('maison', 'string', 2)]), 'l’ALTERNATIVE le satisfait aussi.').toEqual([]);
    expect(provenance('muet.json', []), 'ni folio ni arbitrage : le document reste au dénominateur.').toEqual([
      'source | source | clé absente',
    ]);
  });

  /**
   * Le rôle `type de document` est `entiere` : c'est ce qui le rend mesurable SOUS l'entrée de
   * racine. Un document embarqué qui s'annonce (`type: 'scene'`, `type: 'statblock'`) l'annonce sur
   * TOUTES ses entrées — une seule qui ne le porte pas est nommée, portée embarquée comprise.
   */
  it('le `type` d’un document se porte ENTIER : une portée qui l’annonce à moitié est nommée', () => {
    const scenes = (porteuses: number, n: number) => [
      { document: 'projet.json', chemin: 'scenes', portee: 'embarqué' as const, famille: 'entité', nbEntrees: n, cles: [cle('id', 'string', n), cle('label', 'string', n), cle('type', 'string', porteuses)] },
    ];
    expect(
      mesurerEnveloppe(scenes(18, 18)).map((e) => `${e.role} | ${e.cle} | ${e.motif}`),
      'les 18 scènes s’annoncent : rien à mesurer.',
    ).toEqual([]);
    expect(
      mesurerEnveloppe(scenes(17, 18)).map((e) => `${e.role} | ${e.cle} | ${e.motif}:${e.detail} | ${e.entrees}`),
      'une scène qui ne s’annonce plus est NOMMÉE, avec le compte des portées manquantes.',
    ).toEqual(['type de document | type | cible partielle:17/18 | 1']);
    expect(
      mesurerEnveloppe([{ document: 'flow.json', chemin: 'steps', portee: 'embarqué', famille: 'entité', nbEntrees: 4, cles: [cle('id', 'string', 4)] }]),
      'un document embarqué qui n’annonce AUCUN type n’est sommé de rien : `entiere` mesure ce qui est là.',
    ).toEqual([]);
  });

  it('un document EMBARQUÉ n’est sommé de rien : seules ses clés DIVERGENTES comptent', () => {
    const embarque = mesurerEnveloppe([
      { document: 'flow.json', chemin: 'steps[].effect', portee: 'embarqué', famille: 'entité', nbEntrees: 5, cles: [cle('text', 'string', 5), cle('nom', 'string', 5), cle('title', 'string', 5), cle('type', 'string', 5)] },
    ]);
    // `title` est la forme CIBLE de son rôle (sous-titre) : il ne compte pas — seules `text` et `nom`,
    // graphies divergentes de la prose et du libellé, sont relevées.
    expect(embarque.map((e) => `${e.role} | ${e.cle} | ${e.motif}`).sort()).toEqual([
      'identité | nom | clé divergente',
      'libellé | nom | clé divergente',
      'prose | text | clé divergente',
    ]);
  });

  it('le rôle PROSE ne voit que ses divergentes DÉCLARÉES — une graphie hors lexique lui échappe', () => {
    const groupe = (doc: string, c: string) => ({
      document: doc, chemin: '(entrées)', portee: 'racine' as const, famille: 'entité' as const, nbEntrees: 2,
      cles: [cle('id', 'string', 2), cle('label', 'string', 2), cle('source', 'object', 2), cle(c, 'string', 2)],
    });
    const prose = (doc: string, c: string) =>
      mesurerEnveloppe([groupe(doc, c)]).filter((e) => e.role === 'prose').map((e) => `${e.cle} | ${e.motif}`);

    expect(prose('divergente.json', 'text'), 'une divergente DÉCLARÉE est mesurée.').toEqual(['text | clé divergente']);
    expect(prose('cible.json', 'desc'), 'la CIBLE du rôle n’est pas une divergence.').toEqual([]);
    // La mesure ne voit que ses divergentes déclarées — une graphie hors lexique lui échappe.
    // La clé sonde est FORGÉE pour n'entrer JAMAIS au lexique : une graphie plausible (`texte`) ferait
    // rougir cette assertion le jour où elle y entrerait, et l'angle mort disparaîtrait de la mesure.
    expect(prose('inconnue.json', 'proseInconnueSonde')).toEqual([]);
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
    // #862 : +3 ops authorées (re-ciblage `[removeTrait, grantTrait]` de Haine sporadique, État Exténué
    // du réveil du Désespoir).
    // #674 : +2 ops authorées (`aggravateSymptom` + son échelon `grantSymptom`, cycle quotidien de la
    // Pneumonie, EDOC 08 l.104-108).
    expect(scan.totalConditionsAvecOp + scan.totalOps, 'objets portant un `op` = ops de jeu + Conditions à `op`.').toBe(2187);
    // #684 L4+solde : +2 Conditions sans `op` — le MÊME drapeau de révélation d'Altdorf porté par ses
    // deux axes sur la carte du chapitre 1 : le `when` du LIEU et le `when` de la ROUTE.
    // #717 : +1 Condition sans `op` — le `when` de la CLÔTURE du chapitre 1 (`narratif.cloture`), le
    // MÊME drapeau de révélation d'Altdorf que les deux axes de carte ci-dessus, sur un troisième
    // porteur : le fait de donnée qui dit « le chapitre se ferme ».
    // #684+#717 sur « La Barge du Sel » : +3 Conditions sans `op` — les MÊMES trois porteurs, un
    // chapitre plus loin (le `when` du LIEU de l'îlot et celui de sa ROUTE, sur le drapeau du cap ;
    // le `when` de la CLÔTURE, sur le drapeau d'accostage).
    expect(scan.totalConditionsSansOp, 'des Conditions sans `op` n’ont jamais été comptées en op : elles ne se « retirent » pas.').toBe(191);
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

/**
 * MORSURE du régime `valeurs` sur un record ENVELOPPÉ (#1467 L1b V-FLIP-RECORD). Un record porte
 * son enveloppe (`id`/`type`/`label`) et sa carte sous `entries` : le scan doit DESCENDRE
 * dans `entries` pour indexer les vraies clés. Sans cette descente, l'index reçoit `id`/`type`/`label`/
 * `entries` — les clés du record disparaîtraient de l'index des ids, en silence.
 */
describe('régime `valeurs` : le scan descend dans `entries` d’un record ENVELOPPÉ', () => {
  it('une clé d’`entries` entre à l’index (collision avec `teintesJeu.json`) ; l’enveloppe n’y entre pas', () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-record-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      // Record ENVELOPPÉ sonde : sa seule clé de charge est celle d'une teinte réelle — le scan doit
      // donc voir une COLLISION d'id entre les deux documents.
      writeFileSync(
        join(copie, 'src/data/sonde-record.json'),
        JSON.stringify({ id: 'sonde-record', type: 'sondeRecord', label: 'Sonde record', entries: { 'zone-marche': '#123456' } }),
        'utf8',
      );
      const famillesSonde = new Map([...FAMILLES, ['sonde-record.json', 'record']]);
      const apres = scannerDonnees(copie, famillesSonde, CHOIX);
      const collision = apres.index.collisions.find((c) => c.id === 'zone-marche');
      expect(collision?.datasets, 'la clé d’`entries` n’est pas indexée : le régime `valeurs` n’est pas descendu sous l’enveloppe.').toEqual([
        'sonde-record.json',
        'teintesJeu.json',
      ]);
      expect(
        apres.index.collisions.filter((c) => ['entries', 'label', 'type'].includes(c.id)).map((c) => c.id),
        'les clés d’ENVELOPPE sont entrées à l’index comme des ids de record.',
      ).toEqual([]);
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});
