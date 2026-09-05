/**
 * Migration #1467 L1b V-FLIP-ENTITE-a — les datasets `entite` de la vague 11a reçoivent la clé
 * d'ENVELOPPE `type` sur chacune de leurs entrées, en DEUXIÈME position (juste après `id`).
 *
 * MOTIF : `document()` pose `type: z.literal(<type>)` en clé REQUISE de l'enveloppe. Un def adopté
 * sans cette clé dans sa donnée rend le dataset rouge au parse ; la migration et l'adoption sont donc
 * indissociables. Rien d'autre ne bouge : aucune valeur existante n'est touchée, aucune clé n'est
 * retirée ni réordonnée.
 *
 * ACCORD def ⇄ donnée : le `type` écrit ici est celui que le def déclare à `document()`. L'accord
 * n'est pas gardé par une seconde table mais par le SCHÉMA lui-même — `z.literal(<type>)` rend rouge
 * toute entrée dont le `type` diverge (mesuré par mutation M2 du lot).
 *
 * ENTRÉES : les fichiers de `src/data/` listés dans `TYPES` (seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP SÉMANTIQUE : le no-op se décide sur le CARDINAL du seul geste que ce script
 * POSSÈDE — la pose de `type`. Zéro `type` à poser dans un fichier = rien n'y est écrit et la sortie
 * est 0, quel que soit l'ordre des AUTRES clés de ses entrées : la remontée de `type` en 2ᵉ position
 * est une normalisation d'enveloppe, et une égalité à l'octet en ferait une réécriture à elle seule.
 * La POSITION de `type` n'est PAS une condition du no-op ; elle est vérifiée après écriture.
 * FAIL-FAST : racine non-tableau, entrée sans `id` de chaîne, `id` ailleurs qu'en TÊTE (cette vague
 * ne promeut PAS `id` : sa preuve post-écriture exige la charge utile dans son ordre d'origine),
 * `type` déjà présent mais DIVERGENT, cardinal d'entrées modifié → rien n'est écrit pour ce fichier,
 * sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Fichier de `src/data/` → `type` du document, tel que son def le déclare à `document()`.
 * Le `type` est le NOM DE BASE du dataset : c'est la clé que `sans-livre.ts` consulte
 * (`SANS_PROVENANCE_EXIGEE`, « Clé = `type` du document, égal au nom de base de son dataset ») et
 * celle qu'emploient les defs déjà adoptés (`names`, `ambiance`).
 */
const TYPES = {
  'astrology.json': 'astrology',
  'breath-types.json': 'breath-types',
  'calendarIntercalary.json': 'calendarIntercalary',
  'calendarPhases.json': 'calendarPhases',
  'calendarWeekdays.json': 'calendarWeekdays',
  'classes.json': 'classes',
  'crew-roles.json': 'crew-roles',
  'damage-types.json': 'damage-types',
  'encumbranceTiers.json': 'encumbranceTiers',
  'eyes.json': 'eyes',
  'hairs.json': 'hairs',
  'lieux-services.json': 'lieux-services',
  'lightLevels.json': 'lightLevels',
  'lightTones.json': 'lightTones',
  'merchantFamilies.json': 'merchantFamilies',
  'peripeties.json': 'peripeties',
  'qualitySubtypes.json': 'qualitySubtypes',
  'qualityTypes.json': 'qualityTypes',
  'raw.manifest.json': 'raw.manifest',
  'sea-shanties.json': 'sea-shanties',
};

/**
 * CARDINAL ATTENDU par fichier, et TOTAL — mesuré sur l'arbre au moment de l'écriture (2026-08-28).
 * Vérifié AVANT toute écriture : une entrée ajoutée ou retirée depuis fait sortir 1 plutôt que
 * migrer un périmètre qui n'est plus celui qu'on a mesuré.
 * Toute croissance légitime d'un dataset listé recale ce cardinal dans le train de la croissance.
 */
const CARDINAUX = {
  'astrology.json': 5,
  'breath-types.json': 6,
  'calendarIntercalary.json': 6,
  'calendarPhases.json': 7,
  'calendarWeekdays.json': 8,
  'classes.json': 9,
  'crew-roles.json': 9,
  'damage-types.json': 4,
  'encumbranceTiers.json': 4,
  'eyes.json': 10,
  'hairs.json': 10,
  'lieux-services.json': 7,
  'lightLevels.json': 5,
  'lightTones.json': 4,
  'merchantFamilies.json': 7,
  'peripeties.json': 10,
  'qualitySubtypes.json': 3,
  'qualityTypes.json': 2,
  // 8→9 : dette « Option Attraper Froid » (`deplacement#option-attraper-froid`), EDOC 09, #674.
  'raw.manifest.json': 10,
  'sea-shanties.json': 7,
};
// 141→142 : +1, la seule entrée de manifeste ci-dessus. Puis 142→146 : +4 matières de décor (#1624/#1644).
// Puis 146→147 : +1 entrée de manifeste (dette #1653, Colère des dieux : 6 rangées à dé sans `ops`).
// Puis 147→145 : −2 reliefs morts purgés (#1686 lot 1).
// Puis 145→133, 22→20 datasets : `propMaterials.json` (8) et `reliefMaterials.json` (4) n'existent plus
// comme DOCUMENTS — les trois catalogues de matières fusionnent en `materials.json` (#1686 lot 2), dont
// l'enveloppe est posée par sa propre migration et tenue au PRÉSENT, sur tout `src/data`, par la
// partition EXHAUSTIVE de `src/data/migrations-type-enveloppe.test.ts`.
const TOTAL_ATTENDU = 133;

