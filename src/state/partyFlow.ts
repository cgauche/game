/**
 * Actions GROUPE (hors combat) extraites de store.ts pour le garder navigable — même patron
 * `(get, set)` que combatFlow : équipement (équiper/transférer/skin), avancement PX
 * (caractéristiques/compétences/talents/carrière, prothèses), consommables de fiche, butin.
 * Refacto pure — comportement préservé.
 */
import { Combatant, CharKey, CHAR_LABELS } from '../engine/types';
import { recomputeLoadout, loadoutCreate, loadoutDelete, loadoutSetActive, loadoutSetSlot, equipConflicts, canStow } from '../engine/items';
import {
  buyCharAdvance as engineBuyCharAdvance,
  buySkillAdvance as engineBuySkillAdvance,
  buyTalent as engineBuyTalent,
  changeCareer as engineChangeCareer,
  isCareerLevelComplete,
  inCareerChar,
  mentorBlocks,
} from '../engine/advancement';
import { rule } from '../engine/policy';
import {
  skillSlots,
  talentSlots,
  availableChars,
  designationsFor,
  inCareerStatus,
  freeSlotFor,
  designateSlot,
  talentMaxReached,
} from '../engine/careerSlots';
import { applyTalentAcquisition, heroMaxWounds, fortuneMax, resolveMax, careerSkillAdditions } from '../engine/talentEffects';
import { heroSessionXp, regainDetermination } from '../engine/session';
import { skillCharacteristicById } from '../engine/character';
import { bonus, effectiveChar } from '../engine/characteristics';
import { castingKindOf } from '../engine/combatFeatures/dispatch';
import { add as moneyAdd, subtract as moneySub, canAfford, toMoney, Money, formatMoney } from '../engine/money';
import { isArcaneSpell } from '../engine/magic';
import { spellCost } from '../engine/grimoire';
import { levelsForCareer, findSkillById, findCareerById, findSpellById, findTrappingById, refLabel } from '../data/index';
import { seatSlotsRemaining } from './netOwnership';
import { rosterUpdate } from './roster';

import type { Get, Set } from './flowTypes';

/** Recalcule les Blessures max (BF + 2·BE + BFM × Taille + Dur à cuire) après une Augmentation
 *  de Caractéristique ou un nouveau Talent ; un gain de max augmente aussi le courant (mute). */
function recomputeWounds(hero: Combatant) {
  // Augmentation permanente de Caractéristique → recalcul de la BASE (formule × Taille de l'espèce).
  const newMax = heroMaxWounds(hero);
  const delta = newMax - hero.wounds.max;
  hero.wounds.base = newMax;
  hero.wounds.max = newMax;
  if (delta > 0) hero.wounds.current += delta;
  if (hero.wounds.current > newMax) hero.wounds.current = newMax;
}

/** Contexte carrière d'un héros : niveaux + slots cumulés/courants + désignations (LDB 07). */
function careerCtx(hero: Combatant) {
  const career = hero.career ?? '';
  const level = hero.careerLevel ?? 1;
  const levels = levelsForCareer(career);
  return {
    career,
    level,
    levels,
    sSlots: skillSlots(levels, level), // Compétences : cumul niveaux ≤ courant (l.78)
    tSlots: talentSlots(levels, level), // Talents : niveau courant seul (l.100)
    careerChars: availableChars(levels, level), // Caractéristiques : cumul (l.67)
    designations: designationsFor(hero, career),
  };
}

function isCompleted(hero: Combatant): boolean {
  const ctx = careerCtx(hero);
  if (!ctx.levels.some((l) => l.level === ctx.level)) return false;
  return isCareerLevelComplete(hero, ctx.level, {
    skillSlots: ctx.sSlots,
    talentSlots: ctx.tSlots,
    careerChars: ctx.careerChars,
    designations: ctx.designations,
  });
}

