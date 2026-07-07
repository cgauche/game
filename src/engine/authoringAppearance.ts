/**
 * Types d'APPARENCE d'authoring (sélections cosmétiques) — couche NEUTRE partagée : l'éditeur/scène
 * (`state`) les AUTHORE, le Combattant (`engine`, `Combatant.appearanceOverride`) les PORTE bruts, le
 * rig (`gameIso`) les RÉSOUT au rendu. Vivent ici (moteur) pour qu'aucun consommateur n'inverse les
 * couches (#187 : `Combatant` n'a plus à référencer `state/scene` pour son override d'apparence).
 * Structurels purs (aucune valeur SVG/rendu) : les arts résolus vivent dans `gameIso/rig`.
 */

/** Parts monstrueuses par slot (mutant modulaire : tête/bras choisis comme un PJ).
 *  Type structurel (pas d'import rendu) ; les valeurs valides sont offertes par l'éditeur. */
export interface MonsterPartsSel {
  tete?: string;       // 'chien' | 'lezard' | 'ogive' | 'minuscule' | …
  brasG?: string;      // 'tentacule' | 'griffe' | …
  brasD?: string;
  jambes?: string;     // 'chevre' | …
  cornes?: boolean;
  queue?: boolean;
  ailes?: boolean;     // ailes emplumées repliées dans le dos (harpie, démon ailé)
}

/** Personnalisation couleur (emplacements sémantiques ; résolus par le rig). */
export interface ColorsSel {
  peau?: string;
  cheveux?: string;
  yeux?: string; // iris
  vet1?: string; // vêtement principal
  vet2?: string; // vêtement secondaire
  cuir?: string;
  metal?: string;
  corps?: string; // pelage/robe des créatures (gabarits non-humains)
  accent?: string; // détail vif (crête, marque)
}

/** Override d'apparence (sinon seed dérivé de l'id). */
export interface EntityAppearance {
  seed?: number;
  /** Mutant modulaire : parts monstrueuses (rendu via le rig). */
  monster?: MonsterPartsSel;
  /** Personnalisation couleur (peau/cheveux/vêtements). */
  colors?: ColorsSel;
  /** Coiffure / visage épinglés (rig) : slot → index. */
  parts?: { cheveux?: number; visage?: number };
  /** Surcharges cosmétiques (sinon dérivées du seed). */
  sex?: 'M' | 'F';
  build?: number;
  /** Espèce/race CHOISIE — découple l'apparence du nom (label/ref) : 'Nains', 'Halflings',
   *  'Elfes'… (canonicalisée par `baseSpeciesOf`). Vide = dérivée du nom. */
  species?: string;
  /** Tenue CHOISIE — découple l'habit du nom : un PNJ peut porter n'importe
   *  quelle tenue (Mendiant, Soldat, Skaven, Nu…). Vide = dérivée du nom/espèce. */
  tenue?: string;
  /** Yeux personnalisés (clés du catalogue `EYE_OPTIONS` : chat/caprin/reptilien/noir/rouge/
   *  verre) — remplacés EN PLACE sur l'orbite du visage. Vide = yeux normaux. */
  eyes?: { G?: string; D?: string };
  /** Traits de corps ADDITIFS — clés du catalogue d'éléments (`parts/elements.ts` : queue, cornes,
   *  oreilles-pointues, crocs, écailles…). N'importe quel PNJ peut en porter (perso. réutilisable). */
  features?: string[];
}
