import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { materials, semencesDeScene, terrains } from '../../data';

/**
 * GARDE DÉRIVÉE (#1691, élargie #1715, #1716) — aucune couche ÉMETTRICE du monde ne NOMME une
 * matière, ni le SOL qu'une scène neuve reçoit (second bras, #1716).
 *
 * Le relief était le dernier domaine de `MaterialRef` dont l'id était choisi EN CODE
 * (`floors.ts` : `'pilier'`, `'pierre'`, `'terre'`) ; il vient de la donnée comme les autres — la
 * SCÈNE (`reliefDefaults`) pour les parois de relief, le TERRAIN (`terrains.json › matiere`) pour le
 * flanc d'un bloc plein, le BÂTIMENT (`buildings.json › roofMaterial`) pour sa couverture par
 * défaut. Ce que la garde interdit, c'est le RETOUR de ce choix : un id de `materials.json` écrit en
 * dur dans une couche qui ÉMET de la géométrie ou du catalogue.
 *
 * PÉRIMÈTRE (les CINQ couches qui émettent — `src/ui/editor/**` depuis #1716 : la palette et le
 * redimensionnement POSENT le sol d'une scène, rien ne les tenait) : `src/gameIso/builders/**` (géométrie pure),
 * `src/gameIso/authoring/*Svg.ts` (peintres du plan et de l'éditeur), `src/gameIso/catalog/**`
 * (catalogues et façades de donnée), et `src/state/**` ENTIER — la DÉRIVATION des masses de toit y
 * émet le `material` de chaque masse (`sceneEdit.ts`, #1715 volet b : il se résout corps > type de
 * bâtiment > scène), et le reste du store pose les mutations de scène que le rendu consomme.
 * Hors périmètre : le rig, les backends et le stage, où `plan` n'est pas une matière de toiture mais
 * la VOIE DE CORPS d'une créature (`bodyPlan.ts`) — un scan naïf de `src/gameIso/**` y compte 42
 * homonymes qui ne sont pas des émissions de matière.
 *
 * Le vocabulaire interdit est DÉRIVÉ du dataset — aucune liste récitée ici : une matière ajoutée
 * demain est gardée le jour même. Les fichiers de TEST sont hors scan : ils POSENT des matières en
 * fixture, ce qui est le geste d'un auteur, pas un choix du moteur. Les commentaires sont retirés
 * avant la mesure : une réf `pierre` en prose n'est pas une émission.
 *
 * AUCUNE exception nominative : le stock mesuré est vide, il doit le rester.
 */
const GAMEISO = fileURLToPath(new URL('../', import.meta.url));

/** Les CINQ couches ÉMETTRICES scannées. `prefixe`/`dir` composent le chemin que le rapport porte ;
 *  `recursif: false` borne la couche à la profondeur 1. */
