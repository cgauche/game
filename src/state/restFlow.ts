/**
 * REPOS — source UNIQUE de la nuit de sommeil (remplace le POC restPartyOvernight de combatFlow).
 *
 * `sleepParty` est LE moteur de nuit : horloge jusqu'à l'aube (chaque journée de repos se termine
 * à l'aube — le « temps minimum entre deux repos » est le temps lui-même), entretien quotidien #T3
 * (anti-double-comptage), récupération + cauchemars par héros, contagion de promiscuité. Consommé
 * par : la MODALE de Repos (ci-dessous), la nuit de voyage (travelFlow), la clôture d'interlude et
 * la triche de recette (`restParty`).
 *
 * La MODALE (pendingRest) ajoute par-dessus : phase RÉGLAGES par héros (couchage + pitance, coût
 * RAW calculé), puis phase BILAN — UN écran globalisé de jets subis (brique multi-jets NightEntry,
 * réutilisable pour d'autres cascades), au lieu d'une pluie de modales.
 *
 * RAW :
 *  - Récupération (LDB 18 l.380) : Résistance +20 après « une bonne nuit de sommeil » → DR+BE PB,
 *    + BE/jour inconditionnel — le canon ne module PAS la récupération par la qualité du lit ;
 *  - Prix (LDB ch.66 p.304) : chambre commune 10 sc/pers · privée 10 pa pour 2 (la grande pour 4
 *    coûte le double → regrouper par paires est équivalent, coût auto) · repas 1 pa ; PIÈTRE = ½
 *    prix, et la nourriture piètre expose à la Courante galopante (10 %, ch.66 l.51) ;
 *  - Dehors : Exposition (LDB 18 l.408-415 — engine/exposure) selon la MÉTÉO de la scène ;
 *  - Faim (LDB 18 l.417-422) : un héros sans pitance ne récupère pas (engine/provisions).
 */
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import type { RollBreakdown } from '../engine/combat';
import { battleRng } from './battleRng';
import { rollTest } from '../engine/tests';
import { partyAssisted } from '../engine/skills';
import { hasHealSkill } from '../engine/healing';
import { isOutOfAction, addCondition, removeCondition, loseWounds } from '../engine/conditions';
import { restRecovery, restResistVal, applyRecoveryDay, needsRecoveryRoll, recoveryTarget, type RestRoll } from '../engine/rest';
import { rollContraction, DISEASE_DEFS, contagiousDiseases, contractionDue, applyContraction, applyDiseaseGangrene, applyDiseasePersist, activeMalaiseCount } from '../engine/disease';
import { applyOps } from '../engine/ops';
import { rule } from '../engine/policy';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import { applyFractureEnd } from '../engine/trauma';
import type { DeferredUpkeepTest } from './upkeep';
import { weatherExposure, exposureTestCount, exposureNight, expireExposureEffects, exposureShelterFromTent, applyExposureFailure, exposureTarget, sealskinDR, heaviestPossession, dropHeaviestPossession, type ExposureSeverity, type ExposureKind } from '../engine/exposure';
import { effectiveChar, bonus } from '../engine/characteristics';
import { forcedMarchTarget, applyForcedMarch } from '../engine/travel';
import { registerCascadeApplier, startCascade } from './cascade';
import type { CascadeStep, CascadeStepMeta } from './pendings';
import { isRation, feedFromMeal, applyFaimTest, applySoifTest } from '../engine/provisions';
import { toBrass, fromBrass, canAfford, subtract as moneySub, formatMoney, type Money } from '../engine/money';
import { minutesUntilNext, DAWN_MINUTE, MINUTES_PER_DAY } from '../engine/clock';
import { runDailyUpkeep } from './upkeep';
import { continueTravelAfterNight } from './travelFlow';
import { bus, EVT } from './bus';
import type { GameState } from './store';

export type RestKind = 'auberge' | 'maison' | 'camp';
export type RestLodging = 'commune' | 'privee' | 'maison' | 'dehors' | 'bord';
export type RestFood = 'repas' | 'ration' | 'maison' | 'rien';

/** Lieux de repos OFFERTS par le contexte (scène, effet, halte de voyage) — combinables :
 *  un village peut offrir l'auberge ET le camp ; chaque héros choisit ENSUITE le sien. */
export interface RestPlaces {
  auberge?: boolean;
  maison?: boolean;
  camp?: boolean;
  /** À bord du navire de campagne (hamacs/quartiers, MDG 03 l.71 · 09 l.87) — couchage ABRITÉ (pas
   *  d'Exposition de plein air) ; en mer c'est le seul couchage (l'offre `camp`/`dehors` s'efface). */
  bord?: boolean;
}

/** L'offre par DÉFAUT d'un contexte nommé (`kind`, faute de `lodging` explicite fourni par
 *  l'effet `rest` / halte de voyage) — dormir dehors reste toujours possible (choix personnel :
 *  on peut manger à l'auberge et dormir à la belle étoile). */
export function placesOfKind(kind: RestKind): RestPlaces {
  return kind === 'auberge' ? { auberge: true, camp: true } : kind === 'maison' ? { maison: true, camp: true } : { camp: true };
}

/** Entrée du PROCÈS-VERBAL (bilan multi-jets, réutilisable : bilan de nuit, jour de mer #232…). Une
 *  ligne = un jet de ROUTINE résolu en lot, rendu par le PV et — pour un jet de HÉROS RATÉ dont la
 *  conséquence est recalculable — INFLUENÇABLE après coup (Chance/relance, flux `restLedger`). */
