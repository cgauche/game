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

/** Test de scène (LDB 12) : réussite / échec / réussite garantie par Résilience. Le DR figure déjà
 *  dans le breakdown au-dessus — l'issue reste une phrase courte. */
export function describeTest(pt: PendingTest): string {
  if (pt.roll == null) return '';
  if (pt.forced) return `${pt.actorName} ne faillit pas (Résilience) : réussite garantie.`;
  return pt.success ? `${pt.actorName} réussit.` : `${pt.actorName} échoue.`;
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
    return r.success ? `${name} maîtrise son ${cl?.label.toLowerCase() ?? pe.kind}.` : `${name} est en proie à son ${cl?.label.toLowerCase() ?? pe.kind}.`;
  }
  if (pe.kind === 'terreur') {
    return r.success ? `${name} garde son sang-froid.` : `${name} est terrifié par ${pe.sourceName} : ${r.brise} État(s) Brisé.`;
  }
  return r.success ? `${name} surmonte sa peur de ${pe.sourceName}.` : `${name} a peur de ${pe.sourceName}.`;
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
    if (wounds) return `${ph.targetName} récupère ${preview} PB.`;
    if (trauma) return `Convalescence de ${ph.targetName} raccourcie de ${1 + Math.max(0, ph.sl)} jour(s).`;
    return `${1 + Math.max(0, ph.sl)} pion(s) d'Hémorragie stoppé(s) sur ${ph.targetName}.`;
  }
  return wounds && ph.intBonus + ph.sl < 0
    ? `Le soin blesse ${ph.targetName} (${ph.intBonus + ph.sl} PB).`
    : `Le soin de ${ph.targetName} reste sans effet.`;
}

/** Exposition à une Influence corruptrice (LDB 19) ou Test de seuil : issue de la popin. La VALIDATION
 *  applique la conséquence par un autre mécanisme (gainCorruption / « Je te renie ! » / mutation) →
 *  cette fonction n'unifie que la popin. */
export function describeCorruption(pc: PendingCorruption, name: string): string {
  if (pc.roll == null) return '';
  if (pc.kind === 'seuil') {
    return pc.success
      ? `${name} contient sa Corruption — pour cette fois.`
      : `${name} échoue — une mutation menace de se développer…`;
  }
  const gain = corruptionGain(pc.level ?? 'mineure', !!pc.success, pc.sl ?? 0);
  return gain === 0
    ? `${name} repousse l'Influence corruptrice.`
    : `${name} subit ${gain} Point${gain > 1 ? 's' : ''} de Corruption.`;
}

/** Jet d'Activité d'interlude (LDB 23) : issue de la popin (Revenus / Artisanat / Apprentissage /
 *  Identification). La VALIDATION applique la conséquence chiffrée (somme, objet, PX) à part. */
export function describeActivity(pa: PendingActivity): string {
  if (pa.roll == null) return '';
  const after = Math.max(0, (pa.drBefore ?? 0) + pa.sl);
  if (pa.kind === 'craft') {
    return after >= (pa.drTarget ?? 1) ? 'L’ouvrage est achevé !' : `L’ouvrage avance (${after}/${pa.drTarget} DR).`;
  }
  if (pa.kind === 'identify') {
    return pa.success
      ? pa.sl >= 4
        ? 'L’artefact est identifié — ses Particularités sont révélées.'
        : 'Nature magique cernée — les règles restent obscures (réétudiable).'
      : pa.sl <= -4
        ? 'Lourde méprise : de fausses certitudes s’installent…'
        : 'Semaine d’étude infructueuse — vous en êtes conscient.';
  }
  if (pa.kind === 'learn') {
    return pa.success
      ? 'Le Talent est acquis.'
      : 'Échec — PX et argent du tuteur dépensés en vain (+10 à la prochaine tentative).';
  }
  // revenus
  return pa.success
    ? 'Bonne semaine de travail — revenus pleins.'
    : pa.sl <= -6
      ? 'Très mauvaise semaine : rien gagné (Échec Stupéfiant).'
      : 'Semaine médiocre : la moitié des revenus.';
}

/** Marchandage (LDB 60 l.12) : VERDICT du Test opposé (source unique popin ↔ journal). */
export function describeBargain(pb: PendingBargain): string {
  const won = pb.result?.attackerWins ?? false;
  const drNet = pb.result?.netSL ?? 0;
  const discount = won ? (drNet >= 6 || pb.negotiator ? '−20 %' : '−10 %') : '—';
  // « Rater de beaucoup » (LDB 60 l.12) = perdre l'opposé par un net DR ≥ 6 → le marchand se méfie.
  if (!won && drNet >= 6) return 'Raté de beaucoup — le marchand se méfie (fini de marchander)';
  if (won) return pb.mode === 'buy' ? `Gagné (${discount} à l’achat)` : 'Gagné (½ du prix listé)';
  return pb.mode === 'buy' ? 'Perdu (prix plein)' : 'Perdu (¼ du prix listé)';
}

