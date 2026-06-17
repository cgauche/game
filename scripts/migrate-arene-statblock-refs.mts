/**
 * One-shot : destringifie l'AUTHORING de statbloc/sorts du projet Arène (`arene-projet.json`) vers
 * les refs structurées par `id` STABLE (même pas que les traits, cf. `migrate-arene-authoring-traits.mts`) :
 *   - `entity.statblock.skills: string[]`  → `SkillRef[]`  ({ id, spec?, value })
 *   - `entity.statblock.talents: string[]` → `TalentRef[]` ({ id, spec? })
 *   - `entity.statblock.spells: string[]`  → `string[]` d'IDS de sort (`findSpell(label).id`)
 *   - `entity.combat.spells: string[]`     → `string[]` d'IDS de sort
 * via les VRAIS helpers (parseStatEntry / findSkill / findTalent / findSpell / slugId — source unique,
 * zéro logique dupliquée). NE TOUCHE PAS `combat.optionals` / `statblock.traits` (déjà migrés).
 *
 * Idempotent : seuls les éléments encore `string` sont convertis (un tableau déjà en objets/ids est sauté).
 * Les sorts dont le libellé porte une apostrophe typographique `’` sont normalisés en `'` avant lookup
 * (« La lance d’Ambre » → `la-lance-d-ambre`) — sinon `findSpell` (compare le libellé exact) les perdrait.
 *
 * Écrit en LF / `JSON.stringify(…, 1) + '\n'` — format canonique de `scripts/arene/generate.mjs`
 * (indent 1 + newline final), byte-fidèle au reste du fichier.
 *   npx tsx scripts/migrate-arene-statblock-refs.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseStatEntry } from '../src/engine/statEntry';
import { findSkill, findTalent, findSpell } from '../src/data/index';
import { slugId } from '../src/data/slug';

const path = 'src/scenes/arene/arene-projet.json';
const root = JSON.parse(readFileSync(path, 'utf8'));

let nSkills = 0;
let nTalents = 0;
let nSpells = 0;
const droppedSpells: string[] = [];

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string');

/** label → id de sort, en tolérant l'apostrophe typographique (`’` ⇒ `'`). null si introuvable. */
function spellId(label: string): string | null {
  const hit = findSpell(label) ?? findSpell(label.replace(/[’ʼ]/g, "'"));
  return hit?.id ?? null;
}

/** `string[]` de libellés de sort → `string[]` d'ids (les introuvables sont écartés et signalés). */
function spellsToIds(list: string[]): string[] {
  return list
    .map((label) => {
      const id = spellId(label);
      if (id == null) droppedSpells.push(label);
      return id;
    })
    .filter((id): id is string => id != null);
}

/** Marche récursive : chaque objet portant statblock.{skills,talents,spells} / combat.spells en string[] est migré. */
function walk(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  const statblock = obj.statblock as Record<string, unknown> | undefined;
  if (statblock) {
    if (isStringArray(statblock.skills)) {
      statblock.skills = statblock.skills.map((s) => {
        nSkills++;
        const p = parseStatEntry(s);
        return { id: findSkill(p.name)?.id ?? slugId(p.name), ...(p.arg ? { spec: p.arg } : {}), value: p.indice ?? 0 };
      });
    }
    if (isStringArray(statblock.talents)) {
      statblock.talents = statblock.talents.map((t) => {
        nTalents++;
        const p = parseStatEntry(t);
        return { id: findTalent(p.name)?.id ?? slugId(p.name), ...(p.arg ? { spec: p.arg } : {}) };
      });
    }
    if (isStringArray(statblock.spells)) {
      nSpells += statblock.spells.length;
      statblock.spells = spellsToIds(statblock.spells);
    }
  }

  const combat = obj.combat as Record<string, unknown> | undefined;
  if (combat && isStringArray(combat.spells)) {
    nSpells += combat.spells.length;
    combat.spells = spellsToIds(combat.spells);
  }

  for (const v of Object.values(obj)) walk(v);
}

walk(root);
writeFileSync(path, JSON.stringify(root, null, 1) + '\n');
console.log(`destringified ${nSkills} skills + ${nTalents} talents + ${nSpells} spells (labels) in ${path}`);
if (droppedSpells.length) console.warn(`⚠ ${droppedSpells.length} sort(s) NON résolu(s) (écartés) : ${droppedSpells.join(', ')}`);
