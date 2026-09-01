/**
 * Migration L2 #1548 (commit 4) — l'AVANCEMENT parle la grammaire de référence.
 *
 * Les quatre graphies enveloppantes du champ d'avancement (`skills`/`talents` de
 * `careerLevels.json` et `species.json`) tombent sur les fabriques de `schemas/grammaire/ref.ts` :
 *
 *   `{ ref: { id } }`                          → `{ id }`
 *   `{ ref: { id, spec } }`                    → `{ id, spec }`
 *   `{ wildcard: { id } }`                     → `{ id, choix: true }`
 *   `{ wildcard: { id }, specOptions: [...] }` → `{ id, choix: [ids] }`
 *   `{ choice: [...] }`                        → `{ pick: 1, of: [...] }`  (branches migrées de même)
 *   `{ random: n }`                            → INCHANGÉ (sa cible `{pick, table}` est le lot L4)
 *
 * `spec` et `specOptions` sont ramenés à l'ID de catalogue : la liste d'un Niveau de Carrière ou
 * d'un clan imprime le LIBELLÉ du groupe (« Savoir-vivre (Guilde) »), et une valeur en libellé
 * n'apparie aucune spéc possédée (`testValue`, `src/engine/skills.ts`) ni le pool fermé des Talents.
 * Deux voies, dans cet ordre : l'id littéral (déjà migré), puis le LIBELLÉ NORMALISÉ du catalogue.
 * Restent les formes que le livre imprime au SINGULIER alors que le catalogue porte le groupe au
 * pluriel : elles sont NOMMÉES ci-dessous, chacune avec les deux réfs RAW qui attestent que les deux
 * graphies désignent le même groupe. Toute autre valeur non résolue est un ARRÊT (exit 1), jamais
 * une devinette.
 *
 * ENTRÉES : `src/data/skills.json`, `src/data/talents.json` (catalogues de spécialisation),
 * `src/data/careerLevels.json`, `src/data/species.json` (documents migrés).
 * IDEMPOTENT : rejouée, elle n'écrit rien. FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié
 * canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = path.join(ROOT, 'src/data');

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Graphies SINGULIÈRES imprimées par une liste de Carrière/de clan pour un groupe que le catalogue
 * porte au PLURIEL. Chaque entrée cite la ligne qui l'imprime ET la ligne du catalogue.
 * @type {Record<string, string>}
 */
const SINGULIERS = {
  // « Savoir-vivre (Érudit) » LDB 08 l.2017 ⇄ « Savoir-vivre (Érudits) » LDB 08 l.2090, LDB 10 l.1071
  'savoir-vivre|erudit': 'erudits',
  // « Savoir-vivre (Soldat) » ADE I 02 l.265 ⇄ « Savoir-vivre (Soldats) » LDB 08 l.547, LDB 10 l.1071
  'savoir-vivre|soldat': 'soldats',
  // « Savoir-vivre (Guilde) » ADE I 02 l.268, MDG 09 l.494 ⇄ « Guildes » LDB 10 l.1071
  'savoir-vivre|guilde': 'guildes',
  // « Savoir-vivre (Criminel ou Guilde) » ADE I 02 l.272 ⇄ « Criminels » LDB 08 l.2576, LDB 10 l.1071
  'savoir-vivre|criminel': 'criminels',
};

const lire = (f) => {
  const abs = path.join(DATA, f);
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== JSON.stringify(doc, null, 2)) {
    console.error(`FORME NON CANONIQUE — src/data/${f} ; AUCUNE écriture.`);
    process.exit(1);
  }
  return { abs, brut, doc };
};

/** Index `id de def → { ids, parLabel }` d'un catalogue (`skills.json` / `talents.json`). */
function catalogue(fichier) {
  const { doc } = lire(fichier);
  const index = new Map();
  for (const d of doc) {
    const parLabel = new Map();
    for (const e of d.specs ?? []) parLabel.set(norm(e.label ?? e.id), e.id);
    index.set(d.id, { ids: new Set((d.specs ?? []).map((e) => e.id)), parLabel });
  }
  return index;
}

const CATALOGUES = { skills: catalogue('skills.json'), talents: catalogue('talents.json') };

const arrets = [];

/** Ramène une `spec`/une option de `specOptions` à son ID de catalogue. */
function idDeSpec(champ, defId, valeur, ou) {
  const cat = CATALOGUES[champ].get(defId);
  if (!cat) { arrets.push(`${ou} : def « ${defId} » absente de ${champ}.json`); return valeur; }
  if (cat.ids.has(valeur)) return valeur; // déjà un id
  const parLabel = cat.parLabel.get(norm(valeur));
  if (parLabel) return parLabel;
  const singulier = SINGULIERS[`${defId}|${norm(valeur)}`];
  if (singulier && cat.ids.has(singulier)) return singulier;
  // Domaine à pool DÉRIVÉ (`specsSource`) : aucun `specs[]` inline, la valeur est déjà un id de registre.
  if (!cat.ids.size) return valeur;
  arrets.push(`${ou} : spéc « ${valeur} » de « ${defId} » ni id ni libellé du catalogue ${champ}.json`);
  return valeur;
}

/** Un nœud d'avancement, migré. `null` = forme inattendue (arrêt). */
function migrer(noeud, champ, ou) {
  if (noeud.random != null && Object.keys(noeud).length === 1) return noeud; // branche préservée
  if (noeud.choice) {
    return { pick: 1, of: noeud.choice.map((b) => migrer(b, champ, ou)) };
  }
  if (noeud.ref) {
    const { id, spec } = noeud.ref;
    return spec == null ? { id } : { id, spec: idDeSpec(champ, id, spec, ou) };
  }
  if (noeud.wildcard) {
    const { id } = noeud.wildcard;
    const opts = noeud.specOptions;
    return opts?.length ? { id, choix: opts.map((o) => idDeSpec(champ, id, o, ou)) } : { id, choix: true };
  }
  // Déjà migré (`{id}`, `{id, spec}`, `{id, choix}`, `{pick, of}`) : rendu tel quel.
  if (noeud.id != null || noeud.pick != null) return noeud;
  arrets.push(`${ou} : forme d'avancement inattendue ${JSON.stringify(noeud)}`);
  return noeud;
}

const rapport = [];
for (const fichier of ['careerLevels.json', 'species.json']) {
  const { abs, brut, doc } = lire(fichier);
  for (const e of doc) {
    for (const champ of ['skills', 'talents']) {
      if (!Array.isArray(e[champ])) continue;
      e[champ] = e[champ].map((n) => migrer(n, champ, `${fichier} › ${e.id} › ${champ}`));
    }
  }
  const out = JSON.stringify(doc, null, 2);
  if (out === brut) { rapport.push(`src/data/${fichier} — INCHANGÉ (no-op byte-identique).`); continue; }
  if (arrets.length) continue; // l'écriture se décide APRÈS le verdict global
  rapport.push(`src/data/${fichier} — réécrit (${doc.length} entrée(s)).`);
  rapport.push({ abs, out });
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} valeur(s) non résolue(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const r of rapport) {
  if (typeof r === 'string') { console.log(r); continue; }
  if (r.out.includes('\r')) { console.error(`${r.abs} : \\r dans le texte réécrit ; AUCUNE écriture.`); process.exit(1); }
  fs.writeFileSync(r.abs, r.out, 'utf8');
}
