/**
 * Migration #1715 — la TOITURE PAR DÉFAUT passe en DONNÉE, volet `src/scenes`.
 *
 * DEUX gestes, un seul passage : chaque Scène reçoit `roofDefaults`, et le document passe en
 * `schema: 9` — le champ étant EXIGÉ, la FORME du document change, et un projet antérieur se rattrape
 * au chargement par `PROJECT_MIGRATIONS[8]` (`src/state/worldMap.ts`), pendant applicatif de ce script.
 *
 * Chaque Scène des projets livrés reçoit `roofDefaults` : la couverture, la pente de RÉFÉRENCE et la
 * borne de comble que la dérivation des masses applique quand ni le corps ni le TYPE de bâtiment ne
 * les surchargent (`toitureEffective`, `src/state/sceneEdit.ts`). Le champ est EXIGÉ par le schéma de
 * Scène — un document qui n'en porte pas est refusé au parse, la dérivation n'ayant plus aucune valeur
 * à deviner. Les valeurs posées sont EXACTEMENT celles que `sceneEdit.ts` appliquait en dur avant le
 * lot, si bien que l'identité de rendu est le contrat de ce lot.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json`.
 * CARDINAL ATTENDU, mesuré sur l'arbre au moment de l'écriture (2026-09-09) : 4 projets, 28 Scènes
 * embarquées. Les autres Scènes du corpus sont fabriquées en TS (`state/mapSpec.buildScene`) et
 * tiennent le champ d'`emptyScene` : elles n'ont rien à migrer.
 * FORMATAGE PRÉSERVÉ : les documents de scène ont leur PROPRE sérialiseur —
 * `JSON.stringify(doc, null, 1) + '\n'`. Forme vérifiée AVANT toute écriture : non canonique =
 * sortie 1, jamais un reflow silencieux.
 * IDEMPOTENT : une Scène portant déjà `roofDefaults` est reconnue migrée ; rejouée sur l'état final,
 * la migration n'écrit rien et sort 0.
 * BORNE HAUTE CLOSE (`schema` ∈ {8, 9}, jamais « ≥ 8 ») : DERNIÈRE de la chaîne dans l'ordre lexical,
 * elle est la seule à savoir ce qui existe après elle et NOMME un `schema` futur, là où les amont
 * l'avalent par leur borne ouverte. `2026-09-07-1691-relief-defaults-scenes.mjs` a fermé la sienne
 * jusqu'ici ; ce bump l'élargit à « ≥ 8 » et ferme celle-ci.
 * FAIL-FAST : `roofDefaults` présent mais incomplet ou de forme inattendue, `schema` absent, non
 * numérique ou ∉ {8, 9} → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-09-1715-roof-defaults-scenes';
const RACINE = path.join(ROOT, 'src/scenes');

/** La toiture par défaut, telle que `sceneEdit.ts` l'appliquait en dur avant ce lot. */
const POSE = { material: 'toit-ardoise', pitchDeg: 45, riseMaxStoreys: 1 };
const CHAMPS = Object.keys(POSE);
/** Type attendu de chaque champ posé — un `material` est un id, les deux autres des nombres. */
const TYPE_DE = { material: 'string', pitchDeg: 'number', riseMaxStoreys: 'number' };
/** Cardinaux mesurés (2026-09-09) — portes d'identité du périmètre. */
const ATTENDU = { projets: 4, scenes: 28 };
/** Forme du document AVANT et APRÈS ce bump — la borne haute est CLOSE (cf. en-tête). */
const SCHEMA_AVANT = 8;
const SCHEMA_APRES = 9;

/** Forme canonique d'un document de projet de scène. */
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/**
 * La Scène, `roofDefaults` inséré à la place que la CRÉATION lui donne (`emptyScene`,
 * `src/state/scene.ts`) : juste après `reliefDefaults`. Les projets d'arène, de barge et de cogue sont
 * re-générables à l'octet (`src/scenes/generateurs-byte-stables.test.ts`) — poser la clé en queue
 * ferait diverger l'artefact committé de son `build()`. Sans `reliefDefaults` (document ancien), la
 * clé va en queue : la position n'est alors contrainte par rien.
 */
function avecRoofDefaults(s) {
  const cles = Object.keys(s);
  const rang = cles.indexOf('reliefDefaults');
  if (rang < 0) return { ...s, roofDefaults: { ...POSE } };
  return Object.fromEntries([
    ...cles.slice(0, rang + 1).map((k) => [k, s[k]]),
    ['roofDefaults', { ...POSE }],
    ...cles.slice(rang + 1).map((k) => [k, s[k]]),
  ]);
}

const cibles = fs
  .readdirSync(RACINE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
  .filter((p) => fs.existsSync(p));

const echecs = [];
const rapports = [];
let scenesVues = 0;

for (const abs of cibles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);

  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (doc.schema !== SCHEMA_AVANT && doc.schema !== SCHEMA_APRES) {
    echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`);
    continue;
  }
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }

  let migres = 0;
  let deja = 0;
  const scenes = doc.scenes.map((s, i) => {
    scenesVues++;
    const porte = s?.roofDefaults;
    if (porte === undefined) { migres++; return avecRoofDefaults(s); }
    const manquants = CHAMPS.filter((c) => typeof porte?.[c] !== TYPE_DE[c]);
    if (manquants.length) echecs.push(`${rel} › scenes[${i}] (${s.id}) : \`roofDefaults\` sans ${manquants.join(', ')}`);
    else deja++;
    return s;
  });

  rapports.push({ rel, abs, brut, doc, scenes, migres, deja });
}

if (cibles.length !== ATTENDU.projets) echecs.push(`${cibles.length} projet(s) de scène ≠ ${ATTENDU.projets} attendu(s)`);
if (scenesVues !== ATTENDU.scenes) echecs.push(`${scenesVues} Scène(s) embarquée(s) ≠ ${ATTENDU.scenes} attendue(s)`);

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  const sortie = Object.fromEntries(
    Object.entries(r.doc).map(([k, v]) => (k === 'scenes' ? [k, r.scenes] : k === 'schema' ? [k, SCHEMA_APRES] : [k, v])),
  );
  const out = canonique(sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : chaque Scène porte les TROIS champs, avec les valeurs posées.
  const apres = JSON.parse(out);
  const muettes = apres.scenes.filter((s) => CHAMPS.some((c) => s.roofDefaults?.[c] !== POSE[c])).map((s) => s.id);
  if (muettes.length || apres.schema !== SCHEMA_APRES) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, ${muettes.join(', ')}`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}, roofDefaults posés : ${r.migres} (déjà migrées : ${r.deja}, scènes : ${apres.scenes.length}) — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}
