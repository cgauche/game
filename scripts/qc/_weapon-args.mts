/**
 * Émet le JSON d'`args` pour les workflows (évite `tsx -e`/`node -e`, bloqués).
 *   npx tsx scripts/qc/_weapon-args.mts          → args génération (weapons-redo)
 *   npx tsx scripts/qc/_weapon-args.mts --qc      → args audit (weapons-qc, chemins PNG)
 */
import { WEAPON_FORMS, SHIELD_FORMS } from '../../src/gameIso/rig/parts/weaponForms';

if (process.argv.includes('--qc')) {
  const w = [
    ...WEAPON_FORMS.map((f) => ({ slug: f.slug, label: f.label, target: f.target, isolated: `public/qc/w-${f.slug}.png`, held: `public/qc/held-${f.slug}.png` })),
    ...SHIELD_FORMS.map((s) => ({ slug: `shield_${s.slug}`, label: s.label, target: s.target, isolated: `public/qc/w-shield_${s.slug}.png`, held: `public/qc/held-shield_${s.slug}.png` })),
  ];
  console.log(JSON.stringify(w));
} else {
  console.log(JSON.stringify(WEAPON_FORMS.map((f) => ({ label: f.label, slug: f.slug, type: f.type, target: f.target }))));
}
