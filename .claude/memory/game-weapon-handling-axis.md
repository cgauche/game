---
name: game-weapon-handling-axis
description: "L'animation d'arme est clé sur la FORME (handlingClass), pas le Groupe de règles ; weaponRest toujours-actif + prise 2-mains en port diagonal ; attaques de face limitées par le 2D."
metadata: 
  node_type: memory
  type: project
  originSessionId: 6a091869-bf82-4c57-9848-2d25a75eaedb
---

L'axe d'ANIMATION des armes (port/idle, attaque, parade) = `handlingClass(w)` dans `src/gameIso/rig/anim/handling.ts`, dérivé de la FORME (silhouette) via `formSlug`, **PAS** du Groupe canonique WFRP (`weaponGroupKey`). Raison : le Groupe (subType « Base »…) conflate des armes maniées différemment (1-main/2-mains, lame/hampe/arc). 15 classes : lame1m, escrime, lourde2m, hampe, lance_cav, fleau, parade, poings, arc, arbalete, arme_feu, fronde, jet, entraves, explosif.

`weaponClips.ts` : `weaponRest(w)` = pose de base **TOUJOURS** appliquée (orientation de l'os `arme` + prise 1/2 mains), sous laquelle jouent les clips (deltas). Câblé dans RigToken (`addPose(weaponRest, pose)`) — remplace l'ancien `carryPose` gaté profil+combat. `carryPose` survit comme alias de compat.

**Prise 2-mains** (lourde2m/hampe/arc/arbalete/arme_feu) : le rig 2D (cf. [[game-rig-2d-paper-doll]]) ne peut PAS centrer l'arme (ancrée à la main droite, le bras tourne dans le plan) → la prise se lit via un **PORT DIAGONAL** travers-du-corps (main gauche amenée sur la hampe). Validé front+profil.

**Os `arme` relatif à la main** : pendant une attaque la rotation du bras s'AJOUTE à l'angle `arme` → un delta `arme` naïf est faux ; les apex d'estoc/chop demandent de GROS deltas (~+115) pour pointer vers la cible. Tuner à l'œil (render PNG, `_qc-maniement.mts`).

**Limite 2D** : une attaque vers l'AVANT en vue de FACE ne montre pas la profondeur → se lit comme un penchant latéral / arme pointée bas. Inhérent, pas un bug ; les attaques se jugent en PROFIL et **animées** (pas en frame figée). Piège QC : un juge aveugle sur une planche idle+attaque mélangées crie « upside_down » en regardant l'attaque alors que l'idle est correct — vérifier soi-même (cf. [[game-qc-reconnaissabilite]]).
