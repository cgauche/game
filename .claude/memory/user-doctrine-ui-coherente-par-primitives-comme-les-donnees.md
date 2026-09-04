---
name: user-doctrine-ui-coherente-par-primitives-comme-les-donnees
description: "Doctrine utilisateur 2026-09-04 : « N'oublie pas les concepts liés à l'UI et les primitives. Le but est toujours d'avoir une interface cohérente dans toute l'application, comme on fait avec notre structure de donnée. » — un concept d'interface = UNE primitive (table « Primitives partagées », charte UI), même rigueur d'inventaire, de convergence et de cliquet que #1463 pour les structures de données ; tout écran touché se compose des primitives et s'audite contre elles"
metadata:
  type: user
---

**Verbatim (2026-09-04, pendant #1657 B3-2b — écran « Stations à bord », 2 verbatims)** : « N'oublie pas les concepts lié a l'UI et les primitives. Le but est toujours d'avoir une interface cohérente dans toute l'application, comme on fait avec notre structure de donnée. »

**Verbatim 2 (2026-09-04, même échange)** : « C'est important car comme cela, si on doit modifier l'interface, on n'a juste qu'a toucher aux primitives plutot que partir a la chasse de tous les écrans de l'application » — le critère est celui de la forme canonique des jets ([[user-doctrine-forme-canonique-unique-jets]] : « je n'ai qu'un seul et unique endroit a modifier ») : une évolution d'interface = UN geste dans la primitive, jamais une chasse aux écrans. Corollaire de test : « si demain on change ce concept, combien de fichiers bougent ? » — la bonne réponse est UN.

**Why :** l'épic #1463 mutualise les structures de données qui ont divergé « par manque de rigueur » ([[feedback-finalite-1463-mutualiser-les-divergences]]) ; l'interface a la même maladie (classes mono-écran, markup recodé, Nᵉ modale) et le même remède : un concept = une primitive, un inventaire par concept, une convergence mesurée, un cliquet qui ne remonte pas ([[feedback-composer-primitives-jamais-markup-brut]], [[feedback-classes-mono-ecran-excuse-derive]], [[feedback-ecran-touche-audit-primitives]], [[user-doctrine-reference-rt-par-defaut-deviation-validee]]).

**How to apply :**
1. Tout brief d'écran nomme les PRIMITIVES cibles (table « Primitives partagées » de CLAUDE.md, `docs/charte-ui.md`, `docs/usages-jets.md`) AVANT le code ; un concept sans primitive = on l'extrait de l'étalon existant, jamais une copie locale.
2. Le juge de diff d'un écran juge avec la lentille « primitives vs scopes » : markup recodé, classe mono-écran, `select` brut, `<input>` nu, lien Codex hors `CodexRef` = bloquant.
3. Un écran touché s'audite en entier contre les primitives (pas seulement la ligne modifiée) et ses écarts vont à l'inventaire de la vague ; les cliquets `ui-ratchets` décroissent.
4. Même patron d'inventaire que #1673 pour l'UI : un juge lecture seule par CONCEPT d'interface (roster, sélecteur borné, bande titrée, renvoi Codex, jauge…) → familles divergentes → fusions par primitive — à proposer comme vague de #1463 ou d'un épic frère, sur validation DIRECTE.
