/**
 * Brique RELATIONNELLE du Codex — SOURCE UNIQUE des références INVERSES (« qui pointe vers cette
 * entité ? ») et de l'index par livre. Construite UNE fois, au chargement, en inversant les
 * références DÉJÀ STRUCTURÉES de `src/data` (creature.traits/skills/talents/spells/trappings ;
 * careerLevel.* ; species.* ; talent.passive grantCareer* ; spell.domainId + gods.* ;
 * trapping.qualities/subType ; trait.grantsManeuvers ; mutation.traits ; skill.characteristic).
 *
 * **100 % id-based → langue-agnostique** : on inverse des `id` STABLES, jamais des libellés. Le
 * `label` porté par un `Referrer` n'est QUE l'affichage (= `CodexItem.label`, résolu par
 * `codexLookup`). Aucune regex, aucune logique branchée sur du texte.
 *
 * Le registre (`registry.ts`) en tire les SECTIONS inverses ; les refs AVANT restent projetées par
 * le registre (rendu riche : choix « A ou B », Indices d'instance) — ici, c'est la couche d'INVERSION
 * et d'INDEX, pas une seconde copie des refs avant.
 */
import {
  species, careers, careerLevels, skills, talents, trappings, creatures, traits, mutations,
  spells, gods, domains, classes, maneuvers, qualities, weaponGroups, characteristics, etats, maladies,
  locations, stars, mutationTables, advancementBaseId, careersForSpecies, findCareerById,
} from '../../data';
import type { AdvancementRef } from '../../data';
import { spellEffectOps } from '../../state/flow';
import type { Flow, TriggeredEffect } from '../../state/flow';

/** Un référant (entité QUI pointe vers la cible) — ouvrable au Codex via (category, label). */
export interface Referrer {
  /** Catégorie Codex du référant (clé de `CODEX`) — pour le lien `CodexRef`. */
  category: string;
  /** Libellé d'affichage = `CodexItem.label` (résolu par `codexLookup`). */
  label: string;
  /** Contexte optionnel (« N2 », « facultatif »…) — fusionné en cas de doublon. */
  detail?: string;
}
/** Un groupe de référants de MÊME catégorie (rendu en UNE section inverse). */
export interface ReverseGroup {
  category: string;
  /** Titre FR de la section (display — « Créatures ayant ce trait »…). */
  title: string;
  referrers: Referrer[];
}

// ── Construction du graphe inverse ─────────────────────────────────────────────
// Clé = `${targetCategory}:${targetId}` → liste BRUTE de référants (dédupliquée à la lecture).
const REVERSE = new Map<string, Referrer[]>();
const rkey = (cat: string, id: string): string => `${cat}:${id}`;

/** Enregistre une arête inverse : `target` (cat,id) est référencée PAR `by` (referrer). */
function addReverse(targetCat: string, targetId: string | null | undefined, by: Referrer): void {
  if (!targetId) return;
  const k = rkey(targetCat, targetId);
  const arr = REVERSE.get(k);
  if (arr) arr.push(by);
  else REVERSE.set(k, [by]);
}

/** ids de base d'une liste d'`AdvancementRef` (ref/wildcard ; choice → chaque branche). */
function advancementIds(list: AdvancementRef[] | undefined): string[] {
  const out: string[] = [];
  for (const a of list ?? []) {
    if ('choice' in a) out.push(...advancementIds(a.choice));
    else { const id = advancementBaseId(a); if (id) out.push(id); }
  }
  return out;
}

// 1) Espèces (cat `races`) → compétences/talents de race + carrières accessibles.
for (const s of species) {
  const by: Referrer = { category: 'races', label: s.label };
  for (const id of advancementIds(s.skills)) addReverse('skills', id, by);
  for (const id of advancementIds(s.talents)) addReverse('talents', id, by);
  // Carrières accessibles à l'espèce (LDB 05) → inverse « Races y accédant » sur la carrière.
  for (const c of careersForSpecies(s.refCareer)) addReverse('careers', c.id, by);
}

