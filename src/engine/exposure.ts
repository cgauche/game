/**
 * Exposition (LDB 18-Traumatisme l.326-334) — un environnement difficile/extrême (froid OU chaleur).
 * « Après 4 heures passées dans un environnement difficile – comme lorsque les températures sont
 * négatives, dans un désert brûlant ou une tempête, vous devez effectuer un Test de Résistance.
 * Lorsque vous vous retrouvez dans un environnement aux conditions extrêmes, ce Test doit être
 * effectué toutes les deux heures. »
 * FROID (l.334) : 1ᵉʳ échec → −10 CT/Agilité/Dextérité ; 2ᵉ → −10 toutes les autres ; 3ᵉ+ →
 * 1d10 Dégâts ignorant les PA (min 1) ; à 0 PB → Inconscient. « Certaines Possessions accordent
 * des bonus et des pénalités pour ces Tests » : sans bon Manteau, pénalité au Test de Froid
 * (ch.65 l.44 — non chiffrée dans le canon : application déclarée −10). La PEAU DE PHOQUE (MDG 14
 * l.277-279 : « +1 DR sur les Tests de Résistance effectués pour supporter l'exposition au froid »)
 * est consommée par `sealskinDR` : sur un Test BINAIRE, le +1 DR retient l'échec de justesse
 * (échec dont le DR remonte à ≥ +1) — lecture déclarée, aucun ±10 inventé.
 * CHALEUR (l.330) : 1ᵉʳ échec → −10 Int/FM + 1 Exténué ; 2ᵉ → −10 toutes les autres + 1 Exténué ;
 * 3ᵉ+ → 1d10 Dégâts ignorant les PA (min 1). (« Vous débarrasser d'une Possession lourde annule
 * 1 Test échoué » : choix interactif non simulé au niveau agrégé — décision documentée.)
 *
 * Applications déclarées (le canon ne chiffre pas le sommeil dehors) :
 *  - une NUIT (~8 h) en environnement difficile = 2 Tests (1/4 h) ; extrême = 4 Tests (1/2 h) ;
 *  - un ABRI (Tente, ch.74 — ou abri construit, Survie en extérieur ch.09 l.559) ANNULE
 *    l'Exposition d'une nuit difficile, et ramène une nuit extrême au rythme difficile (2 Tests) ;
 *  - les pénalités d'Exposition se dissipent après 24 h (purge d'horloge #T3) ;
 *  - la météo de scène donne la sévérité : pluie/neige = difficile, tempête = extrême (froid).
 * Pur : mute `c`, renvoie jets + journal.
 */
import type { Combatant, CharKey, Difficulty } from './types';
import type { RNG } from './dice';
import { rollTest } from './tests';
import { addCondition, hasCondition, loseWounds } from './conditions';
import { hasCapability, itemCapability } from './capabilities';

export type ExposureSeverity = 'clement' | 'difficile' | 'extreme';

/** Sévérité d'Exposition dérivée de la météo de scène (donnée d'auteur — pas de simulation). */
export function weatherExposure(weather?: string): ExposureSeverity {
  if (weather === 'tempete') return 'extreme';
  if (weather === 'pluie' || weather === 'neige') return 'difficile';
  return 'clement';
}

/** Le personnage PORTE-t-il une protection contre les intempéries (Manteau/Cape, ch.65 l.44) ? Capacité
 *  `weatherProtection` AGRÉGÉE et GATÉE sur le port (`engine/capabilities`) — une cape doit être PORTÉE
 *  pour protéger du froid ; lue PAR ID (≠ nom de l'objet). */
export function hasCoat(c: Combatant): boolean {
  return hasCapability(c, 'weatherProtection');
}

/** Un abri (Tente) dans le paquetage du groupe ? (campement — application déclarée). Capacité `isShelter`
 *  par-OBJET, NON gatée sur le port (une tente n'a pas à être « portée » au sens armure pour abriter le
 *  camp) — lue PAR ID dans le catalogue (≠ nom de l'objet). */
