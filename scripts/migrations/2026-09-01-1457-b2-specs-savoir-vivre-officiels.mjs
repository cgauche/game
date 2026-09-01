/**
 * Migration #1457 (B2) — les 9 spécs de `savoir-vivre` portées par des créatures des livres
 * OFFICIELS (Middenheim 6, Mer des Griffes 2, Zoo Impérial 1) rejoignent le catalogue par leur ID.
 *
 * Deux gestes, chacun adossé à la ligne « **Talents :** » du statbloc lue au `Source/` FR :
 *  - `ENTREES_NEUVES` : le groupe social est IMPRIMÉ et ABSENT du catalogue → entrée
 *    `talents.json › savoir-vivre.specs[]` `{id,label,source,pool:false}` (`page` = folio IMPRIMÉ qui
 *    gouverne la ligne du STATBLOC, `note` = citation à la ligne, confrontées par
 *    `folio-line-align.test.ts`). `pool: false` : leur seul consommateur est un statbloc, aucune
 *    ligne joueur ne les demande et LDB 10 l.1071 ne les énumère pas (#1342 L3 ; `LDB 09 l.40`).
 *  - `SOURCES_MANQUANTES` : le groupe est DÉJÀ au catalogue mais NU (aucune `source`) alors que
 *    LDB 10 l.1071 ne l'énumère pas — il reçoit la citation de la PREMIÈRE ligne JOUEUR qui le
 *    demande (une ligne « **Talents :** » de niveau de carrière), folio = ancre `data-folio` qui
 *    gouverne cette ligne. Aucun `pool: false` ici : une ligne joueur le demande, le pool doit le
 *    proposer (`LDB 09 l.40`).
 *  - `ARBITRAGES` : le groupe est DÉJÀ au catalogue sous une autre GRAPHIE — le porteur prend l'id
 *    (doctrine des ids : le `label` est de l'affichage). Chaque ligne porte, en commentaire, les
 *    DEUX impressions qui prouvent la synonymie ; créer une 2ᵉ entrée poserait un doublon de concept.
 *
 * ENTRÉES : `src/data/talents.json` (catalogue de `savoir-vivre`, écrit) et `src/data/creatures.json`
 * (les 9 porteurs, écrit). Marche des `talents[]` : `scripts/data/lib/skillSpecWalk.mjs`
 * (`walkSkillRefs`), la MÊME que la garde `src/data/refs-migrated.test.ts`.
 *
 * IDEMPOTENT : rejouée, elle n'écrit rien (l'état d'arrivée est reconnu porteur par porteur).
 * FAIL-FAST : arrêt en 1 si le catalogue manque, si un id neuf entre en collision, ou si un porteur
 * n'est NI dans l'état de départ NI dans l'état d'arrivée — l'arbre n'est écrit qu'après mesure.
 * FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkSkillRefs } from '../data/lib/skillSpecWalk.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = path.join(ROOT, 'src/data');
const TALENT = 'savoir-vivre';

/** Groupes sociaux imprimés que le catalogue ne porte pas encore. */
const ENTREES_NEUVES = [
  // MDG 16 l.360 (statbloc Jaego Roth, folio 151) : « Savoirvivre (Marins, Nobles, Pirates) ».
  // Distinct d'`equipage` : le MÊME livre imprime « Savoir-vivre (Équipage) » (MDG 09 l.95/171/578,
  // MDG 14 l.349) et « Marins » à la même ligne que « Nobles » et « Pirates ».
  { id: 'marins', label: 'Marins', source: { book: 'mer-des-griffes', page: 151, note: 'MDG 16 l.360' }, pool: false },
  { id: 'pirates', label: 'Pirates', source: { book: 'mer-des-griffes', page: 151, note: 'MDG 16 l.360' }, pool: false },
  // ZI 04 l.44 (statbloc de « L'abominable » Halagrundsor, folio 35) : « Savoir-vivre (Nains) ».
  { id: 'nains', label: 'Nains', source: { book: 'zoo-imperial', page: 35, note: 'ZI 04 l.44' }, pool: false },
];

