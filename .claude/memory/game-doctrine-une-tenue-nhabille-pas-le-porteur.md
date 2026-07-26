---
name: game-doctrine-une-tenue-nhabille-pas-le-porteur
description: "DOCTRINE 2026-07-18 : une tenue HABILLE, elle ne REPEINT PAS son porteur — la chair (@peau*) et la chevelure (@cheveux*) appartiennent au personnage, jamais au vêtement. Classe fermée sur les deux."
metadata: 
  node_type: memory
  type: project
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

**Trouvé par l'utilisateur (2026-07-18)** en regardant une planche : « tes prolongement de bras vers la main, il utilise quel couleur pour représenter la peau ? Celui utilisé pour l'ensemble de corps ? ». Réponse mesurée : **non, et c'était incohérent** — trois pratiques coexistaient (jeton `@peau` correct, gradient `g_flesh` FIXE, littéraux hex en dur).

## Le principe

**Une tenue habille, elle ne repeint pas son porteur.** La chair ET la chevelure appartiennent au PERSONNAGE (espèce ∪ personnalisation), jamais au vêtement. Un vêtement déclare son cuir, son acier, son tissu — un littéral y est légitime, c'est SA couleur. Il ne déclare jamais `peau`/`peauO`/`peauH` ni `cheveux`/`cheveuxO`/`cheveuxH`.

⚠ **La distinction que les docs ne faisaient pas** : `PART-CONTRACT.md` listait `g_flesh` parmi les ressources offertes puis disait « **Sinon couleurs hex** » — il **prescrivait** l'erreur. `docs/creer-une-creature.md` connaissait les jetons mais se taisait sur l'interdit. L'ÉTALON (`Chevalier-du-loup-blanc.ts`, le seul fichier que les artistes lisent vraiment) était **muet sur la chair**. Le skill aussi.

## Ce qui a été livré

- **Défense structurelle** : `rigStoredPalette` (`parts/career.ts`) **strippe** les jetons du PORTEUR (`stripPorterTokens`, liste `PORTER_TOKENS`) de la palette de tenue avant l'empilage — même une tenue fautive ne peut plus écraser la peau ni la chevelure du porteur. La cause racine : un empilage `{ ...species, ...tenuePaletteFor(tenue) }` laisse la tenue écraser l'espèce.
- **17 tenues purgées** (16 à clé quotée + `Chansonnier` à clé NON quotée — le grep textuel l'avait ratée : énumérer les CLÉS réelles, pas grepper le texte).
- **`g_flesh` dérivé** : `fleshGradientId`/`fleshGradientDefs` (`palette.ts`) fabriquent le dégradé PAR PERSONNAGE ; `composeRig` injecte un `<defs>` local et réécrit la référence — **aucune tenue touchée**, les 44 occurrences corrigées d'un coup.
- **Gardes** : `peau*` interdit dans `TenueDef.palette` ; `g_flesh` interdit dans un def (cliquet 44) ; littéral == jeton du MÊME fichier (cliquet, grain `id:slot:vue#n`).
- **Preuve, comptage du 2026-07-18** : 21 espèces × 117 tenues × 3 vues = **7371 rendus**, chemin réel, sans forcer `appearance.colors` → 0 `g_flesh` résiduel, gradient dérivant bien de l'espèce (Skaven `#8c7f6c`, Orc `#6a9a48`) au dos comme de face. Re-comptage du 2026-07-26 : **109 defs** sous `src/gameIso/rig/parts/tenues/defs/`. **Total à REJOUER** avant de s'y appuyer (le parc bouge).

## Le flanc JUMEAU — les cheveux — relève de la même défense

`PORTER_TOKENS` couvre la chair ET la chevelure (`peau`/`peauO`/`peauH`, `cheveux`/`cheveuxO`/`cheveuxH`, #583 puis #599) : `stripPorterTokens` les retire tous de la palette de tenue. Le cas qui l'a prouvé : un Vampire aux cheveux `#161214` recevant `#aebfce` de la palette `Nonne` — jusqu'à **296 RGB** d'écart.
⚠ **Un jeton de porteur dans une palette n'est pas toujours un défaut** : `nonne` emploie `@cheveux` sur son `torse` → c'est une **guimpe**, un jeton réutilisé pour une autre matière (même classe de faux positif que la plume de `Bailli`). Compter les clés `cheveux*` SUR-annonce donc les défauts : instruire tenue par tenue.

## How to apply

- Avant d'ouvrir un slot ou un champ à l'authoring, demander **« à qui appartient cette propriété ? »** — au personnage ou au vêtement. Tout ce qui appartient au personnage se strippe défensivement des palettes d'habillage.
- **Fermer une classe en révèle souvent la jumelle** : chair → cheveux ici. Chercher systématiquement l'intersection des clés de palette TENUE × ESPÈCE — c'est elle qui liste les propriétés du porteur qu'un vêtement peut usurper.
- Un littéral qui vaut EXACTEMENT un jeton déclaré dans le même fichier est **toujours** une faute (peau, plume ou cuir : ça devait être le jeton) — c'est la seule sous-classe gardable sans faux positif ; un seuil colorimétrique APPROCHÉ donne 1 faux positif sur 3.

Lié : [[feedback-preuve-mesuree-sur-le-chemin-reel]] (le 1er fix de cette classe a été rendu FAUX par une preuve mesurée sur un chemin optionnel), [[game-ids-internes-libelles-display-multilangue]], [[game-rig-socle-audit-2026-07-16]], [[user-barre-art-relevee-2026-07-16]].
