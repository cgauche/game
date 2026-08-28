/**
 * Migration #1467 L1b V-FLIP-ENTITE-b — les 21 datasets `entite` de la vague 12 reçoivent la clé
 * d'ENVELOPPE `type` sur chacune de leurs entrées, en DEUXIÈME position (juste après `id`).
 *
 * MÊME patron que les vagues 11a/11b (`2026-08-28-l1b-11a-entite-type.mjs`,
 * `2026-08-28-l1b-11b-entite-type.mjs`), même contrat : `document()` pose `type: z.literal(<type>)`
 * en clé REQUISE de l'enveloppe, donc l'adoption d'un def et la migration de sa donnée sont
 * indissociables. Rien d'autre ne bouge — à une exception NOMMÉE ci-dessous.
 *
 * ACCORD def ⇄ donnée : le `type` écrit ici est celui que le def déclare à `document()`, et c'est le
 * NOM DE BASE du dataset — la clé que `sans-livre.ts` consulte (`SANS_PROVENANCE_EXIGEE`, « Clé =
 * `type` du document, égal au nom de base de son dataset »). L'accord n'est pas gardé par une seconde
 * table mais par le SCHÉMA lui-même : `z.literal(<type>)` rend rouge toute entrée dont le `type`
 * diverge.
 *
 * PURGE NOMMÉE — `talents.json › talent-aleatoire` porte `desc: ""`. L'enveloppe déclare
 * `desc: z.string().min(1)` : la chaîne vide est le TROISIÈME état que la migration
 * `2026-08-27-l1b-3h-desc-null.mjs` a purgé partout où le schéma admettait l'absence, en renvoyant
 * NOMMÉMENT ce porteur-ci « au lot qui posera `min(1)` sur ce def » — c'est ce lot. La clé est donc
 * RETIRÉE (jamais remplie : aucune prose ne s'invente, règle 1 ; `talent-aleatoire` est une entrée
 * MÉTA du vocabulaire de tirage, `scripts/guards/lib/entityConsumers.mjs:144`). Le second porteur
 * cité par 3h, `species.json`, n'appartient PAS à cette vague et reste intact.
 *
 * ENTRÉES : les 21 fichiers de `src/data/` listés dans `TYPES` (seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée qui porte DÉJÀ le bon `type` en 2ᵉ position (et
 * dont la `desc` vide est déjà purgée) est reconnue migrée ; rejouée sur l'état final, la migration
 * n'écrit rien et sort 0.
 * FAIL-FAST : cardinal inattendu (porte de lecture SEULE, avant toute écriture), racine non-tableau,
 * entrée sans `id` de chaîne, `type` déjà présent mais DIVERGENT, `desc: ""` sur un porteur NON prévu
 * → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Fichier de `src/data/` → `type` du document, tel que son def le déclare à `document()`. */
const TYPES = {
  'careerLevels.json': 'careerLevels',
  'combat-stakes.json': 'combat-stakes',
  'domains.json': 'domains',
  'etats.json': 'etats',
  'flow-stakes.json': 'flow-stakes',
  'maladies.json': 'maladies',
  'maneuvers.json': 'maneuvers',
  'merchants.json': 'merchants',
  'naval-ports.json': 'naval-ports',
  'naval-traits.json': 'naval-traits',
  'pregens.json': 'pregens',
  'props.json': 'props',
  'reglesOptionnelles.json': 'reglesOptionnelles',
  'skills.json': 'skills',
  'steam-breakdown.json': 'steam-breakdown',
  'structures.json': 'structures',
  'symptoms.json': 'symptoms',
  'talents.json': 'talents',
  'traits.json': 'traits',
  'traumas.json': 'traumas',
  'vehicles.json': 'vehicles',
};

/**
 * CARDINAL ATTENDU par fichier, et TOTAL — mesuré sur l'arbre au moment de l'écriture (2026-08-28).
 * Vérifié AVANT toute écriture : une entrée ajoutée ou retirée depuis fait sortir 1 plutôt que
 * migrer un périmètre qui n'est plus celui qu'on a mesuré.
 */
const CARDINAUX = {
  'careerLevels.json': 432,
  'combat-stakes.json': 35,
  'domains.json': 20,
  'etats.json': 21,
  'flow-stakes.json': 34,
  'maladies.json': 16,
  'maneuvers.json': 20,
  'merchants.json': 6,
  'naval-ports.json': 39,
  'naval-traits.json': 26,
  'pregens.json': 8,
  'props.json': 78,
  'reglesOptionnelles.json': 81,
  'skills.json': 48,
  'steam-breakdown.json': 6,
  'structures.json': 24,
  'symptoms.json': 18,
  'talents.json': 187,
  'traits.json': 131,
  'traumas.json': 29,
  'vehicles.json': 31,
};
const TOTAL_ATTENDU = 1290;