/** Entrées déjà au catalogue mais SANS attestation — `attendu` = le libellé du catalogue, re-mesuré. */
const SOURCES_MANQUANTES = [
  // LDB 08 l.1295 (Prêtre Guerrier, niveau « Novice – Bronze 2 », folio 73) :
  // « **Talents :** Béni (au choix), Lire/Écrire, Obstiné, Savoir-vivre (Fidèles) ».
  { id: 'fideles', attendu: 'Fidèles', source: { book: 'livre-de-base', page: 73, note: 'LDB 08 l.1295' } },
  // MDG 09 l.95 (Artilleur de navire, niveau « Artilleur de navire – Argent 3 », folio 64) :
  // « **Talents :** Artilleur, Savoir-vivre (Équipage), Tireur de ».
  { id: 'equipage', attendu: 'Équipage', source: { book: 'mer-des-griffes', page: 64, note: 'MDG 09 l.95' } },
];

/**
 * Porteurs dont la spéc imprimée EST une entrée du catalogue sous une autre graphie. `imprime` =
 * verbatim du statbloc, `vers` = id existant, `cite` = les impressions qui portent la décision.
 */
const ARBITRAGES = [
  // MCLB 02 l.2406 (folio 106) : « Savoirvivre (Serviteur, Guilde, Noble) ».
  // « Serviteur » ⇄ `serviteurs` : le MÊME livre imprime « Savoir-vivre (Serviteurs) » (MCLB 02
  // l.1828) et LDB 10 l.1071 énumère « … Serviteurs et Soldats ».
  { creature: 'andrea-bruhn', imprime: 'Serviteur', vers: 'serviteurs', cite: 'MCLB 02 l.2406 ⇄ MCLB 02 l.1828' },
  // « Guilde » ⇄ `guildes` : le MÊME livre imprime « Savoir-vivre (Guildes) » (MCLB 09 l.144).
  { creature: 'andrea-bruhn', imprime: 'Guilde', vers: 'guildes', cite: 'MCLB 02 l.2406 ⇄ MCLB 09 l.144' },
  // « Noble » ⇄ `nobles` : MDG 16 l.360 imprime « Nobles », LDB 10 l.1071 aussi.
  { creature: 'andrea-bruhn', imprime: 'Noble', vers: 'nobles', cite: 'MCLB 02 l.2406 ⇄ MDG 16 l.360' },
  // MCLB 02 l.696 (folio 52) : « Savoir-vivre (Noble), Savoir-vivre (Soldat) ».
  { creature: 'moritz-valgeir', imprime: 'Noble', vers: 'nobles', cite: 'MCLB 02 l.696 ⇄ MDG 16 l.360' },
  // « Soldat » ⇄ `soldats` : LDB 10 l.1071 « … Serviteurs et Soldats ».
  { creature: 'moritz-valgeir', imprime: 'Soldat', vers: 'soldats', cite: 'MCLB 02 l.696 ⇄ LDB 10 l.1071' },
  // MCLB 02 l.1308 (folio 72) : « Savoir-vivre (Guilde) ».
  { creature: 'stefan-hochen', imprime: 'Guilde', vers: 'guildes', cite: 'MCLB 02 l.1308 ⇄ MCLB 09 l.144' },
  // MDG 16 l.360 (folio 151) et ZI 04 l.44 (folio 35) : les entrées créées ci-dessus.
  { creature: 'jaego-roth', imprime: 'Marins', vers: 'marins', cite: 'MDG 16 l.360' },
  { creature: 'jaego-roth', imprime: 'Pirates', vers: 'pirates', cite: 'MDG 16 l.360' },
  { creature: 'l-abominable-halagrundsor', imprime: 'Nains', vers: 'nains', cite: 'ZI 04 l.44' },
];

const lire = (f) => {
  const abs = path.join(DATA, f);
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== JSON.stringify(doc, null, 2)) {
    console.error(`FORME NON CANONIQUE — src/data/${f} ; AUCUNE écriture.`);
    process.exit(1);
  }
  return { abs, brut, doc };
};

const ecrire = ({ abs, brut, doc }, quoi) => {
  const out = JSON.stringify(doc, null, 2);
  if (out === brut) { console.log(`${path.basename(abs)} — INCHANGÉ (no-op byte-identique).`); return; }
  if (out.includes('\r')) { console.error(`${abs} : \\r dans le texte réécrit ; AUCUNE écriture.`); process.exit(1); }
  fs.writeFileSync(abs, out, 'utf8');
  console.log(`${path.basename(abs)} — ${quoi}`);
};

