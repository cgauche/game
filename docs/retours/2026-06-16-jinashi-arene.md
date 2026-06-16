# Retours playtest — Jinashi — Arène (TEST 1)

> **Source** : `retours_warhammer_tactic_jinashi.odt` (reçu 2026-06-16).
> **Portée du test** : 1 testeur, 1 session, **écran d'amorçage de l'arène uniquement**
> (sélection des pré-tirés → fiches perso → exploration hors combat). **Rien sur le combat.**
> **Ce fichier** = version désambiguïsée + triée des retours bruts, pour traitement item par item.
> Reformulé par Claude ; fidèle à l'intention du testeur (ne pas inventer de besoin nouveau).

**Légende — type** : 🐞 Bug · 🎨 UX/finition · 🧭 Découvrabilité · 🧱 Profondeur de contenu · ⚖️ Décision de design (à trancher avant code)
**Légende — priorité** (évaluation Claude, pas du testeur) : **P1** peu cher + casse la confiance · **P2** valeur élevée · **P3** confort

Format d'un item : `ID` · type · priorité — énoncé clair. *Attendu / Zone / Note* si utile.

---

## A. Bugs — non ambigus, à corriger 🐞

- **B1** · 🐞 · P1 — Le nom de la **race** de chaque perso s'affiche **au pluriel** (« Humains », « Nains »…) sur un individu. *Attendu* : singulier. *Zone* : `PartyScreen.tsx` (libellé race de la mini-fiche).
- **B2** · 🐞 · P1 — La stat d'**encombrement déborde** sur la partie droite de la fiche perso. *Zone* : `CharacterSheet.tsx` (mise en page stats).
- **B3** · 🐞 · P1 — Fiche de Frère Anselm → onglet Sort → clic sur « Bénédiction de Bataille » : **la popup de test s'ouvre derrière la fiche** (z-index / empilement de modales). *Zone* : `modalArbiter.ts` / z-index fiche vs modale de jet.
- **B4** · 🐞 · P2 — Le **râtelier reste surligné** après avoir été utilisé, alors qu'il n'offre plus d'interaction. *Attendu* : retirer le highlight quand l'interaction est épuisée. *Zone* : `IsoStage.tsx` (highlight des props interactifs).
- **B5** · 🐞 · P1 — On peut **placer un perso sur une case occupée** par une barrière ou un feu. *Attendu* : ces cases **bloquent** le déplacement. *Zone* : walkability — `walls.ts` / `effectZones.occupied()` (à confirmer). **Le plus important des 5 bugs.**

---

## B. Découvrabilité / infobulles — UN seul système à brancher 🧭

> Fil dominant des retours. La primitive popover **`CodexRef`** existe déjà et est censée être montée
> un peu partout → ici c'est **brancher l'existant aux endroits manquants**, pas créer un système.

- **D1** · 🧭 · P2 — Les **Talents** doivent ouvrir leur **description** (popup au clic ou infobulle au survol), **partout** : mini-fiche de sélection ET fiche perso complète. *Note testeur* : si infobulle, l'afficher quasi au survol mais vérifier qu'elle ne gêne pas le curseur.
- **D2** · 🧭 · P2 — Infobulle sur les **règles nommées** : **Destin**, **Résilience**, et aussi **Chance** + **Détermination**. *Note* : Chance/Détermination **existent déjà dans le moteur** (réservoirs dépensables rechargés depuis Destin/Résilience) — c'est un **manque d'affichage**, pas une feature manquante ; montrer le pool courant à côté du plafond.
- **D3** · 🧭 · P3 (option) — Étendre les infobulles aux **compétences** et **caractéristiques**.
- **D4** · 🧭 · P2 — Vraie **description des « currencies »** Chance / Détermination / Destin / Résilience (texte de règle accessible). Recoupe D2.

---

## C. Lisibilité de l'équipement porté — consolidé 🎨 / ⚖️

> ⚠️ **Désambiguïsation clé** : le testeur écrit « Portée » au sens **porté / équipé sur soi**,
> PAS la distance d'une arme. Ses 3 remarques (armes équipées / vêtements / sets) sont **un seul sujet** :
> *« la fiche ne montre pas clairement ce qui est porté/équipé en ce moment. »*