export interface NightEntry {
  /** id STABLE de la ligne (ancre du flux `restLedger` : relance/+1 DR ciblent CETTE ligne). */
  id?: string;
  actorId?: string;
  icon?: string;
  label: string;
  /** Jet affiché en RollLine (base + mods = cible · d100 · DR). */
  d?: RollBreakdown;
  /** Issue / note en clair (« +7 PB », « jour 4/6 »). */
  text?: string;
  tone?: 'ok' | 'bad' | 'info';
  /** Type de conséquence RECALCULABLE ligne à ligne (delta pur, sans re-simuler la nuit) → seule une
   *  ligne ainsi taguée porte l'influence après coup. Absent = ligne LECTURE SEULE (conséquence tissée
   *  aux autres jours/jets, non réversible proprement : Exposition/Contagion/Faim). */
  reKind?: 'recovery' | 'nightmare';
  /** Relance de Chance déjà consommée sur CETTE ligne (LDB 12 l.40 : une relance max par Test). */
  rerolled?: boolean;
}

export interface PendingRest extends PendingBase {
  places: RestPlaces;
  /** Piètre : ½ prix, nourriture à risque (Courante galopante 10 %) — LDB ch.66. */
  quality: 'normale' | 'pietre';
  days: number;
  perHero: Record<string, { lodging: RestLodging; food: RestFood }>;
  phase: 'setup' | 'bilan';
  /** Bilan de la nuit (multi-jets). */
  results?: NightEntry[];
  /** Horloge avant/après (le passage du temps est VISIBLE). */
  slept?: { from: number; to: number };
  /** COOP : ✓ par siège avant de dormir (l'hôte dort à l'unanimité). */
  readyBySeat?: Record<number, boolean>;
  /** Halte de NUIT d'un voyage (travelFlow) : « Continuer » du bilan REPREND la route. */
  travelHalt?: boolean;
  /** HALTE de voyage : le RAPPORT DU JOUR (km, jets, péripéties) — affiché en tête de la modale
   *  (la journée se lit le soir même, le recap final ne re-déroule plus tout le trajet). */
  travelDay?: import('./travelFlow').TravelRecapDay;
  /** HALTE de voyage À PIED au-delà des heures RAW : héros à tester en MARCHE FORCÉE (l.224) — leurs
   *  jets ouvrent la cascade de la nuit (influençables), avant l'abri/la récupération. */
  travelMarch?: string[];
}

/**
 * RÉ-RÉSOLUTION d'une ligne de PV (Chance après coup, LDB 17 l.21-27) : le jet `tr` (relance ou +1 DR)
 * remplace celui de la ligne `entry`, et la CONSÉQUENCE est recalculée EN DELTA (sans re-simuler la
 * nuit) — recevable pour les seuls jets INDÉPENDANTS (`reKind`) :
 *  - `recovery` (LDB 18 l.380 volet a) : seul le soin de DR+BE est graduel ; le +BE inconditionnel
 *    (volet b) et la dissipation d'Exténué du sommeil ne dépendent PAS du jet → le delta = variation
 *    du volet a seul ;
 *  - `nightmare` (LDB 21 l.92) : échec → +1 Exténué ; la relance ajuste d'un cran l'Exténué.
 * Mute `hero`, renvoie le patch de la ligne (`d`/`text`/`tone`). `null` = ligne non ré-résolvable.
 */
export function applyLedgerReresolve(hero: Combatant, entry: NightEntry, tr: import('../engine/tests').TestResult): Partial<NightEntry> | null {
  const d = entry.d;
  if (!d || !entry.reKind) return null;
  const nd: RollBreakdown = { ...d, roll: tr.roll, success: tr.success, sl: tr.sl };
  if (entry.reKind === 'recovery') {
    const be = bonus(effectiveChar(hero, 'E'));
    const heal = (r: { success: boolean; sl: number }) => (r.success ? Math.max(0, r.sl) + be : 0); // volet a (LDB 18 l.380)
    const delta = heal(tr) - heal(d);
    if (delta !== 0) hero.wounds.current = Math.max(0, Math.min(hero.wounds.max, hero.wounds.current + delta));
    return { d: nd, text: delta > 0 ? `+${delta} PB (relance de Chance)` : tr.success ? 'récupération' : 'aucune récupération cette nuit', tone: tr.success ? 'ok' : 'bad' };
  }
  // nightmare : l'échec avait ajouté 1 Exténué (LDB 21 l.92) — la relance l'ajuste d'un cran.
  if (!d.success && tr.success) removeCondition(hero, 'extenue', 1);
  else if (d.success && !tr.success) addCondition(hero, 'extenue');
  return { d: nd, text: tr.success ? 'sommeil sans rêve (relance de Chance)' : 'cauchemars → Exténué', tone: tr.success ? 'ok' : 'bad' };
}

import type { Get, Set } from './flowTypes';
import type { PendingBase } from './rollFlowFactory';

/**
 * LE moteur de nuit (sans modale) : avance l'horloge à l'aube (× days), entretien #T3, récupération
 * + cauchemars, contagion. `beforeRecovery` (modale) s'exécute la nuit tombée, AVANT la récupération
 * (Exposition d'un campement). Renvoie le bilan structuré ; écrit aussi le journal.
 * NB : on n'avance PAS l'horloge minute par minute (advanceTime rejouerait l'entretien de Round —
 * hémorragie/poison/feu tueraient le dormeur ; RAW 16 l.105 : le repos suppose des États stabilisés,
 * restRecovery refuse d'ailleurs un héros Hémorragique/En flammes/Empoisonné).
 */
