import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { materials } from '../../data';

/**
 * GARDE DÉRIVÉE (#1691) — aucun builder du pivot ne NOMME une matière du monde.
 *
 * Le relief était le dernier domaine de `MaterialRef` dont l'id était choisi EN CODE
 * (`floors.ts` : `'pilier'`, `'pierre'`, `'terre'`) ; il vient de la donnée comme les autres — la
 * SCÈNE (`reliefDefaults`) pour les parois de relief, le TERRAIN (`terrains.json › matiere`) pour le
 * flanc d'un bloc plein. Ce que la garde interdit, c'est le RETOUR de ce choix : un id de
 * `materials.json` écrit en dur dans `src/gameIso/builders/**`.
 *
 * Le vocabulaire interdit est DÉRIVÉ du dataset — aucune liste récitée ici : une matière ajoutée
 * demain est gardée le jour même. Les fichiers de TEST sont hors scan : ils POSENT des matières en
 * fixture (une couverture de toit authorée, une matière de relief de scène), ce qui est le geste
 * d'un auteur, pas un choix du moteur. Les commentaires sont retirés avant la mesure : une réf
 * `pierre` en prose n'est pas une émission.
 *
 * AUCUNE exception nominative : le stock mesuré est vide, il doit le rester.
 */
const BUILDERS = fileURLToPath(new URL('.', import.meta.url));

/** Les sources de `src/gameIso/builders` (récursif), hors `*.test.ts`. */
function sources(dir = BUILDERS, rel = ''): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...sources(`${dir}/${ent.name}`, relPath));
    else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) out.push(relPath);
  }
  return out;
}

/**
 * Le code SEUL, lignes préservées (le rapport porte des `fichier:ligne`) :
 *  - commentaires de bloc et de ligne retirés — une réf en prose n'est pas une émission ;
 *  - valeurs du champ `part` neutralisées — `MaterialRef.part` nomme une PARTIE de face, pas une
 *    matière, et les deux vocabulaires ont un homonyme (`pilier` est à la fois une partie émise et
 *    une matière du dataset). Le champ est un signal STRUCTUREL, pas une exception nominative.
 */
function codeSeul(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return (i >= 0 ? l.slice(0, i) : l).replace(/\bpart:\s*(['"`])[^'"`]*\1/g, 'part: _');
    })
    .join('\n');
}

describe('builders du pivot — aucune matière du monde nommée en dur (#1691)', () => {
  const fichiers = sources();

  it('le scan couvre bien les builders (sanity)', () => {
    expect(fichiers.length).toBeGreaterThan(5);
    expect(materials.length).toBeGreaterThan(5);
  });

  it('aucun id de `materials.json` n’apparaît en littéral dans `src/gameIso/builders/**`', () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      const code = codeSeul(readFileSync(`${BUILDERS}/${f}`, 'utf8'));
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
      'un builder NOMME une matière : la matière d’une face vient de la DONNÉE (scène `reliefDefaults`, ' +
        'terrain `matiere`, masse de toit `material`, recette de décor `primitive.material`), jamais du code.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });
});
