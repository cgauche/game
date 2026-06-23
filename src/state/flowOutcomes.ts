/**
 * NARRATION d'issue des jets — SOURCE UNIQUE par flux (popin ET journal).
 *
 * Motif unifié : chaque flux expose une fonction PURE `describeX(pending) → string` qui produit LA
 * ligne d'issue du jet. La modale l'affiche (`<JournalLine event={ev(kind, describeX(p), …)}>`) et le
 * store la journalise au même endroit — fini les `outcomeText` recalculés dans chaque modale (et
 * re-recalculés à la validation). Pour le combat, l'équivalent est `result.log`, déjà posé par le
 * moteur ; ces fonctions étendent le même principe aux flux non-combat.
 */
import type {
  PendingTest,
  PendingHeal,
  PendingCorruption,
  PendingRun,
  PendingApproach,
  PendingWard,
  PendingFocus,
  PendingFrenzy,
  PendingReload,
  PendingStateRecovery,
  PendingBargain,
  PendingAppraise,
  PendingDisengage,
} from './pendings';
import type { PendingEncounterPsych } from './encounterPsychFlow';
import type { PendingActivity } from './interludeFlow';
import { CIBLE_TYPES, CIBLE_LABEL } from '../engine/psychology';
import { healWoundsDelta } from '../engine/healing';
import { corruptionGain } from '../engine/corruption';
import { t } from '../i18n';

/** Test de scène (LDB 12) : réussite / échec / réussite garantie par Résilience. Le DR figure déjà
 *  dans le breakdown au-dessus — l'issue reste une phrase courte. */
export function describeTest(pt: PendingTest): string {
  if (pt.roll == null) return '';
  if (pt.forced) return t('out.testForced', { name: pt.actorName });
  return pt.success ? t('out.testSuccess', { name: pt.actorName }) : t('out.testFail', { name: pt.actorName });
}

/**
 * Option « Succès / échec stupéfiants » (LDB 12 l.151) : hors combat, un Test résolu sur un DOUBLE
 * est un Succès Stupéfiant (réussite) ou un Échec Stupéfiant (échec). PUREMENT un libellé (aucune
 * mécanique nouvelle). Retourne `null` quand il n'y a rien à afficher : avant le jet, sans double,
 * ou sur une réussite FORCÉE par Résilience (le « double » n'a pas eu lieu sur un vrai dé). La règle
 * elle-même (`rule('test-critiques-doubles')`) est lue par l'appelant — cette fonction reste pure. */
export function amazingTestLabel(pt: PendingTest): { success: boolean; text: string } | null {
  if (pt.roll == null || !pt.isDouble || pt.forced) return null;
  return { success: pt.success, text: pt.success ? t('out.amazingSuccess') : t('out.amazingFail') };
}

// (Psychologie EN COMBAT : PLUS de `describePsych` — l'issue des étapes de la cascade de Round est
//  produite par l'applier 'combatPsych' (state/combatFlow), comme la psy de rencontre.)

/** Psychologie À LA RENCONTRE, hors combat (couture C) : Trait ciblé social, Terreur ou Peur face à
 *  une source nommée. `name` = héros concerné. */
export function describeEncounterPsych(pe: PendingEncounterPsych, name: string): string {
  const r = pe.result;
  if (!r) return '';
  if (CIBLE_TYPES.has(pe.kind)) {
    const cl = CIBLE_LABEL[pe.kind];
    const kind = cl?.label.toLowerCase() ?? pe.kind;
    return r.success ? t('out.cibleMaster', { name, kind }) : t('out.cibleGrip', { name, kind });
  }
  if (pe.kind === 'terreur') {
    return r.success ? t('out.terreurHold', { name }) : t('out.terreurTerrified', { name, foe: pe.sourceName, brise: String(r.brise) });
  }
  return r.success ? t('out.fearOvercome', { name, foe: pe.sourceName }) : t('out.fear', { name, foe: pe.sourceName });
}

/** Soin de Guérison (LDB 09) : montant PRÉVU (aperçu) — Blessures rendues / Hémorragie stoppée /
 *  convalescence raccourcie. La VALIDATION applique le montant réel (plafonné, via resolveWoundsHeal) :
 *  cette ligne est l'aperçu de la popin, le fil journalise sa conséquence chiffrée à part. */
