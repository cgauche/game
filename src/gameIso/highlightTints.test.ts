import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HIGHLIGHT_TINTS,
  RANGE_BAND_TINT,
  WALK_TINT,
  RUN_TINT,
  RING_TARGET_TINT,
  ENEMY_CUE_TINT,
  RING_CROWD_TINT,
  RING_ALLY_TINT,
  GOLD_TINT,
  GOLD_DARK_TINT,
  HALO_TINT,
  ZONE_SMOKE_TINT,
  ZONE_FIRE_TINT,
  ENGAGE_TINT,
  THREAT_TINT,
  ACTIVE_HALO_TINT,
} from './highlightTints';

/**
 * Garde d'égalité catalogue TS ↔ variables CSS (#1176 P3-0a). Le catalogue est la source lue par les
 * peintres (affine aujourd'hui, volumique demain) ; `base.css` reste la source du CSS de l'app. Tant
 * que les deux vivent, toute retouche de l'un sans l'autre ferait diverger la couleur à l'écran.
 *
 * PÉRIMÈTRE MESURÉ : chaque clé de `HIGHLIGHT_TINTS` == la valeur de la var CSS homonyme déclarée
 * dans `src/ui/styles/base.css`.
 * ANGLE MORT : le sens INVERSE n'est pas couvert — une var CSS de teinte non cataloguée (ou une
 * nouvelle var ajoutée à `base.css`) ne fait pas échouer ce test ; il ne mesure pas non plus les
 * surcharges de `--x` faites hors `:root` (thème, media query).
 */
const CSS = readFileSync(fileURLToPath(new URL('../ui/styles/base.css', import.meta.url)), 'utf8');

/** Valeur déclarée d'une variable CSS (première déclaration rencontrée), ou null. */
function cssVar(nom: string): string | null {
  const m = CSS.match(new RegExp(`${nom}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

describe('teintes de surbrillance — catalogue TS ↔ base.css', () => {
  it('la sonde lit bien une var connue (et rend null sur une var absente)', () => {
    expect(cssVar('--combat-walk')).toBe('#4f8fe0');
    expect(cssVar('--teinte-qui-nexiste-pas')).toBeNull();
  });

  it('le catalogue n’est pas vide', () => {
    expect(Object.keys(HIGHLIGHT_TINTS).length).toBeGreaterThanOrEqual(15);
  });

  it.each(Object.entries(HIGHLIGHT_TINTS))('%s == sa var CSS homonyme', (nom, hex) => {
    expect(cssVar(nom)).toBe(hex);
  });

  it('les bandes de portée couvrent les trois tons du builder', () => {
    expect(Object.keys(RANGE_BAND_TINT).sort()).toEqual(['bonus', 'malus', 'neutre']);
    expect(RANGE_BAND_TINT.neutre).toBe(cssVar('--combat-range-neutre'));
  });

  // Câblage constante nommée → clé de catalogue. Table exhaustive : chaque clé de HIGHLIGHT_TINTS est
  // réclamée une fois et une seule (les trois clés `--combat-range-*` le sont par RANGE_BAND_TINT).
  // ANGLE MORT MESURÉ : deux paires de clés partagent le MÊME octet (`--combat-enemy`/`--combat-range-malus`
  // #e0533a, `--combat-ally`/`--combat-range-bonus` #5db87a) — une inversion À L'INTÉRIEUR d'une de ces
  // paires reste invisible à une comparaison de valeur.
  const RELAIS: [string, keyof typeof HIGHLIGHT_TINTS][] = [
    ['WALK_TINT', '--combat-walk'],
    ['RUN_TINT', '--combat-run'],
    ['RING_TARGET_TINT', '--combat-target'],
    ['ENEMY_CUE_TINT', '--combat-enemy'],
    ['RING_CROWD_TINT', '--combat-crowd'],
    ['RING_ALLY_TINT', '--combat-ally'],
    ['GOLD_TINT', '--combat-gold'],
    ['GOLD_DARK_TINT', '--combat-gold-dk'],
    ['HALO_TINT', '--combat-halo'],
    ['ZONE_SMOKE_TINT', '--iso-zone-smoke'],
    ['ZONE_FIRE_TINT', '--iso-zone-fire'],
    ['ENGAGE_TINT', '--iso-engage'],
    ['THREAT_TINT', '--iso-threat'],
    ['ACTIVE_HALO_TINT', '--iso-active-halo'],
  ];
  const VALEURS: Record<string, string> = {
    WALK_TINT,
    RUN_TINT,
    RING_TARGET_TINT,
    ENEMY_CUE_TINT,
    RING_CROWD_TINT,
    RING_ALLY_TINT,
    GOLD_TINT,
    GOLD_DARK_TINT,
    HALO_TINT,
    ZONE_SMOKE_TINT,
    ZONE_FIRE_TINT,
    ENGAGE_TINT,
    THREAT_TINT,
    ACTIVE_HALO_TINT,
  };

  it.each(RELAIS)('%s relaie la valeur de %s', (nom, cle) => {
    expect(VALEURS[nom]).toBe(HIGHLIGHT_TINTS[cle]);
  });

  it('les trois bandes de portée relaient leurs clés', () => {
    expect(RANGE_BAND_TINT.bonus).toBe(HIGHLIGHT_TINTS['--combat-range-bonus']);
    expect(RANGE_BAND_TINT.neutre).toBe(HIGHLIGHT_TINTS['--combat-range-neutre']);
    expect(RANGE_BAND_TINT.malus).toBe(HIGHLIGHT_TINTS['--combat-range-malus']);
  });

  it('la table de relais couvre TOUTES les clés du catalogue, sans doublon', () => {
    const reclamees = [...RELAIS.map(([, cle]) => cle), '--combat-range-bonus', '--combat-range-neutre', '--combat-range-malus'];
    expect(new Set(reclamees).size).toBe(reclamees.length);
    expect(reclamees.sort()).toEqual(Object.keys(HIGHLIGHT_TINTS).sort());
  });
});
