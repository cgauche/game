---
name: game-peur-deux-portes-trait-strict-taille-agressive
description: "Lecture RAW de la Peur (2026-08-10, #1202) : la Peur de TRAIT (surnaturelle) s'applique à toutes les « autres créatures » — invocateur/contrôleur compris, par rencontre — CE N'EST PAS UN ARBITRAGE, c'est le texte ; la Peur de TAILLE est portée par « considérée comme AGRESSIVE » (envers la cible). Jamais un filtre par camp, jamais un tag d'arbitrage dans le code."
metadata: 
  node_type: memory
  type: project
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-10T06:50:50.087Z
---

**Rectificatif utilisateur (2026-08-10, verbatim) : « ce n'est pas "mon arbitrage" et je ne veux pas le voir dans le code. C'est le RAW »** — la Peur de trait qui s'applique à l'invocateur n'est PAS une décision de table : c'est le texte, et il se câble avec sa réf NUE, sans aucun marqueur d'arbitrage/décision en commentaire (poison famille 4). J'avais posé une AskUserQuestion à options (strict/maison) : c'était mettre en scène un choix là où le livre avait tranché — précédent versé à [[feedback-ne-pas-faire-arbitrer-un-fait]]. Le débat de forum (nécromancien effrayé par ses squelettes) se règle par la LECTURE, pas par un vote : rien dans le texte n'exempte l'invocateur, et la soupape prévue par le livre est le talent Sans peur (UN Test de Calme Accessible +20 pour ignorer Intimidation/Peur/Terreur de l'ennemi spécifié — « Sans peur (Tout) » existe au corpus, statblocks de Tueurs MDG ; déjà fidèle au moteur via `sansPeurVs`, jamais une immunité sèche).

Les DEUX sources de Peur n'ont PAS la même porte (relu au Source, 2026-08-10) :
1. **Trait** (statbloc, LDB 85 l.264-266) : « engendre de la *Peur* surnaturelle chez **les autres créatures** » — AUCUN qualificatif de camp/contrôle. S'applique à tous, invocateur compris ; seule exclusion : soi-même. Rejouée PAR RENCONTRE (chapeau LDB 21 : succès « annulés jusqu'à la fin de la rencontre »).
2. **Taille** (LDB 85 l.381-383, réf re-mesurée — l'ancienne « l.317-318 » était une dérive pré-Marker) : « **Si la créature est considérée comme agressive**, elle provoquera la *Peur* chez toute créature plus petite… Terreur si ≥2 catégories, niveau = l'écart » — l'agressivité se lit ENVERS la cible (échange 2026-08-10 : la Frénésie ne vise que les ennemis, un allié frénétique n'effraie pas les siens — verbatim : « ou alors tu veux que les ogres frénétiques fasse peur a ses alliés ... ») : camp adverse en combat = agressif par défaut ; un allié ne l'est QUE s'il t'attaque effectivement (dominé/charmé/retourné). Prédicat comportemental explicite, JAMAIS un branchement par camp nu. (L'immunité de Frénésie protège le frénétique LUI-MÊME, pas les autres de lui.)

Rappels de cadence (même fil) : **Terreur** = un Test à la PREMIÈRE rencontre seulement (puis héritage Peur à plein Indice, cf. #1190) ; **Peur** = Test étendu de Calme par Round, victoire bornée à la rencontre.

**Why:** le moteur filtrait par camp (proxy silencieux) — le RAW distingue en fait deux portes, aucune n'étant le camp.

**How to apply:** en traitant #1202 — retirer les filtres par camp du chemin Peur de TRAIT ; construire le prédicat « agressif envers la cible » pour la Peur de TAILLE ; le code ne porte que des réfs nues. Tests : nécromancien teste contre ses squelettes à chaque rencontre ; cheval allié calme → rien ; ogre allié frénétique → rien pour ses alliés ; allié dominé qui t'attaque → sa Taille te fait tester. Cf. [[feedback-jamais-de-branchement-par-id]], [[feedback-ne-pas-faire-arbitrer-un-fait]], [[game-psychology-subsystem]].
