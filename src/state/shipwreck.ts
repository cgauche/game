/**
 * NAUFRAGE EN MER — séquence de survie GÉNÉRIQUE (aucun couplage campagne), un SEUL chemin pour les deux
 * sites où le navire de campagne coule : l'avarie de voyage (`seaVoyageFlow`, coque à 0 hors combat) et le
 * combat naval perdu avec la coque coulée (`checkBattleOver`). Une coque coule quand ses Blessures tombent
 * à 0 (MDG 13 l.674 : « Quand l'Indice devient égal au score d'Endurance du navire, il coule »).
 *
 * Cascade INFLUENÇABLE (#269) : chaque héros conscient à bord tente de rejoindre la surface à la NAGE —
 * Test de Natation (LDB 09 l.372 : « votre capacité à nager dans l'eau sans vous noyer… dans des courants
 * difficiles… un Test sera nécessaire »), une ÉTAPE par héros, interactive (Chance/Pacte/Résilience) si CE
 * héros est piloté par un humain, sinon résolue-témoin (même formule, pré-roulée à l'ouverture — mêlant les
 * deux dans une même cascade, cf. `state/cascade.ts`). Aucun héros humain à bord (IA/rafale/cadence auto) →
 * résolution inline visible (patron `corruptionFlow`). Difficulté d'un naufrage en pleine mer : ancrage RAW
 * le plus proche = la noyade du Tourbillon (MDG 13 l.522 : « Natation Complexe (–10) sous peine de commencer
 * à se noyer ») → défaut MAISON `sea-shipwreck-swim` (#244, éditable). Échec = noyade (LDB 18 l.344, sans
 * secours en pleine mer, la suffocation va à son terme). Un héros hors d'action (Inconscient) ne peut pas
 * nager : il sombre SANS jet. Les rescapés sont échoués au lieu le PLUS PROCHE de la position estimée (la
 * carte le sait) ; le navire et sa cargaison sont perdus ; si personne ne survit, `checkPartyWiped` présente
 * la défaite.
 */
