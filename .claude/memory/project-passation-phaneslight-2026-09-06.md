---
name: project-passation-phaneslight-2026-09-06
description: "PASSATION session game-30 (2026-09-06) : essai PhanesLight (bootstrap, rejeu jugé INFÉRIEUR, 3 défauts d'outil), branche d'essai et branche de correctifs, vision produit en brouillon à valider, 2 fiches retirées, garde rm en worktree, ticket A/B #1700 pour une session neuve — où est chaque chose et ce qui reste dû"
metadata: 
  node_type: memory
  type: project
  originSessionId: 38e07ce9-7b94-4745-8f0e-818da2bd6d21
  modified: 2026-09-06T19:52:15.866Z
---

**État au 2026-09-06 soir, session game-30 (Fable, orchestratrice).** Tout ce qui suit est SUR DISQUE ou COMMITTÉ ; rien ne vit dans le contexte de la session.

**Décisions utilisateur du jour (verbatims dans [[user-vision-produit-trois-etages-2026-09-06]])** : vision produit à trois étages comme NWN, quatre profils, le scénario CONTIENT (pas d'interrupteur de module), le siège du monde voit/fixe/pilote les adversaires, VO à venir, trois vues égales ; règle d'écriture « on ne parle pas à la négative » ; « épic jamais fermé sur tickets ouverts » est un garde-fou réactif à restreindre aux livrables ; les deux fiches `user-passage-fable-derives-opus` et `user-regime-une-session-par-chantier-2026-09-01` sont PÉRIMÉES et retirées.

**Branches et worktrees** :
- `C:/Users/gauch/PhpstormProjects/Foundry/Game-garde-rm`, branche `fix/garde-rm-worktree` (base 6a30233aa) : `43f6e8d8e` garde git destructif silencieux pour un `rm -r` DANS un worktree lié prouvé ; `c6ddd33c6` retrait des 2 fiches + index + liens + doctrines régénérées ; `0f1569e91`, `d4600cbc7`, `d4719afe2` = `docs/vision.md` BROUILLON à valider par l'utilisateur, NE PAS pousser avant. La session `audit-drift-project-plan` (#1679) emporte les DEUX premiers par cherry-pick dans son train C1 (gates + push), sha promis au push. Si elle ne l'a pas fait : `npm run gates` puis push de la branche, ou cherry-pick sur main.
- `C:/Users/gauch/PhpstormProjects/Foundry/Game-phaneslight`, branche `essai/phaneslight-rejeu` (base ca82bcec0) : bootstrap PhanesLight v3.7.2 (`3c4316d1b`), parité Codex (`6293ee999`), garde rm (`c93953263`), protocole (`8b01cd934`), puis les commits de la session de rejeu `game-phaneslight-f7` (`72de1480b` correctif, `2e124f391`, `8b447d8d4`, `7adc4432f`). Branche JETABLE. 9 CLAUDE.md de module + `.phaneslight/registry/` non suivis sur le disque. Bootstrap : 16,74 $, 41 min.
- `C:/Users/gauch/PhpstormProjects/Foundry/Game-phaneslight-plugin` : clone du plugin (HORS dépôt) + `etude/` : 14 dossiers d'éléments, `SYNTHESE.md`, `vision-confrontation.md`, `vision-jugement.md`, `rejeu-jugement-diff.md`, sondes ; scripts `sonde.mjs` (transcript → tokens, SURCOMPTE ~2,5× le cache), `journal-verdicts.mjs`, `memoire-audit.mjs`, `sessions.mjs` ; fichiers de messages de commit.
- Worktrees d'essai à supprimer quand l'utilisateur tranche : `Game-phaneslight`, `Game-garde-rm` (après push), le clone du plugin.

**Verdicts rendus** : rejeu `ee9608ead` par PhanesLight = INFÉRIEUR à l'étalon (2 sites manqués/6, test qui accepte un `maison` sans réf, poison 6a re-signé ; apport : commentaire de contrat `structures.ts`) ; 3 défauts d'outil (retours persistés salissent l'arbre → gates refusées ; registre d'API 2,7 Mo sans politique ; `cli.js` CommonJS → lint rouge → 15/22 gates sautées) + PhanesLight n'a AUCUNE définition ni porte du « plan » (il a pris ma trouvaille pour un plan). Étude des 14 éléments : garder RTK ; emprunter jscpd et une sonde d'adhérence maison ; essais bornés possibles context7/deepwiki/claude-hud ; écarter uv/serena/Phanes/Philia/cclint. Recommandation posée : ne pas adopter tel quel, prendre revue de plan, divulgation des éditions, retours persistés, rétractation sur disque.

**Reste dû** :
- #1700 (ouvert ce soir) : comparaison A/B sur #1650, PhanesLight vs régime actuel, juge aveugle — pour une session NEUVE, protocole auto-suffisant dans le ticket.
- `docs/vision.md` : relecture et corrections utilisateur, puis commit sur main ; ensuite remplacer le paragraphe « Ce qu'est ce projet » du CLAUDE.md (2026-06-04, FAUX) par un renvoi ; réécrire la consigne « jamais la VO » quand la VO entre.
- Vague de nettoyage mémoire (383 fiches, 1,3 Mo, 44 orphelines, 17 réfs mortes, index MEMORY.md à 20 Ko édité à la main sans pilote de fusion) : règle par famille posée en conversation — `user` validées une à une par l'utilisateur, `feedback` → credo ou garde ou suppression, `env` re-sondées, `project`/`game` → archive à la fermeture du chantier ; MEMORY.md à GÉNÉRER depuis le frontmatter (pilote `merge=docs-generes` existant). Credo : garder les 8 principes, transformer les 13 règles de procédure en portes. CLAUDE.md : 41 Ko de catalogues sur 52 à sortir en docs générés.
- Défaut de l'étalon signalé à `game-0f` (#1680) : `structures.ts:70` « ne peut citer aucun folio » contredit le test qui exige une réf ; paraphrases étirées LDB 14 l.86 / LDB 85 l.329 dans les `maison` de `structures.json`.
- `.claude/soldes/revue-palier-2026-09-05-f0f9436f5.md` cite encore la fiche du régime supprimée (archive datée, hors garde).
- Run de workflow `wf_c771f87b-a5c` en pause FANTÔME du harnais (tâche absente de /tasks, reprise refusée) ; ses résultats sont sur disque, rien à récupérer.
- `lean-ctx allow claude` ajouté à la config utilisateur (`C:/Users/gauch/.config/lean-ctx/config.toml`) pour lancer le CLI ; à garder ou retirer.
