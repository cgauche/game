/**
 * Migration #1686 LOT 1 — l'HOMONYME `ardoise` reçoit des ids COMPOSÉS par domaine :
 * `roofMaterials.json` `ardoise` → `toit-ardoise`, `propMaterials.json` `ardoise` → `prop-ardoise`.
 *
 * Deux catalogues de matières portaient le MÊME id pour deux entrées différentes (une couverture de
 * toit à quatre teintes de pente, une matière de décor à couleur + réponse à la lumière). L'identité
 * d'une matière est le couple (domaine, id) ; l'id composé la rend lisible dans UN espace de noms, ce
 * que la fusion des catalogues de matières exige (#1686 lot 2). Une seule graphie par matière : les
 * deux entrées gardent leur `label` « Ardoise », qui seul s'affiche.
 *
 * Le RENDU est INCHANGÉ : les deux entrées gardent toutes leurs autres clés, et chaque référence est
 * réécrite vers l'entrée de SON domaine (une masse de toit vers la couverture, une primitive de
 * recette volumique vers la matière de décor).
 *
 * Entrées : `src/data/roofMaterials.json`, `src/data/propMaterials.json`, `src/data/props.json`
 * (primitives de recette volumique) et `src/scenes/<c>/<c>-projet.json` (masses de toit) — tous lus
 * et écrits.
 *
 * CARDINAUX ATTENDUS, mesurés sur l'arbre au moment de l'écriture (2026-09-05) : 1 entrée de
 * `roofMaterials`, 1 de `propMaterials`, 2 primitives de `props.json`, 3 masses de toit
 * (`arene-projet.json`). Un écart fait sortir 1 AVANT toute écriture.
 * MARQUEUR D'IDEMPOTENCE : l'id des deux entrées de catalogue. Rejouée sur l'arbre migré, la
 * migration n'écrit rien et sort 0.
 * FAIL-FAST : id ni initial ni final, porteur d'une référence `ardoise` qui n'est ni une masse de
 * toit ni une primitive de recette, cardinal inattendu, formatage non canonique → rien n'est écrit.
 * FORMATAGE PRÉSERVÉ : `src/data/*.json` est `JSON.stringify(doc, null, 2)` (sans saut final), un
 * document de projet est `JSON.stringify(doc, null, 1) + '\n'` — vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-05-1686-ardoise-ids-composes';

const NU = 'ardoise';
const TOIT = 'toit-ardoise';
const DECOR = 'prop-ardoise';
/** Cardinaux mesurés (2026-09-05) — porte d'identité du périmètre, jamais une estimation. */
const ATTENDU = { catalogueToit: 1, catalogueDecor: 1, primitives: 2, masses: 3 };

const echec = (m) => {
  console.error(`[${NOM}] ${m}`);
  process.exit(1);
};

/** Lit un JSON en exigeant sa forme canonique (`indent` espaces, `nl` = saut final). */
function lire(rel, indent, nl) {
  const cible = path.join(ROOT, rel);
  const brut = fs.readFileSync(cible, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== JSON.stringify(doc, null, indent) + (nl ? '\n' : '')) echec(`${rel} : formatage non canonique en entrée`);
  return { cible, rel, brut, doc, indent, nl };
}

