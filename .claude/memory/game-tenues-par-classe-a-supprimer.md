---
name: game-tenues-par-classe-a-supprimer
description: Arbitrage user (2026-07-21) — aucune tenue PAR CLASSE (génériques citadins/guerriers/ruraux…) n'existe : seule la tenue « Nue » a un sens, et c'est le repli.
metadata:
  type: project
---

Arbitrage utilisateur (2026-07-21, verbatim) : « les tenus par classes sont immondes et ne devraient pas exister de toute maniere, elles ne servent a rien. » + « Seul la tenue "Nue" a un sens. » → **AUCUNE tenue générique par CLASSE dans `parts/tenues/defs`** (ni citadins, ni guerriers, ruraux, roublards, courtisans, itinerants, riverains, cultiste…), **Citadins compris**. Le SEUL générique légitime = **`Nu`** (le corps de base) : une carrière sans tenue propre porte le corps Nu, jamais une classe.

**Pourquoi ça recoupe le chantier silhouette** [[game-rig-3vues-contrat-prod-chantier]] : la mesure de cohérence de silhouette (`scripts/qc/silhouette-coherence.mts`) a montré que ~14 tenues génériques CLONENT le corps nu (global ≈15,8 %, torse ≈35 %) — elles n'ont pas de torse propre et héritent du défaut du corps de base. Les supprimer VIDE une grande partie de la « cible #1 » (fix du torse de base) au lieu de réparer leur silhouette héritée.

**Défaut de tenue par catégorie (arbitrage user 2026-07-21, « Tu donneras une tenue par defaut sur les races qui n'en ont pas ? ») :** une **RACE** humanoïde sans tenue → recevoir une **tenue par défaut** appropriée (habit civil existant, ex. `villageois`/`bourgeois`, ou selon la race) — JAMAIS le corps nu. Une **CRÉATURE/MONSTRE** sans habit (Zombie, Troll…) → corps nu/écailleux OK (ne porte pas de vêtements). Un id vraiment **INCONNU/absent** hors race → **Nu** (doctrine). `Choses du Bois Mort` (`ruraux`) → re-routé `mendiant` (ex-villageois corrompu en guenilles).

**Chaîne de repli (à ne pas reconstruire)** : `careerClass(key)` renvoie toujours un id de CLASSE (défaut `citadins` pour une clé inconnue — c'est un id neutre, PAS une tenue), et `tenueForClass(classId)` = `CLASS_TENUE_BY_ID[classId] ?? TENUE_NUE` (`src/gameIso/rig/parts/career.ts`) : sans def de classe, le repli est le corps Nu par construction. Garde `src/gameIso/rig/parts/career.test.ts` — « tenueForClass — plus aucune tenue générique de classe : repli Nu (décision utilisateur 2026-07-21) », boucle sur les 8 classes. Ne JAMAIS réintroduire un def de classe « fallback par défaut » : une race/carrière qui doit être habillée reçoit SA tenue (paragraphe précédent).