// 2) Carrières (cat `careers`) → classe.
for (const c of careers) addReverse('classes', c.class, { category: 'careers', label: c.label });

// 3) Niveaux de carrière → compétences/talents/possessions/caractéristiques (référant = la CARRIÈRE, rang en détail).
for (const lv of careerLevels) {
  const career = findCareerById(lv.career);
  if (!career) continue;
  const by: Referrer = { category: 'careers', label: career.label, detail: `N${lv.level}` };
  for (const id of advancementIds(lv.skills)) addReverse('skills', id, by);
  for (const id of advancementIds(lv.talents)) addReverse('talents', id, by);
  for (const k of lv.characteristics) addReverse('characteristics', k, by);
  for (const t of lv.trappings) if ('id' in t) addReverse('trappings', t.id, by);
}

// 4) Compétences → caractéristique de test.
for (const s of skills) addReverse('characteristics', s.characteristic, { category: 'skills', label: s.label });

// 5) Talents → octrois de carrière (grantCareerSkill/Talent) + bonus de carac (charMod).
for (const t of talents) {
  const by: Referrer = { category: 'talents', label: t.label };
  for (const op of t.passive ?? []) {
    if (op.op === 'grantCareerSkill') addReverse('skills', op.skillId, by);
    else if (op.op === 'grantCareerTalent') addReverse('talents', op.talentId, by);
    else if (op.op === 'charMod') addReverse('characteristics', op.char, by);
  }
}

// 6) Créatures → traits (+ facultatifs) · compétences · talents · sorts · possessions.
for (const c of creatures) {
  const by: Referrer = { category: 'creatures', label: c.label };
  for (const tr of c.traits) addReverse('traits', tr.id, by);
  for (const tr of c.optionals) addReverse('traits', tr.id, { ...by, detail: 'facultatif' });
  for (const sk of c.skills) addReverse('skills', sk.id, by);
  for (const ta of c.talents) addReverse('talents', ta.id, by);
  for (const sp of c.spells) addReverse('spells', sp.id, by);
  for (const tp of c.trappings) if ('id' in tp) addReverse('trappings', tp.id, by);
}

// 7) Possessions → qualités + groupe d'objet.
for (const t of trappings) {
  const by: Referrer = { category: 'trappings', label: t.label };
  for (const q of t.qualities) addReverse('qualities', q.id, by);
  addReverse('weaponGroups', t.subType, by);
}

// 8) Classes → possessions de départ.
for (const cl of classes) {
  const by: Referrer = { category: 'classes', label: cl.label };
  for (const t of cl.trappings) if ('id' in t) addReverse('trappings', t.id, by);
}

// 9) Traits → manœuvres conférées.
for (const t of traits) {
  const by: Referrer = { category: 'traits', label: t.label };
  for (const m of t.grantsManeuvers ?? []) addReverse('maneuvers', m.id, by);
}

// 10) Mutations → traits conférés.
for (const m of mutations) {
  const by: Referrer = { category: 'mutations', label: m.label };
  for (const tr of m.traits ?? []) addReverse('traits', tr.id, by);
}

// 11) Sorts → domaine.
for (const s of spells) addReverse('domains', s.domainId, { category: 'spells', label: s.label });

// 12) Dieux/Cultes → bénédictions + miracles.
for (const g of gods) {
  const by: Referrer = { category: 'gods', label: g.key };
  for (const b of g.blessings) addReverse('spells', b.id, { ...by, detail: 'Bénédiction' });
  for (const mi of g.miracles) addReverse('spells', mi.id, { ...by, detail: 'Miracle' });
}

// 13) États INFLIGÉS — ops `condition` des effets (Sort = Flow ; Trait/Qualité/Talent/Domaine =
//     TriggeredEffect[].flow). On réutilise le walker `spellEffectOps` (zéro parsing maison).
const conditionIdsInFlow = (flow: Flow | undefined): string[] =>
  spellEffectOps(flow).flatMap((o) => (o.op === 'condition' ? [o.name] : []));
