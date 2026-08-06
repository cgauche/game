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
import { NIGHT_STAKES, VOYAGE_STAKES, regles } from './index';

const RULE_IDS = new Set(regles.map((r) => r.id));

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

  it('aucun renvoi MORT : chaque `rule` déclarée existe au catalogue', () => {
    const morts = [...NIGHT_STAKES, ...VOYAGE_STAKES]
      .filter((e) => e.rule && !RULE_IDS.has(e.rule))
      .map((e) => `${e.id} → ${e.rule}`);
    expect(morts, 'renvoi vers une fiche inexistante').toEqual([]);
  });

  it('le stock DÉCROÎT : le plafond mesuré ne remonte pas', () => {
    expect(VOYAGE_STAKES.filter((e) => !e.rule).length).toBeLessThanOrEqual(12);
  });
});
