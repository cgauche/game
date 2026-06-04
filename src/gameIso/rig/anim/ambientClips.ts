/**
 * Clips d'AMBIANCE (brin I) — animations en boucle, hors combat, pilotables depuis
 * l'éditeur de scène (champ `anim` d'une entité). Servent à donner vie à une scène
 * (ex. arrivée sur une ambuscade : un mutant accroupi qui dévore un cadavre).
 *
 * Conventions d'angles (deg) : cuisse > 0 plie la jambe en avant, tibia < 0 plie le
 * genou (accroupi/agenouillé) ; torse/tete > 0 penche en avant/bas ; epaule < 0 lève
 * les bras, > 0 les descend vers l'avant/le sol.
 */
import type { Clip } from './clips';

/** Animation phare : mutant accroupi qui dépèce/dévore un cadavre au sol. */
const feeding: Clip = {
  loop: true,
  steps: [
    // penché bas, mains au sol sur la proie, jambes repliées (accroupi)
    { pose: { torse: 34, tete: 32, bassin: 12, epauleD: 64, avantBrasD: 50, epauleG: 52, avantBrasG: 42, cuisseG: 40, cuisseD: 40, tibiaG: -32, tibiaD: -32 }, ms: 520, easing: 'easeInOut' },
    // relève la tête en arrachant un morceau, bras qui tirent
    { pose: { torse: 28, tete: 14, bassin: 12, epauleD: 54, avantBrasD: 34, epauleG: 44, avantBrasG: 30, cuisseG: 40, cuisseD: 40, tibiaG: -32, tibiaD: -32 }, ms: 360, easing: 'easeOut' },
    // se repenche vers la proie
    { pose: { torse: 34, tete: 30, bassin: 12, epauleD: 62, avantBrasD: 48, epauleG: 50, avantBrasG: 40, cuisseG: 40, cuisseD: 40, tibiaG: -32, tibiaD: -32 }, ms: 420, easing: 'easeInOut' },
  ],
};

/** Agenouillé en prière, tête baissée, mains jointes. */
const praying: Clip = {
  loop: true,
  steps: [
    { pose: { torse: 16, tete: 24, epauleG: -26, epauleD: -26, avantBrasG: -36, avantBrasD: -36, cuisseG: 42, tibiaG: -74, cuisseD: 8 }, ms: 1700, easing: 'easeInOut' },
    { pose: { torse: 18, tete: 28, epauleG: -26, epauleD: -26, avantBrasG: -36, avantBrasD: -36, cuisseG: 42, tibiaG: -74, cuisseD: 8 }, ms: 1700, easing: 'easeInOut' },
  ],
};

/** Recroquevillé de terreur, bras au-dessus de la tête, léger tremblement. */
const cowering: Clip = {
  loop: true,
  steps: [
    { pose: { torse: 26, tete: 18, bassin: 8, epauleG: -78, epauleD: -78, avantBrasG: -46, avantBrasD: -46, cuisseG: 30, cuisseD: 30, tibiaG: -24, tibiaD: -24 }, ms: 400, easing: 'easeInOut' },
    { pose: { torse: 28, tete: 20, bassin: 8, epauleG: -82, epauleD: -74, avantBrasG: -48, avantBrasD: -44, cuisseG: 30, cuisseD: 30, tibiaG: -24, tibiaD: -24 }, ms: 400, easing: 'easeInOut' },
  ],
};

/** Assis au sol, jambes repliées devant. */
const sitting: Clip = {
  loop: true,
  steps: [
    { pose: { bassin: 6, torse: 6, cuisseG: 80, cuisseD: 80, tibiaG: -72, tibiaD: -72, epauleG: 10, epauleD: 10 }, ms: 1900, easing: 'easeInOut' },
    { pose: { bassin: 6, torse: 9, cuisseG: 80, cuisseD: 80, tibiaG: -72, tibiaD: -72, epauleG: 12, epauleD: 12 }, ms: 1900, easing: 'easeInOut' },
  ],
};

/** Respiration subtile debout (idem idle de combat). */
const standing: Clip = {
  loop: true,
  steps: [
    { pose: { torse: 1.5, tete: 1 }, ms: 1500, easing: 'easeInOut' },
    { pose: {}, ms: 1500, easing: 'easeInOut' },
  ],
};

export const AMBIENT_CLIPS: Record<string, Clip> = { feeding, praying, cowering, sitting, standing };

/** Liste pour l'éditeur (clé + libellé FR). */
export const AMBIENT_LIST: { key: string; label: string }[] = [
  { key: 'standing', label: 'Debout (respire)' },
  { key: 'feeding', label: 'Dévore un cadavre' },
  { key: 'praying', label: 'En prière (agenouillé)' },
  { key: 'cowering', label: 'Terrorisé (recroquevillé)' },
  { key: 'sitting', label: 'Assis au sol' },
];

export function ambientClip(key?: string | null): Clip | null {
  return key ? AMBIENT_CLIPS[key] ?? null : null;
}
