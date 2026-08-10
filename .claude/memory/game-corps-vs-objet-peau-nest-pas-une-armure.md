---
name: game-corps-vs-objet-peau-nest-pas-une-armure
description: "Doctrine — le CORPS d'une créature (peau, écailles, griffes) sort du domaine de l'OBJET : les règles qui nomment « une armure » ou « une lame » ne s'y appliquent pas. Correction utilisateur 2026-08-10, étayée par 3 coutures RAW."
metadata:
  type: project
---

**Correction utilisateur (2026-08-10, verbatim)** : « quand l'Armure parle de peau épaisse,
c'est la peau de l'acteur, pas une armure de peau a ignorer ».

Le RAW l'énonce **deux fois, dans deux traits ADJACENTS et avec la même structure de phrase**
(`Source/Warhammer v4 - Livre de base version corrigée/85 - Traits de créature.md`) :

- l.33 — **Arme (Indice)** : « La créature porte une arme de Corps à corps, **ou** utilise ses
  dents, griffes ou similaires en combat. »
- l.39 — **Armure (Indice)** : « La créature est protégée par une armure **ou** une peau épaisse. »

Deux natures sous un même trait, des deux côtés. **Ce n'est pas une symétrie qu'on plaque sur le
modèle : c'est celle que la source énonce.**

## Les six coutures qui nomment l'objet

Côté armure, chacune verbatim : **Perforante** (`LDB 62 l.270`, « Les PA ne provenant pas de métal
sont ignorés »), **Taille** (`LDB 62 l.307`, « une **pièce d'armure** ou un Bouclier frappé »),
**Déviation Critique** (`LDB 63 l.28`, « un emplacement protégé par **une armure** »). Côté arme :
Piège-lame (« une arme possédant une lame »), désarmement, usure/destruction d'arme.

Aucune ne vise le corps du porteur. Précédent déjà dans le moteur, mais sur UNE seule couture et
pour UN seul cas : `nonDeviatableMutationAP` exclut les Écailles de la Déviation
(`src/engine/items.ts:849`, réf `EDO App.2 l.196`) — à GÉNÉRALISER, jamais à accumuler.

⚠ Côté arme les trois exclusions tombent juste **par accident** : absence de donnée (`bladed`
jamais posé sur une attaque naturelle) et absence de structure (une griffe n'est pas un
`ItemInstance` du loadout). Une griffe-faux authorée `bladed` casserait la règle en silence.

## Modèle cible (chantier #1255)

Ce qui est **manufacturé est un objet** — de vrais `ItemInstance`, armes tenues comme pièces
d'armure, exactement comme un héros ; ce qui est le **corps** ne l'est pas. Le patron existe déjà
et se réutilise : `weaponFromTrait` résout DÉJÀ le catalogue (`catalogItem`, `creatureEquip.ts:75,83`)
en substituant les Dégâts du trait, et `conjuredWeapons.ts` pose un objet réel du catalogue avec
Dégâts surchargés dans l'inventaire + loadout via `recomputeLoadout` — « aucune arme synthétique ».

⚠ **Piège du Bonus de Force** : l'Indice du trait Arme « inclut **déjà** son bonus de Force »
(`LDB 85 l.35`), une arme de catalogue se calcule en `+BF +X` → double-compte si on migre sans
retrancher. ⚠ `recomputeLoadout` n'est JAMAIS appelé sur une créature : la dérivation au spawn est
à câbler. ⚠ Munitions d'une créature à arme de tir : arbitrage de jeu non tranché.

**Bascule GLOBALE d'abord, affinage ensuite** (méthode imposée par l'utilisateur, comme #774) — les
deux découpages existent déjà en donnée : `appearance.armurePortee` (~100 entrées curées) → couche
portée sinon peau ; `TraitInstance.natural`/`naturalWeapon` → corps sinon arme tenue.
⚠ `armurePortee` répond « porté vs corps », **jamais** « quel matériau » — une brigandine de cuir
est portée ET non métallique. Confondre les deux axes est l'erreur que j'ai commise.

## Livré à ce jour

`02f1ad7a` — Perforante juste sur les PA de matériau CONNU (pièces portées typées) ; les PA de
matériau inconnu volontairement INCHANGÉS (abstention, pas arbitrage). 276 des 290 créatures
portant le trait `armure` n'ont aucun matériau en donnée.

Lié : [[game-pa-statblock-apparence-opt-in]] (#774, la curation réutilisée en bascule),
[[feedback-verbatims-utilisateur-confrontes-au-raw]], [[game-doctrine-une-entite-n-livres-n-variantes]].
