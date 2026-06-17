/**
 * Migration one-shot : `string[]` de référence → refs structurées par `id` STABLE (plan
 * « Refs structurées par id partout »). Idempotent, déterministe (pas de Math.random / Date).
 *
 * Étapes (exécutées dans l'ordre) :
 *   1. id-ification : ajoute un `id` (slug, 1ʳᵉ clé) à trappings/qualities/spells (+ frenchy-spells),
 *      en désambiguïsant les collisions de label (Couteau arme vs outil → couteau / couteau-2).
 *   (les conversions de champs string[]→ref suivront dans les lots B/C/D)
 *
 * Écriture en LF via `serializeDataset` (== `JSON.stringify(x,null,2)`, sans newline final) → le
 * round-trip `serialize.test.ts` reste byte-fidèle. JAMAIS de ConvertTo-Json (CRLF/aplatissement).
 *
 * Lancer : `npx tsx scripts/migrate-refs.mts`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { slugId, uniqueSlugId } from '../src/data/slug';
import { parseStatEntry } from '../src/engine/statEntry';
import { parseTraitInstance } from '../src/engine/traits/dispatch';
import { parseOption, splitTopLevelOu } from '../src/engine/careerSlots';
import { CHAR_BY_LABEL } from '../src/engine/types';

const RANDOM_RE = /^(?:(\d+)\s+)?Talents?\s+al[ée]atoires?$/i;
/** Entrée d'avancement (chaîne) → `AdvancementRef` : « N Talent aléatoire » → {random} ; « A ou B »
 *  → {choice} ; « (Au choix) »/joker restreint → {wildcard,specOptions?} ; sinon {ref:{id,spec?}}. */
function toAdvancementRefs(list: unknown[], refMap: Map<string, string[]>, ctx: string): unknown[] {
  const toOpt = (o: string): unknown => {
    const m = o.match(RANDOM_RE);
    if (m) return { random: parseInt(m[1] ?? '1', 10) };
    const so = parseOption(o); // { name, spec?, wildcard, specOptions? }
    const id = resolveId(refMap, so.name, ctx) ?? slugId(so.name);
    if (so.wildcard) return so.specOptions ? { wildcard: { id }, specOptions: so.specOptions } : { wildcard: { id } };
    return so.spec ? { ref: { id, spec: so.spec } } : { ref: { id } };
  };
  return (list ?? []).map((raw) => {
    if (typeof raw !== 'string') return raw; // déjà converti (idempotent)
    const opts = splitTopLevelOu(raw).map(toOpt);
    return opts.length > 1 ? { choice: opts } : opts[0];
  });
}
/** Stubs SOURCÉS de talents réels absents du catalogue (extraction AA incomplète) — réf. résout, AUCUNE
 *  mécanique inventée (desc vide, max/test null). À compléter depuis AA. Idempotent. */
function ensureMissingTalents(): void {
  const talents = read('talents.json');
  const have = new Set(talents.map((t) => slugId(String(t.label))));
  const add = [{ label: 'Officier de Siège', source: { book: 'AA', page: 0 } }]; // AA (référencé par Artilleur)
  let n = 0;
  for (const t of add) {
    if (have.has(slugId(t.label))) continue;
    talents.push({ id: slugId(t.label), label: t.label, max: null, test: null, desc: '', addSkill: null, addTalent: null, addCharacteristic: null, specs: [], rand: null, source: t.source });
    n++;
  }
  if (n) write('talents.json', talents);
  console.log(`talents: +${n} stub(s) sourcé(s)`);
}

/** species.skills/talents + careerLevels.skills/talents → `AdvancementRef[]`. */
function convertAdvancement(): void {
  const skillMap = labelMap(['skills.json']);
  const talentMap = labelMap(['talents.json']);
  const species = read('species.json').map((s) => ({
    ...s,
    skills: toAdvancementRefs((s.skills as unknown[]) ?? [], skillMap, `species ${s.label}.skill`),
    talents: toAdvancementRefs((s.talents as unknown[]) ?? [], talentMap, `species ${s.label}.talent`),
  }));
  write('species.json', species);
  const careerLevels = read('careerLevels.json').map((lv) => ({
    ...lv,
    skills: toAdvancementRefs((lv.skills as unknown[]) ?? [], skillMap, `careerLevel ${lv.label}.skill`),
    talents: toAdvancementRefs((lv.talents as unknown[]) ?? [], talentMap, `careerLevel ${lv.label}.talent`),
  }));
  write('careerLevels.json', careerLevels);
  console.log('species + careerLevels skills/talents → AdvancementRef');
}