export function sleepParty(
  get: Get,
  set: Set,
  days = 1,
  opts: { fedDaily?: boolean; beforeRecovery?: (entries: NightEntry[]) => void } = {},
): NightEntry[] {
  if (get().battle) return [];
  const n = Math.max(1, Math.floor(days));
  const rng = battleRng();
  const entries: NightEntry[] = [];
  const journal: string[] = [];

  // La nuit passe — chaque journée de repos se termine à l'AUBE.
  const from = get().gameTime;
  const toDawn = minutesUntilNext(from, DAWN_MINUTE);
  const firstNight = toDawn === 0 ? MINUTES_PER_DAY : toDawn;
  set({ gameTime: from + firstNight + (n - 1) * MINUTES_PER_DAY });
  bus.emit(EVT.TIME_ADVANCED, { minutes: get().gameTime - from });

  // Soins prolongés (LDB 09) : présence d'un soignant valide (Guérison) → −1 jour/jour par maladie.
  const caredFor = get().party.some((h) => hasHealSkill(h) && !h.dead && !isOutOfAction(h));
  // Le bilan de nuit LISTE l'entretien quotidien (rations/faim, maladies, convalescence) — le
  // journal seul ne suffit pas. Portrait attribué par préfixe « Nom… » quand la ligne le porte.
  for (const text of runDailyUpkeep(get, set, { caredFor, fedDaily: opts.fedDaily })) {
    entries.push({ actorId: get().party.find((h) => text.startsWith(h.name))?.id, icon: 'time/calendar', label: 'Entretien quotidien', text, tone: 'info' });
  }

  // Campement (modale) : abri + Exposition AVANT la récupération.
  opts.beforeRecovery?.(entries);

  // Récupération + cauchemars, héros par héros (jets structurés pour le bilan).
  const party = get().party;
  for (const h of party) {
    if (h.dead) continue;
    const rolls: RestRoll[] = [];
    const log = restRecovery(h, rng, n, rolls);
    rolls.forEach((r, ri) => {
      entries.push({
        id: `${h.id}-${r.kind}-${ri}`,
        actorId: h.id,
        icon: r.kind === 'recovery' ? 'rest/bed' : 'creature/scream',
        label: r.kind === 'recovery' ? 'Récupération' : 'Cauchemars (Calme)',
        d: { label: r.kind === 'recovery' ? 'Résistance' : 'Calme', base: r.base, modifier: r.target - r.base, target: r.target, roll: r.roll, success: r.success, sl: r.sl },
        tone: r.success ? 'ok' : 'bad',
        reKind: r.kind,
      });
    });
    for (const line of log) entries.push({ actorId: h.id, icon: 'rest/bed', label: 'Nuit', text: line.replace(`${h.name} `, ''), tone: 'info' });
    journal.push(...log);
  }

  // Contagion de promiscuité (chambrée/campement — Toux et éternuements, LDB 20 l.206) : 1 Test de Contraction par nuit de repos.
  // Règle optionnelle « Utilisation des Maladies » : désactivée si disease-mode = off.
  for (const c of rule('disease-mode') === 'off' ? [] : runContagion(party, n, rng)) {
    entries.push({ actorId: c.actorId, icon: 'medical/infection', label: `Contagion (${c.dz})`, text: c.log.join(' '), tone: 'bad' });
    journal.push(...c.log);
  }

  const title = n > 1 ? `— Le groupe se repose ${n} jours —` : '— Le groupe dort jusqu’à l’aube —';
  set({ party: [...get().party], journal: [...get().journal.slice(-40), title, ...journal] });
  bus.emit(EVT.SCENE_DIRTY);
  return entries;
}

/** Contagion de promiscuité (Toux et éternuements, LDB 20 l.206 ; 1 Test/nuit) — chemin EAGER (sleepParty,
 *  multi-jours), roule le Test. La cascade utilise `collectContagion` (jet différé en étape). */
function runContagion(party: Combatant[], n: number, rng: RNG): { actorId: string; dz: string; log: string[] }[] {
  const out: { actorId: string; dz: string; log: string[] }[] = [];
  for (const sick of party) {
    for (const dz of contagiousDiseases(sick)) {
      for (const other of party) {
        if (other === sick || other.dead) continue;
        const def = DISEASE_DEFS[dz.name];
        for (let d = 0; d < n; d++) {
          const log = rollContraction(other, dz.name, restResistVal(other), def?.contractDifficulty ?? 'accessible', rng);
          if (log.length) out.push({ actorId: other.id, dz: dz.name, log });
        }
      }
    }
  }
  return out;
}

/** Un Test de Contraction d'entretien différé (contagion de promiscuité OU tambouille piètre). */
interface ContagionSpec { heroId: string; diseaseName: string; difficulty: Difficulty; resVal: number; }

/** RECENSE les Tests de Contraction de promiscuité DÛS (sans les rouler) — pour la cascade de nuit :
 *  chaque héros sain résiste à la maladie contagieuse d'un compagnon (1 jet par paire, dédoublonné). */
function collectContagion(party: Combatant[]): ContagionSpec[] {
  const out: ContagionSpec[] = [];
  const seen = new Set<string>();
  for (const sick of party) {
    for (const dz of contagiousDiseases(sick)) {
      for (const other of party) {
        if (other === sick || other.dead) continue;
        const key = `${other.id}:${dz.name}`;
        if (seen.has(key) || !contractionDue(other, dz.name)) continue;
        seen.add(key);
        out.push({ heroId: other.id, diseaseName: dz.name, difficulty: DISEASE_DEFS[dz.name]?.contractDifficulty ?? 'accessible', resVal: restResistVal(other) });
      }
    }
  }
  return out;
}

// ── CASCADE de NUIT (régime SÉQUENTIEL influençable, cf. cascade.ts) : chaque jet subi devient une
//    ÉTAPE (Lancer → Chance/Résilience → Valider, qui VERROUILLE le jet avant le suivant). La
//    CONSÉQUENCE par `kind` réutilise les primitives PURES (applyRecoveryDay, applyExposureFailure…)
//    — zéro duplication de formule vs la nuit eager (sleepParty/restRecovery). Une défaillance
//    impacte la suite (escalade Exposition, abri → nombre de jets) → c'est pourquoi c'est séquentiel.

/** Jets d'Exposition au froid pour les campeurs (`count` par campeur) — insérés par l'abri. */
function buildExposureSteps(party: Combatant[], camperIds: string[], count: number): CascadeStep[] {
  const steps: CascadeStep[] = [];
  for (const id of camperIds) {
    const h = party.find((x) => x.id === id);
    if (!h) continue;
    const resVal = restResistVal(h);
    for (let i = 0; i < count; i++) {
      steps.push({ id: `expo-${id}-${i}`, kind: 'exposure', actorId: id, label: 'Exposition', icon: 'rest/cold',
        rollLabel: 'Résistance', base: resVal, target: exposureTarget(h, resVal), result: null, interactive: true });
    }
  }
  return steps;
}

