import { Combatant } from '../engine/types';
import { maxEncumbrance, totalEncumbrance } from '../engine/items';
import { encumbrancePenalties } from '../engine/encumbrance';
import { findPsychologyById, diseaseLabel } from '../data';
import { isAfflictionActive, PsychAffliction } from '../engine/psychology';
import { datasetArray } from '../data/overrides';
import type { IconIdInput } from './icons';

/** ids STABLES des rubriques de l'onglet État (`CharacterSheet.tsx`) — ancres de la bande d'alarmes
 *  ET repères du lot 1b (rendu des rubriques). Une alarme SANS rubrique posée dégrade proprement
 *  (scroll ignoré, cf. `CharacterSheet.tsx`). */
export const ETAT_ANCHOR_CRITIQUES = 'etat-critiques';
export const ETAT_ANCHOR_CORRUPTION = 'etat-corruption';
export const ETAT_ANCHOR_MALADIES = 'etat-maladies';
export const ETAT_ANCHOR_MUTATIONS = 'etat-mutations';
export const ETAT_ANCHOR_TRAUMAS = 'etat-traumas';
export const ETAT_ANCHOR_PSYCHOLOGIE = 'etat-psychologie';
export const ETAT_ANCHOR_ENCOMBREMENT = 'etat-encombrement';

/** Icône de repli quand aucune icône du registre ne porte la famille (jamais d'emoji). */
const FALLBACK_ICON: IconIdInput = 'ui/warning';

export interface SheetAlarm {
  key: string;
  label: string;
  icon: IconIdInput;
  tone: 'warn' | 'danger';
  anchor: string;
  /** Catégorie/id Codex de la famille (LOT L pt.3, `SheetAlarmsBand`) — omis quand la famille n'a
   *  PAS de catégorie UNIQUE (Critiques : 4+ catégories par table×kind) : popover NON forcé,
   *  documenté au call-site plutôt qu'inventé. Quand la famille est un agrégat (Mutations/Séquelles)
   *  sur une catégorie UNIQUE, `codexId` pointe la PREMIÈRE entrée listée (même arbitrage que la
   *  bande de section, `EtatPanel.tsx`). */
  codexCategory?: string;
  codexId?: string;
}

/** Une affliction psy (`PsychAffliction`) est-elle ACTIVE ? `isAfflictionActive` (`engine/psychology.ts`)
 *  + Frénésie (présence ⟹ active, comme `isFrenzied`) — la Frénésie n'est pas surmontable par un Test
 *  de Calme (cf. commentaire de la fonction engine), donc hors de son vocabulaire. Exportée : LE MÊME
 *  filtre sert au COMPTAGE (bande d'alarmes) et au RENDU (rubrique Psychologie, `EtatPanel.tsx`). */
export function isPsychAfflictionActive(p: PsychAffliction): boolean {
  if (p.type === 'frenesie') return true;
  return isAfflictionActive(p);
}

/** Sélecteur UNIQUE des alarmes de fiche (§3.1/3.2 design v4, #492) — la bande d'alarmes, la règle
 *  d'atterrissage et tout futur badge lisent LA même source. Ne porte JAMAIS Blessures/États
 *  (déjà sur les vitals + pastilles du portrait — zéro duplication). */
