/**
 * Registre du Codex — SOURCE UNIQUE des catégories consultables en jeu.
 *
 * Chaque catégorie projette un tableau de `src/data` (façade `index.ts`) en `CodexItem` RICHE :
 * faits-clés + **sections structurées** dont les entités citées (compétences, talents, sorts,
 * traits, qualités…) sont des **liens `CodexRef`** vers leur propre fiche (cross-références).
 * **Ajouter une catégorie = UNE entrée dans `CODEX`** ; enrichir = ajouter des sections (data),
 * pas un composant.
 */
import {
  species, careers, characteristics, classes, skills, talents,
  qualities, trappings, etats, maladies, creatures, traits, spells, maneuvers, domains, mutations, mutationTables, gods,
  stars, locations, books, levelsForCareer, skillRefLabel, talentRefLabel, refLabel, trappingRefLabel, qualityRefLabel, advancementLabel,
  skillInstanceLabel, talentConcrete, careersForSpecies, findClassById, eyes, hairs, details,
} from '../../data';
import { statName } from '../../engine/statEntry';
import { splitTopLevelOu } from '../../engine/careerSlots';
import { ATTACK_LABEL } from '../../engine/creatureAttacks';
import { traitLabels } from '../../engine/traits/dispatch';
import { CHAR_KEYS, CHAR_LABELS, HIT_LOCATION_LABELS, type Combatant, type HitLocation } from '../../engine/types';
import { SIZE_LABEL, effectiveSize } from '../../engine/size';
import { costPerEnc } from '../../engine/harvest';
import { formatMoney } from '../../engine/money';
import type { EntityAppearance } from '../../state/scene';
import type { MutationData } from '../../data/mutations';
import { passiveSection, effectsSection } from './describe';

export type CodexGroup = 'Personnage' | 'Compétences' | 'Équipement' | 'Effets' | 'Magie' | 'Monde';

/** Ordre d'affichage des familles (onglets du haut). */
export const CODEX_GROUPS: CodexGroup[] = ['Personnage', 'Compétences', 'Équipement', 'Effets', 'Magie', 'Monde'];

export interface CodexSource {
  book: string;
  page: number;
}
export interface CodexFact {
  label: string;
  value: string;
}
/** Une ligne d'une section. */
export type CodexRow =
  | { t: 'text'; text: string; html?: boolean }
  | { t: 'kv'; k: string; v: string }
  /** Lien vers une autre fiche. `label` = clé de résolution (base) ; `show` = libellé affiché,
   *  qui PORTE les Indices (« 8 Tentacules +8 ») et est transmis au Codex/popover comme instance. */
  | { t: 'ref'; category: string; label: string; show: string }
  /** CHOIX « A ou B » : chaque option est un lien cross-réf cliquable, séparées par « ou ». */
  | { t: 'choice'; category: string; options: { label: string; show: string }[] }
  /** Mini sous-en-tête à l'intérieur d'une section (« Compétences », « Talents »…). */
  | { t: 'sub'; label: string };
export interface CodexSection {
  title: string;
  layout?: 'list' | 'chips' | 'grid';
  rows: CodexRow[];
}
/** Regroupement EXPLICITE de sections en UN onglet de fiche (ex. « Profil » = carac+compétences+
 *  talents). Quand une catégorie le fournit, l'onglet groupe ses sections ; sinon = un onglet/section. */
export interface CodexTab {
  title: string;
  sections: CodexSection[];
}
/** Entrée normalisée, rendue uniformément par `CodexEntry`. */
export interface CodexItem {
  label: string;
  sub?: string;
  /** Groupe pour la liste hiérarchique (famille de race, classe de carrière, dossier de créature…). */
  group?: string;
  meta?: CodexFact[];
  /** Sections riches (statbloc, niveaux de carrière, bénédictions…) avec liens cross-réf. */
  sections?: CodexSection[];
  /** Regroupement EXPLICITE des sections en onglets (sinon : un onglet par section). */
  tabs?: CodexTab[];
  /** Corps prose : texte simple, OU HTML si `html` (lore des Dieux/Livres). */
  desc?: string;
  html?: boolean;
  source?: CodexSource | null;
  /** Apparence (rig) à prévisualiser dans la fiche : créature, difformité de mutation, trait à visuel. */
  appearance?: EntityAppearance;
  /** `id` de créature pour résoudre l'aperçu rig PAR ID (Nuées/non-bipèdes lisent leurs traits du record). */
  previewRef?: string;
}
export interface CodexCategory {
  key: string;
  label: string;
  group: CodexGroup;
  items: CodexItem[];
}

