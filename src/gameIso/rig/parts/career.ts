import { careers } from '../../../data';
import { GENERATED_CAREER_TENUES } from './generated/careerTenues';
import { CAREER_PALETTES } from './generated/careerPalettes';
import TENUE_VIEWS_JSON from './generated/tenueViews.json';
import { TENUES, TENUE_NUE, CLASS_PALETTES, CAREER_TENUE_DEF_PALETTES, type TenueSet } from './tenues';
import type { StoredPalette } from '../palette';

// Vues dos/profil des tenues (E·7, générées) — composées au front existant (torse/tête).
type TenueViewSet = { back?: string; profile?: string };
const TENUE_VIEWS = TENUE_VIEWS_JSON as Record<string, Partial<Record<'torse' | 'tete', TenueViewSet>>>;

/** Compose les vues dos/profil (si dispo) aux slots string d'une tenue. */
function withViews(career: string, set: TenueSet): TenueSet {
  const v = TENUE_VIEWS[career];
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
export function careerTenue(cls: string): TenueSet {
  return TENUES[cls] ?? TENUES.Citadins;
}

/** Carrières à tenue DÉDIÉE proposables dans l'éditeur (+ « Nu »). Calculé au runtime →
 *  inclut automatiquement toute tenue ajoutée (ex. « Skaven »). Sert au sélecteur de tenue
 *  d'entité : un PNJ peut porter n'importe laquelle (découplage tenue ↔ nom). */
export function tenueCareerNames(): string[] {
  return [...Object.keys(GENERATED_CAREER_TENUES).sort((a, b) => a.localeCompare(b, 'fr')), 'Nu'];
}

/**
 * Palette STOCKÉE de la tenue d'une carrière, en miroir EXACT de `careerTenueFor` :
 * palette par CARRIÈRE si dispo (`CAREER_PALETTES`), sinon palette de l'archétype de CLASSE
 * (`CLASS_PALETTES`). Empilée sous l'espèce + les surcharges dans composeRig → rendu par
 * défaut sans perte ET recoloriage cohérent, que la carrière ait sa tenue dédiée ou non.
 */
export function tenuePaletteFor(career: string | undefined): StoredPalette {
  return CAREER_PALETTES[career ?? ''] ?? CAREER_TENUE_DEF_PALETTES[career ?? ''] ?? CLASS_PALETTES[careerClass(career ?? '')] ?? {};
}

/** Tenue résolue pour une carrière : art PAR CARRIÈRE si dispo, sinon archétype de CLASSE. */
export function careerTenueFor(career: string | undefined): TenueSet {
  if (career === 'Nu') return TENUE_NUE; // corps nu (monstres sans habit)
  const gen = career ? GENERATED_CAREER_TENUES[career] : undefined;
  if (gen && Object.keys(gen).length) return withViews(career!, gen); // + vues dos/profil (E·7)
  return careerTenue(careerClass(career ?? ''));
}
