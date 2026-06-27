/**
 * INFIRMERIE — flux de soins HORS COMBAT unifié (Guérison / Hémorragie / Déchirure / Chirurgie) :
 * une modale PERSISTANTE (MedicModal) — bandeau patients → dossier (actes) → zone de jet — qui ne
 * se ferme pas entre deux actes. Remplace le POC à trois flux (HealModal hors combat, medicalAid
 * mono-acte, chirurgie autonome). Le RAW vit dans engine/healing + engine/trauma (sources uniques),
 * ici : orchestration seulement. En combat, le flux ActionBar reste (un acte = une Action).
 *
 * La CHIRURGIE (Test ÉTENDU, LDB 10 l.154 / 12 l.200) est « armée » sur l'infirmerie (`medic.surgery` :
 * chirurgien figé, patient verrouillé) ; chaque passe est un jet INFLUENÇABLE (`pendingSurgery` via
 * `FLOWS.surgery` — Chance/Pacte/Résilience comme tout jet de héros), qui inflige 1d10 PB + 1 Hémorragie
 * et cumule le DR (DrBar) à l'application (`surgeryNext`). Le Test d'infection du patient (cible atteinte)
 * est un jet SUBI poussé en RÉVÉLATION témoin. Entre deux passes, Bander (wounds) et Hémorragie (bleed)
 * redeviennent des ACTES NORMAUX du même patient — jet complet (Chance/Résilience), sans interrompre le cumul.
 *
 * Acte PAYANT (PNJ `medicalAid`, LDB 75 : l'aide médicale se paie à l'acte, 4-6 pistoles) :
 * débit au clic d'acte ; « Annuler » AVANT le jet rembourse ; arrêter une opération jamais
 * commencée rembourse aussi.
 */
import type { Combatant } from '../engine/types';
import { battleRng } from './battleRng';
import { extendedTestStep } from '../engine/tests';
import { partyAssisted } from '../engine/skills';
import { bonus, effectiveChar } from '../engine/characteristics';
import { addCondition, loseWounds } from '../engine/conditions';
import { hasHealSkill, hasSurgerySkill, availableHealModes, isHealable, type HealMode } from '../engine/healing';
import { removeSurgicalTrauma } from '../engine/trauma';
import { rollContraction } from '../engine/disease';
import { toMoney, canAfford, subtract as moneySub, add as moneyAdd } from '../engine/money';
import { touchActors } from './combatOrParty';
import { finishPlayerAction, pushReveal } from './combatFlow';
import type { GameState } from './store';

export interface MedicCost { gold?: number; silver?: number; brass?: number }

/** PNJ soigneur payant (effet `medicalAid`) : sa compétence + son tarif PAR ACTE. */
export interface MedicNpc {
  id: string;
  name: string;
  skill: number;
  intBonus: number;
  acts: { act: HealMode; cost?: MedicCost }[];
}

export interface MedicState {
  /** Absent = soins entre héros (meilleur soigneur du groupe). */
  npc?: MedicNpc;
  patientId: string | null;
  /** Opération ARMÉE : interrompre = perdre le cumul (Test étendu, LDB 12 l.200). */
  surgery?: {
    healerId?: string;
    healerName: string;
    skill: number;
    intBonus: number;
    traumaIdx: number;
    targetDR: number;
    cumDR: number;
    /** Dernière passe (affichage DrBar) — absent tant qu'aucune passe n'a été tentée. */
    last?: { roll: number; sl: number };
    /** Prix déjà débité (PNJ) — remboursé si on arrête AVANT la première passe. */
    paidCost?: MedicCost;
  };
}

import type { Get, Set } from './flowTypes';

/** Meilleur soigneur du groupe pour un acte (Opérer exige AUSSI le Talent Chirurgie, LDB 10). */
export function bestHealerFor(party: Combatant[], act: HealMode): { actor: Combatant; value: number } | null {
  const pool = act === 'surgery' ? party.filter((c) => hasHealSkill(c) && hasSurgerySkill(c)) : party.filter(hasHealSkill);
  return partyAssisted(pool, 'guerison'); // Soutien (LDB 12) : assistants de chirurgie/soin
}

/** Ouvre l'infirmerie (hors combat). Patient par défaut : celui demandé, sinon le premier soignable. */
export function openMedic(get: Get, set: Set, opts?: { patientId?: string; npc?: MedicNpc }): void {
  if (get().battle) return; // en combat : flux ActionBar (un acte = une Action)
  const party = get().party;
  const patientId = opts?.patientId ?? party.find((h) => isHealable(h))?.id ?? party[0]?.id ?? null;
  set({ medic: { npc: opts?.npc, patientId } });
}

