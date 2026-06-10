# Loadouts d'armes + Combat à deux armes — design

> Spec de design. RAW vérifié dans `Source/Warhammer v4 - Livre de base version corrigée/` (FR).
> Point de départ validé en brainstorming ; rien n'est figé tant que l'utilisateur n'a pas relu.

## 1. Problème

Aujourd'hui `recomputeLoadout` rend ACTIVES **toutes** les armes équipées (on peut « porter 10 armes »
utilisables alors qu'on a 2 mains) ; `attackWeapon`/`firedWeapon` **auto-choisissent** l'arme (mêlée au
contact / 1ʳᵉ distance) ; `defenseValue('parade')` prend `c.weapons[0]` ; **aucune pénalité de main
secondaire** n'existe ; et on peut **changer d'armure / brasser ses objets EN combat** (non-RAW).

But : un système de **loadouts** (sets d'armes nommés que le joueur construit hors combat et commute en
combat) qui détermine les armes actives, avec **choix de l'arme d'attaque ET de parade** (pénalité de main
secondaire, exception de la spé Parade), le talent **Maniement de deux armes**, le tout posé sur un **registre
de capacités de combat** extensible (talents + traits de créature deviennent des entrées).

## 2. Règles RAW vérifiées (référence canonique)

| Règle | Source | Contenu retenu |
|---|---|---|
| Combat à deux armes | LDB 14 l.177-183 | 1 arme à 1 main (ou pistolet) par main. **Attaque de la main secondaire = -20** sur tous les Tests applicables. Frapper avec **les deux** = talent Maniement de deux armes. |
| Ambidextre (talent, max 2) | LDB 10 l.30-32 | Pénalité main secondaire : -20 → **-10** (1×) → **0** (2×). |
| Maniement de deux armes (talent, max = Bonus d'Ag) | LDB 10 l.633-638 | « Pour votre Action » : jet main principale ; si touche, dégâts normaux **on garde le d100** ; main secondaire vise **une cible au choix** au **d100 inversé** (34→43) **+ pénalité main secondaire** ; **nouveau jet de défense** adverse ; **exception Critique** : la 2ᵉ utilise le jet de la table des Critiques ; **-10 à TOUS ses jets de défense jusqu'au prochain Tour** ; **+1 Avantage UNIQUE, seulement si les deux touchent**. |
| Parade (atout) | LDB 62 l.192 | Toute arme **à 1 main + Défensive** s'utilise avec **Corps à corps (Parade)** → parer **sans le -20** de main secondaire. |
| Défensive (atout) | LDB 62 l.272 | **+1 DR** à tout Test de Corps à corps en opposant une attaque. (Déjà implémenté dans `finishMelee`.) |
| Actions gratuites | LDB 13 l.116 | **Dégainer une arme** = Action gratuite (exemple cité). **Le nombre est laissé au MJ.** Être **Engagé peut interdire** une Action gratuite « qui pourrait octroyer un bonus à l'ennemi ». Changer d'armure **n'est PAS** une Action gratuite (non listé ; aucune règle d'enfilage dans tout le LDB). |
| Frénésie | LDB 21 l.34 | Action = un Test de CC ; **+ un Test de CC GRATUIT** chaque Round. |
| Spécialisations CC | LDB 09 l.144 | Base, Escrime, Parade, Cavalerie, Fléau, Arme d'hast, Arme à 2 mains, Bagarre. |
| Maladresse / amputation ↔ main | LDB 14 l.53-57 ; LDB 18 l.341/352 | Maladresse (échec + double) → « Tableau des Oups! » (peut faire **lâcher l'arme**) ; ratage d'arme à feu → Localisation **Bras principal** + arme détruite. Critique au bras → **amputation** de la main (brasD principal → -20 ; brasG secondaire). → la main qui lâche/est amputée mappe sur **brasD/brasG**. |

Exemples-cibles du registre (hors périmètre, vérifiés pour valider les seams) :
- **Riposte** (talent, LDB 10 l.843-852) : arme **Rapide** → inflige des dégâts quand on est attaqué « comme si
  c'était son Action », N/Round = niveau de Riposte. → hook **réactif sur défense gagnée**.
- **Champion** (trait créature, LDB 85 l.55-56) : « gagne un Test opposé en se défendant en CC → cause autant
  de Dégâts que si elle était l'attaquant. » → **même hook** réactif que Riposte.
- **Tir rapide** : non trouvé sous ce libellé dans les Talents de base → futur hook d'éco-action à distance.

## 3. Décisions de design

1. **Loadouts multiples nommés**, pas de slot « 2 mains + projectile » figé. Le distant est un contenu de
   loadout comme un autre (rare en carrière ; plusieurs Groupes offrent 1M et 2M).
2. **Commutation en combat = 1 switch gratuit par tour, autorisé même Engagé.** LDB 13 l.116 : l'Engagé
   *peut* interdire une action gratuite — c'est de la discrétion, pas une interdiction. On l'autorise : un
   archer chargé DOIT pouvoir dégainer pour passer au corps à corps (il ne peut pas tirer utilement en mêlée).
   Le MJ plafonne le nombre → défaut 1/tour. Seul vrai choix : finir son tour épée/bouclier **ou** arc.
3. **En combat, seul le switch de loadout change l'équipement.** Armure et brassage d'inventaire =
   **hors combat uniquement** (corrige le comportement permissif actuel).
4. **Héros uniquement.** Les ennemis gardent l'auto-choix de leur statbloc (un ennemi qui dual-wield est rare ;
   l'IA pourra y venir via le registre plus tard).
5. **Maniement de deux armes borné à l'attaque-Action.** Jamais sur une attaque GRATUITE (Frénésie, attaques
   gratuites de créature, Piétinement, future Riposte). Le **choix d'arme mono** (avec -20), lui, s'applique à
   toutes les attaques.
