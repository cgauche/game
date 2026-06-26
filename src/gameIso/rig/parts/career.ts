import { careers } from '../../../data';
import { slugId } from '../../../data/slug';
import { TENUE_MODELS } from './generated/careerTenues';
import { TENUE_PALETTES } from './generated/careerPalettes';
import TENUE_VIEWS_JSON from './generated/tenueViews.json';
import { TENUES, TENUE_NUE, CLASS_PALETTES, CAREER_TENUE_DEF_PALETTES, type TenueSet } from './tenues';
import type { StoredPalette } from '../palette';

// Vues dos/profil des tenues (E·7, générées) — composées au front existant (torse/tête).
type TenueViewSet = { back?: string; profile?: string };
const TENUE_VIEWS = TENUE_VIEWS_JSON as Record<string, Partial<Record<'torse' | 'tete', TenueViewSet>>>;

/** Ré-indexe une table clé-LIBELLÉ (tenue/classe authorée) par id slug — clé d'authoring conservée
 *  dans les sources/générés, lookup par id (toutes les clés de tenue/classe deviennent des slugs). */
const byId = <T>(m: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(m).map(([k, v]) => [slugId(k), v]));
const TENUE_MODELS_BY_ID = byId(TENUE_MODELS);
const TENUE_PALETTES_BY_ID = byId(TENUE_PALETTES);
const CAREER_TENUE_DEF_PALETTES_BY_ID = byId(CAREER_TENUE_DEF_PALETTES);
const TENUES_BY_ID = byId(TENUES);                  // par id de CLASSE
const CLASS_PALETTES_BY_ID = byId(CLASS_PALETTES);  // par id de CLASSE
const TENUE_VIEWS_BY_ID = byId(TENUE_VIEWS);

/** Compose les vues dos/profil (si dispo) aux slots string d'une tenue (clé = id de tenue). */
function withViews(tenueId: string, set: TenueSet): TenueSet {
  const v = TENUE_VIEWS_BY_ID[tenueId];
  if (!v) return set;
  const out: TenueSet = { ...set };
  for (const slot of ['torse', 'tete'] as const) {
    const front = set[slot];
    const views = v[slot];
    if (typeof front === 'string' && views && (views.back || views.profile)) out[slot] = { front, ...views };
  }
  return out;
}

// Carrière (id) → classe (id) ; `careers.json` porte `id` et `class` DÉJÀ en slugs.
const CAREER_CLASS_BY_ID: Record<string, string> = {};
for (const row of careers) CAREER_CLASS_BY_ID[row.id] = row.class;

/** Classe (id) d'une CLÉ — id de carrière (héros) ou id de tenue/inconnu → défaut « citadins ».
 *  `slugId` absorbe un libellé authoré éventuel. */
export function careerClass(key: string): string {
  return CAREER_CLASS_BY_ID[slugId(key)] ?? 'citadins';
}

/** Tenue par défaut d'une classe (par id de classe). Socle simple ; archétypes en `tenues/defs/`. */
export function tenueForClass(classId: string): TenueSet {
  return TENUES_BY_ID[classId] ?? TENUES_BY_ID.citadins;
}

/** Options du sélecteur de tenue (affiche le LIBELLÉ, stocke l'ID) + « Nu ». Inclut toute tenue ajoutée. */
export function tenueOptions(): { id: string; label: string }[] {
  return [...Object.keys(TENUE_MODELS).sort((a, b) => a.localeCompare(b, 'fr')).map((name) => ({ id: slugId(name), label: name })), { id: 'nu', label: 'Nu' }];
}
const TENUE_LABEL_BY_ID: Record<string, string> = { nu: 'Nu', ...Object.fromEntries(Object.keys(TENUE_MODELS).map((name) => [slugId(name), name])) };
/** Libellé d'affichage d'un id de tenue (ou l'id en repli). */
export function tenueLabel(id: string | undefined): string { return TENUE_LABEL_BY_ID[slugId(id ?? '')] ?? id ?? ''; }

/**
 * Palette STOCKÉE d'une tenue (clé = id, absorbe un libellé authoré via slugId), en miroir EXACT de
 * `tenueFor` : palette par TENUE si dispo, sinon palette de l'archétype de CLASSE. Empilée sous l'espèce.
 */
export function tenuePaletteFor(tenue: string | undefined): StoredPalette {
  const id = slugId(tenue ?? '');
  return TENUE_PALETTES_BY_ID[id] ?? CAREER_TENUE_DEF_PALETTES_BY_ID[id] ?? CLASS_PALETTES_BY_ID[careerClass(tenue ?? '')] ?? {};
}

/** Tenue résolue pour une CLÉ de tenue (id slug ; `slugId` absorbe un libellé authoré — race.tenue/
 *  perso.tenue) : art DÉDIÉ si dispo, sinon archétype de CLASSE. */
export function tenueFor(tenue: string | undefined): TenueSet {
  const id = slugId(tenue ?? '');
  if (id === 'nu') return TENUE_NUE; // corps nu (monstres sans habit)
  const gen = TENUE_MODELS_BY_ID[id];
  if (gen && Object.keys(gen).length) return withViews(id, gen); // + vues dos/profil (E·7)
  return tenueForClass(careerClass(tenue ?? ''));
}
