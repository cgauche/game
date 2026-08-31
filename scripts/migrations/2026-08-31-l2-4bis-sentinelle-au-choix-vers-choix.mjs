/**
 * Migration L2 #1548 (commit 4bis) — la SENTINELLE LITTÉRALE `spec: "au choix"` MEURT sur le concept
 * COMPÉTENCE : un emplacement de spécialisation NON DÉSIGNÉ s'écrit `choix` (`ref.ts#refOuSpec`,
 * grammaire posée au commit 4), jamais une chaîne qu'aucun catalogue ne résout.
 *
 * Deux régimes, une seule forme (`LDB 09 l.40`) :
 *  - CHOIX LIBRE `choix: true` — la ligne imprime « (au choix) » sans borner.
 *  - CHOIX BORNÉ `choix: [ids]` — la ligne ÉNUMÈRE ; chaque entrée de `BORNES` porte sa citation
 *    verbatim au `Source/`. Les ids visés doivent EXISTER au catalogue : ceux qui manquent sont
 *    créés par `ADDS`, à leur source.
 *
 * PÉRIMÈTRE = le concept Compétence, sur ses porteurs de sentinelle mesurés le 2026-08-31 :
 *  - `creatures.json › skills[]` : 53 sentinelles + les 6 choix imprimés de `BORNES` ;
 *  - `talents.json › passive[] {op:'grantCareerSkill'} › skill` : 2 sentinelles (Art, Métier).
 * PORTEURS DE SENTINELLE QUI RESTENT, ET LA MESURE QUI LES EXCLUT : ceux dont la réf est une réf de
 * TALENT (12 dans `creatures.json › talents[]`, 1 dans `stars.json › ops[] {op:'grantTalent'}`).
 * `talentRefSchema` (`schemas/grammaire/reference.ts`) est un `strictObject` sans `choix` ; l'adopter
 * exigerait `refOuSpec('talent')`, dont le pool est FERMÉ : 117 spécs de Talent de créature seraient
 * refusées au parse (24 sur une entrée sans catalogue + 93 hors pool, mesuré 2026-08-31). Le concept
 * Talent est loté L3 (#1463).
 *
 * ENTRÉES : `src/data/skills.json` (catalogue de spécialisations), `src/data/creatures.json`,
 * `src/data/talents.json`. Aucun autre fichier n'est lu.
 * REJOUABLE : un second passage ne trouve plus rien et n'écrit aucun fichier (byte-identique).
 * ARRÊT EN 1 AVANT TOUTE ÉCRITURE : id de `BORNES` absent du catalogue, collision d'id à l'ajout,
 * nœud sentinelle sans valeur imprimée, ou sentinelle de Compétence restée après la passe.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)`, reflet de `src/data/serialize.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSentinel, skillArraysOf } from '../data/lib/skillSpecWalk.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = path.join(ROOT, 'src/data');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis un script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

const BOOK = 'frenchy-bzh';

/**
 * Entrées de catalogue à créer, par id de Compétence. `pool: false` : attestées, non PROPOSÉES
 * d'office (même régime que `tzeentch`, déjà au catalogue) — `LDB 09 l.40`.
 */
const ADDS = {
  savoir: [
    { id: 'slaanesh', label: 'Slaanesh', source: { book: BOOK, page: 269, note: 'frenchy.bzh 46 l.110' }, pool: false },
    { id: 'nurgle', label: 'Nurgle', source: { book: BOOK, page: 269, note: 'frenchy.bzh 46 l.110' }, pool: false },
  ],
};

/**
 * Choix ÉNUMÉRÉ imprimé au statbloc → `choix: [ids]`. Clé `"<creatureId>|<skillId>|<spec>"`.
 *
 * PROVENANCE DE CHAQUE BORNE : « Rivières ou Chemins » et « Armurier OU Forgeron » sont ÉNUMÉRÉS par
 * la ligne de Compétence elle-même. « Divinité » ne l'est pas : la borne des trois Dieux Sombres est
 * LUE SUR LA LIGNE DE TALENT du même statbloc (frenchy.bzh 46 l.110) et reportée sur le Savoir — un
 * report de NOTRE fait, que le livre n'écrit pas.
 */
const BORNES = new Map([
  // frenchy.bzh 29 l.83 « Savoir (Rivières_ou_Chemins) 55 » ; « Rivières » → `voies-fluviales`
  // (remap #1342 L2-b), « Chemins » → `itineraires` (LDB 08 l.1602 « Savoir (Itinéraires) »).
  ['chef-contrebandier|savoir|Rivières ou Chemins', ['voies-fluviales', 'itineraires']],
  // frenchy.bzh 29 l.115 « Savoir (Rivières_ou_Chemins) 75 »
  ['roi-du-trafic|savoir|Rivières ou Chemins', ['voies-fluviales', 'itineraires']],
  // frenchy.bzh 43 l.95 « Artisanat (Armurier OU Forgeron)  50 »
  ['ungor-adulte|metier|Armurier OU Forgeron', ['armurier', 'forgeron']],
  // frenchy.bzh 46 l.37 « Savoir (Divinité) 55 » ; frenchy.bzh 46 l.110 (Talent) : « Magie des
  // Arcanes (Divinité) … lancer des sorts liés à_UN SEUL_des Dieux Sombres :<br>Tzeentch, Slaanesh
  // ou Nurgle. » — report depuis la ligne de Talent, cf. l'entête de `BORNES`.
  ['sorcier-du-chaos|savoir|Divinité', ['tzeentch', 'slaanesh', 'nurgle']],
  // frenchy.bzh 46 l.99 « Savoir (Divinité) 75 »
  ['sorcier-du-chaos-terrifiant|savoir|Divinité', ['tzeentch', 'slaanesh', 'nurgle']],
  // frenchy.bzh 46 l.187 « Savoir (Divinité) 95 »
  ['sorcier-du-chaos-effroyable|savoir|Divinité', ['tzeentch', 'slaanesh', 'nurgle']],
]);

