# Rechargement & munitions (équipement)

- **Date** : 2026-06-05
- **Jalon** : 1 (profondeur du combat) — « compléter le combat » ex‑B.
- **Statut** : design validé (choix de munition = par le joueur), en attente de relecture spec.
- **Principe** : rien d'inventé, tout sourcé. Source : `62 - Les armes.md` (qualités d'arme) + **`63 - Armures.md` l.28-29** (le défaut *Recharge (Indice)*, mis-split hors du chap. 62) + **`12 - Tests.md` l.197-211** (Tests étendus) + `src/data/trappings.json` (armes/munitions).

## Constats (code + données)

- **Rechargement = défaut d'arme « Recharge (Indice) » = Test ÉTENDU de Projectiles** (corrigé 2026-06-05) : `63 - Armures.md` l.28-29 — « Une arme déchargée … nécessite un **Test étendu de Projectiles** approprié au Groupe d'armes … et nécessite d'obtenir _Indice_ DR pour être rechargée. Si vous êtes interrompu …, vous devez recommencer à zéro. » Combiné aux Tests étendus (`12 - Tests.md` l.199-211 : on cumule les DR par Round jusqu'à la cible ; **si le total passe sous 0 → recommencer** ; DR 0 = aucune incidence). Donc l'**Indice** (`Tromblon`/`Arbalète lourde` = 2, `Arbalète` = 1) est le **nombre de DR à cumuler**, PAS un nombre d'Actions. L'Arc n'a pas le défaut → toujours chargé. **Recharger est un JET → donc une MODALE** (invariante projet « si y'a un jet, y'a la modale »).
- **Munitions = équipement** (`type: 'ammunition'` → `ItemKind 'ammo'`, déjà géré par `kindOf`/`itemFromTrapping`) : `Carreau` (prefix `(12)`, `subType: 'Arbalète'`, `qualities: ['Empaleuse']`), `Flèche` (prefix `(12)`, `subType: 'Arc'`, `qualities: ['Empaleuse']`). Le préfixe `(N)` = taille du paquet.
- **La munition modifie le tir** (confirmé) : Carreau/Flèche apportent **Empaleuse** ; une munition peut aussi porter un modificateur de Dégâts. Le tir combine **arme + munition**.
- `ItemInstance` n'a ni `subType` ni quantité ; `Weapon` (active, dérivée par `recomputeLoadout`) n'a ni `subType` ni `reload`.

## Décisions de design

