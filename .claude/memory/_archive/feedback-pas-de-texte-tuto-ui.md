---
name: feedback-pas-de-texte-tuto-ui
description: "Ne JAMAIS ajouter de texte d'aide/tutoriel dans l'UI (HUD ou écrans) — montrer visuellement ; un état vide = une ACTION, pas un paragraphe."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5ba76351-2538-4cd4-bb04-0ef98de863f1
---

L'utilisateur a viré deux aides le même jour (« 🦶 clic case · ⚔️ clic ennemi » dans la hotbar, « — re-cliquer pour confirmer » dans le badge d'aperçu) : « Vire moi ces aides inutiles » + « C'est une superbe mauvaise habitude de ta part ». Étendu 2026-06-11 (Jalon 9) à TOUTE l'UI : « vire tout commentaire inutile qui prend les joueurs pour des imbéciles. Il vaut mieux montrer de façon visuelle que d'écrire du texte que personne ne lira et alourdit l'affichage ».

**Why:** ces textes encombrent l'UI, cassent l'immersion et infantilisent le joueur ; une UI bien conçue se comprend par ses affordances (surbrillances, chemins, badges d'action, curseurs, placeholders), pas par un mode d'emploi affiché en permanence.

**How to apply:** un badge/label = le NOM de l'action seul (« Charger (+1 Av) ») — jamais une phrase d'instruction. Un ÉTAT VIDE = un bouton d'action directe (« ➕ Créer un personnage »), pas un paragraphe qui explique où aller. La consigne d'un champ va dans son `placeholder` ; l'explication optionnelle dans un `title`. GARDER en revanche les infos de DÉCISION (enjeux d'un choix : bonus PX, prix) et le lore. Purge 2026-06-11 : menu, recruteur, lobby coop, créateur (commit 2bfaba7). À chaque envie d'ajouter « cliquez ici pour… » : ne pas le faire. **2026-06-15 — étendu : JAMAIS de référence au LIVRE dans un texte joueur** (tooltip/titre du type « Parer le tir — Protectrice 2+ (LDB 62 l.307) ») ; et **réutiliser les libellés EXISTANTS** au lieu d'en réinventer un verbeux (mot de l'utilisateur : « évite les références à un livre, ne prends pas les joueurs pour des gogoles, ne réinvente pas la roue »). Les refs LDB restent dans les **commentaires de code** (convention du dépôt), jamais dans l'UI. Prolonge [[feedback-concis-pas-haiku]]. Appliqué par le Jalon 9 (critère « produit final »).
