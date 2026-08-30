/**
 * Migration L2 #1548 (sœur de `2026-08-30-test-de-caracteristique-hors-competence.mjs`) — une
 * référence de Spécialisation écrite en LIBELLÉ FR au lieu de son id de catalogue.
 *
 * MESURE : `testValue` (`src/engine/skills.ts:76`) apparie la spéc possédée par ÉGALITÉ STRICTE
 * (`s.spec === spec`) ; les Compétences possédées portent l'id (`skills.json › metier.specs[]` =
 * `{ id: "ingenieur", label: "Ingénieur" }`). Une `spec` en libellé n'apparie donc AUCUNE instance :
 * le Test retombe sur la Caractéristique de repli et les avances sont perdues.
 * Doctrine id/label (CLAUDE.md) : le libellé reste au `label` et dans la prose verbatim des `desc`
 * (`steam-breakdown.json` cite « un Test de Métier (Ingénieur) », MDG 12 / MSRC 10) ; ce qui est
 * MANIPULÉ est l'id.
 *
 * ENTRÉE : tous les `src/data/**.json` (walk), tout nœud portant une `spec` de chaîne dont la clé de
 * Compétence (`skillId` / `skill` de chaîne / `id` du nœud porteur) est une entrée de `skills.json`.
 * FAIL-FAST : `spec` ni id du catalogue ni libellé connu → laissée INTACTE (texte libre authoré) ;
 * libellé AMBIGU (deux entrées de même libellé normalisé) → aucune écriture, sortie 1.
 * IDEMPOTENT : rejouée, elle n'écrit rien. FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié
 * canonique AVANT toute écriture du fichier concerné.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = path.join(ROOT, 'src/data');

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const skills = JSON.parse(fs.readFileSync(path.join(DATA, 'skills.json'), 'utf8'));
/** Par id de Compétence : les ids valides, et l'index LIBELLÉ normalisé → id (ambigus écartés). */
const CATALOGUE = new Map();
const ambigus = [];
for (const s of skills) {
  const entrees = (s.specs ?? []).map((e) => (typeof e === 'string' ? { id: e, label: e } : e));
  const parLabel = new Map();
  for (const e of entrees) {
    const cle = norm(e.label ?? e.id);
    if (parLabel.has(cle) && parLabel.get(cle) !== e.id) ambigus.push(`${s.id} : « ${e.label} » → ${parLabel.get(cle)} | ${e.id}`);
    else parLabel.set(cle, e.id);
  }
  CATALOGUE.set(s.id, { ids: new Set(entrees.map((e) => e.id)), parLabel });
}
if (ambigus.length) {
  console.error(`ARBITRAGE REQUIS — libellé(s) de spéc AMBIGU(s) dans skills.json, AUCUNE écriture :`);
  for (const a of ambigus) console.error(`  ${a}`);
  process.exit(1);
}

const fichiers = [];
const collecter = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) collecter(abs);
    else if (e.name.endsWith('.json')) fichiers.push(abs);
  }
};
collecter(DATA);

/** Un nœud-objet porte une réf de Compétence si sa clé de def se lit sur un champ QUALIFIÉ
 *  (`skillId`, `skill` de chaîne) ou, à défaut, sur son propre `id` (composition plate
 *  `{ id, spec }` du champ `skill` emboîté, lot 3b). */
const cleDeDef = (n) =>
  (typeof n.skillId === 'string' && n.skillId) || (typeof n.skill === 'string' && n.skill) || (typeof n.id === 'string' && n.id) || null;

let corriges = 0;
const parFichier = new Map();
for (const abs of fichiers) {
  const brut = fs.readFileSync(abs, 'utf8');
  let data;
  try { data = JSON.parse(brut); } catch { continue; }
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const touches = [];
  const walk = (n) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== 'object') return;
    const id = cleDeDef(n);
    if (id && typeof n.spec === 'string' && CATALOGUE.has(id)) {
      const cat = CATALOGUE.get(id);
      if (!cat.ids.has(n.spec)) {
        const attendu = cat.parLabel.get(norm(n.spec));
        if (attendu) { touches.push(`${id}: « ${n.spec} » → ${attendu}`); n.spec = attendu; }
      }
    }
    for (const v of Object.values(n)) walk(v);
  };
  walk(data);
  if (!touches.length) continue;
  if (JSON.stringify(data, null, 2) === brut) continue; // rien n'a bougé au texte
  if (brut !== JSON.stringify(JSON.parse(brut), null, 2)) {
    console.error(`FORME NON CANONIQUE — ${rel} ; AUCUNE écriture.`);
    process.exit(1);
  }
  const out = JSON.stringify(data, null, 2);
  if (out.includes('\r')) { console.error(`${rel} : \\r dans le texte réécrit ; AUCUNE écriture.`); process.exit(1); }
  fs.writeFileSync(abs, out, 'utf8');
  parFichier.set(rel, touches);
  corriges += touches.length;
}

if (!parFichier.size) console.log(`${fichiers.length} fichier(s) scanné(s) — INCHANGÉ (no-op byte-identique).`);
for (const [rel, touches] of parFichier) console.log(`${rel} — ${touches.length} spéc(s) remise(s) en id : ${touches.join(' ; ')} ; réécrit.`);
console.log(`TOTAL : ${corriges} référence(s) de Spécialisation ramenée(s) du LIBELLÉ à l'id de catalogue.`);