| Sujet | Décision |
|---|---|
| Munition | `ItemInstance` (`kind 'ammo'`) avec **`subType`** (Arc/Arbalète/Poudre noire) + **`qty`** (paquet) |
| Compatibilité | munition compatible = `kind 'ammo'` && `subType === weapon.subType` && `qty > 0` |
| Tir | consomme **1** munition (`qty−1`, item retiré à 0) ; **pas de munition compatible → tir impossible** |
| Combinaison | Dégâts du tir = `${weapon.damage}${ammo.damage ?? ''}` (concaténation — `parseWeaponDamage` somme déjà les nombres) ; Atouts = `weapon.qualities ∪ ammo.qualities` |
| Choix de munition | **par le joueur** : sous‑liste hotbar (compatibles, qty) → sélectionne `ammoUid` ; défaut = 1re compatible |
| Rechargement | défaut **« Recharge N »** = N **DR** à cumuler par un **Test étendu de Projectiles** (CT) ; **Arc** (sans Recharge) toujours chargé ; après un tir, déchargé si `reload>0` |
| État | `Combatant.ammoUid?`, `loaded?`, `reloadProgress?` (= **DR cumulés**, pas un compteur d'actions) ; au début du combat, les armes à distance démarrent **chargées** |
| Action Recharger | `battleReload` **ouvre une modale** (`pendingReload`) → **un Test de Projectiles** par Action (Lancer→DR→Chance→Appliquer) ; `reloadProgress = max(0, progressBefore + DR)` ; à `≥ reload` → `loaded=true, reloadProgress=0` ; valeur = `combatValue(active,'ranged')`, Difficulté **Intermédiaire (+0)** (canon silencieux → défaut) |
| IA | ennemis **abstraits** : tirent librement chaque Round (pas de munitions ni de rechargement) — décision de périmètre affinée (héros uniquement), zéro régression sur le tir ennemi |
| Tir interdit Engagé | inchangé (Atout Pistolet, déjà géré par `attackWeapon`/`canFireWhileEngaged`) |

## Architecture

### A. Types — `src/engine/types.ts`
- `ItemInstance` : `subType?: string` ; `qty?: number`.
- `Weapon` : `subType?: string` ; `reload?: number` (0 = pas de rechargement).
- `Combatant` : `ammoUid?: string` (munition sélectionnée) ; `loaded?: boolean` ; `reloadProgress?: number`.

### B. Données / `items.ts`
- `itemFromTrapping` : pour une munition, lire le **préfixe `(N)`** du trapping → `qty` ; porter `subType` (depuis `t.subType`). Pour une arme, porter `subType`.
- `recomputeLoadout` : dériver `Weapon.subType` (depuis l'item) et `Weapon.reload` (depuis la qualité « Recharge N », sinon 0). Au (re)calcul, initialiser `loaded` pour l'arme à distance active (chargée si `reload === 0` ou non encore définie → chargée au départ).
- Helper pur **`weaponWithAmmo(weapon, ammo)`** → `Weapon` augmenté (Dégâts concaténés, qualités fusionnées). `compatibleAmmo(items, weapon)` → liste des munitions compatibles (`qty>0`).

### C. Moteur — `src/engine/combat.ts`
- `resolveRanged` inchangé dans sa logique ; on lui passe le **weapon augmenté** (`weaponWithAmmo`). La combinaison se centralise dans un helper store `firedWeapon(attacker, target)` utilisé par `resolveAttack`, `attackBonusSL` (re-dérive) et `attackConfirm` — sinon l'arme tirée ≠ `weapons[0]` casserait la consommation et l'Empaleuse (bug latent corrigé).
- `rollTest`/DR (`src/engine/tests.ts`) réutilisé tel quel pour le jet de rechargement.

### D. Store — `src/state/store.ts`
- `startCombat` : pour chaque combattant, initialiser `loaded` (arme à distance active : chargée), `reloadProgress=0`, `ammoUid` (1re munition compatible).
- **Sélection** : `battleSelectAmmo(uid)` (mode `action 'ammo'` ou direct) — pose `active.ammoUid`.
- **Tir** (`firedWeapon` / `battleClickEntity` ranged) : exiger `loaded` ; trouver la munition (`ammoUid` ou 1re compatible) ; si aucune → log « plus de munitions », abandon. Combiner via `weaponWithAmmo`. À l'application (`applyAttackResult`, héros + arme à distance) : `qty−1` (retirer à 0), `loaded=false` si `reload>0`, `reloadProgress=0` ; persister sur le clone battle (party = gap Jalon 5).
- **Recharger = MODALE** : `battleReload` (gaté : héros, `!acted && canTakeAction`, arme à distance non chargée `reload>0`) **ouvre `pendingReload`** (n'engage pas encore l'Action). `reloadRoll` fait le **Test de Projectiles** (`combatValue(active,'ranged')`, Intermédiaire) → DR ; `reloadReroll`/`reloadBonusSL` = Chance (comme l'attaque) ; `reloadConfirm` cumule `reloadProgress = max(0, progressBefore + DR)`, si `≥ reload` → `loaded=true, reloadProgress=0`, et **consomme l'Action** (`acted=true`) ; `reloadCancel` ferme sans coût (avant le jet).
- **Interruption** : un héros touché en cours de rechargement (`reloadProgress>0`, perte de Blessure) repart de zéro (`reloadProgress=0`, l.29 du défaut).
- **IA / ennemis** : abstraits — tirent librement (aucune modale, aucun gate munition/recharge).

### E. UI — `src/ui/ActionBar.tsx` + `src/ui/ReloadModal.tsx`
- Slot **« 🔄 Recharger »** (gaté : arme à distance active, non chargée, `reload>0`) → `battleReload` (ouvre la modale) ; affiche la progression (`reloadProgress/reload DR`).
- **`ReloadModal`** (nouveau, calqué sur `RollModal`/`TestModal`) montée dans `CampaignView` : Lancer→DR (✓/✗ + `progress/reload`)→Chance→Appliquer.
- Sous‑liste **munitions** (mode `'ammo'`) : munitions compatibles (nom + `×qty`), sélection → `battleSelectAmmo` ; munition courante mise en évidence.

## Tests (TDD)
- `items` : `itemFromTrapping('Flèche')` → `kind 'ammo'`, `subType 'Arc'`, `qty 12` ; `weaponWithAmmo(arc, flèche)` → qualités incluent Empaleuse, Dégâts combinés ; `compatibleAmmo`.
- `recomputeLoadout` : `Weapon.reload` dérivé de « Recharge 2 » (Tromblon) = 2 ; Arc → 0.
- store : tirer consomme 1 munition (`qty−1`) ; sans munition compatible → tir refusé ; arme `reload>0` → déchargée après tir (`loaded=false`) ; `battleReload` ouvre `pendingReload` (Action non encore consommée) ; après `reloadRoll`+`reloadConfirm`, `reloadProgress` cumule le DR et `loaded` passe vrai dès `reloadProgress ≥ reload` ; `battleSelectAmmo` change la munition utilisée ; un Arc (reload 0) tire chaque Round sans recharger.

## Hors périmètre
- Récupération de munitions (fronde/armes de jet), achat (Jalon 5 entre aventures).
- Données de **munitions spéciales** (au‑delà de Carreau/Flèche/poudre du LDB) — le moteur les supportera, mais on n'invente pas d'entrées.
- Détérioration/Dangereuse (Tromblon « Dangereuse ») hors périmètre de ce lot.

## Fichiers touchés (prévision)
- `src/engine/types.ts` (ItemInstance/Weapon/Combatant)
- `src/engine/items.ts` (parse subType/qty/reload, `weaponWithAmmo`, `compatibleAmmo`) + tests
- `src/state/store.ts` (init combat, tir, `battleReload`, `battleSelectAmmo`, IA) + tests
- `src/ui/ActionBar.tsx` (slots Recharger + sous‑liste munitions)
- `ROADMAP.md`
