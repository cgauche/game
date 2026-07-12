/**
 * REPOS — source UNIQUE de la nuit de sommeil (remplace le POC restPartyOvernight de combatFlow).
 *
 * `sleepParty` est LE moteur de nuit : horloge jusqu'à l'aube (chaque journée de repos se termine
 * à l'aube — le « temps minimum entre deux repos » est le temps lui-même), entretien quotidien #T3
 * (anti-double-comptage), récupération + cauchemars par héros, contagion de promiscuité. Consommé
 * par : la MODALE de Repos (ci-dessous), la nuit de voyage (travelFlow), la clôture d'interlude et
 * la triche de recette (`restParty`).
 *
 * La MODALE (pendingRest) ajoute par-dessus la phase RÉGLAGES par héros (couchage + pitance, coût
 * RAW calculé) ; « Dormir » ouvre ensuite une CHAÎNE de cascades séquentielles influençables (#347,
 * `openRestNight`/`continueRestNights`) — une nuit à la fois, jamais un jet pré-résolu, même pour un
 * repos de plusieurs jours (chaque nuit est reconstruite APRÈS que la précédente ait été validée).
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
import type { RecapTone } from './recapLine';
import { battleRng } from './battleRng';
import { partyAssisted, testValue } from '../engine/skills';
import { hasHealSkill } from '../engine/healing';
import { soberUpDissipate, soberUpHangover } from '../engine/drunkenness';
import { isOutOfAction, addCondition, removeCondition, loseWounds, addClockCondition } from '../engine/conditions';
import { restRecovery, restResistVal, applyRecoveryDay, needsRecoveryRoll, recoveryTarget, type RestRoll } from '../engine/rest';
import { rollContraction, DISEASE_DEFS, contagiousDiseases, contractionDue, applyContraction, applyDiseaseGangrene, applyDiseasePersist, activeMalaiseCount } from '../engine/disease';
import { applyOps } from '../engine/ops';
import { rule } from '../engine/policy';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import { applyFractureEnd } from '../engine/trauma';
import type { DeferredUpkeepTest } from './upkeep';
import { weatherExposure, exposureTestCount, expireExposureEffects, exposureShelterFromTent, applyExposureFailure, exposureTarget, sealskinDR, heaviestPossession, dropHeaviestPossession, type ExposureSeverity, type ExposureKind } from '../engine/exposure';
import { effectiveChar, bonus } from '../engine/characteristics';
import { forcedMarchTarget, applyForcedMarch } from '../engine/travel';
import { registerCascadeApplier, startCascade } from './cascade';
import { freeCons } from './rollSeam';
import type { CascadeStep, CascadeStepMeta } from './pendings';
import { isRation, feedFromMeal, applyFaimTest, applySoifTest } from '../engine/provisions';
import { toBrass, fromBrass, canAfford, subtract as moneySub, formatMoney, priceToMoney, type Money } from '../engine/money';
import { findTrappingById, NIGHT_STAKES } from '../data';
import { minutesUntilNext, DAWN_MINUTE, MINUTES_PER_DAY } from '../engine/clock';
import { runDailyUpkeep, dayIndex } from './upkeep';
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

/** Entrée du PROCÈS-VERBAL (bilan multi-jets, réutilisable : jour de mer #232, chronique de voyage…).
 *  Une ligne = un jet de ROUTINE déjà résolu (témoin), rendu en LECTURE SEULE par `MultiRollList` — la
 *  nuit de repos (#347) n'en tisse plus : chaque jet de nuit est une ÉTAPE de cascade influençable
 *  (`state/cascade.ts`), pas une ligne de PV recalculée après coup. */