const src = (s: { book?: string; page?: number } | null | undefined): CodexSource | null =>
  s && s.book ? { book: s.book, page: s.page ?? 0 } : null;

const fact = (label: string, value: unknown): CodexFact | null =>
  value == null || value === '' || value === '–' ? null : { label, value: String(value) };

const facts = (...xs: (CodexFact | null)[]): CodexFact[] => xs.filter((x): x is CodexFact => x != null);

const join = (...parts: (string | null | undefined)[]): string | undefined => {
  const s = parts.filter(Boolean).join(' · ');
  return s || undefined;
};

/** Famille d'une race/variante : « Humains (Reiklander) » → « Humains ». */
const family = (label: string): string => label.split(' (')[0].trim();

/** Lien cross-réf : nom canonique pour le lookup (via le parseur PARTAGÉ `parseStatEntry` —
 *  « 8 Tentacules +8 » → « Tentacules »), libellé complet conservé pour l'affichage + l'instance. */
const refRow = (category: string, raw: string): CodexRow => ({ t: 'ref', category, label: statName(raw), show: raw.trim() });
const refRows = (category: string, items?: string[] | null): CodexRow[] => (items ?? []).map((s) => refRow(category, s));
const kvRows = (pairs: [string, unknown][]): CodexRow[] =>
  pairs
    .filter(([, v]) => v != null && v !== '' && v !== '–')
    .map(([k, v]) => ({ t: 'kv', k, v: String(v) } as CodexRow));

/** Section de pastilles cross-réf (skip si vide). */
const chips = (title: string, category: string, items?: string[] | null): CodexSection | null =>
  items && items.length ? { title, layout: 'chips', rows: refRows(category, items) } : null;

/** Compose des sections en écartant les vides/null. */
const sections = (...xs: (CodexSection | null | undefined | false)[]): CodexSection[] =>
  xs.filter((s): s is CodexSection => !!s && s.rows.length > 0);

/** Libellés FR du déclenchement / ciblage d'une Manœuvre (Codex). */
const MANEUVER_ACTIVATION_LABEL: Record<string, string> = { action: 'Action', free: 'Gratuite', charge: 'À la Charge' };
const MANEUVER_TARGETING_LABEL: Record<string, string> = { melee: 'Mêlée', ranged: 'Distance', zone: 'Zone', allFoes: 'Tous les ennemis' };

/**
 * SOURCE UNIQUE du contenu structuré d'une fiche de race — onglets Profil / Carrières / Détails.
 * Consommée par le Codex (`registry.races`) ET la page de race du créateur (`SpeciesZones`), pour
 * qu'elles ne puissent plus diverger. Données tirées des MÊMES tables que le créateur
 * (`careersForSpecies`, `details`, `eyes`, `hairs`). Les faits-clés (M/Destin/Résilience) restent en
 * en-tête (méta), pas ici ; le tirage aléatoire (création) est ajouté PAR le créateur.
 */
/** Une ENTRÉE de compétence/talent de race : « A ou B » → ligne de CHOIX (chaque option cliquable),
 *  sinon un simple lien cross-réf. PARTAGÉE (Codex + créateur) → split identique des deux côtés. */
const choiceOrRef = (category: string, entry: string): CodexRow => {
  const opts = splitTopLevelOu(entry);
  return opts.length > 1
    ? { t: 'choice', category, options: opts.map((o) => ({ label: statName(o), show: o })) }
    : refRow(category, entry);
};

/** Section « Caractéristiques de base » d'une race — chaque carac affiche son écart racial (±). */
export function raceCharSection(s: (typeof species)[number]): CodexSection {
  const rows: CodexRow[] = CHAR_KEYS.map((k) => {
    const base = s.baseChar?.[k] ?? 20;
    const diff = base - 20;
    return { t: 'kv', k, v: diff !== 0 ? `${base} (${diff > 0 ? '+' : ''}${diff})` : String(base) };
  });
  return { title: 'Caractéristiques de base', layout: 'grid', rows };
}

/** Section « Compétences de race » — chips cliquables, « A ou B » éclaté en choix. */
export function raceSkillSection(s: (typeof species)[number]): CodexSection | null {
  const rows = s.skills.map((a) => choiceOrRef('skills', advancementLabel('skills', a)));
  return rows.length ? { title: 'Compétences de race', layout: 'chips', rows } : null;
}

