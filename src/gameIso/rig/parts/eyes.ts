/**
 * YEUX PERSONNALISABLES du visage — l'œil peint est un élément ADRESSABLE des têtes
 * générées (`<g data-eye="G/D" data-ec="x y">…</g>`, cf. generated/heads.ts) : on le
 * REMPLACE en place, à la vraie position de l'orbite de chaque espèce/sexe.
 * Consommé par les blessures (œil de verre, cache-œil), les mutations (Œil énorme)
 * et ouvert aux créatures/éditeur (yeux d'animaux : chat, caprin, reptilien…).
 * Chaque art est dessiné CENTRÉ sur (0,0), orbite de référence rx≈2.05 ry≈1.3.
 */

/** Orbite standard (sclère + cerne) autour d'un iris fourni. */
const socle = (iris: string) =>
  '<ellipse rx="2.05" ry="1.3" fill="#f3ede1"/><ellipse rx="2.05" ry="1.3" fill="none" stroke="#7a6a55" stroke-width="0.35"/>' + iris;

// --- Prothèses & blessures ---------------------------------------------------
/** Œil de verre (LDB 73) : sclère vitreuse, iris pâle, reflet FIXE — un regard mort. */
export const OEIL_DE_VERRE =
  '<g data-injury="oeil-de-verre"><ellipse rx="2.05" ry="1.3" fill="#eef2f4"/><ellipse rx="2.05" ry="1.3" fill="none" stroke="#8a98a4" stroke-width="0.35"/>'
  + '<circle r="1.05" fill="#9ab4c2"/><circle r="0.45" fill="#5a7484"/><circle cx="0.45" cy="-0.4" r="0.3" fill="#fff"/></g>';
/** Œil perdu (sans prothèse) : orbite recouverte de chair, paupière cousue balafrée. */
export const OEIL_PERDU =
  '<g data-injury="oeil-perdu"><ellipse rx="2.3" ry="1.6" fill="@peau"/>'
  + '<path d="M-1.7 0.1 Q0 0.9 1.7 0.1" stroke="@peauO" stroke-width="0.7" fill="none" stroke-linecap="round"/>'
  + '<path d="M-1.5 -1.8 L1.3 1.9 M1.2 -1.8 L-1.4 1.8" stroke="#8a4a3a" stroke-width="0.5" stroke-linecap="round"/></g>';
/** Cache-œil : coque de cuir bombée + UNE sangle fine filant vers les tempes. */
export const CACHE_OEIL =
  '<g data-injury="cache-oeil"><path d="M-6.6 -0.4 L-2.4 -1.1 M2.4 -1.1 L6.6 -1.9" stroke="#241a12" stroke-width="0.65"/>'
  + '<ellipse rx="2.5" ry="2.05" fill="#241a12" stroke="#0c0806" stroke-width="0.35"/>'
  + '<path d="M-1.5 -1.05 Q0 -1.75 1.5 -1.05" stroke="#4a3a2a" stroke-width="0.45" fill="none" opacity="0.85"/></g>';
/** Œil énorme (mutation LDB 19) : globe disproportionné qui ÉVINCE l'œil — veiné, injecté. */
export const OEIL_ENORME =
  '<g data-mut="oeil-enorme"><ellipse rx="3.1" ry="2.5" fill="#e0d8b0" stroke="#3a2820" stroke-width="0.55"/>'
  + '<path d="M-2.6 -1.2 q1 0.7 1.5 1.4 M-2.4 1.5 q0.9 -0.5 1.4 -1 M2.6 -1.4 q-0.9 0.8 -1.4 1.4 M2.5 1.4 q-1 -0.4 -1.5 -1" stroke="#b03a2e" stroke-width="0.3" fill="none" opacity="0.8"/>'
  + '<circle r="1.5" fill="#7a1010"/><circle r="0.7" fill="#0a0808"/><circle cx="0.5" cy="-0.55" r="0.32" fill="#fff" opacity="0.6"/>'
  + '<path d="M-3 -1.9 Q0 -3 3 -1.9" stroke="@peauO" stroke-width="0.7" fill="none"/></g>';