export function partyHasTent(party: Combatant[]): boolean {
  return party.some((h) => (h.items ?? []).some((it) => itemCapability(it, 'isShelter')));
}

/** Peau de phoque (MDG 14 l.277-279) : « +1 DR sur les Tests de Résistance effectués pour supporter
 *  l'exposition au froid » — capacité `sealskin`, GATÉE sur le port (c'est un pardessus). */
export function sealskinDR(c: Combatant): number {
  return hasCapability(c, 'sealskin') ? 1 : 0;
}

export interface ExposureRoll {
  base: number;
  target: number;
  roll: number;
  sl: number;
  success: boolean;
}

/** Volet d'Exposition (LDB 18 l.330/334) — deux cascades distinctes, un SEUL système. */
export type ExposureKind = 'froid' | 'chaleur';

const FIRST_FAIL: Record<ExposureKind, CharKey[]> = {
  froid: ['CT', 'Ag', 'Dex'],
  chaleur: ['Int', 'FM'],
};
const SECOND_FAIL: Record<ExposureKind, CharKey[]> = {
  froid: ['CC', 'F', 'E', 'I', 'Int', 'FM', 'Soc'],
  chaleur: ['CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Soc'],
};

/** Nombre de Tests d'une nuit dehors selon sévérité et abri. */
export function exposureTestCount(severity: ExposureSeverity, sheltered: boolean): number {
  if (severity === 'clement') return 0;
  if (severity === 'extreme') return sheltered ? 2 : 4;
  return sheltered ? 0 : 2;
}

/** Protection magique contre les intempéries (op `weatherWard`) : aucun Test de froid tant qu'elle dure. */
export function isWeatherWarded(c: Combatant): boolean {
  return (c.activeEffects ?? []).some((e) => e.weatherImmune);
}

/** Cible (et base) d'UN Test d'Exposition au froid : Résistance +0, −10 sans manteau ni cape (ch.65 l.44). */
export function exposureTarget(c: Combatant, resVal: number): number {
  return Math.max(0, resVal + (hasCoat(c) ? 0 : -10));
}

/**
 * Applique la `failures`-ième défaillance d'Exposition (RAW l.330/334, escalade CUMULATIVE —
 * c'est cette dépendance qui rend la séquence SÉQUENTIELLE). Froid : 1 → −10 CT/Ag/Dex ; 2 → −10 le
 * reste ; 3+ → 1d10 Blessures (ignore les PA), Inconscient à 0 PB. Chaleur : 1 → −10 Int/FM
 * + Exténué ; 2 → −10 le reste + Exténué ; 3+ → 1d10 Blessures (ignore les PA). Mute `c` ; renvoie
 * le journal + les Blessures infligées. Partagé par `exposureNight` (eager), l'applicateur de
 * cascade « exposure » et la Température en mer (MDG 13 l.203-225).
 */
export function applyExposureFailure(c: Combatant, failures: number, rng: RNG, kind: ExposureKind = 'froid'): { log: string[]; wounds: number } {
  const log: string[] = [];
  const label = kind === 'froid' ? 'Exposition (froid)' : 'Exposition (chaleur)';
  const effectId = kind === 'froid' ? 'exposition-froid' : 'exposition-chaleur';
  if (failures <= 2) {
    for (const k of (failures === 1 ? FIRST_FAIL : SECOND_FAIL)[kind]) {
      c.activeEffects = [...(c.activeEffects ?? []), { label, effectId, char: k, bonus: -10, duration: { scale: 'permanent' } }];
    }
    if (kind === 'chaleur') addCondition(c, 'extenue'); // « vous gagnez un État Exténué » (1ᵉʳ ET 2ᵉ échec, l.330)
    log.push(kind === 'froid'
      ? (failures === 1 ? `${c.name} grelotte — −10 CT/Agilité/Dextérité (Exposition au froid).` : `${c.name} est transi — −10 à toutes les autres Caractéristiques.`)
      : (failures === 1 ? `${c.name} suffoque de chaleur — −10 Intelligence/Force Mentale, +1 Exténué.` : `${c.name} est accablé — −10 à toutes les autres Caractéristiques, +1 Exténué.`));
    return { log, wounds: 0 };
  }
  const dmg = Math.max(1, rng.int(1, 10));
  loseWounds(c, dmg);
  log.push(`${c.name} souffre ${kind === 'froid' ? 'du froid' : 'de la chaleur'} : ${dmg} Blessure(s) (ignore les PA).`);
  if (kind === 'froid' && c.wounds.current <= 0 && !hasCondition(c, 'inconscient')) {
    addCondition(c, 'inconscient');
    log.push(`${c.name} sombre, gelé — Inconscient.`);
  }
  return { log, wounds: dmg };
}