const echecs = [];
const rapport = [];

// PORTE DE CARDINAL — lecture SEULE, avant la moindre écriture.
{
  const ecarts = [];
  let total = 0;
  for (const fichier of Object.keys(TYPES)) {
    const brut = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', fichier), 'utf8'));
    if (!Array.isArray(brut)) {
      ecarts.push(`${fichier} : racine non-TABLEAU`);
      continue;
    }
    total += brut.length;
    if (brut.length !== CARDINAUX[fichier]) ecarts.push(`${fichier} : ${brut.length} entrée(s) ≠ ${CARDINAUX[fichier]} attendue(s)`);
  }
  const sommeDeclaree = Object.values(CARDINAUX).reduce((a, b) => a + b, 0);
  if (sommeDeclaree !== TOTAL_ATTENDU) ecarts.push(`table CARDINAUX : somme ${sommeDeclaree} ≠ TOTAL_ATTENDU ${TOTAL_ATTENDU}`);
  if (total !== TOTAL_ATTENDU) ecarts.push(`TOTAL mesuré ${total} ≠ ${TOTAL_ATTENDU}`);
  if (ecarts.length) {
    console.error(`CARDINAL INATTENDU — rien n’est écrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

for (const [fichier, type] of Object.entries(TYPES)) {
  const cible = path.join(ROOT, 'src/data', fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const avant = JSON.parse(brut);

  if (JSON.stringify(avant, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }
  if (!Array.isArray(avant)) {
    echecs.push(`${fichier} : racine non-TABLEAU (famille \`entite\` attendue)`);
    continue;
  }

  const locales = [];
  let poses = 0;
  const apres = avant.map((e, i) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      locales.push(`${fichier}[${i}] : entrée non-objet`);
      return e;
    }
    if (typeof e.id !== 'string' || !e.id) {
      locales.push(`${fichier}[${i}] : entrée sans \`id\` de chaîne non vide`);
      return e;
    }
    if ('type' in e && e.type !== type) {
      locales.push(`${fichier} ${e.id} : \`type\` = ${JSON.stringify(e.type)} ≠ ${JSON.stringify(type)}`);
      return e;
    }
    // `id` en TÊTE : cette vague ne déclare AUCUNE promotion, et sa preuve post-écriture compare la
    // charge utile SÉRIALISÉE. Un `id` hors tête est donc une anomalie NOMMÉE, portée AVANT la porte
    // de no-op — donc avant toute écriture, jamais avalie par un no-op muet.
    const rangId = Object.keys(e).indexOf('id');
    if (rangId !== 0) {
      locales.push(`${fichier} ${e.id} : \`id\` au rang ${rangId} — aucune promotion de \`id\` n'est déclarée par cette vague`);
      return e;
    }
    // ENVELOPPE : `id` en tête, `type` juste après, puis le reste DANS SON ORDRE EXISTANT.
    if (!('type' in e)) poses++;
    const { id, type: _ancien, ...reste } = e;
    return { id, type, ...reste };
  });

  if (locales.length) {
    echecs.push(...locales);
    continue;
  }

  // NO-OP SÉMANTIQUE : ce script ne possède que la POSE de `type`. Aucune à poser = rien à écrire,
  // quel que soit l'ordre des clés du fichier — la promotion de `id` et `type` en tête est une
  // normalisation d'enveloppe, et une égalité à l'octet en ferait une réécriture à elle seule.
  if (poses === 0) {
    rapport.push(`${fichier} : no-op (0 \`type\` à poser sur ${avant.length} entrée(s))`);
    continue;
  }

  const sortie = JSON.stringify(apres, null, 2);

  fs.writeFileSync(cible, sortie, 'utf8');

  // PREUVE post-écriture : même cardinal, et chaque entrée est EXACTEMENT l'ancienne PLUS la clé
  // `type` — deep-equal sur le reste, `type` retiré des deux côtés.
  const relu = JSON.parse(fs.readFileSync(cible, 'utf8'));
  if (relu.length !== avant.length) echecs.push(`POST ${fichier} : ${relu.length} entrée(s) ≠ ${avant.length}`);
  for (let i = 0; i < relu.length; i++) {
    const d = relu[i];
    if (Object.keys(d).slice(0, 2).join(',') !== 'id,type') echecs.push(`POST ${fichier} ${d.id} : tête ≠ id,type`);
    if (d.type !== type) echecs.push(`POST ${fichier} ${d.id} : \`type\` ≠ ${JSON.stringify(type)}`);
    const { type: _t, ...sansType } = d;
    const { type: _t0, ...avantSansType } = avant[i];
    if (JSON.stringify(sansType) !== JSON.stringify(avantSansType)) {
      echecs.push(`POST ${fichier} ${d.id} : la charge utile a été ALTÉRÉE (autre chose que \`type\` a bougé)`);
    }
  }
  rapport.push(`${fichier} : ${relu.length} entrée(s) × \`type: "${type}"\``);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const l of rapport) console.log(l);
console.log(`vague 11a — ${Object.keys(TYPES).length} dataset(s) \`entite\` portent leur \`type\``);
