/**
 * Migration #1467 L1b V-UNION — `oups.json` reçoit la clé d'ENVELOPPE `type` sur chacune de ses 8
 * entrées, en DEUXIÈME position (juste après `id`).
 *
 * MÊME patron que les vagues 11a/11b/12a/12b (`2026-08-28-l1b-12b-entite-type.mjs`), même contrat :
 * `document()` pose `type: z.literal('oups')` en clé REQUISE de l'enveloppe, donc l'adoption du def
 * et la migration de sa donnée sont indissociables.
 *
 * ACCORD def ⇄ donnée : le `type` écrit ici est celui que le def déclare à `document()`, et c'est le
 * NOM DE BASE du dataset. L'accord n'est pas gardé par une seconde table mais par le SCHÉMA lui-même :
 * `z.literal('oups')` rend rouge toute entrée dont le `type` diverge.
 *
 * ENTRÉES : `src/data/oups.json` (seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée qui porte DÉJÀ `type: 'oups'` en 2ᵉ position est
 * reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : cardinal ≠ 8 (porte de lecture SEULE, avant toute écriture), racine non-tableau, entrée
 * sans `id` de chaîne, `type` déjà présent mais DIVERGENT → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const FICHIER = 'oups.json';
const TYPE = 'oups';
/** CARDINAL ATTENDU — mesuré sur l'arbre au moment de l'écriture (2026-08-28) : 7 bandes d100 + l'Incident de Tir. */
const CARDINAL = 8;

const echoue = (msg) => {
  console.error(`✗ ${FICHIER} — ${msg}`);
  process.exit(1);
};

const chemin = path.join(ROOT, 'src/data', FICHIER);
const brut = fs.readFileSync(chemin, 'utf8');
const doc = JSON.parse(brut);

if (!Array.isArray(doc)) echoue('racine non-tableau');
if (doc.length !== CARDINAL) echoue(`cardinal ${doc.length}, attendu ${CARDINAL} — périmètre mesuré changé`);
if (brut !== `${JSON.stringify(doc, null, 2)}\n` && brut !== JSON.stringify(doc, null, 2))
  echoue('forme non canonique (≠ JSON.stringify(doc, null, 2)) — refus de reflower en silence');

/** Suffixe de fin de fichier tel qu'il est, pour le réécrire à l'identique. */
const finDeLigne = brut.endsWith('\n') ? '\n' : '';

const sortie = doc.map((e, i) => {
  if (typeof e?.id !== 'string' || !e.id) echoue(`entrée ${i} sans \`id\` de chaîne`);
  if (e.type !== undefined && e.type !== TYPE) echoue(`entrée ${i} (${e.id}) porte type « ${e.type} », attendu « ${TYPE} »`);
  const { id, type: _ignore, ...reste } = e;
  return { id, type: TYPE, ...reste };
});

const texte = `${JSON.stringify(sortie, null, 2)}${finDeLigne}`;
if (texte === brut) {
  console.log(`= ${FICHIER} — déjà migré (${CARDINAL} entrées), rien à écrire`);
  process.exit(0);
}
fs.writeFileSync(chemin, texte);
console.log(`✓ ${FICHIER} — type « ${TYPE} » posé en 2ᵉ clé sur ${CARDINAL} entrées`);