// --- Yeux d'animaux / de créature (mutations custom, races, éditeur) ---------
/** Œil de chat : iris vert, pupille en fente VERTICALE. */
export const OEIL_DE_CHAT = `<g data-eye-art="chat">${socle('<circle r="1.2" fill="#86a83e"/><ellipse rx="0.32" ry="1.05" fill="#140a06"/><circle cx="0.4" cy="-0.45" r="0.25" fill="#fff" opacity="0.8"/>')}</g>`;
/** Œil caprin : iris ambre, pupille en barre HORIZONTALE (chèvre/démon). */
export const OEIL_CAPRIN = `<g data-eye-art="caprin">${socle('<circle r="1.2" fill="#c8923a"/><rect x="-1" y="-0.38" width="2" height="0.76" rx="0.3" fill="#140a06"/>')}</g>`;
/** Œil reptilien : sclère jaune soufre, fente verticale. */
export const OEIL_REPTILIEN =
  '<g data-eye-art="reptilien"><ellipse rx="2.05" ry="1.3" fill="#d8c84a"/><ellipse rx="2.05" ry="1.3" fill="none" stroke="#7a6a2a" stroke-width="0.35"/>'
  + '<ellipse rx="0.34" ry="1.08" fill="#140a06"/></g>';
/** Œil entièrement noir (corruption, possession). */
export const OEIL_NOIR =
  '<g data-eye-art="noir"><ellipse rx="2.05" ry="1.3" fill="#0c0a10"/><circle cx="0.45" cy="-0.4" r="0.3" fill="#8a7ab0" opacity="0.8"/></g>';
/** Œil rougeoyant (démon, vampire). */
export const OEIL_ROUGE =
  '<g data-eye-art="rouge"><ellipse rx="2.05" ry="1.3" fill="#2a1010"/><circle r="1.05" fill="#c83a2a"/><circle r="0.45" fill="#ffb09a"/></g>';

/** Catalogue (clé stable → art + libellé FR) — pour l'éditeur et les defs de créatures. */
export const EYE_OPTIONS: Record<string, { label: string; art: string }> = {
  chat: { label: 'Œil de chat', art: OEIL_DE_CHAT },
  caprin: { label: 'Œil caprin', art: OEIL_CAPRIN },
  reptilien: { label: 'Œil reptilien', art: OEIL_REPTILIEN },
  noir: { label: 'Œil noir', art: OEIL_NOIR },
  rouge: { label: 'Œil rougeoyant', art: OEIL_ROUGE },
  verre: { label: 'Œil de verre', art: OEIL_DE_VERRE },
  enorme: { label: 'Œil énorme', art: OEIL_ENORME }, // difformité posable en apparence pure (sans le trait Mutation)
};

/** Remplace l'œil `side` du visage par `art` (centré sur l'ancre `data-ec` de l'orbite).
 *  Visage sans marqueur (têtes monstrueuses, races sans tête générée) → no-op. */
export function swapEye(visage: string, side: 'G' | 'D', art: string): string {
  const re = new RegExp(`<g data-eye="${side}" data-ec="(-?[\\d.]+) (-?[\\d.]+)">.*?</g>`);
  return visage.replace(re, (_m, x: string, y: string) =>
    `<g data-eye="${side}" data-ec="${x} ${y}" transform="translate(${x},${y})">${art}</g>`);
}

/** Applique les remplacements d'yeux demandés par l'apparence (G et/ou D). */
export function applyEyes(visage: string, eyes?: { G?: string; D?: string }): string {
  if (!eyes) return visage;
  let out = visage;
  if (eyes.G) out = swapEye(out, 'G', eyes.G);
  if (eyes.D) out = swapEye(out, 'D', eyes.D);
  return out;
}

/** CLÉS du catalogue (donnée éditeur) → ARTS, ou undefined si rien à remplacer. Utilisé par
 *  les tokens d'entité (les combattants passent par riggedAppearance qui résout au spawn). */
export function eyesArtFromKeys(eyes?: { G?: string; D?: string }): { G?: string; D?: string } | undefined {
  if (!eyes) return undefined;
  const G = eyes.G ? EYE_OPTIONS[eyes.G]?.art : undefined;
  const D = eyes.D ? EYE_OPTIONS[eyes.D]?.art : undefined;
  return G || D ? { ...(G ? { G } : {}), ...(D ? { D } : {}) } : undefined;
}
