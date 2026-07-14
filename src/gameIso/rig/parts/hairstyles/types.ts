/**
 * Art PAR-VUE d'une chevelure (coiffure du pool OU coiffure par défaut d'une tête) :
 * les 3 vues `{front, profile, back}` + composante ARRIÈRE optionnelle `behind` PAR vue,
 * peinte DERRIÈRE la part de visage (layer −2 — même sémantique que `RigOverlay.behind`) :
 * masse qui épouse le crâne de profil, chutes derrière la tête/les épaules de face.
 * PAS de repli front→profil pour `behind` : une masse arrière se dessine par vue, ou ne
 * s'affiche pas dans cette vue.
 */
export type HairArt = {
  front: string;
  profile: string;
  back: string;
  behind?: { front?: string; profile?: string; back?: string };
};

/**
 * Une COIFFURE = un fichier `defs/<nom>-<Sexe>.ts`. Pool PARTAGÉ par sexe (toutes espèces), art en
 * tokens @cheveux/@cheveuxO/@cheveuxH. Porte ses vues (cf. `HairArt`) : le profil/dos vit AVEC la
 * coiffure. `order` = position dans le pool (sélection seed-déterministe). Ajouter une coiffure =
 * déposer un fichier.
 */
export type HairstyleDef = { name: string; sex: 'M' | 'F'; order: number } & HairArt;