export interface NightEntry {
  id?: string;
  actorId?: string;
  icon?: string;
  label: string;
  /** Jet affiché en RollLine (base + mods = cible · d100 · DR). */
  d?: RollBreakdown;
  /** Issue / note en clair (« +7 PB », « jour 4/6 »). */
  text?: string;
  /** Vocabulaire PARTAGÉ (#349) — `RecapTone`, `state/recapLine.ts` (même trio que `RecapLine.tone`). */
  tone?: RecapTone;
  /** Type de jet HÉROS de `sleepParty` (chemin EAGER — cheat `restParty`, clôture d'interlude) —
   *  décoratif hors de ces deux chemins. */
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
  phase: 'setup';
  /** COOP : ✓ par siège avant de dormir (l'hôte dort à l'unanimité). */
  readyBySeat?: Record<number, boolean>;
  /** Halte de NUIT d'un voyage (travelFlow) : portée par la DERNIÈRE cascade de nuit du séjour
   *  (`openRestNight`) — sa clôture reprend la route (`dispatchCascadeDone`, `combatSlice.ts`). */
  travelHalt?: boolean;
  /** HALTE de voyage : le RAPPORT DU JOUR (km, jets, péripéties) — affiché en tête de la modale
   *  (la journée se lit le soir même, le recap final ne re-déroule plus tout le trajet). */
  travelDay?: import('./travelFlow').TravelRecapDay;
  /** HALTE de voyage À PIED au-delà des heures RAW : héros à tester en MARCHE FORCÉE (l.224) — leurs
   *  jets ouvrent la cascade de la nuit (influençables), avant l'abri/la récupération. */
  travelMarch?: string[];
}

import type { Get, Set } from './flowTypes';
import type { PendingBase } from './rollFlowFactory';

/**
 * LE moteur de nuit (sans modale) : avance l'horloge à l'aube (× days), entretien #T3, récupération
 * + cauchemars, contagion. Renvoie le bilan structuré ; écrit aussi le journal.
 * NB : on n'avance PAS l'horloge minute par minute (advanceTime rejouerait l'entretien de Round —
 * hémorragie/poison/feu tueraient le dormeur ; RAW 16 l.105 : le repos suppose des États stabilisés,
 * restRecovery refuse d'ailleurs un héros Hémorragique/En flammes/Empoisonné).
 */
export function sleepParty(
  get: Get,
  set: Set,
  days = 1,
  opts: { fedDaily?: boolean } = {},
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
  set({ lastNightDay: dayIndex(get().gameTime) }); // nuit JOUÉE (#340) — désamorce la privation de sommeil

  // Soins prolongés (LDB 09) : présence d'un soignant valide (Guérison) → −1 jour/jour par maladie.
  const caredFor = get().party.some((h) => hasHealSkill(h) && !h.dead && !isOutOfAction(h));
  // Le bilan de nuit LISTE l'entretien quotidien (rations/faim, maladies, convalescence) — le
  // journal seul ne suffit pas. Portrait attribué par préfixe « Nom… » quand la ligne le porte.
  for (const text of runDailyUpkeep(get, set, { caredFor, fedDaily: opts.fedDaily })) {
    entries.push({ actorId: get().party.find((h) => text.startsWith(h.name))?.id, icon: 'time/calendar', label: 'Entretien quotidien', text, tone: 'info' });
  }

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
  set({ party: [...get().party] });
  get().log([title, ...journal]);
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

/** Enjeu d'un `kind` d'étape de nuit (`undefined` = aucun enjeu documenté → rien à afficher). Catalogue
 *  UNIQUE `src/data/night-stakes.json` (règle 5 : verbatim Source, Markdown) — un kind absent n'affiche
 *  rien (surfaçage progressif). */
function nightStake(kind: string): string | undefined {
  return NIGHT_STAKES.find((e) => e.kind === kind)?.stake;
}

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
  return { consequences: freeCons(j) };
});

registerCascadeApplier('nightmare', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  if (step.result.success) return { consequences: freeCons([`${hero.name} dort d'un sommeil sans rêve.`]) };
  addCondition(hero, 'extenue'); // LDB 21 l.92 : Calme +40 raté → Exténué
  return { consequences: freeCons([`${hero.name} est en proie à de terribles cauchemars (Calme +40 raté) → Exténué.`]) };
});