/** Section « Talents de race » — chips cliquables, « A ou B » éclaté en choix. */
export function raceTalentSection(s: (typeof species)[number]): CodexSection | null {
  const rows = s.talents.map((a) => choiceOrRef('talents', advancementLabel('talents', a)));
  return rows.length ? { title: 'Talents de race', layout: 'chips', rows } : null;
}

/** Section « Carrières accessibles » d'une race — groupées par classe, cliquables (→ fiche carrière). */
export function raceCareerSection(s: (typeof species)[number]): CodexSection | null {
  const accessible = careersForSpecies(s.refCareer);
  const rows: CodexRow[] = [];
  for (const cl of classes) {
    const list = accessible.filter((c) => c.class === cl.id);
    if (list.length) rows.push({ t: 'sub', label: cl.label }, ...list.map((c) => refRow('careers', c.label)));
  }
  return rows.length ? { title: 'Carrières accessibles', layout: 'chips', rows } : null;
}

/** Section « Détails » d'une race — âge, taille, yeux & cheveux, noms (tables de création). */
export function raceDetailSection(s: (typeof species)[number]): CodexSection {
  const ref = s.refChar;
  const txt = details.texts;
  const eyeColors = [...new Set(eyes.map((e) => e.color[ref]).filter(Boolean))];
  const hairColors = [...new Set(hairs.map((e) => e.color[ref]).filter(Boolean))];
  const rows: CodexRow[] = [
    { t: 'sub', label: 'Âge' },
    { t: 'text', text: `${details.ageBase[ref] ?? details.ageBase['Humain']} + ${Math.round(details.ageRoll[ref] ?? 1)}d10 ans` },
  ];
  if (txt.age.bySpecies[ref]) rows.push({ t: 'text', text: txt.age.bySpecies[ref], html: true });
  rows.push({ t: 'sub', label: 'Taille' }, { t: 'text', text: `${details.heightBase[ref] ?? details.heightBase['Humain']} + ${Math.round(details.heightRoll[ref] ?? 1)}d10 cm` });
  const tailleTxt = txt.taille.bySpecies[ref] ?? txt.taille.all;
  if (tailleTxt) rows.push({ t: 'text', text: tailleTxt, html: true });
  if (eyeColors.length) rows.push({ t: 'sub', label: 'Yeux' }, { t: 'text', text: eyeColors.join(', ') });
  if (hairColors.length) rows.push({ t: 'sub', label: 'Cheveux' }, { t: 'text', text: hairColors.join(', ') });
  const namesTxt = txt.nom.bySpecies[ref] ?? txt.nom.bySpecies['Humain'];
  if (namesTxt) rows.push({ t: 'sub', label: 'Noms' }, { t: 'text', text: namesTxt, html: true });
  return { title: 'Âge, taille & apparence', layout: 'list', rows };
}

export function raceFicheTabs(s: (typeof species)[number]): CodexTab[] {
  const career = raceCareerSection(s);
  return [
    { title: 'Profil', sections: sections(raceCharSection(s), raceSkillSection(s), raceTalentSection(s)) },
    ...(career ? [{ title: 'Carrières', sections: [career] }] : []),
    { title: 'Détails', sections: [raceDetailSection(s)] },
  ];
}

