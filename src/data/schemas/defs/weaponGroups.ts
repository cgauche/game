/**
 * Schéma de `weaponGroups.json` — registre des Groupes d'objet (armes/munitions/armures/inventaire),
 * miroir de `WeaponGroupData` (`src/data/index.ts:484-495`). `material` : matériau d'armure typé
 * (exemptions de Magie des Arcanes, LDB 46 l.150-152 ; troisième exemption Sorcier du Chaos, VDM 02
 * l.169) — présent seulement sur `kind:'armour'`. `combat` : sous-ensemble melee/ranged (SOURCE des
 * pools `weaponGroupsMelee`/`weaponGroupsRanged`) — présent seulement sur `kind:'weapon'`/`'ammo'`
 * combattants (absent sur les Groupes de siège/inventaire).
 */
import { z } from 'zod';
import { sourceRefSchema, qualityRefSchema } from '../common';

export const file = 'weaponGroups.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    kind: z.enum(['weapon', 'ammo', 'armour', 'inventory']),
    material: z.enum(['metal', 'leather', 'chaos']).optional(),
    combat: z.enum(['melee', 'ranged']).optional(),
    /** Qualités COMMUNES à toute la famille, mergées par `resolveQualities` (LDB 62 l.137). */
    qualities: z.array(qualityRefSchema).optional(),
    source: sourceRefSchema.optional(),
  }),
);