registerCascadeApplier('shelter', (get, _set, step, hero) => {
  if (!step.result) return;
  const sheltered = step.result.success; // Survie en extérieur réussie → abri qui tient (ch.09 l.559)
  const severity = (step.meta?.severity ?? 'difficile') as ExposureSeverity;
  const camperIds = String(step.meta?.campers ?? '').split(',').filter(Boolean);
  const count = exposureTestCount(severity, sheltered);
  const insert = count > 0 ? buildExposureSteps(get().party, camperIds, count) : [];
  return {
    consequences: freeCons([sheltered ? `${hero?.name ?? 'Le groupe'} dresse un abri — le camp tient la nuit.` : 'Aucun abri ne protège du temps.']),
    insert,
  };
});

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
    return { consequences: freeCons([held
      ? `${hero.name} — la peau de phoque retient le froid (échec de justesse tenu, +1 DR).`
      : `${hero.name} endure ${kind === 'froid' ? 'le froid' : 'la chaleur'} sans dommage.`]) };
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
      consequences: freeCons([`${hero.name} rate son Test d'Exposition (chaleur) — ${heavy.name} pourrait être jeté pour l'annuler.`]),
      insert: [{
        id: `${step.id}-drop`, kind: 'exposure-heat-drop', actorId: hero.id, icon: 'item/misc',
        label: 'Possession lourde', interactive: true,
        options: [{ key: 'jeter', label: `Jeter ${heavy.name}` }, { key: 'garder', label: 'Garder son paquetage' }],
        defaultChoice: 'garder', // consommé par `runCascadeImmediate` (repos multi-jours) — `resolveRemainingCascade`
        // (« Tout résoudre ») s'arrête TOUJOURS sur ce choix depuis 249e931f, n'applique plus JAMAIS de défaut
        meta: { failNumber: priorFails + 1 },
      }],
    };
  }
  return { consequences: freeCons(applyExposureFailure(hero, priorFails + 1, battleRng(), kind).log) };
});

registerCascadeApplier('exposure-heat-drop', (_get, _set, step, hero) => {
  if (!hero || step.chosen == null) return;
  if (step.chosen === 'jeter') {
    const name = dropHeaviestPossession(hero);
    return { consequences: freeCons([`${hero.name} se débarrasse de ${name ?? 'sa possession la plus lourde'} — le Test échoué est annulé (LDB 18 l.332).`]) };
  }
  return { consequences: freeCons(applyExposureFailure(hero, Number(step.meta?.failNumber ?? 1), battleRng(), 'chaleur').log) };
});

registerCascadeApplier('forcedMarch', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  return { consequences: freeCons([applyForcedMarch(hero, step.result.success).line]) }; // l.224 : échec → +Exténué
});

registerCascadeApplier('faim', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  const r = applyFaimTest(hero, step.result.success, bonus(effectiveChar(hero, 'endurance')), battleRng());
  if (r.damage > 0) loseWounds(hero, r.damage); // 1d10 ignore les PA (l.422)
  return { consequences: freeCons(r.log) };
});

registerCascadeApplier('soif', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  const r = applySoifTest(hero, step.result.success, bonus(effectiveChar(hero, 'endurance')), battleRng());
  if (r.damage > 0) loseWounds(hero, r.damage); // 1d10 ignore les PA (l.420)
  return { consequences: freeCons(r.log) };
});

registerCascadeApplier('dessoulage', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  // Dessoûlage (LDB 09 l.485) : le 1ᵉʳ Test INFLUENÇABLE fixe la dissipation (10−DR h). Le 2ᵉ Test (gueule
  // de bois, 5−DR h) devient sa PROPRE étape influençable INSÉRÉE ici (patron `insert`) — plus AUCUN jet
  // silencieux dans l'applier (#253) : le joueur peut influencer les DEUX jets (Chance/Résilience).
  const d = soberUpDissipate(hero, step.result.sl);
  const alc = testValue(hero, 'resistance-a-l-alcool', 'endurance');
  const insert: CascadeStep[] = [{
    id: `dessoulageHangover-${hero.id}`, kind: 'dessoulageHangover', actorId: hero.id, icon: 'time/night',
    rollLabel: 'Résistance', base: alc, target: alc, label: 'Gueule de bois', result: null, interactive: true,
  }];
  return { consequences: freeCons(d.log), insert };
});

