/**
 * CANAL UNIQUE de la pénalité météo « Tests physiques » (EDOC 8 l.82, #341). SEUL module autorisé à
 * importer `weatherPhysicalTestMod` : toute autre surface qui voudrait ajouter la météo à un breakdown de
 * Test DOIT passer par ce lecteur — la garde d'import `scripts/guards/lib/weatherTestModQuarantine.mjs`
 * (test `src/engine/weather-test-mod-quarantine-guard.test.ts`) rend tout câblage par-surface INEXPRIMABLE.
 *
 * Frontière : les mods météo WEAPON-CONTEXTUELS (tir dégradé `weatherRangedMod`, poudre inutilisable
 * `weatherPowderUseless`) NE passent PAS par ici — ils restent dans `attackEnv` (state), car ils dépendent
 * de l'ARME, pas de la caractéristique du Test. Ce canal ne porte QUE le −10 « Tests physiques » scopé par
 * la LISTE maison `physicalTestChars` (la carac du Test décide : CC/CT/F/E/Ag/Dex).
 */
import type { CharKey } from './types';
import type { ModLine } from './combat';
import { WEATHER_LABEL, weatherPhysicalTestMod, type Weather } from './travelStages';

/** Ligne(s) « Météo : … » d'un Test dont la caractéristique est `ck`, sous la météo `weather` — vide si pas
 *  de météo, pas de carac (mode social), ou carac non physique / météo sans pénalité (pluie simple). Un
 *  seul point de calcul : toutes les surfaces de Test (attaque/défense/activité) en dérivent. */
export function weatherTestMods(weather: Weather | undefined, ck: CharKey | null): ModLine[] {
  if (!weather || !ck) return [];
  const v = weatherPhysicalTestMod(weather, ck);
  return v ? [{ label: `Météo : ${WEATHER_LABEL[weather]}`, value: v }] : [];
}
