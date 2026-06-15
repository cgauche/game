import type { GameState, RevealEntry } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import type { LootGear, CascadeStep } from './pendings';
import { Combatant, ItemInstance, DIFFICULTY_MODIFIERS } from '../engine/types';
import { battleRng } from './battleRng';
import { d10, rollExpr } from '../engine/dice';
import { gainCorruption, corruptionTarget } from './corruptionFlow';
import { eligibleTalent } from '../engine/grimoire';
import { effectiveChar } from '../engine/characteristics';
import { partyBest, isSocialTest, socialPsychMod, socialPsychLabel, testValue, actorHasSkill } from '../engine/skills';
import { easeDifficulty } from '../engine/tests';
import { hasTalent } from '../engine/magic';
import { recomputeLoadout, itemFromTrapping, customTrapping } from '../engine/items';
import { contractDisease } from '../engine/disease';
import { type HealMode } from '../engine/healing';
import { openMedic } from './medicFlow';
import { openRest, placesOfKind } from './restFlow';
import { permanentAmputations } from '../engine/critical';
import { traumaFromKind } from '../engine/trauma';
import { DAY_PHASES, minutesUntilNext } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import { feedFromMeal } from '../engine/provisions';
import { findSpell } from '../data/index';
import { toBrass, fromBrass } from '../engine/money';
import { Effect, condMet, temporalConditionMet } from './scene';
import { inRect } from './combatGeometry';
import { loseWounds, addCondition } from '../engine/conditions';
import { touchActors } from './combatOrParty';

/**
 * Effets de scène/campagne (`Effect[]`) appliqués par le store : le grand `applyEffects`
 * (setFlag/journal/dons/transitions/tests/soins…) + la brique de butin ATTRIBUABLE
 * (`gearFromEffects`/`applyEffectsLoot`/`assignGearAt`), les déclencheurs de zone
 * (`checkTriggers`) et la file de révélations témoins (`pushReveal`). Extrait de combatFlow
 * (baril : ré-exporté par `./combatFlow`). Module FEUILLE — n'importe RIEN de combatFlow.
 */
/** Conséquences d'ATTAQUE rapatriées INLINE dans la séquence (au lieu d'une RevealModal séparée) :
 *  Coup Critique (panneau riche), Assommante, Coup dans le dos. Les autres révélations (fin de Round,
 *  mutation, Calme, effet d'auteur) restent en file témoin. */
const COMBAT_SEQ_KINDS: ReadonlySet<RevealEntry['kind']> = new Set(['critical', 'assommante', 'backstab']);
const SEQ_ICON: Partial<Record<RevealEntry['kind'], string>> = { critical: '💥', assommante: '🌟', backstab: '🗡️' };

/** Une révélation de conséquence d'attaque → étape d'AFFICHAGE de la séquence. Le Critique garde son
 *  panneau DÉTAILLÉ via la charge riche `reveal` ; les autres montrent leurs lignes. `actorId` = le
 *  CONCERNÉ (victime → propriétaire de la modale en coop). */
function revealToStep(entry: RevealEntry, index: number): CascadeStep {
  const isCrit = entry.kind === 'critical';
  return {
    id: `cons-${entry.kind}-${index}`,
    kind: entry.kind,
    actorId: entry.subjectId,
    icon: SEQ_ICON[entry.kind] ?? '⚔️',
    label: entry.title,
    outcome: entry.lines,
    reveal: isCrit ? entry : undefined,
    interactive: true,
  };
}

/** Empile une révélation : conséquence d'attaque → étape INLINE de la séquence de combat (append à
 *  celle en cours, sinon démarre) ; sinon → file de révélation témoin FIFO. */
export function pushReveal(set: SetFn, entry: RevealEntry): void {
  if (COMBAT_SEQ_KINDS.has(entry.kind)) {
    set((s: GameState) => {
      const c = s.pendingCascade;
      const active = c && c.purpose === 'combat' && c.cursor < c.participants.length ? c : null;
      const step = revealToStep(entry, active ? active.participants.length : 0);
      return active
        ? { pendingCascade: { ...active, participants: [...active.participants, step] } }
        : { pendingCascade: { title: 'Conséquences', icon: '⚔️', purpose: 'combat', cursor: 0, log: [], participants: [step] } };
    });
    return;
  }
  set((s: GameState) => ({ pendingReveals: [...s.pendingReveals, entry] }));
}

