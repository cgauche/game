// @vitest-environment jsdom
/**
 * #1078 LOT B2 — ZONES des fenêtres de SOIN, contrat POSITIF mesuré à l'ÉCRAN (montage réel, patron
 * `createRoot`/`act` du repo) sur les DEUX hôtes : la modale de Guérison (`HealRollFlow`) et le
 * dossier d'opération de l'infirmerie (`MedicModal` → `SurgeryRollFlow`).
 *  - la DIFFICULTÉ se lit à UNE seule place, la LIGNE du jet (`.rm-roll-diff`, #1072) ;
 *  - l'A→B est le bandeau `VsHeader` (portraits + flèche annotée de l'acte) quand le soignant EST un
 *    `Combatant` ; face à un PNJ tarifé (aucune fiche), l'acte reste lisible en note, sans bandeau ;
 *  - le patient y est en cadre `full` : ses pastilles d'ÉTATS sont ce que le jet fait bouger ;
 *  - EMBARQUÉ dans l'infirmerie, aucun bandeau : la bande de patients le porte déjà.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { HealRollFlow } from './HealModal';
import { MedicModal } from './MedicModal';
import { DIFFICULTY_LABELS, type Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, label: id, kind: 'hero', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 12, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useGame.setState({ battle: null, party: [], pendingHeal: null, pendingSurgery: null, medic: null } as never);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, party: [], pendingHeal: null, pendingSurgery: null, medic: null } as never);
});

/** Ce qu'un joueur LIT dans la fenêtre, espaces normalisés. */
const screen = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const occurrences = (needle: string) => screen().split(needle).length - 1;
/** Texte de la zone de Difficulté de la ligne de jet. */
const diffZone = () => [...host.querySelectorAll('.rm-roll-diff')].map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim());

const DIFF = 'accessible' as const;
const LABEL = DIFFICULTY_LABELS[DIFF]; // « Accessible (+20) »

describe('Guérison (HealRollFlow) — la Difficulté vit sur la LIGNE', () => {
  it('elle se lit UNE fois, et c’est dans `.rm-roll-diff`', () => {
    const healer = mk('Soigneur');
    const patient = mk('Blessé');
    useGame.setState({
      battle: null, party: [healer, patient],
      pendingHeal: {
        healerId: healer.id, healerName: healer.label, targetId: patient.id, targetName: patient.label,
        mode: 'wounds', intBonus: 4, skillValue: 45, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
      },
    } as never);
    act(() => root.render(<HealRollFlow />));
    expect(diffZone(), 'la ligne du jet porte la Difficulté').toEqual([`— ${LABEL}`]);
    expect(occurrences(LABEL), 'et elle ne se lit nulle part ailleurs').toBe(1);
    // A→B CANONIQUE (décision utilisateur 2026-08-04) : bandeau de portraits + flèche annotée de
    // l'acte — aucune phrase « A soigne B » ne subsiste dans la fenêtre.
    const vs = host.querySelectorAll('.rm-vs');
    expect(vs, 'un bandeau d’opposition, un seul').toHaveLength(1);
    expect(vs[0].children, 'A → B : les deux portraits encadrent la flèche').toHaveLength(3);
    expect(vs[0].querySelector('.rm-vs-arrow')?.textContent, 'la flèche annonce l’acte').toContain('Blessures');
    expect(screen(), 'plus aucun A→B TEXTUEL').not.toMatch(/soigne |rééduque |opère /);
  });
});

describe('fenêtre de Guérison — le patient montre ses ÉTATS, et une seule fois', () => {
  const bleeding = () => mk('Blessé', { conditions: [{ id: 'hemorragique', value: 2 }] } as never);
  const put = (patient: Combatant, healer: Combatant | null) => {
    useGame.setState({
      battle: null, party: healer ? [healer, patient] : [patient],
      pendingHeal: {
        healerId: healer?.id ?? 'pnj-soigneur', healerName: healer?.label ?? 'Médecin',
        targetId: patient.id, targetName: patient.label,
        mode: 'bleed', intBonus: 4, skillValue: 45, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
      },
    } as never);
  };

  it('mode `bleed` : les pastilles d’ÉTATS du patient sont visibles (cadre `full`)', () => {
    const patient = bleeding();
    put(patient, mk('Soigneur'));
    act(() => root.render(<HealRollFlow />));
    const vs = host.querySelector('.rm-vs')!;
    expect(vs.querySelectorAll('.ptile-states').length, 'le CIBLÉ porte ses États').toBeGreaterThan(0);
    expect(vs.querySelectorAll('.pt-state').length, 'l’Hémorragie se suit passe par passe').toBeGreaterThan(0);
  });

  it('EMBARQUÉ dans l’infirmerie : aucun bandeau (la bande de patients porte déjà le patient)', () => {
    const patient = bleeding();
    put(patient, mk('Soigneur'));
    act(() => root.render(<HealRollFlow embedded />));
    expect(host.querySelectorAll('.rm-vs'), 'pas de second portrait du patient').toHaveLength(0);
  });
});