- **E1** · 🎨 · P2 — Marqueur **« Équipé / Porté » uniforme** sur **tout** objet équipable (arme, armure, **et** vêtement/robe/bottes). *Constat testeur* : incohérent aujourd'hui — il faut soit marquer tout, soit rien. *Zone* : `EquipmentPanel.tsx` / onglet Sac de `CharacterSheet.tsx`.
- **E2** · ⚖️→✅ · P2 — **DÉCIDÉ** : présentation par défaut = **« Main principale » / « Main secondaire »** (une droplist chacune). Le système de **sets/loadouts** est conservé mais **repoussé en fonction avancée** (repliée). *Zone* : `EquipmentPanel.tsx`.
- **E3** · 🎨 · P3 — **Sous-catégories** dans l'onglet « Sac » pour trier l'équipement par catégorie.
- **E4** · ⚖️→✅ · P3 — **DÉCIDÉ** : « **Donner** » un objet = **icône « Donner » + droplist** (nom + portrait), au lieu de la rangée de portraits. *Zone* : onglet Sac de `CharacterSheet.tsx`.

---

## D. Profondeur de la fiche perso 🧱

- **F1** · 🧱 · P2 — **Cliquer le portrait** d'un perso ouvre sa **fiche complète** avec un **résumé de background**.
- **F2** · 🎨 · P2 — Pouvoir **modifier** un perso sélectionné **sans avoir à le retirer** d'abord (bouton « Modifier »). *Zone* : `PartyScreen.tsx`.
- **F3** · 🧱 · P3 — Onglet **Background**, avec éventuellement une **section éditable** (hauts-faits).
- **F4** · 🧱 · P2 — Afficher l'**équipement** dès la **mini-fiche de stats** de l'étape de sélection.
- **F5** · 🎨 · P2 — Afficher la **valeur calculée entre parenthèses** : ex. « Arme simple BF+4 » → montrer le BF du perso, p. ex. « BF+4 (BF 3) ». **Généraliser à tous les formats de ce type** (BF, BE, etc.). *Aligné avec le principe maison « valeur affichée toujours avec son label/valeur ».*

---

## E. Mise en page / stabilité 🎨

- **L1** · 🎨 · P1 — Les onglets de la fiche perso **ne doivent pas changer la hauteur** de la fenêtre → utiliser des **scrollbars** quand nécessaire. *Zone* : `CharacterSheet.tsx` (conteneur à hauteur fixe + scroll interne).
- **L2** · 🎨 · P2 — Quand on **retire un perso**, l'emplacement libéré **reste à sa place** au lieu de se réordonner tout à droite. *Zone* : `PartyScreen.tsx`.
- **L3** · 🎨 · P2 — Bouton **« Commencer »** placé **en bas des fiches et centré** (plus visible). *Zone* : `PartyScreen.tsx`.

---

## F. Affordance du monde hors combat 🎨

- **M1** · 🎨 · P2 — Indiquer le **chemin (path) au survol** des cases **hors combat**, comme en combat. *Zone* : `IsoStage.tsx` (preview de déplacement hors `battle`).
- **M2** · 🎨 · P2 — **Surligner les éléments interactifs au survol** du curseur. *Zone* : `IsoStage.tsx`.

---

## G. Amorçage narratif ⚖️

- **N1** · ⚖️→✅ · P2 — **DÉCIDÉ** : l'entrée dans une zone affiche une **modale d'intro** (skippable), **pas** un encart dans le Journal.
  **Principe de fond (confirmé par l'auteur)** : *le Journal n'est pas lu — on fait systématiquement remonter en MODALE les éléments importants.* Déjà appliqué aux **objets interactifs** et aux **dialogues** ; l'**entrée de zone** est la suite logique. Garde-fou maison : intro **narrative** skippable, pas du texte tuto.

---

## H. Positif — à préserver ✅

- **P1** — Équiper un objet (la **cape de l'elfe**) **se voit immédiatement sur le portrait**. ✅ Comportement apprécié.

---

## Décisions prises (2026-06-16)

| ID | Sujet | Décision |
|----|-------|----------|
| **E2** | Mains / sets | **Main principale / secondaire** par défaut ; sets/loadouts repoussés en fonction avancée. |
| **N1** | Entrée de zone | **Modale d'intro** skippable (pas le Journal). Principe : le Journal n'est pas lu → tout l'important remonte en modale. |
| **E4** | Donner un objet | **Icône « Donner » + droplist** (nom + portrait). |

## Ordre d'attaque suggéré (Claude)

1. **Bugs P1** (B1, B2, B3, B5, L1) — cheap, restaurent la confiance.
2. **Découvrabilité** (D1, D2, D4) — brancher `CodexRef`/infobulles, fort ROI.
3. **Lisibilité équipement** (E1) + décision E2.
4. **Profondeur fiche** (F1, F4, F5, F2) + affordance monde (B4, M1, M2).
5. **Confort / décisions restantes** (E3, F3, D3, E4, N1, L2, L3).
