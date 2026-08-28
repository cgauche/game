/**
 * Migration #1467 L1b V-FLIP-ENTITE-c — les 12 DERNIERS datasets `entite` reçoivent la clé
 * d'ENVELOPPE `type` sur chacune de leurs entrées, en DEUXIÈME position (juste après `id`).
 *
 * MÊME patron que les vagues 11a/11b/12a (`2026-08-28-l1b-12a-entite-type.mjs`), même contrat :
 * `document()` pose `type: z.literal(<type>)` en clé REQUISE de l'enveloppe, donc l'adoption d'un def
 * et la migration de sa donnée sont indissociables. Rien d'autre ne bouge — à deux exceptions NOMMÉES
 * ci-dessous.
 *
 * ACCORD def ⇄ donnée : le `type` écrit ici est celui que le def déclare à `document()`, et c'est le
 * NOM DE BASE du dataset — la clé que `sans-livre.ts` consulte (`SANS_PROVENANCE_EXIGEE`). L'accord
 * n'est pas gardé par une seconde table mais par le SCHÉMA lui-même : `z.literal(<type>)` rend rouge
 * toute entrée dont le `type` diverge.
 *
 * PURGE NOMMÉE — `species.json › humains-tileens` (rang 4) porte `desc: ""`. L'enveloppe déclare
 * `desc: z.string().min(1)` : la chaîne vide est le TROISIÈME état que la migration
 * `2026-08-27-l1b-3h-desc-null.mjs` a purgé partout où le schéma admettait l'absence, en renvoyant
 * NOMMÉMENT ce porteur-ci. Verbatim de `3h:25-28` : « Les deux autres — `species.json[4]` et
 * `talents.json[0]` — sont déclarés `desc: z.string()` REQUIS […] Ils meurent avec le lot qui posera
 * `min(1)` sur ces deux defs, pas ici. » `talents.json[0]` est mort à la vague 12a ; `species.json[4]`
 * meurt ICI, et le renvoi est soldé. La clé est RETIRÉE (jamais remplie : aucune prose ne s'invente,
 * règle 1).
 * CONSÉQUENCE déclarée : `species` quitte la population MESURÉE avec `desc` REQUISE mais n'exige que
 * `source` — exiger `desc` refuserait cette entrée. L'écart est écrit au def ET au mesureur.
 *
 * PURGE NOMMÉE — `creatures.json › group`. Le def le déclarait `z.string().optional()` ; mesuré
 * 2026-08-28 : 0/490 porteur en donnée, 0 consommateur dans `src`/`scripts`. Il MEURT du def ; la
 * donnée n'ayant aucun porteur, cette migration n'a RIEN à en retirer — un porteur inattendu fait
 * sortir 1 plutôt que le supprimer en silence.
 *
 * PAS DE PURGE DE `creatures.json › title` — la mesure a RÉFUTÉ la prémisse « 437/437 null » :
 * 490/490 porteuses, dont 437 `null` et 53 à valeur RECOPIÉE du livre (« Bandit humain », « Prince
 * démon de Slaanesh »…). Détruire de la donnée sourcée est interdit (règle 5) ; le champ reste TEL
 * QUEL et son absence de lecteur est un ticket (#1541), pas une purge.
 *
 * ENTRÉES : les 12 fichiers de `src/data/` listés dans `TYPES` (seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée qui porte DÉJÀ le bon `type` en 2ᵉ position (et
 * dont la `desc` vide est déjà purgée) est reconnue migrée ; rejouée sur l'état final, la migration
 * n'écrit rien et sort 0.
 * FAIL-FAST : cardinal inattendu (porte de lecture SEULE, avant toute écriture), racine non-tableau,
 * entrée sans `id` de chaîne, `type` déjà présent mais DIVERGENT, `desc: ""` sur un porteur NON prévu,
 * `group` porté par une créature → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Fichier de `src/data/` → `type` du document, tel que son def le déclare à `document()`. */
const TYPES = {
  'actions.json': 'actions',
  'activities.json': 'activities',
  'creatures.json': 'creatures',
  'night-stakes.json': 'night-stakes',
  'psychology.json': 'psychology',
  'raceAppearance.json': 'raceAppearance',
  'roofMaterials.json': 'roofMaterials',
  'species.json': 'species',
  'spells.json': 'spells',
  'structureAppearance.json': 'structureAppearance',
  'tavernGames.json': 'tavernGames',
  'trappings.json': 'trappings',
};

/**
 * CARDINAL ATTENDU par fichier, et TOTAL — mesuré sur l'arbre au moment de l'écriture (2026-08-28).
 * Vérifié AVANT toute écriture : une entrée ajoutée ou retirée depuis fait sortir 1 plutôt que
 * migrer un périmètre qui n'est plus celui qu'on a mesuré.
 */
const CARDINAUX = {
  'actions.json': 55,
  'activities.json': 62,
  'creatures.json': 490,
  'night-stakes.json': 15,
  'psychology.json': 9,
  'raceAppearance.json': 21,
  'roofMaterials.json': 4,
  'species.json': 27,
  'spells.json': 576,
  'structureAppearance.json': 18,
  'tavernGames.json': 13,
  'trappings.json': 440,
};
const TOTAL_ATTENDU = 1730;

/**
 * PROMOTION DÉCLARÉE de `id` — `<fichier>` → rang qu'y occupait `id` AVANT la vague. Mesuré sur
 * TOUTES les entrées des 12 fichiers : AUCUN ne fait exception, `id` ouvre partout. La table reste,
 * vide et nominative : tout fichier dont `id` ne serait pas en tête fait sortir 1.
 */
const ID_PROMU = {};

/** Le SEUL porteur de `desc: ""` que cette vague purge — `<fichier>` → `<id>` (cf. en-tête). */
const DESC_VIDE_PURGEE = { 'species.json': 'humains-tileens' };

/** Champ MORT retiré du def, dont la donnée ne doit porter AUCUNE occurrence (cf. en-tête). */
const CHAMP_MORT = { 'creatures.json': 'group' };

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
    const mort = CHAMP_MORT[fichier];
    if (mort) {
      const porteurs = brut.filter((e) => e && typeof e === 'object' && mort in e).map((e) => e.id);
      if (porteurs.length) ecarts.push(`${fichier} : champ MORT \`${mort}\` porté par ${porteurs.length} entrée(s) — ${porteurs.slice(0, 5).join(', ')}`);
    }
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
    // Comparaison par CLÉ (jamais par l'ordre sérialisé) : la promotion de `id` en tête réordonnerait
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
console.log(`vague 12b — ${Object.keys(TYPES).length} dataset(s) \`entite\` portent leur \`type\` (${TOTAL_ATTENDU} entrées)`);
console.log(`\`desc: ""\` purgée(s) : ${descPurgees}`);
