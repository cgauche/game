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
  qualities, trappings, etats, creatures, traits, spells,
  stars, locations, books, levelsForCareer,
} from '../../data';
import { CULTS } from '../../engine/cults/registry';

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
  /** Mini sous-en-tête à l'intérieur d'une section (« Compétences », « Talents »…). */
  | { t: 'sub'; label: string };
export interface CodexSection {
  title: string;
  layout?: 'list' | 'chips' | 'grid';
  rows: CodexRow[];
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
  /** Corps prose : texte simple, OU HTML si `html` (lore des Dieux/Livres). */
  desc?: string;
  html?: boolean;
  source?: CodexSource | null;
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

/** Décompose une entité paramétrée → base (lookup) + libellé complet (affiché, Indices inclus).
 *  « 8 Tentacules +8 » → { lookup:'Tentacules', show:'8 Tentacules +8' } ;
 *  « Chevaucher (Cheval) 58 » → { lookup:'Chevaucher', show:'Chevaucher (Cheval) 58' }. */
function splitRef(raw: string): { lookup: string; show: string } {
  const show = raw.trim();
  const lookup = show
    .replace(/^\d+\s+/, '') // Indice de nombre en tête (« 8 Tentacules »)
    .replace(/\s+[+-]?\d+\s*$/, '') // valeur/Indice en fin (« +8 », « 58 »)
    .replace(/\s*\([^)]*\)\s*/g, ' ') // spécialisation entre parenthèses (lookup sur la base)
    .replace(/\s+/g, ' ')
    .trim();
  return { lookup: lookup || show, show };
}

const refRow = (category: string, raw: string): CodexRow => {
  const { lookup, show } = splitRef(raw);
  return { t: 'ref', category, label: lookup, show };
};
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

export const CODEX: CodexCategory[] = [
  {
    key: 'races', label: 'Races', group: 'Personnage',
    items: species.map((s) => ({
      label: s.label,
      group: family(s.label),
      desc: s.desc,
      source: src(s.source),
      meta: facts(fact('Mouvement', s.movement), fact('Destin', s.fate?.fate), fact('Résilience', s.fate?.resilience)),
      sections: sections(
        { title: 'Caractéristiques de base', layout: 'grid', rows: kvRows(Object.entries(s.baseChar ?? {})) },
        chips("Compétences d'espèce", 'skills', s.skills),
        chips("Talents d'espèce", 'talents', s.talents),
      ),
    })),
  },
  {
    key: 'careers', label: 'Carrières', group: 'Personnage',
    items: careers.map((c) => ({
      label: c.label, sub: c.class, group: c.class, desc: c.desc, source: src(c.source),
      sections: levelsForCareer(c.label).map((lv) => ({
        title: `Niveau ${lv.level} : ${lv.label} — ${lv.status}`,
        layout: 'chips' as const,
        rows: [
          ...(lv.characteristics.length ? [{ t: 'sub', label: 'Caractéristiques avancées' } as CodexRow, { t: 'text', text: lv.characteristics.join(', ') } as CodexRow] : []),
          ...(lv.skills.length ? [{ t: 'sub', label: 'Compétences' } as CodexRow, ...refRows('skills', lv.skills)] : []),
          ...(lv.talents.length ? [{ t: 'sub', label: 'Talents' } as CodexRow, ...refRows('talents', lv.talents)] : []),
          ...(lv.trappings.length ? [{ t: 'sub', label: 'Possessions' } as CodexRow, ...refRows('trappings', lv.trappings)] : []),
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
      sections: sections(chips('Possessions de départ', 'trappings', c.trappings)),
    })),
  },
  {
    key: 'stars', label: 'Étoiles', group: 'Personnage',
    items: stars.map((s) => ({
      label: s.label, sub: s.signe ?? undefined, desc: s.desc ?? undefined, source: src(s.source),
      meta: facts(fact('Dates', s.dates), fact('Dieu', s.dieux), fact('Ascendant', s.ascendant), fact('Caractéristiques', s.characteristics), fact('Talent', s.talent)),
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
      label: t.label, sub: join(t.type, t.subType), desc: t.desc ?? undefined, source: src(t.source),
      meta: facts(fact('Enc', t.enc), fact('Disponibilité', t.availability), fact('Dégâts', t.damage), fact('PA', t.pa), fact('Allonge', t.reach)),
      sections: sections(chips('Qualités', 'qualities', t.qualities)),
    })),
  },
  {
    key: 'qualities', label: 'Qualités', group: 'Équipement',
    items: (qualities as { label: string; type?: string; subType?: string; desc?: string; source?: CodexSource }[]).map((q) => ({
      label: q.label, sub: join(q.type, q.subType), desc: q.desc, source: src(q.source),
    })),
  },
  {
    key: 'etats', label: 'États', group: 'Effets',
    items: etats.map((e) => ({ label: e.label, desc: e.desc, source: src(e.source) })),
  },
  {
    key: 'spells', label: 'Sorts', group: 'Magie',
    items: spells.map((s) => ({
      label: s.label, sub: join(s.type, s.subType), desc: s.desc, source: src(s.source),
      meta: facts(fact('NI', s.cn), fact('Portée', s.range), fact('Cible', s.target), fact('Durée', s.duration)),
    })),
  },
  {
    key: 'gods', label: 'Dieux', group: 'Magie',
    items: Object.values(CULTS).map((c) => ({
      label: c.key, sub: c.title, desc: c.desc, html: true, source: c.source ?? null,
      sections: sections(
        chips('Bénédictions', 'spells', c.blessings),
        chips('Miracles', 'spells', c.miracles),
      ),
    })),
  },
  {
    key: 'creatures', label: 'Créatures', group: 'Monde',
    items: creatures.map((c) => ({
      label: c.label, sub: c.title ?? undefined, group: c.folder ?? undefined, desc: c.desc ?? undefined, source: src(c.source),
      sections: sections(
        { title: 'Caractéristiques', layout: 'grid', rows: kvRows(Object.entries(c.char)) },
        chips('Traits', 'traits', c.traits),
        chips('Traits optionnels', 'traits', c.optionals),
        chips('Compétences', 'skills', c.skills),
        chips('Talents', 'talents', c.talents),
        chips('Sorts', 'spells', c.spells),
        chips('Possessions', 'trappings', c.trappings),
      ),
    })),
  },
  {
    key: 'traits', label: 'Traits', group: 'Monde',
    items: traits.map((t) => ({ label: t.label, sub: t.prefix ?? undefined, desc: t.desc, source: src(t.source) })),
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
