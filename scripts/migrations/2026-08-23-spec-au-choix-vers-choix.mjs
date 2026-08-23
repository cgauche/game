/**
 * Migration #1456 (L2) — la sentinelle littérale `spec: "au choix"` des `skills[]` du bestiaire
 * devient l'emplacement NON DÉSIGNÉ de la forme UNIQUE de réf de Compétence (`skillRefSchema`,
 * `src/data/schemas/common.ts`, directive utilisateur #1463) : `{ id, choix, value }`.
 *
 * Deux familles, une seule forme :
 *  - CHOIX LIBRE (`choix: true`) — les 53 `spec` sentinelles de `creatures.json` (`LDB 09 l.40`).
 *  - CHOIX BORNÉ (`choix: [ids]`) — la ligne du statbloc imprime un CHOIX énuméré ; chaque entrée de
 *    `BORNES` porte sa citation. Les ids visés doivent EXISTER au catalogue : ceux qui manquent sont
 *    créés par `ADDS`, à leur source (même geste qu'en #1342 L2-b).
 *
 * REJOUABLE : un second passage ne trouve plus rien et ne réécrit aucun fichier (byte-identique).
 * ARRÊT EN 1 avant toute écriture : id de `specOptions` absent du catalogue, collision d'id à l'ajout,
 * nœud sentinelle sans `value`, ou sentinelle restée après la passe. Une entrée de `BORNES` SANS cible
 * est seulement JOURNALISÉE (c'est l'état normal d'un rejeu) — le contrat « plus aucun choix imprimé
 * hors catalogue » est tenu par la garde, `src/data/refs-migrated.test.ts`, pas par ce script.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSentinel, skillArraysOf } from '../data/lib/skillSpecWalk.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = path.join(ROOT, 'src/data');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis ce script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

const BOOK = 'frenchy-bzh';

/** Entrées de catalogue à créer, par id de Compétence — `page` = folio imprimé (« N sur 630 »). */
const ADDS = {
  savoir: [
    { id: 'slaanesh', label: 'Slaanesh', source: { book: BOOK, page: 269, note: 'frenchy.bzh 46 l.110 (Talent) — entrée de Savoir inférée, arbitrage maison #1456' } },
    { id: 'nurgle', label: 'Nurgle', source: { book: BOOK, page: 269, note: 'frenchy.bzh 46 l.110 (Talent) — entrée de Savoir inférée, arbitrage maison #1456' } },
  ],
};

/** Choix ÉNUMÉRÉ imprimé au statbloc → `choix: [ids]`. Clé `"<creatureId>|<skillId>|<spec>"`. */
/* ARBITRAGE MAISON (#1456, règle 7) pour « Divinité » : la ligne de COMPÉTENCE (frenchy.bzh 46 l.37,
 * l.99, l.187 — « Savoir (Divinité) ») ne borne RIEN par elle-même ; c'est la ligne de TALENT du MÊME
 * statbloc (frenchy.bzh 46 l.110 et l.200) qui énumère. L'inférence « la divinité du Savoir est celle
 * du Talent » est NÔTRE, pas celle du livre. */
