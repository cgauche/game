import type { EffectTrigger, TriggeredEffect } from '../../state/flow';

/** SOURCE UNIQUE des libellés FR d'un effet déclenché (`TriggeredEffect`) — partagée par l'affichage
 *  lecture seule (`describe.ts`) ET l'éditeur (`CodexEdit.tsx`). Le type `Record<EffectTrigger, …>`
 *  force l'exhaustivité : ajouter un trigger à l'union ⇒ le compilateur exige son libellé ICI (un seul
 *  endroit), sans map recopiée à maintenir en parallèle. */
export const TRIGGER_LABEL: Record<EffectTrigger, string> = {
  onHit: 'À la touche',
  onCrit: 'Sur un Critique',
  onWoundLoss: 'En perdant des PB',
  onSlain: 'À sa mise hors de combat',
  onRoundStart: 'Au début du Round',
  onStartled: 'Surpris (magie / bruit)',
  onKill: 'En tuant un adversaire',
  onCharged: 'Quand Chargé',
  onGainCondition: 'En gagnant un État',
  onCombatStart: 'Au début du combat',
  onCombatEnd: 'À la fin du combat',
  onRoundEnd: 'À la fin du Round',
  onTurnStart: 'Au début de son tour',
  onTurnEnd: 'À la fin de son tour',
  onDayStart: 'Au début de chaque jour',
  onWake: 'Au réveil',
  onAttackResolved: 'Après une attaque résolue',
  onCastResolved: 'Après une incantation résolue',
  onMiscast: 'Sur une Imparfaite',
  onOwnTestFailed: 'En échouant à un Test',
};

/** Libellés des CIBLES « simples » d'un effet (les valeurs chaîne éditables dans le `<select>` de l'éditeur). */
export const ON_LABEL: Record<'self' | 'victim' | 'engaged' | 'grappled', string> = {
  self: 'soi-même',
  victim: 'la victime',
  engaged: 'les adversaires engagés',
  grappled: 'la victime empoignée (absorbée)',
};

/** Libellé de la CIBLE d'un effet déclenché — chaîne simple, géométrie (`{near, radiusMeters}`) ou
 *  sélection limitée d'un adversaire engagé (`{pick, sizeAtMost, max}`). */
export const onLabel = (on: TriggeredEffect['on']): string =>
  typeof on === 'object'
    ? 'pick' in on
      ? `${on.max} adversaire(s) engagé(s)${on.sizeAtMost === 'self' ? ' de Taille ≤ la sienne' : ''}`
      : `les cibles à ≤ ${on.radiusMeters} m de ${on.near === 'self' ? 'soi' : 'la victime'}`
    : ON_LABEL[on];
