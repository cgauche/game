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
 *
 * Les deux échelles sont MUTUELLEMENT EXCLUSIVES par construction (un sort a une durée en Rounds OU en
 * minutes/heures/jours, jamais les deux — cf. `combatFlow` : `clockMin` n'est calculé que si `rounds`
 * est absent), ce que l'union discriminée reflète exactement.
 */
export type Duration =
  | { scale: 'rounds'; left: number }
  | { scale: 'clock'; until: number }
  | { scale: 'permanent' };

/** Avance une durée d'UN Round. Les échelles `clock`/`permanent` sont inertes au tick de Round. */
export function tickRound(d: Duration): Duration {
  return d.scale === 'rounds' ? { scale: 'rounds', left: d.left - 1 } : d;
}
