/**
 * Voyage — poste « Établir des cartes » (EDOC l.161) : Test ÉTENDU inter-Étapes, désormais UNE RANGÉE
 * du pas BATCH des postes du jour (arbitrage user 2026-07-11). Gardes de non-régression :
 *  - le libellé de la rangée = la Compétence RÉELLEMENT utilisée, LABEL résolu AVEC sa spec
 *    (« Métier (Cartographe) »), jamais l'id brut (`metier`) ni `def.skills[0]` sans spec ;
 *  - la RANGÉE porte le contexte de test étendu (extendedDrDone/extendedDrTarget) → barre de DR
 *    ATTACHÉE à SA rangée (rendue par `RollRow`, site unique), persistante après validation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { useGame } from './store';
import { buildStageSteps } from './travelPostes';
import { cascadeAppliers } from './cascade';
import type { Combatant } from '../engine/types';
import type { BatchParticipant } from './pendings';

const cartoHero = (): Combatant =>
  ({
    id: 'h', name: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 40, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
    skills: [{ skillId: 'metier', spec: 'Cartographe', characteristic: 'dexterite', advances: 20 }],
  } as Combatant);

describe('Voyage — poste Cartographie (Établir des cartes, test étendu)', () => {
  beforeEach(() => {
    useGame.setState({
      party: [cartoHero()],
      travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'etablir-cartes' } }, extendedProgress: 1 } as never,
    });
  });

  /** La rangée-participant du cartographe dans le pas BATCH des postes. */
  const cartoPart = (): BatchParticipant => {
    const steps = buildStageSteps(useGame.getState, useGame.setState, 'beau', 'ete');
    const batch = steps.find((s) => s.kind === 'stagePosteBatch')!;
    return batch.participants!.find((p) => p.id === 'h')!;
  };

  it('label de rangée = compétence RÉSOLUE avec spec (« Métier (Cartographe) »), jamais l’id', () => {
    expect(cartoPart().label).toBe('Métier (Cartographe)');
  });

  it('la RANGÉE porte le contexte de test étendu (extendedDrDone/extendedDrTarget) pour la barre de DR', () => {
    const part = cartoPart();
    expect(typeof part.extendedDrTarget).toBe('number');
    expect(part.extendedDrTarget as number).toBeGreaterThan(0);
    expect(part.extendedDrDone).toBe(1); // = extendedProgress AVANT ce jet
  });

  // VERROU (#329, arbitrage user 2026-07-11) : la barre de DR de RANGÉE d'un Test étendu a UN SEUL site
  // de rendu (la primitive `RollRow`), alimenté par la DONNÉE `extendedDr` — jamais un `<DrBar>` recodé
  // dans la modale de cascade ou le builder de rangées (ni une branche spécifique voyage).
  it('la barre de DR de rangée a UN site de rendu unique (RollRow), pas dans CascadeModal/buildParticipantRows', () => {
    const ui = (f: string) => readFileSync(fileURLToPath(new URL(`../ui/${f}`, import.meta.url)), 'utf8');
    expect(ui('RollRow.tsx')).toMatch(/extendedDr && <DrBar/); // SITE unique de rendu de la barre de rangée
    expect(ui('CascadeModal.tsx')).not.toMatch(/DrBar/); // la modale ne pose QUE la donnée, plus le composant
    expect(ui('buildParticipantRows.tsx')).not.toMatch(/DrBar/);
  });

  // PERSISTANCE post-validation : l'application du batch ne DÉTRUIT pas la donnée de barre de la rangée
  // (elle reste sur le participant → rangées témoins/bilan la re-rendent), et pose la conséquence SUR la rangée.
  it('après application du batch, la rangée cartographie GARDE sa donnée de DR étendu + porte sa conséquence', () => {
    const steps = buildStageSteps(useGame.getState, useGame.setState, 'beau', 'ete');
    const batch = steps.find((s) => s.kind === 'stagePosteBatch')!;
    const part = batch.participants!.find((p) => p.id === 'h')!;
    part.result = { roll: 30, target: part.target, sl: 2, success: true }; // jet réussi (DR 2)
    cascadeAppliers['stagePosteBatch'].apply(useGame.getState, useGame.setState, batch, undefined, { steps: [batch], index: 0 });
    expect(part.extendedDrTarget as number).toBeGreaterThan(0); // donnée de barre TOUJOURS présente
    expect(Array.isArray(part.outcome)).toBe(true); // conséquence rendue sur SA rangée
  });

  // VERROU RESSERRÉ (vague « lisibilité du voyage » 2/2, arbitrage user 2026-07-11) : `DrBar` n'est
  // IMPORTÉ que par son site unique (`RollRow.tsx`) + les exceptions nommées ci-dessous, chacune avec
  // sa raison. ActivityModal/FocusModal/DispelModal/ReloadModal/useExtendedTestJetProps sont CONVERGÉS
  // sur `RollRow.extendedDr` (plus d'import direct) — toute réapparition d'un import fait échouer ce test.
  it('DrBar : import limité au site unique RollRow + exceptions nommées', () => {
    const uiDir = fileURLToPath(new URL('../ui/', import.meta.url));
    const importers: string[] = [];
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) { walk(`${dir}/${entry.name}`, `${prefix}${entry.name}/`); continue; }
        if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
        const path = `${prefix}${entry.name}`;
        if (path === 'DrBar.tsx') continue; // le composant ne s'importe pas lui-même
        const content = readFileSync(`${dir}/${entry.name}`, 'utf8');
        if (/from ['"].*\/DrBar['"]/.test(content)) importers.push(path);
      }
    };
    walk(uiDir.replace(/\/$/, ''), '');
    // Exception nommée : `MedicModal.tsx` — état d'opération de Chirurgie ARMÉE, visible AVANT/ENTRE
    // les passes (hors de toute rangée de jet ; `SurgeryRollFlow` n'a pas de rangée tant qu'aucune passe
    // n'est ouverte) — pas la barre d'UN jet, le cumul PERSISTANT de l'opération.
    const NAMED_EXCEPTIONS = new Set(['MedicModal.tsx']);
    expect(new Set(importers)).toEqual(new Set(['RollRow.tsx', ...NAMED_EXCEPTIONS]));
  });
});
