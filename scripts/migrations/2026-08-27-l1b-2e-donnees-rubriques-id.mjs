/**
 * Migration #1467 L1b V-P1 (G3) — `donnees.manifest.json` : les 11 rubriques reçoivent leur `id`.
 *
 * MOTIF MESURÉ : `scripts/docs/build-donnees.mjs` BRANCHAIT sur le libellé
 * (`r.label === 'Contenu de campagne / interlude / rencontres'`) pour décider d'imprimer
 * `narratifNote`. C'est une LOGIQUE keyée par un texte d'affichage — CLAUDE.md : « Toute LOGIQUE est
 * keyée par id STABLE — le `label` est de l'AFFICHAGE ». Reformuler ce libellé (une virgule, un
 * accent) éteignait la note SANS UN MOT (MESURÉ : la note entière disparaît du doc généré).
 *
 * DEUX GESTES, un seul motif — l'identité PUIS l'extinction du branchement :
 *  (1) les 11 rubriques reçoivent leur `id` ;
 *  (2) `narratifNote` (scalaire de RACINE, porté par le document entier alors qu'il ne décrit QU'UNE
 *      rubrique) devient le champ `note` DE CETTE RUBRIQUE. Le générateur n'a plus de cas particulier
 *      à connaître : il imprime la `note` de toute rubrique qui en porte une. C'est la forme que le
 *      garde #842 prescrit — « le comportement particulier se déclare en CHAMP sur l'entrée, jamais
 *      en test d'id » — et un `if (r.id === '…')` y aurait été la MÊME faute que le test de libellé,
 *      d'un cran plus stable seulement. Toute rubrique peut désormais porter sa note.
 *
 * SLUGS : kebab-case COURTS, dérivés du sens de la rubrique et non de la ponctuation de son libellé
 * (un slug qui recopierait le libellé rejouerait la même fragilité). Table EXPLICITE ci-dessous,
 * appariée au libellé ATTENDU : si un libellé a bougé, la migration s'arrête au lieu de deviner.
 *
 * ENTRÉES : `src/data/donnees.manifest.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une rubrique portant déjà l'`id` attendu est reconnue
 * migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : compte de rubriques ≠ 11, libellé inconnu de la table, `id` présent mais DIVERGENT de
 * l'attendu, collision d'ids → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/donnees.manifest.json');

/** libellé ATTENDU → `id` de rubrique. L'appariement est explicite : aucun slug n'est dérivé au vol. */
const IDS = new Map([
  ['Personnage — fiche & progression', 'personnage'],
  ['Magie & religion', 'magie-religion'],
  ['Combat & résolution', 'combat'],
  ['Santé — blessures, maladies, corruption', 'sante'],
  ['Objets & équipement', 'objets'],
  ['Bestiaire', 'bestiaire'],
  ['Monde, voyage terrestre & temps', 'monde-voyage'],
  ['Naval & fluvial (*Mer des Griffes* · *Mort sur le Reik*)', 'naval-fluvial'],
  ['Contenu de campagne / interlude / rencontres', 'campagne'],
  ['Rendu / apparence / décor (NON-règles)', 'rendu-apparence'],
  ['Méta', 'meta'],
]);

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/donnees.manifest.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
const migres = [];
const dejaMigres = [];

if (!Array.isArray(data.rubriques) || data.rubriques.length !== IDS.size) {
  echecs.push(`rubriques : ${data.rubriques?.length ?? 'absentes'}, ${IDS.size} attendues — périmètre déplacé`);
}