export function medicSelectPatient(get: Get, set: Set, id: string): void {
  const m = get().medic;
  // Verrouillé pendant un jet posé et pendant une opération.
  if (!m || get().pendingHeal || m.surgery) return;
  if (!get().party.some((h) => h.id === id)) return;
  set({ medic: { ...m, patientId: id } });
}

export function closeMedic(get: Get, set: Set): void {
  const m = get().medic;
  if (!m || get().pendingHeal || m.surgery) return; // résoudre le jet / arrêter l'opération d'abord
  set({ medic: null });
}

/** Lance un ACTE sur le patient courant : wounds/bleed/trauma → jet différé (pendingHeal) ;
 *  surgery → ARME l'opération (les passes suivent). PNJ : débite le tarif de l'acte. */
export function medicAct(get: Get, set: Set, act: HealMode): void {
  const m = get().medic;
  if (!m || get().pendingHeal) return;
  if (m.surgery && (act === 'surgery' || act === 'trauma')) return; // pendant l'opération : seuls Bander/Hémorragie
  const patient = get().party.find((h) => h.id === m.patientId);
  if (!patient || !availableHealModes(patient).includes(act)) return;

  let healer: { id?: string; name: string; skill: number; intBonus: number };
  let paidCost: MedicCost | undefined;
  if (m.npc) {
    const offer = m.npc.acts.find((a) => a.act === act);
    if (!offer) return;
    if (offer.cost) { // débit à l'ACTE (LDB 75) — remboursé sur Annuler avant le jet
      const cost = toMoney(offer.cost);
      if (!canAfford(get().money, cost)) { get().log('Pas assez d’argent pour cet acte.'); return; }
      set((s: GameState) => ({ money: moneySub(s.money, cost)! }));
      paidCost = offer.cost;
    }
    healer = { id: m.npc.id, name: m.npc.name, skill: m.npc.skill, intBonus: m.npc.intBonus };
  } else {
    const best = bestHealerFor(get().party, act);
    if (!best) return;
    healer = { id: best.actor.id, name: best.actor.name, skill: best.value, intBonus: bonus(effectiveChar(best.actor, 'Int')) };
  }

  if (act === 'surgery') {
    set({
      medic: {
        ...m,
        surgery: {
          healerId: healer.id, healerName: healer.name, skill: healer.skill, intBonus: healer.intBonus,
          traumaIdx: 0, targetDR: 7, cumDR: 0, paidCost, // cible MJ 5-10 (LDB 10)
        },
      },
    });
    return;
  }
  set({
    pendingHeal: {
      healerId: healer.id ?? 'pnj-soigneur', healerName: healer.name, targetId: patient.id, targetName: patient.name,
      mode: act, intBonus: healer.intBonus, skillValue: healer.skill,
      difficulty: 'intermediaire', target: healer.skill, roll: null, success: false, sl: 0, paidCost,
    },
  });
}

/** Choix de la Blessure Critique à opérer — possible tant qu'aucune passe n'a été tentée. */
export function medicSetWound(get: Get, set: Set, idx: number): void {
  const m = get().medic;
  if (!m?.surgery || m.surgery.last) return;
  set({ medic: { ...m, surgery: { ...m.surgery, traumaIdx: idx } } });
}

/** OUVRE le jet INFLUENÇABLE d'UNE passe de Chirurgie (`pendingSurgery`) depuis l'opération armée
 *  (`medic.surgery`) — le jet de Médecine du chirurgien passe par `FLOWS.surgery` (Chance/Pacte/
 *  Résilience ; PNJ → influence no-op), `surgeryNext` applique. Idempotent : no-op si une passe est
 *  déjà posée (appelé pour la 1re passe ET pour rouvrir la suivante depuis `surgeryNext`). Ne TIRE rien. */
export function openSurgeryPass(get: Get, set: Set): void {
  const m = get().medic;
  const sg = m?.surgery;
  if (!m || !sg || get().pendingSurgery) return;
  const patient = get().party.find((h) => h.id === m.patientId);
  if (!patient) { set({ medic: { ...m, surgery: undefined } }); return; }
  set({
    pendingSurgery: {
      healerId: sg.healerId ?? 'pnj-soigneur', healerName: sg.healerName,
      targetId: patient.id, targetName: patient.name,
      skillValue: sg.skill, intBonus: sg.intBonus, difficulty: 'intermediaire', target: sg.skill,
      roll: null, success: false, sl: 0,
      traumaIdx: sg.traumaIdx, targetDR: sg.targetDR, cumDR: sg.cumDR, paidCost: sg.paidCost,
    },
  });
}

