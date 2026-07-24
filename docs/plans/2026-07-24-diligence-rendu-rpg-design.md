# La Diligence — remise à plat du rendu RPG

**Date :** 2026-07-24  
**Référence visuelle canonique :** `art-ref/page012_img3.png`  
**Référence de carte :** `src/scenes/diligence/floorplan.ascii.ts`

## Décisions utilisateur

> « N'oublie pas le schéma d'origine qu'on essaye de reproduire. Le moteur est la pour reproduire ce batiment. S'il est mal fait, il faut le remettre a plat »

— utilisateur, 2026-07-24

> « Ok. Apres le toit ce n'est qu'un des sujets »

— utilisateur, 2026-07-24

La fidélité au plan et à l'élévation d'origine prime donc sur la conservation du
modèle de rendu actuel. Une amélioration de toiture ne vaut pas validation de la
scène complète.

## Diagnostic

Le schéma source fournit trois vérités distinctes :

1. les plans du rez-de-chaussée et de l'étage ;
2. l'organisation du relais dans son mur d'enceinte ;
3. une élévation extérieure du bâtiment principal.

Le moteur ne représente aujourd'hui que la première de façon explicite. Les
pièces sont des zones descriptives, les murs sont des arêtes physiques et les
toits sont des rectangles indépendants sans propriétaire architectural.
`addBuilding` produit ces éléments puis perd l'identité du bâtiment qui les
réunit.

Cette absence provoque deux échecs symétriques :

- un toit par rectangle intérieur produit un patchwork de faîtages ;
- une union procédurale de toute l'emprise produit une masse concave qui obstrue
  l'écran sous certaines rotations.

L'occlusion caméra et la coupe intérieure sont également confondues. Estomper
une toiture entière pour dégager un héros extérieur transforme le bâtiment en
radiographie ; ne jamais l'estomper crée un mur de toiture devant la caméra.

## Programme global

La remise à plat comporte cinq chantiers successifs :

1. **Architecture extérieure** — corps de bâtiment, façades et sections de
   toiture authorés depuis la planche source.
2. **Caméra et visibilité** — occlusion locale, coupe intérieure et cadrage
   stables aux quatre rotations.
3. **Déplacement** — destination non ambiguë, chemin fiable, aucune correction
   visuelle en arrière.
4. **Direction visuelle** — matériaux, éclairage, mobilier, densité et
   profondeur dignes d'un RPG isométrique.
5. **Information joueur** — interactions contextuelles et journal/codex, sans
   noms de zones peints sur l'environnement.

Chaque chantier possède sa recette propre. Le chantier 1 ne clôt pas les quatre
suivants.

## Chantier 1 — modèle architectural

### Donnée persistante

La scène reçoit des corps architecturaux explicites :

```ts
interface ArchitectureBody {
  id: string;
  label?: string;
  style: string;
  storeys: ArchitectureStorey[];
  facades: FacadeSection[];
  roofs: RoofSection[];
}

interface ArchitectureStorey {
  id: string;
  z: number;
  parts: ArchitecturePart[];
  roomZoneIds: string[];
}

interface ArchitecturePart {
  id: string;
  foot: Rect;
}

interface FacadeSection {
  id: string;
  z: number;
  edges: EdgeRef[];
  appearance: string;
  features?: FacadeFeature[];
}

interface RoofSection {
  id: string;
  z: number;
  foot: Rect;
  profile: 'gable' | 'hip' | 'shed' | 'flat';
  ridge: 'x' | 'y';
  eaveHeightM: number;
  pitch: number;
  material: string;
  roomZoneIds: string[];
}
```

Les noms exacts pourront être ajustés à l'implémentation, mais les responsabilités
ne doivent pas être regroupées de nouveau :

- `parts` décrit l'emprise extérieure, pas le mouvement ;
- `facades` décrit l'élévation visible, pas la collision ;
- `roofs` décrit des volumes de toiture intentionnels, jamais déduits des
  rectangles des pièces ;
