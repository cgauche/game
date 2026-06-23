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
  qualities, trappings, weaponGroups, etats, maladies, creatures, traits, spells, maneuvers, domains, mutations, mutationTables, gods,
  stars, locations, findLocationById, books, careerLevels, raceAppearance, levelsForCareer, skillRefLabel, talentRefLabel, refLabel, trappingRefLabel, qualityRefLabel, advancementLabel, weaponGroupLabel,
  skillInstanceLabel, talentConcrete, careersForSpecies, findCareerById, findClassById, findSpeciesById, eyes, hairs, details, names,
  pregens, oups, interludeEvents, peripeties, psychologyLabel,
} from '../../data';
import { statName } from '../../engine/statEntry';
import { talentMaxLabel } from '../../engine/careerSlots';
import type { AdvancementRef } from '../../data';
import { ATTACK_LABEL } from '../../engine/creatureAttacks';
import { traitLabels } from '../../engine/traits/dispatch';
import { CHAR_KEYS, CHAR_LABELS, HIT_LOCATION_LABELS, DIFFICULTY_LABELS, type Combatant, type HitLocation } from '../../engine/types';
import { SIZE_LABEL, effectiveSize } from '../../engine/size';
import { formatDice } from '../../engine/dice';
import { costPerEnc } from '../../engine/harvest';
import { formatMoney, priceToMoney } from '../../engine/money';
import type { EntityAppearance } from '../../state/scene';
import type { MutationData } from '../../data/mutations';
import { passiveSection, effectsSection, careerGrantSection, spellFlowSection, capabilitySection } from './describe';
import { reverseGroups, bookContents } from './relations';

export type CodexGroup = 'Personnage' | 'Compétences' | 'Équipement' | 'Effets' | 'Magie' | 'Monde' | 'Tables';

/** Ordre d'affichage des familles (onglets du haut). */
export const CODEX_GROUPS: CodexGroup[] = ['Personnage', 'Compétences', 'Équipement', 'Effets', 'Magie', 'Monde', 'Tables'];

/**
 * Identité GÉNÉRIQUE d'une entrée de dataset — clé STABLE servant À LA FOIS de `CodexItem.label`
 * (ce que le navigateur passe à l'éditeur) ET de cible du `findIndex` côté `CodexEdit`. Précédence
 * `label → name → key → id` (couvre gods keyé `key`, maladies keyées `name`, raceAppearance keyé `id`,
 * pregens keyés `name`…). EXCEPTION careerLevels : pas de clé mono-champ UNIQUE (le même libellé de
 * niveau « Recrue » revient sur plusieurs carrières) → composite carrière + niveau, identique des deux
 * côtés (l'éditeur réécrit la bonne entrée, plus de collision sur le 1er homonyme).
 */
export function entryKey(e: Record<string, unknown>): string {
  if (typeof e.career === 'string' && typeof e.level === 'number')
    return `${findCareerById(e.career)?.label ?? e.career} · N${e.level} ${e.label ?? ''}`.trim();
  return String(e.label ?? e.name ?? e.key ?? e.id ?? '');
}

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
  | { t: 'text'; text: string }
  | { t: 'kv'; k: string; v: string }
  /** Lien vers une autre fiche. `label` = clé de résolution (base) ; `show` = libellé affiché,
   *  qui PORTE les Indices (« 8 Tentacules +8 ») et est transmis au Codex/popover comme instance.
   *  `badge` = annotation de fin NON cliquable (rang « N2 », « facultatif », « Bénédiction »…). */
  | { t: 'ref'; category: string; label: string; show: string; badge?: string }
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
  /** Corps prose en **Markdown** (verbatim de la source), rendu par `<Prose>` (auto-liage des règles). */
  desc?: string;
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

