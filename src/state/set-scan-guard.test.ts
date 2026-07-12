import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { runSetScan } from '../../scripts/guards/lib/setScan.mjs';

/**
 * Garde-fou « set() bruts des flows » (#321 lentille 3, cliquet baseline patron `scripts/guards/lib/`) :
 * fige l'AGRÉGAT de `set({...})` de `src/state/*.ts` (hors `store.ts`/`stateFields.ts`) qui réinitialisent
 * un champ `STATE_FIELDS` (pending*) DIRECTEMENT, hors `...resetFields(...)`. MESURE globale, PAS un
 * verrou par-fichier : le rapport `docs/plans/2026-07-11-chasse-3-synthese.md` documente que la majorité
 * de ces sites sont des fermetures de modale LÉGITIMES (chaque flow ferme sa propre pending — cf. chasse-2
 * « cœur des set() sains ») ; ce cliquet borne la CROISSANCE non revue plutôt que d'exiger un helper
 * `clearPending` immédiat (aucune correction faite dans cette passe). Baseline gelée au recensement
 * (2026-07-11) : 689 set() / 280 resets ad hoc directs ; +1 set() légitime (voyage : l'applier de poste
 * SCINDÉ en `stagePoste` sans-Test + `stagePosteBatch` pour le pas batch des postes — chacun ré-émet le
 * groupe) ; +2 set() légitimes (#327 lot D : `spoilVesselCargoOnLeak` persiste la voie d'eau sur
 * `vessel.cargo`, et l'applier de soumission de la Cogue pirate y persiste le pillage — SOURCE UNIQUE).
 * +6 set() légitimes (#340 : budget d'heures PAR JOUR CALENDAIRE + portes de départ + nuit forcée —
 * `travelFlow` accumule le budget du jour `addTravelHoursToday`/`markMarchedToday`, pose/lève la porte
 * `pendingDeparture` ; `restFlow` marque la nuit jouée `lastNightDay` ×2) ; +2 resets ad hoc (la porte
 * `pendingDeparture` posée puis effacée à « Attendre l'aube »/au départ diurne — transient de carte).
 * +1 set() légitime (#341 : l'applier `weatherResistance` ré-émet le groupe après l'Exténué de traversée
 * Neige/Blizzard — MÊME patron que `stagePosteBatch`).
 * +3 set() légitimes (#344 : l'Exposition hydrique fluviale surfacée APRÈS le jour DIFFÈRE la halte de
 * nuit — `continueRiverDayAfterCascade` re-tague la cascade en `riverExposure` + fige la progression du
 * jour ; `continueRiverDayAfterExposure` efface ce transient puis reprend la fin du jour) ; +1 reset ad hoc
 * (`travelPlan: null` de garde quand la route/destination a disparu à la reprise post-Exposition).
 * +1 set() légitime (abordage GÉNÉRIQUE dérivé d'un navire hostile : `openGenericBoarding` INTERROMPT la
 * traversée + efface `sea.boarding` avant de transitionner vers la Scène d'abordage construite à la volée).
 * +2 set() légitimes (#341/#253 : `stampEnvWeatherAtCombatStart` estampille la météo du jour sur les
 * combattants à l'ouverture — SOURCE du canal « Tests physiques » ; `openCombatEndCascade` VIDE la file
 * `deferredUpkeepQueue` après consommation des Tests d'entretien différés) ; +1 reset ad hoc (ce
 * `deferredUpkeepQueue: []` = vidage de la file per-combat, jamais rejouée).
 * +1 set() légitime (#351 : `runCascadeImmediate` S'ARRÊTE et SURFACE `pendingCascade` sur un CHOIX sans
 * `defaultChoice` authoré — patron `resolveRemainingCascade`, jamais un `options[0]` silencieux) ; +1 reset
 * ad hoc (même site : pose directe de `pendingCascade`).
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BASELINE = { totalCalls: 706, totalAdHocResets: 285 };

describe('garde-fou set() bruts des flows (agrégat)', () => {
  it("le nombre total de set() littéraux détectés dans src/state/*.ts ne dépasse pas la baseline", () => {
    const { totalCalls } = runSetScan(ROOT);
    expect(
      totalCalls,
      `Croissance des set() de src/state/*.ts (${BASELINE.totalCalls} → ${totalCalls}) — revoir le nouveau flux puis AJUSTER la baseline de ce test si légitime`,
    ).toBeLessThanOrEqual(BASELINE.totalCalls);
  });

  it("le nombre de set() qui réinitialisent un champ STATE_FIELDS hors resetFields(...) ne dépasse pas la baseline", () => {
    const { totalAdHocResets } = runSetScan(ROOT);
    expect(
      totalAdHocResets,
      `Croissance des resets ad hoc de champ pending* (${BASELINE.totalAdHocResets} → ${totalAdHocResets}) — un nouveau site direct hors resetFields(...) : envisager le helper partagé, sinon AJUSTER la baseline`,
    ).toBeLessThanOrEqual(BASELINE.totalAdHocResets);
  });
});
