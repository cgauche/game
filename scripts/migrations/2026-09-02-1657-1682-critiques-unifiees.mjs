/**
 * Migration #1657 B2a × #1682 — les DEUX systèmes de Blessures critiques par Localisation deviennent
 * UNE collection de 8 documents-tables, et la forme de leur JET rejoint le nœud `test` du Flow.
 *
 * CE QUI BOUGE, en trois gestes :
 *  1. ENVELOPPE — `criticals.json` (config, 4 champs-tableaux) + `aa-criticals.json` (idem) → UNE
 *     LISTE de 8 documents `{id, type:'criticals', label, jeu, localisation, entries[]}` dans
 *     `criticals.json` ; `aa-criticals.json` disparaît. Le discriminant est `jeu` ('ldb' | 'aa') —
 *     jamais `type`, qui est le type de DOCUMENT (`grammaire/document.ts:266`). Aucun id de RANGÉE
 *     n'est renommé (collisions LDB ∩ AA mesurées : 0).
 *  2. RANGÉE — `resist {difficulty, skill?, onFail}` → nœud `noeudTest(flowSchema)`
 *     (`grammaire/mecanique.ts:325`) sous la clé `test` : `{kind:'test', test:{skill?, difficulty},
 *     success:{kind:'seq',steps:[]}, fail:{kind:'do', effect:{type:'ops', ops:<onFail>, on:'target'}}}`.
 *     `escalation.onNextCritWhileCondition.resist` prend la MÊME forme (jumeau runtime persisté,
 *     `engine/types.ts::Trauma.critTrigger`).
 *  3. COLONNE « Blessures » (AA 07 l.40) — `blessures: N > 0` devient l'op
 *     `{op:'wounds', amount:N, ignoreTB:true, ignoreAP:true}` posée EN TÊTE de `ops` (l'ordre
 *     qu'appliquait le lecteur AA), et `trivial` (AA 07 l.79) devient DÉRIVÉ : une rangée est
 *     triviale si elle n'est pas létale et ne fait perdre AUCUNE Blessure. Bijection mesurée sur
 *     l'arbre AVANT : 6 rangées `trivial` authorées = 6 rangées « non létale ET sans op `wounds` »
 *     (AA), 0 (LDB, dont 76/80 portent déjà une op `wounds`).
 *     La MITIGATION est ÉCRITE, jamais héritée du défaut (garde `wounds-mitigation-declaree`) :
 *     AA 07 l.40 et l'exemple l.50 (« L'épaule luxée inflige aussi 4 Blessures à Hugo, ce qui le
 *     fait tomber à –1 Blessure » : 3 − 4, sans re-déduire BE ni PA). C'est aussi, à l'octet, ce
 *     qu'appliquait le lecteur AA — `applyOps` ignore BE+PA par DÉFAUT sur `wounds`.
 *
 * ENTRÉES : `src/data/criticals.json` et `src/data/aa-criticals.json` (seules données lues/écrites).
 *
 * PORTE DE FIDÉLITÉ (lecture SEULE, avant toute écriture) : les cardinaux ci-dessous sont exigés sur
 * l'état LU, et la bijection `trivial` est RE-MESURÉE plutôt que supposée — une rangée `trivial` qui
 * perdrait des Blessures, ou une rangée sans perte qui ne serait pas `trivial`, sort 1 sans rien écrire.
 *
 * IDEMPOTENT : rejouée sur l'état final (`criticals.json` = liste de 8 documents, `aa-criticals.json`
 * absent), la migration reconnaît « déjà migré », n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : chaque fichier lu est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture ; la sortie l'est aussi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/criticals.json');
const SOURCE_AA = path.join(ROOT, 'src/data/aa-criticals.json');

const LOCALISATIONS = ['tete', 'bras', 'corps', 'jambe'];

/**
 * PROVENANCE de chaque document-table — RECOPIÉE de ses propres rangées, jamais inventée :
 *  - Aux Armes : le folio de la table, relevé aux ancres `data-folio` d'AA 07 (83 Tête, 84 Bras,
 *    85 Torse, 86 Jambe) ; c'est celui que portent déjà les 20 rangées de chaque table, et que
 *    `src/data/criticals-folio.test.ts` confronte à l'extraction.
 *  - Livre de base : la page auto-référencée du RAW (« voir page 174 ») avec SA note, recopiée à
 *    l'octet depuis les rangées — l'extraction ne donne PAS de folio Marker par sous-table, et la
 *    note le dit. Aucune affirmation neuve : le document répète ce que ses rangées déclarent.
 */
