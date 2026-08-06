/**
 * CLIQUET NOMINATIF « un enjeu porte sa RÈGLE » (#1117 L0b) — jumeau du cliquet « une étape dit son
 * enjeu » (`state/cascade-step-stake-guard`), à l'étage de la DONNÉE : chaque entrée d'un dataset
 * d'enjeux doit renvoyer vers une fiche de `regles.json`, pour que la règle soit à UN CLIC.
 *
 * Le stock RESTANT est ÉNUMÉRÉ nominativement et DÉCROISSANT : chaque lot de curation (patron L0a)
 * retire ses ids d'ici. Fail-closed : une entrée NEUVE sans règle, ou un renvoi MORT, échoue.
 * La nuit est SOLDÉE (15/15 depuis L0a) — aucune tolérance n'y est ouverte.
 */
import { describe, it, expect } from 'vitest';
import {
  NIGHT_STAKES, VOYAGE_STAKES, FLOW_STAKES,
  regles, skills, symptoms, etats, talents, qualities, spells,
  characteristics, psychologies, seaShanties, crewTestTypes,
} from './index';
import { STEAM_BREAKDOWNS } from '../engine/shipBuild';


/** Entrées d'enjeu de VOYAGE encore sans fiche — chacune attend SA curation verbatim (patron L0a).
 *  Mesuré le 2026-08-06 : 12 sur 33. Retirer un id d'ici est le geste de solde. */
const VOYAGE_SANS_REGLE = [
  // Fluvial — périls de rivière (MSRC 7 : tables de dangers) et esquive d'éclats.
  'river-peril-nav',
  'river-peril-detect',
  'river-splinter-dodge',
  // Maritime — survitesse, rythme forcé, épuisement, maladies de bord, exposition, dégagement.
  'sea-overspeed',
  'sea-force-pace',
  'sea-epuisement',
  'sea-scorbut',
  'sea-mal-de-mer',
  'sea-tonneau-expose',
  'sea-tonneau-contamine',
  'exposure',
  'sea-degagement',
];

describe('cliquet — un enjeu porte sa RÈGLE (#1117)', () => {
  it('la cascade de NUIT est soldée : chaque entrée renvoie vers une fiche', () => {
    const sans = NIGHT_STAKES.filter((e) => !e.rule).map((e) => e.id);
    expect(sans, 'entrée de nuit sans règle — la nuit est soldée depuis L0a').toEqual([]);
  });

  it('le stock VOYAGE sans règle est EXACTEMENT celui énuméré (ni plus — ni périmé)', () => {
    const sans = VOYAGE_STAKES.filter((e) => !e.rule).map((e) => e.id).sort();
    const attendu = [...VOYAGE_SANS_REGLE].sort();
    const neufs = sans.filter((id) => !VOYAGE_SANS_REGLE.includes(id));
    expect(neufs, 'entrée d’enjeu NEUVE sans règle — une entrée qui naît naît avec sa fiche').toEqual([]);
    const soldes = VOYAGE_SANS_REGLE.filter((id) => !sans.includes(id));
    expect(soldes, 'stock PÉRIMÉ : ces entrées ont désormais leur règle — les retirer de la liste').toEqual([]);
    expect(sans).toEqual(attendu);
  });

  it('aucun renvoi MORT : chaque `rule` déclarée existe dans SON foyer', () => {
    // Le foyer peut être une ENTITÉ (amendement A) : la catégorie voyage avec l'id. Les trois datasets
    // passent par le MÊME contrôle — un renvoi mort est un renvoi mort, quelle que soit la famille.
    const FOYERS: Record<string, { id: string }[]> = {
      regles, skills, symptoms, etats, talents, qualities, spells,
      characteristics, psychologies, seaShanties, crewTestTypes,
      steamBreakdowns: STEAM_BREAKDOWNS,
    };
    const cat = (e: { ruleCategory?: string | undefined }) => e.ruleCategory ?? 'regles';
    const morts = [...NIGHT_STAKES, ...VOYAGE_STAKES, ...FLOW_STAKES]
      .filter((e) => e.rule && !(FOYERS[cat(e as { ruleCategory?: string })] ?? []).some((x) => x.id === e.rule))
      .map((e) => `${e.id} → ${cat(e as { ruleCategory?: string })}:${e.rule}`);
    expect(morts, 'renvoi vers un foyer inexistant').toEqual([]);
  });

  it('le stock DÉCROÎT : le plafond mesuré ne remonte pas', () => {
    expect(VOYAGE_STAKES.filter((e) => !e.rule).length).toBeLessThanOrEqual(12);
  });

  /**
   * Fiches curées en L1a pour les MODALES MONO : leur consommateur (`flow-stakes`, id de jet
   * {flow, phase}) est né en L1b — le stock d'attente est SOLDÉ. L'assertion reste, INVERSÉE : chaque
   * fiche curée pour un jet DOIT désormais être référencée par un dataset d'enjeu. Une fiche qui
   * perdrait son référent (câblage retiré) rougit — c'est la dette muette que l'amendement A combat.
   */
  const FICHES_L1A_CABLEES = [
    'course', 'desengagement', 'fuite', 'chute',
    'influences-corruptrices', 'dissipation', 'au-contact',
  ];

  it('les fiches L1a existent ET sont CÂBLÉES — plus aucune en attente', () => {
    const absentes = FICHES_L1A_CABLEES.filter((id) => !regles.some((r) => r.id === id));
    expect(absentes, 'fiche annoncée par L1a mais absente du catalogue').toEqual([]);

    const referencees = new Set(
      [...NIGHT_STAKES, ...VOYAGE_STAKES, ...FLOW_STAKES].map((e) => e.rule).filter((r): r is string => !!r),
    );
    const orphelines = FICHES_L1A_CABLEES.filter((id) => !referencees.has(id));
    expect(orphelines, 'fiche L1a SANS référent : son jet ne la cite plus (câblage L1b perdu)').toEqual([]);
  });

  /**
   * Les enjeux de MODALE MONO sont soldés dès leur naissance : chaque entrée porte SA porte de
   * lecture — le foyer du jet (`rule` + `ruleCategory`) ou la catégorie de l'ENTRÉE jouée
   * (`entryCategory`). Aucune tolérance ouverte : le dataset naît sans dette.
   */
  it('chaque enjeu de modale mono porte SA porte (foyer ou entrée)', () => {
    const sans = FLOW_STAKES.filter((e) => !e.entryCategory && !(e.rule && e.ruleCategory)).map((e) => e.id);
    expect(sans, 'enjeu de modale mono sans foyer ni catégorie d’entrée').toEqual([]);
  });
});