/** Prix d'une possession (`{gold,silver,bronze}`) → libellé monnaie canon, ou null si gratuit/absent. */
const priceLabel = (p: { gold: number; silver: number; bronze: number } | null | undefined): string | null =>
  p && (p.gold || p.silver || p.bronze) ? formatMoney(priceToMoney(p)) : null;

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

/** Sections INVERSES d'une entité (« Créatures ayant ce trait », « Carrières par rang », « Talents le
 *  conférant »…) dérivées de la brique relationnelle id-based (`relations.ts`). Chaque groupe = une
 *  section de chips cross-réf cliquables ; le détail (rang/facultatif/Bénédiction) = badge non cliquable.
 *  Vide si l'entité n'est référencée nulle part. À SPREAD dans `sections(...)`. */
const reverseSections = (category: string, id: string | undefined): CodexSection[] =>
  id == null ? [] : reverseGroups(category, id).map((g) => ({
    title: g.title,
    layout: 'chips' as const,
    rows: g.referrers.map((r) => ({ t: 'ref', category: r.category, label: r.label, show: r.label, badge: r.detail } as CodexRow)),
  }));

/** Libellés FR du déclenchement / ciblage d'une Manœuvre (Codex). */
const MANEUVER_ACTIVATION_LABEL: Record<string, string> = { action: 'Action', free: 'Gratuite', charge: 'À la Charge' };
const MANEUVER_TARGETING_LABEL: Record<string, string> = { melee: 'Mêlée', ranged: 'Distance', zone: 'Zone', allFoes: 'Tous les ennemis' };
const WEAPON_GROUP_KIND_LABEL: Record<string, string> = { weapon: 'Groupe d’arme', ammo: 'Munitions', armour: 'Armure', inventory: 'Inventaire' };
/** Libellés FR des Symptômes de maladie (LDB 20) — affichage (la donnée porte le `kind` STABLE). */
const SYMPTOM_LABEL: Record<string, string> = {
  malaise: 'Malaise', blesse: 'Blessé', fievre: 'Fièvre', persistant: 'Persistant', toxine: 'Toxine',
  bubons: 'Bubons', convulsions: 'Convulsions', demangeaisons: 'Démangeaisons', gangrene: 'Gangrène',
  intoxication: 'Intoxication', nausee: 'Nausée', touxEternuements: 'Toux & éternuements',
};
/** Libellé d'un jet de dés (`{n,d,plus?}`) — « 1d10 », « 2d10+2 ». */
const diceLabel = formatDice;
/** Libellés FR des types de résultat « Oups ! » (Maladresse, LDB 12) — affichage (donnée = `kind` STABLE). */
const OUPS_KIND_LABEL: Record<string, string> = {
  selfWound: 'Auto-blessure', weaponDamageActLast: 'Arme abîmée + agit en dernier', actionPenalty: 'Malus d’Action',
  loseMovement: 'Perte de Mouvement', loseAction: 'Perte d’Action', trauma: 'Traumatisme', hitAlly: 'Touche un allié',
};
/** Libellés FR des CAPACITÉS de Trait (drapeaux booléens lus par le moteur — `TraitCapabilities`).
 *  Les capacités psy (psychType/psychImmune/psychIndice) sont surfacées à part (méta). */