registerCascadeApplier('dessoulageHangover', (get, _set, step, hero) => {
  if (!hero || !step.result) return;
  // 2ᵉ Test du dessoûlage (l.485), désormais influençable : le DR fixe la durée de la gueule de bois.
  const h = soberUpHangover(hero, get().gameTime, step.result.sl);
  addClockCondition(hero, h.hangover.name, h.hangover.value, h.hangover.until);
  return { consequences: freeCons(h.log) };
});

registerCascadeApplier('traumaFracture', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  return { consequences: freeCons(applyFractureEnd(hero, step.result.success, String(step.meta?.severity ?? 'mineur'), String(step.meta?.location ?? ''), String(step.meta?.traumaLabel ?? 'Fracture'))) };
});

registerCascadeApplier('diseaseTick', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  // Échec du Test de cycle quotidien (symptôme Blessé/Toxine) → applique la conséquence GameOp `onFail`
  // du symptôme (ex. Blessé → contractDisease 'blessure-purulente'). Donnée-driven, via applyOps.
  if (step.result.success) return { consequences: [] };
  const onFail = (step.meta?.onFail ?? []) as import('../engine/ops').GameOp[];
  return { consequences: freeCons(applyOps(hero, onFail, { rng: battleRng() })) };
});

registerCascadeApplier('diseaseGangrene', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  return { consequences: freeCons(applyDiseaseGangrene(hero, String(step.meta?.diseaseName ?? ''), step.result.success, Number(step.meta?.be ?? 0))) };
});

registerCascadeApplier('diseasePersist', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  const before = activeMalaiseCount(hero);
  const journal = applyDiseasePersist(hero, String(step.meta?.diseaseName ?? ''), step.result.success, step.result.sl, battleRng());
  // Réconcilie l'Exténué « collant » du malaise (l.153 : maladie guérie → −1) — différé avec le Test.
  const delta = activeMalaiseCount(hero) - before;
  if (delta < 0) removeCondition(hero, 'extenue', -delta);
  else if (delta > 0) addCondition(hero, 'extenue', delta);
  return { consequences: freeCons(journal) };
});

registerCascadeApplier('contagion', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  return { consequences: freeCons(applyContraction(hero, String(step.meta?.diseaseName ?? ''), step.result.success, battleRng())) };
});

/** Valeur de Calme d'un héros (LDB 21 : FM effective + avances de Calme) — cible du jet de cauchemars. */
function calmeVal(c: Combatant): number {
  return effectiveChar(c, 'force-mentale') + (c.skills?.find((s) => s.skillId === 'calme')?.advances ?? 0);
}

/** Icône d'étape de cascade par `kind` de Test d'entretien différé. */
const UPKEEP_STEP_ICON: Record<string, string> = {
  faim: 'rest/feast', diseaseTick: 'medical/infection', diseaseGangrene: 'medical/infection', diseasePersist: 'medical/infection',
  traumaFracture: 'medical/crutch', contagion: 'medical/infection',
};

/** Convertit les Tests d'entretien DIFFÉRÉS (`runDailyUpkeep` onDeferTest — Faim/Soif/maladie/
 *  convalescence/dessoûlage) en étapes de cascade influençables, avec leur enjeu verbatim (NIGHT_STAKES)
 *  quand il est documenté. SOURCE UNIQUE partagée par la nuit (`buildNightCascade`) et l'avance
 *  d'horloge (`advanceTime`). `startIndex` = décalage d'id quand d'autres étapes précèdent (marche forcée). */
