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

/** Phase B — id-ifie `etats.json` (États) et convertit les VALEURS des ops `condition`/`removeCondition`
 *  dans les Flows de sorts (`name`/`onlyIfCondition`/`unlessCondition` : libellé → conditionId). Les NOMS
 *  de champs sont conservés (cohérent Phase A : la valeur porte l'id). Idempotent (id déjà présent → gardé). */
function migrateConditions(): void {
  idifyFile('etats.json');
  const etatMap = labelMap(['etats.json']);
  const etatIds = new Set(read('etats.json').map((e) => String(e.id)));
  // Inconnu du catalogue → slug (ex. « Pétrifié » → 'petrifie', cohérent effectIcons) ; id déjà présent → gardé.
  const toCond = (v: unknown, ctx: string): unknown =>
    typeof v === 'string' ? (etatIds.has(v) ? v : (resolveId(etatMap, v, ctx) ?? slugId(v))) : v;
  const COND_KEYS = new Set(['name', 'onlyIfCondition', 'unlessCondition']);
  // Listes porteuses d'États NUS (`[{name, value}]`) : `conditions` (zoneBlast/onHit) + `onFail`/`onSuccess`
  // (bloc `resist` des critiques). `parentCondArr` = on est un élément d'une telle liste.
  const COND_ARRAYS = new Set(['conditions', 'onFail', 'onSuccess']);
  const walk = (node: unknown, parentCondArr = false): unknown => {
    if (Array.isArray(node)) return node.map((x) => walk(x, parentCondArr));
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      const isCondOp = o.op === 'condition' || o.op === 'removeCondition';
      const isBareCond = parentCondArr && !('op' in o) && 'name' in o; // {name,value} sans op = État nu
      const convert = isCondOp || isBareCond;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        if (convert && COND_KEYS.has(k)) out[k] = toCond(v, `condition.${k}`);
        // Champ `condition` d'une Condition Flow (`compare.subject.condition`, `has`) → id d'État
        // (uniquement si c'est un État CONNU, pour ne pas sluguer un champ homonyme non-État).
        else if (k === 'condition' && typeof v === 'string' && (etatIds.has(v) || etatMap.has(nk(v)))) out[k] = toCond(v, 'flow.condition');
        else if (COND_ARRAYS.has(k) && Array.isArray(v)) out[k] = v.map((x) => walk(x, true));
        else out[k] = walk(v, false);
      }
      return out;
    }
    return node;
  };
  const COND_FILES = ['spells.json', 'frenchy-spells.json', 'qualities.json', 'domains.json', 'maneuvers.json', 'traits.json', 'frenchy-traits.json', 'criticals.json'];
  for (const f of COND_FILES) {
    const raw = JSON.parse(readFileSync(DATA + f, 'utf8')); // racine agnostique (array OU objet)
    writeFileSync(DATA + f, serialize(walk(raw)), 'utf8');
  }
  console.log(`etats id-ifiés ; refs d'État (op condition + listes conditions[]) → conditionId dans ${COND_FILES.length} fichiers`);
}

/** Phase D — id-ifie la taxonomie `subType` des possessions en un dataset `weaponGroups.json` (Groupes
 *  d'armes + familles de munitions + types d'armure + catégories d'inventaire) et convertit
 *  `trappings.subType` (label → id). Le `kind` est une métadonnée d'affichage (Codex/marchand) dérivée
 *  du `type` prédominant des objets du Groupe : armour / weapon / ammo / inventory. Corrige d'abord le
 *  typo de donnée « Deux mains » (sans tiret) → « Deux-mains » pour qu'ils mappent au MÊME Groupe.
 *  Idempotent : un subType déjà = id (présent dans l'idSet) est conservé tel quel. */
