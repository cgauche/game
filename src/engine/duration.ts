/**
 * Durée d'un effet — représentation UNIQUE et discriminée. Remplace le couple `roundsLeft` +
 * `untilTime` (+ la sentinelle `COMBAT_PERSIST = 9999`) qui portait DEUX chemins d'expiration sur la
 * même structure : le type ci-dessous rend ce mélange impossible à la compilation.
 *
 *  - `rounds`     : échelle tactique — décrémentée à chaque frontière de Round (combat + entretien
 *                   hors combat au prorata). RAW : sorts « qui durent N Rounds ».
 *  - `clock`      : échéance d'HORLOGE en minutes `gameTime` absolues — purgée par l'horloge
 *                   (`purgeClockEffects`). RAW LDB 47 : « (Bonus de FM) heures », « lever du soleil ».
 *  - `permanent`  : ne s'éteint pas seul (retiré explicitement : repos, soin, dissipation).
 *  - `adventure`  : « pour votre prochaine aventure » (LDB 23 l.209/218/234 : Entraînement au Combat,
 *                   Observer une cible, Réputation) — posée à la clôture d'un interlude (`interludeEnd`),
 *                   purgée à l'OUVERTURE de l'interlude SUIVANT (`purgeAdventureEffects`, appelée par
 *                   `startInterlude`) : la borne « fin d'aventure » n'a pas d'échéance CHIFFRABLE
 *                   (Rounds/horloge) à la pose, contrairement à `clock`.
 *
 * Les deux échelles sont MUTUELLEMENT EXCLUSIVES par construction (un sort a une durée en Rounds OU en
 * minutes/heures/jours, jamais les deux — cf. `combatFlow` : `clockMin` n'est calculé que si `rounds`
 * est absent), ce que l'union discriminée reflète exactement.
 */
export type Duration =
  | { scale: 'rounds'; left: number }
  | { scale: 'clock'; until: number }
  | { scale: 'permanent' }
  | { scale: 'adventure' };

/** Libellé CANONIQUE d'un compte de Rounds — vocabulaire UNIQUE de l'échelle tactique, posé auprès du
 *  modèle pour qu'aucun affichage ne réinvente l'unité (le Round contient le tour de chaque combattant :
 *  un suffixe « t »/« tour » y serait faux). « Round » capitalisé comme terme RAW, accord réel. */
export function roundsLabel(n: number): string {
  return `${n} Round${n > 1 ? 's' : ''}`;
}

/** Avance une durée d'UN Round. Les échelles `clock`/`permanent`/`adventure` sont inertes au tick de Round. */
export function tickRound(d: Duration): Duration {
  return d.scale === 'rounds' ? { scale: 'rounds', left: d.left - 1 } : d;
}