6. **Le terrain : un registre de capacités de combat** (`src/engine/combatFeatures/`) calqué sur
   `src/engine/qualities/`. On n'implémente QUE les entrées de ce chantier (Ambidextre, Maniement de deux
   armes) ; Riposte/Champion/Tir rapide sont prouvés sur le papier, câblés plus tard (pas de dispatcher mort).

## 4. Architecture

### 4.1 Modèle de données

- **Latéralité fiable.** Une arme expose `hands: 1 | 2`. Dérivation (Phase 1, remplace l'actuel
  `isTwoHandedWeapon` incomplet) : 2 mains si le trapping est marqué `(2M)` (prefix/nom — couvre hampes,
  fléaux 2M, armes à deux mains, épées bâtardes) **ou** arc / arbalète (sauf « de poing ») ; sinon 1 main.
  Pistolets/arquebuses (Poudre noire, subType ambigu) : 1 main par défaut (pistolet), `(2M)` pour l'arquebuse.
- **Loadouts de première classe.** `Combatant.loadouts: WeaponLoadout[]` + `activeLoadoutId?: string`.
  ```
  WeaponLoadout = { id, name, main?: uid, off?: uid }   // off ⇒ null si l'arme `main` est à 2 mains
  ```
  Une arme 2M occupe `main` et **force `off` vide**. `main`/`off` référencent des `ItemInstance.uid` de
  l'inventaire du héros (armes uniquement).
- **`ItemInstance` / `Weapon`** gagnent `hand?: 'main' | 'off'` sur l'arme ACTIVE dérivée (porté par le
  `Weapon` que lit le combat). `equipped` reste utilisé **pour l'armure** ; pour les armes, « actif » = « dans
  le loadout actif ».
- **Mapping main↔localisation (convention canon)** : `main` = **brasD** (droitier / « Bras principal »,
  LDB 14 l.57 ; déjà la convention de `critical.ts`), `off` = **brasG**. C'est le substrat des effets qui
  ciblent une localisation de bras : **lâcher l'arme** (Maladresse) et **amputation de la main** (Critique).

### 4.2 `recomputeLoadout` révisé

Construit `c.weapons` depuis le **loadout actif** : résout `main`/`off` → items, valide la contrainte 2 mains
(une 2M annule `off`), tague chaque `Weapon` de son `hand`, ajoute le repli **Mains nues** (`hand:'main'`,
sans pénalité). L'armure reste dérivée des items `equipped`. Pas de loadout actif (ennemis, anciennes parties)
→ comportement de repli = toutes armes équipées (compat ascendante) + migration (§7).

