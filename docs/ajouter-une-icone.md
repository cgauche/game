# Ajouter une icône (et bannir les émojis)

Toute AFFORDANCE de l'UI (bouton, badge, libellé d'action, icône de donnée JSON) passe par le
**registre auto-collecté** `src/ui/icons/` : 1 famille d'icônes = 1 fichier dans
`src/ui/icons/defs/<famille>.ts`, ramassé par `npm run gen` (câblé dans `npm run build`).
**Aucune table centrale à éditer.** Plus jamais d'emoji dans le code ou la donnée — garde-fou
`src/ui/no-emoji-affordance.test.ts`.

## 0. Le registre : familles existantes

13 fichiers dans `src/ui/icons/defs/` (`action`, `char`, `condition`, `creature`, `flag`, `item`,
`journal`, `nav`, `resource`, `scenario`, `time`, `travel`, `ui`) — 100+ icônes au total.
Chercher d'abord si l'icône voulue existe déjà (`src/ui/icons/_registry.generated.ts` liste
tous les ids par famille, ex. `action/attack`, `resource/fate`, `condition/prone`). N'ajouter
une entrée que si aucune n'exprime déjà le concept.

## 1. Choisir la famille et l'id

Un id = `famille/nom` en kebab-case (garde `icons.test.ts` : regex
`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`). Créer une NOUVELLE famille
seulement si le concept ne rentre dans aucune des 13 existantes — sinon ajouter l'entrée au
fichier de famille pertinent.

## 2. Dessiner la def

```ts
// src/ui/icons/defs/<famille>.ts (extrait — voir action.ts pour la charte complète en tête de fichier)
const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'famille/nom',
    label: 'Libellé FR',           // tooltip par défaut, galerie QC
    svg: `<path ${F} d="…"/>`,     // contenu INTERNE d'un viewBox 0 0 24 24
  },
  // … reste de la famille
];
```

**Charte de dessin** (en-tête de `src/ui/icons/defs/action.ts`, référence pour toutes les
familles) :
- grille **24×24**, motif centré, ~2px de marge de respiration ;
- trait principal `stroke-width="1.8"`, terminaisons/jointures **rondes** ; détails fins en
  `1.2` ;
- « dessiné main » : courbes `C` plutôt que droites parfaites, micro-asymétries voulues —
  cohérent avec `Ornaments.tsx` et la direction du rendu iso ;
- silhouette **pleine** (`fill="currentColor"`) pour le motif porteur dès que l'icône doit
  rester lisible à 14px ; **une seule métaphore** par icône, pas de micro-détails, pas de
  texte ;