- `roomZoneIds` relie explicitement la coupe intérieure aux volumes concernés.

`Scene.layers` et `Scene.walls` restent les seules vérités de déplacement, de
collision et de ligne de vue.

### Compilation et édition

`MapSpec` est l'unique chemin déclaratif. Il doit exprimer les corps, sections et
liaisons de zones, puis les compiler sans branche spécifique à La Diligence.

L'éditeur doit permettre :

- créer et supprimer un corps ;
- ajouter, déplacer et redimensionner ses parties ;
- définir les façades, leur apparence et leurs éléments ;
- définir chaque section de toiture ;
- lier une section aux ids stables des zones intérieures.

Les ids de zones descriptives doivent être authorés et stables ; ils ne peuvent
plus dépendre uniquement du caractère ASCII.

### Rendu

- Les façades et toitures sont générées par section authorée.
- `roofPans` reste la primitive de géométrie d'une section, sans calculer
  l'architecture globale depuis le plan intérieur.
- Les avant-toits d'une empreinte concave utilisent la normale locale du bord,
  pas un centroïde global.
- Les cellules exactes restent disponibles pour le plan, le culling et la
  sélection éditeur.
- Les ornements sont produits une fois par corps ou section, jamais une fois par
  rectangle technique.

## Chantier 2 — coupe et occlusion

Deux mécanismes indépendants sont obligatoires :

1. **Coupe intérieure** : lorsqu'un héros occupe une zone intérieure, les
   sections liées à cette zone sont retirées et seule la façade avant de cette
   pièce est ouverte.
2. **Occlusion caméra** : dehors comme dedans, seuls les pans ou panneaux
   effectivement situés entre la caméra et le héros sont estompés. Une cellule
   occlusive ne peut jamais rendre translucide un corps entier.

Ces mécanismes doivent rester stables aux quatre rotations et lors d'un
déplacement continu.

## Migration de La Diligence

La migration repart de `art-ref/page012_img3.png` :

- conserver les deux emprises de plan déjà recalées, sauf réfutation visuelle ;
- distinguer le mur d'enceinte des bâtiments ;
- authorer séparément le bâtiment principal, le portier et les dépendances ;
- reproduire l'élévation disponible : corps principal à colombages, pignon
  central, entrée maçonnée, ouvertures, cheminées et lignes de toiture ;
- ne pas inventer une élévation détaillée pour une façade que la source ne
  montre pas : employer le style cohérent du même corps ;
- supprimer le remplacement manuel de `scene.roofs` et tout regroupement
  spécifique à l'id de la scène.

## Critères de validation

### Fidélité structurelle

- superposition top-down source/rendu pour les deux niveaux ;
- toutes les zones numérotées présentes et atteignables ;
- cour, jardin, balcons et passages laissés ouverts conformément au plan ;
- silhouette extérieure reconnaissable par rapport à l'élévation source.

### Expérience joueur

- dehors : mur et toiture lisibles, sans radiographie globale ;
- entrée : destination et ouverture identifiables sans texte posé sur le décor ;
- dedans : seule la pièce occupée est révélée ;
- quatre rotations : le héros et son voisinage restent visibles ;
- aucun retour arrière visuel pendant un déplacement.

### Coût

- aucun objet SVG monolithique conservé parce qu'une seule de ses cellules est
  visible ;
- mesure reproductible des nœuds et du markup des volumes architecturaux ;
- console sans erreur pendant entrée, déplacement et quatre rotations.

## Non-objectifs du premier chantier

Le premier chantier ne prétend pas finaliser :

- l'éclairage et l'ambiance ;
- la variété des matériaux et du mobilier ;
- les interactions contextuelles ;
- le cadrage automatique de toutes les tailles de pièces ;
- la totalité des causes de rollback du déplacement.

Ces sujets restent explicitement ouverts dans le programme global.
