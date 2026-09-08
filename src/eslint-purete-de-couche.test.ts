import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * FILET DE PÉRIMÈTRE DE LA PURETÉ DE COUCHE (#1709 C3b-2 ; CLAUDE.md règle stricte 3, #8 et #161).
 *
 * La doctrine « `src/engine` est pur, `src/state` est en amont de `src/ui`/`src/gameIso` » se dit
 * UNE fois, dans `eslint.config.js`, et se joue par la gate `lint`. Ce banc ne recopie aucune
 * règle : il MESURE la config RÉSOLUE (API ESLint, `cwd` à la racine du dépôt).
 *
 * Il existe parce qu'un bloc `files:` qui ne matcherait plus rien (dossier renommé, glob décalé)
 * serait MUET et VERT. Deux volets, donc :
 *  1. PÉRIMÈTRE — le premier fichier RÉEL de chaque couche (lu par `readCorpus`, jamais un nom en
 *     dur) est bien sous les deux règles de pureté ;
 *  2. TABLE DES 7 FORMES — sur ce même fichier réel, chaque forme d'import rend le verdict attendu.
 *
 * PIÈGE MESURÉ : sans `cwd` au dépôt, ESLint ne trouve pas la config, `ruleId` est `null` et tout
 * paraît « pris » par vacuité — d'où l'assertion sur `ruleId` à chaque verdict.
 *
 * CE QUE LA POLICE NE VOIT PAS, et pourquoi : les formes ÉLIDÉES à la compilation (`import type
 * … from`, `import { type X }` tout-type, la référence inline `import('…').T`) ne créent aucune
 * arête d'exécution — c'est le critère STRUCTUREL qui remplace les trois exemptions NOMINATIVES de
 * l'ancien banc (`state/combatManeuvers.ts`, `state/roster.ts`, `state/revealStep.ts`, tous trois
 * des `import type … from '../ui/…'`) et l'allowlist `engine/types.ts` (une référence inline vers
 * `gameIso/rig/appearance`). Reste hors de portée, comme pour toute police d'accès : la recopie qui
 * ne passe par aucun import, et `require()`.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REF = '#1709';
const eslint = new ESLint({ cwd: ROOT });

/** Les couches gardées, et leurs avals interdits. */
const COUCHES = [
  { amont: 'src/engine', avals: ['state', 'ui', 'gameIso'] },
  { amont: 'src/state', avals: ['ui', 'gameIso'] },
] as const;

/** Les 7 formes d'import vers `p`, et la règle qui DOIT les prendre (`null` = passe : élidée). */
const FORMES: { nom: string; code: (p: string) => string; regle: string | null }[] = [
  { nom: 'statique nommé', code: (p) => `import { X } from '${p}';\nexport const a = X;\n`, regle: 'no-restricted-imports' },
  { nom: 'side-effect', code: (p) => `import '${p}';\n`, regle: 'no-restricted-imports' },
  { nom: 'dynamique', code: (p) => `export const f = async () => (await import('${p}')).X;\n`, regle: 'no-restricted-syntax' },
  { nom: 'inline type `import(…).T`', code: (p) => `export type A = import('${p}').X;\n`, regle: null },
  { nom: 'import type … from', code: (p) => `import type { X } from '${p}';\nexport type A = X;\n`, regle: null },
  { nom: 'mixte { type X, y }', code: (p) => `import { type X, y } from '${p}';\nexport const a = y;\nexport type B = X;\n`, regle: 'no-restricted-imports' },
  { nom: 'export … from', code: (p) => `export { X } from '${p}';\n`, regle: 'no-restricted-imports' },
];

/** Règles qui ont pris ce code au titre de la PURETÉ (message porteur de la réf ticket). */
async function pris(code: string, filePath: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath, warnIgnored: false });
  const purete = res.messages.filter((m) => m.message.includes(REF));
  for (const m of purete) {
    expect(m.ruleId, `${filePath} : ruleId nul — la config n’a pas été résolue (cwd hors dépôt ?), tout serait faussement « pris »`).toBeTruthy();
  }
  return purete.map((m) => m.ruleId!).sort();
}