/** Équipe/déséquipe un objet d'un héros et recalcule ses armes/armure actives. Équiper une armure
 *  retire d'abord les pièces de MÊME couche sur une localisation commune (LDB 63 — pas deux cuirs
 *  souples superposés), une cape retire l'autre cape : échange façon jeu vidéo, journalisé. */
export function toggleEquip(get: Get, set: Set, heroId: string, uid: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const it = (clone.items ?? []).find((i) => i.uid === uid);
      if (it) {
        if (!it.equipped) {
          it.inside = undefined; // on ne porte pas un objet rangé dans un sac : il en sort d'abord
          const out = equipConflicts(clone, it);
          for (const o of out) o.equipped = false;
          if (out.length) msg = `${clone.name} troque ${out.map((o) => o.name).join(' + ')} contre ${it.name} (même couche).`;
        }
        it.equipped = !it.equipped;
        recomputeLoadout(clone);
      }
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Range (`containerUid` non-null) ou sort (null) un objet d'un héros d'un contenant (LDB 64). Ranger vérifie
 *  la capacité (`canStow`) et met l'objet à l'état « rangé » (ni porté ni tenu) ; sortir le remet en vrac.
 *  Même patron que `toggleEquip` (clone + recomputeLoadout). */
export function stowItem(get: Get, set: Set, heroId: string, uid: string, containerUid: string | null): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const it = (clone.items ?? []).find((i) => i.uid === uid);
      if (!it) return clone;
      if (containerUid) {
        if (!canStow(clone, it, containerUid)) {
          msg = `${clone.name} : ${it.name} ne tient pas dans ce contenant.`;
          return h;
        }
        const bag = (clone.items ?? []).find((i) => i.uid === containerUid);
        it.inside = containerUid; // rangé : ni porté ni tenu
        it.equipped = false;
        msg = `${clone.name} range ${it.name}${bag ? ` dans ${bag.name}` : ''}.`;
      } else {
        it.inside = undefined; // sorti du sac (remis en vrac)
        msg = `${clone.name} sort ${it.name} de son contenant.`;
      }
      recomputeLoadout(clone);
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Applique une mutation de loadout à un héros (clone + recompute), même pattern que toggleEquip. */
function mutLoadout(set: Set, heroId: string, fn: (c: Combatant) => void): void {
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      fn(clone);
      recomputeLoadout(clone);
      return clone;
    }),
  }));
}

export function createLoadout(_get: Get, set: Set, heroId: string): void {
  mutLoadout(set, heroId, (c) => loadoutCreate(c));
}
export function deleteLoadout(_get: Get, set: Set, heroId: string, id: string): void {
  mutLoadout(set, heroId, (c) => loadoutDelete(c, id));
}
export function setActiveLoadout(_get: Get, set: Set, heroId: string, id: string): void {
  mutLoadout(set, heroId, (c) => loadoutSetActive(c, id));
}
export function setLoadoutSlot(_get: Get, set: Set, heroId: string, id: string, slot: 'main' | 'off', uid: string | null): void {
  mutLoadout(set, heroId, (c) => loadoutSetSlot(c, id, slot, uid));
}

export function transferItem(get: Get, set: Set, uid: string, fromHeroId: string, toHeroId: string): void {
  if (fromHeroId === toHeroId) return;
  const from = get().party.find((h) => h.id === fromHeroId);
  const item = from?.items?.find((i) => i.uid === uid);
  const to = get().party.find((h) => h.id === toHeroId);
  if (!item || !to) return;
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id === fromHeroId) {
        const c: Combatant = structuredClone(h);
        c.items = (c.items ?? []).filter((i) => i.uid !== uid);
        recomputeLoadout(c);
        return c;
      }
      if (h.id === toHeroId) {
        const c: Combatant = structuredClone(h);
        c.items = [...(c.items ?? []), { ...item, equipped: false }]; // arrive NON équipé
        recomputeLoadout(c);
        return c;
      }
      return h;
    }),
  }));
  get().log(`${from!.name} donne ${item.name} à ${to.name}.`);
}