export function describeHeal(ph: PendingHeal): string {
  if (ph.roll == null) return '';
  const wounds = ph.mode === 'wounds';
  const trauma = ph.mode === 'trauma';
  const preview = wounds ? healWoundsDelta(ph.intBonus, ph.sl, ph.success) : 0;
  if (ph.success) {
    if (wounds) return t('out.healWounds', { name: ph.targetName, n: preview });
    if (trauma) return t('out.healTrauma', { name: ph.targetName, n: 1 + Math.max(0, ph.sl) });
    return t('out.healBleed', { n: 1 + Math.max(0, ph.sl), name: ph.targetName });
  }
  return wounds && ph.intBonus + ph.sl < 0
    ? t('out.healHarm', { name: ph.targetName, n: ph.intBonus + ph.sl })
    : t('out.healNone', { name: ph.targetName });
}

/** Exposition à une Influence corruptrice (LDB 19) ou Test de seuil : issue de la popin. La VALIDATION
 *  applique la conséquence par un autre mécanisme (gainCorruption / « Je te renie ! » / mutation) →
 *  cette fonction n'unifie que la popin. */
export function describeCorruption(pc: PendingCorruption, name: string): string {
  if (pc.roll == null) return '';
  if (pc.kind === 'seuil') {
    return pc.success
      ? t('out.corruptHold', { name })
      : t('out.corruptThreatens', { name });
  }
  const gain = corruptionGain(pc.level ?? 'mineure', !!pc.success, pc.sl ?? 0);
  return gain === 0
    ? t('out.corruptRepel', { name })
    : t('out.corruptGain', { name, gain, s: gain > 1 ? 's' : '' });
}

/** Jet d'Activité d'interlude (LDB 23) : issue de la popin (Revenus / Artisanat / Apprentissage /
 *  Identification). La VALIDATION applique la conséquence chiffrée (somme, objet, PX) à part. */
export function describeActivity(pa: PendingActivity): string {
  if (pa.roll == null) return '';
  const after = Math.max(0, (pa.drBefore ?? 0) + pa.sl);
  if (pa.kind === 'craft') {
    return after >= (pa.drTarget ?? 1) ? t('out.craftDone') : t('out.craftProgress', { after, target: String(pa.drTarget) });
  }
  if (pa.kind === 'identify') {
    return pa.success
      ? pa.sl >= 4
        ? t('out.identifyFull')
        : t('out.identifyPartial')
      : pa.sl <= -4
        ? t('out.identifyMisread')
        : t('out.identifyNone');
  }
  if (pa.kind === 'learn') {
    return pa.success
      ? t('out.learnDone')
      : t('out.learnFail');
  }
  // revenus
  return pa.success
    ? t('out.incomeGood')
    : pa.sl <= -6
      ? t('out.incomeNone')
      : t('out.incomeHalf');
}

/** Marchandage (LDB 60 l.12) : VERDICT du Test opposé (source unique popin ↔ journal). */
export function describeBargain(pb: PendingBargain): string {
  const won = pb.result?.attackerWins ?? false;
  const drNet = pb.result?.netSL ?? 0;
  const discount = won ? (drNet >= 6 || pb.negotiator ? t('out.fragDiscount20') : t('out.fragDiscount10')) : '—';
  // « Rater de beaucoup » (LDB 60 l.12) = perdre l'opposé par un net DR ≥ 6 → le marchand se méfie.
  if (!won && drNet >= 6) return t('out.bargainSuspicious');
  if (won) return pb.mode === 'buy' ? t('out.bargainWonBuy', { discount }) : t('out.bargainWonSell');
  return pb.mode === 'buy' ? t('out.bargainLostBuy') : t('out.bargainLostSell');
}

/** Évaluation / Détection d'artefact (LDB 60 l.10 / 10 l.310-312) : issue de la popin. La VALIDATION
 *  applique la révélation + l'estimation chiffrée à part (resolveAppraise). */
export function describeAppraise(pa: PendingAppraise): string {
  if (pa.roll == null) return '';
  const detect = pa.mode === 'detect';
  if (detect) {
    return pa.success
      ? t('out.detectSomething', { name: pa.actorName, item: pa.itemName })
      : t('out.detectNothing', { name: pa.actorName });
  }
  return pa.success
    ? t('out.appraiseRevealed', { name: pa.actorName, item: pa.itemName })
    : t('out.appraiseNone', { name: pa.actorName, item: pa.itemName });
}

