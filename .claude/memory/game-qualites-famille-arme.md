---
name: game-qualites-famille-arme
description: Qualités de famille d'arme en donnée (weaponGroups.qualities) mergées par resolveQualities — jamais de copie per-arme
metadata:
  type: project
---

Une FAMILLE d'arme (`WeaponGroupData`, id = le `subType` d'une arme) porte ses qualités COMMUNES en DONNÉE (`src/data/weaponGroups.json`, champ `qualities`) — ajouter/changer = éditer le JSON, **jamais le code**. Le moteur les MERGE avec les qualités propres de l'arme au point UNIQUE `resolveQualities` (`src/engine/qualities/dispatch.ts`) : union propre∪famille, la qualité **PROPRE l'emporte** (surcharge d'Indice / retrait). #757, 2026-07-22, commit `dc9a8bbb`.

**Migrées net-identique** (RAW confirmé au Source) : `escrime`→{rapide,empaleuse}, `fleau`→{perturbante,a-enroulement}, `parade`→{defensive}. Les copies per-arme ont été retirées de `trappings.json`. Tout AFFICHAGE de qualités doit passer par `resolveQualities` (sinon la famille manque) — sites déjà routés (`equipCompare`, `interludeFlow`, compendium, MerchantPanel…).

**⚠ GOTCHA (bug réel attrapé par juge adversarial, PAS par la suite)** : les profils transitoires qui RETIRENT des Atouts (arme improvisée / fléau-sans-spé / groupe dégradé dans `weaponDamage.ts` ; « Retenir ses coups » dans `combat.ts`) doivent poser le drapeau **`noFamilyQualities: true`** — JAMAIS effacer `subType`/`weaponGroup`. Raison : `combatValue` (`combat.ts:198`) lit `subType` pour la compétence de Groupe ; l'effacer fait tomber l'arme dans le repli « meilleure Spé disponible » → +avances indues sur un Groupe non maîtrisé (contra LDB 62 l.139), et casse `talentDamageBonus` (Bagarre). Voir [[game-weapon-model-buildWeapon]], [[game-weapon-handling-axis]].

**Suites ouvertes** : **#756** factorise les facteurs de famille RAW **NON** net-identiques (poudre-noire/ingénierie→{a-poudre-noire,devastatrice} LDB l.99 ; armes-de-siege→{devastatrice,percutante} ADE2 l.233) — c'est un FIX de fidélité (données partielles), pas une factorisation ; **bloqué par #754** (munitions `harpon`/`balle-crache-plomb`/`boulet-crache-plomb` mal rangées sous des subTypes d'ARMES → recevraient à tort les qualités de famille). **#755** Indice du `filet` gobelin manquant (ZI l.165 « Filet 3 »).
