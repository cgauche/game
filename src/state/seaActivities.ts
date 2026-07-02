/**
 * ACTIVITÉS EN MER (MDG 15 l.266-306) — « Pour chaque semaine (8 jours) de voyage en mer, chaque
 * Personnage a l'occasion d'effectuer une Activité » (l.268). Le déclencheur hebdomadaire vit dans
 * `finishSeaDay` (8ᵉ journée révolue → `pendingSeaActivities`, la halte de nuit suit à la
 * confirmation) ; ici la RÉSOLUTION des choix — catalogue data-driven UNIQUE (`activities.json`,
 * contexte 'mer', `activitiesFor`), AUCUN second système d'Activités.
 *
 * RAW modélisé :
 *  - Commerce d'opportunité (l.274-286) : investissement ≤ min(bourse, Enc libre du navire en CO),
 *    Test étendu de Marchandage Complexe (−10), 10 DR en ≤ 3 tentatives → % récupéré
 *    (`opportunityTradePct`, table verbatim `sea-cargo.json`).
 *  - Cartographie (l.288-290) : Métier (Cartographe) Complexe (−10) → une Carte marine (trapping
 *    `carte-marine`, passif +2 DR d'Orientation) d'une valeur de DR CO (prix d'instance). Les « deux
 *    ports désignés » ne sont pas modélisés : la carte sert la ligne maritime courante (abstraction
 *    documentée — même lecture que la Boussole, passif inconditionnel). Le volet « Opérations
 *    bancaires : Planque » gratuit (l.292) n'est pas offert en mer (la banque vit à l'interlude).
 *  - Entraînement d'équipage (l.294-300) : GATE — l'équipage du navire de campagne est ABSTRAIT,
 *    tenu par les PJ (MDG 14 l.39) : aucun équipage PNJ à entraîner (l'UI l'explique, le résolveur
 *    le raconte). « Seuls les PNJ peuvent gagner des Augmentations » (l.296).
 *  - Whitelist d'Activités TERRESTRES (l.270 : Apprentissage particulier, Artisanat, Entraînement,
 *    Entraînement au combat, Invention !, Recherche de savoir, Semer la dissension + entraînements
 *    d'Aux Armes !) : « à condition que des installations et des instructeurs adaptés soient
 *    disponibles » — arbitrage sans-MJ : ni installations ni instructeurs sur le navire de campagne
 *    → non proposées en mer (le verbatim est affiché dans la modale, `SEA_ACTIVITIES_INTRO`).
 *  - Entretien du navire (l.302-306) : DÉJÀ câblé au Test d'équipage d'ENTRETIEN nocturne du voyage
 *    (MDG 14 l.116-124) — pas de doublon en Activité.
 */
import { battleRng } from './battleRng';
import { openRest, placesOfKind } from './restFlow';
import { activityById, activitiesFor, resolveTravelActivity, type ActivityDef } from '../engine/activities';
import { rollTest, extendedTestStep } from '../engine/tests';
import { testValue } from '../engine/skills';
import { applyOps } from '../engine/ops';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { toBrass, fromBrass, formatMoney, PA_PER_CO } from '../engine/money';
import { cargoTotalEnc, OPPORTUNITE, opportunityTradePct } from '../engine/seaVoyage';
import { findVehicleById } from '../data';
import { DIFFICULTY_LABELS } from '../engine/types';
import type { TravelRecapDay } from './travelFlow';
import type { Get, Set } from './flowTypes';

/** VERBATIM MDG 15 l.266-272 (règle 5 : recollable dans Source/) — affiché en tête de la modale. */
export const SEA_ACTIVITIES_INTRO = `Pour chaque semaine (8 jours) de voyage en mer, chaque Personnage a l'occasion d'effectuer une Activité. Comme elles ont lieu sur les flots, ces Activités ne sont pas soumises aux règles *Argent à gaspiller*, *Avec le pouvoir*… et *Amélioration elfique* (voir page de **WFJDR**, page 195).

Les Activités suivantes peuvent être entreprises, à condition que des installations et des instructeurs adaptés soient disponibles : *Apprentissage particulier, Artisanat, Entraînement, Entraînement au combat, Invention !, Recherche de savoir, Semer la dissension* et toutes les Activités impliquant un entraînement du supplément **Aux Armes !**.

Une Activité *Semer la dissension* réussie cause une perte de 2d10 de Moral si elle est dirigée contre les officiers du navire.`;

/** Choix d'un héros pour la semaine : une Activité du catalogue 'mer' (+ mise du Commerce d'opportunité). */
export interface SeaActivityPick {
  activityId: string;
  /** Commerce d'opportunité (l.276) : couronnes d'or investies. */
  investGold?: number;
}

/** Modale hebdomadaire (8 jours en mer, l.268) — la halte de nuit attend la confirmation. */
export interface PendingSeaActivities {
  picks: Record<string, SeaActivityPick | null>;
  /** Recap du jour à livrer à la halte (les lignes d'Activités s'y ajoutent). */
  day: TravelRecapDay;
}

const log = (get: Get, set: Set, lines: string[]) => {
  if (lines.length) set({ journal: [...get().journal.slice(-40), ...lines] });
};

/** Enc LIBRE du navire de campagne (Contenance − cargaison) — plafond du Commerce d'opportunité
 *  (l.276 : « jusqu'à l'équivalent de la valeur totale d'Encombrement disponible et non surchargé
 *  de votre bateau en couronnes d'or »). */
