import type { TestScenario } from './_shared';

// Auto-découverte : chaque fichier `<NN>-*.ts` du dossier exporte `scenario`.
// Ajouter un scénario = déposer un fichier ici — aucun import manuel.
// On EXCLUT les `*.test.ts` au niveau du glob : en `eager`, le bundle exécuterait sinon leur
// `describe()`/`it()` (globals Vitest absents en prod → crash au chargement de l'écran).
const mods = import.meta.glob(['./*.ts', '!./*.test.ts', '!./_*.ts', '!./index.ts'], { eager: true }) as Record<
  string,
  { scenario?: TestScenario }
>;

export const testScenarios: TestScenario[] = Object.entries(mods)
  .map(([, m]) => m.scenario)
  .filter((s): s is TestScenario => !!s)
  .sort((a, b) => a.order - b.order);

export type { TestScenario } from './_shared';
