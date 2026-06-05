# Rechargement & munitions (équipement)

- **Date** : 2026-06-05
- **Jalon** : 1 (profondeur du combat) — « compléter le combat » ex‑B.
- **Statut** : design validé (choix de munition = par le joueur), en attente de relecture spec.
- **Principe** : rien d'inventé, tout sourcé. Source : `Source/Warhammer v4 - Livre de base version corrigée/62 - Les armes.md` (qualités d'arme) + `src/data/trappings.json` (armes/munitions).

## Constats (code + données)

- **Rechargement = qualité d'arme** : ex. `Tromblon` a `"Recharge 2"` dans `qualities`. L'Arc n'a pas de « Recharge » → tire chaque Round. Le rating est le nombre d'**Actions** pour recharger.
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
| Rechargement | qualité **« Recharge N »** = N Actions ; **Arc** (sans Recharge) toujours chargé ; après un tir, déchargé si `reload>0` |
| État | `Combatant.ammoUid?`, `loaded?`, `reloadProgress?` ; au début du combat, les armes à distance démarrent **chargées** |
| Action Recharger | `battleReload` : consomme l'Action, `reloadProgress++` ; à `reload` atteint → `loaded=true` |
| IA | un ennemi à arme à distance **recharge** quand déchargé (sinon ne peut tirer) — simplifié |
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
- `resolveRanged` inchangé dans sa logique ; on lui passe le **weapon augmenté** (`weaponWithAmmo`). (La combinaison se fait en amont, côté store, qui connaît l'inventaire et la munition choisie.)

### D. Store — `src/state/store.ts`
- `startCombat` : pour chaque combattant, initialiser `loaded` (arme à distance active : chargée), `ammoUid` (1re munition compatible).
- **Sélection** : `battleSelectAmmo(uid)` (mode `action 'ammo'` ou direct) — pose `active.ammoUid`.
- **Tir** (`resolveAttack` / `battleClickEntity` ranged) : exiger `loaded` ; trouver la munition (`ammoUid` ou 1re compatible) ; si aucune → log « plus de munitions », abandon. Combiner via `weaponWithAmmo`. À l'application : `qty−1` (retirer à 0), `loaded=false` si `reload>0`, `reloadProgress=0` ; persister la munition consommée (clone battle ; party = gap Jalon 5, cohérent avec l'existant).
- **Recharger** (`battleReload`) : `!acted && canTakeAction` ; `reloadProgress++` ; si `≥ reload` → `loaded=true, reloadProgress=0` ; `acted=true`.
- **IA** : si l'ennemi a une arme à distance déchargée et veut tirer → recharge (consomme le tour) ; sinon tire. (Extension minimale de `runEnemyAI`.)

### E. UI — `src/ui/ActionBar.tsx`
- Slot **« 🔄 Recharger »** (gaté : arme à distance active, non chargée, `reload>0`) → `battleReload` ; affiche la progression (`reloadProgress/reload`).
- Sous‑liste **munitions** (mode `'ammo'`) : munitions compatibles (nom + `×qty`), sélection → `battleSelectAmmo` ; munition courante mise en évidence.
- Indicateur **chargé/déchargé** + munition sélectionnée près du combattant actif.

## Tests (TDD)
- `items` : `itemFromTrapping('Flèche')` → `kind 'ammo'`, `subType 'Arc'`, `qty 12` ; `weaponWithAmmo(arc, flèche)` → qualités incluent Empaleuse, Dégâts combinés ; `compatibleAmmo`.
- `recomputeLoadout` : `Weapon.reload` dérivé de « Recharge 2 » (Tromblon) = 2 ; Arc → 0.
- store : tirer consomme 1 munition (`qty−1`) ; sans munition compatible → tir refusé ; arme `reload>0` → déchargée après tir, `battleReload` la recharge en N Actions ; `battleSelectAmmo` change la munition utilisée (Atouts du tir varient) ; un Arc (reload 0) tire chaque Round sans recharger.

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