/** Approche d'une source de Peur (LDB 21 l.29) : issue du Test de Calme (popin). Le fil journalise la
 *  conséquence (gate d'approche du Tour) à part. `name` = combattant ; `sourceName` = source de Peur. */
export function describeApproach(pa: PendingApproach): string {
  if (!pa.result) return '';
  return pa.result.success ? t('out.approachYes') : t('out.approachNo');
}

/** Bénédiction de Protection (LDB 41 l.105) : issue du Test de FM (popin). Le fil journalise la
 *  conséquence (attaque relancée / refusée) à part. `targetName` = la cible bénie. */
export function describeWard(pw: PendingWard, targetName: string): string {
  if (!pw.result) return '';
  return pw.result.success
    ? t('out.wardOvercome', { target: targetName })
    : t('out.wardBlocked', { target: targetName });
}

/** Course (LDB 15-Dépl l.79-82) : issue du Test d'Athlétisme/Chevaucher (popin). Le fil journalise le
 *  déplacement réel (cases parcourues) à part. */
export function describeRun(pr: PendingRun): string {
  const r = pr.result;
  if (!r) return '';
  return t('out.run', { label: r.success ? t('out.runYes') : t('out.runNo'), cases: r.bonusCases });
}

/** « Se libérer » (Empêtré) / « se rouler » (En flammes) — LDB 16 l.61/77 : issue du Test (source unique
 *  popin ↔ journal). `name` = l'acteur. */
export function describeStateRecovery(sr: PendingStateRecovery, name: string): string {
  if (sr.roll == null) return '';
  const removed = sr.success ? Math.min(sr.stacks, 1 + Math.max(0, sr.netSL)) : 0;
  const body = sr.success
    ? t('out.stateRecoveryWin', { sign: sr.netSL >= 0 ? '+' : '', netSL: sr.netSL, removed, s: removed > 1 ? 's' : '' })
    : t('out.stateRecoveryFail');
  return t('out.stateRecovery', { name, body });
}

/** Rechargement = Test étendu de Projectiles (LDB 63 l.28-29) : issue (source unique popin ↔ journal).
 *  `after` = DR cumulé après ce jet (plafond 0). `weaponName` = NOM résolu de l'arme (uid → nom à l'appel). */
export function describeReload(pr: PendingReload, after: number, weaponName: string): string {
  if (pr.roll == null) return '';
  return after >= pr.reload ? t('out.reloadDone', { weapon: weaponName }) : t('out.reload', { name: pr.actorName, weapon: weaponName, after, reload: pr.reload });
}

/** Focalisation = Test étendu (LDB 46) : issue (source unique popin ↔ journal). `prev`/`ni` = DR déjà
 *  cumulé et NI du sort. La ligne combine le jet (`result.log`) et le cumul mis à jour. */
export function describeFocus(pf: PendingFocus, prev: number, ni: number): string {
  const r = pf.result;
  if (!r) return '';
  const after = prev + r.dr;
  return t('out.focus', { log: r.log, after, ni, niReached: after >= ni ? t('out.fragNiReached') : '' });
}

/** Entrée en Frénésie (LDB 21 l.32) : issue (source unique popin ↔ journal). `name` = le combattant. */
export function describeFrenzy(pf: PendingFrenzy, name: string): string {
  const r = pf.result;
  if (!r) return '';
  return r.success
    ? t('out.frenzyEnter', { name })
    : t('out.frenzyNo', { name });
}

/** Désengagement (LDB 15-Dépl) — phase 'esquive' : verdict du Test opposé d'Esquive (popin). Le fil
 *  journalise la conséquence (Avantage, libération des Engagements) à part. */
export function describeDisengage(pd: PendingDisengage): string {
  return pd.result === 'success'
    ? t('out.disengageSuccess')
    : pd.result === 'tie'
      ? t('out.disengageTie')
      : t('out.disengageFail');
}

/** Désengagement — phase 'fuir' : issue du coup dans le dos + Test de Calme, montrée INLINE (popin). */
export function describeDisengageFlee(pd: PendingDisengage): string {
  const f = pd.fuir;
  if (!f) return '';
  const hit = f.hit
    ? t('out.fleeHit', { wounds: f.woundsLost, s: f.woundsLost > 1 ? 's' : '', broken: f.broken ? t('out.fleeBroken', { broken: f.broken, s: f.broken > 1 ? 's' : '' }) : '' })
    : t('out.fleeDodge');
  return t('out.disengageFlee', { hit });
}
