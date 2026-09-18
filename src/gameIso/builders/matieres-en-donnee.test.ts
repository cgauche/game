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
 * Les SIGNAUX STRUCTURELS du store, chacun neutralisé par `codeSeul` — aucun nom de fichier,
 * aucune ligne : c'est la FORME qui dit qu'un littéral n'est pas une émission de matière.
 *  - la clé `scope:` porte la PORTÉE d'un avertissement de validation, où `plan` est le plan de scène ;
 *  - une déclaration `… as const satisfies <X>Defaults` est une SEMENCE d'authoring GELÉE : depuis
 *    #1716 la semence VIVANTE est de la donnée (`semences-de-scene.json`, lue par `emptyScene`), et
 *    la forme ne subsiste qu'aux MIGRATIONS de projet (`worldMap.ts`), qui reconstituent la valeur
 *    d'avant leur lot — la matière y est écrite pour être POSÉE sur un vieux document, pas émise par
 *    un builder. Le `satisfies` est ce qui distingue la semence d'un littéral libre ; la cible est
 *    `Fige<…Defaults>` (#1789), et cette reconnaissance par REGEX passe au checker (#1789 train D).
 */
const SIGNAUX_STRUCTURELS = [
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
 *  - les deux signaux du store (`SIGNAUX_STRUCTURELS`) : clé `scope:` et déclaration `as const
 *    satisfies <X>Defaults` (la SEMENCE d'authoring, neutralisée sur tout son bloc puisqu'elle
 *    s'écrit sur plusieurs lignes).
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

/** Un id CITÉ en littéral (la mesure commune des trois bras). */
const citeId = (id: string) => new RegExp(`(['"\`])${id}\\1`);

/** Les MEMBRES littéraux d'une UNION, déclarée (`type X = 'a' | 'b'`) comme écrite en place. */
const membresDUnion = (union: string): string[] => [...union.matchAll(/(['"`])([^'"`\n]*)\1/g)].map((m) => m[2]);

/** Les ids de `terrains.json`, mémoïsés — le registre des sols contre lequel une union se juge. */
const idsTerrain = (() => {
  let vus: Set<string> | null = null;
  return () => (vus ??= new Set(terrains.map((t) => t.id)));
})();

/** CLAUSE PARTAGÉE du bras terrain : une union dont TOUS les membres sont des ids de terrain n'est
 *  pas un vocabulaire propre, c'est une LISTE RÉCITÉE — elle n'entre pas au répertoire
 *  (`vocabulaireDUnion`) et le neutraliseur d'union en place ne la blanchit pas. */
const membresSontTousDesTerrains = (union: string): boolean => {
  const membres = membresDUnion(union);
  return membres.length > 0 && membres.every((v) => idsTerrain().has(v));
};

/**
 * VOCABULAIRE D'UNION déclaré DANS LE FICHIER (`type X = 'a' | 'b' | …`) — le pendant, pour les ids de
 * terrain, de ce que `clesDOnglet` fait des clés d'IU : une valeur qui appartient à un vocabulaire
 * déclaré ici est de CE vocabulaire, pas du registre des sols, et sa lecture (`=== 'vide'`,
 * `capacite: 'porte'`, une table de priorité) est le MÊME signal que sa déclaration.
 *
 * La garde reste fermée sur le cas qui compte : une union dont TOUS les membres sont des ids de
 * terrain n'est pas un vocabulaire propre, c'est une LISTE DE TERRAINS récitée en code — elle
 * n'entre pas dans le répertoire, et la ligne reste comptée.
 */
const vocabulaireDUnion = (src: string): Set<string> => {
  const mots = new Set<string>();
  for (const m of src.matchAll(/\btype\s+\w+\s*=\s*([^;{}]*?);/g)) {
    const membres = membresDUnion(m[1]);
    if (membres.length < 2 || membresSontTousDesTerrains(m[1])) continue;
    for (const v of membres) mots.add(v);
  }
  return mots;
};

/**
 * Les NEUTRALISEURS du bras TERRAIN, chacun NOMMÉ — même contrat que `NEUTRALISEURS` : un neutraliseur
 * que plus aucun site de `src/state` n'exerce est une exemption morte, et le test de vie le rend ROUGE.
 * Aucun nom de fichier, aucune ligne : c'est la FORME qui dit qu'un littéral n'est pas un id de sol.
 *  - le VOCABULAIRE D'UNION déclaré dans le fichier (capacité d'arête, résultat de dépilage…) ;
 *  - une UNION de littéraux ÉCRITE EN PLACE (paramètre, champ) qui porte AU MOINS un membre hors du
 *    registre des sols : elle DÉCLARE un vocabulaire propre, elle n'émet pas. Une union dont TOUS les
 *    membres sont des ids de terrain est une LISTE RÉCITÉE — même clause qu'au répertoire
 *    `vocabulaireDUnion`, et la ligne reste comptée ;
 *  - un CHAMP dont le vocabulaire n'est pas celui des sols — `key` (clé de récap), `cargoId`
 *    (cargaison, `bois`), `weather` (météo, `neige`) : chacun a un homonyme au registre des terrains ;
 *  - la SEMENCE d'authoring GELÉE (`as const satisfies Fige<…Defaults>`) des migrations de projet.
 */
const NEUTRALISEURS_TERRAIN: readonly { nom: string; portee: 'ligne' | 'bloc'; applique: (code: string, mots: Set<string>) => string }[] = [
  {
    nom: 'VOCABULAIRE d’union déclaré dans le fichier',
    portee: 'ligne',
    applique: (code, mots) =>
      mots.size ? code.replace(new RegExp(`(['"\`])(?:${[...mots].join('|')})\\1`, 'g'), (m) => `${m[0]}_${m[0]}`) : code,
  },
  {
    nom: 'UNION de littéraux écrite en place',
    portee: 'ligne',
    applique: (code) =>
      code.replace(UNION_DE_LITTERAUX, (union) => (membresSontTousDesTerrains(union) ? union : litteraux(union))),
  },
  { nom: 'champ `key`/`cargoId`/`weather` (vocabulaire hors sols)', portee: 'ligne', applique: champHorsMatiere('key|cargoId|weather') },
  { nom: 'SEMENCE d’authoring GELÉE d’une migration', portee: 'bloc', applique: (code) => code.replace(SEMENCE_DECL, (bloc) => litteraux(bloc)) },
];

/** Le code du store SANS ses commentaires ni ses homonymes de terrain, lignes préservées. `sauf` en
 *  retire UN neutraliseur — c'est ainsi que le test de vie mesure ce que chacun blanchit RÉELLEMENT.
 *  Un neutraliseur de portée `bloc` s'applique au TEXTE entier (la semence gelée tient sur 3 lignes). */
function codeHorsTerrain(src: string, sauf?: string): string {
  const mots = vocabulaireDUnion(src);
  let texte = codeNu(src).join('\n');
  for (const n of NEUTRALISEURS_TERRAIN) if (n.portee === 'bloc' && n.nom !== sauf) texte = n.applique(texte, mots);
  return texte
    .split('\n')
    .map((l) => {
      let code = l;
      for (const n of NEUTRALISEURS_TERRAIN) if (n.portee === 'ligne' && n.nom !== sauf) code = n.applique(code, mots);
      return code;
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

  /**
   * TROISIÈME BRAS (#1716) — le SCHÉMA du monde ne récite aucun terrain.
   *
   * Vocabulaire DÉRIVÉ, comme les deux autres : la liste cherchée est `terrains.json › id` ENTIÈRE —
   * un terrain déposé demain au Codex est gardé le jour même, sans une ligne ici. La moitié
   * « matière » de la clause est tenue par le bras des ids de `materials.json` ci-dessous, qui scanne
   * `src/state` entier.
   *
   * Les HOMONYMES du store (`porte` capacité d’arête, `vide` résultat de dépilage, `neige` météo,
   * `bois` cargaison, `route` clé de récap) sont neutralisés par FORME (`NEUTRALISEURS_TERRAIN`) :
   * vocabulaire d’union déclaré dans le fichier, union écrite en place, nom de champ, semence gelée.
   * AUCUN site toléré, aucune liste d’exemption, aucun nom de fichier : le stock mesuré est vide.
   *
   * Périmètre `src/state/scene.ts`, ÉTENDU à `src/state` entier au train C (#1789).
   */
  it('`src/state` ne porte plus aucun id de terrain en littéral (#1716, périmètre entier #1789)', () => {
    const ids = terrains.map((t) => t.id);
    expect(ids.length, 'vocabulaire de terrains VIDE : la garde mesurerait le néant.').toBeGreaterThan(0);
    const fautes: string[] = [];
    for (const f of fichiers.filter((x) => duStore(x.rel))) {
      codeHorsTerrain(f.code).split('\n').forEach((l, i) => {
        for (const id of ids) if (citeId(id).test(l)) fautes.push(`state/${f.rel}:${i + 1} — « ${id} »`);
      });
    }
    expect(
      fautes,
      'le store NOMME un terrain : le porteur d’un rôle se demande au dataset ' +
        '(`terrainAbsent`/`terrainHorsGrille`, `state/terrain`), une semence vient de ' +
        '`semences-de-scene.json` et un défaut de compilateur de `defauts-de-compilation.json` — ' +
        'jamais d’un littéral.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });

  /**
   * CONTRAT DE VIE des neutraliseurs du bras TERRAIN — même mesure que pour les matières : on rejoue
   * le scan du store en retirant UN neutraliseur, et la différence d'ids comptés est ce qu'il porte.
   */
  it('chaque neutraliseur du bras TERRAIN est exercé par un site de `src/state` (aucune exemption morte)', () => {
    const ids = terrains.map((t) => t.id);
    const cite = (l: string) => ids.some((id) => citeId(id).test(l));
    for (const n of NEUTRALISEURS_TERRAIN) {
      const exerce = fichiers.filter((f) => duStore(f.rel)).some((f) => {
        const avec = codeHorsTerrain(f.code).split('\n');
        return codeHorsTerrain(f.code, n.nom)
          .split('\n')
          .some((l, i) => cite(l) && !cite(avec[i]));
      });
      expect(exerce, `neutraliseur mort : « ${n.nom} » ne blanchit plus aucun site de \`src/state\` — re-trier l’exemption.`).toBe(true);
    }
  });

  /**
   * SONDE de la CLAUSE d'union (#1789) — mesurée sur des sources SYNTHÉTIQUES, vocabulaire tiré du
   * dataset (aucun id récité ici) : une union dont TOUS les membres sont des sols est une LISTE
   * RÉCITÉE et reste comptée ; un SEUL membre hors registre en fait un vocabulaire propre, blanchi.
   */
  it('une union TOUT-TERRAIN reste comptée, une union à membre hors registre est blanchie', () => {
    const ids = terrains.map((t) => t.id);
    expect(ids.length, 'moins de deux terrains : la sonde d’union ne mesure rien.').toBeGreaterThan(1);
    const [a, b] = ids;
    const horsRegistre = 'hors-registre-des-sols';
    expect(ids).not.toContain(horsRegistre);
    const compte = (src: string) =>
      codeHorsTerrain(src)
        .split('\n')
        .filter((l) => ids.some((id) => citeId(id).test(l))).length;
    expect(
      compte(`type Sol = '${a}' | '${b}';`),
      `liste de terrains récitée blanchie : « ${a} | ${b} » n’est pas un vocabulaire propre, elle doit rester comptée.`,
    ).toBe(1);
    expect(
      compte(`function f(x: '${horsRegistre}' | '${a}') {}`),
      'une union qui porte un membre hors du registre des sols DÉCLARE un vocabulaire : elle se blanchit.',
    ).toBe(0);
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
