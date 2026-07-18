---
name: game-doctrine-une-tenue-nhabille-pas-le-porteur
description: "DOCTRINE 2026-07-18 : une tenue HABILLE, elle ne REPEINT PAS son porteur — la chair (@peau*) appartient au personnage, jamais au vêtement. Classe fermée sur la peau ; flanc jumeau ouvert sur les cheveux."
metadata: 
  node_type: memory
  type: project
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

**Trouvé par l'utilisateur (2026-07-18)** en regardant une planche : « tes prolongement de bras vers la main, il utilise quel couleur pour représenter la peau ? Celui utilisé pour l'ensemble de corps ? ». Réponse mesurée : **non, et c'était incohérent** — trois pratiques coexistaient (jeton `@peau` correct, gradient `g_flesh` FIXE, littéraux hex en dur).

## Le principe

**Une tenue habille, elle ne repeint pas son porteur.** La chair appartient au PERSONNAGE (espèce ∪ personnalisation), jamais au vêtement. Un vêtement déclare son cuir, son acier, son tissu — un littéral y est légitime, c'est SA couleur. Il ne déclare jamais `peau`/`peauO`/`peauH`.

⚠ **La distinction que les docs ne faisaient pas** : `PART-CONTRACT.md` listait `g_flesh` parmi les ressources offertes puis disait « **Sinon couleurs hex** » — il **prescrivait** l'erreur. `docs/creer-une-creature.md` connaissait les jetons mais se taisait sur l'interdit. L'ÉTALON (`Chevalier-du-loup-blanc.ts`, le seul fichier que les artistes lisent vraiment) était **muet sur la chair**. Le skill aussi.

## Ce qui a été livré

- **Défense structurelle** : `rigStoredPalette` (`parts/career.ts`) **strippe** `peau*` de la palette de tenue avant l'empilage — même une tenue fautive ne peut plus écraser la peau du porteur. La cause racine était `{ ...species, ...tenuePaletteFor(tenue) }` : la tenue écrasait l'espèce.
- **17 tenues purgées** (16 à clé quotée + `Chansonnier` à clé NON quotée — le grep textuel l'avait ratée : énumérer les CLÉS réelles, pas grepper le texte).
- **`g_flesh` dérivé** : `fleshGradientId`/`fleshGradientDefs` (`palette.ts`) fabriquent le dégradé PAR PERSONNAGE ; `composeRig` injecte un `<defs>` local et réécrit la référence — **aucune tenue touchée**, les 44 occurrences corrigées d'un coup.
- **Gardes** : `peau*` interdit dans `TenueDef.palette` ; `g_flesh` interdit dans un def (cliquet 44) ; littéral == jeton du MÊME fichier (cliquet, grain `id:slot:vue#n`).
- **Preuve** : 21 espèces × 117 tenues × 3 vues = **7371 rendus**, chemin réel, sans forcer `appearance.colors` → 0 `g_flesh` résiduel, gradient dérivant bien de l'espèce (Skaven `#8c7f6c`, Orc `#6a9a48`) au dos comme de face.

## Flanc JUMEAU encore OUVERT — les cheveux

`stripFlesh` ne strippe que la chair. **Des tenues repeignent les cheveux de leur porteur** : `Contrebandier`, `Juriste`, `Nonne`, `Officier` (10 clés `cheveux*` mesurées ; un juge en compte 7 tenues — l'écart vient du format des palettes, à établir). Écart jusqu'à **296 RGB** (un Vampire portant `nonne` : cheveux noirs `#161214` rendus `#aebfce`).
⚠ **Pas 7 défauts prouvés** : `nonne` emploie `@cheveux` sur son `torse` aussi → c'est une **guimpe**, un jeton réutilisé pour une autre matière (même classe de faux positif que la plume de `Bailli`). À instruire tenue par tenue.

## How to apply

- Avant d'ouvrir un slot ou un champ à l'authoring, demander **« à qui appartient cette propriété ? »** — au personnage ou au vêtement. Tout ce qui appartient au personnage se strippe défensivement des palettes d'habillage.
- **Fermer une classe en révèle souvent la jumelle** : chair → cheveux ici. Chercher systématiquement l'intersection des clés de palette TENUE × ESPÈCE — c'est elle qui liste les propriétés du porteur qu'un vêtement peut usurper.
- Un littéral qui vaut EXACTEMENT un jeton déclaré dans le même fichier est **toujours** une faute (peau, plume ou cuir : ça devait être le jeton) — c'est la seule sous-classe gardable sans faux positif ; un seuil colorimétrique APPROCHÉ donne 1 faux positif sur 3.

Lié : [[feedback-preuve-mesuree-sur-le-chemin-reel]] (le 1er fix de cette classe a été rendu FAUX par une preuve mesurée sur un chemin optionnel), [[game-ids-internes-libelles-display-multilangue]], [[game-rig-socle-audit-2026-07-16]], [[user-barre-art-relevee-2026-07-16]].