const conditionIdsInEffects = (effects: TriggeredEffect[] | undefined): string[] =>
  (effects ?? []).flatMap((e) => conditionIdsInFlow(e.flow));
for (const s of spells) for (const id of conditionIdsInFlow(s.effects)) addReverse('etats', id, { category: 'spells', label: s.label });
for (const t of traits) for (const id of conditionIdsInEffects(t.effects)) addReverse('etats', id, { category: 'traits', label: t.label });
for (const q of qualities) for (const id of conditionIdsInEffects(q.effects)) addReverse('etats', id, { category: 'qualities', label: q.label });
for (const t of talents) for (const id of conditionIdsInEffects(t.effects)) addReverse('etats', id, { category: 'talents', label: t.label });
for (const d of domains) for (const id of conditionIdsInEffects(d.effects)) addReverse('etats', id, { category: 'domains', label: d.label });

// 14) Mutation ← Table de Corruption qui la tire (inversion de mutationTable.ranges[].mutation).
for (const tab of mutationTables) for (const r of tab.ranges) addReverse('mutations', r.mutation, { category: 'mutationTables', label: tab.label, detail: `${r.min}–${r.max}` });
// 15) Lieu ← sous-lieux (inversion de location.parent, désormais un id de parent).
for (const l of locations) if (l.parent) addReverse('locations', l.parent, { category: 'locations', label: l.label });

// ── Titres FR des sections inverses (display — couche UI, pas de sémantique de jeu) ──────────────
// Clé `${targetCat}:${refCat}` ; repli = nom pluriel générique du référant.
const GENERIC_PLURAL: Record<string, string> = {
  races: 'Races', careers: 'Carrières', classes: 'Classes', skills: 'Compétences', talents: 'Talents',
  trappings: 'Équipements', qualities: 'Qualités', creatures: 'Créatures', traits: 'Traits',
  mutations: 'Mutations', spells: 'Sorts', domains: 'Domaines', gods: 'Cultes', maneuvers: 'Manœuvres',
  weaponGroups: 'Groupes d’objet', characteristics: 'Caractéristiques',
};
const REVERSE_TITLE: Record<string, string> = {
  'traits:creatures': 'Créatures ayant ce trait',
  'traits:mutations': 'Mutations conférant ce trait',
  'skills:races': 'Races', 'skills:careers': 'Carrières (par rang)', 'skills:talents': 'Talents le conférant', 'skills:creatures': 'Créatures',
  'talents:races': 'Races', 'talents:careers': 'Carrières (par rang)', 'talents:talents': 'Talents le conférant', 'talents:creatures': 'Créatures',
  'characteristics:skills': 'Compétences liées', 'characteristics:careers': 'Carrières (avancée)', 'characteristics:talents': 'Talents (bonus de départ)',
  'classes:careers': 'Carrières de la classe',
  'careers:races': 'Races y accédant',
  'trappings:creatures': 'Créatures la possédant', 'trappings:careers': 'Carrières (par rang)', 'trappings:classes': 'Possession de classe',
  'qualities:trappings': 'Équipements ayant cette qualité',
  'spells:gods': 'Cultes (Bénédictions / Miracles)', 'spells:creatures': 'Créatures la lançant',
  'domains:spells': 'Sorts du domaine',
  'maneuvers:traits': 'Traits l’accordant',
  'weaponGroups:trappings': 'Objets du groupe',
  'etats:spells': 'Sorts l’infligeant', 'etats:traits': 'Traits l’infligeant', 'etats:qualities': 'Qualités d’arme l’infligeant',
  'etats:talents': 'Talents l’infligeant', 'etats:domains': 'Domaines l’infligeant',
  'mutations:mutationTables': 'Tables de Corruption la tirant', 'locations:locations': 'Sous-lieux',
};
const reverseTitle = (targetCat: string, refCat: string): string =>
  REVERSE_TITLE[`${targetCat}:${refCat}`] ?? GENERIC_PLURAL[refCat] ?? refCat;

