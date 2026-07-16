---
name: game-death-critical-model
description: Modèle WFRP4 mort/0 PB/Blessures critiques (LDB 18-Traumatisme) — le code actuel est faux
metadata: 
  node_type: memory
  type: project
  originSessionId: ea0c9f98-e8c2-42bc-8aa3-45c13c76f4d5
---

Modèle canon de la mort/critiques — **Source/Warhammer v4 - Livre de base version corrigée/18 - Traumatisme.md** :

- **0 Blessure ≠ mort.** À 0 PB → État **À Terre** (l.28) ; on ne peut le retirer qu'en regagnant ≥1 PB ; non guéri après **(Bonus d'Endurance) Rounds** à 0 PB → **Inconscient**.
- **Blessure critique** déclenchée par : (a) **overkill** = perdre plus de PB qu'on n'en a *actuellement* (l.30,35) ; (b) **Coup Critique** = double réussi sur un Test de mêlée/tir (Combat l.184). On ne passe jamais en PB négatif (plancher 0, l.32). Overkill > BE → jet de critique **-20** (min 01, l.30).
- **Critique** = jet 1d100 sur la **table de la localisation** (Tête/Bras/Corps/Jambe, l.66+) : perte de PB indiquée (ignore BE+PA), + effets (États : Hémorragique/Sonné/Aveuglé/Assourdi/À Terre/Inconscient/Exténué, Tests de Résistance gating un État, Amputation/Fracture/Déchirure long terme), certains `00` = **Mort** instantanée.
- **Mort** (l.48-49) : Inconscient **+** 0 PB **+** (nombre de Blessures critiques cumulées **> Bonus d'Endurance**) → meurt à la fin du Round sauf si une critique est guérie. + résultats `Mort` instantanés.
- **Mort Subite** (option l.51-54) : raccourci (dégâts > PB courants → mort/Inconscient au choix), réservé aux figurants — c'est ce que fait le code actuel par défaut.

**BUG actuel** : `isOutOfAction = wounds≤0 || Inconscient` (store/conditions) traite 0 PB comme hors de combat/mort = la règle « Mort Subite » simplifiée, **fausse** pour le modèle complet. Le « Détermination → retirer À Terre +1 PB » déjà livré suppose le bon modèle. À corriger : 0 PB → À Terre → (BE rounds) → Inconscient → mort conditionnelle ; brancher les tables de critiques (combat) ; le Destin (« Comment ça a pu rater ? » / « Meurs un autre jour ») se branche à l'instant de mort. Effets long terme (amputations/fractures/chirurgie/guérison sur jours) = chantier méta/soins (Jalon 5), pas le combat. Voir [[game-no-mj-model-everything]] et [[game-roll-modal-pattern]].