const TRAIT_CAP_LABEL: Record<string, string> = {
  bonusWoundsBE: 'Blessures bonifiées (+BE)', swarm: 'Nuée', wardSave: 'Sauvegarde invulnérable',
  magicResistance: 'Résistance à la magie', damageImmunity: 'Immunité aux dégâts',
  counterOnDefenseWin: 'Contre-attaque (défense gagnée)', counterRequiresFastParry: 'Contre exige arme Rapide', unstable: 'Instable', painless: 'Insensible à la douleur',
  psychImmuneIfAhead: 'Immunité psy si en avantage', mindless: 'Sans esprit', bestial: 'Bestial',
  coldBlooded: 'Sang-froid', stupid: 'Stupidité', rage: 'Rage', territorial: 'Territorial', skittishMount: 'Monture ombrageuse',
  fly: 'Vol', leap: 'Bond', stride: 'Foulée', seesInDark: 'Vision nocturne',
};
/** Libellés FR des CAPACITÉS de Qualité d'arme/armure (`QualityCapabilities`). */
const QUALITY_CAP_LABEL: Record<string, string> = {
  fastStrike: 'Rapide', slowStrike: 'Lente', fumbleOn9: 'Dangereuse', pushback: 'Perturbante',
  bladeTrap: 'Piège-lame', damagesArmour: 'Endommage l’armure', firearm: 'Arme à feu', canFireWhileEngaged: 'Tir au contact',
  magazine: 'À répétition', salvo: 'Salve', areaFire: 'Tir de zone', crewedTeam: 'Arme d’équipe', parryAP: 'Protectrice',
  layerable: 'Flexible', critImmuneOdd: 'Impénétrable', apIgnoredOnEven: 'Partielle', apIgnoredOnImpaleCrit: 'Points faibles',
  unbreakable: 'Incassable', magic: 'Magique',
};

/**
 * SOURCE UNIQUE du contenu structuré d'une fiche de race — onglets Profil / Carrières / Détails.
 * Consommée par le Codex (`registry.races`) ET la page de race du créateur (`SpeciesZones`), pour
 * qu'elles ne puissent plus diverger. Données tirées des MÊMES tables que le créateur
 * (`careersForSpecies`, `details`, `eyes`, `hairs`). Les faits-clés (M/Destin/Résilience) restent en
 * en-tête (méta), pas ici ; le tirage aléatoire (création) est ajouté PAR le créateur.
 */
/** Une ENTRÉE de compétence/talent de race : « A ou B » (`choice`) → ligne de CHOIX (chaque option
 *  cliquable), sinon un simple lien cross-réf. Lit l'`AdvancementRef` STRUCTURÉ (plus de split de prose). */
const choiceOrRef = (category: string, a: AdvancementRef): CodexRow => {
  if ('choice' in a) {
    return { t: 'choice', category, options: a.choice.map((x) => { const lbl = advancementLabel(category, x); return { label: statName(lbl), show: lbl }; }) };
  }
  return refRow(category, advancementLabel(category, a));
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
  const rows = s.skills.map((a) => choiceOrRef('skills', a));
  return rows.length ? { title: 'Compétences de race', layout: 'chips', rows } : null;
}