### 4.3 Registre de capacités de combat (`src/engine/combatFeatures/`)

Mirroir de `qualities/` :
- `normalize.ts` : canonicalise un talent/trait + lit son niveau (`times` des talents, `(Indice)` des traits),
  comme `parseQuality`.
- `registry.ts` : une entrée par capacité. Interface `CombatFeature` à **hooks optionnels** :
  - `offHandPenalty?(ctx) => number` — modifie la pénalité de main secondaire (Ambidextre).
  - `attackMods?(ctx) => ModLine[]` / `defenseMods?(ctx) => ModLine[]` — alimentent `attackModifiers` /
    `defenseModifiers` existants.
  - `attackModes?(ctx) => AttackMode[]` — ajoute un mode d'attaque (Maniement de deux armes).
  - `onWonDefense?(ctx) => ReactiveAttack | null` — réactif (Riposte, Champion). **Défini mais non invoqué
    tant qu'aucune entrée ne le fournit** (pas de dispatcher mort).
- `dispatch.ts` : `featuresOf(combatant)` agrège talents + traits ; plieurs `offHandPenalty(...)`,
  `attackModesFor(...)`, et l'injection des `ModLine` dans les modificateurs existants.

Entrées livrées par ce chantier : **Ambidextre** (offHandPenalty), **Maniement de deux armes** (attackModes).

### 4.4 Pénalité de main secondaire (pur, testé)

```
offHandPenalty(combatant, weapon) :
  weapon.hand !== 'off' → 0
  sinon base -20, puis registre (Ambidextre : -10 si 1×, 0 si 2×)
```
Consommé par `combatValue`/`previewAttack` (attaque) et par la **parade** :
```
parryPenalty(defender, weapon) :
  weapon.hand !== 'off' → 0
  arme 1 main + Défensive + le défenseur a Corps à corps (Parade)  → 0   (LDB 62 l.192)
  sinon → offHandPenalty(defender, weapon)
```
Le +1 DR Défensive en opposition reste géré par `finishMelee` (inchangé).

## 5. Flux de combat

### 5.1 Choix de l'arme d'attaque
Quand le loadout actif offre ≥2 armes utilisables pour l'action courante (2 mêlées au contact, ou mêlée +
pistolet), l'attaque expose un **choix d'arme**. L'aperçu `previewAttack` (déjà présent) inclut la pénalité de
main secondaire si l'arme choisie est en main `off`. `PendingAttack` gagne `weaponUid?` ; `firedWeapon` lit le
choix (défaut = main principale au contact / distance sinon — RAW-correct pour le cas courant).

### 5.2 Choix de l'arme de parade
`DefenseModal` : quand ≥2 armes peuvent parer, **choix de l'arme** (valeur de spé alignée + `parryPenalty`).
`PendingDefense` gagne `parryWeaponUid?` ; `defenseValue('parade', weapon)` utilise l'arme choisie.

### 5.3 Commutation de loadout
Commutateur dans l'ActionBar : liste des loadouts du héros, **toujours actif (même Engagé)**. 1 switch
gratuit/tour (`battle.loadoutSwapped` réinitialisé au changement de tour). Le switch ne consomme ni Action ni
Mouvement. `recomputeLoadout` ré-exécuté ; `c.weapons` change.

### 5.4 Verrou d'équipement en combat
Pendant `battle` : la fiche perso / UI d'équipement passe en **lecture seule** sauf le commutateur de loadout
de l'ActionBar. (Dé)équiper de l'armure, brasser/échanger des objets, éditer les loadouts → **hors combat**.