// -- Catalogue ---------------------------------------------------------------------------------
const talents = lire('talents.json');
const def = talents.doc.find((t) => t.id === TALENT);
if (!def || !Array.isArray(def.specs)) {
  console.error(`« ${TALENT} » absent de talents.json, ou sans specs[] inline ; AUCUNE écriture.`);
  process.exit(1);
}
let ajoutees = 0;
let horsPool = 0;
for (const e of ENTREES_NEUVES) {
  const deja = def.specs.find((s) => s.id === e.id);
  if (deja) {
    if (deja.label !== e.label) {
      console.error(`COLLISION d'id ${TALENT}/${e.id} : catalogue « ${deja.label} » vs ajout « ${e.label} » ; AUCUNE écriture.`);
      process.exit(1);
    }
    if (deja.pool !== false) { deja.pool = false; horsPool++; }
    continue;
  }
  def.specs.push(e);
  ajoutees++;
}

let sourcees = 0;
for (const s of SOURCES_MANQUANTES) {
  const e = def.specs.find((x) => x.id === s.id);
  if (!e) { console.error(`ENTRÉE ABSENTE — ${TALENT}/${s.id} ; AUCUNE écriture.`); process.exit(1); }
  if (e.label !== s.attendu) {
    console.error(`LIBELLÉ INATTENDU — ${TALENT}/${s.id} : « ${e.label} » au lieu de « ${s.attendu} » ; AUCUNE écriture.`);
    process.exit(1);
  }
  if (e.source) {
    if (JSON.stringify(e.source) !== JSON.stringify(s.source)) {
      console.error(`SOURCE DIVERGENTE — ${TALENT}/${s.id} : ${JSON.stringify(e.source)} ; AUCUNE écriture.`);
      process.exit(1);
    }
    continue;
  }
  e.source = s.source;
  sourcees++;
}

const IDS = new Set(def.specs.map((s) => s.id));
for (const a of ARBITRAGES) {
  if (IDS.has(a.vers)) continue;
  console.error(`CIBLE ABSENTE — ${TALENT}/${a.vers} (${a.creature}, « ${a.imprime} ») ; AUCUNE écriture.`);
  process.exit(1);
}

// -- Porteurs ----------------------------------------------------------------------------------
const creatures = lire('creatures.json');
const parId = new Map(creatures.doc.map((c) => [c.id, c]));
let remappees = 0;
let dejaFaites = 0;
for (const a of ARBITRAGES) {
  const c = parId.get(a.creature);
  if (!c) { console.error(`PORTEUR ABSENT — creatures/${a.creature} ; AUCUNE écriture.`); process.exit(1); }
  let touche = 0;
  let arrivee = 0;
  walkSkillRefs(c, (node) => {
    if (node.id !== TALENT) return;
    if (node.spec === a.imprime) { node.spec = a.vers; touche++; return; }
    if (node.spec === a.vers) arrivee++;
  }, 'talents');
  if (touche) { remappees += touche; console.log(`  creatures/${a.creature} : ${TALENT} « ${a.imprime} » → ${a.vers}  [${a.cite}]`); continue; }
  if (arrivee) { dejaFaites++; continue; }
  console.error(`ÉTAT INATTENDU — creatures/${a.creature} ne porte NI ${TALENT}/« ${a.imprime} » NI ${TALENT}/${a.vers} ; AUCUNE écriture.`);
  process.exit(1);
}

// Écriture APRÈS la mesure complète des deux documents : un arrêt fail-fast laisse l'arbre intact.
ecrire(talents, `${ajoutees} entrée(s) ajoutée(s) au catalogue de ${TALENT}, ${horsPool} passée(s) hors pool, ${sourcees} attestée(s).`);
ecrire(creatures, `${remappees} spéc(s) de ${TALENT} ramenée(s) à leur id.`);
console.log(`Catalogue : +${ajoutees} · porteurs remappés : ${remappees} · déjà à l'id : ${dejaFaites} / ${ARBITRAGES.length}`);