/** Évaluation / Détection d'artefact (LDB 60 l.10 / 10 l.310-312) : issue de la popin. La VALIDATION
 *  applique la révélation + l'estimation chiffrée à part (resolveAppraise). */
export function describeAppraise(pa: PendingAppraise): string {
  if (pa.roll == null) return '';
  const detect = pa.mode === 'detect';
  if (detect) {
    return pa.success
      ? `${pa.actorName} perçoit quelque chose en touchant ${pa.itemName}…`
      : `${pa.actorName} ne perçoit rien — l'artefact ne se laissera plus sonder.`;
  }
  return pa.success
    ? `${pa.actorName} jauge ${pa.itemName} : révélé ✓.`
    : `${pa.actorName} n'en tire rien — ${pa.itemName} reste inchangé.`;
}

/** Approche d'une source de Peur (LDB 21 l.29) : issue du Test de Calme (popin). Le fil journalise la
 *  conséquence (gate d'approche du Tour) à part. `name` = combattant ; `sourceName` = source de Peur. */
export function describeApproach(pa: PendingApproach): string {
  if (!pa.result) return '';
  return pa.result.success ? 'Le cran tient : il peut approcher ce Tour.' : 'La Peur le cloue : aucune approche ce Tour.';
}

/** Course (LDB 15-Dépl l.79-82) : issue du Test d'Athlétisme/Chevaucher (popin). Le fil journalise le
 *  déplacement réel (cases parcourues) à part. */
export function describeRun(pr: PendingRun): string {
  const r = pr.result;
  if (!r) return '';
  return `${r.success ? 'Course !' : 'Course poussive'} → +${r.bonusCases} cases (Marche + Course + DR).`;
}

/** « Se libérer » (Empêtré) / « se rouler » (En flammes) — LDB 16 l.61/77 : issue du Test (source unique
 *  popin ↔ journal). `name` = l'acteur. */
export function describeStateRecovery(sr: PendingStateRecovery, name: string): string {
  if (sr.roll == null) return '';
  const removed = sr.success ? Math.min(sr.stacks, 1 + Math.max(0, sr.netSL)) : 0;
  return `${name} ${sr.success ? `se dégage (${sr.netSL >= 0 ? '+' : ''}${sr.netSL} DR net) : ${removed} pion${removed > 1 ? 's' : ''} retiré${removed > 1 ? 's' : ''}` : 'n’y parvient pas — aucun pion retiré'}.`;
}

/** Rechargement = Test étendu de Projectiles (LDB 63 l.28-29) : issue (source unique popin ↔ journal).
 *  `after` = DR cumulé après ce jet (plafond 0). `weaponName` = NOM résolu de l'arme (uid → nom à l'appel). */
export function describeReload(pr: PendingReload, after: number, weaponName: string): string {
  if (pr.roll == null) return '';
  return after >= pr.reload ? `${weaponName} rechargé ✓` : `${pr.actorName} recharge ${weaponName} (${after}/${pr.reload} DR).`;
}

/** Focalisation = Test étendu (LDB 46) : issue (source unique popin ↔ journal). `prev`/`ni` = DR déjà
 *  cumulé et NI du sort. La ligne combine le jet (`result.log`) et le cumul mis à jour. */
export function describeFocus(pf: PendingFocus, prev: number, ni: number): string {
  const r = pf.result;
  if (!r) return '';
  const after = prev + r.dr;
  return `${r.log} → ${after}/${ni} DR${after >= ni ? ' (NI 0 atteint !)' : ''}`;
}

/** Entrée en Frénésie (LDB 21 l.32) : issue (source unique popin ↔ journal). `name` = le combattant. */
export function describeFrenzy(pf: PendingFrenzy, name: string): string {
  const r = pf.result;
  if (!r) return '';
  return r.success
    ? `${name} entre en Frénésie : +1 BF, immunité psy, attaque obligatoire.`
    : `${name} reste de marbre — le sang ne monte pas ce tour.`;
}

/** Désengagement (LDB 15-Dépl) — phase 'esquive' : verdict du Test opposé d'Esquive (popin). Le fil
 *  journalise la conséquence (Avantage, libération des Engagements) à part. */
export function describeDisengage(pd: PendingDisengage): string {
  return pd.result === 'success'
    ? 'Désengagé ! (+1 Avantage)'
    : pd.result === 'tie'
      ? 'Échange neutre — reste au contact'
      : "Échec — l'adversaire gagne l'Avantage";
}

/** Désengagement — phase 'fuir' : issue du coup dans le dos + Test de Calme, montrée INLINE (popin). */
export function describeDisengageFlee(pd: PendingDisengage): string {
  const f = pd.fuir;
  if (!f) return '';
  return `Fuite ! ${f.hit ? `Coup encaissé (${f.woundsLost} Blessure${f.woundsLost > 1 ? 's' : ''})${f.broken ? `, ${f.broken} État${f.broken > 1 ? 's' : ''} Brisé` : ''}. ` : 'Coup esquivé. '}Cours te mettre à l'abri.`;
}
