---
name: game-weapon-model-buildweapon
description: "buildWeapon = constructeur d'arme UNIQUE (6 sites) ; Weapon=Dégâts / Manœuvre=États ; grantNaturalWeapon reste une arme, pas une manœuvre"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac3fb303-33fb-4bd5-999a-5b57154f44c2
---

Fondation « modèle d'arme » posée — commits `402ab6a` (buildWeapon) + `63a29ab` (rename ops), sur `42ca4a8` (convergence onHit). Plan : `scalable-shimmying-floyd.md`.

**Une SEULE construction d'arme** : `engine/items.buildWeapon(spec): Weapon` (+ `weaponItem` wrapper ItemInstance qui RÉUTILISE buildWeapon). 6 sites y passent : `grantNaturalWeapon`, `grantWeapon` (ex-conjure), Tentacule, Mains nues (items.ts), `weaponFromTrait` (spawn.ts), `freeAttackWeapon`/`TRAMPLE_WEAPON` (combatFlow.ts). `itemFromTrapping` reste À PART (lecteur de catalogue, ≠ synthétiseur). NE PAS re-déclarer une forme `Weapon`/`ItemInstance` ailleurs → buildWeapon.

**Convention de Dégâts = `damageString` (source UNIQUE)** : le token `BF` est PORTEUR (`effectiveWeaponDamage` teste `/BF/i` pour ajouter le Bonus de Force). Spec `WeaponDamageSpec` = union `{literal}` | `{plusBF, flat, bare?}` → `+BF+N` (SB-relatif) / `+N` (Indice créature, SB déjà inclus) / `+BF` nu (Tentacule/Piétinement, flag `bare`) / `-N` (Indice négatif) / literal (catalogue). La résolution `Formula`→`flat` reste AU SITE D'APPEL (buildWeapon pur/synchrone).

**Séparation fondatrice (à garder)** : `Weapon` = porteur de Dégâts UNIVERSEL (pipeline d'arme : jet/localisation/armure/critiques) ; **Manœuvre** (`maneuvers.json`) = geste activé + États onHit + géométrie de zone, **JAMAIS de Dégâts** (les manœuvres de base `arme`/`morsure`/`cornes` ont `effects:[]` ; les Dégâts viennent toujours d'une Weapon — `weaponFromTrait`/`freeAttackWeapon`). Donc `grantNaturalWeapon` (Griffe `+BF+4` Magique) est une ARME, PAS une manœuvre : le « fold grantNaturalWeapon→grantManeuver » du plan a été ÉCARTÉ (ManeuverDef ne porte ni damage ni qualities). NE PAS y revenir.

**Vocabulaire ops** : `grantWeapon` (arme dans set dédié) · `grantNaturalWeapon` (attaque additionnelle) · `augmentWeapon` (enchante l'arme TENUE, ne construit pas). Champs INTERNES gardés (impl, hors vocabulaire éditable au Codex) : `ActiveEffect.conjuredSet`/`weaponEnchant`, module `conjuredWeapons.ts`, fichier `conjure-weapon.test.ts`.

Prolonge [[game-maneuver-capability-unification-parallel]] et [[feedback-reutiliser-avant-reinventer]].
