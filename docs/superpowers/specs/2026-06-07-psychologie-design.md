# Spec — Sous-système Psychologie (WFRP4) + Taille T5 Peur/Terreur

*2026-06-07. Modèle complet et extensible des **Traits Psychologiques** (`21 - Psychologie.md`),
débloquant **T5 Peur/Terreur** de la Taille (`85` l.317-318). Jeu de combat tactique **sans MJ** :
ce que le canon définit est implémenté ; les difficultés « déterminées par le MJ » prennent un
**défaut explicite** ; rien n'est inventé hors-source. Sources : `Source/Warhammer v4 - Livre de
base version corrigée/21 - Psychologie.md` + `85` (Taille) + données `creatures.json`.*

## 1. But

Rendre la Psychologie **« théâtrale »** au combat : un géant inspire la **Terreur**, un nain a de
l'**Animosité (Elfes)**, un Tueur entre en **Frénésie**. Modèle générique éditable (PJ + créatures),
intégré à l'invariante **« un jet = une modale »** (Tests de Calme/Psychologie en modale pour le héros).

## 2. Source de vérité

- **`21 - Psychologie.md`** (96 l.) :
  - **Test de Psychologie** (l.13-14) = **Test de Calme** au début du Round, difficulté MJ → **défaut Intermédiaire (+0)** `[DESIGN, sourcé : les exemples du livre utilisent +0]`. Succès → effets annulés jusqu'à la fin de la rencontre.
  - **Peur (Indice)** (l.26-29) : **Test ÉTENDU de Calme**, cumuler le DR jusqu'à ≥ Indice (un test à la fin de chaque Round). Sous Peur : **−1 DR** aux Tests liés à la source ; ne peut s'**approcher** sans **Calme +0** ; si la source s'approche → **Calme +0 ou Brisé**.
  - **Terreur (Indice)** (l.54-57) : Test de Psy à la **1ʳᵉ rencontre** ; échec → **Brisé ×(Indice + |DR négatifs|)** ; ensuite la créature cause **Peur (Indice = ex-Indice de Terreur)**.
  - **Frénésie** (l.31-36) : Test de **FM** pour entrer ; immunité à tous les autres traits psy ; ne fuit jamais ; doit se déplacer au max vers l'ennemi le plus proche en LdV et l'attaquer ; **Test de CC gratuit** chaque Round ; **+1 BF**. Finit quand tous les ennemis en LdV sont neutralisés / Sonné / Inconscient → **Exténué**.
  - **Animosité (Cible)** (l.21-24) : Test de Psy à la rencontre ; échec → doit s'en prendre au groupe, **+1 DR** contre lui ; **−20 Soc** ; **annulé par Peur/Terreur**.
  - **Haine (Cible)** (l.38-41) : doit détruire le groupe, **+1 DR** combat contre lui, **immunité Peur/Intimidation (pas Terreur)** venant de lui.
  - **Préjugé (Cible)** (l.43-52) : **−10 Soc** ; échec → doit insulter (journal).
  - **Amour (Cible)** (l.74-77) : défend les aimés → **immunité Peur/Intimidation + 1 DR**.
  - **Camaraderie (Cible)** (l.79-82) : défend le groupe → **+1 DR**.
  - **Phobie (Type)** (l.84-87) : traitée comme **Peur 1** sur la source.
  - **Trauma** (l.89-92) : personnalisé / journalisé.
- **Taille** `85` l.317-318 : créature **agressive** plus grande → **Peur (Indice = écart)** à tout plus petit, **Terreur (Indice = écart) si écart ≥ 2**. *(« Agressive » = en combat contre la cible — `[DESIGN, documenté]`.)*
- **Immunité Psychologie** `85` l.143-144 : un Trait « Immunité (Psychologie) » annule Peur/Terreur (mort-vivants sans esprit, constructs…).
- **Données existantes** : `creatures.json` porte déjà les traits (« Terreur 3 », « Peur 4 », « Animosité (un au choix) », « Frénésie »…) et le `folder` (catégorie) ; `species`/`career` pour les groupes.

## 3. Décisions de conception

| Sujet | Décision |
|---|---|
| Difficulté du Test de Psy/Calme (« MJ ») | **Intermédiaire (+0)** par défaut (exemples du livre). Pas d'arbitrage. |
| « Créature agressive » (déclencheur Taille) | Tout **ennemi en combat** plus grand est agressif → déclenche Peur/Terreur sur le plus petit. |
| Groupes | **Mots-clés multiples** par combattant (`groups: string[]`), **normalisés** (`norm`). Auto-dérivés : `folder` créature → **catégorie** (table : « Les hordes de peaux-vertes » → `Peau-Verte`, « Les morts sans repos » → `Mort-vivant`, « Hommes-bêtes » → `Homme-bête`, « Démons »/« Princes démons » → `Démon`, « ignobles hommes-rats » → `Skaven`, « bêtes »→`Bête`) ; `species` → **racial** (`Humains (Reiklander)` → `Humain`) ; `career` → carrière (Bandit, Noble…) ; **+ extras manuels** (Sigmarite…) via l'éditeur. |
| Traits psy parsés des données | `psychTraitsFromTraits(traits)` (calqué sur `sizeFromTraits`) : « Peur N »/« Terreur N » → `causesPeur`/`causesTerreur` ; « Frénésie » → capacité ; « Animosité/Haine/Préjugé/Amour/Camaraderie (X) » → `PsychTrait{type, cible:X}` ; « Phobie (X) » → Peur 1. |
| « (un au choix) » | Parse en trait à **`cible` indéfinie** → **inerte** (ne déclenche pas) tant qu'une Cible n'est pas assignée (éditeur). Documenté, pas d'invention de cible. |
| « doit attaquer/s'en prendre » | **Contrainte d'action** : IA → cible forcée (le plus proche du groupe) ; héros → restriction d'action + journal. « doit insulter » = **journal** seul. |
| Frénésie volontaire | **Action** ouverte aux combattants ayant la **capacité** Frénésie (trait/talent) — pas auto. |
| Intégration « un jet = une modale » | Tests de Calme/Psy du **héros** = modale (Test étendu pour la Peur) ; IA instantané. Au début du Round. |

## 4. Modèle de données

**`engine/psychology.ts`** (pur) :
```ts
export type PsychType = 'peur'|'terreur'|'frenesie'|'animosite'|'haine'|'prejuge'|'amour'|'camaraderie'|'phobie'|'trauma';
export interface PsychTrait { type: PsychType; cible?: string; indice?: number; }
```
**`engine/types.ts`** — `Combatant` gagne (tous optionnels) :
- `groups?: string[]` — appartenances (matching des Cibles).
- `psychTraits?: PsychTrait[]` — traits **possédés** (Animosité/Haine/Phobie/capacité Frénésie…).
- `causesPeur?: number` / `causesTerreur?: number` — Indice **inspiré** (statbloc).
- `psychImmune?: boolean` — Immunité (Psychologie) (`85` l.143-144).
- `psychState?: PsychAffliction[]` — afflictions ACTIVES (en combat) :
  ```ts
  interface PsychAffliction { type: PsychType; sourceId?: string; cible?: string; calmeDR?: number; tested?: boolean; }
  ```
  `calmeDR` = DR cumulé du Test étendu (Peur) ; `tested` = Test de 1ʳᵉ rencontre (Terreur) déjà fait.

**Dérivation** (`spawn.ts` + `character.ts`, calqué sur la Taille) : `groups` = catégorie(folder) ∪ racial(species) ∪ career ∪ `sb.groups` ; `psychTraits`/`causesPeur`/`causesTerreur` = `psychTraitsFromTraits(traits)` ∪ surcharge statbloc. **Ne pas éditer `creatures.json` à la main** (régénéré).

## 5. Sources de déclenchement (pur : `psychology.ts`)

`pendingPsychTests(self, others, scene): PsychTrigger[]` — pour un combattant, liste les Tests dus ce Round :
- **Taille** : pour chaque ennemi en **Ligne de Vue** plus grand, `gap = sizeGap(foe, self)` → Peur(gap) si gap≥1, **Terreur(gap) si gap≥2** ; sauf `self.psychImmune`.
- **Statbloc** : ennemi en LdV avec `causesPeur`/`causesTerreur` → Peur/Terreur de cet Indice.
- **Ciblés** : `self.psychTraits` dont un membre du groupe `cible` (match `groups`) est en LdV (ennemi pour Animosité/Haine/Préjugé/Phobie ; allié pour Amour/Camaraderie).
- **Dédup** : une source ne génère qu'un test ; Terreur prime Peur de la même source ; trait déjà vaincu/actif non re-testé (sauf Peur étendue non finie).

## 6. Résolution

**Au début de chaque Round** (`combatFlow`, après l'entretien) : pour le combattant actif, on évalue `pendingPsychTests`. **Héros → modale** `pendingPsych` (Lancer → Chance → Appliquer) ; **IA → instantané** (`battleRng`).
- **Peur** : `resolvePeur(calmeValue, indice, prevDR, rng)` → Test de Calme, `calmeDR += DR` ; si `calmeDR ≥ indice` → **vaincue** (retire l'affliction). Sinon Peur persiste. **Test ÉTENDU** = motif `pendingFocus`/reload.
- **Terreur** : `resolveTerreur(calmeValue, indice, rng)` → échec = **Brisé ×(indice + max(0,−DR))**, puis pose une **Peur(indice)** (la Terreur devient Peur).
- **Ciblés** : `resolvePsychTest(calmeValue, rng)` → échec = affliction active.
- **Approche (Peur)** : quand un héros sous Peur tente de s'approcher de la source (déplacement réduisant la distance) → Test de Calme +0 (modale) sinon mouvement refusé ; si la **source** s'approche (fin du tour ennemi) → Calme +0 ou **Brisé** (révélation témoin pour l'IA).
- **Immunité** : `psychImmune`, Frénésie active, Haine(source)→immunité Peur, Amour→immunité Peur en défense : court-circuitent le test.

**Révélation / modale** : héros = modale interactive (avec Chance) ; conséquences subies (Brisé d'une Terreur ratée d'IA, source qui s'approche) = **file de révélation** témoin (réutilise `pendingReveals`).

## 7. Effets par trait (intégration)
- **±1 DR** (Peur −1 vs source ; Haine/Animosité/Amour/Camaraderie +1 vs/pour le groupe) → injectés dans **`attackModifiers`** (env `ModLine`, comme Taille/météo) + dans `skills.ts` pour les tests hors-combat.
- **Brisé / Exténué** → États existants (`conditions.ts`).
- **−20/−10 Soc** → `skills.ts` (test de Sociabilité visant le groupe).
- **Contrainte d'action** « doit attaquer le groupe / le plus proche » : `ai.ts` force la cible ; héros = restriction (UI grise les autres cibles) + journal.
- **Frénésie** : état actif (`frenesyActive`) → +1 BF (caractéristique effective), CC gratuite/round (action bonus IA + bouton héros), immunité psy, fin → Exténué.

## 8. Éditeur
`StatblockEditor` + inspecteur PJ : champs **Groupes** (liste de mots-clés, placeholder = auto-dérivés), **Cause Peur/Terreur** (Indice), **Immunité Psy** (case), **Traits psy** (type + Cible + Indice, dont assignation de Cible pour les « un au choix »).

## 9. Phasage (un spec, implémentation phasée — chaque phase testée TDD, moteur pur)
- **P1 — Peur/Terreur** : modèle (`PsychTrait`, champs Combatant, parsing, groups) + déclenchement **Taille (T5)** + statbloc + **Test étendu de Calme en modale** + Brisé/−1 DR/approche + Immunité. **Débloque T5 ; logiciel utilisable seul.**
- **P2 — Frénésie** : action + état de combat (+1 BF, CC gratuite, attaque obligatoire, Exténué) + IA.
- **P3 — Traits ciblés** : groupes (dérivation complète) + Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie + Tests de Psy + effets combat (+1 DR, immunités, contrainte d'action) + Soc.
- **P4 — Éditeur** : exposition (groups, causesPeur/Terreur, immunité, traits + assignation Cible).

## 10. Plan de tests (TDD)
- `psychology.test.ts` (pur) : `psychTraitsFromTraits` (parse « Peur 4 »/« Terreur 3 »/« Animosité (X) »/« (un au choix) »→inerte) ; `pendingPsychTests` (Taille gap≥1→Peur, ≥2→Terreur ; LdV ; immunité) ; `resolvePeur` (cumul DR jusqu'à Indice) ; `resolveTerreur` (Brisé ×(Indice+|DR−|) puis Peur) ; matching de groupes.
- `combatFlow`/store : Tests de Psy au début du Round (héros modale `pendingPsych`, IA instantané) ; approche sous Peur ; Frénésie (entrée/effets/sortie Exténué) ; contrainte d'action ; `attackModifiers` reçoit ±1 DR ; révélations témoins.
- `spawn`/`character` : dérivation groups + parsing traits + surcharge statbloc.
- Régression : suite verte ; garde-fou « un jet = une modale » couvre les nouveaux Tests (`pendingPsych` whitelisté).

## 11. Isolation session rig
Cœur pur `engine/psychology.ts` (nouveau, à moi). `types.ts`/`combatFlow.ts`/`store.ts`/`ai.ts`/`attackModifiers`/éditeur = partagés → staging sélectif de hunks (cf. `git-commits-propres-wip-parallele`). `creatures.json` **non édité** (parsing). Modales = fichiers neufs.

## 12. Self-review
- **Placeholders** : aucun ; défauts MJ explicités (+0), « un au choix » → inerte documenté.
- **Cohérence** : Test étendu (Peur) = motif existant ; modale héros / instantané IA ; ±1 DR via `attackModifiers` ; Brisé/Exténué = États existants ; garde-fou couvre `pendingPsych`.
- **Périmètre** : phasé, P1 livre T5 seul ; un seul moteur pur partagé par toutes les phases.
- **Frontière** : `psychology.ts` pur (déclenchement + résolution) ; orchestration (Round-start, modales, IA, action-lock) en state.
