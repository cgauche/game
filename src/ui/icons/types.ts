/** Icône UI SVG maison (LOT 4 — remplace les emojis d'affordance). Charte : voir defs/action.ts. */
export interface IconDef {
  /** `famille/nom` en kebab-case (ex. `action/attack`, `ui/wait`). */
  id: string;
  /** Libellé FR (tooltip par défaut, galerie QC). */
  label: string;
  /** Contenu INTERNE d'un viewBox 0 0 24 24 — consomme `currentColor`, jamais de couleur en dur
   *  (accent `var(--gold)` toléré avec parcimonie). */
  svg: string;
}

/** Un fichier defs/ = une famille (plusieurs icônes du même domaine). */
export type IconFamily = IconDef[];

export type IconId = string;