export const CODEX: CodexCategory[] = [
  {
    key: 'races', label: 'Races', group: 'Personnage',
    items: species.map((s) => ({
      label: s.label,
      group: family(s.label),
      desc: s.desc,
      html: true, // desc = HTML (mêmes données que le créateur, qui le rend via LoreText)
      source: src(s.source),
      // Aperçu rig DATA-DRIVEN (même chemin que le créateur) : la fiche de race montre sa silhouette.
      appearance: { species: s.label },
      meta: facts(fact('Mouvement', s.movement), fact('Destin', s.fate?.fate), fact('Résilience', s.fate?.resilience)),
      // Contenu = SOURCE UNIQUE partagée avec le créateur (plus de ré-implémentation divergente).
      tabs: raceFicheTabs(s),
    })),
  },
  {
    key: 'careers', label: 'Carrières', group: 'Personnage',
    items: careers.map((c) => ({
      label: c.label, sub: findClassById(c.class)?.label ?? c.class, group: findClassById(c.class)?.label ?? c.class, desc: c.desc, source: src(c.source),
      sections: levelsForCareer(c.id).map((lv) => ({
        title: `Niveau ${lv.level} : ${lv.label} — ${lv.status}`,
        layout: 'chips' as const,
        rows: [
          ...(lv.characteristics.length ? [{ t: 'sub', label: 'Caractéristiques avancées' } as CodexRow, { t: 'text', text: lv.characteristics.map((k) => CHAR_LABELS[k]).join(', ') } as CodexRow] : []),
          ...(lv.skills.length ? [{ t: 'sub', label: 'Compétences' } as CodexRow, ...refRows('skills', lv.skills.map((a) => advancementLabel('skills', a)))] : []),
          ...(lv.talents.length ? [{ t: 'sub', label: 'Talents' } as CodexRow, ...refRows('talents', lv.talents.map((a) => advancementLabel('talents', a)))] : []),
          ...(lv.trappings.length ? [{ t: 'sub', label: 'Possessions' } as CodexRow, ...refRows('trappings', lv.trappings.map(trappingRefLabel))] : []),
        ],
      })),
    })),
  },
  {
    key: 'characteristics', label: 'Caractéristiques', group: 'Personnage',
    items: (characteristics as { label: string; abr?: string; desc?: string; source?: CodexSource }[]).map((c) => ({
      label: c.label, sub: c.abr, desc: c.desc, source: src(c.source),
    })),
  },
  {
    key: 'classes', label: 'Classes', group: 'Personnage',
    items: classes.map((c) => ({
      label: c.label, desc: c.desc, source: src(c.source),
      sections: sections(chips('Possessions de départ', 'trappings', c.trappings.map(trappingRefLabel))),
    })),
  },
  {
    key: 'stars', label: 'Étoiles', group: 'Personnage',
    items: stars.map((s) => ({
      label: s.label, sub: s.signe ?? undefined, desc: s.desc ?? undefined, source: src(s.source),
      meta: facts(fact('Dates', s.dates), fact('Dieu', s.dieux), fact('Ascendant', s.ascendant)),
      sections: sections(passiveSection(s.effect, 'Effet du signe')),
    })),
  },
  {
    key: 'skills', label: 'Compétences', group: 'Compétences',
    items: skills.map((s) => ({ label: s.label, sub: join(s.characteristic, s.type), desc: s.desc, source: src(s.source) })),
  },
  {
    key: 'talents', label: 'Talents', group: 'Compétences',
    items: talents.map((t) => ({
      label: t.label, desc: t.desc, source: src(t.source),
      meta: facts(fact('Max', t.max), fact('Test', t.test)),
      sections: sections(
        t.addCharacteristic || t.addSkill || t.addTalent
          ? {
              title: 'Effet mécanique', layout: 'chips',
              rows: [
                ...(t.addCharacteristic ? [{ t: 'kv', k: '+5 à', v: t.addCharacteristic } as CodexRow] : []),
                ...(t.addSkill ? [refRow('skills', t.addSkill)] : []),
                ...(t.addTalent ? [refRow('talents', t.addTalent)] : []),
              ],
            }
          : null,
      ),
    })),
  },
  {
    key: 'trappings', label: 'Possessions', group: 'Équipement',
    items: trappings.map((t) => ({
      label: t.label, sub: join(t.type, t.subType), desc: t.desc ?? undefined, html: true, source: src(t.source),
      meta: facts(fact('Enc', t.enc), fact('Disponibilité', t.availability), fact('Dégâts', t.damage), fact('PA', t.pa), fact('Allonge', t.reach)),
      sections: sections(chips('Qualités', 'qualities', t.qualities.map(qualityRefLabel))),
    })),
  },
  {
    key: 'qualities', label: 'Qualités', group: 'Équipement',
    items: (qualities as { label: string; type?: string; subType?: string; desc?: string; source?: CodexSource; passive?: import('../../engine/ops').GameOp[] }[]).map((q) => ({
      label: q.label, sub: join(q.type, q.subType), desc: q.desc, html: true, source: src(q.source),
      sections: sections(passiveSection(q.passive)),
    })),
  },
  {
    key: 'etats', label: 'États', group: 'Effets',
    items: etats.map((e) => ({ label: e.label, desc: e.desc, source: src(e.source) })),
  },
  {
    key: 'maladies', label: 'Maladies', group: 'Effets',
    items: maladies.map((m) => ({ label: m.name, sub: m.symptoms.map((s) => s.kind).join(', ') })),
  },
  {
    key: 'mutations', label: 'Mutations', group: 'Effets',
    items: (mutations as MutationData[]).map((m) => ({
      label: m.label,
      sub: m.kind === 'physique' ? 'Physique' : 'Mentale',
      group: m.kind === 'physique' ? 'Physiques' : 'Mentales',
      desc: m.note ?? undefined,
      appearance: m.appearance,
      meta: facts(
        fact('PA (toutes localisations)', m.apAll),
        fact('PA localisé', m.apLocations ? Object.entries(m.apLocations).map(([loc, n]) => `${HIT_LOCATION_LABELS[loc as HitLocation] ?? loc} +${n}`).join(', ') : null),
        fact('Arme naturelle', m.derivedWeapon ? `${m.derivedWeapon.name} (${m.derivedWeapon.damage})` : null),
      ),
      sections: sections(passiveSection(m.passive), chips('Traits conférés', 'traits', traitLabels(m.traits))),
    })),
  },
  {
    key: 'mutationTables', label: 'Tables de Corruption', group: 'Effets',
    items: (mutationTables as { label: string; ranges: unknown[] }[]).map((t) => ({ label: t.label, sub: `${t.ranges.length} plages d100` })),
  },
  {
    key: 'maneuvers', label: 'Manœuvres', group: 'Effets',
    items: maneuvers.map((m) => ({
      label: m.label, sub: ATTACK_LABEL[m.kind], desc: m.desc, source: src(m.source),
      meta: facts(
        fact('Activation', MANEUVER_ACTIVATION_LABEL[m.activation]),
        fact('Coût Av', m.advantageCost),
        fact('Portée', m.range),
        fact('Cible', MANEUVER_TARGETING_LABEL[m.targeting]),
      ),
    })),
  },
  {
    key: 'domains', label: 'Domaines', group: 'Magie',
    items: domains.map((d) => ({
      label: d.label, desc: d.desc, source: src(d.source),
      meta: facts(
        fact('Projectile', d.missile ? `ignore les PA ${d.missile.bypass === 'metal' ? 'métalliques' : 'non magiques'}${d.missile.bonusFromBypass ? ' (+ Dégâts)' : ''}` : null),
        fact('Bonus d’incantation', d.castBonus ? `+${d.castBonus.bonus} par « ${d.castBonus.perCondition} » à ≤ B${d.castBonus.radiusStat} m` : null),
        fact('Post-incantation', d.afterCast?.grantTrait ? `${d.afterCast.grantTrait} (1d${d.afterCast.durationDice ?? 1} Rounds)` : null),
      ),
      sections: sections(effectsSection(d.effects, 'Riders à la touche')),
    })),
  },
  {
    key: 'spells', label: 'Sorts', group: 'Magie',
    items: spells.map((s) => ({
      label: s.label, sub: join(s.type, s.subType), desc: s.desc, html: true, source: src(s.source),
      meta: facts(fact('NI', s.cn), fact('Portée', s.range), fact('Cible', s.target), fact('Durée', s.duration)),
    })),
  },
  {
    key: 'gods', label: 'Dieux', group: 'Magie',
    items: gods.map((c) => ({
      label: c.key, sub: c.title, desc: c.desc, html: true, source: c.source ?? null,
      sections: sections(
        chips('Bénédictions', 'spells', c.blessings.map((b) => refLabel('spells', b))),
        chips('Miracles', 'spells', c.miracles.map((m) => refLabel('spells', m))),
      ),
    })),
  },
  {
    key: 'creatures', label: 'Créatures', group: 'Monde',
    items: creatures.map((c) => ({
      label: c.label, sub: c.title ?? undefined, group: c.folder ?? undefined, desc: c.desc ?? undefined, html: true, source: src(c.source),
      appearance: c.appearance, previewRef: c.id, // aperçu rig résolu par id (Nuées/non-bipèdes lisent leurs traits)
      meta: c.harvest ? facts(fact('Récolte (1 Enc)', formatMoney(costPerEnc(c.harvest)))) : undefined,
      sections: sections(
        { title: 'Caractéristiques', layout: 'grid', rows: kvRows(Object.entries(c.char)) },
        chips('Traits', 'traits', traitLabels(c.traits)),
        chips('Traits optionnels', 'traits', traitLabels(c.optionals)),
        chips('Compétences', 'skills', c.skills.map(skillRefLabel)), // SkillRef[] → libellés « Calme 58 »
        chips('Talents', 'talents', c.talents.map(talentRefLabel)), // TalentRef[] → libellés « Magie des Arcanes (Ghur) »
        chips('Sorts', 'spells', c.spells.map((s) => refLabel('spells', s))),
        chips('Possessions', 'trappings', c.trappings.map(trappingRefLabel)),
        c.harvest
          ? {
              title: 'Récolte (Précieuses Entrailles)',
              layout: 'list',
              rows: [
                { t: 'kv', k: 'Rareté', v: c.harvest.rarity },
                { t: 'kv', k: 'Dangerosité', v: c.harvest.danger },
                { t: 'kv', k: 'Valeur (1 Enc, conservé)', v: formatMoney(costPerEnc(c.harvest)) },
                { t: 'text', text: c.harvest.uses },
              ],
            }
          : null,
      ),
    })),
  },
  {
    key: 'traits', label: 'Traits', group: 'Monde',
    items: traits.map((t) => ({
      label: t.label, sub: t.prefix ?? undefined, desc: t.desc, html: true, source: src(t.source), appearance: t.appearance,
      sections: sections(
        chips('Manœuvres conférées', 'maneuvers', (t.grantsManeuvers ?? []).map((r) => refLabel('maneuvers', r))),
        passiveSection(t.passive), effectsSection(t.effects),
      ),
    })),
  },
  {
    key: 'locations', label: 'Lieux', group: 'Monde',
    items: locations.map((l) => ({ label: l.label, sub: l.parent ?? undefined, group: l.parent ?? undefined, desc: l.desc ?? undefined, source: src(l.source) })),
  },
  {
    key: 'books', label: 'Livres', group: 'Monde',
    items: books.map((b) => ({ label: b.label, sub: b.abr ?? b.folder ?? undefined, group: b.folder ?? undefined, desc: b.desc ?? undefined, html: true })),
  },
];

