/**
 * BATTEMENT DE FRAME du stage — le rythme UNIQUE de tout ce qui bouge la VUE hors des rendus React :
 * la marche qui glisse, le glisser-caméra, l'adoucissement d'un saut de focale.
 *
 * Ses abonnés sont les DEUX clients de la caméra — le groupe d'overlays SVG (`IsoStage`) et la caméra
 * three (`stage/GameStage3D`, par `StageWalkAnim.subscribe`). Ils reposent leur vue dans le MÊME
 * battement, à partir de la MÊME valeur (`camAt` de l'hôte) : c'est tout l'objet du module, et la
 * raison pour laquelle il n'y a qu'un battement pour toutes les sources.
 *
 * Deux façons de le faire battre, jamais deux boucles concurrentes : `battreStageFrames` pour qui
 * tient déjà une horloge (la boucle de marche `fx/useWalkAnim`, un `pointermove` que le navigateur
 * cadence déjà à l'image), et `demanderFrames`/`relacherFrames` pour ce qui n'en a aucune
 * (l'adoucissement de focale). La boucle de demande CÈDE le pas à un battement qui vient d'avoir lieu :
 * une même image ne se peint jamais deux fois.
 */

/** Écart (ms) en deçà duquel deux battements sont la MÊME image. */
const MEME_IMAGE_MS = 4;

const abonnés = new Set<() => void>();
const sources = new Set<unknown>();
let derniereMs = -Infinity;
let image = 0;

/** S'abonne au battement : une passe par image, tant qu'une source en demande. */
export function subscribeStageFrames(cb: () => void): () => void {
  abonnés.add(cb);
  return () => {
    abonnés.delete(cb);
  };
}

/** UN battement : chaque abonné repose ce qu'il tient hors de React. */
export function battreStageFrames(): void {
  derniereMs = performance.now();
  for (const cb of [...abonnés]) cb();
}

function armer(): void {
  if (image || !sources.size || typeof requestAnimationFrame !== 'function') return;
  image = requestAnimationFrame(() => {
    image = 0;
    if (!sources.size) return;
    if (performance.now() - derniereMs > MEME_IMAGE_MS) battreStageFrames();
    armer();
  });
}

/** Demande un battement CONTINU au nom de `source` — une clé d'INSTANCE (symbole, réf), jamais un nom
 *  global : deux écrans montés ne doivent pas se relâcher les images l'un de l'autre. */
export function demanderFrames(source: unknown): void {
  sources.add(source);
  armer();
}

/** Retire `source` ; la boucle s'arrête quand plus personne n'en demande. */
export function relacherFrames(source: unknown): void {
  sources.delete(source);
  if (sources.size || !image) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(image);
  image = 0;
}
