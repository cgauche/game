/**
 * Comparaison d'équipement (PUR). Compare un objet (acheté au marchand) à l'objet du MÊME
 * emplacement actuellement équipé par un héros, pour l'accordéon « équiper » du marchand (retour
 * utilisateur : montrer le gain/la perte avant d'équiper). Aucune règle inventée — ne compare que
 * des stats déjà portées par les trappings (Dégâts, Allonge, Portée, Qualités, PA d'armure ;
 * Protection des boucliers via l'Atout « Protectrice N »). Présentation pure → testable hors UI.
 */
import type { Combatant, ItemInstance, HitLocation, WeaponDamageSpec, QualityInstance } from './types';
import { damageScore, isUnarmed, damageString, unarmedWeapon } from './items';
import { effectiveRange } from './weaponDamage';
import { bonus, effectiveChar } from './characteristics';
import { QUALITY_IDS } from './qualities/ids';
import { qualityRefLabel } from '../data';

export type Trend = 'up' | 'down' | 'same';
export interface CompareRow {
  label: string;
  current: string;
  next: string;
  trend: Trend;
}
export interface EquipComparison {
  slot: 'melee' | 'ranged' | 'armor' | 'shield' | 'other';
  /** Nom de l'objet du même emplacement déjà équipé par le héros (null = rien / mains nues). */
  currentName: string | null;
  rows: CompareRow[];
}

/** Rang d'Allonge pour le sens du gain (LDB 62 : Très courte < Courte < Moyenne < Longue < Très longue). */
const REACH_RANK: Record<string, number> = {
  'Très courte': 0, Courte: 1, Moyenne: 2, Longue: 3, 'Très longue': 4,
};
const ZONES: { label: string; locs: HitLocation[] }[] = [
  { label: 'Tête', locs: ['tete'] },
  { label: 'Bras', locs: ['brasG', 'brasD'] },
  { label: 'Corps', locs: ['corps'] },
  { label: 'Jambes', locs: ['jambeG', 'jambeD'] },
];

/** Un bouclier = l'arme portant l'Atout « Protectrice N » (LDB 62 l.272 — c'est la PA d'un bouclier en
 *  parade ; cet Atout est exclusif aux boucliers dans le catalogue). Détection par ID STABLE de qualité
 *  (`QualityInstance.id`) — multilangue-safe : ne dépend plus du libellé « Bouclier ». Pur (pas d'import rig). */
export function isShieldItem(i: { qualities?: QualityInstance[] }): boolean {
  return (i.qualities ?? []).some((q) => q.id === QUALITY_IDS.Protectrice);
}

const trendOf = (n: number): Trend => (n > 0 ? 'up' : n < 0 ? 'down' : 'same');
/** Indice de l'Atout « Protectrice N » (PA d'un bouclier en parade, LDB 62 l.272) — lecture structurée. */
const protectrice = (q: QualityInstance[]): number => q.find((x) => x.id === QUALITY_IDS.Protectrice)?.value ?? 0;

export function compareEquip(item: ItemInstance, hero: Combatant): EquipComparison {
  const items = hero.items ?? [];
  // « Actuellement équipé » pour une ARME = l'arme tenue dans le set actif (les Weapon dérivés `hero.weapons`),
  // plus `it.equipped` (devenu le seul seed du loadout par défaut). L'armure, elle, reste pilotée par `equipped`.
  const wielded = (hero.weapons ?? []).filter((w) => !isUnarmed(w));

  if (isShieldItem(item)) {
    const cur = wielded.find((w) => isShieldItem(w) && w.uid !== item.uid);
    const cp = protectrice(cur?.qualities ?? []);
    const np = protectrice(item.qualities);
    return {
      slot: 'shield',
      currentName: cur?.name ?? null,
      rows: [{ label: 'Protection', current: cp ? `Protectrice ${cp}` : '—', next: np ? `Protectrice ${np}` : '—', trend: trendOf(np - cp) }],
    };
  }

  if (item.kind === 'melee' || item.kind === 'ranged') {
    const cur = wielded.find((w) => w.type === item.kind && !isShieldItem(w) && w.uid !== item.uid);
    const baseline: WeaponDamageSpec | undefined = item.kind === 'melee' ? unarmedWeapon().damage : undefined; // mains nues, LDB 62 l.28
    const curDmg = cur?.damage ?? baseline;
    const rows: CompareRow[] = [
      { label: 'Dégâts', current: cur ? damageString(cur.damage) : (baseline ? `${damageString(baseline)} (mains nues)` : '—'), next: item.damage ? damageString(item.damage) : '—', trend: trendOf(damageScore(item.damage) - damageScore(curDmg)) },
    ];
    if (item.kind === 'melee') {
      const cr = REACH_RANK[cur?.reach ?? ''] ?? -1;
      const nr = REACH_RANK[item.reach ?? ''] ?? -1;
      rows.push({ label: 'Allonge', current: cur?.reach ?? '—', next: item.reach ?? '—', trend: trendOf(nr - cr) });
    } else {
      const bf = () => bonus(effectiveChar(hero, 'F')); // BF du porteur, évalué SEULEMENT pour une Portée de jet `{bf}`
      const curR = effectiveRange(cur?.range, bf), nextR = effectiveRange(item.range, bf);
      rows.push({ label: 'Portée', current: curR != null ? `${curR} m` : '—', next: nextR != null ? `${nextR} m` : '—', trend: trendOf((nextR ?? 0) - (curR ?? 0)) });
    }
    const cq = (cur?.qualities ?? []).map(qualityRefLabel);
    const nq = item.qualities.map(qualityRefLabel);
    rows.push({ label: 'Qualités', current: cq.length ? cq.join(', ') : '—', next: nq.length ? nq.join(', ') : '—', trend: 'same' });
    return { slot: item.kind, currentName: cur?.name ?? null, rows };
  }

  if (item.kind === 'armor') {
    const cur = items.filter((i) => i.equipped && i.kind === 'armor');
    const newPA = (item.pa ?? 0) - (item.damageTaken ?? 0);
    const rows: CompareRow[] = [];
    for (const z of ZONES) {
      if (!z.locs.some((l) => item.locs?.includes(l))) continue;
      const covering = cur.filter((i) => z.locs.some((l) => i.locs?.includes(l)));
      const curPA = covering.length ? Math.max(0, ...covering.map((i) => (i.pa ?? 0) - (i.damageTaken ?? 0))) : 0;
      // Le modèle prend le MAX par localisation (recomputeLoadout) → gain seulement si la neuve fait mieux.
      rows.push({ label: `PA ${z.label}`, current: String(curPA), next: String(Math.max(curPA, newPA)), trend: trendOf(newPA - curPA) });
    }
    return { slot: 'armor', currentName: cur.map((i) => i.name).join(', ') || null, rows };
  }

  return { slot: 'other', currentName: null, rows: [] };
}