registerCascadeApplier('recovery', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  const before = hero.wounds.current;
  const { wokeUp } = applyRecoveryDay(hero, { sl: step.result.sl, success: step.result.success });
  const j: string[] = [];
  const healed = hero.wounds.current - before;
  if (healed > 0) j.push(`${hero.name} récupère ${healed} PB.`);
  else j.push(`${hero.name} ne récupère aucune Blessure cette nuit.`);
  if (wokeUp) j.push(`${hero.name} reprend connaissance.`);
  return { journal: j };
}, (ok, n) => (ok ? `${n} récupère des Blessures.` : `${n} ne récupère pas de Blessures cette nuit.`));

registerCascadeApplier('nightmare', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  if (step.result.success) return { journal: [`${hero.name} dort d'un sommeil sans rêve.`] };
  addCondition(hero, 'extenue'); // LDB 21 l.92 : Calme +40 raté → Exténué
  return { journal: [`${hero.name} est en proie à de terribles cauchemars (Calme +40 raté) → Exténué.`] };
}, (ok, n) => (ok ? `${n} dort d'un sommeil sans rêve.` : `${n} est en proie aux cauchemars → Exténué.`));

registerCascadeApplier('shelter', (get, _set, step, hero) => {
  if (!step.result) return;
  const sheltered = step.result.success; // Survie en extérieur réussie → abri qui tient (ch.09 l.559)
  const severity = (step.meta?.severity ?? 'difficile') as ExposureSeverity;
  const camperIds = String(step.meta?.campers ?? '').split(',').filter(Boolean);
  const count = exposureTestCount(severity, sheltered);
  const insert = count > 0 ? buildExposureSteps(get().party, camperIds, count) : [];
  return {
    journal: [sheltered ? `${hero?.name ?? 'Le groupe'} dresse un abri — le camp tient la nuit.` : 'Aucun abri ne protège du temps.'],
    insert,
  };
}, (ok) => (ok ? `L'abri tient la nuit.` : `Aucun abri ne protège du temps.`));

/** Un échec GENUINE d'Exposition à l'index `idx` a-t-il été ANNULÉ par le délestage d'une Possession
 *  lourde (LDB 18 l.332, chaleur) ? L'étape 'exposure-heat-drop' est TOUJOURS insérée juste après
 *  l'étape d'échec qu'elle tranche (cf. `insert` ci-dessous) — jamais de mutation rétroactive. */
function exposureFailCancelledByDrop(steps: CascadeStep[], idx: number): boolean {
  const next = steps[idx + 1];
  return next?.kind === 'exposure-heat-drop' && next.chosen === 'jeter';
}

registerCascadeApplier('exposure', (_get, _set, step, hero, ctx) => {
  if (!hero || !step.result) return;
  // Volet froid/chaleur (l.330/334) porté par l'étape (`meta.kind`) — défaut froid (nuit de repos). La peau
  // de phoque (MDG 14 l.277) retient l'échec de justesse AU FROID (+1 DR) : un échec ainsi tenu ne compte
  // NI comme conséquence NI dans l'escalade — comme le chemin eager `exposureNight`.
  const kind = (step.meta?.kind as ExposureKind) ?? 'froid';
  const skin = kind === 'froid' ? sealskinDR(hero) : 0;
  const genuineFail = (r: CascadeStep['result']) => !!r && !r.success && !(skin > 0 && r.sl + skin >= 1);
  if (!genuineFail(step.result)) {
    const held = !step.result.success; // échec de justesse tenu par la peau de phoque
    return { journal: [held
      ? `${hero.name} — la peau de phoque retient le froid (échec de justesse tenu, +1 DR).`
      : `${hero.name} endure ${kind === 'froid' ? 'le froid' : 'la chaleur'} sans dommage.`] };
  }
  // Escalade CUMULATIVE (l.330/334) : compte les échecs GENUINE d'Exposition DÉJÀ validés de CE héros pour CE
  // volet, hors ceux ANNULÉS par un délestage de Possession lourde (LDB 18 l.332).
  const priorFails = ctx.steps.slice(0, ctx.index)
    .filter((s, i) => s.kind === 'exposure' && s.actorId === hero.id && ((s.meta?.kind as ExposureKind) ?? 'froid') === kind
      && genuineFail(s.result) && !exposureFailCancelledByDrop(ctx.steps, i)).length;
  // CHALEUR (LDB 18 l.332) : « Vous débarrasser d'une Possession lourde annule 1 Test échoué » — choix
  // du JOUEUR, offert seulement s'il reste une Possession lourde à jeter (aucun seuil inventé, cf.
  // `heaviestPossession`). Sans Possession lourde (ou au FROID, silence du RAW sur ce point) : conséquence
  // immédiate, comportement inchangé.
  const heavy = kind === 'chaleur' ? heaviestPossession(hero) : undefined;
  if (heavy) {
    return {
      journal: [`${hero.name} rate son Test d'Exposition (chaleur) — ${heavy.name} pourrait être jeté pour l'annuler.`],
      insert: [{
        id: `${step.id}-drop`, kind: 'exposure-heat-drop', actorId: hero.id, icon: 'item/misc',
        label: 'Possession lourde', interactive: true,
        options: [{ key: 'jeter', label: `Jeter ${heavy.name}` }, { key: 'garder', label: 'Garder son paquetage' }],
        defaultChoice: 'garder', // résolution immédiate (repos multi-jours, « Tout lancer ») : comportement inchangé
        meta: { failNumber: priorFails + 1 },
      }],
    };
  }
  return { journal: applyExposureFailure(hero, priorFails + 1, battleRng(), kind).log };
}, (ok, n) => (ok ? `${n} endure l’exposition sans dommage.` : `${n} souffre de l’exposition.`));