const BORNES = new Map([
  // frenchy.bzh 29 l.83 « Savoir (Rivières_ou_Chemins) 55 » ; « Rivières » → `voies-fluviales`
  // (MSR 11 l.16 « Savoir (Voies Fluviales) 45 », remap #1342 L2-b) ; « Chemins » → `itineraires`
  // (LDB 08 l.1602 « Savoir (Itinéraires) »).
  ['chef-contrebandier|savoir|Rivières ou Chemins', ['voies-fluviales', 'itineraires']],
  // frenchy.bzh 29 l.115 « Savoir (Rivières_ou_Chemins) 75 »
  ['roi-du-trafic|savoir|Rivières ou Chemins', ['voies-fluviales', 'itineraires']],
  // frenchy.bzh 43 l.95 « Artisanat (Armurier OU Forgeron)  50 »
  ['ungor-adulte|metier|Armurier OU Forgeron', ['armurier', 'forgeron']],
  // frenchy.bzh 46 l.37 « Savoir (Divinité) 55 » ; frenchy.bzh 46 l.110 (Talent) : « Magie des
  // Arcanes (Divinité) … lancer des sorts liés à_UN SEUL_des Dieux Sombres :<br>Tzeentch, Slaanesh
  // ou Nurgle. » — bornage MAISON, cf. l'entête de `BORNES`.
  ['sorcier-du-chaos|savoir|Divinité', ['tzeentch', 'slaanesh', 'nurgle']],
  // frenchy.bzh 46 l.99 « Savoir (Divinité) 75 »
  ['sorcier-du-chaos-terrifiant|savoir|Divinité', ['tzeentch', 'slaanesh', 'nurgle']],
  // frenchy.bzh 46 l.187 « Savoir (Divinité) 95 »
  ['sorcier-du-chaos-effroyable|savoir|Divinité', ['tzeentch', 'slaanesh', 'nurgle']],
]);

const arret = (msg) => { console.error(`ARRÊT — ${msg}`); process.exit(1); };

// -- 1. Catalogue --------------------------------------------------------------------------------
const skillsPath = path.join(DATA_DIR, 'skills.json');
const skills = J(skillsPath);
let ajoutees = 0;
for (const [skillId, entries] of Object.entries(ADDS)) {
  const def = skills.find((s) => s.id === skillId);
  if (!def || !Array.isArray(def.specs)) arret(`${skillId} : pas de specs[] inline dans skills.json.`);
  for (const e of entries) {
    const deja = def.specs.find((s) => (typeof s === 'string' ? s : s.id) === e.id);
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
const IDS = new Map(skills.filter((s) => Array.isArray(s.specs))
  .map((s) => [s.id, new Set(s.specs.map((e) => (typeof e === 'string' ? e : e.id)))]));
for (const [cle, options] of BORNES) {
  const [, skillId] = cle.split('|');
  for (const o of options) {
    if (!IDS.get(skillId)?.has(o)) arret(`${cle} : spécialisation « ${o} » absente de skills.json#${skillId}.specs[].`);
  }
}

// -- 2. Passe de réécriture ----------------------------------------------------------------------
const creaturesPath = path.join(DATA_DIR, 'creatures.json');
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

// -- 3. Contre-mesures AVANT écriture ------------------------------------------------------------
const restantes = [];
for (const entry of creatures) {
  for (const arr of skillArraysOf(entry)) {
    for (const node of arr) {
      if (node && typeof node.spec === 'string' && isSentinel(node.spec)) restantes.push(`${entry.id} : ${node.id}/${JSON.stringify(node.spec)}`);
    }
  }
}
if (restantes.length) arret(`sentinelle(s) restée(s) dans creatures.json :\n  ${restantes.join('\n  ')}`);

const ecrits = [];
if (jokers.length || bornes.length) { fs.writeFileSync(creaturesPath, serializeDataset(creatures), 'utf8'); ecrits.push('creatures.json'); }
if (ajoutees) { fs.writeFileSync(skillsPath, serializeDataset(skills), 'utf8'); ecrits.push('skills.json'); }

// -- 4. Rendu ------------------------------------------------------------------------------------
console.log(`Entrées de catalogue ajoutées à skills.json : ${ajoutees}`);
console.log(`Choix LIBRES posés (sentinelle → choix:true) : ${jokers.length}`);
for (const j of jokers) console.log(`  ${j}`);
console.log(`Choix BORNÉS posés (choix:[ids]) : ${bornes.length} / ${BORNES.size} attendus`);
for (const b of bornes) console.log(`  ${b}`);
const nonVues = [...BORNES.keys()].filter((k) => !vues.has(k));
if (nonVues.length) console.log(`Entrées de BORNES sans cible dans l'arbre (déjà migrées) :\n  ${nonVues.join('\n  ')}`);
console.log(`Fichiers réécrits : ${ecrits.join(', ') || '(aucun — rejeu)'}`);
