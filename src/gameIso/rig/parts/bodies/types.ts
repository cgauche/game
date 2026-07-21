import type { ViewSet } from '../types';

/**
 * Un CORPS de base (chair nue @peau) = un fichier `defs/<id>.ts`. Sert à COMPOSER les tenues de
 * monstres : une tenue de carrière remplace les slots du « Nu », son art inclut donc la chair sous
 * l'équipement (pagne du Sanguinaire, corset de la Démonette…). Silhouettes alignées sur `resolve.ts`
 * (mode 'peau') et `tenues/defs/Nu.ts`. Ajouter un corps de base = déposer un fichier.
 */
export interface BodyDef {
  id: string;           // 'nu'…
  label: string;        // libellé FR
  torseFront: string;   // torse nu de face
  torseBack: string;    // torse nu de dos (colonne marquée) — MÊME contour que le front
  torseProfile: string; // torse nu de profil (poitrine avancée +x)
  /** Jambe nue, 3 vues DÉDIÉES (repère os `cuisse` : 0 = hanche, genou 22..30, 50 = cheville —
   *  `rig/SKELETON-CONTRACT.md`). front/back partagent leur contour ; le profil a le sien. */
  jambe: ViewSet;
}