const COUCHES = [
  { prefixe: 'gameIso/', dir: 'builders', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
  { prefixe: 'gameIso/', dir: 'authoring', recursif: false, filtre: (f: string) => /Svg\.tsx?$/.test(f) },
  { prefixe: 'gameIso/', dir: 'catalog', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
  { prefixe: '', dir: '.', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
  { prefixe: 'ui/', dir: 'editor', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
] as const;

/** BASE de lecture d'une couche, DÉRIVÉE de son préfixe et de son dossier — chemin POSIX depuis la
 *  racine du dépôt, la forme que `readCorpus` prend et rend. La racine du store est `src/state`,
 *  celle des trois couches de rendu `src/gameIso/<dossier>`. */
const baseDe = (c: (typeof COUCHES)[number]) => `src/${c.prefixe}${c.dir === '.' ? 'state' : c.dir}`;

/** Le STORE seul (la couche `src/state`, sans préfixe) : les autres couches portent le leur. */
const duStore = (rel: string) => !/^(gameIso|ui)\//.test(rel);

/**
 * Les trois SIGNAUX STRUCTURELS du store, chacun neutralisé par `codeSeul` — aucun nom de fichier,
 * aucune ligne : c'est la FORME qui dit qu'un littéral n'est pas une émission de matière.
 *  - une valeur TYPÉE `Terrain` (`: Terrain`, `<Terrain>`, `as Terrain[]`) est un id de TERRAIN, et
 *    `pierre`/`terre` sont des homonymes entre les deux vocabulaires ;
 *  - la clé `scope:` porte la PORTÉE d'un avertissement de validation, où `plan` est le plan de scène ;
 *  - une déclaration `… as const satisfies <X>Defaults` est une SEMENCE d'authoring GELÉE : depuis
 *    #1716 la semence VIVANTE est de la donnée (`semences-de-scene.json`, lue par `emptyScene`), et
 *    la forme ne subsiste qu'aux MIGRATIONS de projet (`worldMap.ts`), qui reconstituent la valeur
 *    d'avant leur lot — la matière y est écrite pour être POSÉE sur un vieux document, pas émise par
 *    un builder. Le `satisfies` est ce qui distingue la semence d'un littéral libre ; la cible est
 *    `Fige<…Defaults>` (#1789), et cette reconnaissance par REGEX passe au checker (#1789 train D).
 */
const SIGNAUX_STRUCTURELS = [
  { nom: 'valeur TYPÉE `Terrain`', re: /:\s*(Readonly)?(Set|ReadonlySet)?<?\s*Terrain\b|\bas\s+Terrain(\[\])?\b/, portee: 'ligne' },
  { nom: 'clé `scope:` (portée d’un avertissement)', re: /\bscope:/, portee: 'ligne' },
  { nom: 'SEMENCE `as const satisfies …Defaults`', re: /\bas const satisfies\s+(?:Fige<)?\w*Defaults>?\b/, portee: 'bloc' },
] as const;

/** Les signaux de PORTÉE LIGNE, en une seule passe. */
const LIGNE_STRUCTURELLE = new RegExp(
  SIGNAUX_STRUCTURELS.filter((s) => s.portee === 'ligne').map((s) => s.re.source).join('|'),
);
/** La DÉCLARATION d'une semence, du `=` au `satisfies` : elle porte ses littéraux sur plusieurs lignes. */
const SEMENCE_DECL = /=\s*\{[^{}]*\}\s*as const satisfies\s+(?:Fige<)?\w*Defaults>?\b/g;

/** Tous les fichiers du périmètre : la marche de l'arbre ET la lecture viennent de la primitive de
 *  corpus (`readCorpus`, une clé par base, `*.test.*` hors corpus). Le chemin rendu est celui que le
 *  rapport porte — relatif à `src/` pour les couches de `gameIso`, à `src/state/` pour le store. */
function fichiersDuPerimetre(): { rel: string; code: string }[] {
  return COUCHES.flatMap((c) =>
    readCorpus([baseDe(c)])
      .map(({ rel, text }) => ({ f: rel.slice(baseDe(c).length + 1), text }))
      .filter(({ f }) => (c.recursif || !f.includes('/')) && c.filtre(f.slice(f.lastIndexOf('/') + 1)))
      .map(({ f, text }) => ({ rel: `${c.prefixe}${c.dir === '.' ? '' : `${c.dir}/`}${f}`, code: text })),
  );
}

/** Le code SANS ses commentaires, lignes préservées — mesure COMMUNE aux deux bras (matières et
 *  semence de terrain) : une réf en prose n'est jamais une émission, quel que soit le vocabulaire. */
function codeNu(src: string): string[] {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => (l.indexOf('//') >= 0 ? l.slice(0, l.indexOf('//')) : l));
}

/** Un littéral de chaîne VIDÉ, ses bornes gardées : une neutralisation ne déplace aucune colonne. */
const litteraux = (t: string) => t.replace(/(['"`])[^'"`\n]*\1/g, (m) => `${m[0]}_${m[0]}`);

/** UNION de littéraux d'un TYPE (`'lieu' | 'commerce' | 'plan'`) : un type ne rend rien — il DÉCLARE
 *  le vocabulaire d'un état d'IU. Neutralisée comme une collection, pas comme un fichier. */
const UNION_DE_LITTERAUX = /(['"`])[^'"`\n]*\1(\s*\|\s*(['"`])[^'"`\n]*\3)+/g;

/** CLÉS D'ONGLET déclarées DANS LE FICHIER (`key: '…'`) : la comparaison d'un ÉTAT D'ONGLET à sa clé
 *  (`placeTab === 'plan'`) lit un état d'IU, elle n'émet aucune face — la déclaration et sa lecture
 *  sont le MÊME signal, pris dans le même fichier. */
const clesDOnglet = (src: string): Set<string> =>
  new Set([...src.matchAll(/\bkey:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]));

/** Neutralisation d'un CHAMP dont le vocabulaire N'EST PAS celui des matières, à l'écriture
 *  (`part: 'pilier'`) comme à la comparaison (`w.scope === 'plan'`) : c'est le NOM DU CHAMP qui est
 *  le signal, jamais le fichier. Chacun a un homonyme au dataset des matières (`pilier`, `plan`). */
const champHorsMatiere = (champs: string) => {
  const ecriture = new RegExp(`\\b(${champs})\\s*:\\s*(['"\`])[^'"\`]*\\2`, 'g');
  const comparaison = new RegExp(`\\b(${champs})\\s*(===|!==|==|!=)\\s*(['"\`])[^'"\`]*\\3`, 'g');
  return (code: string) => code.replace(ecriture, '$1: _').replace(comparaison, '$1 $2 _');
};

type Neutraliseur = { nom: string; applique: (code: string, onglets: Set<string>) => string };

/**
 * Les NEUTRALISEURS de ligne, chacun NOMMÉ — la table EST le contrat : un neutraliseur que plus
 * aucun site du périmètre n'exerce est une exemption morte, et le test de vie le rend ROUGE.
 *  - `part`/`scope` : une PARTIE de face, la PORTÉE d'un avertissement de validation ;
 *  - `key`/`kind` : une CLÉ d'IU (onglet, sélection) ;
 *  - l'UNION de littéraux d'un type : la DÉCLARATION d'un vocabulaire d'état, pas une émission ;
 *  - la comparaison d'un ÉTAT D'ONGLET à une clé déclarée dans le même fichier : le signal est la
 *    GAUCHE de la comparaison (un identifiant d'onglet, `…Tab`), jamais le fichier — `m.material ===
 *    'plan'` reste une émission dans un fichier qui déclare `key: 'plan'` ailleurs.
 */
const NEUTRALISEURS: readonly Neutraliseur[] = [
  { nom: 'champ `part`/`scope` (partie de face, portée d’un avertissement)', applique: champHorsMatiere('part|scope') },
  { nom: 'champ `key`/`kind` (clé d’IU)', applique: champHorsMatiere('key|kind') },
  { nom: 'UNION de littéraux d’un type', applique: (code) => code.replace(UNION_DE_LITTERAUX, litteraux) },
  {
    nom: 'comparaison d’un état d’ONGLET à une clé déclarée',
    applique: (code, onglets) =>
      onglets.size
        ? code.replace(
            new RegExp(`\\b(\\w*[Tt]ab)\\s*(===|!==|==|!=)\\s*(['"\`])(?:${[...onglets].join('|')})\\3`, 'g'),
            '$1 $2 _',
          )
        : code,
  },
];

/**
 * Le code SEUL, lignes préservées (le rapport porte des `fichier:ligne`) :
 *  - commentaires de bloc et de ligne retirés — une réf en prose n'est pas une émission ;
 *  - chaque NEUTRALISEUR de `NEUTRALISEURS` appliqué à la ligne ; `sauf` en retire UN, et c'est
 *    ainsi que le test de vie mesure ce que chacun blanchit RÉELLEMENT dans le périmètre ;
 *  - les trois signaux du store (`SIGNAUX_STRUCTURELS`) : valeur TYPÉE `Terrain`, clé `scope:`, et
 *    déclaration `as const satisfies <X>Defaults` (la SEMENCE d'authoring, neutralisée sur tout son
 *    bloc puisqu'elle s'écrit sur plusieurs lignes).
 */
function codeSeul(src: string, sauf?: string): string {
  const onglets = clesDOnglet(src);
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .replace(SEMENCE_DECL, (bloc) => litteraux(bloc))
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      let code = i >= 0 ? l.slice(0, i) : l;
      for (const n of NEUTRALISEURS) if (n.nom !== sauf) code = n.applique(code, onglets);
      return LIGNE_STRUCTURELLE.test(code) ? litteraux(code) : code;
    })
    .join('\n');
}

describe('couches émettrices du monde — aucune matière ni semence de terrain nommée en dur (#1691, #1715, #1716)', () => {
  const fichiers = fichiersDuPerimetre();

  it('le scan couvre les CINQ couches émettrices (sanity)', () => {
    for (const c of COUCHES)
      expect(fichiers.filter((f) => f.rel.startsWith(c.prefixe) && (c.dir === '.' || f.rel.includes(`${c.dir}/`))).length, c.dir).toBeGreaterThan(0);
    expect(fichiers.some((f) => f.rel === 'sceneEdit.ts'), 'la dérivation des masses n’est plus scannée').toBe(true);
    expect(fichiers.some((f) => f.rel === 'scene.ts'), 'le SCHÉMA de scène n’est plus scanné').toBe(true);
    expect(fichiers.some((f) => f.rel.includes('/')), 'le scan de `src/state` n’est plus récursif').toBe(true);
    expect(fichiers.some((f) => f.rel === 'ui/editor/Palette.tsx'), 'la PALETTE de l’éditeur n’est plus scannée').toBe(true);
    expect(fichiers.some((f) => f.rel === 'ui/editor/Editor.tsx'), 'le redimensionnement de l’éditeur n’est plus scanné').toBe(true);
    expect(materials.length).toBeGreaterThan(5);
  });

  it('les HOMONYMES du store portent tous un signal STRUCTUREL, et aucun ne survit à la neutralisation', () => {
    const nus: { rel: string; ligne: number; texte: string }[] = [];
    for (const f of fichiers.filter((x) => duStore(x.rel))) {
      const sansCommentaires = codeNu(f.code);
      sansCommentaires.forEach((l, i) => {
        if (materials.some((m) => new RegExp(`(['"\`])${m.id}\\1`).test(l)))
          nus.push({ rel: f.rel, ligne: i + 1, texte: [l, sansCommentaires[i + 1] ?? '', sansCommentaires[i + 2] ?? ''].join('\n') });
      });
    }
    expect(nus.length, 'plus aucun homonyme dans `src/state` : la neutralisation ne prouve plus rien.').toBeGreaterThan(0);
    // Un signal se lit sur la ligne ou sur la CLÔTURE de sa déclaration (la semence tient sur 3 lignes).
    expect(
      nus.filter((n) => !SIGNAUX_STRUCTURELS.some((s) => s.re.test(n.texte))).map((n) => `${n.rel}:${n.ligne}`),
      `Littéral de matière dans \`src/state\` sans signal structurel — signaux connus : ${SIGNAUX_STRUCTURELS.map((s) => s.nom).join(', ')}.`,
    ).toEqual([]);
    for (const s of SIGNAUX_STRUCTURELS)
      expect(nus.some((n) => s.re.test(n.texte)), `le signal « ${s.nom} » n’est plus exercé par aucun site.`).toBe(true);
  });

  /**
   * CONTRAT DE VIE des neutraliseurs — le pendant, pour la table `NEUTRALISEURS`, de ce que
   * `SIGNAUX_STRUCTURELS` exige site par site : un neutraliseur se juge à ce qu'il BLANCHIT
   * RÉELLEMENT. L'attendu est DÉRIVÉ du corpus (aucun nom de fichier ici) : on rejoue le scan en
   * retirant UN neutraliseur, et la différence de littéraux comptés est ce qu'il porte. Zéro
   * différence = exemption morte, à re-trier — pas à garder « au cas où ».
   */
  it('chaque NEUTRALISEUR est exercé par un site du périmètre (aucune exemption morte)', () => {
    const cite = (l: string) => materials.some((m) => new RegExp(`(['"\`])${m.id}\\1`).test(l));
    for (const n of NEUTRALISEURS) {
      const exerce = fichiers.some((f) => {
        const avec = codeSeul(f.code).split('\n');
        return codeSeul(f.code, n.nom)
          .split('\n')
          .some((l, i) => cite(l) && !cite(avec[i]));
      });
      expect(exerce, `neutraliseur mort : « ${n.nom} » ne blanchit plus aucun site du périmètre — re-trier l’exemption.`).toBe(true);
    }
  });

  /**
   * SECOND BRAS (#1716) — le SOL d’une scène neuve vient de la DONNÉE, jamais du code.
   *
   * Le vocabulaire est DÉRIVÉ, comme celui des matières : la valeur cherchée est
   * `semences-de-scene.json › terrain` elle-même (un id de `terrains.json`, tenu au parse par
   * `idDe('terrain')`) — change la semence au Codex, la garde suit le jour même, sans une ligne.
   *
   * ZÉRO, sans aucune neutralisation : la semence ne se nomme NULLE PART dans les cinq couches, ni
   * en pose (`.fill(…)`, `?? …`, `= …` : c’est la donnée qui la fournit) ni en collection — une
   * collection qui la nommerait serait une liste de terrains récitée en code, la classe de
   * `BARE_GROUND`, que le vocabulaire dérivé de `terrains.json` rend inutile.
   */
  it('la SEMENCE de terrain ne se nomme nulle part : le sol d’une scène neuve vient de la donnée (#1716)', () => {
    const semence = semencesDeScene.terrain;
    expect(terrains.some((t) => t.id === semence), `la semence « ${semence} » n’est pas un terrain : la garde mesure un vocabulaire mort.`).toBe(true);
    const cite = (id: string) => new RegExp(`(['"\`])${id}\\1`);
    const fautes: string[] = [];
    for (const f of fichiers) {
      codeNu(f.code).forEach((l, i) => {
        if (cite(semence).test(l)) fautes.push(`${f.rel}:${i + 1} — « ${semence} »`);
      });
    }
    expect(
      fautes,
      'une couche émettrice NOMME le sol de départ : il vient de `semences-de-scene.json › terrain` ' +
        '(`DEFAULT_TERRAIN`, `state/scene.ts`), éditable au Codex — jamais d’un littéral.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });

  it('la neutralisation est STRUCTURELLE : une COMPARAISON de partie n’est pas une émission de matière', () => {
    const chemin = `${GAMEISO}authoring/floorsSvg.ts`;
    expect(existsSync(chemin), 'le site témoin de la comparaison de partie a disparu — reformuler la garde.').toBe(true);
    const brut = readFileSync(chemin, 'utf8');
    const partie = materials.find((m) => brut.includes(`part === '${m.id}'`) || brut.includes(`part !== '${m.id}'`));
    expect(partie, 'plus aucune comparaison `part === <homonyme d’une matière>` : le cas n’est plus exercé.').toBeDefined();
    expect(new RegExp(`'${partie!.id}'`).test(codeSeul(brut)), `« ${partie!.id} » compté comme matière alors que c’est une PARTIE.`).toBe(false);
  });

  it('l’homonyme `plan` du RIG est hors périmètre : la voie de corps n’est pas une couverture', () => {
    expect(materials.some((m) => m.id === 'plan' && m.domain === 'roof'), '`plan` n’est plus une matière de toiture : reformuler la garde.').toBe(true);
    expect(fichiers.some((f) => /bodyPlan|sceneMeshes|actorAnimSelect|enemyProfile|tokenBodyKind/.test(f.rel))).toBe(false);
  });

  it('aucun id de `materials.json` n’apparaît en littéral dans les couches émettrices', () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      const code = codeSeul(f.code);
      const lignes = code.split('\n');
      for (const m of materials) {
        const re = new RegExp(`(['"\`])${m.id}\\1`);
        lignes.forEach((l, i) => {
          if (re.test(l)) fautes.push(`${f.rel}:${i + 1} — « ${m.id} » (domaine ${m.domain})`);
        });
      }
    }
    expect(
      fautes,
      'une couche émettrice NOMME une matière : la matière d’une face vient de la DONNÉE (scène `reliefDefaults`, ' +
        'terrain `matiere`, bâtiment `roofMaterial`, masse de toit `material`, recette de décor `primitive.material`), jamais du code.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });
});