registerCascadeApplier('exposure-heat-drop', (_get, _set, step, hero) => {
  if (!hero || step.chosen == null) return;
  if (step.chosen === 'jeter') {
    const name = dropHeaviestPossession(hero);
    return { journal: [`${hero.name} se débarrasse de ${name ?? 'sa possession la plus lourde'} — le Test échoué est annulé (LDB 18 l.332).`] };
  }
  return { journal: applyExposureFailure(hero, Number(step.meta?.failNumber ?? 1), battleRng(), 'chaleur').log };
}, (ok, n) => (ok ? `${n} se déleste — le Test échoué est annulé.` : `${n} souffre de l'Exposition (chaleur).`));

registerCascadeApplier('forcedMarch', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  return { journal: [applyForcedMarch(hero, step.result.success).line] }; // l.224 : échec → +Exténué
}, (ok, n) => (ok ? `${n} tient l'allure.` : `${n} s'épuise → Exténué.`));

registerCascadeApplier('faim', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  const r = applyFaimTest(hero, step.result.success, bonus(effectiveChar(hero, 'E')), battleRng());
  if (r.damage > 0) loseWounds(hero, r.damage); // 1d10 ignore les PA (l.422)
  return { journal: r.log };
}, (ok, n) => (ok ? `${n} supporte la faim.` : `${n} souffre de la faim.`));

registerCascadeApplier('soif', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  const r = applySoifTest(hero, step.result.success, bonus(effectiveChar(hero, 'E')), battleRng());
  if (r.damage > 0) loseWounds(hero, r.damage); // 1d10 ignore les PA (l.420)
  return { journal: r.log };
}, (ok, n) => (ok ? `${n} supporte la soif.` : `${n} souffre de la soif.`));

registerCascadeApplier('traumaFracture', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  return { journal: applyFractureEnd(hero, step.result.success, String(step.meta?.severity ?? 'mineur'), String(step.meta?.location ?? ''), String(step.meta?.traumaLabel ?? 'Fracture')) };
}, (ok) => (ok ? `La fracture ressoude proprement.` : `La fracture laisse une séquelle permanente.`));

registerCascadeApplier('diseaseTick', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  // Échec du Test de cycle quotidien (symptôme Blessé/Toxine) → applique la conséquence GameOp `onFail`
  // du symptôme (ex. Blessé → contractDisease 'blessure-purulente'). Donnée-driven, via applyOps.
  if (step.result.success) return { journal: [] };
  const onFail = (step.meta?.onFail ?? []) as import('../engine/ops').GameOp[];
  return { journal: applyOps(hero, onFail, { rng: battleRng() }) };
}, (ok, n) => (ok ? `${n} évite l'aggravation.` : `${n} : le symptôme s'aggrave.`));

registerCascadeApplier('diseaseGangrene', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  return { journal: applyDiseaseGangrene(hero, String(step.meta?.diseaseName ?? ''), step.result.success, Number(step.meta?.be ?? 0)) };
}, (ok, n) => (ok ? `${n} contient la gangrène.` : `${n} : la gangrène progresse.`));

registerCascadeApplier('diseasePersist', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  const before = activeMalaiseCount(hero);
  const journal = applyDiseasePersist(hero, String(step.meta?.diseaseName ?? ''), step.result.success, step.result.sl, battleRng());
  // Réconcilie l'Exténué « collant » du malaise (l.153 : maladie guérie → −1) — différé avec le Test.
  const delta = activeMalaiseCount(hero) - before;
  if (delta < 0) removeCondition(hero, 'extenue', -delta);
  else if (delta > 0) addCondition(hero, 'extenue', delta);
  return { journal };
}, (ok, n) => (ok ? `${n} guérit de sa maladie.` : `${n} : la maladie persiste.`));

registerCascadeApplier('contagion', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  return { journal: applyContraction(hero, String(step.meta?.diseaseName ?? ''), step.result.success, battleRng()) };
}, (ok, n) => (ok ? `${n} résiste à la contagion.` : `${n} contracte la maladie.`));

/** Valeur de Calme d'un héros (LDB 21 : FM effective + avances de Calme) — cible du jet de cauchemars. */
function calmeVal(c: Combatant): number {
  return effectiveChar(c, 'FM') + (c.skills?.find((s) => s.skillId === 'calme')?.advances ?? 0);
}

/** Icône d'étape de cascade par `kind` de Test d'entretien différé. */
const UPKEEP_STEP_ICON: Record<string, string> = {
  faim: 'rest/feast', diseaseTick: 'medical/infection', diseaseGangrene: 'medical/infection', diseasePersist: 'medical/infection',
  traumaFracture: 'medical/crutch', contagion: 'medical/infection',
};

/**
 * Construit la cascade d'UNE nuit (single-night INTERACTIVE) : avance l'horloge à l'aube, applique
 * l'entretien quotidien + la contagion + la récupération SANS jet (PB plein/affamé) en EAGER (journal),
 * et DIFFÈRE en ÉTAPES influençables : abri de fortune (→ insère l'Exposition), Exposition (escalade),
 * récupération (Résistance +20), cauchemars (Calme +40). Réutilise les primitives pures (zéro
 * duplication vs sleepParty). Renvoie les étapes + le journal eager + l'horloge avant/après.
 */
