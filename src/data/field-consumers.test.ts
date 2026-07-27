import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listProdFiles, scanFieldReads, groupByField } from '../../scripts/guards/lib/fieldConsumers.mjs';
import { TARGETS, fieldsOf } from '../../scripts/guards/lib/fieldConsumerTargets.mjs';

/**
 * Garde du rapport « consommateurs par champ » (#903 — `scripts/docs/build-field-consumers.mts`,
 * `docs/consommateurs-de-champs.md`). PAS un cliquet décroissant sur le volume de champs « 0
 * lecteur » : la vérification manuelle des 16 candidats de la première mesure a réfuté 9/16 (56 %,
 * angles morts du détecteur syntaxique — variable de type inféré, accès chaîné, boucle `for…of` sur
 * tableau typé, cf. en-tête de `build-field-consumers.mts`) — verrouiller ce total aurait verrouillé
 * un fait faux. Cette garde se limite à ce qui a été vérifié À LA MAIN : la fraîcheur du doc généré,
 * et le cas FONDATEUR (`TrappingRef.spec`, #903) en CONTRAT POSITIF.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('docs/consommateurs-de-champs.md — le rapport GÉNÉRÉ est à jour', () => {
  it('régénéré en mémoire == committé (sinon : npm run docs:field-consumers)', () => {
    const out = execFileSync('npx', ['tsx', 'scripts/docs/build-field-consumers.mts', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
    });
    expect(out).toMatch(/^docs:field-consumers — OK/);
  });
});

describe('cas fondateur #903 — qui lit TrappingRef.spec ?', () => {
  it('trappingRefLabel (src/data/index.ts) NE lit PAS ref.spec — le seul lecteur est resolveOne (trappingChoices.ts)', () => {
    const target = TARGETS.find((t) => t.type === 'TrappingRef');
    expect(target, 'TrappingRef absent de TARGETS — le cas fondateur a perdu sa surface').toBeTruthy();
    const files = listProdFiles(`${ROOT}src`);
    const fields = fieldsOf(target!.schema);
    const hits = scanFieldReads('TrappingRef', fields, files, ROOT.replace(/[\\/]$/, ''));
    const byField = groupByField(fields, hits);
    const specReaders = (byField.get('spec') ?? []).map((h: { file: string; line: number }) => `${h.file}:${h.line}`);
    expect(specReaders, 'TrappingRef.spec devrait avoir EXACTEMENT 1 lecteur mesuré (resolveOne)').toHaveLength(1);
    expect(specReaders[0]).toMatch(/^src\/engine\/trappingChoices\.ts:/);
    expect(specReaders.some((s: string) => s.includes('data/index.ts'))).toBe(false);
  });
});