const catalogues = [
  { ...lire('src/data/roofMaterials.json', 2, false), apres: TOIT, compte: 'catalogueToit' },
  { ...lire('src/data/propMaterials.json', 2, false), apres: DECOR, compte: 'catalogueDecor' },
];
const props = lire('src/data/props.json', 2, false);
const projets = fs
  .readdirSync(path.join(ROOT, 'src/scenes'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `src/scenes/${d.name}/${d.name}-projet.json`)
  .filter((rel) => fs.existsSync(path.join(ROOT, rel)))
  .map((rel) => lire(rel, 1, true));

// ── PORTE DE LECTURE — cardinaux et états admis, avant toute écriture ────────────────────────────
const mesure = { catalogueToit: 0, catalogueDecor: 0, primitives: 0, masses: 0 };
const dejaFait = { catalogueToit: 0, catalogueDecor: 0, primitives: 0, masses: 0 };

for (const cat of catalogues) {
  if (!Array.isArray(cat.doc)) echec(`${cat.rel} : racine non-TABLEAU`);
  for (const e of cat.doc) {
    if (e?.id === NU) mesure[cat.compte]++;
    else if (e?.id === cat.apres) dejaFait[cat.compte]++;
  }
}

/** Toutes les primitives de recette volumique du catalogue de décor. */
const primitives = props.doc.flatMap((p) => p?.volume?.primitives ?? []);
for (const prim of primitives) {
  if (prim?.material === NU) mesure.primitives++;
  else if (prim?.material === DECOR) dejaFait.primitives++;
}

/** Toutes les masses de toit des documents de projet (`scenes[].architecture[].masses[]`). */
const masses = projets.flatMap((p) =>
  (p.doc?.scenes ?? []).flatMap((s) => (s?.architecture ?? []).flatMap((b) => b?.masses ?? [])),
);
for (const m of masses) {
  if (m?.material === NU) mesure.masses++;
  else if (m?.material === TOIT) dejaFait.masses++;
}

/** Aucune AUTRE clé `material` du périmètre ne doit porter l'id nu — sinon un porteur non prévu existe. */
const restes = [];
const scanne = (noeud, chemin, connus) => {
  if (Array.isArray(noeud)) noeud.forEach((v, i) => scanne(v, `${chemin}[${i}]`, connus));
  else if (noeud && typeof noeud === 'object') {
    if (noeud.material === NU && !connus.has(noeud)) restes.push(chemin);
    for (const [k, v] of Object.entries(noeud)) scanne(v, `${chemin}.${k}`, connus);
  }
};
const connus = new Set([...primitives, ...masses]);
scanne(props.doc, props.rel, connus);
for (const p of projets) scanne(p.doc, p.rel, connus);
if (restes.length) echec(`référence \`${NU}\` hors masse de toit / primitive de recette : ${restes.join(', ')}`);

const total = (t) => t.catalogueToit + t.catalogueDecor + t.primitives + t.masses;
if (total(mesure) === 0) {
  for (const [k, n] of Object.entries(ATTENDU))
    if (dejaFait[k] !== n) echec(`déjà migrée en apparence, mais ${k} = ${dejaFait[k]} ≠ ${n}`);
  console.log(`[${NOM}] déjà migrée — rien à écrire`);
  process.exit(0);
}
for (const [k, n] of Object.entries(ATTENDU))
  if (mesure[k] !== n) echec(`${k} : ${mesure[k]} occurrence(s) de \`${NU}\` ≠ ${n} attendue(s)`);

// ── ÉCRITURE ────────────────────────────────────────────────────────────────────────────────────
for (const cat of catalogues) for (const e of cat.doc) if (e.id === NU) e.id = cat.apres;
for (const prim of primitives) if (prim.material === NU) prim.material = DECOR;
for (const m of masses) if (m.material === NU) m.material = TOIT;

for (const f of [...catalogues, props, ...projets])
  fs.writeFileSync(f.cible, JSON.stringify(f.doc, null, f.indent) + (f.nl ? '\n' : ''), 'utf8');

// ── PREUVE POST-ÉCRITURE — 0 id nu, cardinaux composés atteints ─────────────────────────────────
const apres = { catalogueToit: 0, catalogueDecor: 0, primitives: 0, masses: 0 };
const nus = [];
for (const f of [...catalogues, props, ...projets]) {
  const doc = JSON.parse(fs.readFileSync(f.cible, 'utf8'));
  const compte = (noeud) => {
    if (Array.isArray(noeud)) noeud.forEach(compte);
    else if (noeud && typeof noeud === 'object') {
      if (noeud.id === NU || noeud.material === NU) nus.push(f.rel);
      if (noeud.id === TOIT) apres.catalogueToit++;
      if (noeud.id === DECOR) apres.catalogueDecor++;
      if (noeud.material === DECOR) apres.primitives++;
      if (noeud.material === TOIT) apres.masses++;
      Object.values(noeud).forEach(compte);
    }
  };
  compte(doc);
}
const ecarts = Object.entries(ATTENDU).filter(([k, n]) => apres[k] !== n).map(([k, n]) => `${k} ${apres[k]} ≠ ${n}`);
if (nus.length) ecarts.push(`id nu \`${NU}\` encore présent : ${[...new Set(nus)].join(', ')}`);
if (ecarts.length) {
  console.error(`[${NOM}] ÉCHEC POST-ÉCRITURE : ${ecarts.join(' ; ')}`);
  process.exit(1);
}

console.log(
  `[${NOM}] migré — ${apres.catalogueToit} entrée ${NU}→${TOIT} + ${apres.masses} masse(s) de toit, ` +
    `${apres.catalogueDecor} entrée ${NU}→${DECOR} + ${apres.primitives} primitive(s) de recette`,
);
