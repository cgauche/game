/**
 * Registre du Codex — SOURCE UNIQUE des catégories consultables en jeu.
 *
 * Chaque catégorie projette un tableau de `src/data` (façade `index.ts`) en `CodexItem`
 * normalisé (titre + sous-titre + faits-clés + corps + source). **Ajouter une catégorie =
 * UNE entrée dans `CODEX`** — jamais une nième copie de rendu (cf. table « Primitives
 * partagées » de CLAUDE.md). Catégories à venir (Étoiles/Lieux/Livres/Dieux) : une ligne
 * chacune une fois leur donnée émise (A1/A2 du plan).
 */
import {
  species, careers, characteristics, classes, skills, talents,
  qualities, trappings, etats, creatures, traits, spells,
} from '../../data';

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
/** Entrée normalisée, rendue uniformément par `CodexEntry`. */
export interface CodexItem {
  label: string;
  /** Ligne secondaire (type, classe, caractéristique liée…). */
  sub?: string;
  /** Faits-clés en cartouches (Portée, NI, Enc, carac…). */
  meta?: CodexFact[];
  /** Mots-clés en pastilles (Atouts d'arme, Traits de créature, possessions de classe…). */
  tags?: string[];
  /** Corps de la fiche : texte simple, OU HTML si `html` (lore des Dieux/Livres). */
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

export const CODEX: CodexCategory[] = [
  {
    key: 'races', label: 'Races', group: 'Personnage',
    items: species.map((s) => ({
      label: s.label,
      desc: s.desc,
      source: src(s.source),
      meta: facts(fact('Mouvement', s.movement), fact('Destin', s.fate?.fate), fact('Résilience', s.fate?.resilience)),
    })),
  },
  {
    key: 'careers', label: 'Carrières', group: 'Personnage',
    items: careers.map((c) => ({ label: c.label, sub: c.class, desc: c.desc, source: src(c.source) })),
  },
  {
    key: 'characteristics', label: 'Caractéristiques', group: 'Personnage',
    items: (characteristics as { label: string; abr?: string; desc?: string; source?: CodexSource }[]).map((c) => ({
      label: c.label, sub: c.abr, desc: c.desc, source: src(c.source),
    })),
  },
  {
    key: 'classes', label: 'Classes', group: 'Personnage',
    items: classes.map((c) => ({ label: c.label, desc: c.desc, source: src(c.source), tags: c.trappings })),
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
    })),
  },
  {
    key: 'trappings', label: 'Possessions', group: 'Équipement',
    items: trappings.map((t) => ({
      label: t.label, sub: join(t.type, t.subType), desc: t.desc ?? undefined, source: src(t.source),
      meta: facts(fact('Enc', t.enc), fact('Disponibilité', t.availability), fact('Dégâts', t.damage), fact('PA', t.pa), fact('Allonge', t.reach)),
      tags: t.qualities,
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
    key: 'creatures', label: 'Créatures', group: 'Monde',
    items: creatures.map((c) => ({
      label: c.label, sub: c.title ?? c.folder ?? undefined, desc: c.desc ?? undefined, source: src(c.source),
      meta: facts(...Object.entries(c.char).map(([k, v]) => fact(k, v))),
      tags: c.traits,
    })),
  },
  {
    key: 'traits', label: 'Traits', group: 'Monde',
    items: traits.map((t) => ({ label: t.label, sub: t.prefix ?? undefined, desc: t.desc, source: src(t.source) })),
  },
];

/** Catégories d'une famille, dans l'ordre de déclaration. */
export const categoriesIn = (group: CodexGroup): CodexCategory[] => CODEX.filter((c) => c.group === group);

/** Catégorie par clé. */
export const categoryByKey = (key: string): CodexCategory | undefined => CODEX.find((c) => c.key === key);
