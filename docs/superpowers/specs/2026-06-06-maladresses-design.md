# Design — Conséquences de combat persistantes (Persistance · Traumatismes · Dégâts d'arme · Maladresses)

*Spec umbrella, 2026-06-06. Reliquat du Jalon 1 (combat) + comblement de trous de fidélité
révélés par la directive « maximum de fidélité au RAW ».*

## Origine & directive

Point de départ : implémenter les **Maladresses** (fumbles), miroir des Critiques. La directive
utilisateur — **maximum de fidélité au RAW** (Rules As Written), ne journaliser que les subsystèmes
**hors-combat** absents — a révélé que la Maladresse déclenche des effets aujourd'hui **non
modélisés**, et que ces effets, **comme la mort, doivent persister après le combat**. Le périmètre
est donc un thème cohérent : **les conséquences de combat persistent et se récupèrent par le
repos/soins (Jalon 5), pas en repartant « frais » à chaque combat**.

**Hors périmètre (hors-combat) :** Maladies, Corruption, mutations (déjà « laissées au MJ » côté
magie) ; la **guérison/récupération** elle-même (temps, repos, Compétence Guérison, Chirurgie) →
**Jalon 5** ; Maladresses hors combat (option `12-Tests` l.151) ; effets de trauma
narratifs/permanents/non quantifiés en combat (voir Plan B).

## Découpage en 4 plans séquencés (A → B → C → D)

Décidé avec l'utilisateur : livrer par tranches reviewables/jouables (principe du dépôt). Chaque
plan = un cycle plan → implémentation → commit, vérifiable isolément. **Plan A en premier.**

- **Plan A — Persistance des conséquences de combat** *(détaillé ci-dessous, à planifier maintenant)*.
  Socle : ce qui se passe en combat (Blessures, États persistants, critiques cumulés, **mort**)
  **suit le héros**. Bénéficie *immédiatement* aux Blessures/critiques/États **déjà existants**.
- **Plan B — Socle Traumatismes (en-combat)** *(esquissé)*.
- **Plan C — Dégâts d'arme** *(esquissé)*.
- **Plan D — Maladresses** *(esquissé)* — consomme B et C.

---

## PLAN A — Persistance des conséquences de combat *(focus actuel)*

### Le trou (vérifié dans le code)

`store.ts:647` (spawn de combat) clone chaque héros du groupe avec `conditions: []` et `wounds`
recopiées du groupe ; `checkBattleOver` (`store.ts:2143`) termine le combat **sans rien réécrire
vers le groupe**. Conséquence : Blessures, États, critiques cumulés et **mort** sont **jetés** —
les héros repartent frais à chaque embuscade. La mort elle-même ne persiste pas.

### Comportement visé (RAW)

À la fin d'un combat (`over: 'victory' | 'defeat'`), **réécrire vers `party`** l'état persistant de
chaque héros, et le **ré-importer** correctement au combat suivant. Récupération (repos/jours/
Guérison) = **Jalon 5** ; ici on persiste, on ne soigne pas.

**Persistent (toujours réécrit vers `party`) :**
- `wounds.current` (Blessures subies).
- `criticalWounds` (compteur de Blessures critiques cumulées).
- `dead` (mort définitive) **et** `outOfRencontre` (« Meurs un autre jour » — éjecté mais vivant) :
  **la mort persiste** ; un héros mort reste mort au combat suivant (ne respawn pas).