// occupied / pushBackTiles / findFreeTile / displaceSmaller / removeEntity → combatGeometry.ts

/** Items ramassables d'un prop interactif : un par effet « donneur » de son `interact`.
 *  `key` = `eff:<index dans interact.effects>`. Les effets non-objet (journal/document…) sont ignorés. */
export function entityPickables(ent: { interact?: { effects: Effect[] } }): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  (ent.interact?.effects ?? []).forEach((e, i) => {
    if (e.type === 'giveTrapping') out.push({ key: `eff:${i}`, label: e.trapping });
    else if (e.type === 'giveMoney') out.push({ key: `eff:${i}`, label: 'Argent' });
  });
  return out;
}

export function checkTriggers(get: Get, set: SetFn) {
  const { scene, partyPos, flags } = get();
  if (!scene) return;
  for (const t of scene.triggers) {
    if (flags[`__trigger_${t.id}`]) continue;
    if (!inRect(partyPos, t.rect)) continue;
    if (t.condition && !condMet(t.condition, flags)) continue;
    if (t.temporalCondition && !temporalConditionMet(t.temporalCondition, get().gameTime)) continue;
    if (t.once) flags[`__trigger_${t.id}`] = true;
    applyEffectsLoot(get, set, t.effects, 'Découverte');
    set({ flags: { ...flags } });
  }
}

// inRect → combatGeometry.ts

/** Sépare d'un lot d'Effets les giveTrapping ATTRIBUABLES (sans heroId) → lignes de butin
 *  « qui l'emporte ? ». Brique partagée écran de victoire / fenêtre de loot. Un giveTrapping
 *  AVEC heroId est un don d'auteur ciblé : il reste dans `rest` et s'applique directement. */
export function gearFromEffects(effects: Effect[]): { gear: LootGear[]; rest: Effect[] } {
  const gear: LootGear[] = [];
  const rest: Effect[] = [];
  for (const e of effects) {
    if (e.type === 'giveTrapping' && !e.heroId) gear.push({ label: e.trapping, magic: !!e.qualities?.length || e.identified === false, effect: e });
    else rest.push(e);
  }
  return { gear, rest };
}

/** applyEffects + fenêtre de loot : hors combat, l'équipement trouvé (giveTrapping sans heroId)
 *  devient ATTRIBUABLE dans `pendingLoot` au lieu d'aller en silence au 1er héros ; l'argent
 *  s'applique à la bourse ET s'affiche ; les textes `journal` du lot deviennent le texte
 *  d'ambiance de la fenêtre. Sans butin (ou en combat : Ramasser/victoire ont leurs flux),
 *  strictement équivalent à applyEffects. Fenêtre déjà ouverte → le butin s'y AJOUTE. */
export function applyEffectsLoot(get: Get, set: SetFn, effects: Effect[], title: string) {
  if (get().battle) { applyEffects(get, set, effects); return; }
  const { gear, rest } = gearFromEffects(effects);
  applyEffects(get, set, rest);
  const found = effects
    .filter((e): e is Extract<Effect, { type: 'giveMoney' }> => e.type === 'giveMoney')
    .reduce((m, e) => m + toBrass({ gold: e.gold ?? 0, silver: e.silver ?? 0, brass: e.brass ?? 0 }), 0);
  if (!gear.length && found <= 0) return; // dépense (giveMoney négatif) ou simple récit : pas de fenêtre
  const messages = effects.filter((e): e is Extract<Effect, { type: 'journal' }> => e.type === 'journal').map((e) => e.text);
  set((s: GameState) => {
    const prev = s.pendingLoot;
    if (!prev) return { pendingLoot: { title, messages: messages.length ? messages : undefined, gold: found > 0 ? fromBrass(found) : undefined, gear } };
    return {
      pendingLoot: {
        ...prev,
        gear: [...prev.gear, ...gear],
        gold: found > 0 ? fromBrass(toBrass(prev.gold ?? { gold: 0, silver: 0, brass: 0 }) + found) : prev.gold,
        messages: [...(prev.messages ?? []), ...messages.filter((m) => !(prev.messages ?? []).includes(m))],
      },
    };
  });
}

