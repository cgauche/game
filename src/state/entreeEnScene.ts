/**
 * ENTRÉE EN SCÈNE — l'état « le monde a fini de cuire » rendu ATTENDABLE (#1478).
 *
 * Le voile d'entrée en scène vit dans le rendu volumique (`gameIso/stage/GameStage3D.tsx`), mais la
 * recette navigateur (`__wfrp.ready`) et le store doivent pouvoir l'attendre sans jamais importer
 * `src/gameIso` (garde `src/state/frontiere-state-gameiso.test.ts`). Ce module est le point de
 * rendez-vous : le stage SIGNALE, l'appelant ATTEND. Aucun polling — les attentes sont réveillées
 * par `signalerEntreeEnScene`, plus un minuteur de garde.
 */

type EtatEntree = { sceneId: string | null; voile: boolean };

const etat: EtatEntree = { sceneId: null, voile: false };
const attentes = new Set<() => void>();

/** Le rendu du monde déclare ce qu'il montre : la scène montée (`null` = plus aucun monde) et si son
 *  voile d'entrée est encore LEVÉ. Réveille les attentes en cours. */
export function signalerEntreeEnScene(sceneId: string | null, voile: boolean): void {
  etat.sceneId = sceneId;
  etat.voile = voile;
  for (const reveiller of [...attentes]) reveiller();
}

/** Lecture de l'état courant (diagnostic, bancs). */
export function entreeEnScene(): Readonly<EtatEntree> {
  return { sceneId: etat.sceneId, voile: etat.voile };
}

/**
 * Résout dès que la scène ATTENDUE est montée et son voile tombé. Le `setTimeout(0)` initial est
 * structurant : `scenario()`/`goto()` appelés dans le même `evaluate` que le `await` n'ont pas
 * encore laissé React commettre le montage qui suit — sans ce tour de boucle, l'attente jugerait
 * l'état du monde PRÉCÉDENT et rendrait « prêt » tout de suite.
 *
 * `sceneIdAttendu` est une FONCTION : l'id attendu se lit au moment du jugement (le store peut
 * n'avoir posé la scène qu'après l'appel).
 */
export function attendreEntreeEnScene(
  sceneIdAttendu: () => string | null,
  timeoutMs: number,
): Promise<{ sceneId: string; ms: number }> {
  const t0 = Date.now();
  return new Promise<void>((r) => setTimeout(r, 0)).then(() => new Promise((resolve, reject) => {
    const pret = (): boolean => etat.sceneId !== null && etat.sceneId === sceneIdAttendu() && !etat.voile;
    const fin = (): void => {
      attentes.delete(reveiller);
      clearTimeout(minuteur);
    };
    const reveiller = (): void => {
      if (!pret()) return;
      fin();
      resolve({ sceneId: etat.sceneId as string, ms: Date.now() - t0 });
    };
    const minuteur = setTimeout(() => {
      fin();
      reject(new Error(messageDEchec(sceneIdAttendu(), timeoutMs)));
    }, timeoutMs);
    attentes.add(reveiller);
    reveiller();
  }));
}

/** Le refus NOMME le cas : rien de monté, mauvaise scène, ou voile encore levé. */
function messageDEchec(attendu: string | null, timeoutMs: number): string {
  if (etat.sceneId === null) {
    return `✗ __wfrp.ready : aucun monde monté après ${timeoutMs} ms — aucune scène volumique n'a signalé son entrée en scène`;
  }
  if (attendu !== etat.sceneId) {
    return `✗ __wfrp.ready : scène attendue « ${attendu ?? 'aucune'} » vs montée « ${etat.sceneId} » après ${timeoutMs} ms`;
  }
  return `✗ __wfrp.ready : voile encore levé sur « ${etat.sceneId} » après ${timeoutMs} ms`;
}
