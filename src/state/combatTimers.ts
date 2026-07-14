/**
 * Registre des timers RÉELS de cadence de combat (IA/enchaînement de tour/auto-résolution).
 * `combatFlow`/`combatDirector`/`combatAuto` chorégraphient leurs beats (TEMPO) via de VRAIS
 * `setTimeout` qui mutent `battle` (et tirent `battleRng`) à leur échéance. Un test SYNCHRONE qui
 * arme un tel timer sans laisser le temps réel s'écouler le laisse EN VOL ; sous `isolate:false`
 * (module partagé entre fichiers du même worker) le timer se déclenche pendant un test ultérieur et
 * corrompt son `battle`/sa séquence de RNG — flake d'ordonnancement, pas d'instance (#405).
 *
 * `scheduleCombatTimer` remplace le `setTimeout` brut sur tout site qui pilote un beat de combat ;
 * `clearCombatTimers` (appelé par `src/test-setup.ts` en `afterEach`) annule tout timer encore en
 * vol au sortir d'un test.
 */
const pending = new Set<ReturnType<typeof setTimeout>>();

export function scheduleCombatTimer(fn: () => void, delay: number): ReturnType<typeof setTimeout> {
  const id = setTimeout(() => {
    pending.delete(id);
    fn();
  }, delay);
  pending.add(id);
  return id;
}

/** Annule tout timer de combat encore en vol (teardown de test). */
export function clearCombatTimers(): void {
  for (const id of pending) clearTimeout(id);
  pending.clear();
}