export function vesselFreeEnc(get: Get): number {
  const vessel = get().vessel;
  if (!vessel) return 0;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return Math.max(0, capacity - cargoTotalEnc(vessel.cargo ?? []));
}

/** Raison de BLOCAGE d'une Activité en mer pour un héros (affordance expliquée, jamais muette). */
export function seaActivityBlocked(get: Get, def: ActivityDef): string | null {
  if (def.resolver === 'crewTraining') {
    return 'L’équipage du navire de campagne est tenu par les PJ (MDG 14) — aucun équipage PNJ à entraîner.';
  }
  if (def.resolver === 'opportunityTrade' && vesselFreeEnc(get) <= 0) {
    return 'Aucun point d’Encombrement disponible sur le navire — rien à investir (MDG 15).';
  }
  return null;
}

/** Résout les Activités de la semaine (une par héros, l.268) puis rend la main à la halte de nuit. */
export function seaActivitiesConfirm(get: Get, set: Set, picks: Record<string, SeaActivityPick | null>): void {
  const pending = get().pendingSeaActivities;
  if (!pending) return;
  const rng = battleRng();
  const lines: string[] = [];
  for (const hero of get().party) {
    if (hero.dead || hero.outOfRencontre) continue;
    const pick = picks[hero.id];
    const def = pick ? activityById(pick.activityId) : undefined;
    if (!pick || !def || !def.contexts.includes('mer') || seaActivityBlocked(get, def)) continue;

    if (def.resolver === 'opportunityTrade') {
      // Commerce d'opportunité (l.274-286) : mise plafonnée (Enc libre en CO, bourse), Test étendu
      // de Marchandage Complexe (−10), 10 DR, ≤ 3 tentatives — % récupéré par la table verbatim.
      const capGold = Math.min(vesselFreeEnc(get), Math.floor(toBrass(get().money) / PA_PER_CO));
      const invest = Math.max(0, Math.min(Math.floor(pick.investGold ?? 0), capGold));
      if (invest <= 0) { lines.push(`💱 ${hero.name} — Commerce d'opportunité : aucune mise engagée.`); continue; }
      set({ money: fromBrass(toBrass(get().money) - invest * PA_PER_CO) });
      const value = testValue(hero, OPPORTUNITE.test.skillId);
      let total = 0;
      const rolls: string[] = [];
      for (let i = 0; i < OPPORTUNITE.test.maxAttempts; i++) {
        const t = rollTest(value, OPPORTUNITE.test.difficulty, rng);
        rolls.push(`🎲 ${t.roll}/${t.target}`);
        const step = extendedTestStep(total, t, OPPORTUNITE.test.totalDR);
        total = step.total;
        if (step.done) break;
      }
      const pct = opportunityTradePct(total);
      const back = Math.floor((invest * PA_PER_CO * pct) / 100);
      set({ money: fromBrass(toBrass(get().money) + back) });
      lines.push(`💱 ${hero.name} — Commerce d'opportunité (Marchandage ${DIFFICULTY_LABELS[OPPORTUNITE.test.difficulty]}, ${OPPORTUNITE.test.totalDR} DR visés) : ${rolls.join(' · ')} → ${total} DR — mise ${invest} CO, retour ${formatMoney(fromBrass(back))} (${pct} %).`);
      continue;
    }
    if (def.resolver === 'seaChart') {
      // Cartographie (l.288-290) : réussite → Carte marine (valeur = DR en CO, +2 DR d'Orientation).
      const value = testValue(hero, 'metier', undefined, 'Cartographe');
      const t = rollTest(value, def.difficulty ?? 'complexe', rng);
      if (t.success) {
        const it = itemFromTrappingById('carte-marine');
        if (it) {
          it.price = { gold: Math.max(0, t.sl), silver: 0, brass: 0 };
          hero.items = [...(hero.items ?? []), it];
          recomputeLoadout(hero);
        }
        lines.push(`🗺 ${hero.name} — Cartographie : 🎲 ${t.roll}/${t.target} → une Carte marine d'une valeur de ${Math.max(0, t.sl)} CO (+2 DR d'Orientation, MDG 15).`);
      } else {
        lines.push(`🗺 ${hero.name} — Cartographie : 🎲 ${t.roll}/${t.target} → les relevés sont inutilisables.`);
      }
      continue;
    }
    // Chemin GÉNÉRIQUE data-driven (défs futures sans résolveur bespoke) : même machinerie que les
    // Activités de voyage (Test « au choix », `onSuccess` en GameOp).
    const r = resolveTravelActivity(hero, def, rng);
    if (r.roll != null) lines.push(`📜 ${hero.name} — ${def.label} : 🎲 ${r.roll}/${r.target} → ${r.success ? 'réussite.' : 'échec.'}`);
    if (r.success && r.ops.length) lines.push(...applyOps(hero, r.ops, { label: def.label, rng, now: get().gameTime }));
  }
  set({ party: [...get().party], pendingSeaActivities: null });
  log(get, set, lines);
  const day: TravelRecapDay = { ...pending.day, lines: [...pending.day.lines, ...lines] };
  // Halte de nuit (machinerie EXISTANTE) — le recap du jour, Activités comprises, s'y lit.
  openRest(get, set, { places: placesOfKind('camp'), travelHalt: true, travelDay: day });
}

/** Catalogue 'mer' (source UNIQUE `activities.json`) — pour la modale. */
export function seaActivitiesCatalog(): ActivityDef[] {
  return activitiesFor('mer');
}