/**
 * Une PÉRIODE d'Exposition pour `c` : `count` Tests de Résistance à `difficulty` (défaut +0) — au
 * froid : −10 sans manteau (ch.65 l.44), la peau de phoque (+1 DR, MDG 14 l.277) retient l'échec
 * de justesse. Applique les échecs en cascade (RAW l.330/334, via `applyExposureFailure`).
 * Renvoie les jets et le journal. Nommée « night » pour la nuit dehors historique — sert aussi la
 * journée en mer (MDG 13 l.203-225).
 */
export function exposureNight(
  c: Combatant, count: number, resVal: number, rng: RNG,
  opts: { kind?: ExposureKind; difficulty?: Difficulty } = {},
): { rolls: ExposureRoll[]; log: string[]; failures: number; wounds: number } {
  const kind = opts.kind ?? 'froid';
  if (isWeatherWarded(c)) {
    return { rolls: [], log: [`${c.name} ignore ${kind === 'froid' ? 'le froid et les intempéries' : 'la chaleur'} (protection magique).`], failures: 0, wounds: 0 };
  }
  const rolls: ExposureRoll[] = [];
  const log: string[] = [];
  let failures = 0;
  let wounds = 0;
  const target = kind === 'froid' ? exposureTarget(c, resVal) : Math.max(0, resVal);
  const skin = kind === 'froid' ? sealskinDR(c) : 0;
  for (let i = 0; i < count; i++) {
    const res = rollTest(target, opts.difficulty ?? 'intermediaire', rng);
    // Peau de phoque : « +1 DR … pour supporter l'exposition au froid » (MDG 14 l.277) — sur un Test
    // binaire, l'échec dont le DR remonte à ≥ +1 est TENU (lecture déclarée, cf. en-tête).
    const held = !res.success && skin > 0 && res.sl + skin >= 1;
    rolls.push({ base: target, target: res.target, roll: res.roll, sl: res.sl + (res.success ? 0 : skin), success: res.success || held });
    if (res.success) continue;
    if (held) { log.push(`${c.name} — la peau de phoque retient le froid (échec de justesse tenu, +1 DR).`); continue; }
    failures++;
    const f = applyExposureFailure(c, failures, rng, kind);
    log.push(...f.log);
    wounds += f.wounds;
  }
  if (kind === 'froid' && !hasCoat(c) && count > 0) log.push(`${c.name} n'a ni manteau ni cape — le froid mord (−10 aux Tests d'Exposition).`);
  return { rolls, log, failures, wounds };
}

/** Pose une échéance d'horloge sur les pénalités d'Exposition (dissipation après 24 h au chaud/au frais). */
export function expireExposureEffects(c: Combatant, untilTime: number): void {
  for (const e of c.activeEffects ?? []) {
    if ((e.effectId === 'exposition-froid' || e.effectId === 'exposition-chaleur') && e.duration.scale === 'permanent') e.duration = { scale: 'clock', until: untilTime };
  }
}
