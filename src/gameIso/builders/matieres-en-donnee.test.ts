import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { materials } from '../../data';

/**
 * GARDE DÉRIVÉE (#1691, élargie #1715) — aucune couche ÉMETTRICE du monde ne NOMME une matière.
 *
 * Le relief était le dernier domaine de `MaterialRef` dont l'id était choisi EN CODE
 * (`floors.ts` : `'pilier'`, `'pierre'`, `'terre'`) ; il vient de la donnée comme les autres — la
 * SCÈNE (`reliefDefaults`) pour les parois de relief, le TERRAIN (`terrains.json › matiere`) pour le
 * flanc d'un bloc plein, le BÂTIMENT (`buildings.json › roofMaterial`) pour sa couverture par
 * défaut. Ce que la garde interdit, c'est le RETOUR de ce choix : un id de `materials.json` écrit en
 * dur dans une couche qui ÉMET de la géométrie ou du catalogue.
 *
 * PÉRIMÈTRE (les quatre couches qui émettent) : `src/gameIso/builders/**` (géométrie pure),
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

/** Les quatre couches ÉMETTRICES scannées. `prefixe`/`dir` composent le chemin que le rapport porte ;
 *  `recursif: false` borne la couche à la profondeur 1. */
const COUCHES = [
  { prefixe: 'gameIso/', dir: 'builders', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
  { prefixe: 'gameIso/', dir: 'authoring', recursif: false, filtre: (f: string) => /Svg\.tsx?$/.test(f) },
  { prefixe: 'gameIso/', dir: 'catalog', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
  { prefixe: '', dir: '.', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
] as const;

/** BASE de lecture d'une couche, DÉRIVÉE de son préfixe et de son dossier — chemin POSIX depuis la
 *  racine du dépôt, la forme que `readCorpus` prend et rend. La racine du store est `src/state`,
 *  celle des trois couches de rendu `src/gameIso/<dossier>`. */
const baseDe = (c: (typeof COUCHES)[number]) => `src/${c.prefixe}${c.dir === '.' ? 'state' : c.dir}`;

/**
 * Les trois SIGNAUX STRUCTURELS du store, chacun neutralisé par `codeSeul` — aucun nom de fichier,
 * aucune ligne : c'est la FORME qui dit qu'un littéral n'est pas une émission de matière.
 *  - une valeur TYPÉE `Terrain` (`: Terrain`, `<Terrain>`, `as Terrain[]`) est un id de TERRAIN, et
 *    `pierre`/`terre` sont des homonymes entre les deux vocabulaires ;
 *  - la clé `scope:` porte la PORTÉE d'un avertissement de validation, où `plan` est le plan de scène ;
 *  - une déclaration `… as const satisfies <X>Defaults` est une SEMENCE d'authoring (`emptyScene` et
 *    la migration la posent en DONNÉE sur la scène) : la matière y est écrite pour être éditée, pas
 *    émise. Le `satisfies` est ce qui distingue la semence d'un littéral libre.
 */
const SIGNAUX_STRUCTURELS = [
  { nom: 'valeur TYPÉE `Terrain`', re: /:\s*(Readonly)?(Set|ReadonlySet)?<?\s*Terrain\b|\bas\s+Terrain(\[\])?\b/, portee: 'ligne' },
  { nom: 'clé `scope:` (portée d’un avertissement)', re: /\bscope:/, portee: 'ligne' },
  { nom: 'SEMENCE `as const satisfies …Defaults`', re: /\bas const satisfies\s+\w*Defaults\b/, portee: 'bloc' },
] as const;

/** Les signaux de PORTÉE LIGNE, en une seule passe. */
const LIGNE_STRUCTURELLE = new RegExp(
  SIGNAUX_STRUCTURELS.filter((s) => s.portee === 'ligne').map((s) => s.re.source).join('|'),
);
/** La DÉCLARATION d'une semence, du `=` au `satisfies` : elle porte ses littéraux sur plusieurs lignes. */
const SEMENCE_DECL = /=\s*\{[^{}]*\}\s*as const satisfies\s+\w*Defaults\b/g;

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

/**
 * Le code SEUL, lignes préservées (le rapport porte des `fichier:ligne`) :
 *  - commentaires de bloc et de ligne retirés — une réf en prose n'est pas une émission ;
 *  - le champ `part` neutralisé, À L'ÉCRITURE (`part: 'pilier'`) COMME À LA COMPARAISON
 *    (`part === 'pilier'`, `part !== 'pilier'`) — `MaterialRef.part` nomme une PARTIE de face, pas
 *    une matière, et les deux vocabulaires ont un homonyme (`pilier` est à la fois une partie émise
 *    et une matière du dataset). Le champ est un signal STRUCTUREL, pas une exception nominative ;
 *  - les trois signaux du store (`SIGNAUX_STRUCTURELS`) : valeur TYPÉE `Terrain`, clé `scope:`, et
 *    déclaration `as const satisfies <X>Defaults` (la SEMENCE d'authoring, neutralisée sur tout son
 *    bloc puisqu'elle s'écrit sur plusieurs lignes).
 */
function codeSeul(src: string): string {
  const litteraux = (l: string) => l.replace(/(['"`])[^'"`\n]*\1/g, (s) => `${s[0]}_${s[0]}`);
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .replace(SEMENCE_DECL, (bloc) => litteraux(bloc))
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      const code = (i >= 0 ? l.slice(0, i) : l)
        .replace(/\bpart:\s*(['"`])[^'"`]*\1/g, 'part: _')
        .replace(/\bpart\s*(===|!==|==|!=)\s*(['"`])[^'"`]*\2/g, 'part $1 _');
      return LIGNE_STRUCTURELLE.test(code) ? litteraux(code) : code;
    })
    .join('\n');
}

describe('couches émettrices du monde — aucune matière nommée en dur (#1691, #1715)', () => {
  const fichiers = fichiersDuPerimetre();

  it('le scan couvre les QUATRE couches émettrices (sanity)', () => {
    for (const c of COUCHES)
      expect(fichiers.filter((f) => f.rel.startsWith(c.prefixe) && (c.dir === '.' || f.rel.includes(`${c.dir}/`))).length, c.dir).toBeGreaterThan(0);
    expect(fichiers.some((f) => f.rel === 'sceneEdit.ts'), 'la dérivation des masses n’est plus scannée').toBe(true);
    expect(fichiers.some((f) => f.rel === 'scene.ts'), 'le SCHÉMA de scène n’est plus scanné').toBe(true);
    expect(fichiers.some((f) => f.rel.includes('/')), 'le scan de `src/state` n’est plus récursif').toBe(true);
    expect(materials.length).toBeGreaterThan(5);
  });

  it('les HOMONYMES du store portent tous un signal STRUCTUREL, et aucun ne survit à la neutralisation', () => {
    const nus: { rel: string; ligne: number; texte: string }[] = [];
    for (const f of fichiers.filter((x) => !x.rel.startsWith('gameIso/'))) {
      const sansCommentaires = f.code
        .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
        .split('\n')
        .map((l) => (l.indexOf('//') >= 0 ? l.slice(0, l.indexOf('//')) : l));
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