- couleur : **`currentColor` uniquement** (`var(--gold)` toléré avec parcimonie — cf.
  `resource/gold-purse`, la pièce d'or), **jamais de hex** — garde `icons.test.ts`
  (`ne contient AUCUNE couleur en dur`) : tout `fill`/`stroke` doit valoir `currentColor`,
  `none` ou `var(--gold)`.
- fragment non vide : au moins un `<path|circle|ellipse|rect|line|polyline|polygon|g>`.

## 3. Régénérer le registre

```
npm run gen
```

Réécrit `src/ui/icons/_registry.generated.ts` (import explicite de chaque fichier `defs/` +
union de littéraux `IconIdGenerated`, dérivée par regex des champs `id: '…'` — script générique
`scripts/gen-registry.mjs`, entrée `ICON_FAMILIES`/`src/ui/icons`). Auto en dev (plugin Vite) et
câblé dans `npm run build` (`npm run gen && tsc -b && vite build`) — mais lancer la commande à la
main après un ajout pour vérifier le compteur de fichiers (`ICON_FAMILIES ← N fichiers`) et
committer le fichier généré à jour.

Le nouvel id devient un littéral du type fermé `IconId` (`src/ui/icons/types.ts` :
`IconId = IconIdGenerated`) — un id inventé côté TS ne compile pas.

## 4. Les 3 rendus (`src/ui/Icon.tsx`)

| Contexte | Primitive | Détail |
|---|---|---|
| Composant React HTML | `<Icon id="famille/nom" size="sm"\|"md"\|"lg"\|number className? />` | `<svg viewBox="0 0 24 24">`, tailles nommées `sm=14 / md=18 / lg=24` px |
| Contexte SVG existant (pion iso, carte du monde, FX) | `<IconG id x y size />` | `<g transform="translate(x,y) scale(size/24)">`, couleur via `currentColor` posé sur un ancêtre |
| Fragment brut (scripts SSR/galeries) | `iconSvg(id): string` | retourne `def.svg` seul |

Les trois throw en DEV sur un id inconnu (`import.meta.env?.DEV` — `?.` car
`import.meta.env` n'existe pas sous `tsx`) : « Icône inconnue : « id » — déposer une def dans
`src/ui/icons/defs/` puis `npm run gen`. » Pas de repli muet ; en prod (non-DEV), `Icon`/`IconG`
rendent `null`/`''`.

`IconIdInput` (`src/ui/icons/types.ts`) = `IconId | (string & {})` : les 3 primitives acceptent
aussi un `string` brut porté par la DONNÉE JSON (ex. `ActivityDef.icon`), pas seulement l'union
typée — l'autocomplete reste côté code authoré en TS, la validation se fait au rendu.

## 5. Icône portée par une DONNÉE (JSON)

Toute affordance de contenu (`src/data/*.json`) référence un icône par **id de chaîne**, jamais
un émoji :

```json
{ "id": "manoeuvres-de-siege", "icon": "nav/activity", … }
```

Vu dans `activities.json`, `calendarPhases.json`, `vehicles.json`. Garde `data-wellformed.test.ts`
(cas 7) : chaque `ActivityDef.icon` doit exister dans `ICON_DEFS` (`import { ICON_DEFS } from
'../ui/icons'`) — un id fantôme fait échouer la suite.

## 6. QC visuel

```
npx tsx scripts/gen-icon-gallery.mts
```

Génère une galerie HTML (dans `npm run galleries`, entrée « Icônes UI (registre `<Icon>`) ») :
chaque icône rendue aux 3 tailles canon (14/18/24) + loupe 48px, groupée par famille — vérifier
la lisibilité à 14px et l'absence de couleur en dur AVANT de committer.

## 7. Bannir les émojis (garde `no-emoji-affordance.test.ts`)

Le test scanne `src/ui`, `src/state`, `src/gameIso`, `src/scenes` (`.ts`/`.tsx`) + `src/data/*.json`
et fait échouer la suite sur tout emoji détecté (plages Unicode `EMOJI_RANGES` — pictogrammes,
Dingbats, `⏩…⏳`, `ℹ`, sélecteur de variation `️` — délibérément SANS les blocs
typographiques flèches/formes géométriques) **hors** :
- glyphes texte tolérés partout (`ALLOWED_CHARS` : `✓ ✗ ✔ ✘ ✕ ★ ⚜ ☰ ♂ ♀ ✦ ✸` — coches/croix,
  fermeture, ornement, burger de menu, symboles de sexe, particules FX en `<text>` SVG) ;
- fichiers exclus par nature (`*.test.*`, `_registry.generated.ts`) ;
- la liste `EXCEPTIONS` (fichiers pas encore migrés, groupés par domaine : donnée JSON en cours de
  migration parallèle, outillage DEV console, journaux/state de combat, rendu iso, écrans/modales
  de l'éditeur et de campagne non migrés, commentaires documentant une correspondance emoji→icône
  dans `defs/resource.ts` — voir le tableau `EXCEPTIONS` du fichier pour le compte et l'état à jour,
  ne pas le figer ici).

**Migrer un fichier = le retirer de `EXCEPTIONS`.** Un second test — `CLIQUET` — fait exprès
échouer toute entrée de `EXCEPTIONS` dont le fichier n'a PLUS d'emoji (ou a disparu) : la liste
ne peut que se vider, jamais rester inerte après une migration. Ajouter une nouvelle exception
exige une justification en commentaire, pas un simple ajout silencieux.

Pour ajouter une AFFORDANCE dans un fichier déjà migré (hors `EXCEPTIONS`) : utiliser `<Icon id>`
/ `<IconG id>` dès l'écriture — jamais un emoji, même « juste pour l'instant ».

## Gardes

- `npx vitest run src/ui/icons/icons.test.ts` — ids uniques, format `famille/nom` kebab-case,
  label FR non vide, zéro couleur en dur, fragment SVG non vide, rendu `<Icon>` (viewBox, tailles,
  throw sur id inconnu).
- `npx vitest run src/ui/no-emoji-affordance.test.ts` — zéro emoji hors exceptions dans
  `src/ui`/`src/state`/`src/gameIso`/`src/scenes`/`src/data/*.json` + CLIQUET anti-dette
  (exceptions périmées interdites).
- `npx vitest run src/data/data-wellformed.test.ts` (cas 7) — chaque `ActivityDef.icon` résout
  dans `ICON_DEFS`.
- `npm run gen` — régénère `src/ui/icons/_registry.generated.ts` (échoue silencieusement en
  n'écrivant rien si le contenu est inchangé ; vérifier le compteur de fichiers affiché).
- `npx tsc --noEmit` — un id d'icône authoré en TS hors du registre ne compile pas
  (`IconIdGenerated` est une union fermée).