export function setItemSkin(_get: Get, set: Set, heroId: string, uid: string, patch: Record<string, string | undefined>): void {
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const it = (clone.items ?? []).find((i) => i.uid === uid);
      if (it) {
        const next: Record<string, string> = { ...(it.skin ?? {}) };
        for (const [k, v] of Object.entries(patch)) { if (v == null) delete next[k]; else next[k] = v; }
        it.skin = Object.keys(next).length ? next : undefined;
        recomputeLoadout(clone); // propage skin → Weapon.skin actif
      }
      return clone;
    }),
  }));
}

/** Change la FORME d'une arme ABSTRAITE (« Arme simple » → épée/hache/masse/marteau de guerre/demi-lance) :
 *  pose `item.shape` parmi les `formChoices` du trapping (forme hors-liste → no-op), puis recompute pour que
 *  l'arme active (si tenue) reprenne la silhouette (`Weapon.shape`). Cosmétique RAW — toutes les formes d'une
 *  Arme simple partagent les mêmes stats (LDB 62). Même patron (clone + recomputeLoadout) que setItemSkin. */
export function setItemShape(_get: Get, set: Set, heroId: string, uid: string, shape: string): void {
  mutLoadout(set, heroId, (c) => {
    const it = (c.items ?? []).find((i) => i.uid === uid);
    if (!it?.trappingId) return;
    const choices = findTrappingById(it.trappingId)?.formChoices;
    if (!choices?.includes(shape)) return; // forme hors `formChoices` → ignorée
    it.shape = shape;
  });
}

export function grantXp(get: Get, set: Set, heroId: string, amount: number): void {
  let name = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      name = h.name;
      const clone: Combatant = structuredClone(h);
      clone.xp = (clone.xp ?? 0) + amount;
      return clone;
    }),
  }));
  if (name) get().log(`${name} : ${amount >= 0 ? '+' : ''}${amount} PX.`);
}

export function buyCharAdvance(get: Get, set: Set, heroId: string, char: CharKey): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const inC = inCareerChar(careerCtx(clone).careerChars, char);
      if (mentorBlocks(inC, rule('advancement-mentor') === true, !!get().flags['mentor'])) {
        msg = `${clone.name} : ${CHAR_LABELS[char]} hors carrière — un mentor est requis (LDB 07 l.89).`;
        return h;
      }
      const r = engineBuyCharAdvance(clone, char, inC);
      if (!r.ok) {
        msg = `${clone.name} : ${CHAR_LABELS[char]} — ${r.reason}.`;
        return h;
      }
      recomputeWounds(clone);
      msg = `${clone.name} : ${CHAR_LABELS[char]} +1 (−${r.cost} PX${inC ? '' : ', hors carrière'}).`;
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Libellé d'affichage d'une Compétence/Talent concret. */
function lbl(name: string, spec?: string): string {
  return spec ? `${name} (${spec})` : name;
}

/** Achète une Augmentation de Compétence — identité (skillId, spec), LDB 09 l.42. L'achat via un
 *  emplacement « (Au choix) » libre DÉSIGNE l'emplacement (LDB 09 l.38 : la Spécialisation se
 *  choisit à l'allocation). Remise −5 PX si la Compétence est ajoutée par un talent ET déjà
 *  dans la carrière (LDB 10 Maître artisan…). */
