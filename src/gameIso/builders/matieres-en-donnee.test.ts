import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
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
 * PÉRIMÈTRE (les trois couches qui émettent) : `src/gameIso/builders/**` (géométrie pure),
 * `src/gameIso/authoring/*Svg.ts` (peintres du plan et de l'éditeur), `src/gameIso/catalog/**`
 * (catalogues et façades de donnée). Hors périmètre : le rig, les backends et le stage, où `plan`
 * n'est pas une matière de toiture mais la VOIE DE CORPS d'une créature (`bodyPlan.ts`) — un scan
 * naïf de `src/gameIso/**` y compte 42 homonymes qui ne sont pas des émissions de matière.
 *
 * `src/state` est une QUATRIÈME couche émettrice, hors de ce scan à ce jour : `sceneEdit.ts` y écrit
 * `'tuile'` et `'toit-ardoise'`, `scene.ts` la semence de relief d'une scène neuve. Sa résolution est
 * le volet (b) de #1715 (couverture résolue corps > type > scène) ; le périmètre s'y étend avec elle.
 *
 * Le vocabulaire interdit est DÉRIVÉ du dataset — aucune liste récitée ici : une matière ajoutée
 * demain est gardée le jour même. Les fichiers de TEST sont hors scan : ils POSENT des matières en
 * fixture, ce qui est le geste d'un auteur, pas un choix du moteur. Les commentaires sont retirés
 * avant la mesure : une réf `pierre` en prose n'est pas une émission.
 *
 * AUCUNE exception nominative : le stock mesuré est vide, il doit le rester.
 */
const GAMEISO = fileURLToPath(new URL('../', import.meta.url));

/** Les trois couches ÉMETTRICES scannées, relatives à `src/gameIso/`. */
const COUCHES = [
  { dir: 'builders', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
  { dir: 'authoring', recursif: false, filtre: (f: string) => /Svg\.tsx?$/.test(f) },
  { dir: 'catalog', recursif: true, filtre: (f: string) => /\.tsx?$/.test(f) },
] as const;

/** Les sources d'une couche (récursif ou non), hors `*.test.ts`. */
function sourcesDe(racine: string, recursif: boolean, filtre: (f: string) => boolean, rel = ''): string[] {
  const out: string[] = [];
  const dir = rel ? `${racine}/${rel}` : racine;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) { if (recursif) out.push(...sourcesDe(racine, true, filtre, relPath)); continue; }
    if (filtre(ent.name) && !/\.test\.tsx?$/.test(ent.name)) out.push(relPath);
  }
  return out;
}

/** Tous les fichiers du périmètre, en chemins relatifs à `src/gameIso/`. */
function fichiersDuPerimetre(): string[] {
  return COUCHES.flatMap((c) => sourcesDe(`${GAMEISO}${c.dir}`, c.recursif, c.filtre).map((f) => `${c.dir}/${f}`));
}

/**
 * Le code SEUL, lignes préservées (le rapport porte des `fichier:ligne`) :
 *  - commentaires de bloc et de ligne retirés — une réf en prose n'est pas une émission ;
 *  - le champ `part` neutralisé, À L'ÉCRITURE (`part: 'pilier'`) COMME À LA COMPARAISON
 *    (`part === 'pilier'`, `part !== 'pilier'`) — `MaterialRef.part` nomme une PARTIE de face, pas
 *    une matière, et les deux vocabulaires ont un homonyme (`pilier` est à la fois une partie émise
 *    et une matière du dataset). Le champ est un signal STRUCTUREL, pas une exception nominative.
 */
function codeSeul(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return (i >= 0 ? l.slice(0, i) : l)
        .replace(/\bpart:\s*(['"`])[^'"`]*\1/g, 'part: _')
        .replace(/\bpart\s*(===|!==|==|!=)\s*(['"`])[^'"`]*\2/g, 'part $1 _');
    })
    .join('\n');
}

describe('couches émettrices du monde — aucune matière nommée en dur (#1691, #1715)', () => {
  const fichiers = fichiersDuPerimetre();

  it('le scan couvre les TROIS couches émettrices (sanity)', () => {
    for (const c of COUCHES) expect(fichiers.filter((f) => f.startsWith(`${c.dir}/`)).length, c.dir).toBeGreaterThan(0);
    expect(materials.length).toBeGreaterThan(5);
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
    expect(fichiers.some((f) => /bodyPlan|sceneMeshes|actorAnimSelect|enemyProfile|tokenBodyKind/.test(f))).toBe(false);
  });

  it('aucun id de `materials.json` n’apparaît en littéral dans les couches émettrices', () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      const code = codeSeul(readFileSync(`${GAMEISO}${f}`, 'utf8'));
      const lignes = code.split('\n');
      for (const m of materials) {
        const re = new RegExp(`(['"\`])${m.id}\\1`);
        lignes.forEach((l, i) => {
          if (re.test(l)) fautes.push(`${f}:${i + 1} — « ${m.id} » (domaine ${m.domain})`);
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