const DATA = fileURLToPath(new URL('../src/data/', import.meta.url));
const serialize = (v: unknown) => JSON.stringify(v, null, 2);

type Entry = Record<string, unknown> & { id?: string; label?: string };

function read(file: string): Entry[] {
  return JSON.parse(readFileSync(DATA + file, 'utf8')) as Entry[];
}
function write(file: string, data: unknown): void {
  writeFileSync(DATA + file, serialize(data), 'utf8'); // LF
}

/** Place `id` en 1ʳᵉ clé (conserve l'ordre des autres champs). */
function withId(e: Entry, id: string): Entry {
  if (e.id === id && Object.keys(e)[0] === 'id') return e;
  const { id: _drop, ...rest } = e;
  return { id, ...rest };
}

/** id-ifie un dataset (mono-fichier). `taken` partagé si plusieurs fichiers forment un même namespace. */
function idify(entries: Entry[], taken: Set<string>): { out: Entry[]; collisions: string[] } {
  const collisions: string[] = [];
  const out = entries.map((e) => {
    const label = String(e.label ?? '');
    const base = slugId(label);
    const id = uniqueSlugId(label, taken);
    if (id !== base) collisions.push(`${label} → ${id}`);
    return withId(e, id);
  });
  return { out, collisions };
}

function idifyFile(file: string): void {
  const { out, collisions } = idify(read(file), new Set());
  write(file, out);
  console.log(`id-ifié ${file} : ${out.length} entrées${collisions.length ? `, collisions: ${collisions.join(', ')}` : ''}`);
}

/** spells = spells.json + frenchy-spells.json (même namespace runtime `spells`) → `taken` partagé. */
function idifySpells(): void {
  const taken = new Set<string>();
  const a = idify(read('spells.json'), taken);
  const b = idify(read('frenchy-spells.json'), taken);
  write('spells.json', a.out);
  write('frenchy-spells.json', b.out);
  const cols = [...a.collisions, ...b.collisions];
  console.log(`id-ifié spells (${a.out.length}+${b.out.length})${cols.length ? `, collisions: ${cols.join(', ')}` : ''}`);
}

/** Renomme la clé `skillId`/`talentId` → `id` dans les refs déjà structurées de creatures.json
 *  (fold du POC dans le noyau `Ref { id }`). Idempotent. */
function renameCreatureRefIds(): void {
  const creatures = read('creatures.json') as (Entry & { skills?: any[]; talents?: any[] })[];
  let n = 0;
  const rename = (refs: any[] | undefined, from: string) =>
    (refs ?? []).map((r) => {
      if (r && typeof r === 'object' && from in r) {
        const { [from]: id, ...rest } = r;
        n++;
        return { id, ...rest };
      }
      return r;
    });
  const out = creatures.map((c) => ({
    ...c,
    ...(c.skills ? { skills: rename(c.skills, 'skillId') } : {}),
    ...(c.talents ? { talents: rename(c.talents, 'talentId') } : {}),
  }));
  write('creatures.json', out);
  console.log(`creatures.json : ${n} refs skillId/talentId → id`);
}

// ── Conversion string[] → refs structurées (lot B : refs simples) ───────────────────────────────
const problems: string[] = [];
const ambiguities: string[] = [];
const narratives: string[] = [];
/** Clé de résolution insensible à la casse/aux accents (« % en Discrétion » == « % en discretion »). */
const nk = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
/** Map nk(label) → ids. `stripArticle` indexe AUSSI la forme sans « À » initial (« À Explosion » ⇒ « Explosion »). */
function labelMap(files: string[], stripArticle = false): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (key: string, id: string) => { const a = m.get(key) ?? []; if (!a.includes(id)) a.push(id); m.set(key, a); };
  for (const f of files) for (const e of read(f)) {
    if (e.label == null) continue;
    add(nk(String(e.label)), String(e.id));
    if (stripArticle) { const s = String(e.label).replace(/^à\s+/i, ''); if (s !== String(e.label)) add(nk(s), String(e.id)); }
  }
  return m;
}
/** Résout label → id (insensible casse/accents). Collision → 1er DÉCLARÉ (déterministe, comme
 *  `findSpell`/`findTrapping` par label = 1er match). Absent → UNRESOLVED (null). */