export function buySkillAdvance(get: Get, set: Set, heroId: string, skillId: string, spec?: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const ctx = careerCtx(clone);
      const skillLabel = findSkillById(skillId)?.label ?? skillId; // AFFICHAGE (messages) + conversion pour le moteur
      const known = clone.skills.some((sk) => sk.skillId === skillId && (sk.spec ?? '') === (spec ?? ''));
      const status = inCareerStatus(ctx.sSlots, ctx.designations, skillId, spec);
      const additions = careerSkillAdditions(clone);
      const added = additions.some((a) => a.id === skillId && (!a.spec || /au choix/i.test(a.spec) || (a.spec ?? '') === (spec ?? '')));
      const inC = status != null || added;
      if (known && mentorBlocks(inC, rule('advancement-mentor') === true, !!get().flags['mentor'])) {
        msg = `${clone.name} : ${lbl(skillLabel, spec)} hors carrière — un mentor est requis (LDB 07 l.89).`;
        return h;
      }
      if (!known) {
        if (!inC) {
          msg = `${clone.name} : « ${lbl(skillLabel, spec)} » hors carrière, non acquérable.`;
          return h;
        }
        // Acquérir la Compétence de carrière à advances 0, puis l'augmenter (l'Augmentation est payée).
        const characteristic = skillCharacteristicById(skillId); // par id (≠ 2e lookup par libellé)
        clone.skills.push({ skillId, spec, characteristic, advances: 0 });
      }
      const discount = added && status != null ? 5 : 0;
      const r = engineBuySkillAdvance(clone, skillId, spec, inC, discount);
      if (!r.ok) {
        msg = `${clone.name} : ${lbl(skillLabel, spec)} — ${r.reason}.`;
        return h;
      }
      // Première allocation via un slot joker libre → désignation automatique (LDB 09 l.38).
      if (status === 'free') {
        const slot = freeSlotFor(ctx.sSlots, ctx.designations, skillId, spec);
        if (slot) designateSlot(clone, ctx.career, slot, skillId, spec, [...ctx.sSlots, ...ctx.tSlots]);
      }
      msg = `${clone.name} : ${lbl(skillLabel, spec)} +1 (−${r.cost} PX${inC ? '' : ', hors carrière'}).`;
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante sur une (id, spec)
 *  concrète (éventuellement déjà possédée via l'espèce) — il devient in-carrière et montable en
 *  PX. Arbitrage RAW : specs distinctes par carrière, désignations par carrière. */
export function designateCareerSlot(get: Get, set: Set, heroId: string, slotKey: string, optionId: string, spec?: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const ctx = careerCtx(clone);
      const all = [...ctx.sSlots, ...ctx.tSlots];
      const slot = all.find((sl) => sl.key === slotKey);
      if (!slot) {
        msg = `${clone.name} : emplacement de carrière inconnu.`;
        return h;
      }
      const r = designateSlot(clone, ctx.career, slot, optionId, spec, all);
      if (!r.ok) {
        msg = `${clone.name} : désignation refusée (${r.reason}).`;
        return h;
      }
      const label = refLabel(slot.kind === 'skill' ? 'skills' : 'talents', { id: optionId, spec }); // AFFICHAGE seul
      msg = `${clone.name} : « ${label} » devient le choix de carrière de l'emplacement (0 PX).`;
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Achète une Augmentation de Talent — identité (talentId, spec). In-carrière = un emplacement du
 *  niveau COURANT le couvre (explicite, désigné, ou libre → désignation automatique) ; hors
 *  carrière interdit (LDB 07 l.97) ; Maxi respecté (LDB 10). Applique les effets d'acquisition
 *  (+5 Caractéristique de départ, Véloce) et recale Blessures/Chance/Détermination. */
export function buyTalent(get: Get, set: Set, heroId: string, talentId: string, spec?: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const ctx = careerCtx(clone);
      const talentLabel = refLabel('talents', { id: talentId, spec }); // AFFICHAGE + conversion pour le moteur
      const status = inCareerStatus(ctx.tSlots, ctx.designations, talentId, spec, [...ctx.sSlots, ...ctx.tSlots]);
      if (!status) {
        msg = `${clone.name} : Talent « ${talentLabel} » hors carrière.`;
        return h;
      }
      if (talentMaxReached(clone, talentId, spec)) {
        msg = `${clone.name} : ${talentLabel} — Maxi atteint.`;
        return h;
      }
      const fortuneBefore = fortuneMax(clone);
      const resolveBefore = resolveMax(clone);
      const r = engineBuyTalent(clone, talentId, spec); // spec = identité PERSISTÉE (id si migré), jamais re-dérivée du libellé
      if (!r.ok) {
        msg = `${clone.name} : ${talentLabel} — ${r.reason}.`;
        return h;
      }
      if (status === 'free') {
        const slot = freeSlotFor(ctx.tSlots, ctx.designations, talentId, spec);
        if (slot) designateSlot(clone, ctx.career, slot, talentId, spec, [...ctx.sSlots, ...ctx.tSlots]);
      }
      // Effets d'acquisition (+5 Caractéristique de départ, Véloce) + attributs dérivés.
      applyTalentAcquisition(clone, talentId, spec);
      recomputeWounds(clone); // Dur à cuire / Très résistant (BE)
      clone.fortune = (clone.fortune ?? 0) + (fortuneMax(clone) - fortuneBefore); // Chanceux
      clone.resolve = (clone.resolve ?? 0) + (resolveMax(clone) - resolveBefore); // Obstiné
      msg = `${clone.name} : Talent ${talentLabel} (−${r.cost} PX).`;
      // Magie mineure (LDB 10 l.587) : BFM sorts inclus au Talent — à choisir (0 PX, Avancement).
      if (castingKindOf(talentId) === 'mineure') {
        const q = bonus(effectiveChar(clone, 'force-mentale'));
        if (q > 0) msg += ` ${q} sorts de Magie mineure inclus — à mémoriser (Avancement).`;
      }
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Apprend/mémorise un sort (LDB 46 l.44-47 + Talents LDB 10) : coût en PX selon la
 *  famille (engine/grimoire.spellCost) ; un sort de Magie du Chaos inflige AUSSI
 *  +1 Point de Corruption (« le Sort s'insinue dans votre esprit ») — appliqué par
 *  l'appelant store (seuil → mutation). */
export function buySpell(get: Get, set: Set, heroId: string, spellId: string, opts: { discountXp?: number } = {}): { ok: boolean; chaos?: boolean } {
  let msg = '';
  let result: { ok: boolean; chaos?: boolean } = { ok: false };
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const sp = findSpellById(spellId); // accès UNIQUE par id stable (prod et tests)
      if (!sp) {
        msg = `Sort « ${spellId} » introuvable.`;
        return h;
      }
      const clone: Combatant = structuredClone(h);
      const full = spellCost(clone, sp);
      if (full == null) {
        msg = `${clone.name} ne peut pas apprendre ${sp.label} (déjà connu ou Talent manquant).`;
        return h;
      }
      // Recherche universitaire (ACE Annexe I p.220) : « mémoriser un sort pour 100PX de moins que
      // son prix normal (pour un minimum de 100PX) » — remise sur CET achat seul, jamais au-dessus
      // du prix normal (plancher inerte pour les sorts à moins de 100 PX).
      const cost = opts.discountXp && full > 0 ? Math.min(full, Math.max(100, full - opts.discountXp)) : full;
      if ((clone.xp ?? 0) < cost) {
        msg = `${clone.name} : ${cost} PX requis pour mémoriser ${sp.label} (reste ${clone.xp ?? 0}).`;
        return h;
      }
      clone.xp = (clone.xp ?? 0) - cost;
      clone.spells = [...(clone.spells ?? []), sp.id]; // runtime = id de sort (pas le libellé)
      msg = cost > 0
        ? `${clone.name} mémorise ${sp.label} (−${cost} PX${cost < full ? `, remise de ${full - cost} PX — Recherche universitaire` : ''}).`
        : `${clone.name} reçoit ${sp.label} (inclus au Talent).`;
      result = { ok: true, chaos: sp.family === 'chaos' };
      return clone;
    }),
  }));
  if (msg) get().log(msg);
  return result;
}