export function deferredUpkeepSteps(party: Combatant[], deferred: DeferredUpkeepTest[], startIndex = 0): CascadeStep[] {
  const steps: CascadeStep[] = [];
  for (const t of deferred) {
    const h = party.find((x) => x.id === t.heroId);
    if (!h || h.dead) continue;
    const st: CascadeStep = { id: `${t.kind}-${t.heroId}-${startIndex + steps.length}`, kind: t.kind, actorId: t.heroId, label: t.label,
      icon: UPKEEP_STEP_ICON[t.kind] ?? 'nav/dice', rollLabel: 'Résistance', base: t.base, target: t.target, result: null, interactive: true, meta: t.meta as CascadeStepMeta | undefined };
    const stake = nightStake(t.kind); if (stake) st.stake = stake;
    steps.push(st);
  }
  return steps;
}

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
  set({ lastNightDay: dayIndex(get().gameTime) }); // nuit JOUÉE (#340) — désamorce la privation de sommeil
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
  // Tests d'entretien DIFFÉRÉS (faim, soif, maladie, convalescence, dessoûlage) → étapes influençables.
  steps.push(...deferredUpkeepSteps(party, deferred, steps.length));
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


  // ENJEU surfaçable (#331) : chaque étape de nuit porte ce que son échec coûte (verbatim Source),
  // affiché sous le titre d'étape par `CascadeModal` — source UNIQUE `NIGHT_STAKES` par `kind`.
  for (const st of steps) { const stake = nightStake(st.kind); if (stake) st.stake = stake; }

  // Journal : le titre de nuit + tout ce qui s'est ajouté APRÈS l'entretien (tente, récupération sans
  // jet…) — l'entretien lui-même est déjà dans le journal (`runDailyUpkeep`, écriture unique, #216).
  set({ party: [...get().party] });
  get().log(['— Le groupe dort jusqu’à l’aube —', ...log.slice(upkeepCount)]);
  bus.emit(EVT.SCENE_DIRTY);
  return { steps, log, slept: { from, to: get().gameTime } };
}

/** Prix RAW de l'hébergement et du repas d'auberge (LDB ch.66 p.302) — SOURCE UNIQUE le catalogue
 *  `trappings.json` (ids de service), plus AUCUNE constante dupliquée : le hub de ville (#343) et
 *  `restCost` lisent le MÊME tarif. Piètre = ½ (appliqué par `restCost`). */
function serviceBrass(id: string): number {
  const t = findTrappingById(id);
  if (!t) throw new Error(`restCost : tarif de service introuvable au catalogue "${id}" (trappings.json).`);
  return toBrass(priceToMoney(t.price));
}
const PRICE_BRASS = {
  commune: serviceBrass('chambre-commune-nuit'),
  privee: serviceBrass('chambre-privee-nuit'),
  repas: serviceBrass('repas-auberge'),
} as const;

/** Tarif d'un service d'auberge en monnaie (LDB ch.66 p.302, source unique catalogue) — affiché par le
 *  panneau d'auberge du hub de ville (#343), aligné au débit de `restCost`. */
export function restServicePrice(kind: keyof typeof PRICE_BRASS): Money {
  return fromBrass(PRICE_BRASS[kind]);
}

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
  // CHRONIQUE de voyage (#333) : une halte de voyage porte le jour FINALISÉ — on l'accumule sur le plan
  // (même `set` que la modale) pour que l'écran-hub (`VoyageScreen`) en tienne le journal (une carte par
  // jour passé), source unique (STRUCTURE `TravelRecapDay`, jamais une chaîne recomposée). No-op hors halte.
  const logPatch = opts?.travelDay && st.travelPlan
    ? { travelPlan: { ...st.travelPlan, log: [...(st.travelPlan.log ?? []), opts.travelDay] } }
    : {};
  set({ ...logPatch, pendingRest: { places, quality: opts?.quality ?? 'normale', days: Math.max(1, opts?.days ?? 1), perHero, phase: 'setup', travelHalt: opts?.travelHalt, travelDay: opts?.travelDay, travelMarch: opts?.travelMarch } });
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