/** APPLIQUE la passe de Chirurgie (calque `extendedTestNext`) : prend le jet FIGÉ de `pendingSurgery`
 *  (déjà roulé + influencé en modale), cumule le DR (repart à 0 sous 0, LDB 12 l.200), inflige 1d10 PB +
 *  1 Hémorragie (LDB 10 l.154). Cible atteinte → Blessure Critique réparée + Test d'infection du PATIENT
 *  (LDB 10 l.365) RÉVÉLÉ témoin (jet SUBI, pas influençable — comme toute contraction de maladie). Patient
 *  à 0 PB → opération interrompue. Sinon → cumule sur `medic.surgery` et RÉOUVRE la passe suivante. */
export function surgeryNext(get: Get, set: Set): void {
  const ps = get().pendingSurgery;
  const m = get().medic;
  const sg = m?.surgery;
  if (!ps || ps.roll == null || !m || !sg) return;
  const patient = get().party.find((h) => h.id === m.patientId);
  if (!patient) { set({ pendingSurgery: null, medic: { ...m, surgery: undefined } }); return; }
  const { total: cum } = extendedTestStep(sg.cumDR, { success: ps.success, sl: ps.sl }, sg.targetDR); // Test étendu mutualisé (LDB 12) — chirurgie LDB 10
  const harm = battleRng().int(1, 10);
  loseWounds(patient, harm);
  addCondition(patient, 'hemorragique');
  const log = [`${sg.healerName} opère ${patient.name} — passe : DR ${ps.sl >= 0 ? '+' : ''}${ps.sl} (total ${cum}/${sg.targetDR}), ${harm} PB + 1 Hémorragie.`];
  if (patient.wounds.current <= 0) { // « de fortes chances de tuer » (LDB 10) : on interrompt
    log.push(`${patient.name} sombre sur la table — l'opération est interrompue (stabilisez-le d'abord).`);
    set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
    finishPlayerAction(get, set, log, 'heal');
    return;
  }
  if (cum >= sg.targetDR) { // cible atteinte : la Blessure Critique est réparée
    log.push(...removeSurgicalTrauma(patient, sg.traumaIdx));
    // Test d'infection du PATIENT (LDB 10 l.365) : Résistance Accessible (+20), jet SUBI poussé en
    // RÉVÉLATION témoin (pas un pending influençable) — calque la contraction de maladie révélée.
    const resVal = effectiveChar(patient, 'E') + (patient.skills?.find((s) => s.skillId === 'resistance')?.advances ?? 0);
    const infection = rollContraction(patient, 'infection-mineure', resVal, 'accessible', battleRng());
    const infectionLines = infection.length ? infection : [`${patient.name} résiste à l'infection post-opératoire.`];
    pushReveal(set, { kind: 'effet', title: 'Suites de l’opération', lines: infectionLines, subjectId: patient.id, severity: infection.length ? 'grave' : 'minor' });
    log.push(...infectionLines);
    set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
    finishPlayerAction(get, set, log, 'heal');
    return;
  }
  // Passe intermédiaire : cumule (medic.surgery), journalise, et RÉOUVRE la passe suivante (FLOWS.surgery).
  set({ medic: { ...m, surgery: { ...sg, cumDR: cum, last: { roll: ps.roll, sl: ps.sl } } }, pendingSurgery: null, ...touchActors(get()) });
  get().log(log[0]);
  openSurgeryPass(get, set);
}

/** Annule la Chirurgie (le cumul est perdu — Test étendu interrompu, LDB 12 l.200). Jamais commencée
 *  (aucune passe appliquée) → l'acte PNJ est remboursé, comme `healCancel`. Ferme la passe en cours
 *  (`pendingSurgery`) ET l'opération armée (`medic.surgery`). */
export function surgeryCancel(get: Get, set: Set): void {
  const m = get().medic;
  const sg = m?.surgery;
  if (!m || !sg) { set({ pendingSurgery: null }); return; }
  if (!sg.last && sg.paidCost) set((s: GameState) => ({ money: moneyAdd(s.money, toMoney(sg.paidCost!)) }));
  set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
  if (sg.last) get().log(`${sg.healerName} interrompt l'opération — le travail est à refaire.`);
}