/** Composant d'incantation (LDB 46 l.158-163, règle optionnelle `magic-composant`) : achète un
 *  composant pour un Sort d'Arcane/Domaine CONNU du héros — coût = NI pistoles d'argent (l.163),
 *  prélevé sur la bourse du groupe. « acheté pour un Sort spécifique […], ne marche que pour ce
 *  Sort. » Le composant absorbe le contrecoup à l'incantation (consumé) — cf. applyMiscast. */
export function buySpellComponent(get: Get, set: Set, heroId: string, spellId: string): void {
  const hero = get().party.find((h) => h.id === heroId);
  const sp = findSpellById(spellId);
  if (!hero || !sp) { get().log('Composant : sort introuvable.'); return; }
  if (!isArcaneSpell(sp) || sp.cn == null) { get().log(`${sp.label} : un composant ne s'applique qu'aux Sorts d'Arcane/Domaine (LDB 46 l.163).`); return; }
  if (!(hero.spells ?? []).includes(spellId)) { get().log(`${hero.name} ne connaît pas ${sp.label}.`); return; }
  // Coût = NI (cn) pistoles d'argent (silver), prélevé sur la bourse du groupe.
  const cost = toMoney({ silver: sp.cn });
  if (!canAfford(get().money, cost)) { get().log(`Bourse insuffisante pour un composant de ${sp.label} (${formatMoney(cost)}).`); return; }
  set((s) => ({
    money: moneySub(s.money, cost)!,
    party: s.party.map((h) => h.id === heroId ? { ...h, componentSpells: [...(h.componentSpells ?? []), spellId] } : h),
  }));
  get().log(`${hero.name} achète un composant pour ${sp.label} (−${formatMoney(cost)}).`);
}

