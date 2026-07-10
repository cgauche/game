/**
 * Garde croisée des DEUX espaces de clés « race » (issue #163). Le repo porte deux conventions
 * de nommage de race, DISTINCTES par dessein :
 *  - espace « données de personnage » (`species.refChar`/`species.refCareer`) : `Haut Elfe`, `Elfe
 *    Sylvain`… — clé de `names.json`, `careers.json`, `eyes.json`, `hairs.json`, `details.json` ;
 *  - espace « rig » (id d'apparence, sûr pour nom de fichier) : `Haut-Elfe`, `Elfe sylvain`… — id de
 *    `raceAppearance.json` et des defs de `src/gameIso/rig/`.
 * `speciesRace.json` (via `baseSpeciesOf`) EST le pont species→rig. Les deux espaces se ressemblent
 * (5 des 7 races jouables sont identiques ; seuls les elfes divergent par tiret/casse) mais NE se
 * confondent pas : les unifier casserait l'un des deux clans (des dizaines de fichiers chacun).
 * Cette garde rend le découplage EXPLICITE et mécanique : elle échoue si `names.json` dérive hors de
 * l'espace `refChar`, si le pont n'est plus 1:1, ou si une clé d'un espace se met à RESSEMBLER à une
 * clé de l'autre (casse/tiret/espace) sans être le couple ponté sanctionné.
 */
import { describe, it, expect } from 'vitest';
import namesJson from './names.json';
import raceAppearanceJson from './raceAppearance.json';
import speciesJson from './species.json';
import { baseSpeciesOf } from '../gameIso/rig/skeletons';

type Species = { label: string; refChar: string };
const SPECIES = speciesJson as Species[];
const NAMES_KEYS = Object.keys(namesJson);
const RIG_IDS = (raceAppearanceJson as { id: string }[]).map((r) => r.id);

/** Deux libellés « se ressemblent » s'ils sont égaux à la casse, aux espaces et aux tirets près. */
const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '');

describe('#163 — names.json ⇄ speciesRace.json : deux espaces de clés découplés, pont species→rig gardé', () => {
  it('names.json est ancré à l’espace refChar (clés === {species.refChar}) — pas à l’espace rig', () => {
    const refChars = new Set(SPECIES.map((s) => s.refChar));
    // Toute clé de names.json doit être un refChar connu (ex. `Haut Elfe`), JAMAIS un id de rig
    // (`Haut-Elfe`) : c'est ce qui empêche la fusion silencieuse des deux espaces.
    expect(new Set(NAMES_KEYS)).toEqual(refChars);
  });

  it('pont species→rig 1:1 : chaque refChar mappe (via baseSpeciesOf) vers exactement UN id de rig existant', () => {
    const rigIds = new Set(RIG_IDS);
    const bridge = new Map<string, Set<string>>();
    for (const s of SPECIES) {
      const rig = baseSpeciesOf(s.label);
      expect(rigIds, `baseSpeciesOf(${JSON.stringify(s.label)}) = ${JSON.stringify(rig)} absent de raceAppearance.json`).toContain(rig);
      (bridge.get(s.refChar) ?? bridge.set(s.refChar, new Set()).get(s.refChar)!).add(rig);
    }
    const ambiguous = [...bridge].filter(([, rigs]) => rigs.size > 1).map(([refChar, rigs]) => `${refChar} → ${[...rigs].join(', ')}`);
    expect(ambiguous, 'refChar(s) pontant vers PLUSIEURS races de rig — le pont species→rig doit rester 1:1').toEqual([]);
  });

  it('garde de ressemblance : toute quasi-collision names-key ⇄ id-rig est le couple ponté EXACT, jamais un accident', () => {
    // Couples sanctionnés = ceux qu'établit réellement le pont (refChar → baseSpeciesOf).
    const sanctioned = new Set(SPECIES.map((s) => `${s.refChar}\0${baseSpeciesOf(s.label)}`));
    const violations: string[] = [];
    for (const key of NAMES_KEYS) {
      for (const rig of RIG_IDS) {
        if (norm(key) !== norm(rig)) continue; // pas de ressemblance → pas de risque de confusion
        if (key === rig) continue; // identiques (Nain, Humain…) : aucun risque
        // Ressemblent SANS être identiques (Haut Elfe ⇄ Haut-Elfe) : n'est toléré que si le pont
        // species→rig établit précisément ce couple. Sinon = future collision latente.
        if (!sanctioned.has(`${key}\0${rig}`))
          violations.push(`names.json[${JSON.stringify(key)}] ressemble à l’id de rig ${JSON.stringify(rig)} sans pont species→rig les reliant`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
