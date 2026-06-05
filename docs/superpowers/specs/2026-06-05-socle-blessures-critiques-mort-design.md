# Socle combat — Blessures critiques & modèle de mort

- **Date** : 2026-06-05
- **Jalon** : 1 (profondeur du combat) — premier morceau de « compléter le combat » ; **fondation** pour Destin (« éviter la mort ») et Résilience (« choisir la localisation d'un Critique »), traités ensuite.
- **Statut** : design validé, en attente de relecture spec.
- **Principe directeur** : *rien d'inventé* + **pas de MJ** (jeu vidéo) → tout ce que le canon définit est **modélisé** par le moteur. Source : `Source/Warhammer v4 - Livre de base version corrigée/18 - Traumatisme.md` (+ `13 - Combat.md`).

## Contexte & ROADMAP

Le moteur traite aujourd'hui `isOutOfAction = wounds ≤ 0 || Inconscient` (`engine/conditions.ts`) — c'est la règle **« Mort Subite »** simplifiée (option canon réservée aux figurants), **fausse** pour les héros. Le « Détermination → retirer À Terre +1 PB » déjà livré suppose le bon modèle, d'où l'incohérence.

Items ROADMAP traités : **l.117** (« reste : tables de critiques »), **l.134** & **l.254** (« Critiques & Maladresses … laissé au MJ » → **Critiques clos**, **Maladresses = suivi**), **l.22** (déclenchement de la Blessure critique : corrigé en *overkill sur PB courants*). Adjacents hors périmètre : durées d'États en rounds (l.154, Jalon 2).

## Modèle canon (vérifié, avec lignes)

- **0 PB ≠ mort** (`18` l.28) : perdre tous ses PB → État **À Terre** (si absent) ; on ne peut retirer À Terre qu'en regagnant ≥ 1 PB ; non soigné après **(Bonus d'Endurance) Rounds** à 0 PB → **Inconscient** (reste Inconscient jusqu'à regagner ≥ 1 PB). On ne descend jamais sous 0 PB (plancher 0, l.32).
- **Blessure critique** déclenchée par (`18` l.30, l.35 ; `13` l.184) :
  - **Overkill** : dégâts subis > PB **courants** (avant le coup). *(Réconciliation : `13` l.167 dit « > total », `18` l.30/35 dit « > ce qu'il vous reste » avec exemple — on suit le chapitre dédié = **courants**.)*
  - **Coup Critique** : **double réussi** sur un Test de mêlée/tir (déjà `res.critical` partiel).
  - Si l'overkill dépasse le **BE** → **−20** au jet de critique (min 01) (`18` l.30).
- **Table de critique** (`18` l.62-66, l.66+) : pour un Coup Critique, on **ne** prend **pas** la localisation par jet inversé — on lance 1d100 localisation (table p.159) puis 1d100 sur la **table de la localisation**. Perte de PB indiquée **en ignorant BE+PA** (l.62), + États, + parfois **« Mort »** (`00`). Pour un Coup Critique, les Dégâts non-critiques normaux s'appliquent aussi, à la **nouvelle** localisation (l.64).
- **Mort** (`18` l.48-49) : **Inconscient + 0 PB + (nb de Blessures critiques cumulées > Bonus d'Endurance)** → meurt en **fin de Round**, sauf si une critique est guérie. **+** résultats `« Mort »` instantanés (Décapitation/Démembrement/Éventré/Bassin fracassé).
- **Mort Subite** (option, `18` l.51-54) : « dégâts > PB courants → mort ou Inconscient » — réservée aux **figurants** (brigands, animaux), **pas** aux PJ/PNJ importants.
- **Retenir ses coups** (l.46) : on peut déclarer ignorer tout Coup Critique **avant** le jet (hors périmètre v1 — noté).

## Décisions de design

| Sujet | Décision |
|---|---|
| Déclencheur overkill | dégâts subis > PB **courants** (avant application) |
| Réduction massive | overkill > BE → jet de critique −20 (min 01) |
| Double (Coup Critique) | roule la table pour **TOUS** (héros et ennemis) |
| Overkill | **héros/PNJ importants** → table complète ; **ennemis mineurs** → **Mort Subite** (sortie directe) |
| « Mineur » | `usesSuddenDeath(c)` = `c.kind !== 'hero'` (v1) ; flag `important?` futur |
| Tests de Résistance des entrées | **auto-résolus** par le moteur (RNG seedé) — pas de modale |
| Effets long terme (amputation/fracture/déchirure, pénalités permanentes, jours) | **journalisés** (`note`), **non simulés** (→ Jalon 5 méta/soins) |
| `isOutOfAction` | devient **Inconscient ∨ mort** (un combattant à 0 PB **conscient** agit encore, À Terre) |
| Maladresses (combat) | **hors périmètre** (suivi séparé) |

## Architecture (data → moteur pur → store → UI)

### A. Données — `src/data/criticals.ts` (nouveau)
4 tables (`tete`, `bras`, `corps`, `jambe`), **extraites fidèlement** de `18 - Traumatisme.md` via un **workflow d'agents** (lecture des tables, production de JSON structuré, vérification croisée). Schéma par entrée :
```ts
interface CritEntry {
  min: number; max: number;          // bornes du d100 (00 → 100)
  name: string;                      // ex. « Mâchoire fracturée »
  wounds: number;                    // PB perdus (ignore BE+PA) ; 0 si létal
  lethal?: boolean;                  // résultat « Mort » instantané
  conditions?: { name: string; value: number }[]; // États immédiats
  resist?: { difficulty: Difficulty; onFail: { name: string; value: number }[] }; // « réussir ou gagner État »
  note: string;                      // texte canon (amputation/fracture/effets long terme) — journalisé
}
type CritTable = CritEntry[];
```
> Les entrées avec plusieurs États / Tests de Résistance / mentions Amputation-Fracture-Déchirure : `conditions` + (optionnel) `resist` portent l'effet **combat** ; tout le reste (membre perdu, jours de guérison, pénalités permanentes) va dans `note` (journalisé, non simulé).

### B. Moteur pur — `src/engine/critical.ts` (nouveau) + extensions `conditions.ts`
- `rollCritical(location: HitLocation, rng, opts?: { overkill?: number; be?: number }): CriticalResolved` — applique −20 si `overkill > be` (min 1), tire le d100, retourne l'entrée + effets résolus (États à ajouter, issue du Test de Résistance déjà tirée, `lethal`, `woundsLoss`, `note`). **Pur + testé.**
- `critLocationRoll(rng)` — 1d100 → `HitLocation` (réutilise `hitLocation`).
- `engine/conditions.ts` (ou nouveau `engine/death.ts`) :
  - `isOutOfAction(c)` **révisé** → `c.dead || hasCondition(c, 'Inconscient')` (plus `wounds≤0`).
  - `applyZeroWounds(c)` : à 0 PB → ajoute À Terre (si absent), démarre/poursuit `roundsAtZero`.
  - `tickDeath(c)` (appelé en fin de Round) : si 0 PB et non soigné → `roundsAtZero++` ; si `roundsAtZero > BE` → Inconscient ; si Inconscient && 0 PB && `criticalWounds > BE` → `dead = true`. Retourne le journal.
  - `usesSuddenDeath(c)` = `c.kind !== 'hero'`.

### C. Types — `src/engine/types.ts`
`Combatant` : `criticalWounds?: number` (compteur), `roundsAtZero?: number`, `dead?: boolean`, `important?: boolean` (futur, défaut faux).

### D. Store — `src/state/store.ts`
- **Application des Dégâts** (`applyAttackResult`, `applyCast`/`evaluateMissile`-apply, backstab de Fuite) : après la perte de PB, déterminer si un **critique** survient :
  - `double` (Coup Critique) → `rollCritical(critLocationRoll())` (table pour tous) ; appliquer `wounds` (ignore BE+PA, plancher 0) + conditions + résultat resist + `note` au journal ; `criticalWounds++` ; si `lethal` → mort (cf. Destin plus tard).
  - sinon **overkill** (woundsLost > PB courants avant le coup) :
    - cible **mineure** (`usesSuddenDeath`) → Mort Subite : 0 PB + Inconscient (sortie).
    - cible **héros/importante** → `rollCritical(res.location!, { overkill, be })` ; mêmes applications.
  - À 0 PB (sans critique) → `applyZeroWounds` (À Terre).
- **Remplacer** l'ancien `isCritical = … woundsLost > wounds.max` (`engine/combat.ts applyHit`) et le `addCondition(target,'À Terre')` ad hoc (`applyAttackResult`) par le nouveau pipeline.
- **Fin de Round** (`advanceTurn` round-boundary / `endOfRound`) : `tickDeath` pour chaque combattant ; retirer les morts via `isOutOfAction` ; `checkBattleOver` inchangé (s'appuie sur `isOutOfAction`).
- Propager le **nouvel `isOutOfAction`** : `occupied`, ciblage, ordre de tour, `confirmRoundStart`, `runEnemyAI`, `decayEngagement` — vérifier qu'un combattant À Terre à 0 PB **conscient** est toujours un acteur valide (il joue) mais qu'un Inconscient/mort est exclu.

### E. UI — `src/ui/*`
- Pas de nouvelle modale (critiques **auto-résolues**). Le **journal** annonce « Blessure critique — <nom> » + États gagnés + « Mort ! » ; dégâts flottants existants suffisent.
- `BattlePanel`/jetons : afficher l'État À Terre / Inconscient / **Mort** (et le compteur de critiques si utile au débogage).
- `ActionBar` : un combattant à 0 PB conscient garde ses actions ; (le slot **Détermination → retirer À Terre +1 PB** déjà livré devient pleinement cohérent).

## Tests (TDD)

`src/engine/critical.test.ts` :
- `rollCritical` : bornes de table (01-10, 00→Mort), localisation, `−20` si `overkill > be` (min 1), parsing des États/`resist`/`lethal`.
- chaque table a 100 % de couverture de plages (pas de trou de d100).

`src/engine/conditions`/`death` test :
- `isOutOfAction` révisé (0 PB conscient = **actif** ; Inconscient/mort = hors).
- `applyZeroWounds` (À Terre à 0), `tickDeath` (→ Inconscient après BE rounds ; → mort si Inconscient+0PB+crit>BE).

`src/state/store.test.ts` :
- overkill sur un **héros** → critique roulée, États appliqués, `criticalWounds++`, pas mort à 0 PB seul.
- overkill sur un **ennemi mineur** → Mort Subite (out direct).
- **double** sur un ennemi → critique roulée (gore + létalité possible).
- héros à 0 PB → À Terre, joue encore ; après BE rounds → Inconscient ; mort si crit-count > BE en fin de Round.
- résultat **`00`/Mort** → mort immédiate.

## Hors périmètre (→ Jalon 5 / suivis)
- Effets **long terme** : amputations, fractures, déchirures musculaires, guérison sur jours, chirurgie, exposition/faim/noyade (`18` l.292+).
- **Maladresses** de combat (suivi séparé).
- **Destin** (« Comment ça a pu rater ? » / « Meurs un autre jour ») et **Résilience** (« Je ne faillirai pas ! » + choix de localisation de Critique) : **sous-projets suivants** — ce socle expose les **points de branchement** (instant de mort, jet de critique) sans les implémenter.
- « Retenir ses coups » (déclaration avant jet).

## Fichiers touchés (prévision)
- `src/data/criticals.ts` (nouveau, extrait par workflow) + `criticals.test.ts`
- `src/engine/critical.ts` (nouveau) + `critical.test.ts`
- `src/engine/conditions.ts` (ou `death.ts` nouveau) : `isOutOfAction` révisé, `applyZeroWounds`, `tickDeath`, `usesSuddenDeath`
- `src/engine/combat.ts` : retrait du `isCritical = woundsLost > max`
- `src/engine/types.ts` : champs `criticalWounds`/`roundsAtZero`/`dead`/`important`
- `src/state/store.ts` : pipeline de critique dans l'application des Dégâts + `tickDeath` en fin de Round + propagation `isOutOfAction` (+ tests)
- `src/ui/BattlePanel.tsx` / `IsoStage` : affichage À Terre/Inconscient/Mort
- `ROADMAP.md` : cocher Critiques (l.117/l.134/l.254), Maladresses en reste
