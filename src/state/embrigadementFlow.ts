/**
 * EMBRIGADEMENT — événement de port n°1 (MDG 15 l.245). Un autre navire enlève 2d10 marins ; on PEUT
 * les récupérer par une SÉQUENCE de Tests influençables : le groupe DÉCIDE d'abord de TENTER la
 * récupération ou de RENONCER (RAW « Vous pouvez les récupérer » — tenter est risqué : un échec coûte
 * 1d10 marins de plus), puis Ragot Intermédiaire (+0), puis — au CHOIX du joueur — rançon de 2d10 CO
 * OU Discrétion Complexe (−10). Un échec sur l'un des deux Tests coûte 1d10 marins de plus (l'autre
 * navire lève l'ancre).
 *
 * La perte de base (2d10) est PERSISTÉE sur `CampaignVessel.crewLost` par `applyVesselCrewLoss`
 * (plafonnée au nominal) AVANT d'ouvrir la séquence ; la récupération rappelle `applyVesselCrewLoss`
 * avec un delta NÉGATIF (premier appelant réel de ce recouvrement, #164). La séquence est une CASCADE
 * (`FLOWS.cascade`, régime des jets de voyage) : le JET de chaque étape est kind-agnostique (Test « +0 »
 * sur `target`, difficulté déjà fondue), la CONSÉQUENCE par `kind` vit dans les appliers ci-dessous.
 *
 * MDG 15 l.245 : « Si vous avez refusé la permission de faire relâche à terre à votre équipage, cet
 * événement n'a pas lieu. » — la relâche à terre n'est pas modélisée (#164) : l'événement se déclenche
 * donc toujours (aucune décision de relâche n'existe pour le désactiver).
 */
import type { Get, Set } from './flowTypes';
import type { CascadeStep } from './pendings';
import { startCascade, registerCascadeApplier } from './cascade';
import { freeCons } from './rollSeam';
import { applyVesselCrewLoss } from './shipCrew';
import { partyAssisted } from '../engine/skills';
import { subtract, toMoney } from '../engine/money';
import { DIFFICULTY_MODIFIERS, DIFFICULTY_LABELS, type Difficulty } from '../engine/types';
import { refLabel } from '../data';

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);
const diff = (v: unknown, d: Difficulty): Difficulty => (typeof v === 'string' ? (v as Difficulty) : d);

/** Ouvre la séquence de recouvrement d'un Embrigadement (MDG 15 l.245). Applique d'abord la perte de
 *  2d10 marins (persistée, plafonnée), puis — s'il reste des marins RÉELLEMENT enlevés — ouvre la
 *  cascade sur une DÉCISION opt-in (tenter/renoncer) avant tout Test. Dés déjà tirés par l'appelant. */
export function openEmbrigadementRecovery(
  get: Get, set: Set,
  r: { lost: number; ransomCO: number; extraLoss: number; gossipDiff: Difficulty; stealthDiff: Difficulty },
): void {
  const before = get().vessel?.crewLost ?? 0;
  for (const l of applyVesselCrewLoss(get, set, r.lost)) get().log(l);
  const recover = (get().vessel?.crewLost ?? 0) - before; // marins RÉELLEMENT enlevés (perte plafonnée au nominal)
  if (recover <= 0) return; // rien à récupérer
  startCascade(get, set, {
    title: 'Embrigadement', icon: 'nav/dice', purpose: 'test',
    steps: [{
      id: 'embrig-decision', kind: 'embrigadementDecision', icon: 'nav/dice',
      label: `${recover} membre(s) d'équipage embrigadé(s) — tenter de les récupérer ?`,
      options: [
        { key: 'tenter', label: 'Tenter la récupération', detail: 'Retrouver leur trace (Ragot) puis les libérer — un Test raté coûte 1d10 membres d\'équipage de plus.' },
        { key: 'renoncer', label: 'Renoncer', detail: 'Accepter la perte sans risquer d\'autres membres d\'équipage.' },
      ],
      meta: { recover, ransomCO: r.ransomCO, extraLoss: r.extraLoss, gossipDiff: r.gossipDiff, stealthDiff: r.stealthDiff },
    }],
  });
}

/** Étape-jet Ragot Intermédiaire (MDG 15 l.245) : menée par le plus compétent (+ Soutien) — insérée
 *  quand le groupe choisit de TENTER la récupération. */
function ragotStep(
  lead: { actor: { id: string }; value: number },
  recover: number, ransomCO: number, extraLoss: number, gossipDiff: Difficulty, stealthDiff: Difficulty,
): CascadeStep {
  return {
    id: 'embrig-ragot', kind: 'embrigadementRagot', actorId: lead.actor.id,
    icon: 'nav/dice',
    rollLabel: refLabel('skills', { id: 'ragot' }),
    base: lead.value, target: lead.value + DIFFICULTY_MODIFIERS[gossipDiff],
    label: `Retrouver l'équipage — Ragot ${DIFFICULTY_LABELS[gossipDiff]}`,
    meta: { recover, ransomCO, extraLoss, stealthDiff },
  };
}

