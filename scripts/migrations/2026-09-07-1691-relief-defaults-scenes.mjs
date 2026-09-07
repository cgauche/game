/**
 * Migration #1691 — la matière de RELIEF passe en DONNÉE, volet `src/scenes`.
 *
 * Chaque Scène des projets livrés reçoit `reliefDefaults` : la matière de CHAQUE partie de relief que
 * le builder de sols émet (falaise, rampe, dalle de tablier, pilier). Le champ est EXIGÉ par le schéma
 * de Scène — un document qui n'en porte pas est refusé au parse, le rendu n'ayant plus aucune valeur à
 * deviner. Les valeurs posées sont EXACTEMENT celles que `floors.ts` choisissait en dur, si bien que
 * l'identité de rendu (hash des faces des 66 scènes) est le contrat de ce lot.
 *
 * La face d'un terrain à BLOC PLEIN ne passe PAS par ici : elle tient sa matière de son TERRAIN
 * (`terrains.json › matiere`, migration sœur `2026-09-07-1691-relief-en-donnee.mjs`).
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json`.
 * CARDINAL ATTENDU, mesuré sur l'arbre au moment de l'écriture (2026-09-07) : 4 projets, 28 Scènes
 * embarquées. Les 38 autres Scènes du corpus sont fabriquées en TS (`state/mapSpec.buildScene`) et
 * tiennent le champ d'`emptyScene` : elles n'ont rien à migrer.
 * FORMATAGE PRÉSERVÉ : les documents de scène ont leur PROPRE sérialiseur —
 * `JSON.stringify(doc, null, 1) + '\n'` (précédent `2026-08-27-l1b-3g-scene-desc.mjs`). Forme
 * vérifiée AVANT toute écriture : non canonique = sortie 1, jamais un reflow silencieux.
 * IDEMPOTENT : une Scène portant déjà `reliefDefaults` est reconnue migrée ; rejouée sur l'état final,
 * la migration n'écrit rien et sort 0.
 * FAIL-FAST : `reliefDefaults` présent mais incomplet ou de forme inattendue → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-07-1691-relief-defaults-scenes';
const RACINE = path.join(ROOT, 'src/scenes');

/** La matière de chaque PARTIE, telle que `floors.ts` la choisissait en dur avant ce lot. */
const POSE = { cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier' };
const PARTIES = Object.keys(POSE);
/** Cardinaux mesurés (2026-09-07) — portes d'identité du périmètre. */
const ATTENDU = { projets: 4, scenes: 28 };

/** Forme canonique d'un document de projet de scène. */
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/**
 * La Scène, `reliefDefaults` inséré à la place que la CRÉATION lui donne (`emptyScene`,
 * `src/state/scene.ts`) : juste avant `layers`. Les projets d'arène, de barge et de cogue sont
 * re-générables à l'octet (`src/scenes/generateurs-byte-stables.test.ts`) — poser la clé en queue
 * ferait diverger l'artefact committé de son `build()`. Sans `layers` (document ancien), la clé va en
 * queue : la position n'est alors contrainte par rien.
 */
function avecReliefDefaults(s) {
  const cles = Object.keys(s);
  const rang = cles.indexOf('layers');
  if (rang < 0) return { ...s, reliefDefaults: { ...POSE } };
  return Object.fromEntries([
    ...cles.slice(0, rang).map((k) => [k, s[k]]),
    ['reliefDefaults', { ...POSE }],
    ...cles.slice(rang).map((k) => [k, s[k]]),
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
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }

  let migres = 0;
  let deja = 0;
  const scenes = doc.scenes.map((s, i) => {
    scenesVues++;
    const porte = s?.reliefDefaults;
    if (porte === undefined) { migres++; return avecReliefDefaults(s); }
    const manquantes = PARTIES.filter((p) => typeof porte?.[p] !== 'string');
    if (manquantes.length) echecs.push(`${rel} › scenes[${i}] (${s.id}) : \`reliefDefaults\` sans ${manquantes.join(', ')}`);
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
  const sortie = Object.fromEntries(Object.entries(r.doc).map(([k, v]) => (k === 'scenes' ? [k, r.scenes] : [k, v])));
  const out = canonique(sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : chaque Scène porte les QUATRE parties, avec les valeurs posées.
  const apres = JSON.parse(out);
  const muettes = apres.scenes.filter((s) => PARTIES.some((p) => s.reliefDefaults?.[p] !== POSE[p])).map((s) => s.id);
  if (muettes.length) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : ${muettes.join(', ')}`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — reliefDefaults posés : ${r.migres} (déjà migrées : ${r.deja}, scènes : ${apres.scenes.length}) — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}