/** Édite la bio MUTABLE d'un héros (hors combat) : Motivation + Ambitions court/long terme (LDB 05).
 *  Mute `store.party` (→ persisté par la save) ET propage au roster s'il y est (rosterUpdate). */
export function setHeroBackground(get: Get, set: Set, heroId: string, patch: { motivation?: string; ambitionShort?: string; ambitionLong?: string }): void {
  set((s) => ({
    party: s.party.map((h) => h.id === heroId ? {
      ...h,
      motivation: patch.motivation ?? h.motivation,
      details: { ...h.details, ambitionShort: patch.ambitionShort ?? h.details?.ambitionShort, ambitionLong: patch.ambitionLong ?? h.details?.ambitionLong },
    } : h),
  }));
  const hero = get().party.find((h) => h.id === heroId);
  if (hero) rosterUpdate(hero);
}

/** Récompenses de fin de séance (écran de fin de séance) : Ambitions accomplies par héros (perso) et de
 *  groupe, + héros ayant agi selon leur Motivation (regain de Détermination). */
export interface SessionRewards {
  heroes?: Record<string, { ambitionShort?: boolean; ambitionLong?: boolean; motivation?: boolean }>;
  group?: { ambitionShort?: boolean; ambitionLong?: boolean };
}

/**
 * Fin de séance de jeu (LDB 05 Ambitions l.793-841 + LDB 17 Détermination l.81) : octroie les PX
 * d'Ambition accomplie (personnelle +50/+500, de groupe +50/+500 à chaque héros), regagne 1 Point de
 * Détermination aux héros ayant agi selon leur Motivation (plafonné au max), puis restaure la Chance du
 * groupe (couture de séance, `restoreFortune`). SOURCE UNIQUE derrière l'écran de fin de séance.
 */
export function endSession(get: Get, set: Set, rewards: SessionRewards): void {
  const group = { short: rewards.group?.ambitionShort, long: rewards.group?.ambitionLong };
  const lines: string[] = [];
  set((s) => ({
    party: s.party.map((h) => {
      if (h.kind !== 'hero') return h;
      const f = rewards.heroes?.[h.id] ?? {};
      const xp = heroSessionXp({ short: f.ambitionShort, long: f.ambitionLong }, group);
      if (!xp && !f.motivation) return h;
      const clone: Combatant = structuredClone(h);
      if (xp) { clone.xp = (clone.xp ?? 0) + xp; lines.push(`${clone.name} : +${xp} PX (Ambition accomplie).`); }
      if (f.motivation) {
        const before = clone.resolve ?? 0;
        clone.resolve = regainDetermination(clone, 1);
        if (clone.resolve > before) lines.push(`${clone.name} : +1 Détermination (a agi selon sa Motivation).`);
      }
      return clone;
    }),
  }));
  for (const l of lines) get().log(l);
  get().restoreFortuneNow(); // Chance restaurée pour la prochaine séance (LDB 17 l.41)
}