export function buildNightCascade(get: Get, set: Set, p: PendingRest, opts: { fedDaily?: boolean; extraContagion?: ContagionSpec[] } = {}): { steps: CascadeStep[]; log: string[]; slept: { from: number; to: number } } {
  const party = get().party;
  const log: string[] = [];
  const from = get().gameTime;
  // La nuit passe — une journée de repos se termine à l'AUBE.
  const toDawn = minutesUntilNext(from, DAWN_MINUTE);
  set({ gameTime: from + (toDawn === 0 ? MINUTES_PER_DAY : toDawn) });
  bus.emit(EVT.TIME_ADVANCED, { minutes: get().gameTime - from });
  // Entretien quotidien (#T3) — la partie SANS jet est eager (rations consommées, jours décomptés) ;
  // TOUT Test de Résistance (Faim l.422, maladie l.110/135/162, convalescence l.300) est DIFFÉRÉ en
  // étape influençable (sinon il serait pré-résolu dans le journal AVANT que le joueur n'agisse).
  const caredFor = party.some((h) => hasHealSkill(h) && !h.dead && !isOutOfAction(h));
  const deferred: DeferredUpkeepTest[] = [];
  // `runDailyUpkeep` journalise DÉJÀ ses propres lignes (upkeep.ts, source unique anti-double-comptage,
  // #216) : on les garde dans `log` (retourné pour le bilan/la modale de cascade) SANS les re-journaliser
  // plus bas — `upkeepCount` marque la frontière entre ce qui est déjà écrit et le reste de cette fonction.
  const upkeep = runDailyUpkeep(get, set, { caredFor, fedDaily: opts.fedDaily, onDeferTest: (t) => deferred.push(t) });
  log.push(...upkeep);
  const upkeepCount = upkeep.length;

  const steps: CascadeStep[] = [];
  // MARCHE FORCÉE de la journée de voyage (l.224) : un jet par héros — la chaîne ouvre la cascade.
  for (const id of p.travelMarch ?? []) {
    const h = party.find((x) => x.id === id);
    if (!h || h.dead) continue;
    steps.push({ id: `march-${id}`, kind: 'forcedMarch', actorId: id, label: 'Marche forcée', icon: 'travel/foot',
      rollLabel: 'Résistance', base: forcedMarchTarget(h), target: forcedMarchTarget(h), result: null, interactive: true });
  }
  // Tests d'entretien DIFFÉRÉS (faim, maladie, convalescence) → étapes influençables, dans l'ordre collecté.
  for (const t of deferred) {
    const h = party.find((x) => x.id === t.heroId);
    if (!h || h.dead) continue;
    steps.push({ id: `${t.kind}-${t.heroId}-${steps.length}`, kind: t.kind, actorId: t.heroId, label: t.label, icon: UPKEEP_STEP_ICON[t.kind] ?? 'nav/dice',
      rollLabel: 'Résistance', base: t.base, target: t.target, result: null, interactive: true, meta: t.meta as CascadeStepMeta | undefined });
  }
  // CONTAGION (promiscuité — Toux et éternuements, LDB 20 l.206 + tambouille piètre) → un jet de Résistance influençable par héros exposé.
  for (const c of [...collectContagion(party), ...(opts.extraContagion ?? [])]) {
    const h = party.find((x) => x.id === c.heroId);
    if (!h || h.dead) continue;
    steps.push({ id: `contagion-${c.heroId}-${steps.length}`, kind: 'contagion', actorId: c.heroId, label: `Contagion (${c.diseaseName})`, icon: 'medical/infection',
      rollLabel: 'Résistance', base: c.resVal, target: c.resVal + DIFFICULTY_MODIFIERS[c.difficulty], result: null, interactive: true, meta: { diseaseName: c.diseaseName },
      menace: 'maladie' }); // Test de Contraction = « résister à la Maladie » (Résistance (Menace), LDB 10)
  }
  // Campement : Exposition (intempéries) — abri de fortune (STEP) → insère les jets d'Exposition.
  const campers = party.filter((h) => !h.dead && p.perHero[h.id]?.lodging === 'dehors');
  const severity = weatherExposure(get().scene?.weather);
  if (campers.length && severity !== 'clement') {
    const camperIds = campers.map((h) => h.id);
    if (exposureShelterFromTent(party)) {
      log.push('La tente est montée — le groupe dort à l’abri.');
      const count = exposureTestCount(severity, true); // tente : extrême → rythme difficile, difficile → 0
      if (count > 0) steps.push(...buildExposureSteps(party, camperIds, count));
    } else {
      const best = partyAssisted(party.filter((h) => !h.dead), 'survie-en-exterieur'); // Soutien (LDB 12)
      if (best) {
        steps.push({ id: 'abri', kind: 'shelter', actorId: best.actor.id, label: 'Abri de fortune', icon: 'rest/camp',
          rollLabel: 'Survie en extérieur', base: best.value, target: best.value, result: null, interactive: true,
          meta: { severity, campers: camperIds.join(',') } });
      } else {
        const count = exposureTestCount(severity, false);
        if (count > 0) steps.push(...buildExposureSteps(party, camperIds, count));
      }
    }
    for (const h of campers) expireExposureEffects(h, get().gameTime + Number(rule('exposure-expire-hours')) * 60); // dissipation maison
  }

  // Récupération + cauchemars : un jet = une étape ; sans jet (PB plein/affamé/instable) → eager.
  for (const h of party) {
    if (h.dead) continue;
    if (needsRecoveryRoll(h)) {
      steps.push({ id: `recov-${h.id}`, kind: 'recovery', actorId: h.id, label: 'Récupération', icon: 'rest/bed',
        rollLabel: 'Résistance', base: restResistVal(h), target: recoveryTarget(h), result: null, interactive: true });
    } else {
      const before = h.wounds.current;
      const { wokeUp } = applyRecoveryDay(h, null);
      if (h.wounds.current - before > 0) log.push(`${h.name} récupère ${h.wounds.current - before} PB.`);
      if (wokeUp) log.push(`${h.name} reprend connaissance.`);
    }
    if (h.nightmares) {
      steps.push({ id: `nm-${h.id}`, kind: 'nightmare', actorId: h.id, label: 'Cauchemars', icon: 'creature/scream',
        rollLabel: 'Calme', base: calmeVal(h), target: calmeVal(h) + 40, result: null, interactive: true });
    }
  }


  // Journal : le titre de nuit + tout ce qui s'est ajouté APRÈS l'entretien (tente, récupération sans
  // jet…) — l'entretien lui-même est déjà dans le journal (`runDailyUpkeep`, écriture unique, #216).
  set({ party: [...get().party], journal: [...get().journal.slice(-40), '— Le groupe dort jusqu’à l’aube —', ...log.slice(upkeepCount)] });
  bus.emit(EVT.SCENE_DIRTY);
  return { steps, log, slept: { from, to: get().gameTime } };
}

