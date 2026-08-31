/**
 * Migration L2 #1548 (sœur de `2026-08-30-test-de-caracteristique-hors-competence.mjs`) — une
 * référence de Spécialisation écrite en LIBELLÉ FR au lieu de son id de catalogue.
 *
 * PÉRIMÈTRE EN DEUX TEMPS, sous UN seul script idempotent : les Compétences (2026-08-30, la date du
 * nom de fichier = celle de l'ouverture) puis les Talents (2026-08-31, commit 4 — même mesure, cf.
 * « ENTRÉE » ci-dessous). Rejouée à n'importe quel moment, elle couvre les deux et n'écrit rien.
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
 * def (`skillId` / `skill` de chaîne / `id` du nœud porteur) est une entrée du catalogue de son CHAMP
 * PORTEUR — `skills.json` sous un champ `skills` (ou une clé qualifiée `skillId`/`skill`),
 * `talents.json` sous un champ `talents` (L2 #1548 commit 4 : la même mesure vaut pour la spéc d'un
 * Talent, dont `talentConcrete`/`matchApplies` appareillent l'id, jamais le libellé).
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

const ambigus = [];
/** Par id de def : les ids valides, et l'index LIBELLÉ normalisé → id (ambigus écartés). */
function catalogueDe(fichier) {
  const index = new Map();
  for (const d of JSON.parse(fs.readFileSync(path.join(DATA, fichier), 'utf8'))) {
    const entrees = (d.specs ?? []).map((e) => (typeof e === 'string' ? { id: e, label: e } : e));
    const parLabel = new Map();
    for (const e of entrees) {
      const cle = norm(e.label ?? e.id);
      if (parLabel.has(cle) && parLabel.get(cle) !== e.id) ambigus.push(`${fichier} ${d.id} : « ${e.label} » → ${parLabel.get(cle)} | ${e.id}`);
      else parLabel.set(cle, e.id);
    }
    index.set(d.id, { ids: new Set(entrees.map((e) => e.id)), parLabel });
  }
  return index;
}
/** Les deux catalogues de spécialisation, choisis par le CHAMP PORTEUR du nœud (`skills`/`talents`) :
 *  un même id vit dans les deux datasets (`art`, `resistance`…) — un catalogue unique appareillerait
 *  la spéc d'un Talent au pool de la Compétence homonyme. */
const CATALOGUES = { skills: catalogueDe('skills.json'), talents: catalogueDe('talents.json') };
if (ambigus.length) {
  console.error(`ARBITRAGE REQUIS — libellé(s) de spéc AMBIGU(s), AUCUNE écriture :`);
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
  const walk = (n, porteur) => {
    if (Array.isArray(n)) { n.forEach((x) => walk(x, porteur)); return; }
    if (!n || typeof n !== 'object') return;
    const id = cleDeDef(n);
    const cible = typeof n.skillId === 'string' || typeof n.skill === 'string' ? 'skills' : porteur;
    const CATALOGUE = CATALOGUES[cible];
    if (CATALOGUE && id && typeof n.spec === 'string' && CATALOGUE.has(id)) {
      const cat = CATALOGUE.get(id);
      if (!cat.ids.has(n.spec)) {
        const attendu = cat.parLabel.get(norm(n.spec));
        if (attendu) { touches.push(`${cible} ${id}: « ${n.spec} » → ${attendu}`); n.spec = attendu; }
      }
    }
    for (const [k, v] of Object.entries(n)) walk(v, k === 'skills' || k === 'talents' ? k : (k === 'of' ? porteur : (Array.isArray(v) ? null : porteur)));
  };
  walk(data, 'skills');
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