function resolveId(map: Map<string, string[]>, label: string, ctx: string): string | null {
  const ids = map.get(nk(label));
  if (!ids || !ids.length) { problems.push(`UNRESOLVED ${ctx}: "${label}"`); return null; }
  if (ids.length > 1) ambiguities.push(`${ctx}: "${label}" → ${ids[0]} (parmi ${ids.join(', ')})`);
  return ids[0];
}
/** « (3) » → {fixed:3} ; « (1d10) »/« (2d10) » → {roll} ; sinon pas de count (+ reste = nom). */
function splitCount(raw: string): { name: string; count?: { fixed: number } | { roll: string } } {
  const m = raw.match(/^(.*?)\s*\((\d+)\)\s*$/);
  if (m) return { name: m[1].trim(), count: { fixed: parseInt(m[2], 10) } };
  const r = raw.match(/^(.*?)\s*\((\d+d\d+(?:\+\d+)?)\)\s*$/i);
  if (r) return { name: r[1].trim(), count: { roll: r[2] } };
  return { name: raw.trim() };
}

/** Convertit des labels de Possession → `TrappingRef[]` : par id du catalogue (insensible casse), sinon
 *  texte NARRATIF `{text}` (flavor/choix « A ou B »/« (Multiple) » hors catalogue — préservé, comme
 *  l'ancien runtime qui les ignorait). Collision → 1er déclaré. */
function toTrappingRefs(list: unknown[], trapMap: Map<string, string[]>, ctx: string): unknown[] {
  return (list ?? []).map((raw) => {
    if (typeof raw !== 'string') return raw; // déjà converti (idempotent)
    const { name, count } = splitCount(raw);
    const ids = trapMap.get(nk(name));
    if (ids && ids.length) {
      if (ids.length > 1) ambiguities.push(`${ctx}: "${name}" → ${ids[0]} (parmi ${ids.join(', ')})`);
      return count ? { id: ids[0], count } : { id: ids[0] };
    }
    narratives.push(`${ctx}: "${raw}"`);
    return count ? { text: name, count } : { text: name };
  });
}

function convertSimpleRefs(): void {
  const trapMap = labelMap(['trappings.json']);
  const qualMap = labelMap(['qualities.json'], true); // stripArticle : « À Explosion » ⇔ « Explosion »
  const spellMap = labelMap(['spells.json', 'frenchy-spells.json']);

  // trappings.json : qualities string[] → Ref[] (id de qualité ; spec = arg éventuel).
  const traps = read('trappings.json').map((t) => {
    const quals = (t.qualities as unknown[] | undefined) ?? [];
    return { ...t, qualities: quals.map((raw) => {
      if (typeof raw !== 'string') return raw; // déjà converti (idempotent)
      const p = parseStatEntry(raw);
      const id = resolveId(qualMap, p.name, `trapping ${t.label}.quality`) ?? slugId(p.name);
      const ref: Record<string, unknown> = { id };
      if (p.indice != null) ref.value = p.indice; // Indice « Solide 3 » → value (NE PAS perdre)
      if (p.arg != null) ref.spec = p.arg;
      return ref;
    }) };
  });
  write('trappings.json', traps);

  // classes.json : trappings string[] → TrappingRef[] (flavor hors catalogue → {text}).
  const classes = read('classes.json').map((c) => ({ ...c, trappings: toTrappingRefs((c.trappings as unknown[]) ?? [], trapMap, `class ${c.label}`) }));
  write('classes.json', classes);

  // careerLevels.json : trappings string[] → TrappingRef[] (mêmes règles ; « (3) »/« (1d10) » → count).
  const careerLevels = read('careerLevels.json').map((lv) => ({ ...lv, trappings: toTrappingRefs((lv.trappings as unknown[]) ?? [], trapMap, `careerLevel ${lv.label}`) }));
  write('careerLevels.json', careerLevels);

  // creatures.json : spells string[] → Ref[] ; trappings string[] → TrappingRef[] ; optionals string[] → TraitInstance[].
  const creatures = read('creatures.json').map((c) => ({
    ...c,
    spells: ((c.spells as unknown[]) ?? []).map((label) => {
      if (typeof label !== 'string') return label; // déjà converti
      const id = resolveId(spellMap, label, `creature ${c.label}.spell`); return id ? { id } : { id: slugId(label) };
    }),
    trappings: toTrappingRefs((c.trappings as unknown[]) ?? [], trapMap, `creature ${c.label}.trapping`),
    optionals: ((c.optionals as unknown[]) ?? []).map((raw) => (typeof raw === 'string' ? parseTraitInstance(raw) : raw)),
  }));
  write('creatures.json', creatures);
  console.log(`refs simples : trappings.qualities, classes.trappings, creatures.spells/trappings/optionals convertis`);
}

