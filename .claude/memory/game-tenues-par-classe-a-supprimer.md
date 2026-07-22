---
name: game-tenues-par-classe-a-supprimer
description: Arbitrage user (2026-07-21) — les tenues PAR CLASSE (génériques citadins/guerriers/ruraux…) sont à SUPPRIMER (immondes, inutiles) ; vérifier la chaîne de fallback avant.
metadata:
  type: project
---

Arbitrage utilisateur (2026-07-21, verbatim) : « les tenus par classes sont immondes et ne devraient pas exister de toute maniere, elles ne servent a rien. » + « Seul la tenue "Nue" a un sens. » → **SUPPRIMER TOUTES les tenues génériques par CLASSE** (citadins, guerriers, ruraux, roublards, courtisans, itinerants, riverains, cultiste… — le peloton `parts/tenues/defs`), **Citadins COMPRIS** (bien qu'il soit le fallback par défaut actuel). Le SEUL générique légitime = **`Nu`** (le corps de base). Le fallback d'une carrière sans tenue propre devient donc **Nu**, plus une classe.

**Pourquoi ça recoupe le chantier silhouette** [[game-rig-3vues-contrat-prod-chantier]] : la mesure de cohérence de silhouette (`scripts/qc/silhouette-coherence.mts`) a montré que ~14 tenues génériques CLONENT le corps nu (global ≈15,8 %, torse ≈35 %) — elles n'ont pas de torse propre et héritent du défaut du corps de base. Les supprimer VIDE une grande partie de la « cible #1 » (fix du torse de base) au lieu de réparer leur silhouette héritée.

**Défaut de tenue par catégorie (arbitrage user 2026-07-21, « Tu donneras une tenue par defaut sur les races qui n'en ont pas ? ») :** une **RACE** humanoïde sans tenue → recevoir une **tenue par défaut** appropriée (habit civil existant, ex. `villageois`/`bourgeois`, ou selon la race) — JAMAIS le corps nu. Une **CRÉATURE/MONSTRE** sans habit (Zombie, Troll…) → corps nu/écailleux OK (ne porte pas de vêtements). Un id vraiment **INCONNU/absent** hors race → **Nu** (doctrine). `Choses du Bois Mort` (`ruraux`) → re-routé `mendiant` (ex-villageois corrompu en guenilles).

**⚠ Dépendance à vérifier AVANT suppression** : `Citadins.ts` est le **FALLBACK PAR DÉFAUT** (`careerTenue` renvoie Citadins si la classe est inconnue ; commentaire du def : « ne pas renommer/supprimer »). Donc : recenser quelles CARRIÈRES n'ont pas de tenue propre et retomberaient sur une classe supprimée → décider ce qu'elles portent (garder un fallback minimal unique ? tenue de carrière obligatoire ?). Ne PAS supprimer à l'aveugle (casserait `careerTenue` / laisserait des persos sans habit). Grounding lancé 2026-07-21.
