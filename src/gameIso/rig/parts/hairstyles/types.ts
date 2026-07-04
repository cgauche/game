/**
 * Une COIFFURE = un fichier `defs/<nom>-<Sexe>.ts`. Pool PARTAGÉ par sexe (toutes espèces), art en
 * tokens @cheveux/@cheveuxO/@cheveuxH. Porte ses 3 vues `{front, profile, back}` → plus de
 * name-matcher (`hairArchetype`) : le profil/dos vit AVEC la coiffure. `order` = position dans le
 * pool (sélection seed-déterministe). Ajouter une coiffure = déposer un fichier.
 */
export type HairstyleDef = { name: string; sex: 'M' | 'F'; order: number; front: string; profile: string; back: string };