### 5.5 Maniement de deux armes
Mode d'attaque « **Des deux armes** » (via le registre, §4.3), proposé seulement si : héros a le talent, loadout
= 2 armes (mains principale+secondaire), attaque qui **consomme l'Action** (jamais une gratuite).
Séquence :
1. Jet to-hit **main principale** (normal). Si manqué → fin (pas de 2ᵉ).
2. Si touche : dégâts main principale normaux. **On conserve le d100.**
3. **2ᵉ attaque main secondaire** : cible = un adversaire **au choix** (peut différer) ; to-hit = **d100 inversé**
   (digits ; 34→43) **+ offHandPenalty** ; opposé à un **nouveau jet de défense** de la 2ᵉ cible ; dégâts normaux.
   Exception : 1ʳᵉ = Critique → la 2ᵉ utilise comme jet **la valeur tirée sur la table des Critiques**.
4. **-10 à tous les jets de défense du héros jusqu'au début de son prochain Tour** (nouvel état, expire au tour).
5. **Avantage** : non gagné par ce mode sauf si **les deux** attaques touchent — et alors **+1 UNIQUE** (pas +1
   par frappe ; le gain par-frappe habituel est remplacé par un seul +1 conditionné aux deux touches). RAW vérifié
   avec l'utilisateur (LDB 10 l.638 « ne gagnez pas d'Avantage … sauf si les deux attaques touchent »).
Implémentation via la file de modales existante (arbitre R2) : 1ʳᵉ attaque → (si touche) sélection de la 2ᵉ cible
→ 2ᵉ attaque. Pur autant que possible (le d100 inversé est dérivé, pas re-tiré → déterminisme intact).

### 5.7 Amputation ↔ loadout (RÉVISÉ après audit RAW — LIVRÉ commit `5da4a34`)

> **Audit RAW VF (2026-06-10) :** deux des trois idées initiales étaient sans fondement et ont été ÉCARTÉES.
> - ❌ **Maladresse « lâche l'arme »** : le Tableau des Oups ! VF (LDB 14 l.14-46, `src/data/oups.ts`) n'a AUCUN
>   résultat « lâcher l'arme ». Le 71-80 fait perdre la prochaine **Action** (`loseAction`), pas l'arme. Le seul
>   cas où une arme quitte la main est l'**Incident de Tir** (l.56-57, Poudre noire, jet pair) : l'arme est
>   **détruite** (`it.destroyed`, déjà retirée par `recomputeLoadout`). → rien à câbler.
> - ❌ **« Unification off-hand » du −20 d'amputation** : le RAW (LDB 18) modélise la perte de la main directrice
>   comme un −20 CC/CT FORFAITAIRE (`charPenalty`, `critical.ts`), l'arme étant CONSERVÉE (adaptation). Reframer
>   en off-hand = invention + double comptage potentiel. L'existant est déjà correct (−20, sans pénalité off-hand
>   ajoutée car l'arme reste taguée `hand:'main'`). → on n'y touche pas.

