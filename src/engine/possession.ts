/**
 * SOCLE POSSESSIONS — moteur PUR (#614, `docs/plans/2026-07-19-socle-possessions.md` §4).
 *
 * « Un héros, un mercenaire, une mule : le MÊME portage » — une Possession PORTE des `ItemInstance[]`
 * avec exactement les sémantiques du héros (equipped/inside/contenants). Tronc commun minimal + union
 * discriminée par `nature` (§4.1 « pas de God-object » — arbitrage user 2026-07-19).
 */
import type { ItemInstance, Characteristics, NavalTraitRef } from './types';
import type { CargoLot } from './cargo';
import { mountProfileForTrapping } from './mountTravel';
import type { MountInjury } from './mountTravel';
import type { CrewHire, ShipMoraleState } from './crewMorale';
import type { ManannMood } from './seaVoyage';
import type { CustomStatblock } from './statblock';
import { findVehicleById, findCreatureById } from '../data';

export type PossessionLocation =
  | { kind: 'avec-le-groupe' }
  | { kind: 'au-lieu'; placeId: string }
  | { kind: 'embarquee'; hostUid: string };

/** Réf du VIVANT — la même dualité que le spawn (spawnEnemy ref|statblock, spawn.ts:347). */
export type LivingRef =
  | { creatureId: string } // bestiaire (édition Codex vivante)
  | { custom: CustomStatblock }; // PNJ/bête custom de l'éditeur — le snapshot EST son identité

/** TRONC — toute possession : une identité possédée, localisée, qui PORTE. */
interface PossessionCommon {
  uid: string; // pos-N, anti-collision par scan du registre (jamais un compteur module)
  ownerId: string; // héros propriétaire — OBLIGATOIRE à l'acquisition ; succession si mort/retiré
  label?: string; // nom d'instance (« Marguerite »), affichage pur
  location: PossessionLocation;
  items: ItemInstance[]; // LE système de sac unique — equipped/inside/contenants, primitives du héros
  cargo?: CargoLot[]; // vrac (tronc CargoCarrier)
  destroyed?: boolean; // perdue/morte — journal, filtrée partout
}

/** Champs d'INSTANCE navals (miroir de `CampaignVessel`, store.ts:1340 — T2/#267 y migre le singleton) — vehicleId/label/wounds/upgrades/cargo
 *  restent au tronc `Possession`/variante `navire` (mêmes champs que les autres natures) ; `crew` reste
 *  un champ propre de la variante `navire` (individuation marins nommés #250, T2). */
export interface NavalPossessionState {
  morale: ShipMoraleState;
  fouling?: { level: number; lastWeek: number };
  manann?: ManannMood;
  saboteurDR?: number;
  criticals?: string[];
  crabs?: boolean;
  waterLitres?: number;
  provisions?: number;
  lastVoyageMilles?: number;
  crewLost?: number;
  wagesOwed?: number;
}

/** CORPS — union discriminée : zéro champ étranger à sa nature. */
export type Possession = PossessionCommon &
  (
    | {
        nature: 'bete';
        ref: LivingRef;
        charsRolled?: Characteristics; // LDB 77 l.108 — tiré UNE fois, seedé sur l'UID, FIGÉ
        appearanceSeed?: string;
        wounds?: { current: number; max: number }; // max re-dérivé à chaque projection (clamp)
        mountInjury?: MountInjury; // EDOC 07 Incidents de Monte
        learnedTraits?: string[]; // dresse-* appris (LDB 23 → LDB 85)
      }
    | {
        // T3 (LDB 75 + AA 09, #453 prérequis)
        nature: 'serviteur';
        ref: LivingRef; // dont statblocs GÉNÉRÉS carrière+espèce (le générateur produit un CustomStatblock)
        charsRolled?: Characteristics;
        appearanceSeed?: string;
        wounds?: { current: number; max: number };
      }
    | {
        nature: 'vehicule';
        vehicleId: string; // vehicles.json (catalogue UNIFIÉ post T0-a)
        wounds?: { current: number; max: number };
      }
    | {
        // T2 (#267/#250)
        nature: 'navire';
        vehicleId: string;
        wounds?: { current: number; max: number };
        upgrades?: NavalTraitRef[]; // MDG 12, T2C ch.10
        crew?: CrewHire[]; // marins nommés #250 (individuation)
        naval: NavalPossessionState; // cf. CampaignVessel (T2/#267)
      }
    | {
        // T4 (#356) — location contrainte à au-lieu (fixe)
        nature: 'immeuble';
        buildingId: string;
      }
  );

/** Capacité de PORT (Contenu bête / chargement véhicule / Contenance navire, EDOC 07/LDB 70/MDG 12) —
 *  `undefined` = source de capacité INEXISTANTE (statbloc custom sans profil de monture, serviteur qui
 *  ne porte que son propre sac, immeuble T4 sans catalogue). PUR. */
export function possessionCapacity(p: Possession): number | undefined {
  switch (p.nature) {
    case 'bete':
      // `mountProfileForTrapping` : les ids de créature/trapping des montures EDOC sont TRANSITIONNELLEMENT
      // homonymes (#611) — re-key propre de `montures.json` par `creatureId` = T1-c3 (§4.5 de la spec).
      return 'creatureId' in p.ref ? mountProfileForTrapping(p.ref.creatureId)?.encPortee : undefined;
    case 'serviteur':
      return undefined; // porte son sac (ItemInstance) comme un héros — pas de bât dédié (LDB 75)
    case 'vehicule':
      return findVehicleById(p.vehicleId)?.chargement;
    case 'navire':
      return findVehicleById(p.vehicleId)?.ship?.capacity;
    case 'immeuble':
      return undefined; // pas de capacité de bât (T4, #356)
  }
}

/** Cette bête peut-elle être montée ? Non détruite, sans Incident de monte BLOQUANT (« Boiteux » : « ni
 *  monté, ni porter ou tirer de charge », EDOC 07 l.159 ; « Patte brisée » : « demeure immobile », l.161).
 *  Seule la nature `bete` est montable (véhicule/navire se conduisent, ne se chevauchent pas). PUR. */
export function possessionRideable(p: Possession): boolean {
  if (p.nature !== 'bete') return false;
  if (p.destroyed) return false;
  return p.mountInjury !== 'boiteux' && p.mountInjury !== 'patte-brisee';
}

/** Libellé affiché : `label` d'instance (« Marguerite ») sinon le libellé du catalogue de sa nature
 *  (doctrine id/label, CLAUDE.md règle stricte). PUR. */
export function possessionLabel(p: Possession): string {
  if (p.label) return p.label;
  switch (p.nature) {
    case 'bete':
    case 'serviteur':
      return 'creatureId' in p.ref ? (findCreatureById(p.ref.creatureId)?.label ?? p.ref.creatureId) : p.ref.custom.label;
    case 'vehicule':
    case 'navire':
      return findVehicleById(p.vehicleId)?.label ?? p.vehicleId;
    case 'immeuble':
      return p.buildingId; // catalogue immeuble = T4 (#356), pas encore de label
  }
}

/** Enc TOTAL transitif (propre + items, règles LDB 61 + cargo), replié dans la capacité de l'hôte pour
 *  chaque embarquée (§5 de la spec) — SIGNATURE seulement ici : la sommation récursive (garde-fous
 *  anti-cycle, bornes de chaîne `embarquee` par nature) est un chantier à part (§5, T1-c2). */
export function possessionTotalEnc(_p: Possession, _all: Possession[]): number {
  throw new Error('possessionTotalEnc: implémentation T1-c2 (§5 de docs/plans/2026-07-19-socle-possessions.md)');
}
