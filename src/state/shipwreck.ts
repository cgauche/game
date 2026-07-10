/**
 * NAUFRAGE EN MER — séquence de survie GÉNÉRIQUE (aucun couplage campagne), un SEUL chemin pour les deux
 * sites où le navire de campagne coule : l'avarie de voyage (`seaVoyageFlow`, coque à 0 hors combat) et le
 * combat naval perdu avec la coque coulée (`checkBattleOver`). Une coque coule quand ses Blessures tombent
 * à 0 (MDG 13 l.674 : « Quand l'Indice devient égal au score d'Endurance du navire, il coule »).
 *
 * Cascade : chaque héros à bord tente de rejoindre la surface à la NAGE — Test de Natation (LDB 09 l.372 :
 * « votre capacité à nager dans l'eau sans vous noyer… dans des courants difficiles… un Test sera
 * nécessaire »). Difficulté d'un naufrage en pleine mer : ancrage RAW le plus proche = la noyade du
 * Tourbillon (MDG 13 l.522 : « Natation Complexe (–10) sous peine de commencer à se noyer ») → défaut
 * MAISON `sea-shipwreck-swim` (#244, éditable). Échec = noyade (LDB 18 l.344, sans secours en pleine mer,
 * la suffocation va à son terme). Un héros hors d'action (Inconscient) ne peut pas nager : il
 * sombre. Les rescapés sont échoués au lieu le PLUS PROCHE de la position estimée (la carte le sait) ; le
 * navire et sa cargaison sont perdus ; si personne ne survit, `checkPartyWiped` présente la défaite.
 */
import { battleRng } from './battleRng';
import { checkPartyWiped } from './partyWipe';
import { placeById, placeOfScene, type WorldMap, type MapPlace } from './worldMap';
import { rollTest } from '../engine/tests';
import { testValue } from '../engine/skills';
import { isOutOfAction } from '../engine/conditions';
import { rule } from '../engine/policy';
import { DIFFICULTY_LABELS, type Difficulty } from '../engine/types';
import type { Get, Set } from './flowTypes';

/** Lieu le plus proche d'un point de la carte (distance euclidienne sur `pos`). */
function nearestPlaceTo(map: WorldMap, pos: { x: number; y: number }): MapPlace | undefined {
  let best: MapPlace | undefined;
  let bestD = Infinity;
  for (const p of map.places) {
    const d = (p.pos.x - pos.x) ** 2 + (p.pos.y - pos.y) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** Lieu d'échouage : le plus proche de la position estimée sur la traversée (`kmDone/km` interpolé entre
 *  départ et arrivée), sinon le lieu de la scène courante. `undefined` = pas de carte (on reste sur place). */
function shorePlace(get: Get): MapPlace | undefined {
  const map = get().worldMap as WorldMap | undefined;
  if (!map) return undefined;
  const plan = get().travelPlan;
  if (plan?.fromPlaceId && plan.toPlaceId) {
    const from = placeById(map, plan.fromPlaceId);
    const to = placeById(map, plan.toPlaceId);
    if (from && to) {
      const frac = plan.km > 0 ? Math.max(0, Math.min(1, plan.kmDone / plan.km)) : 0;
      const est = { x: from.pos.x + (to.pos.x - from.pos.x) * frac, y: from.pos.y + (to.pos.y - from.pos.y) * frac };
      return nearestPlaceTo(map, est);
    }
  }
  return placeOfScene(map, get().scene?.id);
}

/**
 * NAUFRAGE : le navire de campagne coule. Résout la survie à la nage de chaque héros à bord, échoue les
 * rescapés au rivage le plus proche, PURGE le navire (coque + cargaison perdues) et surface le dénouement
 * (modale document + journal). `aboardIds` : héros à bord (défaut = tout le groupe vivant) — le combat
 * naval passe l'équipage de la coque coulée. No-op si aucun navire.
 */
export function beginShipwreck(get: Get, set: Set, opts: { aboardIds?: string[] } = {}): void {
  const vessel = get().vessel;
  const shipName = vessel?.name ?? 'Le navire';
  const rng = battleRng();
  const diff = rule('sea-shipwreck-swim') as Difficulty;
  const shore = shorePlace(get);

  const aboardSet = opts.aboardIds ? new Set(opts.aboardIds) : null;
  const lines: string[] = [`${shipName} sombre corps et biens (MDG ch.13 l.674).`];
  const survivors: string[] = [];
  const drowned: string[] = [];

  const party = get().party.map((h) => {
    const aboard = aboardSet ? aboardSet.has(h.id) : !h.dead;
    if (!aboard || h.dead) return h;
    // Un héros HORS D'ÉTAT ne peut pas nager (LDB 18 l.344 : suffocation) → il sombre — prédicat de
    // cycle de vie canonique (`isOutOfAction`, machinerie universelle), jamais un test par-État nommé.
    // Un rescapé passé par-dessus bord (`outOfRencontre`, MDG 13) reste conscient : il nage ci-dessous —
    // `outOfRencontre` seul (l'éjection du COMBAT que ce naufrage vient de résoudre) n'incapacite pas,
    // donc écarté du prédicat ; dead/inconscient/Mort Subite restent des voies RÉELLES d'incapacité.
    if (isOutOfAction({ ...h, outOfRencontre: false })) {
      drowned.push(h.name);
      lines.push(`${h.name} — inconscient dans les flots : emporté sans pouvoir nager (noyé, LDB 18 l.344).`);
      return { ...h, dead: true };
    }
    const value = testValue(h, 'natation', 'F');
    const t = rollTest(value, diff, rng);
    lines.push(`${h.name} — Natation (${DIFFICULTY_LABELS[diff]}) : ${t.roll}/${t.target} → ${t.success ? 'rejoint la surface et nage vers la côte.' : 'emporté par les flots (noyé, LDB 18 l.344).'}`);
    if (t.success) { survivors.push(h.name); return { ...h, outOfRencontre: false, exitReason: undefined }; }
    drowned.push(h.name);
    return { ...h, dead: true };
  });

  if (shore) lines.push(survivors.length
    ? `Les rescapés (${survivors.join(', ')}) s'échouent à ${shore.label}.`
    : `Nul rescapé ne touche terre.`);

  // Navire + cargaison sombrent avec la coque (#244, règle 7). `vessel` → null : plus de navire.
  set({ party, vessel: null, travelPlan: null, travelRecap: null, worldMapOpen: false });

  // Échouage : transition AVANT la modale (transitionTo purge `document` via resetFields('scene')).
  if (survivors.length && shore) get().transitionTo(shore.scene, shore.entry);

  const journal = [...get().journal.slice(-40), '— NAUFRAGE —', ...lines];
  set({ journal });
  set({ document: { title: 'Naufrage', text: lines.join('\n') } });

  // Aucun survivant → défaite hors combat (écran unique `checkPartyWiped`).
  checkPartyWiped(get, set);
}
