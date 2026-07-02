/**
 * PALETTE DE MATÉRIAUX DU DÉCOR — la SEULE source de couleur des 97 defs `catalog/decor/defs/`.
 * Chaque `render()` de prop consomme des TONS NOMMÉS (`P.boisMoyen`, `P.fer`, `P.chaume`…) au lieu de
 * littéraux hex : plus aucun `#hex` dans une def (garde-fou `renderer-no-hardcoded-color.test.ts`).
 * Les tons sont regroupés par famille matériau (bois / terre / or / sang / pierre / os / feuillage /
 * azur / arcane / pourpre / patine / ombre / blanc, + le groupe sémantique `villageois*` pour le PNJ
 * d'ambiance ; le bloc de mur en torchis réutilise la famille bois : boisClair10/boisMoyen25/boisFonce52)
 * et échelle de ton (…Sombre/Fonce/Moyen/Clair…) ;
 * les couleurs strictement identiques ou à ±2/canal sont FUSIONNÉES sur un même ton (extraction, PAS
 * refonte artistique — le décor reste visuellement identique). La donnée vit dans `src/data/decorPalette.json`.
 */
import raw from '../../data/decorPalette.json';

export type DecorTone = keyof typeof raw;
/** Tons de matériau du décor, indexés par nom (`P.boisMoyen`). */
export const P: Record<DecorTone, string> = raw;
