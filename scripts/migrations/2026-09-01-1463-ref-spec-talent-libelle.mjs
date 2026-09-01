/**
 * Migration L-ref-3 (#1463 / #1646) — une `spec` authorée est un ID, jamais un LIBELLÉ : les 5 refs
 * de Talent qui écrivaient « Odorat » / « Ouïe » / « Vue » prennent les ids `odorat` / `ouie` / `vue`
 * du catalogue `talents.json › sens-aiguise.specs`.
 *
 * DOCTRINE id/label (CLAUDE.md) : « au final ce qu'on manipule c'est des IDs » — le libellé se
 * RÉ-AFFICHE par résolution (`specLabel`, `src/data/index.ts:3323`, qui lit `specs[].label`), il ne
 * se stocke pas dans la donnée. La résolution de ces 5 refs passe par `PairedSense`, pas par
 * `testValue` : l'axe est distinct de celui des Compétences (L2 #1548), la doctrine est la même.
 *
 * CONTRÔLE POSITIF, jamais une table en dur : l'id cible se LIT au catalogue du talent NOMMÉ par la
 * ref (`talentId`), par appariement de son `label` NORMALISÉ (casse + accents, comparaison seule).
 * Un libellé qui n'apparie AUCUNE entrée du catalogue de sa def est laissé TEL QUEL (texte libre
 * d'un domaine ouvert, ou dette de catalogue nominative — `mutations.json › attirant`, catalogue
 * VIDE, #1621).
 *
 * ENTRÉES :
 *  - `src/data/talents.json` — LU seulement (le catalogue des `specs[]`), jamais écrit ;
 *  - `src/data/mutations.json` `[].passive[]` — 4 réécritures attendues ;
 *  - `src/data/spells.json` `[].effects.steps[].effect.ops[]` — 1 réécriture attendue.
 * Cardinal ASSERTÉ 5. Toute ref `{talentId, spec}` des deux documents écrits est VISITÉE, quel que
 * soit son chemin (la forme d'op n'est pas déclarée : elle est mesurée).
 * IDEMPOTENT : rejouée sur l'état final, plus aucun libellé n'apparie — elle n'écrit rien, sort 0.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF), constaté AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CATALOGUE = 'src/data/talents.json';
/** Documents ÉCRITS, avec leur cardinal de réécriture attendu — ASSERTÉ, pas constaté. */
const DOCUMENTS = [['src/data/mutations.json', 4], ['src/data/spells.json', 1]];
const CARDINAL = 5;

/** Normalisation de COMPARAISON seulement (casse + accents) — jamais une conversion de donnée. */
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const talents = JSON.parse(fs.readFileSync(path.join(ROOT, CATALOGUE), 'utf8'));
/** Par id de Talent : les ids valides, et l'index LIBELLÉ normalisé → id. */
const PAR_TALENT = new Map();
for (const t of talents) {
  if (!Array.isArray(t.specs) || t.specs.length === 0) continue;
  PAR_TALENT.set(t.id, {
    ids: new Set(t.specs.map((e) => e.id)),
    parLabel: new Map(t.specs.map((e) => [norm(e.label), e.id])),
  });
}
if (PAR_TALENT.size === 0) {
  console.error(`CATALOGUE VIDE — ${CATALOGUE} ne rend aucun Talent à \`specs[]\` ; AUCUNE écriture.`);
  process.exit(1);
}

/** Toute ref `{talentId, spec}` du document, où qu'elle soit. */
function* refsDeTalent(noeud, chemin) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* refsDeTalent(e, `${chemin}[]`); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  if (typeof noeud.talentId === 'string' && typeof noeud.spec === 'string') yield { noeud, chemin };
  for (const [k, v] of Object.entries(noeud)) yield* refsDeTalent(v, `${chemin}.${k}`);
}

const journal = [];
let total = 0;

for (const [f, attendu] of DOCUMENTS) {
  const abs = path.join(ROOT, f);
  const brut = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(brut);
  if (JSON.stringify(data, null, 2) !== brut) {
    console.error(`FORME NON CANONIQUE — ${f} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
    process.exit(1);
  }
  let vus = 0;
  for (const { noeud, chemin } of refsDeTalent(data, '')) {
    const cat = PAR_TALENT.get(noeud.talentId);
    if (!cat || cat.ids.has(noeud.spec)) continue; // déjà un id, ou catalogue absent/vide (#1621)
    const id = cat.parLabel.get(norm(noeud.spec));
    if (id === undefined) continue; // texte libre d'un domaine ouvert : la migration ne devine pas
    journal.push(`${f} ${chemin} — ${noeud.talentId} « ${noeud.spec} » → ${id}`);
    noeud.spec = id;
    vus++;
  }
  if (vus === 0) continue;
  assert.equal(vus, attendu, `${f} : ${vus} spécs en libellé vues, ${attendu} attendues`);
  total += vus;
  fs.writeFileSync(abs, JSON.stringify(data, null, 2));
}

if (total === 0) {
  console.log('RIEN À FAIRE — aucune `spec` de Talent n’est écrite en libellé de son catalogue.');
  process.exit(0);
}
assert.equal(total, CARDINAL, `cardinal attendu ${CARDINAL} spécs, vu ${total}`);
console.log(`${CARDINAL} spécs de Talent ramenées à leur ID :`);
for (const l of journal) console.log(`  ${l}`);
