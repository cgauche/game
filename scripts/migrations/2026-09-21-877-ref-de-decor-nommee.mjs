/**
 * Migration #877 — le TYPE d'un décor se NOMME, volet `src/scenes`.
 *
 * UN geste, et le document passe en `schema: 12` : toute entité `kind:'prop'` sans `ref` reçoit
 * `ref: 'tonneau'` — le type que le MONDE dessinait en dur avant ce lot (`gameIso/builders/props.ts`,
 * la voie du décor de scène). Ce que la migration ÉCRIT, c'est ce que le monde MONTRAIT : le décor
 * de scène sort inchangé. Le backend SPRITE (`entitySprite` → `tokenBodyKind`), lui, ne dessinait RIEN
 * pour une ref absente : ces 3 décors y gagnent le tonneau que le monde leur donnait déjà — les deux
 * backends s'ALIGNENT sur la donnée, au lieu de diverger sur une absence.
 *
 * POURQUOI : depuis ce lot, `ref` est REQUISE sur un décor et résolue au registre `props.json`
 * (`src/data/schemas/defs-scenes/scene.ts`) — une ref de décor se DIT ou se REFUSE, jamais ne se
 * remplace. Sans ce passage, les campagnes livrées seraient REFUSÉES au parse dès leur premier décor
 * sans type.
 *
 * Une entité qui porte DÉJÀ `ref` traverse INTACTE, y compris si son id est MORT : une ref hors
 * registre n'est pas du ressort d'une migration, le schéma la NOMME et l'auteur la corrige.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json`.
 * CARDINAL MESURÉ sur l'arbre au moment de l'écriture (2026-09-21) : 4 projets, 28 Scènes, 314 décors,
 * dont 3 sans `ref` (`barge-du-sel-quai › p0`, `ls-quai-salzenmund › p0`, `ls-quai-erengrad › p0`) et
 * 0 ref hors registre. Le cardinal est RAPPORTÉ, jamais confronté (#1812) : une Scène neuve en ajoute.
 * FORMATAGE PRÉSERVÉ : les documents de scène ont leur PROPRE sérialiseur —
 * `JSON.stringify(doc, null, 1) + '\n'`. Forme vérifiée AVANT toute écriture : non canonique =
 * sortie 1, jamais un reflow silencieux.
 * POSITION : `ref` va en QUEUE de l'entité — la place que l'éditeur donne à un champ posé sur une
 * entité existante (`editEntity`), et celle que pose `poseSurChaqueEntite` (`src/state/worldMap.ts`).
 * Parité avec `PROJECT_MIGRATIONS[11]` mesurée par `src/state/projet-migration-11-vers-12.test.ts`.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0 (plus aucun décor sans
 * `ref`).
 * BORNE HAUTE CLOSE (`schema` ∈ {11, 12}, jamais « ≥ 11 ») : DERNIÈRE de la chaîne dans l'ordre
 * lexical, elle est la seule à savoir ce qui existe après elle et NOMME un `schema` futur.
 * FAIL-FAST : `schema` absent, non numérique ou ∉ {11, 12}, `scenes` non-tableau, périmètre vide →
 * rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-21-877-ref-de-decor-nommee';
const RACINE = path.join(ROOT, 'src/scenes');

/** Forme du document AVANT et APRÈS ce bump — la borne haute est CLOSE (cf. en-tête). */
const SCHEMA_AVANT = 11;
const SCHEMA_APRES = 12;
/** Le type que le rendu DONNAIT à un décor sans `ref` avant ce lot. Ce littéral FIGE un passé. */
const REF_DU_RENDU_AVANT_877 = 'tonneau';

/** Forme canonique d'un document de projet de scène. */
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

const echecs = [];

/** Un décor qui ne NOMME aucun type — la seule population de ce passage. */
const decorSansType = (ent) => !!ent && typeof ent === 'object' && ent.kind === 'prop' && ent.ref === undefined;

const cibles = fs
  .readdirSync(RACINE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
  .filter((p) => fs.existsSync(p));

const rapports = [];
let scenesVues = 0;
let nommesVus = 0;
/** Population STABLE : les décors, toutes scènes confondues. MESURÉE pour le RAPPORT (#1812). */
let decorsVus = 0;

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

  let nommes = 0;
  const scenes = doc.scenes.map((s) => {
    scenesVues++;
    if (!Array.isArray(s?.entities)) return s;
    const entities = s.entities.map((e) => {
      if (e && typeof e === 'object' && e.kind === 'prop') decorsVus++;
      if (!decorSansType(e)) return e;
      nommes++;
      return { ...e, ref: REF_DU_RENDU_AVANT_877 }; // QUEUE : la place de l'éditeur
    });
    return { ...s, entities };
  });

  nommesVus += nommes;
  rapports.push({ rel, abs, brut, doc, scenes, nommes });
}

// FORME, jamais cardinal (#1812) : une Scène et son décor sont des données ÉDITABLES — en créer ne
// doit rien recaler ici. Ce qui arrête la migration, c'est un périmètre VIDE.
if (!cibles.length) echecs.push('aucun projet de scène trouvé — périmètre déplacé');
if (!scenesVues) echecs.push('aucune Scène embarquée — périmètre déplacé');

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

  // PREUVE post-écriture : plus AUCUN décor sans type, et le document s'annonce au format d'après.
  const apres = JSON.parse(out);
  const restes = apres.scenes
    .flatMap((s) => (Array.isArray(s.entities) ? s.entities : []))
    .filter(decorSansType)
    .map((e) => e.id);
  if (restes.length || apres.schema !== SCHEMA_APRES) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, ${restes.join(', ')}`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}, décors dont le type se NOMME désormais : ${r.nommes} (scènes : ${apres.scenes.length}) — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

console.log(`[${NOM}] TOTAL — ${cibles.length} projet(s), ${scenesVues} Scène(s), ${nommesVus} décor(s) nommé(s) ; population : ${decorsVus} décor(s)`);