/**
 * PROMOTION DÉCLARÉE de `id` — `<fichier>` → rang qu'y occupait `id` AVANT la vague. L'enveloppe veut
 * `id` en tête ; un seul dataset ne l'y avait pas : `steam-breakdown.json` ouvre ses entrées par la
 * fourchette de tirage (`min`/`max`), `id` venant au rang 2. La suite des autres clés, elle, ne bouge
 * pas d'un cran (vérifié entrée par entrée après écriture). Tout autre fichier dont `id` ne serait pas
 * en tête fait sortir 1.
 */
const ID_PROMU = { 'steam-breakdown.json': 2 };

/** Le SEUL porteur de `desc: ""` que cette vague purge — `<fichier>` → `<id>` (cf. en-tête). */
const DESC_VIDE_PURGEE = { 'talents.json': 'talent-aleatoire' };

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

let descPurgees = 0;

for (const [fichier, type] of Object.entries(TYPES)) {
  const cible = path.join(ROOT, 'src/data', fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const avant = JSON.parse(brut);

  if (JSON.stringify(avant, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }

  const locales = [];
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
    let purge = false;
    if (e.desc === '') {
      if (DESC_VIDE_PURGEE[fichier] !== e.id) {
        locales.push(`${fichier} ${e.id} : \`desc: ""\` sur un porteur NON prévu — arbitrage requis`);
        return e;
      }
      purge = true;
    }
    // ENVELOPPE : `id` en tête, `type` juste après, puis le reste DANS SON ORDRE D'ORIGINE (les clés
    // sont reprises une à une, jamais par un spread qui remonterait `desc` d'un rang).
    if (purge) descPurgees++;
    const sortie = { id: e.id, type };
    for (const [k, v] of Object.entries(e)) {
      if (k === 'id' || k === 'type') continue;
      if (k === 'desc' && purge) continue;
      sortie[k] = v;
    }
    return sortie;
  });

  if (locales.length) {
    echecs.push(...locales);
    continue;
  }

  const sortie = JSON.stringify(apres, null, 2);
  if (sortie === brut) {
    rapport.push(`${fichier} : no-op (déjà migré, ${avant.length} entrée(s))`);
    continue;
  }

  fs.writeFileSync(cible, sortie, 'utf8');

  // PREUVE post-écriture : même cardinal, et chaque entrée est EXACTEMENT l'ancienne PLUS la clé
  // `type` (MOINS la `desc` vide nommément purgée) — deep-equal sur le reste.
  const relu = JSON.parse(fs.readFileSync(cible, 'utf8'));
  if (relu.length !== avant.length) echecs.push(`POST ${fichier} : ${relu.length} entrée(s) ≠ ${avant.length}`);
  for (let i = 0; i < relu.length; i++) {
    const d = relu[i];
    if (Object.keys(d).slice(0, 2).join(',') !== 'id,type') echecs.push(`POST ${fichier} ${d.id} : tête ≠ id,type`);
    if (d.type !== type) echecs.push(`POST ${fichier} ${d.id} : \`type\` ≠ ${JSON.stringify(type)}`);
    const { type: _t, ...sansType } = d;
    const { type: _t0, ...avantSansType } = avant[i];
    if (avantSansType.desc === '') delete avantSansType.desc;
    // Comparaison par CLÉ (jamais par l'ordre sérialisé) : la promotion de `id` en tête réordonne
    // légitimement les entrées de `ID_PROMU`, et l'ordre y est vérifié séparément ci-dessous.
    const paires = (o) => Object.keys(o).sort().map((k) => `${k}=${JSON.stringify(o[k])}`).join('\u0000');
    if (paires(sansType) !== paires(avantSansType)) {
      echecs.push(`POST ${fichier} ${d.id} : la charge utile a été ALTÉRÉE (autre chose que \`type\` a bougé)`);
    }
    // ORDRE : hors `id`/`type`, les clés survivantes gardent leur suite d'ORIGINE.
    const suiteAvant = Object.keys(avantSansType).filter((k) => k !== 'id').join(',');
    const suiteApres = Object.keys(sansType).filter((k) => k !== 'id').join(',');
    if (suiteAvant !== suiteApres) {
      echecs.push(`POST ${fichier} ${d.id} : l'ORDRE des clés a bougé au-delà de la promotion de \`id\` (${suiteAvant} → ${suiteApres})`);
    }
    const rangAvant = Object.keys(avant[i]).indexOf('id');
    if (rangAvant !== 0 && ID_PROMU[fichier] !== rangAvant) {
      echecs.push(`POST ${fichier} ${d.id} : \`id\` était au rang ${rangAvant}, promotion NON déclarée`);
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
console.log(`vague 12 — ${Object.keys(TYPES).length} dataset(s) \`entite\` portent leur \`type\` (${TOTAL_ATTENDU} entrées)`);
console.log(`\`desc: ""\` purgée(s) : ${descPurgees}`);