if (!echecs.length) {
  data.rubriques = data.rubriques.map((r, i) => {
    const attendu = IDS.get(r.label);
    if (!attendu) {
      echecs.push(`rubrique #${i} : libellé ${JSON.stringify(r.label)} inconnu de la table d’ids — arbitrage requis`);
      return r;
    }
    if (r.id !== undefined) {
      if (r.id === attendu) dejaMigres.push(attendu);
      else echecs.push(`rubrique #${i} (${r.label}) : \`id\` = ${JSON.stringify(r.id)} DIVERGENT de l’attendu \`${attendu}\``);
      return r;
    }
    migres.push(attendu);
    // `id` en PREMIÈRE clé — l'identité ouvre l'entrée.
    return { id: attendu, ...r };
  });

  const ids = data.rubriques.map((r) => r.id).filter((v) => typeof v === 'string');
  if (new Set(ids).size !== ids.length) echecs.push(`ids de rubrique en collision : ${ids.join(', ')}`);
}

/** Rubrique à laquelle appartient la note de racine — son SEUL sujet (le bloc `narratif` d'un paquet
 *  de campagne), vérifié au texte avant déplacement. */
const PORTEUSE_DE_LA_NOTE = 'campagne';
let noteDeplacee = false;

if (!echecs.length) {
  const cible = data.rubriques.find((r) => r.id === PORTEUSE_DE_LA_NOTE);
  if (!cible) {
    echecs.push(`rubrique « ${PORTEUSE_DE_LA_NOTE} » introuvable : la note de racine n'a pas de porteuse`);
  } else if (typeof data.narratifNote === 'string') {
    if (cible.note !== undefined) {
      echecs.push(`rubrique « ${PORTEUSE_DE_LA_NOTE} » : porte DÉJÀ une \`note\` alors que \`narratifNote\` existe encore — arbitrage requis`);
    } else {
      // `note` se pose APRÈS `label`, avant la charge utile `entrees` : l'élément est REMPLACÉ
      // (un `Object.assign` laisserait la clé neuve en fin d'objet).
      const { id, label, ...reste } = cible;
      data.rubriques[data.rubriques.indexOf(cible)] = { id, label, note: data.narratifNote, ...reste };
      delete data.narratifNote;
      noteDeplacee = true;
    }
  } else if (data.narratifNote !== undefined) {
    echecs.push(`\`narratifNote\` de forme inattendue ${JSON.stringify(data.narratifNote)} (chaîne attendue)`);
  } else if (typeof cible.note !== 'string' || !cible.note) {
    echecs.push('ni `narratifNote` de racine ni `note` sur la rubrique porteuse — la note est PERDUE');
  }
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(data, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : chaque rubrique porte SON id, et les libellés n'ont pas bougé.
const apres = JSON.parse(out);
const fautifs = apres.rubriques.filter((r) => r.id !== IDS.get(r.label));
const porteuse = apres.rubriques.find((r) => r.id === PORTEUSE_DE_LA_NOTE);
if (fautifs.length || apres.narratifNote !== undefined || !porteuse?.note) {
  console.error(
    `VÉRIFICATION POST-ÉCRITURE ROUGE : ${fautifs.length} id(s) fautif(s) [${fautifs.map((r) => r.label).join(', ')}] ; ` +
      `\`narratifNote\` de racine ${apres.narratifNote === undefined ? 'absente (OK)' : 'ENCORE PRÉSENTE'} ; ` +
      `note portée par « ${PORTEUSE_DE_LA_NOTE} » : ${porteuse?.note ? 'oui' : 'NON'}`,
  );
  process.exit(1);
}

console.log(`donnees.manifest.json — \`id\` de rubrique posé : ${migres.length}`);
for (const r of apres.rubriques) console.log(`  ${r.id.padEnd(18)} ${r.label}`);
console.log(`Déjà migrées (no-op) : ${dejaMigres.length}`);
console.log(`\`narratifNote\` de racine → \`note\` de la rubrique « ${PORTEUSE_DE_LA_NOTE} » : ${noteDeplacee ? 'DÉPLACÉE' : 'déjà en place (no-op)'}`);
console.log(`Rubriques : ${apres.rubriques.length}/${IDS.size} ; ids distincts : ${new Set(apres.rubriques.map((r) => r.id)).size}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/donnees.manifest.json`);