/** Retire UN composant d'incantation possédé pour un Sort (sans remboursement). */
export function removeSpellComponent(_get: Get, set: Set, heroId: string, spellId: string): void {
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const list = [...(h.componentSpells ?? [])];
      const i = list.indexOf(spellId);
      if (i < 0) return h;
      list.splice(i, 1); // retire une seule occurrence
      return { ...h, componentSpells: list };
    }),
  }));
}

/** Fausse jambe (LDB 73 l.23) : 2 paliers DISTINCTS, achetés dans l'ordre — 100 PX (Mouvement,
 *  `prosthesisMoveTrained`) PUIS 200 PX (Esquive, `prosthesisTrained`). Crochet : 400 PX en un seul
 *  palier (`prosthesisTrained`, rachat entier de la pénalité « deux mains »). */
const LEG_MOVE_COST = 100;
const LEG_DODGE_COST = 200;
const HOOK_COST = 400;

export function trainProsthesis(get: Get, set: Set, heroId: string, uid: string): void {
  // Rachat PX d'une prothèse (LDB 73). Keyé par `trappingId` STABLE (≠ libellé).
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const it = (clone.items ?? []).find((i) => i.uid === uid);
      if (!it || !it.equipped || !it.trappingId) { msg = `${clone.name} : prothèse non portée / non entraînable.`; return h; }

      if (it.trappingId === 'fausse-jambe') {
        if (!it.prosthesisMoveTrained) { // 1er palier : 100 PX (récupérer le dernier PM perdu)
          if ((clone.xp ?? 0) < LEG_MOVE_COST) { msg = `${clone.name} : PX insuffisants (${LEG_MOVE_COST}).`; return h; }
          clone.xp = (clone.xp ?? 0) - LEG_MOVE_COST;
          it.prosthesisMoveTrained = true;
          msg = `${clone.name} s'entraîne à sa fausse jambe : Mouvement plein retrouvé (−${LEG_MOVE_COST} PX).`;
          return clone;
        }
        if (!it.prosthesisTrained) { // 2e palier : 200 PX (réapprendre l'Esquive)
          if ((clone.xp ?? 0) < LEG_DODGE_COST) { msg = `${clone.name} : PX insuffisants (${LEG_DODGE_COST}).`; return h; }
          clone.xp = (clone.xp ?? 0) - LEG_DODGE_COST;
          it.prosthesisTrained = true;
          msg = `${clone.name} réapprend l'Esquive avec sa fausse jambe (−${LEG_DODGE_COST} PX).`;
          return clone;
        }
        msg = `${clone.name} : ${it.name} déjà entraînée.`;
        return h;
      }

      if (it.trappingId === 'crochet') {
        if (it.prosthesisTrained) { msg = `${clone.name} : ${it.name} déjà entraînée.`; return h; }
        if ((clone.xp ?? 0) < HOOK_COST) { msg = `${clone.name} : PX insuffisants (${HOOK_COST}).`; return h; }
        clone.xp = (clone.xp ?? 0) - HOOK_COST;
        it.prosthesisTrained = true;
        msg = `${clone.name} maîtrise son crochet : armes à deux mains de nouveau possibles (−${HOOK_COST} PX).`;
        return clone;
      }

      msg = `${clone.name} : prothèse non portée / non entraînable.`;
      return h;
    }),
  }));
  if (msg) get().log(msg);
}