/** Attribue la ligne `index` du butin (`pendingLoot` ou `pendingVictory`) au héros choisi :
 *  l'Effet d'origine s'applique avec ce heroId (qualités/skin/identification conservés), la
 *  ligne quitte la fenêtre. Source unique de l'attribution (victoire ET fenêtre de loot). */
export function assignGearAt(get: Get, set: SetFn, key: 'pendingLoot' | 'pendingVictory', index: number, heroId: string) {
  const bucket = get()[key];
  if (!bucket?.gear || index < 0 || index >= bucket.gear.length) return;
  applyEffects(get, set, [{ ...bucket.gear[index].effect, heroId }]);
  set({ [key]: { ...bucket, gear: bucket.gear.filter((_, i) => i !== index) } });
}

/** Lot 0 — déclenche les effets PROGRAMMÉS (file `scheduledEffects`) dont l'échéance est atteinte.
 *  Appelé par `advanceTime` à chaque avance d'horloge (le temps progresse par actions discrètes →
 *  un événement programmé entre deux pas se déclenche dès le pas qui le dépasse). Un effet dont le
 *  `cancelFlag` a été posé est CONSOMMÉ sans s'appliquer (désamorçage). Les entrées dues sont
 *  retirées AVANT application (pas de re-déclenchement). */
export function fireScheduledEffects(get: Get, set: SetFn) {
  const now = get().gameTime;
  const all = get().scheduledEffects;
  const due = all.filter((s) => s.executeAt <= now);
  if (!due.length) return;
  set({ scheduledEffects: all.filter((s) => s.executeAt > now) });
  const flags = get().flags;
  for (const s of due) {
    if (s.cancelFlag && flags[s.cancelFlag]) continue;
    applyEffectsLoot(get, set, s.effects, 'Événement');
  }
}

/** Cibles d'un Effet hors combat (`inflictDamage`/`applyCondition`) : les héros vivants concernés,
 *  dans le bon ensemble (file de combat si en combat, sinon le groupe). `hero` = celui désigné par
 *  `heroId` (défaut : 1er vivant) ; `party` = tous les héros vivants. SOURCE UNIQUE (pas de dup). */
function effectTargets(get: Get, target: 'party' | 'hero', heroId?: string): Combatant[] {
  const pool = get().battle?.combatants ?? get().party;
  if (target === 'hero') {
    const id = heroId || pool.find((c) => c.kind === 'hero' && !c.dead)?.id;
    return pool.filter((c) => c.id === id);
  }
  return pool.filter((c) => c.kind === 'hero' && !c.dead);
}