function migrateWeaponGroups(): void {
  // 1) Normalise le typo « Deux mains » → « Deux-mains » AVANT toute id-ification (un seul Groupe).
  const trapsRaw = read('trappings.json').map((t) => (t.subType === 'Deux mains' ? { ...t, subType: 'Deux-mains' } : t));

  // 2) Bâtit le dataset des Groupes : une entrée {id, label, kind} par subType distinct (ordre de
  //    première apparition = stable). `kind` dérivé du `type` prédominant des objets du Groupe.
  const counts = new Map<string, Record<string, number>>(); // label → { type → n }
  for (const t of trapsRaw) {
    if (t.subType == null) continue;
    const c = counts.get(String(t.subType)) ?? {};
    c[String(t.type)] = (c[String(t.type)] ?? 0) + 1;
    counts.set(String(t.subType), c);
  }
  const kindOf = (byType: Record<string, number>): string => {
    const keys = Object.keys(byType);
    if (keys.every((k) => k === 'armor')) return 'armour';
    if (keys.every((k) => k === 'melee' || k === 'ranged' || k === 'ammunition') && (byType.melee || byType.ranged)) return 'weapon';
    if (keys.every((k) => k === 'ammunition')) return 'ammo';
    return 'inventory';
  };
  // IDEMPOTENCE : si `weaponGroups.json` existe déjà (1ʳᵉ migration faite), on le CONSERVE — les
  // `trappings.subType` étant déjà des ids, les reconstruire ferait `label === id` (perte des libellés).
  let groups: { id: string; label: string; kind: string }[];
  const existing = (() => { try { return read('weaponGroups.json'); } catch { return []; } })();
  if (existing.length) {
    groups = existing as unknown as typeof groups;
  } else {
    const taken = new Set<string>();
    groups = [...counts.entries()].map(([label, byType]) => ({
      id: uniqueSlugId(label, taken), label, kind: kindOf(byType),
    }));
    write('weaponGroups.json', groups);
  }

  // 3) Convertit trappings.subType label → id (idempotent : un id déjà connu est conservé).
  const labelToId = new Map(groups.map((g) => [nk(g.label), g.id]));
  const idSet = new Set(groups.map((g) => g.id));
  const traps = trapsRaw.map((t) => {
    if (t.subType == null) return t;
    const cur = String(t.subType);
    if (idSet.has(cur)) return t; // déjà migré
    const id = labelToId.get(nk(cur));
    if (!id) { problems.push(`UNRESOLVED trapping ${t.label}.subType: "${cur}"`); return t; }
    return { ...t, subType: id };
  });
  write('trappings.json', traps);
  console.log(`weaponGroups : ${groups.length} Groupes ; trappings.subType → id`);
}

/** Phase D — résout des `{text}` de possessions restés non-cataloguables faute de label EXACT (ancien
 *  runtime qui stripait toute parenthèse / aliasait) → `{id}` réel, pour préserver le comportement de
 *  `buildInventory` (refs directes) : « Pierre » = munition de Fronde « Projectile de pierre » (Traqueur) ;
 *  « Ration (Multiple) » = « Ration » (classes Ruraux/Itinérants — l'ancien code stripait « (Multiple) »).
 *  Idempotent. */
const TEXT_ALIAS: Record<string, string> = { 'Pierre': 'projectile-de-pierre', 'Ration (Multiple)': 'ration' };
function fixCareerTrappingAliases(): void {
  const fix = (file: string): number => {
    let n = 0;
    const out = read(file).map((e) => ({
      ...e,
      trappings: ((e.trappings as unknown[]) ?? []).map((tr) => {
        const txt = tr && typeof tr === 'object' ? (tr as { text?: string }).text : undefined;
        if (txt && TEXT_ALIAS[txt]) { n++; return { id: TEXT_ALIAS[txt], ...((tr as { count?: unknown }).count ? { count: (tr as { count: unknown }).count } : {}) }; }
        return tr;
      }),
    }));
    if (n) write(file, out);
    return n;
  };
  console.log(`alias de possessions {text}→{id} : careerLevels ${fix('careerLevels.json')}, classes ${fix('classes.json')}`);
}

/** Phase D — convertit les ops `giveTrapping`/`grantWeapon` dans les datasets de Flow (sorts/traits…) :
 *  `giveTrapping.trapping` (nom) → `trappingId`/`custom` ; `grantWeapon.subType` (libellé de Groupe) → id.
 *  Idempotent (un op déjà migré est laissé tel quel). */