/** Ordre stable des catégories (référants d'une fiche ET contenu d'un livre) — les plus parlantes
 *  d'abord ; une catégorie hors liste est repoussée en fin (via `orderOf`). */
const REF_CAT_ORDER = ['races', 'classes', 'careers', 'characteristics', 'skills', 'talents', 'creatures', 'mutations', 'mutationTables', 'trappings', 'qualities', 'weaponGroups', 'spells', 'domains', 'gods', 'traits', 'maneuvers', 'etats', 'maladies', 'stars', 'locations'];
const orderOf = (cat: string): number => (REF_CAT_ORDER.indexOf(cat) + 1) || 99;

/**
 * Références INVERSES d'une entité (category, id) — GROUPÉES par catégorie de référant, dédupliquées
 * (un même référant à plusieurs rangs fusionne ses détails), triées (ordre stable puis alpha).
 * Vide si l'entité n'est référencée nulle part. Source unique des sections « inverses » du Codex.
 */
export function reverseGroups(category: string, id: string): ReverseGroup[] {
  const raw = REVERSE.get(rkey(category, id));
  if (!raw?.length) return [];
  const byCat = new Map<string, Map<string, Referrer>>(); // refCat → (label → référant fusionné)
  for (const r of raw) {
    const m = byCat.get(r.category) ?? new Map<string, Referrer>();
    const prev = m.get(r.label);
    if (prev) {
      // Fusion des détails distincts (« N1 » + « N2 » → « N1, N2 »).
      const details = new Set([...(prev.detail ? prev.detail.split(', ') : []), ...(r.detail ? [r.detail] : [])]);
      prev.detail = details.size ? [...details].join(', ') : undefined;
    } else m.set(r.label, { ...r });
    byCat.set(r.category, m);
  }
  const groups: ReverseGroup[] = [];
  for (const cat of [...byCat.keys()].sort((a, b) => orderOf(a) - orderOf(b))) {
    const referrers = [...byCat.get(cat)!.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    groups.push({ category: cat, title: reverseTitle(category, cat), referrers });
  }
  return groups;
}

// ── Index par LIVRE + index de libellés (auto-liage) ────────────────────────────────────────────
/** Une entité cataloguée : sa catégorie Codex, son libellé, son livre/page source. */
interface CatalogEntry { category: string; label: string; book?: string; page?: number; }

/** Liste plate de TOUTES les entités cataloguées (pour byBook + labelIndex). Une passe, au chargement. */
const CATALOG: CatalogEntry[] = [];
const pushCatalog = (category: string, items: { label: string; source?: { book: string; page: number } | null }[]): void => {
  for (const it of items) CATALOG.push({ category, label: it.label, book: it.source?.book, page: it.source?.page });
};
pushCatalog('races', species);
pushCatalog('careers', careers);
pushCatalog('classes', classes);
pushCatalog('skills', skills);
pushCatalog('talents', talents);
pushCatalog('trappings', trappings);
pushCatalog('qualities', qualities as { label: string; source?: { book: string; page: number } }[]);
pushCatalog('etats', etats);
pushCatalog('maneuvers', maneuvers);
pushCatalog('domains', domains as { label: string; source?: { book: string; page: number } }[]);
pushCatalog('spells', spells);
pushCatalog('creatures', creatures as { label: string; source?: { book: string; page: number } }[]);
pushCatalog('traits', traits);
pushCatalog('mutations', mutations as { label: string; source?: { book: string; page: number } | null }[]);
pushCatalog('stars', stars);
pushCatalog('locations', locations as { label: string; source?: { book: string; page: number } }[]);
pushCatalog('characteristics', characteristics as { label: string }[]);
CATALOG.push(...gods.map((g) => ({ category: 'gods', label: g.key, book: g.source?.book, page: g.source?.page })));
CATALOG.push(...maladies.map((m) => ({ category: 'maladies', label: m.name })));

/** Contenu d'un livre, GROUPÉ par catégorie (« par type ») — pour la fiche Livre. Les entités portent
 *  leur livre dans `source.book` (ABRÉVIATION, ex. « LDB ») ; on accepte plusieurs clés d'identité
 *  (abr ET libellé) pour tolérer les deux conventions. Trié par catégorie (`orderOf`) puis alpha. */
export function bookContents(...bookKeys: (string | undefined)[]): { category: string; labels: string[] }[] {
  const keys = new Set(bookKeys.filter((k): k is string => !!k));
  const byCat = new Map<string, string[]>();
  for (const e of CATALOG) {
    if (!e.book || !keys.has(e.book)) continue;
    const arr = byCat.get(e.category) ?? [];
    arr.push(e.label);
    byCat.set(e.category, arr);
  }
  return [...byCat.entries()]
    .map(([category, labels]) => ({ category, labels: labels.sort((a, b) => a.localeCompare(b, 'fr')) }))
    .sort((a, b) => orderOf(a.category) - orderOf(b.category));
}

/**
 * Index d'auto-liage (LOCALE-SCOPED) : libellé normalisé (minuscule, sans accent) → (category, label)
 * de l'entité à lier. Construit depuis les libellés de la LOCALE active (ici FR) → 100 %
 * langue-agnostique de principe (dérivé des données, jamais une chaîne FR en dur). Les libellés
 * ambigus (même texte pour 2 entités) et trop courts (< 4) sont ÉCARTÉS pour ne pas sur-lier.
 */
let LABEL_INDEX: Map<string, { category: string; label: string }> | null = null;
const deburrLower = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function labelIndex(): Map<string, { category: string; label: string }> {
  if (LABEL_INDEX) return LABEL_INDEX;
  const seen = new Map<string, { category: string; label: string } | null>();
  for (const e of CATALOG) {
    const key = deburrLower(e.label);
    if (key.length < 4) continue;
    seen.set(key, seen.has(key) ? null : { category: e.category, label: e.label }); // collision → null (ambigu)
  }
  LABEL_INDEX = new Map([...seen.entries()].filter((x): x is [string, { category: string; label: string }] => x[1] != null));
  return LABEL_INDEX;
}

/** Catégories dont le VOCABULAIRE apparaît en prose (règles) → auto-liées dans les descriptions.
 *  On EXCLUT les noms propres (créatures/sorts/objets/lieux…) : ils bloatent le matcher et sur-lient. */
const LINKABLE_CATS = new Set(['characteristics', 'skills', 'talents', 'etats', 'maneuvers', 'traits', 'qualities', 'domains']);
/** Un fragment de prose tokenisé : texte brut, OU une mention d'entité à lier (category+label). */
export type LinkToken = string | { category: string; label: string; text: string };
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let LINK_RE: RegExp | null = null;
/** Regex (construite UNE fois) des libellés auto-liables, plus longs d'abord (« Magie des Arcanes »
 *  avant « Magie »), bornée aux frontières de mot Unicode (gère accents/apostrophes français). */
function linkRe(): RegExp {
  if (LINK_RE) return LINK_RE;
  const labels = [...new Set([...labelIndex().values()].filter((v) => LINKABLE_CATS.has(v.category)).map((v) => v.label))]
    .sort((a, b) => b.length - a.length);
  LINK_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${labels.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return LINK_RE;
}

/**
 * Tokenise une prose en alternant texte brut et mentions d'entité à LIER (auto-liage du Codex,
 * façon `dev.html`). PUR & locale-scoped (matcher dérivé des libellés de la locale active, jamais
 * une chaîne FR en dur → multilingue de principe). Écarte les liens vers SOI (`selfLabel`) et les
 * libellés ambigus/courts (déjà filtrés par `labelIndex`). Seul le vocabulaire de RÈGLES est lié.
 */
export function tokenizeLinks(text: string, selfLabel?: string): LinkToken[] {
  const re = linkRe();
  re.lastIndex = 0;
  const out: LinkToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const hit = labelIndex().get(deburrLower(m[1]));
    if (!hit || hit.label === selfLabel) continue; // inconnu / auto-référence → laissé en texte
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ category: hit.category, label: hit.label, text: m[1] });
    last = m.index + m[1].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