export function applyEffects(get: Get, set: SetFn, effects: Effect[]) {
  for (const e of effects) {
    switch (e.type) {
      case 'setFlag':
        set((s: GameState) => ({ flags: { ...s.flags, [e.flag]: e.value ?? true } }));
        break;
      case 'journal':
        get().log(e.text);
        break;
      case 'giveMoney': {
        set((s: GameState) => ({
          money: {
            gold: s.money.gold + (e.gold ?? 0),
            silver: s.money.silver + (e.silver ?? 0),
            brass: s.money.brass + (e.brass ?? 0),
          },
        }));
        const parts = [e.gold && `${e.gold} CO`, e.silver && `${e.silver} pa`, e.brass && `${e.brass} sc`].filter(Boolean); // noms canon FR (couronne/pistole/sou)
        if (parts.length) get().log(`Bourse : ${(e.gold ?? 0) < 0 || (e.silver ?? 0) < 0 ? '' : '+'}${parts.join(' ')}.`);
        break;
      }
      case 'giveXp':
        set((s: GameState) => ({
          party: s.party.map((h) => {
            const clone: Combatant = JSON.parse(JSON.stringify(h));
            clone.xp = (clone.xp ?? 0) + e.amount;
            return clone;
          }),
        }));
        get().log(`Groupe : +${e.amount} PX.`);
        break;
      case 'restoreFortune':
        // Début de session (LDB 17 l.47) : Chance regagnée jusqu'au maximum = Destin actuel.
        set((s: GameState) => ({
          party: s.party.map((h) => (h.kind === 'hero' && h.fate != null ? { ...h, fortune: h.fate } : h)),
        }));
        get().log('Début de session : Points de Chance regagnés (maximum = Destin).');
        break;
      case 'interlude':
        // « Entre deux aventures » (LDB 22-23) — via l'action store (pas d'import direct : cycle).
        get().startInterlude(e.weeks ?? 1);
        break;
      case 'openWorldMap':
        // « Partir en voyage » depuis une porte/route de la scène (#T2) — l'action est déjà gardée
        // (no-op sans carte ou en combat).
        get().openWorldMap();
        break;
      case 'rest':
        // Repos déclenché par l'éditeur (trigger/dialogue) : ouvre la MODALE DE NUIT (couchage +
        // pitance par héros, prix RAW, bilan globalisé). LEGACY sans `lodging` : contexte maison.
        openRest(get, set, { places: placesOfKind(e.lodging ?? 'maison'), quality: e.quality, days: e.days ?? 1 });
        break;
      case 'mealParty': {
        // Repas (#T2) : tout le groupe est nourri pour la journée sans consommer de ration —
        // compteurs/malus de Faim remis à zéro (LDB 18 l.417-422 ; prix éventuel porté par le choix).
        const diners = get().party;
        for (const h of diners) if (!h.dead) feedFromMeal(h);
        set({ party: [...diners] });
        get().log('Le groupe prend un vrai repas — chacun mange à sa faim.');
        break;
      }
      case 'inflictNightmares': {
        // Trauma « Cauchemars » (LDB 21 l.92) posé sur un héros (défaut : le premier).
        let who = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          const idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : 0;
          const target = idx >= 0 ? idx : 0;
          who = s.party[target].name;
          return { party: s.party.map((h, i) => (i === target ? { ...h, nightmares: true } : h)) };
        });
        if (who) get().log(`${who} est marqué par un trauma : des cauchemars le hanteront chaque nuit.`);
        break;
      }
      case 'giveSin': {
        // Points de Péché (LDB 40 l.36) : sanction d'auteur, 1 à 3 selon la gravité.
        // Cible : héros désigné, sinon le premier sachant Prier (le Péché vise un Bienheureux).
        const amount = Math.max(1, e.amount ?? 1);
        let who = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          let idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : -1;
          if (idx < 0) idx = s.party.findIndex((h) => h.skills.some((sk) => sk.name === 'Prière' && sk.advances >= 1));
          if (idx < 0) idx = 0;
          who = s.party[idx].name;
          return { party: s.party.map((h, i) => (i === idx ? { ...h, sinPoints: (h.sinPoints ?? 0) + amount } : h)) };
        });
        if (who) get().log(`${who} a péché contre son dieu : +${amount} Point(s) de Péché.`);
        break;
      }
      case 'corruptionExposure': {
        // Influence corruptrice (LDB 19 l.23-75) : ouvre le Test différé par modale
        // (Lancer → Chance → Appliquer) ; le gain dépendra du niveau et du DR.
        const hero = corruptionTarget(get(), e.heroId);
        // `e.skill` présent = déterminé en amont (verrouillé) ; absent = nature indéterminée → le
        // joueur choisira Résistance/Calme dans la modale (défaut affiché : Résistance).
        if (hero) set({ pendingCorruption: { heroId: hero.id, level: e.level, skill: e.skill ?? 'Résistance', skillLocked: e.skill != null } });
        break;
      }
      case 'giveCorruption': {
        // Gain direct (artefact maudit, Pacte scénarisé…) — applique aussi seuil → mutation.
        const hero = corruptionTarget(get(), e.heroId);
        if (hero) {
          const lines = gainCorruption(get, set, hero, Math.max(1, e.amount ?? 1));
          for (const l of lines) get().log(l);
          set({ party: [...get().party] });
        }
        break;
      }
      case 'learnSpell': {
        // Trouvaille de campagne : le sort est appris SANS PX (l'auteur l'octroie — le coût
        // en PX ne vaut que pour la mémorisation volontaire, LDB 46 l.44-47).
        const sp = findSpell(e.spell);
        if (!sp) break;
        let who = '';
        set((s: GameState) => {
          let idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : -1;
          if (idx < 0) idx = s.party.findIndex((h) => !!eligibleTalent(h, sp) && !(h.spells ?? []).includes(sp.label));
          if (idx < 0) return {};
          who = s.party[idx].name;
          return { party: s.party.map((h, i) => (i === idx && !(h.spells ?? []).includes(sp.label) ? { ...h, spells: [...(h.spells ?? []), sp.label] } : h)) };
        });
        if (who) get().log(`${who} apprend ${sp.label}.`);
        break;
      }
      case 'inflictTrauma': {
        // Blessure Critique posée rétroactivement par l'éditeur (LDB 18) : déchirure/fracture via la
        // factory partagée (traumaFromKind, effets en-combat + convalescence), amputation via les
        // séquelles permanentes (permanentAmputations). criticalWounds suit (compteur LDB 18).
        let who = '';
        let whoId = '';
        let labels: string[] = [];
        set((s: GameState) => {
          if (!s.party.length) return {};
          const idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : 0;
          const target = idx >= 0 ? idx : 0;
          return {
            party: s.party.map((h, i) => {
              if (i !== target) return h;
              who = h.name;
              whoId = h.id;
              const be = Math.floor(effectiveChar(h, 'E') / 10);
              // Amputation : permanentAmputations lit la PARTIE dans le texte → on synthétise un libellé
              // par localisation (bras → main/bras ; jambe → membre inférieur ; tête → œil, choix d'éditeur).
              const ampNote = e.location === 'tete' ? 'Perte de l’œil — Amputation (Intermédiaire)' : 'Main/bras inutilisable — Amputation (Intermédiaire)';
              const traumas = e.kind === 'amputation'
                ? permanentAmputations('Amputation', ampNote, e.location, battleRng())
                : [traumaFromKind(e.kind, e.severity ?? 'mineur', e.location, { be, d10: d10(battleRng()) })];
              labels = traumas.map((t) => t.label);
              return { ...h, traumas: [...(h.traumas ?? []), ...traumas], criticalWounds: (h.criticalWounds ?? 0) + 1 };
            }),
          };
        });
        if (who) {
          const line = `${who} subit une Blessure Critique (${e.kind}, ${e.location}).`;
          get().log(line);
          // VISIBLE (le journal seul ne suffit pas) : effet d'AUTEUR → révélation témoin.
          pushReveal(set, { kind: 'effet', title: `Blessure Critique — ${e.kind}`, lines: [line, ...labels], subjectId: whoId, severity: 'grave' });
        }
        break;
      }
      case 'inflictDisease': {
        // Maladie (LDB 20) infligée par l'auteur (nourriture avariée, contact infecté…). Incubation/durée
        // tirées à la contraction ; les symptômes se déclareront au repos. Dédoublonnée par nom.
        let who = '';
        let whoId = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          const idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : 0;
          const target = idx >= 0 ? idx : 0;
          return {
            party: s.party.map((h, i) => {
              if (i !== target || (h.diseases ?? []).some((d) => d.name === e.disease)) return h;
              const dz = contractDisease(e.disease, battleRng());
              if (!dz) return h;
              who = h.name;
              whoId = h.id;
              return { ...h, diseases: [...(h.diseases ?? []), dz] };
            }),
          };
        });
        if (who) {
          const line = `${who} a contracté : ${e.disease} (symptômes au repos).`;
          get().log(line);
          // VISIBLE (le journal seul ne suffit pas) : effet d'AUTEUR → révélation témoin.
          pushReveal(set, { kind: 'effet', title: `Maladie — ${e.disease}`, lines: [line], subjectId: whoId, severity: 'grave' });
        }
        break;
      }
      case 'giveTrapping': {
        // Trapping RÉEL (base) sinon objet CUSTOM (misc) — « donner un objet = un trapping custom ou réel ».
        const it = itemFromTrapping(e.trapping) ?? customTrapping(e.trapping);
        // Butin MAGIQUE (optionnel) : qualités ajoutées, objet non identifié (qualités masquées jusqu'à
        // Évaluation, #2), skin légendaire. Les qualités restent ACTIVES mécaniquement (registre).
        if (e.qualities?.length) it.qualities = [...it.qualities, ...e.qualities];
        if (e.identified === false) it.identified = false;
        if (e.skin) it.skin = e.skin;
        if (e.magicKnown) it.magicKnown = true; // aura détectée en fenêtre de loot → suit l'objet
        if (e.detectTried) it.detectTried = true;
        if (e.appraiseTriedDay != null) it.appraiseTriedDay = e.appraiseTriedDay;
        let who = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          const idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : 0;
          const target = idx >= 0 ? idx : 0;
          who = s.party[target].name;
          return {
            party: s.party.map((h, i) => {
              if (i !== target) return h;
              const clone: Combatant = JSON.parse(JSON.stringify(h));
              clone.items = [...(clone.items ?? []), it]; // arrive NON équipé
              recomputeLoadout(clone); // met à jour l'encombrement
              return clone;
            }),
          };
        });
        get().log(`${who || 'Le groupe'} récupère : ${it.name}.`);
        break;
      }
      case 'document':
        set({ document: { title: e.title, text: e.text } });
        break;
      case 'startDialogue': {
        const dlg = get().scene?.dialogues.find((d) => d.id === e.dialogue);
        if (dlg) set({ dialogue: { dialogue: dlg, nodeId: dlg.start } });
        break;
      }
      case 'startCombat':
        get().startCombat(e.encounter);
        break;
      case 'transition': {
        const cur = get();
        if (cur.scene) set({ previousScene: { id: cur.scene.id, pos: { ...cur.partyPos } } });
        get().transitionTo(e.scene, e.entry);
        break;
      }
      case 'transitionBack': {
        const prev = get().previousScene;
        if (prev) {
          set({ previousScene: null });
          get().transitionTo(prev.id, undefined, prev.pos);
        }
        break;
      }
      case 'test': {
        // Test de compétence : le meilleur du groupe tente. Le jet attend « Lancer »
        // dans la modale (testRoll), puis une Chance est possible avant l'acquittement.
        // Malus psy de Sociabilité (LDB 21) : un PJ avec Animosité/Préjugé envers le groupe `vsGroups`
        // de l'interlocuteur subit −20/−10 sur un Test de Sociabilité. Intégré PAR acteur → le meilleur
        // PJ EFFECTIF (malus compris) est choisi, et le malus de l'acteur retenu est affiché dans la modale.
        const socialMod =
          e.vsGroups?.length && isSocialTest(e.skill, e.characteristic)
            ? (c: Combatant) => socialPsychMod(c, e.vsGroups!)
            : undefined;
        const best = partyBest(get().party, e.skill, e.characteristic, socialMod);
        if (!best) break;
        const baseDifficulty = e.difficulty ?? 'intermediaire';
        // `easierIf` : −`steps` crans si un héros vivant possède la compétence/le talent requis
        // (ex. détecter la bombe est plus facile pour qui s'y connaît en poudre noire).
        const eased = !!e.easierIf && get().party.some((c) => !c.dead && (
          (!!e.easierIf!.hasSkill && actorHasSkill(c, e.easierIf!.hasSkill)) ||
          (!!e.easierIf!.hasTalent && hasTalent(c, e.easierIf!.hasTalent))
        ));
        const difficulty = eased ? easeDifficulty(baseDifficulty, e.easierIf!.steps ?? 1) : baseDifficulty;
        // Le GROUPE peut tenter : chaque membre vivant est un candidat (le défaut reste le meilleur,
        // mais le JOUEUR choisit qui lance via `testSetActor`). Valeur/cible/malus/outil PAR acteur.
        const candidates = get().party.filter((c) => !c.dead).map((actor) => {
          const value = testValue(actor, e.skill, e.characteristic) + (socialMod ? socialMod(actor) : 0);
          const pl = socialMod ? socialPsychLabel(actor, e.vsGroups!) : undefined;
          const tool = e.tool ? actor.items?.find((i) => i.name === e.tool && !i.destroyed) : undefined;
          return {
            id: actor.id,
            name: actor.name,
            value,
            target: Math.max(1, Math.min(99, value + DIFFICULTY_MODIFIERS[difficulty])),
            psychMod: (socialMod ? socialMod(actor) : 0) || undefined,
            psychDetail: pl ? `${pl} envers ${e.vsGroups!.join('/')}` : undefined,
            itemUid: tool?.uid,
          };
        });
        const def = candidates.find((c) => c.id === best.actor.id) ?? candidates[0];
        if (!def) break;
        const label = e.label || e.skill || (e.characteristic ? `Test de ${e.characteristic}` : 'Test');
        set({
          pendingTest: {
            actorId: def.id,
            actorName: def.name,
            label,
            skillValue: def.value,
            difficulty,
            requireSL: e.requireSL ?? 0,
            target: def.target,
            psychMod: def.psychMod, // malus Animosité/Préjugé de l'acteur (affiché en modale)
            psychDetail: def.psychDetail, // libellé lisible (« Animosité −20 envers Elfe »)
            itemUid: def.itemUid,
            isDouble: false,
            roll: null, // pas encore lancé
            success: false,
            sl: 0,
            onSuccess: e.onSuccess,
            onFailure: e.onFailure,
            candidates: candidates.length > 1 ? candidates : undefined, // choix seulement si plusieurs
          },
        });
        return; // la suite est portée par la branche (résolue à l'acquittement)
      }
      case 'extendedTest': {
        // Test ÉTENDU (LDB 12) : le meilleur du groupe pour la Compétence enchaîne les Rounds.
        const best = partyBest(get().party, e.skill, e.characteristic);
        if (!best) break;
        const difficulty = e.difficulty ?? 'intermediaire';
        const target = Math.max(1, Math.min(99, best.value + DIFFICULTY_MODIFIERS[difficulty]));
        get().startExtendedTest({ actorId: best.actor.id, label: e.label, skillLabel: e.skill ?? e.characteristic ?? 'Test', target, targetDR: e.targetDR, flag: e.flag });
        return;
      }
      case 'forceDoor': {
        // Enfoncer une PORTE/objet à plusieurs (EDO Append. 2) : tout le groupe vivant frappe.
        const heroes = get().party.filter((h) => !h.dead).map((h) => h.id);
        if (!heroes.length) break;
        get().startForceDoor({ label: e.label, doorBE: e.doorBE, doorB: e.doorB, heroIds: heroes, flag: e.flag });
        return;
      }
      case 'setTime': {
        // Saut EN AVANT jusqu'à la prochaine occurrence de la phase/heure visée (le temps ne recule jamais).
        const target = 'phase' in e
          ? (DAY_PHASES.find((p) => p.key === e.phase)?.start ?? 0)
          : e.hour * 60 + (e.minute ?? 0);
        get().advanceTime(minutesUntilNext(get().gameTime, target));
        break;
      }
      case 'delayedEffect': {
        // Échéance absolue (minute `gameTime`) : compte à rebours relatif `afterMinutes`, sinon la
        // prochaine occurrence de l'heure du jour `atHour:atMinute`.
        const now = get().gameTime;
        const executeAt = e.afterMinutes != null
          ? now + Math.max(0, e.afterMinutes)
          : now + minutesUntilNext(now, (e.atHour ?? 0) * 60 + (e.atMinute ?? 0));
        set((s: GameState) => ({ scheduledEffects: [...s.scheduledEffects, { executeAt, effects: e.effects, cancelFlag: e.cancelFlag }] }));
        break;
      }
      case 'inflictDamage': {
        const targets = effectTargets(get, e.target, e.heroId);
        for (const c of targets) loseWounds(c, Math.max(0, e.amount));
        if (targets.length) {
          set(touchActors(get()));
          get().log(`💥 ${targets.length === 1 ? targets[0].name : 'Le groupe'} subit ${e.amount} Blessure(s).`);
        }
        break;
      }
      case 'applyCondition': {
        const targets = effectTargets(get, e.target, e.heroId);
        for (const c of targets) addCondition(c, e.name, e.value ?? 1);
        if (targets.length) {
          set(touchActors(get()));
          get().log(`${targets.length === 1 ? targets[0].name : 'Le groupe'} : ${e.name}.`);
        }
        break;
      }
      case 'zoneBlast': {
        // Cibles dans le rayon (Chebyshev) : en combat par position de chaque combattant ; hors
        // combat, le groupe entier est à partyPos. Dégâts TIRÉS par cible (révélés au journal).
        const inBattle = !!get().battle;
        const pool: Combatant[] = inBattle ? get().battle!.combatants : get().party;
        const pp = get().partyPos;
        const cheb = (p: { x: number; y: number }) => Math.max(Math.abs(p.x - e.center.x), Math.abs(p.y - e.center.y));
        const targets = pool.filter((c) => {
          if (c.dead || (!inBattle && c.kind !== 'hero')) return false;
          const pos = inBattle ? (c as Combatant & { pos?: { x: number; y: number } }).pos : pp;
          return !!pos && cheb(pos) <= e.radius;
        });
        if (!targets.length) break;
        const lines = targets.map((c) => {
          const dmg = Math.max(0, rollExpr(e.damage, battleRng()));
          loseWounds(c, dmg);
          for (const cond of e.conditions ?? []) addCondition(c, cond.name, cond.value ?? 1);
          return `${c.name} ${dmg}${e.conditions?.length ? ` +${e.conditions.map((x) => x.name).join('/')}` : ''}`;
        });
        set(touchActors(get()));
        get().log(`💥 Souffle (${e.damage}) : ${lines.join(' · ')}.`);
        break;
      }
      case 'fall': {
        // Chute (LDB 15 l.117-122) : 3 Dégâts/mètre + 1d10, réduits par le Bonus d'Endurance mais
        // PAS par les PA ; si les Blessures subies > BE → État À Terre. `to` repose le groupe (hors
        // combat). Dégâts TIRÉS par cible et révélés au journal (involontaire : pas de Test d'Athlétisme).
        const targets = effectTargets(get, e.target, e.heroId);
        const m = Math.max(0, e.metres);
        const lines = targets.map((c) => {
          const be = Math.floor(effectiveChar(c, 'E') / 10);
          const lost = Math.max(0, 3 * m + d10(battleRng()) - be);
          loseWounds(c, lost);
          if (lost > be) addCondition(c, 'À Terre');
          return `${c.name} ${lost}${lost > be ? ' (À Terre)' : ''}`;
        });
        if (targets.length) {
          set({ ...touchActors(get()), ...(e.to && !get().battle ? { partyPos: e.to } : {}) });
          get().log(`🪂 Chute de ${m} m : ${lines.join(' · ')}.`);
        } else if (e.to && !get().battle) set({ partyPos: e.to });
        break;
      }
      case 'openMerchant':
        get().openMerchant(e.entityId); // ouvre la boutique de l'entité (Marchand inclus dans un dialogue, #2)
        break;
      case 'medicalAid':
        openMedicalAidEffect(get, set, e); // soins payants d'un PNJ : ouvre son infirmerie (actes tarifés)
        break;
      case 'endDialogue':
        if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
        set({ dialogue: null });
        break;
    }
  }
}

/**
 * Soins PAYANTS d'un PNJ (Effet `medicalAid`, LDB 75) : ouvre l'INFIRMERIE (state/medicFlow) avec
 * la compétence du PNJ et ses actes tarifés — le débit a lieu à l'acte, dans la modale. Le joueur
 * choisit les patients ; le PNJ effectue les jets (la Chance interroge `actorIn(healerId)` →
 * introuvable pour un PNJ → boutons inertes).
 */
function openMedicalAidEffect(get: Get, set: SetFn, e: { acts?: { act: HealMode; cost?: { gold?: number; silver?: number; brass?: number } }[]; skill: number; intBonus: number; entityId?: string }): void {
  const acts = e.acts ?? [];
  if (!acts.length) return;
  const npc = e.entityId ? get().scene?.entities.find((x) => x.id === e.entityId) : undefined;
  openMedic(get, set, {
    npc: {
      id: npc?.id ?? e.entityId ?? 'pnj-soigneur',
      name: npc?.label ?? 'Soigneur',
      skill: e.skill,
      intBonus: e.intBonus,
      acts,
    },
  });
}
