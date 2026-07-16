---
name: game-goal-sprites-anims-complets
description: "Goal projet (fixé 2026-06-05) — finir la refacto sprites+animations, jusqu'aux monstres, armes et sorts."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b5e1576-6e66-4371-b038-61f34984d882
---

**Goal (2026-06-05) : « finir la refacto des sprites et des animations ».** Critères donnés par l'utilisateur :
- Le **facing 8 directions** doit aussi s'appliquer aux **monstres** (pas que les héros riggés).
- Pour les **humanoïdes**, l'**arme équipée doit s'afficher** (portée + en main).
- Les **animations diffèrent selon l'arme** : aussi bien la pose **portée** que les gestes **d'attaque/parade**.
- Idem pour **sorts / bénédictions / miracles** : animations distinctes selon le type.
- Philosophie : *les animations rendent le monde réel — elles confirment que l'action est prise en compte et montrent comment l'environnement répond* (feedback).
- **Les animations ne se limitent PAS au combat** : elles doivent s'intégrer à l'**éditeur de niveau** comme **poses/clips d'ambiance** (ex. arrivée sur une ambuscade dans `ambuscade.html`). Exemple phare demandé : **un mutant qui mange un cadavre** (clip ambiant en boucle + prop cadavre, plaçable depuis l'éditeur).

**How to apply :** décomposer en sous-projets (suite de A=apparence, C=anim de combat, E=facing héros) :
F monstres 8-dir, G anims par-arme (port + attaque/parade), H anims par-sort, + vérifier l'affichage de l'arme. Utiliser des **workflows** pour l'art/données (l'utilisateur y invite explicitement). Voir [[game-existant-poc-refactor-libre]], [[game-visual-direction]], [[game-bestiary-sprite-bar]].

**État au 2026-06-05 (run de nuit autonome, branche feat/wfrp4-rpg-foundation) — 5 brins LIVRÉS, testés, commités :**
- **F1** (9c78cef) : ennemis humanoïdes via le rig (`enemyProfile.ts` classifyEnemy/enemyRigProfile, calques de mutation, arme+armure visibles, 8-dir). RigSprite a une prop `overlays`.
- **G** (50ab4a7) : anims **par GROUPE d'arme canonique** (`weaponGroup.ts` = trappings.subType, PAS de parsing de libellé — feedback utilisateur clé) ; `weaponClips.ts` (carry/attaque/parade) ; `weaponFamily` (art) = table EXPLICITE par libellé.
- **F2** (7c86b4d) : facing 8-dir des 47 créatures non-humanoïdes (`creatureViews.json` généré par workflow best-of-2, `creatureView()`, `token(mirror)` + map `creatureFacing`).
- **H** (15f1502) : incantation offensive (bolt+projectile) vs bénédiction/miracle (bras levés + halo, pas de projectile) — dérivé de la relation lanceur↔cible (l'event ANIM_ATTACK ne porte PAS le libellé du sort). `classifySpellByLabel` (data-driven) prêt pour tintage futur si on ajoute `spell` à l'event store.
- **I** (b7a6b9d) : animations d'ambiance pilotables depuis l'éditeur (`ambientClips.ts`, `AmbientRigToken`, `entityRigProfile`, champ `SceneEntity.anim`) — démo phare **mutant qui dévore un cadavre** (prop « cadavre » déjà au catalogue).

**Reste / suite :** **E·7** (back/profile des parts héros) — workflow têtes lancé en STAGING (`art-ref/directional/hero/heads/`, gitignoré) à **QC + ingérer** ; tenues/armes back/profile non faits (le repli front marche). Galeries QC pour relecture matin : `public/rig-gallery.html`, `public/anim-gallery.html`, `public/bestiary-views.html`. **Contrainte run :** 2e session Claude en parallèle (combat/Avantage) → commits par chemins explicites, pas de Playwright, ne pas toucher engine/store/combat. **Note dette :** ajouter `spell: label` à l'emit ANIM_ATTACK de `store.castSpell` débloquerait le tintage arcane/divin (H).
