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
| **Ordre du ×N** : appliqué aux **Dégâts (arme+DR+atouts) AVANT la réduction BE+PA** | **interprétation figée** | « après les modificateurs » = après les modificateurs de Dégâts ; le soak (BE+PA) est l'étape « Appliquer », pas un modificateur. `[retenu : ×N avant soak]` |
| ×N + atouts de Taille s'appliquent au tir **et** à la mêlée (attaquant plus grand que la cible) | `[DESIGN]` | RAW dit « les Dégâts infligés » sans restreindre ; cohérent. Frappe Mortelle/Piétinement/parade restent mêlée/CC. |
| −2 DR/cat : **parade (CC) du plus petit uniquement**, pas l'esquive | **RAW** | `85` l.305-306 |
| Frappe Mortelle (grande créature) : balayage **sans tuer**, jusqu'à **BCC** enchaînements sur adversaires **adjacents** | **RAW** | `14` l.12 + `85` l.299 ; cible des enchaînements = adjacents `[DESIGN]` (RAW : « se déplacer sur la case » → on enchaîne sur les adjacents accessibles) |
| Force opposée : helper pur, **sans consommateur** (pas de Test de Force opposé/empoignade modélisé) | **RAW** (posé) | `85` l.311-312 ; inerte jusqu'au système de lutte |
| Blessures monstres : **data = autorité** (`char.B` précalculé) ; `maxWounds`-par-Taille = héros / recalcul explicite | `[DESIGN]` anti-double-mult | cf. analyse |

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

**`state/combatFlow.ts`** — **balayage** (Frappe Mortelle) :
- Après une touche de mêlée résolue avec `cleave`, l'attaquant peut **enchaîner** : choisir un autre adversaire **adjacent** vivant non encore frappé ce balayage, jusqu'à **`bonus(effectiveChar(att,'CC'))`** enchaînements. Chaque enchaînement = une attaque de mêlée normale (qui peut elle-même balayer? non — borne BCC globale au tour).
- **IA** (`doAttack`) : enchaîne automatiquement sur les adjacents (déterministe, RNG seedé).
- **Héros** : après l'attaque, si `cleave` et adversaire(s) adjacent(s) restant(s), **modale/prompt d'enchaînement** (`pendingCleave { attackerId, hitIds[] }`) → le joueur choisit la cible suivante ou termine ; réutilise le flux d'attaque (`pendingAttack`). Invariante « un jet = une modale » respectée (chaque enchaînement est une attaque modale standard).

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

### T4 — Blessures par catégorie
**`engine/characteristics.ts`** :
- `maxWounds(c)` : remplacer le binaire `isSmall` par une **table de Taille** (`engine/size.ts` `SIZE_WOUNDS`) :
  Minuscule=1 ; Très Petite=BE ; Petite=2·BE+BFM ; **Moyenne=BF+2·BE+BFM** (formule actuelle) ; Grande=×2 ; Énorme=×4 ; Monstrueuse=×8. **Endurant/Coriace appliqué AVANT le ×N** (`85` l.105-106).
- **Monstres** : `char.B` est précalculé en data → `creatureToCombatant` garde `wounds = char.B` (autorité data). `maxWounds`-par-Taille ne s'applique qu'aux **héros** (création) et au **recalcul explicite** (`buyCharAdvance`). `[anti double-mult]`

## 6. Plan de tests (TDD)
- `size.test.ts` : `sizeDamageMultiplier` (×1 à +1, ×2 à +2, ×3 à +3, ×1 si plus petit/égal), `sizeGrantedQualities` (∅/Dévastatrice/Dévastatrice+Percutante), `forceOpposedOutcome` (autoWin/needCrit/normal), `SIZE_WOUNDS`.
- `combat` : Dévastatrice (max(DR,unités)), Percutante (+unités), Inoffensive annule les deux, cumul, ×N avant soak (woundsLost attendu), `cleave` posé sur touche mêlée d'un plus grand ; −2 DR/cat en parade (pas en esquive) via `finishMelee` ; `resolveTrample` (BF+0, CC).
- `characteristics` : `maxWounds` par catégorie (les 7), Endurant avant ×N, héros Halfling=Petite.
- `combatFlow`/store : balayage (IA enchaîne sur N adjacents jusqu'à BCC ; héros `pendingCleave`) ; désengagement gratuit du plus grand ; `battleTrample` (coûte 1 Avantage). RNG seedé.
- Régression : suite verte (le ×N/atouts changent des dégâts — mettre à jour les attentes impactées, c'est la nouvelle fidélité).

## 7. Isolation session rig
Tout en `engine/*` + `state/*` (mes fichiers). Hotbar/UI Piétinement : `ui/ActionBar.tsx`/`CampaignView` (à vérifier rig-set ; sinon hunks sélectifs). `IsoStage.tsx` non requis. Modale `pendingCleave`/`pendingTrample` = mêmes patterns que `pendingAttack`. Audit de fidélité multi-agents en fin de lot (ultracode).