/** Dormir : paie (RAW ch.66), nourrit, puis ouvre la CHAÎNE de cascades de nuit (#347, `openRestNight`). */
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

  // 3. Nuit(s) → CHAÎNE de cascades séquentielles influençables (#347, patron #253) : CHAQUE jet subi
  //    (faim, maladie, convalescence, contagion, abri, Exposition, récupération, cauchemars) est une
  //    ÉTAPE qu'on lance, influence (Chance/Résilience) puis VERROUILLE avant la suivante — AUCUN jet
  //    pré-résolu. Un repos de PLUSIEURS jours n'est PAS pré-construit d'un coup (l'entretien de la
  //    nuit N+1 lit l'état MUTÉ par la nuit N — compteurs de faim/soif, jours de maladie…) : chaque
  //    nuit est reconstruite APRÈS que la précédente ait été validée, chaînée par `dispatchCascadeDone`
  //    (`combatSlice.ts`, `done.restNights`) — une nuit UNIQUE est le cas `days=1` de la même primitive.
  //    Le report de voyage du jour a déjà été lu en phase RÉGLAGES (RestModal).
  set({ pendingRest: null });
  openRestNight(get, set, p, p.days, extraContagion);
}

/** Titre de la nuit — le couchage RÉELLEMENT choisi (pas l'OFFRE du lieu) : tout le monde dehors →
 *  Campement, même si une auberge était dispo (le joueur a choisi la belle étoile). Identique pour
 *  toutes les nuits d'un repos multi-jours (les choix de couchage ne changent pas en cours de séjour). */
function nightTitle(p: PendingRest, party: Combatant[]): string {
  const lodgings = party.filter((h) => !h.dead && p.perHero[h.id]).map((h) => p.perHero[h.id].lodging);
  return lodgings.some((l) => l === 'privee' || l === 'commune') ? 'Nuit à l’auberge'
    : lodgings.some((l) => l === 'maison') ? 'Nuit chez soi'
    : lodgings.some((l) => l === 'bord') ? 'Nuit à bord'
    : 'Campement';
}

/** Ouvre (ou enchaîne) UNE nuit de repos (#347) : reconstruit `buildNightCascade` pour CETTE nuit et
 *  l'ouvre en cascade influençable, en portant `nightsLeft` (nuits ENCORE à enchaîner après celle-ci)
 *  sur la cascade — sa clôture (`continueRestNights`, appelée par `dispatchCascadeDone`) reprend alors
 *  la nuit suivante. `extraContagion` (tambouille piètre) ne s'applique qu'à la nuit d'ARRIVÉE (repas
 *  du soir posé une fois en amont par `restSleep`).
 */
export function openRestNight(get: Get, set: Set, p: PendingRest, nightsLeft: number, extraContagion: ContagionSpec[] = []): void {
  const { steps, log } = buildNightCascade(get, set, p, { extraContagion });
  const remaining = nightsLeft - 1;
  // La halte de voyage (travelHalt) reprend la route à la clôture — SEULEMENT sur la DERNIÈRE nuit du
  // séjour (`remaining === 0`) : une nuit intermédiaire d'un repos multi-jours ne doit PAS re-déclencher
  // la reprise du voyage avant que les nuits suivantes n'aient eu lieu.
  const isLast = remaining <= 0;
  if (steps.length) {
    startCascade(get, set, {
      title: nightTitle(p, get().party), icon: 'time/night', purpose: isLast && p.travelHalt ? 'travel' : 'night',
      travelHalt: isLast ? p.travelHalt : undefined, steps, log, restNights: { p, nightsLeft: remaining },
    });
  } else if (remaining > 0) {
    // `buildNightCascade` a DÉJÀ journalisé le titre + tout ce qui suit l'entretien (#216) — rien à
    // influencer cette nuit-ci (PB pleins, pas de campement) → enchaîne directement la suivante.
    openRestNight(get, set, p, remaining, []);
  } else if (p.travelHalt) {
    continueTravelAfterNight(get, set);
  }
}

/** Reprend le repos MULTI-JOURS (#347) à la clôture d'une nuit (`dispatchCascadeDone`, `combatSlice.ts`,
 *  `done.restNights`) : ouvre la nuit SUIVANTE tant que `nightsLeft > 0`. No-op silencieux — le
 *  travelHalt de fin de séjour est repris par `openRestNight` lui-même sur la DERNIÈRE nuit. */
export function continueRestNights(get: Get, set: Set, ctx: { p: PendingRest; nightsLeft: number }): void {
  if (ctx.nightsLeft <= 0) return;
  openRestNight(get, set, ctx.p, ctx.nightsLeft, []);
}