import { battleRng } from './battleRng';
import { checkPartyWiped } from './partyWipe';
import { placeById, placeOfScene, type WorldMap, type MapPlace } from './worldMap';
import { rollTest } from '../engine/tests';
import { testValue } from '../engine/skills';
import { isOutOfAction } from '../engine/conditions';
import { rule } from '../engine/policy';
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../engine/types';
import { startCascade, registerCascadeApplier } from './cascade';
import { freeCons } from './rollSeam';
import { humanControlled } from './netOwnership';
import type { CascadeStep } from './pendings';
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
 * NAUFRAGE : le navire de campagne coule. Résout la survie à la nage de chaque héros à bord (cascade
 * influençable pour les pilotes humains, cf. en-tête), échoue les rescapés au rivage le plus proche, PURGE
 * le navire (coque + cargaison perdues, IMMÉDIAT — indépendant de l'issue des jets) et surface le
 * dénouement (modale document + journal). `aboardIds` : héros à bord (défaut = tout le groupe vivant) — le
 * combat naval passe l'équipage de la coque coulée. No-op si aucun navire.
 */
export function beginShipwreck(get: Get, set: Set, opts: { aboardIds?: string[] } = {}): void {
  const vessel = get().vessel;
  const shipName = vessel?.name ?? 'Le navire';
  const diff = rule('sea-shipwreck-swim') as Difficulty;
  const shore = shorePlace(get);
  const aboardSet = opts.aboardIds ? new Set(opts.aboardIds) : null;
  const isAboard = (h: Combatant) => (aboardSet ? aboardSet.has(h.id) : !h.dead);

  const journalMark = get().journal.length;
  const opening: string[] = [`${shipName} sombre corps et biens (MDG ch.13 l.674).`];
  const swimmerIds: string[] = [];
  const party = get().party.map((h) => {
    if (!isAboard(h) || h.dead) return h;
    // Un héros HORS D'ÉTAT ne peut pas nager (LDB 18 l.344 : suffocation) → il sombre — prédicat de
    // cycle de vie canonique (`isOutOfAction`, machinerie universelle), jamais un test par-État nommé.
    // Un rescapé passé par-dessus bord (`outOfRencontre`, MDG 13) reste conscient : il nage ci-dessous —
    // `outOfRencontre` seul (l'éjection du COMBAT que ce naufrage vient de résoudre) n'incapacite pas,
    // donc écarté du prédicat ; dead/inconscient/Mort Subite restent des voies RÉELLES d'incapacité.
    if (isOutOfAction({ ...h, outOfRencontre: false })) {
      opening.push(`${h.name} — inconscient dans les flots : emporté sans pouvoir nager (noyé, LDB 18 l.344).`);
      return { ...h, dead: true };
    }
    swimmerIds.push(h.id);
    return h;
  });
  // Navire + cargaison sombrent avec la coque (#244, règle 7) : purgé IMMÉDIATEMENT, indépendant de
  // l'issue des jets de Natation (le navire est perdu dès qu'il coule, pas seulement s'il y a des noyés).
  set({ party, vessel: null, travelPlan: null, travelRecap: null, worldMapOpen: false });
  get().log(['— NAUFRAGE —', ...opening]);

  if (!swimmerIds.length) { emitShipwreckLines(get, finishShipwreck(get, set, shore, [], journalMark)); return; }

  const swimmers = swimmerIds.map((id) => get().party.find((h) => h.id === id)!);
  const rng = battleRng();

  // Repli AUCUN pilote humain à bord (IA/rafale/cadence auto) : résolution inline VISIBLE (patron
  // `corruptionFlow` — un pilote humain remonte en modale, sinon on résout et on journalise).
  if (!swimmers.some((h) => humanControlled(get(), h))) {
    const lines: string[] = [];
    for (const h of swimmers) {
      // Aucune rangée nulle part sur ce chemin (repli sans pilote humain, aucune cascade démarrée) —
      // le journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
      const value = testValue(h, 'natation', 'force');
      const t = rollTest(value, diff, rng);
      lines.push(`${h.name} — Natation (${DIFFICULTY_LABELS[diff]}) : ${t.roll}/${t.target} → ${t.success ? 'rejoint la surface et nage vers la côte.' : 'emporté par les flots (noyé, LDB 18 l.344).'}`);
      if (t.success) { h.outOfRencontre = false; h.exitReason = undefined; } else h.dead = true;
    }
    set({ party: [...get().party] });
    emitShipwreckLines(get, [...lines, ...finishShipwreck(get, set, shore, swimmerIds, journalMark)]);
    return;
  }

  // Cascade influençable : une étape de Natation par nageur conscient, interactive SI ce héros est
  // humanControlled — sinon pré-roulée (même formule) et rendue en témoin (`interactive:false`). La
  // clôture (dernière étape validée) exécute `finishShipwreck` — `purpose:'test'` : aucun crochet
  // dédié requis dans le store (générique, `dispatchCascadeDone` n'a rien à router).
  const meta = { shoreId: shore?.id ?? '', journalMark };
  const steps: CascadeStep[] = swimmers.map((h) => {
    const value = testValue(h, 'natation', 'force');
    const target = Math.max(1, Math.min(99, value + DIFFICULTY_MODIFIERS[diff]));
    const human = humanControlled(get(), h);
    const result = human ? null : (() => { const t = rollTest(value, diff, rng); return { roll: t.roll, target: t.target, sl: t.sl, success: t.success }; })();
    return {
      id: `shipwreck-${h.id}`, kind: 'shipwreckSwim', actorId: h.id, icon: 'nautical/swim',
      label: `${h.name} — Natation`, rollLabel: 'Natation', base: value, target, result, interactive: human,
      meta,
    };
  });
  startCascade(get, set, { title: 'Naufrage', icon: 'nautical/swim', purpose: 'test', steps });
}

/** Journalise (réellement, `get().log`) une liste de lignes accumulées AVANT qu'elles n'existent dans
 *  le journal (chemin inline/sans-nageur — le pilote CASCADE les fait vivre via le retour d'applier,
 *  poussées par `commitStep`). Petite brique pour ne pas dupliquer la boucle aux deux sites inline. */
function emitShipwreckLines(get: Get, lines: string[]): void {
  for (const l of lines) get().log(l);
}

/** Clôture commune (inline ET cascade) : rescapés déduits de `swimmerIds` (les vivants parmi eux),
 *  échouage au rivage le plus proche + transition, modale document (texte = la tranche de journal
 *  DÉJÀ écrite depuis `journalMark`, complétée des lignes renvoyées ICI), puis `checkPartyWiped`.
 *  Renvoie les lignes à journaliser par l'appelant (dans le BON ordre — cascade : via le retour
 *  d'applier ; inline : via `emitShipwreckLines`). */
function finishShipwreck(get: Get, set: Set, shore: MapPlace | undefined, swimmerIds: string[], journalMark: number): string[] {
  const survivors = swimmerIds
    .map((id) => get().party.find((h) => h.id === id))
    .filter((h): h is Combatant => !!h && !h.dead)
    .map((h) => h.name);
  const lines: string[] = [];
  if (shore) lines.push(survivors.length
    ? `Les rescapés (${survivors.join(', ')}) s'échouent à ${shore.label}.`
    : 'Nul rescapé ne touche terre.');
  // Échouage : transition AVANT la modale (transitionTo purge `document` via resetFields('scene')).
  if (survivors.length && shore) get().transitionTo(shore.scene, shore.entry);
  set({ document: { title: 'Naufrage', text: [...get().journal.slice(journalMark), ...lines].join('\n') } });
  // Aucun survivant → défaite hors combat (écran unique `checkPartyWiped`).
  checkPartyWiped(get, set);
  return lines;
}

/** Étape-jet de Natation d'un naufrage (#269) : succès → rescapé (sort de la rencontre) ; échec → noyé
 *  (LDB 18 l.344). La DERNIÈRE étape validée déclenche la clôture complète (`finishShipwreck`). */
registerCascadeApplier('shipwreckSwim', (get, set, step, hero, ctx) => {
  if (!step.result || !hero) return;
  const diff = rule('sea-shipwreck-swim') as Difficulty;
  const success = step.result.success;
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
  const line = `${hero.name} — Natation (${DIFFICULTY_LABELS[diff]}) : ${success ? 'rejoint la surface et nage vers la côte.' : 'emporté par les flots (noyé, LDB 18 l.344).'}`;
  if (success) { hero.outOfRencontre = false; hero.exitReason = undefined; } else hero.dead = true;
  set({ party: [...get().party] });
  if (ctx.index !== ctx.steps.length - 1) return { consequences: freeCons([line]) };
  const shoreId = String(step.meta?.shoreId ?? '');
  const journalMark = Number(step.meta?.journalMark ?? 0);
  const swimmerIds = ctx.steps.filter((s) => s.kind === 'shipwreckSwim').map((s) => s.actorId!);
  const shore = shoreId ? placeById(get().worldMap as WorldMap, shoreId) : undefined;
  return { consequences: freeCons([line, ...finishShipwreck(get, set, shore, swimmerIds, journalMark)]) };
});