const NOTE_AA = (titre) =>
  `Folio relevé à l'ancre \`data-folio\` qui précède « ${titre} » dans AA 07 — la table n'est pas citée à la ligne : c'est un TABLEAU, son folio s'atteste à son ancre de titre (confronté à l'extraction par src/data/criticals-folio.test.ts).`;
const NOTE_LDB =
  'Tableaux de Critiques (Tête/Bras/Torse/Jambe), section continue LDB p.174-179 — page du RAW auto-référencé ("voir page 174"), pas de folio Marker par sous-table dans l\'extraction.';
const SOURCE = {
  ldb: {
    tete: { book: 'livre-de-base', page: 174, note: NOTE_LDB },
    bras: { book: 'livre-de-base', page: 174, note: NOTE_LDB },
    corps: { book: 'livre-de-base', page: 174, note: NOTE_LDB },
    jambe: { book: 'livre-de-base', page: 174, note: NOTE_LDB },
  },
  aa: {
    tete: { book: 'aux-armes', page: 83, note: NOTE_AA('TABLEAU DES BLESSURES CRITIQUES À LA TÊTE') },
    bras: { book: 'aux-armes', page: 84, note: NOTE_AA('TABLEAU DES BLESSURES CRITIQUES AU BRAS') },
    corps: { book: 'aux-armes', page: 85, note: NOTE_AA('TABLEAU DES BLESSURES CRITIQUES AU TORSE') },
    jambe: { book: 'aux-armes', page: 86, note: NOTE_AA('TABLEAU DES BLESSURES CRITIQUES À LA JAMBE') },
  },
};

/** Libellé de chaque document — repris TEL QUEL des catégories Codex existantes (`registry.ts`). */
const LIBELLE = {
  ldb: {
    tete: 'Critiques — Tête (Traumatisme)',
    bras: 'Critiques — Bras (Traumatisme)',
    corps: 'Critiques — Corps (Traumatisme)',
    jambe: 'Critiques — Jambe (Traumatisme)',
  },
  aa: {
    tete: 'Critiques — Tête (approche alternative)',
    bras: 'Critiques — Bras (approche alternative)',
    corps: 'Critiques — Corps (approche alternative)',
    jambe: 'Critiques — Jambe (approche alternative)',
  },
};

/** CARDINAUX attendus sur l'état AVANT, mesurés sur l'arbre `a8220854d` (2026-09-02). */
const CARDINAUX = {
  documents: 8,
  rangees: 160,
  rangeesParTable: 20,
  noeuds: 39, // 21 `resist` LDB + 17 AA + 1 `escalation.onNextCritWhileCondition.resist`
  blessuresAbsorbees: 76, // clé `blessures` présente (70 > 0 -> op `wounds`, 6 = 0 -> rien)
  trivialSupprimes: 6,
  sources: 160,
};

const echecs = [];

const lire = (cible, nom) => {
  if (!fs.existsSync(cible)) return null;
  const brut = fs.readFileSync(cible, 'utf8');
  const doc = JSON.parse(brut);
  if (JSON.stringify(doc, null, 2) !== brut) {
    echecs.push(`${nom} : FORME NON CANONIQUE (pas JSON.stringify(doc, null, 2))`);
    return null;
  }
  return { cible, brut, doc };
};

const ldbFichier = lire(CIBLE, 'criticals.json');
const aaFichier = lire(SOURCE_AA, 'aa-criticals.json');
if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}
if (!ldbFichier) {
  console.error('ARBITRAGE REQUIS — src/data/criticals.json est ABSENT.');
  process.exit(1);
}

// ---- REJEU : l'état final est une LISTE de 8 documents et `aa-criticals.json` n'existe plus.
if (Array.isArray(ldbFichier.doc)) {
  if (aaFichier) {
    console.error('ARBITRAGE REQUIS — criticals.json est déjà migré mais aa-criticals.json subsiste.');
    process.exit(1);
  }
  const docs = ldbFichier.doc;
  const rangees = docs.reduce((n, d) => n + d.entries.length, 0);
  if (docs.length !== CARDINAUX.documents || rangees !== CARDINAUX.rangees) {
    console.error(`ARBITRAGE REQUIS — état migré inattendu : ${docs.length} document(s) / ${rangees} rangée(s).`);
    process.exit(1);
  }
  console.log(`criticals.json : no-op (déjà migré — ${docs.length} documents, ${rangees} rangées)`);
  process.exit(0);
}
if (!aaFichier) {
  console.error('ARBITRAGE REQUIS — criticals.json est en forme ANCIENNE mais aa-criticals.json est absent.');
  process.exit(1);
}

const SOURCES = { ldb: ldbFichier.doc, aa: aaFichier.doc };