// Décision opt-in (MDG 15 l.245 « Vous POUVEZ les récupérer ») : TENTER (insère le Ragot, au risque de
// −1d10 marins sur un échec) ou RENONCER (encaisser la perte 2d10 sans risque supplémentaire).
registerCascadeApplier(
  'embrigadementDecision',
  (get, set, step) => {
    if (step.chosen !== 'tenter') return { consequences: freeCons(['Vous renoncez à récupérer vos compagnons embrigadés.']) };
    const lead = partyAssisted(get().party.filter((h) => !h.dead), 'ragot');
    if (!lead) return { consequences: freeCons(['Personne à bord ne peut mener l\'enquête : vos compagnons restent captifs.']) };
    return {
      insert: [ragotStep(
        lead, num(step.meta?.recover), num(step.meta?.ransomCO), num(step.meta?.extraLoss),
        diff(step.meta?.gossipDiff, 'intermediaire'), diff(step.meta?.stealthDiff, 'complexe'),
      )],
    };
  },
);

/** Étape « choix » : rançon (2d10 CO) OU Discrétion Complexe (−10) — insérée quand le Ragot réussit. */
function choiceStep(recover: number, ransomCO: number, extraLoss: number, stealthDiff: Difficulty): CascadeStep {
  return {
    id: 'embrig-choix', kind: 'embrigadementChoix', icon: 'nav/dice',
    label: 'Comment libérer vos compagnons ?',
    options: [
      { key: 'payer', label: `Payer ${ransomCO} CO`, detail: 'Racheter les marins embrigadés à l\'autre équipage.' },
      { key: 'discretion', label: `Discrétion (${DIFFICULTY_LABELS[stealthDiff]})`, detail: 'Les libérer en douce (un échec coûte 1d10 marins de plus).' },
    ],
    meta: { recover, ransomCO, extraLoss, stealthDiff },
  };
}

// Ragot Intermédiaire (MDG 15 l.245) : réussite → CHOIX du joueur (insertion) ; échec → 1d10 marins de plus.
registerCascadeApplier(
  'embrigadementRagot',
  (get, set, step) => {
    if (!step.result) return;
    const recover = num(step.meta?.recover);
    const extraLoss = num(step.meta?.extraLoss);
    if (step.result.success) {
      return {
        consequences: freeCons(['Vous retrouvez la trace de vos compagnons embrigadés — reste à les libérer.']),
        insert: [choiceStep(recover, num(step.meta?.ransomCO), extraLoss, diff(step.meta?.stealthDiff, 'complexe'))],
      };
    }
    return { consequences: freeCons(applyVesselCrewLoss(get, set, extraLoss)) }; // l'autre navire prend la mer (1d10 de plus)
  },
);

// Choix rançon/Discrétion (MDG 15 l.245) : la rançon LIBÈRE d'office (débit) ; la Discrétion ouvre un Test.
registerCascadeApplier(
  'embrigadementChoix',
  (get, set, step) => {
    const recover = num(step.meta?.recover);
    const extraLoss = num(step.meta?.extraLoss);
    if (step.chosen === 'payer') {
      const ransomCO = num(step.meta?.ransomCO);
      const rest = subtract(get().money, toMoney({ gold: ransomCO }));
      if (!rest) return { consequences: freeCons([`La rançon de ${ransomCO} CO dépasse votre bourse : vos compagnons restent captifs.`]) };
      set({ money: rest });
      return { consequences: freeCons([`Rançon payée (${ransomCO} CO).`, ...applyVesselCrewLoss(get, set, -recover)]) };
    }
    // Discrétion : Test Complexe (−10) du plus discret — insertion d'une étape-jet.
    const stealthDiff = diff(step.meta?.stealthDiff, 'complexe');
    const lead = partyAssisted(get().party.filter((h) => !h.dead), 'discretion');
    if (!lead) return { consequences: freeCons(['Personne à bord n\'est assez discret pour tenter la libération.']) };
    return {
      insert: [{
        id: 'embrig-discretion', kind: 'embrigadementDiscretion', actorId: lead.actor.id,
        icon: 'nav/dice',
        rollLabel: refLabel('skills', { id: 'discretion' }),
        base: lead.value, target: lead.value + DIFFICULTY_MODIFIERS[stealthDiff],
        label: `Libérer en douce — Discrétion ${DIFFICULTY_LABELS[stealthDiff]}`,
        meta: { recover, extraLoss },
      }],
    };
  },
);

// Discrétion Complexe (MDG 15 l.245) : réussite → marins récupérés ; échec → 1d10 marins de plus.
registerCascadeApplier(
  'embrigadementDiscretion',
  (get, set, step) => {
    if (!step.result) return;
    const recover = num(step.meta?.recover);
    if (step.result.success) return { consequences: freeCons(['Vos compagnons sont libérés dans l\'ombre.', ...applyVesselCrewLoss(get, set, -recover)]) };
    return { consequences: freeCons(applyVesselCrewLoss(get, set, num(step.meta?.extraLoss))) }; // repéré : le navire lève l'ancre (1d10 de plus)
  },
);