/** Prix RAW (LDB ch.66 p.304), en sous de cuivre — piètre = ½. */
const PRICE_BRASS = { commune: 10, privee: 10 * 12, repas: 12 } as const; // 1 pa = 12 sc

/** Couchages proposés par l'offre du lieu — PAR HÉROS ensuite (choix personnels). */
export function lodgingOptions(places: RestPlaces): RestLodging[] {
  const out: RestLodging[] = [];
  if (places.auberge) out.push('privee', 'commune');
  if (places.maison) out.push('maison');
  if (places.bord) out.push('bord'); // à bord = hamacs (MDG 03 l.71) ; par défaut si offert
  if (places.camp || places.auberge || places.maison) out.push('dehors'); // la belle étoile reste un choix
  return out;
}

/** Pitances proposées (orthogonales au couchage : manger à l'auberge et dormir dehors est permis).
 *  « ration » seulement si le héros en a une. */
export function foodOptions(places: RestPlaces, hero: Combatant): RestFood[] {
  const out: RestFood[] = [];
  if (places.auberge) out.push('repas');
  if (places.maison) out.push('maison');
  if ((hero.items ?? []).some(isRation)) out.push('ration');
  out.push('rien');
  return out;
}

/** Coût total du repos (chambres regroupées par 2, repas par convive), par nuit × days. */
export function restCost(p: PendingRest, party: Combatant[]): Money {
  const half = p.quality === 'pietre' ? 0.5 : 1;
  let brass = 0;
  const heroes = party.filter((h) => !h.dead && p.perHero[h.id]);
  const nPrivee = heroes.filter((h) => p.perHero[h.id].lodging === 'privee').length;
  const nCommune = heroes.filter((h) => p.perHero[h.id].lodging === 'commune').length;
  const nRepas = heroes.filter((h) => p.perHero[h.id].food === 'repas').length;
  brass += Math.ceil(nPrivee / 2) * PRICE_BRASS.privee; // chambre pour 2 (grande pour 4 = ×2, équivalent)
  brass += nCommune * PRICE_BRASS.commune;
  brass += nRepas * PRICE_BRASS.repas;
  return fromBrass(Math.ceil(brass * half) * Math.max(1, p.days));
}

/** Offre de repos À LA POSITION DU GROUPE : zone de repos (rect d'auteur) prioritaire, sinon
 *  réglage de scène, sinon camp (défaut). PARAMÉTRABLE SUR LA ZONE dans l'éditeur. */
export function restPlacesHere(st: GameState): { places: RestPlaces; quality: 'normale' | 'pietre' } | null {
  const sc = st.scene;
  if (!sc) return null;
  const pos = st.partyPos;
  const zone = pos ? [...(sc.restZones ?? [])].reverse().find((z) =>
    pos.x >= z.rect.x && pos.x < z.rect.x + z.rect.w && pos.y >= z.rect.y && pos.y < z.rect.y + z.rect.h) : undefined;
  const places = zone?.places ?? sc.rest ?? { camp: true };
  if (!places.auberge && !places.maison && !places.camp) return null; // repos interdit ici
  return { places, quality: zone?.quality ?? sc.rest?.quality ?? 'normale' };
}

/** Ouvre la modale de Repos avec une OFFRE de lieux (effet, halte de voyage, bouton de Repos). */
export function openRest(get: Get, set: Set, opts?: { places?: RestPlaces; quality?: 'normale' | 'pietre'; days?: number; travelHalt?: boolean; travelDay?: import('./travelFlow').TravelRecapDay; travelMarch?: string[] }): void {
  const st = get();
  if (st.battle || st.pendingRest) return;
  const places = opts?.places ?? { maison: true, camp: true };
  const perHero: PendingRest['perHero'] = {};
  for (const h of st.party) {
    if (h.dead) continue;
    perHero[h.id] = { lodging: lodgingOptions(places)[0], food: foodOptions(places, h)[0] };
  }
  set({ pendingRest: { places, quality: opts?.quality ?? 'normale', days: Math.max(1, opts?.days ?? 1), perHero, phase: 'setup', travelHalt: opts?.travelHalt, travelDay: opts?.travelDay, travelMarch: opts?.travelMarch } });
}

export function restSet(get: Get, set: Set, heroId: string, patch: Partial<{ lodging: RestLodging; food: RestFood }>): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup' || !p.perHero[heroId]) return;
  const hero = get().party.find((h) => h.id === heroId);
  if (!hero) return;
  if (patch.lodging && !lodgingOptions(p.places).includes(patch.lodging)) return;
  if (patch.food && !foodOptions(p.places, hero).includes(patch.food)) return;
  set({ pendingRest: { ...p, perHero: { ...p.perHero, [heroId]: { ...p.perHero[heroId], ...patch } } } });
}

export function restReady(get: Get, set: Set, seat: number): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup') return;
  set({ pendingRest: { ...p, readyBySeat: { ...(p.readyBySeat ?? {}), [seat]: true } } });
}

export function restCancel(get: Get, set: Set): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup') return;
  set({ pendingRest: null });
}

/** « Continuer » du bilan — une halte de voyage REPREND la route au matin. */
export function restContinue(get: Get, set: Set): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'bilan') return;
  set({ pendingRest: null });
  if (p.travelHalt) continueTravelAfterNight(get, set);
}

/** Dormir : paie (RAW ch.66), nourrit, dort (`sleepParty`) avec l'Exposition du campement,
 *  puis bascule la modale en BILAN (multi-jets + horloge avant/après). */