describe('Guérison par un PNJ tarifé — pas d’A→B sans fiche', () => {
  it('soigneur PNJ (id sentinelle, absent du groupe) : aucun bandeau, mais l’acte reste lisible', () => {
    const patient = mk('Blessé');
    useGame.setState({
      battle: null, party: [patient],
      pendingHeal: {
        healerId: 'pnj-soigneur', healerName: 'Médecin', targetId: patient.id, targetName: patient.label,
        mode: 'wounds', intBonus: 4, skillValue: 45, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
      },
    } as never);
    act(() => root.render(<HealRollFlow />));
    expect(host.querySelectorAll('.rm-vs'), 'pas d’A→B sans acteur à opposer').toHaveLength(0);
    expect(screen(), 'l’acte et le patient se disent quand même').toContain('Blessures — Blessé');
  });
});

describe('Chirurgie (MedicModal → SurgeryRollFlow) — la Difficulté vit sur la LIGNE', () => {
  it('elle se lit UNE fois, et c’est dans `.rm-roll-diff`', () => {
    const surgeon = mk('Chirurgien');
    const patient = mk('Opéré', { traumas: [{ label: 'Fracture', location: 'brasG', surgery: true }] } as never);
    useGame.setState({
      battle: null, party: [surgeon, patient],
      medic: {
        patientId: patient.id,
        surgery: { kind: 'surgery', difficulty: DIFF, healerId: surgeon.id, healerName: surgeon.label, skill: 45, intBonus: 4, traumaIdx: 0, targetDR: 6, cumDR: 2 },
      },
      pendingSurgery: {
        healerId: surgeon.id, healerName: surgeon.label, targetId: patient.id, targetName: patient.label,
        kind: 'surgery', skillValue: 45, intBonus: 4, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
        traumaIdx: 0, targetDR: 6, cumDR: 2,
      },
    } as never);
    act(() => root.render(<MedicModal />));
    expect(diffZone(), 'la ligne de la passe porte la Difficulté').toEqual([`— ${LABEL}`]);
    expect(occurrences(LABEL), 'et elle ne se lit nulle part ailleurs').toBe(1);
  });
});

describe('dossier d’opération — l’A→B n’est rendu que s’il EXISTE', () => {
  const patient = () => mk('Opéré', { traumas: [{ label: 'Fracture', location: 'brasG', surgery: true }] } as never);
  /** Ouvre le dossier d'opération d'un patient, le chirurgien étant du GROUPE ou un PNJ tarifé
   *  (`healerId` sentinelle posé par `medicFlow.medicAct`, absent du groupe). */
  const openSurgery = (healerId: string, party: Combatant[]) => {
    useGame.setState({
      battle: null, party, pendingSurgery: null,
      medic: {
        patientId: party[party.length - 1].id,
        surgery: { kind: 'surgery', difficulty: DIFF, healerId, healerName: 'Docteur', skill: 45, intBonus: 4, traumaIdx: 0, targetDR: 6, cumDR: 2 },
      },
    } as never);
    act(() => root.render(<MedicModal />));
  };

  it('chirurgien du GROUPE : bandeau A→B complet (les deux portraits, l’acte annoncé)', () => {
    const surgeon = mk('Chirurgien');
    const p = patient();
    openSurgery(surgeon.id, [surgeon, p]);
    const vs = host.querySelectorAll('.rm-vs');
    expect(vs, 'un seul bandeau d’opposition').toHaveLength(1);
    // Bandeau COMPLET = portrait A + flèche annotée + portrait B (les `CharFrame` de `VsHeader`
    // rendent la vitalité, pas les noms — la structure est ce qui se mesure).
    expect(vs[0].children, 'A → B : les deux portraits encadrent la flèche').toHaveLength(3);
    expect(vs[0].querySelector('.rm-vs-arrow')?.textContent?.replace(/\s+/g, ' '), 'l’acte est annoncé sur la flèche').toContain('Chirurgie');
  });

  it('PNJ tarifé (aucune fiche) : AUCUN bandeau dégénéré, mais l’acte reste lisible', () => {
    const p = patient();
    openSurgery('pnj-soigneur', [p]);
    expect(host.querySelectorAll('.rm-vs'), 'pas d’A→B sans acteur à opposer').toHaveLength(0);
    expect(screen(), 'l’acte et le patient se disent quand même').toContain('Chirurgie — Opéré');
  });
});