- `roundsAtZero` (progression vers l'Inconscience) — cohérence du modèle de mort lente.
- États **persistants** (voir classement).
- (Préparé pour B/C : `traumas`, `damageTaken` d'objet — réécrits dès que ces champs existent.)

**Transitoire (NON réécrit — état de combat, se lève en combat) :**
`advantage`, `engagedWith`/`meleeThisRound` (Engagé), `activeEffects` (durées en Rounds),
`defensiveStance`, `aiming`, `loaded`/`reloadProgress`/`ammoUid` (réinitialisés au spawn), et les
**États transitoires** ci-dessous.

### Classement RAW des États (à sourcer au chapitre « États », puis figé en table)

Pur, testable. **À transcrire verbatim depuis la Source pendant la planification** (ne pas inventer).
Hypothèse de travail (à confirmer sur le chapitre États) :
- **Transitoires (droppés en fin de combat)** : `Surpris`, `À Terre`, `Sonné`, `Engagé`
  (relation de combat). *(Aveuglé/Assourdi se dissipent déjà 1/Round en combat ; à classer :
  s'ils subsistent à la fin, persistent-ils ? → décision sourcée.)*
- **Persistants (réécrits)** : `Hémorragique`, `Empoisonné`, `En flammes`, `Exténué`, `Fatigué`,
  `Brisé`, `Inconscient`. Leur récupération (Tests/temps) = Jalon 5.

Implémentation : `engine/persistence.ts` (pur) — `PERSISTENT_CONDITIONS: Set<string>` + une fonction
`carryOverState(hero: Combatant): Partial<Combatant>` qui extrait l'état persistant d'un combattant.

### Câblage store

- `checkBattleOver` (ou un nouveau `finalizeBattle`) : à `over` (victoire **ou** défaite), pour
  chaque héros du `battle`, fusionner son état persistant dans l'entrée `party` correspondante
  (match par `id`). Réécriture **idempotente** ; les morts sont marqués `dead`/`outOfRencontre`.
- `spawnBattle` (`store.ts:647`) : **carry-in** — ne plus forcer `conditions: []`. Importer les
  États **persistants** du membre `party` ; (re)mettre à zéro uniquement les transitoires
  (`advantage`, Engagé…). Un héros `dead`/`outOfRencontre` **n'est pas instancié** dans le combat.
- Le HUD (`CampaignView`/fiche) reflète l'état persistant hors combat (Blessures actuelles, États
  persistants, mort).

### Tests (Plan A)

- `engine/persistence.test.ts` : `carryOverState` extrait le persistant, ignore le transitoire ;
  `PERSISTENT_CONDITIONS` couvre le classement sourcé.
- `state/store.test.ts` : combat → héros blessé/Hémorragique/critique → fin de combat → `party`
  reflète Blessures+critiques+Hémorragique ; **héros mort → reste `dead`** et n'est pas instancié
  au combat suivant ; État transitoire (Surpris/À Terre) **non** persisté ; carry-in ré-applique
  l'Hémorragique au spawn suivant.
- **Vérif navigateur** : enchaîner deux rencontres (scène multi-encounters type Chapitre 2) ; un
  héros blessé au 1er combat démarre le 2e avec ses Blessures ; un héros mort reste absent. `console` 0 erreur.

---

## PLAN B — Socle Traumatismes (en-combat) *(esquissé, à planifier après A)*

Couche `traumas` **partagée** par les tables critiques **et** la Maladresse ; effets en-combat
**quantifiés** modélisés, guérison différée Jalon 5, persistance assurée par le Plan A.

**Type** (`engine/types.ts`), `Combatant.traumas?: Trauma[]` :
```ts
export interface Trauma {
  label: string; location: HitLocation;
  movementHalved?: boolean;
  charPenalty?: Partial<Record<CharKey, number>>; // ex. { F:-30, Ag:-30 }
  limbDisabled?: boolean; dodgeDisabled?: boolean;
  note: string; // texte canon (guérison + effets non modélisés) — journalisé
}
```
**Factory unique** `traumaFromKind(kind: 'dechirure'|'fracture'|'amputation', severity, location) → Trauma`
(seule source des champs d'effet), partagée critiques ↔ Maladresse.

**Effets en-combat modélisés** (RAW quantifié, `18-Traumatisme`) — le trauma **hérite de la
localisation du critique** qui le pose :

| Trauma (location) | Source | Modélisé |
|---|---|---|
| Déchirure musculaire — Jambe | l.315, 324 | `movementHalved` |
| Fracture — Torse | l.298 | `charPenalty {F:-30,Ag:-30}` + `movementHalved` |
| Fracture — Bras | l.298 | `limbDisabled` |
| Fracture — Jambe | l.298 | `movementHalved` |
| Amputation — Pied / Jambe | l.369, 346-347 | `movementHalved` (+ `dodgeDisabled` si Jambe) |
| Amputation — Main / Bras | l.352, 335 | `limbDisabled` |

Helpers purs (`engine/trauma.ts`) : `traumaMovementFactor`, `traumaCharPenalty(c,key)`,
`disabledLimbs`, `dodgeForbidden`. Lecture : `effectiveChar` (pool « pire pénalité », non-cumul
l.168) ; `effectiveMovement(c)=floor(M×factor)` avant Encombrement ; loadout (bras désactivé → arme
lâchée/2 mains impossible, bouclier retiré) ; `bestDefenseMode` (Esquive interdite). Alimentation :
`CritEntry.traumas?: {kind;severity}[]` (transcrit des `note` verbatim) → `rollCritical` ;
Maladresse 81-90 → `traumaFromKind('dechirure','mineur',<jambe>)`.

**Journalisé (rien d'inventé)** : « −10/−20 aux Tests *concernant* la Localisation » (Déchirure)
— non énuméré par le RAW → on ne modélise que la conséquence explicite (Mouvement ÷2) ; pénalités
Sociabilité/Langue/odorat/vue/dents/doigts/orteils ; guérison → Jalon 5.

## PLAN C — Dégâts d'arme *(esquissé, à planifier)*

RAW `62-Les armes` l.177-180 : −1 Dégât/point reçu ; +0 (ou BF+0) → **Arme improvisée** ;
**Incassable** (l.310) exempte. `Weapon.damageTaken?` (active) + `ItemInstance.damageTaken?`
(héros, persisté via Plan A) ; `recomputeLoadout` propage. `combat.ts` réduit la chaîne de Dégâts
(plancher → arme improvisée : Atouts ignorés, Défauts conservés). `destroyed?` (Incident de Tir) →
arme inutilisable. Réparation = Jalon 5. Ennemis : `damageTaken` transient sur leur `Weapon`.

## PLAN D — Maladresses *(esquissé, à planifier — consomme B et C)*

**Détection** (`combat.ts`) : `fumble = isDouble && !success` (miroir du Critique `combat.ts:279`),
côté attaquant ET défenseur. **`src/data/oups.ts`** (verbatim, comme `criticals.ts`) +
**`engine/oups.ts`** `rollOups(...)` table-driven (RNG seedé) ; Incident de Tir prioritaire (arme
poudre/mécanique/explosive + jet **pair**).

| d100 | Effet canon (`14-_GoBack` l.16-46) | `kind` | Traitement |
|---|---|---|---|
| 01-20 | Perd 1 Blessure, ignore BE+PA | `selfWound` | `wounds.current -= 1` |
| 21-40 | Arme abîmée (1 Dégât) **+ agir en dernier** | `weaponDamageActLast` | 1 Dégât d'arme (C) + `actLastNextRound` |
| 41-60 | **−10** à l'Action au prochain Round | `actionPenalty` | `nextActionPenalty = 10` |
| 61-70 | Perd son prochain Mouvement | `loseMovement` | `loseNextMovement = true` |
| 71-80 | Perd sa prochaine Action | `loseAction` | `loseNextAction = true` |
| 81-90 | Déchirure musculaire (Mineur), = critique (« cheville ») | `trauma` | `criticalWounds += 1` + trauma jambe (B) |
| 91-00 | Touche 1 allié à distance (unités = DR) ; sinon soi → Sonné | `hitAlly` | allié tiré au sort touché ; sinon `Sonné` |

**Incident de Tir** (`misfire`) : Dégâts Bras principal (unités = DR), arme détruite (C).
**Store** : `pendingFumble` (héros → modale, invariante « un jet = une modale » ; ennemi →
instantané). Nouveaux champs `Combatant` : `nextActionPenalty?`, `loseNextAction?`,
`loseNextMovement?`, `actLastNextRound?` (consommés `advanceTurn`/fin de Round). **UI** :
`FumbleModal.tsx` (sans Chance — elle agit sur le Test *avant*). Tests : `oups.test.ts` (7 bandes,
Incident pair/impair, 91-00 avec/sans allié), détection fumble, store (héros/ennemi, flags).

---

## Conventions (tous plans)

- FR partout ; data FR ; **aucune source VO**. Tables verbatim écrites-main (comme `criticals.ts`).
- Moteur pur + testé ; store/UI/rendu en dépendent. **Rien d'inventé** : le flou RAW est journalisé.
- Commits propres : mes seuls fichiers (`git commit -- <chemins>`), working tree partagé avec la session rig.
- Vérif navigateur (Playwright) après chaque tranche ; hard reload (HMR périmé).