function migrateOpTrappings(): void {
  const trapMap = labelMap(['trappings.json']);
  const groupMap = labelMap(['weaponGroups.json']);
  const groupIds = new Set(read('weaponGroups.json').map((g) => String(g.id)));
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (o.op === 'giveTrapping' && typeof o.trapping === 'string') {
        const { trapping, ...rest } = o;
        const ids = trapMap.get(nk(trapping));
        const resolved = ids && ids.length ? { trappingId: ids[0] } : { custom: trapping };
        return { ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, walk(v)])), ...resolved };
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        if (o.op === 'grantWeapon' && k === 'subType' && Array.isArray(v)) {
          out[k] = v[0]; // répare un id accidentellement encodé en tableau (bug de migration antérieur)
        } else if (o.op === 'grantWeapon' && k === 'subType' && typeof v === 'string' && !groupIds.has(v)) {
          out[k] = groupMap.get(nk(v))?.[0] ?? slugId(v);
        } else out[k] = walk(v);
      }
      return out;
    }
    return node;
  };
  for (const f of ['spells.json', 'frenchy-spells.json', 'maneuvers.json', 'traits.json', 'frenchy-traits.json', 'qualities.json', 'domains.json', 'creatures.json']) {
    const raw = JSON.parse(readFileSync(DATA + f, 'utf8'));
    writeFileSync(DATA + f, serialize(walk(raw)), 'utf8');
  }
  console.log('ops giveTrapping/grantWeapon → trappingId/custom + Groupe id');
}

/** Phase D — convertit les `giveTrapping` des scènes JSON (NOM → `trappingId` si le nom résout au
 *  catalogue, sinon nom CUSTOM `{custom}` hors-base). Récursif (le champ vit dans des Flow imbriqués).
 *  Idempotent : un nœud déjà migré (présence de `trappingId`/`custom`) est laissé tel quel. */
function migrateSceneTrappings(file: string): void {
  const trapMap = labelMap(['trappings.json']);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (o.type === 'giveTrapping' && typeof o.trapping === 'string') {
        const { trapping, ...rest } = o;
        const ids = trapMap.get(nk(trapping));
        const resolved = ids && ids.length ? { trappingId: ids[0] } : { custom: trapping };
        return { ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, walk(v)])), ...resolved };
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) out[k] = walk(v);
      return out;
    }
    return node;
  };
  writeFileSync(file, serialize(walk(raw)), 'utf8'); // LF
  console.log(`scène ${file.split(/[\\/]/).pop()} : giveTrapping.trapping → trappingId/custom`);
}

/** Sépare un libellé concret « Nom (Spec) » → { name, spec } (parenthèse non numérique = spec).
 *  Réutilisé par la migration de `grantTalent` (« Maître artisan (Au choix) ») et `addTalent`. */
function splitSpec(raw: string): { name: string; spec?: string } {
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m && !/^\d+$/.test(m[2].trim()) ? { name: m[1].trim(), spec: m[2].trim() } : { name: raw.trim() };
}

/** Phase F — convertit les RÉFÉRENCES résiduelles des ops de Flow + des champs de talent :
 *  - `augmentWeapon.addQualities` / `grantWeapon.qualities` / `grantNaturalWeapon.qualities` :
 *    libellé de qualité → id (« Magique » → 'magique', « À Explosion » ⇔ « Explosion »).
 *  - `grantTalent` : { talent: « Maître artisan (Au choix) » } → { talentId, spec? } (libellé → id, spec entre ()).
 *  Dans `spells.json`/`frenchy-spells.json`/`maneuvers.json`/`traits.json`/`frenchy-traits.json`/
 *  `qualities.json`/`domains.json`/`creatures.json`/`stars.json`. Idempotent (op déjà migré → laissé). */