/** Section « Talents de race » — chips cliquables, « A ou B » éclaté en choix. */
export function raceTalentSection(s: (typeof species)[number]): CodexSection | null {
  const rows = s.talents.map((a) => choiceOrRef('talents', a));
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
  if (txt.age.bySpecies[ref]) rows.push({ t: 'text', text: txt.age.bySpecies[ref] });
  rows.push({ t: 'sub', label: 'Taille' }, { t: 'text', text: `${details.heightBase[ref] ?? details.heightBase['Humain']} + ${Math.round(details.heightRoll[ref] ?? 1)}d10 cm` });
  const tailleTxt = txt.taille.bySpecies[ref] ?? txt.taille.all;
  if (tailleTxt) rows.push({ t: 'text', text: tailleTxt });
  if (eyeColors.length) rows.push({ t: 'sub', label: 'Yeux' }, { t: 'text', text: eyeColors.join(', ') });
  if (hairColors.length) rows.push({ t: 'sub', label: 'Cheveux' }, { t: 'text', text: hairColors.join(', ') });
  const namesTxt = txt.nom.bySpecies[ref] ?? txt.nom.bySpecies['Humain'];
  if (namesTxt) rows.push({ t: 'sub', label: 'Noms' }, { t: 'text', text: namesTxt });
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

/** SOURCE UNIQUE de la fiche d'un Trait (partagée par la catégorie « Traits » ET le filtre
 *  « Psychologie ») : manœuvres conférées + passifs + effets + réfs INVERSES (créatures/mutations) ;
 *  la capacité psy (LDB 21) remonte en méta (type + immunité + Indice fixe). */
const traitItem = (t: (typeof traits)[number]): CodexItem => {
  const cap = t.capabilities;
  return {
    label: t.label, sub: t.prefix ?? undefined, desc: t.desc, source: src(t.source), appearance: t.appearance,
    meta: facts(
      cap?.psychType ? fact('Psychologie', psychologyLabel(cap.psychType)) : null,
      cap?.psychImmune ? fact('Immunité', '(Psychologie)') : null,
      cap?.psychIndice != null ? fact('Indice', cap.psychIndice) : null,
    ),
    sections: sections(
      capabilitySection(cap as Record<string, unknown> | undefined, TRAIT_CAP_LABEL),
      chips('Manœuvres conférées', 'maneuvers', (t.grantsManeuvers ?? []).map((r) => refLabel('maneuvers', r))),
      passiveSection(t.passive), effectsSection(t.effects),
      ...reverseSections('traits', t.id), // Créatures ayant ce trait · Mutations le conférant
    ),
  };
};

export const CODEX: CodexCategory[] = [
  {
    key: 'races', label: 'Races', group: 'Personnage',
    items: species.map((s) => ({
      label: s.label,
      group: family(s.label),
      desc: s.desc,
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
      sections: [
        ...levelsForCareer(c.id).map((lv) => ({
          title: `Niveau ${lv.level} : ${lv.label} — ${lv.status}`,
          layout: 'chips' as const,
          rows: [
            ...(lv.characteristics.length ? [{ t: 'sub', label: 'Caractéristiques avancées' } as CodexRow, { t: 'text', text: lv.characteristics.map((k) => CHAR_LABELS[k]).join(', ') } as CodexRow] : []),
            ...(lv.skills.length ? [{ t: 'sub', label: 'Compétences' } as CodexRow, ...refRows('skills', lv.skills.map((a) => advancementLabel('skills', a)))] : []),
            ...(lv.talents.length ? [{ t: 'sub', label: 'Talents' } as CodexRow, ...refRows('talents', lv.talents.map((a) => advancementLabel('talents', a)))] : []),
            ...(lv.trappings.length ? [{ t: 'sub', label: 'Possessions' } as CodexRow, ...refRows('trappings', lv.trappings.map(trappingRefLabel))] : []),
          ],
        })),
        ...reverseSections('careers', c.id), // Races y accédant
      ],
    })),
  },
  {
    key: 'characteristics', label: 'Caractéristiques', group: 'Personnage',
    items: (characteristics as { label: string; abr?: string; type?: string; desc?: string; source?: CodexSource }[]).map((c) => ({
      label: c.label, sub: c.abr, desc: c.desc, source: src(c.source),
      // Bonus de Caractéristique = chiffre des dizaines (LDB 03) — rappel sur les caracs à jet (d100).
      meta: c.type === 'roll' ? facts(fact('Bonus', 'chiffre des dizaines')) : undefined,
      sections: sections(...reverseSections('characteristics', c.abr)),
    })),
  },
  {
    key: 'classes', label: 'Classes', group: 'Personnage',
    items: classes.map((c) => ({
      label: c.label, desc: c.desc, source: src(c.source),
      sections: sections(chips('Possessions de départ', 'trappings', c.trappings.map(trappingRefLabel)), ...reverseSections('classes', c.id)),
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
    items: skills.map((s) => ({
      label: s.label, sub: join(CHAR_LABELS[s.characteristic], s.type), desc: s.desc, source: src(s.source),
      meta: facts(fact('Caractéristique', CHAR_LABELS[s.characteristic]), fact('Type', s.type), fact('Spécialisations', s.specs.length ? s.specs.join(', ') : null)),
      sections: sections(...reverseSections('skills', s.id)),
    })),
  },
  {
    key: 'talents', label: 'Talents', group: 'Compétences',
    items: talents.map((t) => ({
      label: t.label, desc: t.desc, source: src(t.source),
      meta: facts(fact('Max', talentMaxLabel(t.max)), fact('Test', t.test), fact('Spécialisations', t.specs?.length ? t.specs.join(', ') : null)),
      sections: sections(
        careerGrantSection(t.passive), // Compétence/Talent ajouté à toute carrière (Maître artisan, Flagellant…)
        passiveSection(t.passive),
        effectsSection(t.effects, 'Effets déclenchés'),
        ...reverseSections('talents', t.id), // Races · Carrières (rang) · Créatures · Talents le conférant
      ),
    })),
  },
  {
    key: 'trappings', label: 'Possessions', group: 'Équipement',
    items: trappings.map((t) => {
      // Propriétés FONCTIONNELLES (flags multilangue-safe) + arme dérivée tant qu'équipée.
      const props = [
        t.weatherProtection ? 'Protège des intempéries' : null,
        t.isShelter ? 'Abri de campement' : null,
        t.isRations ? 'Ration de voyage' : null,
        t.isGrimoire ? 'Grimoire (lecture de Sorts)' : null,
        t.derivedWeapon ? `Arme dérivée : ${t.derivedWeapon.name} (${t.derivedWeapon.damage})` : null,
      ].filter(Boolean) as string[];
      return {
        label: t.label, sub: join(t.type, weaponGroupLabel(t.subType) || undefined), desc: t.desc ?? undefined, source: src(t.source),
        meta: facts(fact('Prix', priceLabel(t.price)), fact('Enc', t.enc), fact('Disponibilité', t.availability), fact('Emplacement', t.loc), fact('Dégâts', t.damage), fact('PA', t.pa), fact('Allonge', t.reach)),
        sections: sections(
          chips('Qualités', 'qualities', t.qualities.map(qualityRefLabel)),
          props.length ? { title: 'Propriétés', layout: 'list', rows: [{ t: 'text', text: props.join(' · ') }] } : null,
          ...reverseSections('trappings', t.id),
        ),
      };
    }),
  },
  {
    key: 'weaponGroups', label: 'Groupes d’objet', group: 'Équipement',
    items: weaponGroups.map((g) => ({ label: g.label, sub: WEAPON_GROUP_KIND_LABEL[g.kind], sections: sections(...reverseSections('weaponGroups', g.id)) })),
  },
  {
    key: 'qualities', label: 'Qualités', group: 'Équipement',
    items: (qualities as { id: string; label: string; type?: string; subType?: string; desc?: string; source?: CodexSource; passive?: import('../../engine/ops').GameOp[]; effects?: import('../../state/flow').TriggeredEffect[]; capabilities?: Record<string, unknown> }[]).map((q) => ({
      label: q.label, sub: join(q.type, q.subType), desc: q.desc, source: src(q.source),
      sections: sections(capabilitySection(q.capabilities, QUALITY_CAP_LABEL), passiveSection(q.passive), effectsSection(q.effects, 'Effets déclenchés'), ...reverseSections('qualities', q.id)),
    })),
  },
  {
    key: 'etats', label: 'États', group: 'Effets',
    items: etats.map((e) => ({
      label: e.label, desc: e.desc, source: src(e.source),
      sections: sections(...reverseSections('etats', e.id)), // Sorts/Traits/Qualités/Talents/Domaines l'infligeant
    })),
  },
  {
    key: 'maladies', label: 'Maladies', group: 'Effets',
    items: maladies.map((m) => ({
      label: m.label,
      sub: m.symptoms.map((s) => SYMPTOM_LABEL[s.kind] ?? s.kind).join(', '),
      meta: facts(
        fact('Contraction', DIFFICULTY_LABELS[m.contractDifficulty]),
        fact('Incubation', `${diceLabel(m.incubation)} jours`),
        fact('Durée', `${diceLabel(m.duration)} jours`),
      ),
      sections: sections({
        title: 'Symptômes', layout: 'list',
        rows: m.symptoms.map((s) => ({
          t: 'kv', k: SYMPTOM_LABEL[s.kind] ?? s.kind,
          v: [s.severity === 'grave' ? 'Grave' : s.severity === 'moderee' ? 'Modérée' : null, s.difficulty ? `Test ${DIFFICULTY_LABELS[s.difficulty]}` : null].filter(Boolean).join(' · ') || '—',
        } as CodexRow)),
      }),
    })),
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
      sections: sections(
        passiveSection(m.passive),
        chips('Traits conférés', 'traits', traitLabels(m.traits)),
        ...reverseSections('mutations', m.id), // Tables de Corruption la tirant
      ),
    })),
  },
  {
    key: 'mutationTables', label: 'Tables de Corruption', group: 'Effets',
    items: (mutationTables as { label: string; ranges: { min: number; max: number; mutation: string }[] }[]).map((t) => ({
      label: t.label, sub: `${t.ranges.length} plages d100`,
      // Tirage d100 → Mutation : chaque plage est un lien cross-réf vers la fiche de mutation.
      sections: sections({
        title: 'Tirage (d100 → Mutation)', layout: 'list',
        rows: t.ranges.map((r) => {
          const label = (mutations as MutationData[]).find((mu) => mu.id === r.mutation)?.label ?? r.mutation;
          return { t: 'ref', category: 'mutations', label, show: label, badge: `${r.min}–${r.max}` } as CodexRow;
        }),
      }),
    })),
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
      sections: sections(...reverseSections('maneuvers', m.id)),
    })),
  },
  {
    key: 'psychologie', label: 'Psychologie', group: 'Effets',
    // Filtre DATA-DRIVEN des Traits à capacité psychologique (LDB 21, migration #1) : réutilise la
    // fiche de Trait (traitItem) — « Créatures ayant ce trait » montre QUI cause/possède la Psychologie.
    // Groupés par type (Peur, Terreur, Animosité…). Édition = catégorie « Traits » (source unique).
    items: traits
      .filter((t) => t.capabilities?.psychType || t.capabilities?.psychImmune)
      .map((t) => ({ ...traitItem(t), group: t.capabilities?.psychType ? psychologyLabel(t.capabilities.psychType) : 'Immunité' })),
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
      sections: sections(effectsSection(d.effects, 'Riders à la touche'), ...reverseSections('domains', d.id)),
    })),
  },
  {
    key: 'spells', label: 'Sorts', group: 'Magie',
    items: spells.map((s) => ({
      label: s.label, sub: join(s.type, s.subType), desc: s.desc, source: src(s.source),
      meta: facts(
        fact('NI', s.cn), fact('Portée', s.range), fact('Cible', s.target), fact('Durée', s.duration),
        // Projectile magique (#2 data-driven) : Dégâts additifs + DR + BFM, ignore éventuellement PA/BE.
        fact('Projectile', s.missile ? `Dégâts ${s.damage ? `${s.damage} + ` : ''}DR + BFM${s.ignorePA ? ' · ignore PA' : ''}${s.ignoreBE ? ' · ignore BE' : ''}` : null),
      ),
      sections: sections(
        spellFlowSection(s.effects), // Effet mécanique (Flow) — #5 data-driven
        ...reverseSections('spells', s.id), // Cultes (Bénédictions/Miracles) · Créatures · Domaine
      ),
    })),
  },
  {
    key: 'gods', label: 'Dieux', group: 'Magie',
    items: gods.map((c) => ({
      label: c.key, sub: c.title, desc: c.desc, source: c.source ?? null,
      sections: sections(
        chips('Bénédictions', 'spells', c.blessings.map((b) => refLabel('spells', b))),
        chips('Miracles', 'spells', c.miracles.map((m) => refLabel('spells', m))),
      ),
    })),
  },
  {
    key: 'creatures', label: 'Créatures', group: 'Monde',
    items: creatures.map((c) => ({
      label: c.label, sub: c.title ?? undefined, group: c.folder ?? undefined, desc: c.desc ?? undefined, source: src(c.source),
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
    items: traits.map(traitItem),
  },
  {
    key: 'locations', label: 'Lieux', group: 'Monde',
    // `parent` est un id → résolu en libellé pour l'affichage ; la réf inverse « Sous-lieux » clé par id.
    items: locations.map((l) => {
      const parentLabel = findLocationById(l.parent)?.label;
      return {
        label: l.label, sub: parentLabel, group: parentLabel, desc: l.desc ?? undefined, source: src(l.source),
        sections: sections(...reverseSections('locations', l.id)),
      };
    }),
  },
  {
    key: 'books', label: 'Livres', group: 'Monde',
    items: books.map((b) => ({ label: b.label, sub: b.abr ?? b.folder ?? undefined, group: b.folder ?? undefined, desc: b.desc ?? undefined })),
  },
  // ── Tables & gabarits éditables (E3a) ─────────────────────────────────────────
  {
    key: 'careerLevels', label: 'Niveaux de carrière', group: 'Tables',
    items: careerLevels.map((lv) => ({
      label: entryKey(lv as unknown as Record<string, unknown>),
      sub: lv.status, group: findCareerById(lv.career)?.label ?? lv.career,
      sections: sections(
        lv.characteristics.length ? { title: 'Caractéristiques avancées', layout: 'chips', rows: [{ t: 'text', text: lv.characteristics.map((k) => CHAR_LABELS[k]).join(', ') }] } : null,
        chips('Compétences', 'skills', lv.skills.map((a) => advancementLabel('skills', a))),
        chips('Talents', 'talents', lv.talents.map((a) => advancementLabel('talents', a))),
        chips('Possessions', 'trappings', lv.trappings.map(trappingRefLabel)),
      ),
    })),
  },
  {
    key: 'eyes', label: 'Couleur des yeux', group: 'Tables',
    items: eyes.map((e) => ({ label: e.label, sub: `2d10 ≤ ${e.rand}`, sections: sections(colorTableSection(e)) })),
  },
  {
    key: 'hairs', label: 'Couleur des cheveux', group: 'Tables',
    items: hairs.map((h) => ({ label: h.label, sub: `2d10 ≤ ${h.rand}`, sections: sections(colorTableSection(h)) })),
  },
  {
    key: 'raceAppearance', label: 'Apparences (rig)', group: 'Tables',
    items: raceAppearance.map((r) => ({
      label: r.id, sub: r.gabarit, appearance: { species: r.id },
      meta: facts(fact('Gabarit', r.gabarit), fact('Tenue', r.tenue), fact('Tête', r.head), fact('Jambes', r.legs)),
    })),
  },
  {
    key: 'pregens', label: 'Pré-tirés', group: 'Tables',
    items: pregens.map((p) => ({
      label: p.name, sub: join(findSpeciesById(p.species)?.label ?? p.species, findCareerById(p.career)?.label ?? p.career),
      meta: facts(fact('Motivation', p.motivation), fact('Graine', p.seed)),
      sections: p.spells?.length ? sections(chips('Sorts/Prières', 'spells', p.spells)) : undefined,
    })),
  },
  {
    key: 'oups', label: 'Oups !', group: 'Tables',
    // Le `label` EST le texte du résultat (et la clé d'édition `entryKey`) → on le garde tel quel ;
    // on enrichit par la plage d100 et le TYPE d'effet (kind) en méta.
    items: oups.map((o) => ({
      label: o.label, sub: `d100 ${o.min}–${o.max}`,
      meta: facts(fact('d100', `${o.min}–${o.max}`), fact('Type', OUPS_KIND_LABEL[o.kind] ?? o.kind)),
    })),
  },
  {
    key: 'interludeEvents', label: 'Entre deux aventures', group: 'Tables',
    items: interludeEvents.map((e) => ({ label: e.label, sub: `d100 ${e.min}–${e.max}`, desc: e.text })),
  },
  {
    key: 'peripeties', label: 'Péripéties de voyage', group: 'Tables',
    items: peripeties.map((p) => ({ label: p.label, sub: `1d10 = ${p.roll} · ${p.kind}`, desc: p.text })),
  },
  // ── Datasets-OBJETS uniques (E3b) : config de création (objet) + banque de noms (Record par race) ──
  {
    key: 'details', label: 'Détails de création', group: 'Tables',
    // UNE seule entrée (objet `details.json`) — formules Âge/Taille par espèce + textes d'aide.
    items: [{
      label: 'Détails de création (LDB 05)',
      sections: sections({
        title: 'Formules Âge & Taille (base + Nd10)', layout: 'list',
        rows: Object.keys(details.ageBase).map((sp) => ({
          t: 'kv', k: sp,
          v: `Âge ${details.ageBase[sp]}+${Math.round(details.ageRoll[sp] ?? 1)}d10 · Taille ${details.heightBase[sp]}+${Math.round(details.heightRoll[sp] ?? 1)}d10 cm`,
        } as CodexRow)),
      }),
    }],
  },
  {
    key: 'names', label: 'Banque de noms', group: 'Tables',
    // Record race → NamePool : une entrée par race (clé = libellé de l'item, édité au Codex).
    items: Object.entries(names).map(([race, pool]) => ({
      label: race,
      sub: `${pool.maleFirstNames.length}♂ · ${pool.femaleFirstNames.length}♀ · ${pool.lastNames.length} noms`,
      sections: sections(
        pool.maleFirstNames.length ? { title: 'Prénoms masculins', layout: 'chips', rows: [{ t: 'text', text: pool.maleFirstNames.join(', ') }] } : null,
        pool.femaleFirstNames.length ? { title: 'Prénoms féminins', layout: 'chips', rows: [{ t: 'text', text: pool.femaleFirstNames.join(', ') }] } : null,
        pool.lastNames.length ? { title: 'Noms de famille', layout: 'chips', rows: [{ t: 'text', text: pool.lastNames.join(', ') }] } : null,
      ),
    })),
  },
];

/** Section « table 2d10 » d'une couleur (yeux/cheveux) — borne + couleur par colonne d'espèce. */
function colorTableSection(c: (typeof eyes)[number]): CodexSection {
  return {
    title: 'Couleur par espèce (colonne refChar)', layout: 'list',
    rows: Object.entries(c.color).filter(([, v]) => v).map(([sp, v]) => ({ t: 'kv', k: sp, v } as CodexRow)),
  };
}

/** Catégories d'une famille, dans l'ordre de déclaration. */
export const categoriesIn = (group: CodexGroup): CodexCategory[] => CODEX.filter((c) => c.group === group);

/** Catégorie par clé. */
export const categoryByKey = (key: string): CodexCategory | undefined => CODEX.find((c) => c.key === key);

// ── Fiche Livre : « contenu, par type » (index `bookContents`) câblé APRÈS coup — les libellés de
//    catégorie ne sont connus qu'une fois `CODEX` construit. Les entités référencent leur livre par
//    son ABR (`source.book`) → on matche sur abr + libellé. Chaque type = une section de chips cross-réf.
for (const b of books) {
  const it = categoryByKey('books')?.items.find((x) => x.label === b.label);
  if (!it) continue;
  it.sections = bookContents(b.abr ?? undefined, b.label).map((g) => ({
    title: categoryByKey(g.category)?.label ?? g.category,
    layout: 'chips' as const,
    rows: g.labels.map((label) => ({ t: 'ref', category: g.category, label, show: label } as CodexRow)),
  }));
}

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
