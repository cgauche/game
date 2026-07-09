# Charte UI — référence vivante

> À lire avant de créer ou retoucher un écran (CSS, densité, responsive). Complète la règle
> stricte 4 du `CLAUDE.md` (responsive, breakpoints canon) et la table « Primitives partagées ».

## Architecture CSS

- **Couleurs UNIQUEMENT dans les tokens `:root`** (`src/ui/styles/base.css`) — jamais de hex en
  dur dans une classe. Palette : `--bg`, `--accent`/`--accent2` (rouge sang, action primaire),
  `--gold`/`--gold2` (bordures/focus/accents dorés), `--ok`/`--ok-bright` (succès),
  `--danger`/`--danger-soft` (alerte), `--copper`/`--silver` (monnaie). Changer la palette =
  éditer `:root` seul. Seules exceptions tolérées : `rgba(0,0,0/255,255,255,…)` génériques
  (ombres/voiles). **Réflexe : à chaque couleur écrite, utiliser ou créer un token.**
- **Pas de monolithe CSS.** `src/ui/styles.css` est un orchestrateur d'`@import` ; le style vit
  dans des modules par domaine sous `src/ui/styles/` (`base`, `components`, `creator`,
  `combat-ui`, `combat-modals`, `sheet`, `merchant`, `hud`, `world-meta`, `editor`, `compendium`,
  `codex-edit`, `house-rules`, `mass-battle`, `ornaments`, `tavern`). **Nouveau style → dans le
  module du domaine concerné** ; garder chaque module raisonnablement borné (pas de retour à un
  fichier de mille+ lignes).
- **Primitives canoniques** (`src/ui/styles/components.css`) — **composer, ne pas recréer une
  surface ad-hoc** : `.panel` (surface ; variantes `.sunken`/`.gold`/`.flush`), `.fold` (section
  repliable `<details>`), `.field` (champ libellé-au-dessus), `.stat-chip` (cartouche
  label+valeur), `.listrow` (rangée nom+méta+action), `.chip`/`.count` (badges), `.stack`/
  `.row-flex`. Idem pour le cadre `<Modal>` partagé (jamais de `.modal-overlay`+`.modal`+
  `useModalA11y` recopiés à la main) et les layouts responsive `.layout-sidebar`/`.panel-grid`/
  `.bar` (règle stricte 4). **Avant d'écrire du CSS : chercher la primitive qui existe déjà.**
  Afficher une valeur avec son LABEL, jamais un format cryptique (« Destin 4·4 » → 4 cartouches
  nommés Destin/Chance/Résilience/Détermination).

## Densité et contrôles stylisés

- **Aucun contrôle natif non stylisé.** `<input type=checkbox/radio>` et `<select>` système sont
  interdits : style GLOBAL `appearance:none` appliqué dans `src/ui/styles/base.css` (+ variantes
  par module — `combat-ui.css`, `combat-modals.css`, `creator.css`) — case charbon bordée (cochée
  = fond `--accent` + marque `--gold2`), radio = point or, select = chevron or en data-URI, focus
  `--gold`, options thémées. **Piège select** : un override `padding` shorthand mange la flèche →
  utiliser `padding-right` + `background-color` (jamais `background` en raccourci).
- **Éviter les espaces vides.** Un panneau aéré-à-vide lit comme inachevé. Regrouper sur une
  ligne ce qui peut l'être (ex. itinéraire + boutons de mode en `space-between`), ne pas
  détourner `.bar` (header à fond/padding) pour une simple rangée, resserrer les marges —
  densité maîtrisée mais lisible. **Vérifier à 360px ET en large** : un layout qui tient à 360
  peut s'étaler à vide en grand (breakpoints canon 900/700/560, règle stricte 4).

## États de fin d'un combattant (#237)

Un combattant qui quitte le combat NE se rend pas de la même façon selon la raison — une croix
générique confondait mort, KO, reddition et hors-combat. Langage visuel défini **une seule fois**
dans `src/ui/endStateVisual.ts` (`END_STATE_VISUAL`), keyé sur la catégorie retournée par la
fonction moteur PURE `endState(c)` (`src/engine/conditions.ts`) :

| État (`endState`) | Sens | Icône | Classe |
|---|---|---|---|
| `mort` | mort définitive | `journal/death` (crâne) | `es-mort` (grenat) |
| `inconscient` | KO conscient perdu | `condition/unconscious` | `es-koan` (bleu) |
| `rendu` | reddition (#215) / coque amenée — pavillon baissé | `journal/surrender` | `es-rendu` (pâle, portrait NON grisé : l'ennemi capturé est intact) |
| `hors-combat` | éjecté vivant (Destin, naufrage, Mort Subite, coque coulée) | `journal/flee` | `es-hors` (sépia) |

`rendu` vs `hors-combat` repose sur le seul champ `Combatant.exitReason` (`reddition`/`prise` →
rendu ; `destin`/`naufrage`/absent → hors-combat), posé aux sites de sortie (`resolveSurrenderThreshold`,
`resolveShipUnits`, Destin dans `combatSlice`). Un héros à 0 PB CONSCIENT reste À Terre — `endState`
renvoie `null`, aucun marqueur de fin (l'À Terre vit dans les pastilles d'États).

Ce langage s'applique aux **trois surfaces** via cette source unique : le token iso (`BodyToken`,
pastille `token-endmark`), le portrait et la frise d'initiative (`PortraitTile`, badge `end-mark` —
la frise réutilise `PortraitTile`). Une coque (`bodyShape 'vehicule'`) passe par le même token :
prise = pavillon amené (`rendu`), coulée = `hors-combat`. Verrou : `src/engine/endState.test.ts`
(4 états distincts) + `src/ui/endStateVisual.test.ts` (icône/classe uniques sur token ET portrait).

## Zéro texte tutoriel

- **Ne JAMAIS ajouter de texte d'aide/tutoriel dans l'UI** (HUD ou écrans). Une UI bien conçue se
  comprend par ses affordances (surbrillances, chemins, badges d'action, curseurs,
  placeholders) — pas par un mode d'emploi affiché en permanence. Un badge/label = le NOM de
  l'action seul (« Charger (+1 Av) »), jamais une phrase d'instruction. Un **état vide** = un
  bouton d'action directe (« ➕ Créer un personnage »), jamais un paragraphe qui explique où
  aller.
- La consigne d'un champ va dans son `placeholder` ; l'explication optionnelle dans un `title`.
  GARDER en revanche les infos de DÉCISION (enjeux d'un choix : bonus PX, prix) et le lore — ce
  n'est pas du texte tutoriel.
- **JAMAIS de référence au livre dans un texte joueur** (pas de « Parer le tir — Protectrice 2+
  (LDB 62 l.307) » affiché à l'écran) : les refs LDB restent dans les commentaires de code
  (convention du dépôt), jamais dans l'UI. Réutiliser les libellés EXISTANTS plutôt que d'en
  réinventer un plus verbeux.
