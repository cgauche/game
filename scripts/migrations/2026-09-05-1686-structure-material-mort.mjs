/**
 * Migration #1686 LOT 3a-2 — la clé `material` des apparences de structure est RETIRÉE.
 *
 * `structureAppearance.json` portait sur chaque entrée un `material` ('bois' | 'pierre') qu'AUCUN
 * lecteur d'exécution ne consultait : la couleur de chaque partie de mur vient des CHAMPS de l'entrée
 * (`wallPartColor`, `src/gameIso/catalog/structures/index.ts`), l'iso et le POV n'en lisent aucun
 * autre canal. Une clé qu'on ne lit pas mais qu'on écrit à chaque nouvelle apparence est une seconde
 * vérité en attente : elle part avec son schéma, son type et son repli, dans le même commit.
 *
 * Le RENDU est INCHANGÉ (aucune face ne dépend de cette clé) : la preuve est le hash des faces des
 * 65 scènes livrées, identique avant et après.
 *
 * Entrée : `src/data/structureAppearance.json` (lu et écrit).
 * CARDINAL ATTENDU, mesuré sur l'arbre au moment de l'écriture (2026-09-05) : 18 entrées portant la
 * clé, sur 18 entrées. Un écart fait sortir 1 AVANT toute écriture.
 * MARQUEUR D'IDEMPOTENCE : la présence de la clé. Rejouée sur l'arbre migré, la migration n'écrit
 * rien et sort 0.
 * FAIL-FAST : racine non-tableau, cardinal inattendu, formatage non canonique, clé encore présente
 * après écriture → rien n'est écrit / sortie 1.
 * FORMATAGE PRÉSERVÉ : `src/data/*.json` est `JSON.stringify(doc, null, 2)` (sans saut final).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-05-1686-structure-material-mort';
const REL = 'src/data/structureAppearance.json';
const CLE = 'material';
/** Cardinal mesuré (2026-09-05) — porte d'identité du périmètre, jamais une estimation. */
const ATTENDU = { entrees: 18, porteuses: 18 };

const echec = (m) => {
  console.error(`[${NOM}] ${m}`);
  process.exit(1);
};

const cible = path.join(ROOT, REL);
const brut = fs.readFileSync(cible, 'utf8');
const doc = JSON.parse(brut);
if (brut !== JSON.stringify(doc, null, 2)) echec(`${REL} : formatage non canonique en entrée`);
if (!Array.isArray(doc)) echec(`${REL} : racine non-TABLEAU`);

const porteuses = doc.filter((e) => e && typeof e === 'object' && CLE in e);
if (porteuses.length === 0) {
  if (doc.length !== ATTENDU.entrees) echec(`déjà migrée en apparence, mais ${doc.length} entrée(s) ≠ ${ATTENDU.entrees}`);
  console.log(`[${NOM}] déjà migrée — rien à écrire`);
  process.exit(0);
}
if (doc.length !== ATTENDU.entrees) echec(`${doc.length} entrée(s) ≠ ${ATTENDU.entrees} attendue(s)`);
if (porteuses.length !== ATTENDU.porteuses) echec(`${porteuses.length} entrée(s) portant \`${CLE}\` ≠ ${ATTENDU.porteuses} attendue(s)`);

// ── ÉCRITURE ────────────────────────────────────────────────────────────────────────────────────
for (const e of porteuses) delete e[CLE];
fs.writeFileSync(cible, JSON.stringify(doc, null, 2), 'utf8');

// ── PREUVE POST-ÉCRITURE — 0 clé restante, cardinal d'entrées intact ────────────────────────────
const relu = JSON.parse(fs.readFileSync(cible, 'utf8'));
const restantes = relu.filter((e) => e && typeof e === 'object' && CLE in e).map((e) => e.id);
if (restantes.length) echec(`ÉCHEC POST-ÉCRITURE : \`${CLE}\` encore présent sur ${restantes.join(', ')}`);
if (relu.length !== ATTENDU.entrees) echec(`ÉCHEC POST-ÉCRITURE : ${relu.length} entrée(s) ≠ ${ATTENDU.entrees}`);

console.log(`[${NOM}] migré — clé \`${CLE}\` retirée de ${porteuses.length} apparence(s) de structure`);