**Ce qui EST livré (vrai bug trouvé via une question de l'utilisateur « le bouclier reste-t-il dans une main
amputée ? »)** : `recomputeLoadout` ne bloquait que les armes à DEUX mains sur amputation — un **bouclier / 2ᵉ
arme dans une main amputée restait dérivé** (défense gratuite d'un bras absent). Fix : `handAmputated(c, 'main'|
'off')` (`trauma.ts` ; brasD/brasG, hors prothèse « tout ») piloté par `recomputeLoadout` :
- **Arme directrice CONSERVÉE** tant qu'il reste UNE main (adaptation ; le −20 CC/CT de l'amputation s'applique déjà) ;
- **objet de main secondaire (bouclier / 2ᵉ arme) LÂCHÉ** dès qu'une main manque (la main restante tient l'arme directrice) ;
- **les DEUX mains perdues → Mains nues**.

### 5.6 Bornage Frénésie / attaques gratuites
L'attaque gratuite de Frénésie (et toute attaque gratuite) reste **mono-arme** : le mode « Des deux armes »
n'est pas proposé. Le **choix d'arme mono** (avec -20 si main secondaire) s'y applique normalement.

## 6. UI

- **Constructeur de loadouts** (fiche perso, onglet équipement, hors combat) : créer/nommer/supprimer un
  loadout, assigner main principale / secondaire depuis l'inventaire, validation 2 mains (une 2M grise le slot
  secondaire). Marquer le loadout actif.
- **Commutateur ActionBar** : boutons COURTS (nom du loadout) ; grisé si Engagé.
- **Choix d'arme** dans la modale d'Attaque et la `DefenseModal` : sélecteur compact ; l'arme de main secondaire
  affiche son -20 (ou « parade sans malus » si Parade+Défensive).
- Style : noms de bouton courts, pas de texte superflu.

## 7. Risques & migration

- **Blast radius** `equipped` (armes) → loadouts : `buildInventory` (équipe best-melee + 1ʳᵉ distance) doit
  désormais **créer un loadout par défaut** ; `compareEquip` (marchand) « équiper » = ajouter à l'inventaire
  (l'arrangement en loadouts se fait dans la fiche). Tout lecteur de `weapon.equipped` à auditer.
- **Migration** : parties/héros sans `loadouts` → en générer un (« Défaut ») depuis l'équipement courant au
  chargement ; `recomputeLoadout` tolère `activeLoadoutId` absent (repli compat).
- **Parité aperçu↔résolution** : `firedWeapon`/`previewAttack`/`finishMelee` doivent lire le **même** choix
  d'arme et la **même** pénalité (sinon le picker ment). Invariant testé.
- **Latéralité** : la nouvelle dérivation `hands` doit re-classer les 2M de Groupes mixtes (hampes, fléaux) sans
  régresser le repli « pas d'arme 2 mains » des amputations (`cannotWieldTwoHanded`).

## 8. Tests (TDD, moteur pur d'abord)

- `hands` : `(2M)` → 2 ; arc/arbalète(non-poing) → 2 ; arme simple/bouclier/pistolet → 1.
- `recomputeLoadout` : loadout 2M → `off` ignoré ; loadout 1M+bouclier → 2 `Weapon` tagués main/off + Mains nues.
- `offHandPenalty` : main → 0 ; off → -20 ; Ambidextre 1× → -10 ; 2× → 0.
- `parryPenalty` : off + Défensive 1M + spé Parade → 0 ; off sans Parade → -20/Ambidextre ; main → 0.
- `combatValue`/`previewAttack` : parité ; -20 appliqué à l'attaque de main secondaire.
- Maniement : 2ᵉ jet = inversion du 1ᵉʳ + pénalité ; pas de 2ᵉ si 1ʳᵉ manque ; exception Critique = jet de la
  table ; -10 défense jusqu'au prochain tour ; Avantage seulement si les deux touchent ; **interdit sur attaque
  gratuite**.
- Commutation : 1/tour, autorisée même Engagé, réinitialisée au changement de tour ; verrou équipement en combat.
- Registre : `featuresOf` agrège talents+traits ; ajout d'une entrée n'altère pas les autres (golden).

## 9. Hors périmètre (terrain préparé, pas implémenté)

- Riposte, Champion (hook `onWonDefense`), Tir rapide (éco-action distance) : entrées futures du registre.
- IA ennemie dual-wield / loadouts ennemis.
- Mode « Des deux armes » sur attaques gratuites.
- Règle optionnelle « Longueur d'Arme / Combat au Contact » (LDB 62 l.215-222, marquée optionnelle).

## 10. Phases d'implémentation

0. **Registre de capacités** (`combatFeatures/`) : substrate + hooks typés, branché dans
   `attackModifiers`/`defenseModifiers`. Entrée : Ambidextre.
1. **Modèle mains + contrainte 2 mains** : `hands`, `hand`, `recomputeLoadout` borné, `offHandPenalty` /
   `parryPenalty` câblés en attaque ET parade.
2. **Constructeur de loadouts** (fiche perso) + migration loadout par défaut.
3. **Combat** : choix arme attaque + choix arme parade + commutateur loadout (1/tour, libre, même engagé)
   + verrou d'équipement en combat.
4. **Maniement de deux armes** (mode d'attaque via Ph.0 ; flux complet §5.5).
5. **Lâcher / amputation ↔ loadout** (§5.7) : Maladresse « lâche l'arme » + Critique « amputation » vident le
   slot de main (brasD=main / brasG=off) ; main principale perdue → arme secondaire à la pénalité off-hand
   (unifie le -20 forfaitaire de `critical.ts`).
