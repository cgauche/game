/**
 * Migration #1680 ligne 15 — le couvert de la CLÔTURE recalé sur ce que sa def d'art DESSINE.
 *
 * `props.json` déclarait `cloture` en couvert MOYEN, et sa provenance affirmait « une clôture EST la
 * barrière en bois de l'étalon de couvert MOYEN (LDB 14 l.81) — même objet, aucune extrapolation ».
 * La def d'art (`src/gameIso/catalog/decor/defs/cloture.ts`) dessine quatre poteaux et deux lisses :
 * une clôture à CLAIRE-VOIE, pas la barrière PLEINE de l'étalon. « Même objet » était donc faux, et
 * c'est ce faux qui interdisait l'extrapolation. L'axe que les 32 autres `maison` de couvert de décor
 * suivent est la MATIÈRE et l'AJOUR ; à claire-voie, l'étalon est celui de la haie — couvert
 * IMPARFAIT (`LDB 14 l.72`).
 *
 * ENTRÉES : `src/data/props.json` (seule donnée lue et écrite). Une entrée touchée.
 *
 * MARQUEUR D'IDEMPOTENCE : la valeur de `cloture.cover`. `moyenne` = non migrée, `imparfaite` = migrée
 * (et la phrase de provenance est alors déjà la neuve). Rejoué sur l'état final, le script n'écrit rien.
 *
 * FAIL-FAST (porte de lecture, avant toute écriture) : racine non-tableau, entrée `cloture` absente,
 * `cover` à une valeur ni attendue ni finale, `maison` qui n'est pas la phrase attendue en entrée
 * → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/props.json');

const ID = 'cloture';
const COVER_AVANT = 'moyenne';
const COVER_APRES = 'imparfaite';
const MAISON_AVANT =
  'couvert maison : une clôture EST la barrière en bois de l’étalon de couvert MOYEN (LDB 14 l.81) — même objet, aucune extrapolation';
const MAISON_APRES =
  'couvert maison : la def d’art est une clôture à CLAIRE-VOIE (quatre poteaux, deux lisses). Aucun ancrage canon ne colle : la clôture en clayonnage d’AA (l.28-51) vaut +0 mais est un TRESSAGE serré de minces branches de saule (AA 10 l.65), et la barrière en bois de l’étalon MOYEN (LDB 14 l.81) est faite de planches pleines. À claire-voie, l’objet est entre les deux — valeur INTERCALÉE sur l’étalon IMPARFAIT de la haie (LDB 14 l.72), le seul que le canon donne à un obstacle AJOURÉ';

const echec = (m) => {
  console.error(`[2026-09-03-1680-cloture-claire-voie] ${m}`);
  process.exit(1);
};

const brut = fs.readFileSync(CIBLE, 'utf8');
const doc = JSON.parse(brut);
if (!Array.isArray(doc)) echec('racine non-tableau');
if (brut !== JSON.stringify(doc, null, 2)) echec('formatage non canonique en entrée');

const entree = doc.find((e) => e?.id === ID);
if (!entree) echec(`entrée \`${ID}\` absente`);

if (entree.cover === COVER_APRES) {
  if (entree.maison !== MAISON_APRES) echec('déjà migrée mais provenance inattendue');
  console.log('[2026-09-03-1680-cloture-claire-voie] déjà migrée — rien à écrire');
  process.exit(0);
}
if (entree.cover !== COVER_AVANT) echec(`\`${ID}.cover\` = ${JSON.stringify(entree.cover)}, attendu ${COVER_AVANT}`);
if (entree.maison !== MAISON_AVANT) echec(`\`${ID}.maison\` n'est pas la phrase attendue en entrée`);

entree.cover = COVER_APRES;
entree.maison = MAISON_APRES;

fs.writeFileSync(CIBLE, JSON.stringify(doc, null, 2));
console.log(`[2026-09-03-1680-cloture-claire-voie] 1 entrée migrée : ${ID} ${COVER_AVANT} → ${COVER_APRES}`);
