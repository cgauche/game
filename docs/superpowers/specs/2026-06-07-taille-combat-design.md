# Spec — Taille en combat (Jalon 1.5, T2+T3+T4)

*2026-06-07. Approfondit le sous-système **Taille** (T0/T1 déjà livrés) avec **tous** les effets de
combat du Trait Taille, max-RAW. Analyse de référence : `2026-06-07-taille-analyse-reference.md`.
Source unique : `Source/Warhammer v4 - Livre de base version corrigée/` (FR).*

## 1. But

Faire **pleinement « sentir » la Taille** au combat : un géant écrase (Dégâts ×N, balayage), est
coriace (Blessures ×8), dur à parer ; un halfling est agile mais fragile. **Aucune invention** —
chaque valeur citée verbatim ; les rares choix sont marqués `[DESIGN]`.

## 2. Source de vérité (verbatim)

- **Modificateurs de Taille en combat** : `85 - Traits de créature.md` l.292-321.
  - l.295 : « Ses armes gagnent l'Atout **Dévastatrice** si la créature est d'une catégorie de Taille
    supérieure, **et Percutante** si elle est plus grande d'au moins deux catégories. » → **cumul** : +1 cat = Dévastatrice ; **+2 cat = Dévastatrice ET Percutante**.
  - l.297 : « Vous **multipliez les Dégâts infligés** par le nombre de catégories supérieures (2 cat = ×2, 3 = ×3…) : cette multiplication est calculée **après l'application des modificateurs**. »
  - l.299 : « Toutes les frappes réussies activent la règle optionnelle **Frappe Mortelle**, même si la cible survit. »
  - l.305-306 : « Vous subissez une pénalité de **DR −2 pour chaque catégorie supérieure** de votre adversaire, quand vous utilisez la **CC pour vous défendre** lors d'un Test opposé. » (Parade, pas Esquive.)
  - l.308-309 : créature plus grande **ignore le Désengagement**.
  - l.311-312 : **Force opposée** — +2 cat = victoire auto ; +1 cat = le plus petit doit un **Critique** pour s'opposer.
  - l.320-321 : **Piétinement** — Action gratuite à **1 Avantage**, Dégâts = **BF +0**, via **Corps à corps (Bagarre)**, créature plus grande frappant plus petit / vers le bas.
  - l.332-352 : **Blessures par catégorie** (cf. §5 T4).