/** Deux fichiers RÉELS de la couche (ordre total de `readCorpus`, tests exclus, jamais un nom en
 *  dur) : le PREMIER, et un fichier de SOUS-DOSSIER — un glob `src/x/**` et un spécificateur de
 *  remontée `../../` ne se comportent pas comme à la racine de la couche, et c'est de là que
 *  viennent les inversions réelles (`state/terrain/`, `engine/traits/`). */
function sondes(amont: string): string[] {
  const corpus = readCorpus([amont]);
  const sousDossier = corpus.find((f) => f.rel.slice(amont.length + 1).includes('/'));
  expect(sousDossier, `${amont} : aucun fichier en sous-dossier dans le corpus — la sonde de profondeur ne mesure rien`).toBeTruthy();
  return [corpus[0].rel, sousDossier!.rel];
}

/** Spécificateur relatif de `rel` vers `src/<aval>/x`. */
function specifieur(rel: string, aval: string): string {
  return `${'../'.repeat(rel.split('/').length - 2)}${aval}/x`;
}

describe('pureté de couche — la doctrine vit dans eslint.config.js, mesurée sur la config RÉSOLUE (#1709)', () => {
  for (const { amont, avals } of COUCHES) {
    it(`${amont} : des fichiers RÉELS de la couche (racine ET sous-dossier) sont sous les deux règles`, { timeout: 30_000 }, async () => {
      for (const rel of sondes(amont)) {
        const cfg = await eslint.calculateConfigForFile(`${ROOT}/${rel}`);
        const messages = JSON.stringify([cfg.rules?.['no-restricted-imports'], cfg.rules?.['no-restricted-syntax']]);
        for (const aval of avals) {
          expect(
            messages,
            `Bloc de pureté ${amont}→src/${aval} MUET : il ne s’applique à aucun fichier réel de la couche (glob décalé ? dossier renommé ?). Fichier sondé : ${rel}`,
          ).toContain(`src/${aval} à l’EXÉCUTION`);
        }
      }
    });

    for (const aval of avals) {
      it(`${amont} → src/${aval} : les 7 formes rendent le verdict attendu (racine ET sous-dossier)`, { timeout: 30_000 }, async () => {
        const attendu = Object.fromEntries(FORMES.map((f) => [f.nom, f.regle ?? 'passe']));
        for (const rel of sondes(amont)) {
          const chemin = `${ROOT}/${rel}`;
          const p = specifieur(rel, aval);
          const table: Record<string, string> = {};
          for (const forme of FORMES) table[forme.nom] = (await pris(forme.code(p), chemin)).join('+') || 'passe';
          expect(table, `${amont} → src/${aval} (sonde : ${rel}, spécificateur : ${p})`).toEqual(attendu);
        }
      });
    }

    it(`${amont} : l’alias \`@/…\` est pris lui aussi (l’ancien banc, en regex \`(\\.\\./)+\`, ne le voyait pas)`, { timeout: 30_000 }, async () => {
      for (const rel of sondes(amont)) {
        for (const aval of avals) {
          expect(
            await pris(`import { X } from '@/${aval}/x';\nexport const a = X;\n`, `${ROOT}/${rel}`),
            `${amont} → @/${aval}/x (sonde : ${rel})`,
          ).toEqual(['no-restricted-imports']);
        }
      }
    });
  }

  it('un import LÉGITIME de la couche ne mord pas (fail-open mesuré, pas postulé)', async () => {
    const [rel] = sondes('src/engine');
    expect(await pris("import { rollD100 } from './dice';\nexport const a = rollD100;\n", `${ROOT}/${rel}`)).toEqual([]);
  });
});