export function restSleep(get: Get, set: Set): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup' || get().battle) return;
  const party = get().party;
  const rng = battleRng();

  // 1. Le prix de la nuit — refus si insolvable.
  const cost = restCost(p, party);
  if (toBrass(cost) > 0) {
    if (!canAfford(get().money, cost)) { get().log(`Pas assez d'argent (${formatMoney(cost)}).`); return; }
    set((s: GameState) => ({ money: moneySub(s.money, cost)! }));
  }

  // 2. Pitance AVANT la nuit (un héros nourri n'est plus affamé). La tambouille PIÈTRE (ch.66 l.51,
  //    10 %) expose à un Test de Résistance vs Courante Galopante — DIFFÉRÉ en étape de cascade.
  const extraContagion: ContagionSpec[] = [];
  for (const h of party) {
    const cfg = p.perHero[h.id];
    if (!cfg || h.dead) continue;
    if (cfg.food === 'repas' || cfg.food === 'maison') {
      feedFromMeal(h);
      if (cfg.food === 'repas' && p.quality === 'pietre' && rng.int(1, 100) <= 10 && contractionDue(h, 'courante-galopante')) {
        extraContagion.push({ heroId: h.id, diseaseName: 'courante-galopante', difficulty: DISEASE_DEFS['courante-galopante']?.contractDifficulty ?? 'accessible', resVal: restResistVal(h) });
      }
    }
    // 'ration' : consommée par l'entretien quotidien (#T3) ; 'rien' : la Faim suivra son cours.
  }

  // 3a. NUIT UNIQUE → CASCADE séquentielle influençable : CHAQUE jet subi (faim, maladie, convalescence,
  //     contagion, abri, Exposition, récupération, cauchemars) est une ÉTAPE qu'on lance, influence
  //     (Chance/Résilience) puis VERROUILLE avant la suivante. AUCUN jet pré-résolu. Le report de
  //     voyage du jour a déjà été lu en phase RÉGLAGES (RestModal).
  if (p.days === 1) {
    const { steps, log } = buildNightCascade(get, set, p, { extraContagion });
    set({ pendingRest: null });
    if (steps.length) {
      // Titre = le couchage RÉELLEMENT choisi (pas l'OFFRE du lieu) : tout le monde dehors → Campement,
      // même si une auberge était dispo (le joueur a choisi la belle étoile).
      const lodgings = party.filter((h) => !h.dead && p.perHero[h.id]).map((h) => p.perHero[h.id].lodging);
      const title = lodgings.some((l) => l === 'privee' || l === 'commune') ? 'Nuit à l’auberge'
        : lodgings.some((l) => l === 'maison') ? 'Nuit chez soi'
        : lodgings.some((l) => l === 'bord') ? 'Nuit à bord'
        : 'Campement';
      startCascade(get, set, { title, icon: 'time/night', purpose: p.travelHalt ? 'travel' : 'night', travelHalt: p.travelHalt, steps, log });
    } else {
      // `buildNightCascade` a DÉJÀ journalisé le titre + tout ce qui suit l'entretien (#216) — rien à
      // influencer (PB pleins, pas de campement), rien à rejournaliser ici.
      if (p.travelHalt) continueTravelAfterNight(get, set);
    }
    return;
  }

  // 3b. Repos de PLUSIEURS jours → résolution EAGER (on ne relance pas N nuits × M jets) : bilan lu.
  const pre: NightEntry[] = [];
  for (const c of extraContagion) { // tambouille piètre roulée d'office (multi-jours)
    const h = party.find((x) => x.id === c.heroId);
    if (!h) continue;
    const cl = applyContraction(h, c.diseaseName, rollTest(c.resVal, c.difficulty, rng).success, rng);
    pre.push({ actorId: c.heroId, icon: 'medical/infection', label: 'Tambouille douteuse', text: cl.join(' ') || 'Le repas passe mal…', tone: 'bad' });
  }
  const from = get().gameTime;
  const entries = sleepParty(get, set, p.days, {
    beforeRecovery: (out) => {
      const campers = party.filter((h) => !h.dead && p.perHero[h.id]?.lodging === 'dehors');
      if (!campers.length) return;
      const severity: ExposureSeverity = weatherExposure(get().scene?.weather);
      let sheltered = exposureShelterFromTent(party);
      if (sheltered) {
        out.push({ icon: 'rest/camp', label: 'Campement', text: 'La tente est montée — le groupe dort à l’abri.', tone: 'info' });
      } else if (severity !== 'clement') {
        // Abri de fortune : Survie en extérieur (« construire un abri », ch.09 l.559).
        const best = partyAssisted(party.filter((h) => !h.dead), 'survie-en-exterieur'); // Soutien (LDB 12)
        if (best) {
          const res = rollTest(best.value, 'intermediaire', rng);
          sheltered = res.success;
          out.push({
            actorId: best.actor.id, icon: 'rest/camp', label: 'Abri de fortune',
            d: { label: 'Survie en extérieur', base: best.value, modifier: res.target - best.value, target: res.target, roll: res.roll, success: res.success, sl: res.sl },
            text: res.success ? 'Un abri tient la nuit.' : 'Rien ne protège du temps.', tone: res.success ? 'ok' : 'bad',
          });
        }
      }
      const count = exposureTestCount(severity, sheltered);
      if (count <= 0) return;
      for (const h of campers) {
        const r = exposureNight(h, count, restResistVal(h), rng);
        for (const roll of r.rolls) {
          out.push({
            actorId: h.id, icon: 'rest/cold', label: 'Exposition (froid)',
            d: { label: 'Résistance', base: roll.base, modifier: roll.target - roll.base, target: roll.target, roll: roll.roll, success: roll.success, sl: roll.sl },
            tone: roll.success ? 'ok' : 'bad',
          });
        }
        if (r.log.length) out.push({ actorId: h.id, icon: 'rest/cold', label: 'Exposition', text: r.log.join(' '), tone: 'bad' });
        expireExposureEffects(h, get().gameTime + Number(rule('exposure-expire-hours')) * 60); // dissipation maison
      }
    },
  });

  set({ pendingRest: { ...p, phase: 'bilan', results: [...pre, ...entries], slept: { from, to: get().gameTime } } });
}