- **Atouts d'arme** : `62 - Les armes.md` l.278-313.
  - **Dévastatrice** (l.278-279) : « utiliser le résultat le plus haut entre le **dé des unités** ou le **DR** » → Dégâts = arme + **max(DR, unités)**. *Inoffensive l'annule.*
  - **Percutante** (l.312-313) : « ajoutez le **dé des unités** à tout Dégât » → Dégâts **+= unités**. *Inoffensive l'annule.*
  - (« dé des unités » = chiffre des unités du jet d'attaque ; « 00 » = 0.)
- **Frappe Mortelle (Option)** : `14 - _GoBack.md` l.9-12 : « Si vous **tuez** un adversaire en un coup, déplacez-vous sur sa case et **attaquez un autre** ; un nombre de fois égal à votre **Bonus de CC**. Certaines créatures sont si grandes qu'elles peuvent **activer sans tuer**. »

## 3. Périmètre (tout dans ce lot — choix utilisateur « tout complet »)

T2 Dégâts (Dévastatrice + Percutante implémentées · ×N · Frappe Mortelle = **balayage complet** jusqu'à BCC) ·
T3 Lutte (−2 DR/cat en parade · Désengagement gratuit · **Force opposée** helper · **Piétinement** action UI+IA) ·
T4 Blessures par catégorie. **Hors-lot** (jalons séparés) : T5 Peur/Terreur (Psychologie), T6 footprint mobile, localisation par forme de corps, monture.

## 4. Décisions RAW vs DESIGN

| Sujet | Statut | Décision |
|---|---|---|
| Dévastatrice = max(DR, unités) ; Percutante = +unités ; Inoffensive annule ; cumul à +2 cat | **RAW** | `62` l.278-313 / `85` l.295 |
| ×N = nombre de catégories d'écart (×2 à +2, ×3 à +3 ; +1 cat = ×1 no-op) | **RAW** | `85` l.297 |
| **Ordre du ×N** : appliqué aux **Dégâts (arme+DR+atouts) AVANT la réduction BE+PA** | **RAW (confirmé utilisateur)** | « après les modificateurs » (`85` l.297) = après les modificateurs de Dégâts, **avant** que la cible encaisse. Confirmé : « on calcule les dégâts avant, le ×2 c'est avant que l'adversaire encaisse ». |
| ×N + atouts de Taille s'appliquent au tir **et** à la mêlée (attaquant plus grand que la cible) | **RAW** | `85` l.293-299 (« Si la Créature Est Plus Grande ») ne restreint **pas** au CC : « ses armes », « les Dégâts infligés ». Seuls Frappe Mortelle/Piétinement/parade sont intrinsèquement CC. |
| −2 DR/cat : **parade (CC) du plus petit uniquement**, pas l'esquive | **RAW** | `85` l.305-306 |
| Frappe Mortelle : **se déplacer sur la case de la cible** (si tuée) + frapper un autre **à portée de ses attaques**, jusqu'à **BCC** fois ; grande créature l'active **sans tuer** | **RAW** | `14` l.12 + `85` l.299. `[limite]` « à portée » = **adjacent** tant que l'Allonge (reach) n'est pas modélisée (mêlée = adjacence aujourd'hui). |
| Force opposée : helper pur, **sans consommateur** (pas de Test de Force opposé/empoignade modélisé) | **RAW** (posé) | `85` l.311-312 ; inerte jusqu'au système de lutte |
| Blessures **dynamiques** : `char.B` = base autoritaire (le vrai calcul, **traits inclus**) ; les buffs F/E/FM **modifient** les Blessures via le **delta de formule × Taille** | **RAW + DESIGN (delta)** | Sweep 58 créatures : **52 = formule × Taille** (Géant 72=18×4, Ogre 30=15×2) ; **6 traitées** (Coriace +4, mort-vivant +3, Araignée 2≠6…) → un recalcul pur casserait leur base. ⇒ Blessures = `char.B` + (formule(F/E/FM effectives)×Taille − formule(base)×Taille). Sorts d'E/F/FM impactent les Blessures **sans** altérer la base livre. Héros : base = formule×Taille de l'espèce. |

## 5. Composants

### T2 — Dégâts & Atouts
**`engine/size.ts`** (pur) :
- `sizeDamageMultiplier(attacker, target): number` = `gap >= 2 ? gap : 1` (gap = `sizeGap(att, tgt)`).
- `sizeGrantedQualities(att, tgt): string[]` = `[]` si gap<1 ; `['Dévastatrice']` si gap===1 ; `['Dévastatrice','Percutante']` si gap>=2.

**`engine/combat.ts`** :
- Helpers `unitsDie(roll) = roll % 10`. **Dévastatrice/Percutante** appliqués dans `applyHit` (et donc partout) :
  ```
  effQual = weapon.qualities ∪ sizeGrantedQualities(attacker, defender)
  inoffensive = hasQ(weapon,'Inoffensive')
  dmgDR = (!inoffensive && hasQ⟨effQual⟩('Dévastatrice')) ? max(effDR, units) : effDR   // effDR = dr + Pointue
  damage = weaponDmg + max(0, dmgDR)
  if (!inoffensive && hasQ⟨effQual⟩('Percutante')) damage += units
  damage *= sizeDamageMultiplier(attacker, defender)   // ×N AVANT soak (décision figée)
  woundsLost = woundsFromHit(weapon, defender, loc, damage)
  ```
  `hasQ` étendu pour lire une liste de qualités (ou un helper local sur `effQual`). Les armes qui possèdent **déjà** Dévastatrice/Percutante (Zweihänder, Arc long, Arbalète lourde…) en bénéficient enfin.
- **Frappe Mortelle** : `AttackResult` porte `cleave?: boolean`. Posé par les **résolveurs de mêlée** (`finishMelee`/`resolveMeleePassive`) — pas `applyHit` (qui ignore mêlée/tir) — = true si touche **de mêlée réussie** d'un attaquant plus grand (`sizeGap(att,def) >= 1`). L'orchestration du balayage est dans `combatFlow` (cf. ci-dessous).

**`state/combatFlow.ts`** — **balayage** (Frappe Mortelle, `14` l.12 + `85` l.299) :
- Mécanique RAW : on **se déplace sur la case de la cible** puis on **frappe un autre adversaire** à **portée de ses attaques**. Réalisation :
  - Cible **tuée** → case libérée → l'attaquant peut s'y **déplacer**, puis frapper un autre adversaire **à portée de mêlée depuis cette nouvelle case**.
  - Cible **survit** (grande créature, sans tuer) → pas de déplacement (case occupée) → frappe un autre adversaire **à portée depuis sa position**.
  - **« À portée »** = **adjacent** dans le modèle actuel (la mêlée est à l'adjacence) ; **suivra l'Allonge de l'arme** quand le reach sera modélisé `[limite connue, documentée]`.
- Borné à **`bonus(effectiveChar(att,'CC'))`** (BCC) enchaînements / tour ; cibles non déjà frappées dans ce balayage. Chaque enchaînement = une attaque de mêlée standard (ne re-déclenche pas un balayage : la borne BCC est globale au tour).
- **IA** (`doAttack`) : enchaîne automatiquement (déterministe, RNG seedé).
- **Héros** : si `cleave` et cible(s) restante(s) à portée, **modale d'enchaînement** (`pendingCleave { attackerId, hitIds[], movedTo? }`) → le joueur choisit la cible suivante ou termine ; réutilise le flux `pendingAttack`. Invariante « un jet = une modale » respectée.

### T3 — Lutte
**`engine/combat.ts`** :
- `finishMelee` : `drAdjust` du défenseur **−2 × gap** si le défenseur **pare** (`defenseMode==='parade'`) et est plus petit (`sizeGap(defender, attacker) < 0`). S'ajoute aux ajustements Défensive/À Enroulement existants.
**`engine/size.ts`** :
- `forceOpposedOutcome(a, b): 'autoWin'|'needCrit'|'normal'` — +2 cat ⇒ autoWin pour le plus grand ; +1 cat ⇒ le plus petit needCrit ; sinon normal. **Pur + testé, sans consommateur** (prêt pour un futur Test de Force opposé).
**`state/engagement.ts` / `combatFlow.ts`** :
- **Désengagement gratuit** : si le mover est plus grand qu'**au moins un** de ses Engagés (ou que tous ? `[DESIGN]` : qu'il **écarte les plus petits** → s'il est plus grand que **tous** ses adversaires engagés, il se déplace librement sans `pendingDisengage`). `startDisengage` court-circuité → rouvre le déplacement normal.
**Piétinement** (`engine/combat.ts` + `state/combatFlow.ts`/`store.ts` + hotbar + `ai.ts`) :
- `resolveTrample(attacker, target, rng)` : attaque CC (Bagarre), Dégâts = **BF +0** (DR du Test opposé inclus comme une attaque normale), cible plus petite / adjacente. Coûte **1 Avantage** (pas l'Action — « Action gratuite »).
- Store : action `battleTrample(targetId)` (dépense 1 Avantage, résout via le flux d'attaque). **Hotbar** : bouton « 🦶 Piétiner » visible si l'acteur est plus grand qu'un adversaire adjacent et a ≥1 Avantage. **IA** : piétine un adjacent plus petit quand elle a de l'Avantage (option à faible priorité après l'attaque principale).

### T4 — Blessures par catégorie **& dynamiques** (suivent E/F/FM effectives)
*Raison (utilisateur) : des sorts modifient E/FM/F → les Blessures doivent suivre la formule. Mais 6/58
monstres ont un `char.B` traité (Coriace/mort-vivant/spécial) ≠ formule pure → on ne recalcule pas la
base, on applique seulement le **delta** des buffs.*

**`engine/size.ts`** : `woundsForSize(bf, be, bfm, size): number` — Minuscule=1 ; Très Petite=BE ; Petite=2BE+BFM ; **Moyenne=BF+2BE+BFM** ; Grande=Moyenne×2 ; Énorme=×4 ; Monstrueuse=×8.

**`engine/types.ts`** : `Combatant.wounds` gagne `base: number` (Blessures à vide, posées au spawn) — non redérivable pour les 6 monstres traités, donc stockée.

**`engine/characteristics.ts`** : `maxWounds(c: Combatant): number` =
`c.wounds.base + woundsForSize(effective F/E/FM, c.size) − woundsForSize(base F/E/FM, c.size)`.
Au repos (pas de buff) le delta = 0 → `wounds.base`. Un sort +Endurance ⇒ delta > 0 ⇒ Blessures montent (×Taille incluse). *(Ancienne signature `maxWounds(chars, isSmall)` migrée ; appelants mis à jour.)*

**Spawn / création** : monstre `wounds.base = wounds.max = char.B` (vrai calcul, inchangé) ; héros `wounds.base = wounds.max = woundsForSize(base, sizeEspèce)` (Halfling Petite, Ogre Grande…). Endurant/Coriace : déjà dans `char.B` côté monstre ; côté héros, appliqué avant le ×Taille.

**`state` (recompute dynamique)** : à l'application / au retrait / à l'expiration d'un `ActiveEffect` touchant **F/E/FM** (dans `applyActiveEffect` + le décrément de fin de Round), rafraîchir `wounds.max = maxWounds(c)` et **ajuster `wounds.current` du même delta** (gagne des PB sur un buff ; en perd à l'expiration — clamp ≥ 0 ; si ça tombe à 0, le modèle de mort existant s'applique).

## 6. Plan de tests (TDD)
- `size.test.ts` : `sizeDamageMultiplier` (×1 à +1, ×2 à +2, ×3 à +3, ×1 si plus petit/égal), `sizeGrantedQualities` (∅/Dévastatrice/Dévastatrice+Percutante), `forceOpposedOutcome` (autoWin/needCrit/normal), `woundsForSize` (les 7 catégories).
- `combat` : Dévastatrice (max(DR,unités)), Percutante (+unités), Inoffensive annule les deux, cumul à +2 cat, **×N AVANT soak** (woundsLost attendu = (Dégâts×N) − (BE+PA)), `cleave` posé sur touche mêlée d'un plus grand ; −2 DR/cat en parade (pas en esquive) via `finishMelee` ; `resolveTrample` (BF+0, CC).
- `characteristics` : `maxWounds` par catégorie (les 7) ; **delta de buff** : un `ActiveEffect` +Endurance fait monter `maxWounds` de `ΔBE×2×Taille` ; un monstre traité (ex. Squelette `char.B`=12) garde 12 à vide et monte du seul delta ; héros Halfling=Petite, Ogre=Grande.
- `combatFlow`/store : balayage (déplacement sur la case d'une cible tuée puis frappe un adjacent ; sans-tuer = frappe un adjacent sans bouger ; IA auto, héros `pendingCleave` ; borne BCC) ; désengagement gratuit du plus grand ; `battleTrample` (coûte 1 Avantage) ; **recompute Blessures sur buff/expiration** d'un effet F/E/FM (max + current ajustés). RNG seedé.
- Régression : suite verte (le ×N/atouts changent des dégâts — mettre à jour les attentes impactées, c'est la nouvelle fidélité).

## 7. Isolation session rig
Tout en `engine/*` + `state/*` (mes fichiers). Hotbar/UI Piétinement : `ui/ActionBar.tsx`/`CampaignView` (à vérifier rig-set ; sinon hunks sélectifs). `IsoStage.tsx` non requis. Modale `pendingCleave`/`pendingTrample` = mêmes patterns que `pendingAttack`. Audit de fidélité multi-agents en fin de lot (ultracode).
