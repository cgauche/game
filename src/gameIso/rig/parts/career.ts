import { careers } from '../../../data';
import { TENUE_MODELS } from './generated/careerTenues';
import { TENUE_PALETTES } from './generated/careerPalettes';
import TENUE_VIEWS_JSON from './generated/tenueViews.json';
import { TENUES, TENUE_NUE, CLASS_PALETTES, CAREER_TENUE_DEF_PALETTES, type TenueSet } from './tenues';
import type { StoredPalette } from '../palette';

// Vues dos/profil des tenues (E·7, générées) — composées au front existant (torse/tête).
type TenueViewSet = { back?: string; profile?: string };
const TENUE_VIEWS = TENUE_VIEWS_JSON as Record<string, Partial<Record<'torse' | 'tete', TenueViewSet>>>;

/** Compose les vues dos/profil (si dispo) aux slots string d'une tenue. */
function withViews(tenue: string, set: TenueSet): TenueSet {
  const v = TENUE_VIEWS[tenue];
  if (!v) return set;
  const out: TenueSet = { ...set };
  for (const slot of ['torse', 'tete'] as const) {
    const front = set[slot];
    const views = v[slot];
    if (typeof front === 'string' && views && (views.back || views.profile)) out[slot] = { front, ...views };
  }
  return out;
}

const BY_LABEL: Record<string, string> = {};
for (const row of careers) BY_LABEL[row.label] = row.class;

export function careerClass(career: string): string {
  return BY_LABEL[career] ?? 'Citadins';
}

/** Tenue par défaut d'une classe (torse/jambes, parfois bras/tete). Socle simple.
 *  Les archétypes vivent désormais en fichiers `tenues/defs/` (TENUES en est dérivé). */
export function tenueForClass(cls: string): TenueSet {
  return TENUES[cls] ?? TENUES.Citadins;
}

/** Tenues DÉDIÉES proposables dans l'éditeur (+ « Nu »). Calculé au runtime → inclut
 *  automatiquement toute tenue ajoutée (ex. « Skaven »). Sert au sélecteur de tenue
 *  d'entité : un PNJ peut porter n'importe laquelle (découplage tenue ↔ nom). */
export function tenueNames(): string[] {
  return [...Object.keys(TENUE_MODELS).sort((a, b) => a.localeCompare(b, 'fr')), 'Nu'];
}

/**
 * Palette STOCKÉE d'une tenue, en miroir EXACT de `tenueFor` : palette par TENUE si dispo
 * (`TENUE_PALETTES`), sinon palette de l'archétype de CLASSE (`CLASS_PALETTES`). Empilée sous
 * l'espèce + les surcharges dans composeRig → rendu par défaut sans perte ET recoloriage
 * cohérent, que la tenue ait son art dédié ou non.
 */
export function tenuePaletteFor(tenue: string | undefined): StoredPalette {
  return TENUE_PALETTES[tenue ?? ''] ?? CAREER_TENUE_DEF_PALETTES[tenue ?? ''] ?? CLASS_PALETTES[careerClass(tenue ?? '')] ?? {};
}

/** Tenue résolue pour un libellé de tenue : art DÉDIÉ si dispo, sinon archétype de CLASSE. */
export function tenueFor(tenue: string | undefined): TenueSet {
  if (tenue === 'Nu') return TENUE_NUE; // corps nu (monstres sans habit)
  const gen = tenue ? TENUE_MODELS[tenue] : undefined;
  if (gen && Object.keys(gen).length) return withViews(tenue!, gen); // + vues dos/profil (E·7)
  return tenueForClass(careerClass(tenue ?? ''));
}