export function sheetAlarms(hero: Combatant): SheetAlarm[] {
  const out: SheetAlarm[] = [];

  const criticals = hero.criticalWounds ?? 0; // ACTIF (décompté au soin) — pas l'historique `critEntriesSuffered`
  if (criticals > 0) {
    // Pas de `codexCategory` : les critiques subis se répartissent sur 4+ catégories du Codex
    // (`criticalsTete`/`Bras`/`Corps`/`Jambe`, doublées en `aaCriticals*`) — aucune catégorie
    // UNIQUE ne représente l'agrégat (LOT L pt.3, popover NON forcé, verbatim brief).
    out.push({ key: 'critiques', label: `Critiques ${criticals}`, icon: 'medical/scalpel', tone: 'danger', anchor: ETAT_ANCHOR_CRITIQUES });
  }

  const corruption = hero.corruption ?? 0;
  if (corruption > 0) {
    out.push({
      key: 'corruption',
      label: `Corruption ${corruption}${hero.damned ? ' — DAMNÉ' : ''}`,
      // Icône DISTINCTE de Mutations (`nav/mutation`) — deux alarmes voisines ne partagent plus le
      // même glyphe (juge vision 2026-07-17).
      icon: 'flag/anger',
      tone: 'warn',
      anchor: ETAT_ANCHOR_CORRUPTION,
      // Entrée Codex UNIQUE : la caractéristique « Corruption » (`characteristics.json`, la jauge
      // d'âme — cf. `relations.test.ts` B3, jamais le trait homonyme de créature).
      codexCategory: 'characteristics',
      codexId: 'corruption',
    });
  }

  for (const d of hero.diseases ?? []) {
    // `d.name` = id STABLE (`DISEASE_DEFS`), jamais l'affichage — `diseaseLabel` résout (repli sur l'id
    // si inconnu, ex. héros de test synthétique). Catégorie UNIQUE + id RÉEL par instance : popover.
    out.push({ key: `maladie-${d.name}`, label: diseaseLabel(d.name), icon: 'medical/infection', tone: 'danger', anchor: ETAT_ANCHOR_MALADIES, codexCategory: 'maladies', codexId: d.name });
  }

  const mutationList = hero.mutations ?? [];
  if (mutationList.length > 0) {
    // Catégorie UNIQUE (`mutations`) : id = la PREMIÈRE mutation listée (agrégat, même arbitrage
    // que la bande de section `EtatPanel.tsx` — pas d'entrée fédératrice pour « Mutations N »).
    out.push({ key: 'mutations', label: `Mutations ${mutationList.length}`, icon: 'nav/mutation', tone: 'danger', anchor: ETAT_ANCHOR_MUTATIONS, codexCategory: 'mutations', codexId: mutationList[0].id });
  }

  // Traumas COSMÉTIQUES (cicatrices, `cosmetic:true`) exclus — Blessure d'origine déjà guérie (types.ts:769-772).
  const activeTraumasList = (hero.traumas ?? []).filter((t) => !t.cosmetic);
  if (activeTraumasList.length > 0) {
    // Catégorie UNIQUE (`traumas`) : id = la PREMIÈRE séquelle active (même arbitrage que Mutations).
    out.push({ key: 'traumas', label: `Séquelles ${activeTraumasList.length}`, icon: 'medical/crutch', tone: 'warn', anchor: ETAT_ANCHOR_TRAUMAS, codexCategory: 'traumas', codexId: activeTraumasList[0].traumaId });
  }

  for (const p of hero.psychState ?? []) {
    if (!isPsychAfflictionActive(p)) continue;
    const def = findPsychologyById(p.type);
    out.push({
      key: `psych-${p.type}-${p.cible ?? ''}`,
      label: def?.label ?? p.type,
      icon: (def?.icon as IconIdInput | undefined) ?? FALLBACK_ICON,
      tone: 'warn',
      anchor: ETAT_ANCHOR_PSYCHOLOGIE,
      codexCategory: 'psychologies',
      codexId: p.type,
    });
  }

  if (totalEncumbrance(hero) > maxEncumbrance(hero)) {
    // Catégorie UNIQUE (`encumbranceTiers`) : id = le PALIER RÉEL atteint (`encumbrancePenalties`,
    // même calcul que la rubrique Surcharge, `EtatPanel.tsx`) — jamais un palier deviné.
    const tier = datasetArray('encumbranceTiers').find((t) => t.tier === encumbrancePenalties(hero).tier);
    out.push({ key: 'surcharge', label: 'Surchargé', icon: FALLBACK_ICON, tone: 'warn', anchor: ETAT_ANCHOR_ENCOMBREMENT, codexCategory: 'encumbranceTiers', codexId: tier?.id });
  }

  return out;
}

/** Empreinte STABLE d'une liste d'alarmes (keys+labels joints, triés) — compare deux relevés
 *  indépendamment de l'ordre de production ; sert la règle d'atterrissage (`sheetAlarmsSeen`). */
export function alarmsFingerprint(alarms: SheetAlarm[]): string {
  return alarms
    .map((a) => `${a.key}:${a.label}`)
    .sort()
    .join('|');
}