export function changeCareer(get: Get, set: Set, heroId: string, newCareer: string, newLevel: number): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      // Validation LDB 07 l.137 + LDB 08 l.7-11 : complétion, niveau cible, surcoût de Classe.
      const completed = isCompleted(clone);
      const sameClass = findCareerById(clone.career ?? '')?.class === findCareerById(newCareer)?.class;
      const targetLevelExists = levelsForCareer(newCareer).some((l) => l.level === newLevel);
      const gmJump = rule('advancement-career-jump') === true;
      const r = engineChangeCareer(clone, newCareer, newLevel, { completed, sameClass, targetLevelExists, gmJump });
      if (!r.ok) {
        msg = `${clone.name} : changement de carrière refusé (${r.reason}).`;
        return h;
      }
      msg = `${clone.name} : carrière → ${newCareer} (niv. ${newLevel}, −${r.cost} PX).`;
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

/** Crédite la bourse du GROUPE (Richesse initiale de la création, LDB 05 l.578-583). */
export function creditPartyMoney(get: Get, set: Set, m: Money, note?: string): void {
  set((s) => ({ money: moneyAdd(s.money, m) }));
  if (note) get().log(`${note} : +${formatMoney(m)}.`);
}

/** Ajoute un héros au groupe dans un emplacement du siège `seat` (0 = hôte/solo) — point
 *  d'entrée UNIQUE de la composition d'équipe (PartyScreen, HeroSelector, créateur ; côté
 *  invité l'action est enveloppée en intent, l'hôte injecte le siège autoritaire). Refuse
 *  groupe plein, doublon d'id, ou quota d'emplacements du siège épuisé. */
export function partyAddHero(get: Get, set: Set, hero: Combatant, wealth?: Money, seat = 0): void {
  const s = get();
  if (s.party.length >= 4 || s.party.some((h) => h.id === hero.id)) return;
  if (seatSlotsRemaining(s, seat) <= 0) return;
  const copy: Combatant = structuredClone(hero);
  set({
    party: [...s.party, copy],
    net: { ...s.net, ownership: { ...s.net.ownership, [copy.id]: seat } },
  });
  if (wealth) creditPartyMoney(get, set, wealth, `Richesse initiale de ${copy.name}`);
}

/** Retire un héros du groupe (écran d'équipe) et nettoie sa possession réseau.
 *  Pas de remboursement de bourse (comportement historique de « Retirer »). */
export function partyRemoveHero(get: Get, set: Set, heroId: string): void {
  const s = get();
  if (!s.party.some((h) => h.id === heroId)) return;
  const ownership = { ...s.net.ownership };
  delete ownership[heroId];
  set({ party: s.party.filter((h) => h.id !== heroId), net: { ...s.net, ownership } });
}

/** Remplace ATOMIQUEMENT le héros `oldId` par `hero` à SA position dans `party` (substitution en
 *  place → préserve l'index/ordre) ; transfère la possession au `seat` (l'ancien id est libéré).
 *  Source UNIQUE du remplacement, réutilisée par le créateur (édition en place) et le bouton
 *  « Remplacer » du slot. Ne touche PAS la bourse (un remplacement n'est pas un recrutement). */
export function partyReplaceHero(get: Get, set: Set, oldId: string, hero: Combatant, seat = 0): void {
  const s = get();
  const idx = s.party.findIndex((h) => h.id === oldId);
  if (idx < 0) return;                                                    // l'ancien n'est plus là
  if (hero.id !== oldId && s.party.some((h) => h.id === hero.id)) return; // doublon d'id
  const copy: Combatant = structuredClone(hero);
  const ownership = { ...s.net.ownership };
  delete ownership[oldId];
  ownership[copy.id] = seat;
  set({ party: s.party.map((h, i) => (i === idx ? copy : h)), net: { ...s.net, ownership } });
}


// (usePartyItem — consommable hors combat — vit dans `state/consumableFlow.ts` : le Flow du
//  consommable peut porter un nœud `test` → modale restreinte au buveur, hors de portée de ce module.)