const arret = (msg) => { console.error(`ARRÊT — ${msg}`); process.exit(1); };

// -- 1. Catalogue ----------------------------------------------------------------------------------
const skillsPath = path.join(DATA, 'skills.json');
const skills = J(skillsPath);
const specEntryId = (e) => (typeof e === 'string' ? e : e.id);
let ajoutees = 0;
for (const [skillId, entries] of Object.entries(ADDS)) {
  const def = skills.find((s) => s.id === skillId);
  if (!def || !Array.isArray(def.specs)) arret(`${skillId} : pas de specs[] inline dans skills.json.`);
  for (const e of entries) {
    const deja = def.specs.find((s) => specEntryId(s) === e.id);
    if (deja) {
      const label = typeof deja === 'string' ? deja : deja.label;
      if (label !== e.label) arret(`collision d'id ${skillId}/${e.id} : catalogue « ${label} » vs ajout « ${e.label} ».`);
      continue;
    }
    def.specs.push(e);
    ajoutees++;
  }
}

/** Ids de spécialisation connus, par Compétence (après ajouts). */
const IDS = new Map(skills.filter((s) => Array.isArray(s.specs)).map((s) => [s.id, new Set(s.specs.map(specEntryId))]));
for (const [cle, options] of BORNES) {
  const [, skillId] = cle.split('|');
  for (const o of options) {
    if (!IDS.get(skillId)?.has(o)) arret(`${cle} : spécialisation « ${o} » absente de skills.json#${skillId}.specs[].`);
  }
}

// -- 2. Passe de réécriture — bestiaire -------------------------------------------------------------
const creaturesPath = path.join(DATA, 'creatures.json');
const creatures = J(creaturesPath);
const jokers = [];
const bornes = [];
const vues = new Set();

for (const entry of creatures) {
  for (const arr of skillArraysOf(entry)) {
    arr.forEach((node, i) => {
      if (!node || typeof node !== 'object' || typeof node.id !== 'string' || typeof node.spec !== 'string') return;
      const cle = `${entry.id}|${node.id}|${node.spec}`;
      const options = BORNES.get(cle);
      if (!options && !isSentinel(node.spec)) return;
      if (typeof node.value !== 'number') arret(`${cle} : nœud sans valeur imprimée.`);
      arr[i] = { id: node.id, choix: options ?? true, value: node.value };
      if (options) { bornes.push(`${cle} → [${options.join(', ')}]`); vues.add(cle); }
      else jokers.push(`${entry.id} : ${node.id} ${node.value}`);
    });
  }
}

// -- 3. Passe de réécriture — op `grantCareerSkill` des Talents -------------------------------------
const talentsPath = path.join(DATA, 'talents.json');
const talents = J(talentsPath);
const ops = [];
for (const t of talents) {
  for (const op of t.passive ?? []) {
    const sk = op?.op === 'grantCareerSkill' ? op.skill : null;
    if (!sk || typeof sk.spec !== 'string' || !isSentinel(sk.spec)) continue;
    delete sk.spec;
    sk.choix = true;
    ops.push(`${t.id} : grantCareerSkill ${sk.id}`);
  }
}

// -- 4. Contre-mesures AVANT écriture ---------------------------------------------------------------
const restantes = [];
for (const entry of creatures) {
  for (const arr of skillArraysOf(entry)) {
    for (const node of arr) {
      if (node && typeof node.spec === 'string' && isSentinel(node.spec)) restantes.push(`creatures ${entry.id} : ${node.id}/${JSON.stringify(node.spec)}`);
    }
  }
}
for (const t of talents) {
  for (const op of t.passive ?? []) {
    const sk = op?.op === 'grantCareerSkill' ? op.skill : null;
    if (sk && typeof sk.spec === 'string' && isSentinel(sk.spec)) restantes.push(`talents ${t.id} : ${sk.id}/${JSON.stringify(sk.spec)}`);
  }
}
if (restantes.length) arret(`sentinelle(s) de COMPÉTENCE restée(s) :\n  ${restantes.join('\n  ')}`);

const ecrits = [];
if (jokers.length || bornes.length) { fs.writeFileSync(creaturesPath, serializeDataset(creatures), 'utf8'); ecrits.push('creatures.json'); }
if (ops.length) { fs.writeFileSync(talentsPath, serializeDataset(talents), 'utf8'); ecrits.push('talents.json'); }
if (ajoutees) { fs.writeFileSync(skillsPath, serializeDataset(skills), 'utf8'); ecrits.push('skills.json'); }

// -- 5. Rendu ---------------------------------------------------------------------------------------
console.log(`Entrées de catalogue ajoutées à skills.json : ${ajoutees}`);
console.log(`Choix LIBRES posés (sentinelle → choix:true) — bestiaire : ${jokers.length}`);
for (const j of jokers) console.log(`  ${j}`);
console.log(`Choix BORNÉS posés (choix:[ids]) : ${bornes.length} / ${BORNES.size} attendus`);
for (const b of bornes) console.log(`  ${b}`);
console.log(`Ops grantCareerSkill migrées : ${ops.length}`);
for (const o of ops) console.log(`  ${o}`);
const nonVues = [...BORNES.keys()].filter((k) => !vues.has(k));
if (nonVues.length) console.log(`Entrées de BORNES sans cible dans l'arbre (déjà migrées) :\n  ${nonVues.join('\n  ')}`);
console.log(`Fichiers réécrits : ${ecrits.join(', ') || '(aucun — rejeu)'}`);
