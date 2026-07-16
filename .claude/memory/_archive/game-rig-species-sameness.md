---
name: game-rig-species-sameness
description: "Diagnostic confirmé — les créatures du rig se ressemblent (corps partagé, on ne varie que tête+couleur) ; le Gobelin est le modèle de qualité"
metadata: 
  node_type: memory
  type: project
  originSessionId: 98f84667-75bc-4711-b17b-0e666b4f7e03
---

Constaté par l'utilisateur EN JEU + vérifié à l'œil sur les rendus rig (PNG via `_qc-creatures-rig.mts`, 2026-06-08). Trois problèmes confirmés :

1. **Bipèdes samey sauf le Gobelin.** `skeletons.ts` `PROPS` VARIE bien les proportions par espèce (Nain `sl0.74 st1.25 legs0.62` = court trapu ; Ogre `st1.7` ; Troll `arms1.6`…) ET ça s'applique (le Nain est visiblement court). MAIS les races « humaines » (Nain, Elfe, Halfling, Humain, Cultiste, Mutant, **Guerrier du Chaos**) partagent **la même tête cosmétique humaine + la tenue Soldat par défaut** → lues « soldat humain » malgré les proportions. Le **Gobelin gagne** parce qu'il a une **tête monstrueuse dédiée** (`monster:{tete:'gobelin'}`, grandes oreilles) + `head1.3` + petit corps voûté → vraie silhouette. **LEÇON : la TÊTE/les traits distinctifs font la silhouette, pas le scaling du squelette seul.** Fix = donner aux races sous-différenciées des traits dédiés (Nain=barbe, Elfe=oreilles pointues+visage fin, Chaos=heaume cornu+armure sombre au lieu de la tenue Soldat, Mutant=mutations visibles).

2. **Ogre BUGGÉ.** `Ogre.ts` = `monster:{tete:'ogre',ventre:true}` + `career:'Nu'`. Rendu cassé : bras droit = grande dalle rectangulaire, bras gauche = moignon. Le combo `ventre`+`Nu`+`st1.7` casse les parts de membres. À déboguer (`parts/monstrous.ts` ventre + résolution des bras à grande épaisseur + tenue Nu).

3. **Quadrupèdes identiques.** `quadruped/composeQuad.ts` + `QUAD_SPECIES` : `girth` varie l'épaisseur mais **la LONGUEUR des pattes est ~fixe** (longues, type cheval) → Loup/Chien/Ours/Cheval = même corps frontal sur 4 pattes-échasses, seuls tête+couleur changent. Fix = longueur de pattes + forme de corps par espèce (loup/chien=pattes courtes pliées+corps horizontal ; ours=massif). NB : le **profil** est la bonne vue d'un quadrupède (mon QC les rendait de face = pire angle).

Prolonge [[game-bestiary-sprite-bar]] (silhouette d'abord), [[game-qc-reconnaissabilite]] (méthode), [[game-monolithic-sprites-vestigial]] (tout est au rig désormais). Outillage QC rig : `scripts/_qc-creatures-rig.mts` (front, à étendre profil/échelle).
