/**
 * Émet l'`args` de weapons-qc2 : partitionne les 51 entrées en
 *   full     (iso+modèle) = régénérées + non auditées au run précédent (rate-limit)
 *   heldOnly (modèle seul) = iso déjà validé.
 *   npx tsx scripts/qc/_weapon-qc2-args.mts
 */
import { WEAPON_FORMS, SHIELD_FORMS } from '../../src/gameIso/rig/parts/weaponForms';

// Slugs à RE-auditer en entier (iso+modèle) : 4 régénérés + 13 rate-limités au run 1.
const FULL = new Set([
  'arbalete', 'fouet', 'improvisee', 'fleau_grain', // régénérés
  'flechette', 'hache_lancer', 'javelot', 'rocher', // iso rate-limité
  'arquebus_rep', 'pistolet_rep', 'arquebuse', 'hochland', 'pistolet', 'tromblon', // poudre, iso rate-limité
  'shield_rond', 'shield_grand', 'shield_targe', // boucliers, iso rate-limité
]);

const items = [
  ...WEAPON_FORMS.map((f) => ({ slug: f.slug, label: f.label, target: f.target, isolated: `public/qc/w-${f.slug}.png`, held: `public/qc/held-${f.slug}.png` })),
  ...SHIELD_FORMS.map((s) => ({ slug: `shield_${s.slug}`, label: s.label, target: s.target, isolated: `public/qc/w-shield_${s.slug}.png`, held: `public/qc/held-shield_${s.slug}.png` })),
];

const full = items.filter((w) => FULL.has(w.slug));
const heldOnly = items.filter((w) => !FULL.has(w.slug));
console.log(JSON.stringify({ full, heldOnly }));