// ---- PORTE DE FIDÉLITÉ : lecture SEULE.
{
  const ecarts = [];
  let rangees = 0;
  let noeuds = 0;
  let blessures = 0;
  let triviaux = 0;
  let sources = 0;
  for (const [jeu, doc] of Object.entries(SOURCES)) {
    for (const loc of LOCALISATIONS) {
      const table = doc[loc];
      if (!Array.isArray(table) || table.length !== CARDINAUX.rangeesParTable) {
        ecarts.push(`${jeu}/${loc} : ${Array.isArray(table) ? table.length : 'non-tableau'} rangée(s) != ${CARDINAUX.rangeesParTable}`);
        continue;
      }
      for (const e of table) {
        rangees++;
        if (e.source) sources++;
        else ecarts.push(`${jeu}/${loc}/${e.id} : sans source`);
        if (e.resist) {
          noeuds++;
          if (e.resist.difficulty === undefined) ecarts.push(`${jeu}/${loc}/${e.id} : resist SANS difficulty`);
          if (!Array.isArray(e.resist.onFail) || !e.resist.onFail.length) ecarts.push(`${jeu}/${loc}/${e.id} : resist.onFail vide`);
        }
        const nested = e.escalation?.onNextCritWhileCondition;
        if (nested) {
          noeuds++;
          if (nested.resist?.difficulty === undefined) ecarts.push(`${jeu}/${loc}/${e.id} : onNextCritWhileCondition.resist SANS difficulty`);
        }
        const aBlessures = Object.prototype.hasOwnProperty.call(e, 'blessures');
        if (aBlessures) blessures++;
        if (e.trivial) triviaux++;
        // BIJECTION RE-MESURÉE : `trivial` <=> non létale ET aucune Blessure perdue (colonne + `ops`).
        const perdDesPB = (e.blessures ?? 0) > 0 || (e.ops ?? []).some((o) => o.op === 'wounds');
        const derive = !e.lethal && !perdDesPB;
        if (!!e.trivial !== derive) {
          ecarts.push(`${jeu}/${loc}/${e.id} : trivial=${!!e.trivial} != dérivation « non létale ET aucune perte de PB »=${derive}`);
        }
        if (e.lethal && (aBlessures || (e.ops ?? []).length)) {
          ecarts.push(`${jeu}/${loc}/${e.id} : rangée LÉTALE porteuse de blessures/ops — la dérivation la classerait à tort`);
        }
      }
    }
  }
  const ids = new Map();
  for (const doc of Object.values(SOURCES)) {
    for (const loc of LOCALISATIONS) for (const e of doc[loc] ?? []) ids.set(e.id, (ids.get(e.id) ?? 0) + 1);
  }
  for (const [id, n] of ids) if (n > 1) ecarts.push(`id de rangée en COLLISION : « ${id} » (${n}x)`);

  if (rangees !== CARDINAUX.rangees) ecarts.push(`rangées : ${rangees} != ${CARDINAUX.rangees}`);
  if (noeuds !== CARDINAUX.noeuds) ecarts.push(`nœuds de jet : ${noeuds} != ${CARDINAUX.noeuds}`);
  if (blessures !== CARDINAUX.blessuresAbsorbees) ecarts.push(`colonnes blessures : ${blessures} != ${CARDINAUX.blessuresAbsorbees}`);
  if (triviaux !== CARDINAUX.trivialSupprimes) ecarts.push(`trivial authorés : ${triviaux} != ${CARDINAUX.trivialSupprimes}`);
  if (sources !== CARDINAUX.sources) ecarts.push(`source par entrée : ${sources} != ${CARDINAUX.sources}`);

  if (ecarts.length) {
    console.error(`FIDÉLITÉ ROMPUE — rien n’est écrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

/** `resist` -> nœud `test` du Flow (`noeudTest(flowSchema)`), branche `success` VIDE explicite. */
const noeud = (resist) => ({
  kind: 'test',
  test: { ...(resist.skill ? { skill: resist.skill } : {}), difficulty: resist.difficulty },
  success: { kind: 'seq', steps: [] },
  fail: { kind: 'do', effect: { type: 'ops', ops: resist.onFail, on: 'target' } },
});

/** Escalade : seul `onNextCritWhileCondition.resist` change de forme, les clés gardent leur ordre. */
const escalade = (esc) => {
  if (!esc?.onNextCritWhileCondition) return esc;
  const n = esc.onNextCritWhileCondition;
  return {
    ...esc,
    onNextCritWhileCondition: Object.fromEntries(
      Object.entries(n).map(([k, v]) => (k === 'resist' ? ['test', noeud(v)] : [k, v])),
    ),
  };
};

/**
 * Rangée migrée — l'ordre des clés existantes est PRÉSERVÉ ; `ops` reçoit la colonne « Blessures »
 * en TÊTE (l'ordre qu'appliquait le lecteur AA), à la place qu'occupait `blessures` si `ops` était
 * absente.
 */
const rangee = (e) => {
  const wounds = (e.blessures ?? 0) > 0 ? [{ op: 'wounds', amount: e.blessures, ignoreTB: true, ignoreAP: true }] : [];
  const aOps = Object.prototype.hasOwnProperty.call(e, 'ops');
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'trivial') continue;
    if (k === 'blessures') {
      if (!aOps && wounds.length) out.ops = wounds;
      continue;
    }
    if (k === 'ops') out.ops = [...wounds, ...v];
    else if (k === 'resist') out.test = noeud(v);
    else if (k === 'escalation') out.escalation = escalade(v);
    else out[k] = v;
  }
  return out;
};

// ---- ÉCRITURE : 8 documents, `aa-criticals.json` supprimé.
const documents = [];
for (const jeu of ['ldb', 'aa']) {
  for (const loc of LOCALISATIONS) {
    documents.push({
      id: `criticals-${jeu}-${loc}`,
      type: 'criticals',
      label: LIBELLE[jeu][loc],
      source: SOURCE[jeu][loc],
      jeu,
      localisation: loc,
      entries: SOURCES[jeu][loc].map(rangee),
    });
  }
}

fs.writeFileSync(CIBLE, JSON.stringify(documents, null, 2), 'utf8');
fs.rmSync(SOURCE_AA);

// ---- PREUVE post-écriture, sur le RÉSULTAT relu.
{
  const relu = JSON.parse(fs.readFileSync(CIBLE, 'utf8'));
  const rangees = relu.flatMap((d) => d.entries);
  const mesure = {
    documents: relu.length,
    rangees: rangees.length,
    noeuds: rangees.filter((e) => e.test).length + rangees.filter((e) => e.escalation?.onNextCritWhileCondition?.test).length,
    sansDifficulty: rangees.filter((e) => e.test && e.test.test.difficulty === undefined).length,
    blessuresRestantes: rangees.filter((e) => 'blessures' in e).length,
    trivialRestants: rangees.filter((e) => 'trivial' in e).length,
    resistRestants: rangees.filter((e) => 'resist' in e).length + rangees.filter((e) => e.escalation?.onNextCritWhileCondition?.resist).length,
    sources: rangees.filter((e) => e.source).length,
    idsDistincts: new Set(rangees.map((e) => e.id)).size,
    docsDistincts: new Set(relu.map((d) => d.id)).size,
    docsSources: relu.filter((d) => d.source?.book && typeof d.source.page === 'number').length,
    docsAuFolioDeLeursRangees: relu.filter((d) => d.jeu !== 'aa' || d.entries.every((e) => e.source.page === d.source.page)).length,
    triviales: rangees.filter((e) => !e.lethal && !(e.ops ?? []).some((o) => o.op === 'wounds')).length,
    woundsSansMitigationDeclaree: rangees.flatMap((e) => e.ops ?? []).filter((o) => o.op === 'wounds' && !('ignoreTB' in o && 'ignoreAP' in o)).length,
  };
  const exige = (cle, valeur) => {
    if (mesure[cle] !== valeur) echecs.push(`POST ${cle} : ${mesure[cle]} != ${valeur}`);
  };
  exige('documents', CARDINAUX.documents);
  exige('rangees', CARDINAUX.rangees);
  exige('noeuds', CARDINAUX.noeuds);
  exige('sansDifficulty', 0);
  exige('blessuresRestantes', 0);
  exige('trivialRestants', 0);
  exige('resistRestants', 0);
  exige('sources', CARDINAUX.sources);
  exige('idsDistincts', CARDINAUX.rangees);
  exige('docsDistincts', CARDINAUX.documents);
  exige('docsSources', CARDINAUX.documents);
  exige('docsAuFolioDeLeursRangees', CARDINAUX.documents);
  exige('triviales', CARDINAUX.trivialSupprimes);
  exige('woundsSansMitigationDeclaree', 0);
  if (fs.existsSync(SOURCE_AA)) echecs.push('POST : aa-criticals.json existe encore');
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(
  `criticals.json : ${CARDINAUX.documents} documents · ${CARDINAUX.rangees} rangées · ${CARDINAUX.noeuds} nœuds test · ` +
    `${CARDINAUX.blessuresAbsorbees} blessures absorbés · ${CARDINAUX.trivialSupprimes} trivial dérivés · ${CARDINAUX.sources} source préservés`,
);
console.log('aa-criticals.json : SUPPRIMÉ (fusionné)');