/** careerLevels.characteristics : libellés longs (« Capacité de Tir ») → `CharKey` (« CT »). */
function convertCareerChars(): void {
  const out = read('careerLevels.json').map((lv) => ({
    ...lv,
    characteristics: (((lv as Entry).characteristics as unknown[]) ?? []).map((c) =>
      typeof c === 'string' ? (CHAR_BY_LABEL[c] ?? c) : c,
    ),
  }));
  write('careerLevels.json', out);
  console.log('careerLevels.characteristics → CharKey');
}

/** Phase A1 — id-ifie les ENTITÉS careers/classes/species et convertit les RÉFÉRENCES d'entité :
 *  careers.class (label→classId), careerLevels.career (label→careerId), pregens.career/species
 *  (label→id). Le vocabulaire de GROUPE (clés `careers.rand`, `species.refChar`/`refCareer`) est un
 *  concern distinct, traité par `migrateGroupVocab` (phase A2). Idempotent : une valeur déjà = id
 *  (présente dans l'idSet) est conservée telle quelle. */
function migrateCareersSpecies(): void {
  idifyFile('careers.json');
  idifyFile('classes.json');
  idifyFile('species.json');

  const classMap = labelMap(['classes.json']);
  const careerMap = labelMap(['careers.json']);
  const speciesMap = labelMap(['species.json']);
  const classIds = new Set(read('classes.json').map((c) => String(c.id)));
  const careerIds = new Set(read('careers.json').map((c) => String(c.id)));
  const speciesIds = new Set(read('species.json').map((s) => String(s.id)));
  const toId = (set: Set<string>, map: Map<string, string[]>, v: unknown, ctx: string): unknown =>
    typeof v === 'string' ? (set.has(v) ? v : (resolveId(map, v, ctx) ?? v)) : v;

  write('careers.json', read('careers.json').map((c) => ({ ...c, class: toId(classIds, classMap, c.class, `career ${c.label}.class`) })));
  write('careerLevels.json', read('careerLevels.json').map((lv) => ({ ...lv, career: toId(careerIds, careerMap, lv.career, `careerLevel ${lv.label}.career`) })));
  write('pregens.json', read('pregens.json').map((p) => ({
    ...p,
    career: toId(careerIds, careerMap, p.career, `pregen ${p.name}.career`),
    species: toId(speciesIds, speciesMap, p.species, `pregen ${p.name}.species`),
  })));

  // interludeEvents : revenueClasses / revenueBlockedClasses (labels de Classe → classId). La
  // sentinelle « * » (tout le monde) n'est PAS une Classe → préservée telle quelle.
  const toClassList = (arr: unknown, ctx: string): unknown =>
    Array.isArray(arr) ? arr.map((v) => (v === '*' ? '*' : toId(classIds, classMap, v, ctx))) : arr;
  write('interludeEvents.json', read('interludeEvents.json').map((e) => {
    const fx = (e as Entry).fx as Record<string, unknown> | undefined;
    if (!fx || (!('revenueClasses' in fx) && !('revenueBlockedClasses' in fx))) return e;
    return { ...e, fx: {
      ...fx,
      ...('revenueClasses' in fx ? { revenueClasses: toClassList(fx.revenueClasses, `interlude.revenueClasses`) } : {}),
      ...('revenueBlockedClasses' in fx ? { revenueBlockedClasses: toClassList(fx.revenueBlockedClasses, `interlude.revenueBlockedClasses`) } : {}),
    } };
  }));
  console.log('careers/classes/species id-ifiés ; careers.class/careerLevels.career/pregens/interludeEvents → ids');
}

// ── Run ───────────────────────────────────────────────────────────────────────────────────────
// NB : `gods.json` a été généré une fois depuis les ex-`cults/defs/` (supprimés) ; c'est désormais
// une SOURCE app-owned éditable au Codex, plus rien à régénérer.
idifyFile('trappings.json');
idifyFile('qualities.json');
idifySpells();
renameCreatureRefIds();
convertSimpleRefs();
convertCareerChars();
ensureMissingTalents();
convertAdvancement();
migrateCareersSpecies();
if (problems.length) console.error(`\n⚠ ${problems.length} PROBLÈMES (résolution) :\n  ${problems.slice(0, 60).join('\n  ')}${problems.length > 60 ? `\n  …(+${problems.length - 60})` : ''}`);
console.log('migration terminée.');