function migrateOpRefs(): void {
  const qualMap = labelMap(['qualities.json'], true); // stripArticle : « À Explosion » ⇔ « Explosion »
  const qualIds = new Set(read('qualities.json').map((q) => String(q.id)));
  const talentMap = labelMap(['talents.json']);
  const talentIds = new Set(read('talents.json').map((t) => String(t.id)));
  // Libellé/id de qualité → id stable (idempotent : un id déjà connu est conservé).
  const toQualId = (v: unknown, ctx: string): unknown => {
    if (typeof v !== 'string') return v;
    if (qualIds.has(v)) return v;
    return resolveId(qualMap, v, ctx) ?? slugId(v);
  };
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      // grantTalent : { talent: « Nom (Spec) » } → { talentId, spec? } (idempotent : talentId déjà présent → laissé).
      if (o.op === 'grantTalent' && typeof o.talent === 'string') {
        const { talent, ...rest } = o;
        const { name, spec } = splitSpec(talent);
        const id = talentIds.has(name) ? name : (resolveId(talentMap, name, 'grantTalent') ?? slugId(name));
        return { ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, walk(v)])), talentId: id, ...(spec ? { spec } : {}) };
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        // addQualities (augmentWeapon) / qualities (grantWeapon/grantNaturalWeapon) : libellé → id.
        if ((k === 'addQualities' || (k === 'qualities' && (o.op === 'grantWeapon' || o.op === 'grantNaturalWeapon'))) && Array.isArray(v)) {
          out[k] = v.map((q) => toQualId(q, `${String(o.op)}.${k}`));
        } else out[k] = walk(v);
      }
      return out;
    }
    return node;
  };
  for (const f of ['spells.json', 'frenchy-spells.json', 'maneuvers.json', 'traits.json', 'frenchy-traits.json', 'qualities.json', 'domains.json', 'creatures.json', 'stars.json']) {
    const raw = JSON.parse(readFileSync(DATA + f, 'utf8'));
    writeFileSync(DATA + f, serialize(walk(raw)), 'utf8');
  }
  console.log('ops addQualities/grantWeapon.qualities → id de qualité ; grantTalent → { talentId, spec? }');
}

/** Phase F — convertit les champs `addSkill`/`addTalent` de `talents.json` (libellés concrets «
 *  Métier (Au choix) », « Frénésie ») en réfs structurées par id (`addSkill`/`addTalent` =
 *  `{ id, spec? }`). `addCharacteristic` reste un libellé long (hors périmètre). Idempotent. */
function migrateTalentGrants(): void {
  const skillMap = labelMap(['skills.json']);
  const skillIds = new Set(read('skills.json').map((s) => String(s.id)));
  const talentMap = labelMap(['talents.json']);
  const talentIds = new Set(read('talents.json').map((t) => String(t.id)));
  const toRef = (v: unknown, map: Map<string, string[]>, ids: Set<string>, ctx: string): unknown => {
    if (v == null) return v;
    if (typeof v !== 'string') return v; // déjà { id, spec? } (idempotent)
    const { name, spec } = splitSpec(v);
    const id = ids.has(name) ? name : (resolveId(map, name, ctx) ?? slugId(name));
    return spec ? { id, spec } : { id };
  };
  const out = read('talents.json').map((t) => ({
    ...t,
    ...(t.addSkill != null ? { addSkill: toRef(t.addSkill, skillMap, skillIds, `talent ${t.label}.addSkill`) } : {}),
    ...(t.addTalent != null ? { addTalent: toRef(t.addTalent, talentMap, talentIds, `talent ${t.label}.addTalent`) } : {}),
  }));
  write('talents.json', out);
  console.log('talents.addSkill/addTalent → réfs par id ({ id, spec? })');
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
migrateConditions();
migrateWeaponGroups();
fixCareerTrappingAliases();
migrateOpTrappings();
migrateOpRefs();
migrateTalentGrants();
for (const f of [
  fileURLToPath(new URL('../src/scenes/arene/arene-projet.json', import.meta.url)),
]) migrateSceneTrappings(f);
if (problems.length) console.error(`\n⚠ ${problems.length} PROBLÈMES (résolution) :\n  ${problems.slice(0, 60).join('\n  ')}${problems.length > 60 ? `\n  …(+${problems.length - 60})` : ''}`);
console.log('migration terminée.');
