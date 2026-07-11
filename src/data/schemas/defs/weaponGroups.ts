/**
 * Schéma de `weaponGroups.json` — registre des Groupes d'objet (armes/munitions/armures/inventaire),
 * miroir de `WeaponGroupData` (`src/data/index.ts:484-495`). `material` : matériau d'armure typé
 * (exemptions de Magie des Arcanes, LDB 46 l.188) — présent seulement sur `kind:'armour'`. `combat` :
 * sous-ensemble melee/ranged (SOURCE des pools `weaponGroupsMelee`/`weaponGroupsRanged`) — présent
 * seulement sur `kind:'weapon'`/`'ammo'` combattants (absent sur les Groupes de siège/inventaire).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'weaponGroups.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    kind: z.enum(['weapon', 'ammo', 'armour', 'inventory']),
    material: z.enum(['metal', 'leather']).optional(),
    combat: z.enum(['melee', 'ranged']).optional(),
    source: sourceRefSchema.optional(),
  }),
);

export type WeaponGroupsData = z.infer<typeof schema>;