/** Catégories d'une famille, dans l'ordre de déclaration. */
export const categoriesIn = (group: CodexGroup): CodexCategory[] => CODEX.filter((c) => c.group === group);

/** Catégorie par clé. */
export const categoryByKey = (key: string): CodexCategory | undefined => CODEX.find((c) => c.key === key);

/** Résout une entrée (catégorie + libellé) → sa fiche, pour les liens `CodexRef`.
 *  Exact d'abord, puis casse ignorée (les libellés à spécialisation s'écrivent parfois autrement). */
export function codexLookup(category: string, label: string): CodexItem | undefined {
  const items = categoryByKey(category)?.items;
  if (!items) return undefined;
  return items.find((i) => i.label === label) ?? items.find((i) => i.label.toLowerCase() === label.toLowerCase());
}

const ARMOUR_LOCS: HitLocation[] = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];

/** Statbloc d'un combattant VIVANT (valeurs réelles : carac, armes/armure dérivées, états déjà à
 *  part) en sections — MÊME rendu que la fiche Codex (CodexEntry/CodexSections). Sert l'inspection
 *  d'un ennemi en combat sans recopier un panneau partiel. TOUTES les caracs (« – » si inexistante). */
export function combatantSections(c: Combatant): CodexSection[] {
  const ch = c.characteristics;
  const charRows: CodexRow[] = [
    { t: 'kv', k: 'M', v: String(c.movement) },
    ...CHAR_KEYS.map((k) => ({ t: 'kv', k, v: ch[k] > 0 || c.kind === 'hero' ? String(ch[k]) : '–' } as CodexRow)),
    { t: 'kv', k: 'Taille', v: SIZE_LABEL[effectiveSize(c.size)] },
  ];
  const skillRows: CodexRow[] = (c.skills ?? []).map((s) =>
    refRow('skills', `${skillInstanceLabel(s)} ${(ch[s.characteristic] ?? 0) + s.advances}`),
  );
  const weaponRows: CodexRow[] = (c.weapons ?? []).map((w) => ({ t: 'text', text: `${w.name} (${w.damage})` }));
  const worn = ARMOUR_LOCS.filter((l) => (c.armour?.[l] ?? 0) > 0);
  return sections(
    { title: 'Caractéristiques', layout: 'grid', rows: charRows },
    weaponRows.length ? { title: 'Armes', layout: 'list', rows: weaponRows } : null,
    worn.length ? { title: 'Armure', layout: 'list', rows: [{ t: 'text', text: worn.map((l) => `${HIT_LOCATION_LABELS[l]} ${c.armour![l]}`).join(' · ') }] } : null,
    chips('Traits', 'traits', traitLabels(c.traits)),
    skillRows.length ? { title: 'Compétences', layout: 'chips', rows: skillRows } : null,
    chips('Talents', 'talents', (c.talents ?? []).map((t) => talentConcrete(t))),
    chips('Sorts', 'spells', (c.spells ?? []).map((id) => refLabel('spells', { id }))),
  );
}
