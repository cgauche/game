/**
 * Actions GROUPE (hors combat) extraites de store.ts pour le garder navigable — même patron
 * `(get, set)` que combatFlow : équipement (équiper/transférer/skin), avancement PX
 * (caractéristiques/compétences/talents/carrière, prothèses), consommables de fiche, butin.
 * Refacto pure — comportement préservé.
 */
import type { GameState } from './store';
import { Combatant, CharKey, CHAR_LABELS, CHAR_BY_LABEL } from '../engine/types';
import { recomputeLoadout, addItemToHero, loadoutCreate, loadoutRename, loadoutDelete, loadoutSetActive, loadoutSetSlot } from '../engine/items';
import { maxWounds } from '../engine/characteristics';
import {
  buyCharAdvance as engineBuyCharAdvance,
  buySkillAdvance as engineBuySkillAdvance,
  buyTalent as engineBuyTalent,
  changeCareer as engineChangeCareer,
  isCareerLevelComplete,
  inCareerChar,
  inCareerSkill,
  inCareerTalent,
} from '../engine/advancement';
import { itemUse, applyItemUse } from '../engine/consumables';
import { levelsForCareer, findSkill } from '../data/index';
import { bus, EVT } from './bus';

type Get = () => GameState;
type Set = (s: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

/** Données du Niveau de Carrière COURANT d'un héros (depuis careerLevels.json), pour la
 *  détection in-carrière et la complétion. `undefined` si la carrière est hors base. */
function currentCareerLevel(hero: Combatant) {
  return levelsForCareer(hero.career ?? '').find((l) => l.level === (hero.careerLevel ?? 1));
}

/** Recalcule les Blessures max (BF + 2·BE + BFM, LDB Attributs) après une Augmentation de
 *  Caractéristique ; un gain de max augmente aussi le courant d'autant (mute le héros). */
function recomputeWounds(hero: Combatant) {
  // Augmentation permanente de Caractéristique → recalcul de la BASE (formule × Taille de l'espèce).
  const newMax = maxWounds(hero.characteristics, hero.size ?? 'moyenne');
  const delta = newMax - hero.wounds.max;
  hero.wounds.base = newMax;
  hero.wounds.max = newMax;
  if (delta > 0) hero.wounds.current += delta;
  if (hero.wounds.current > newMax) hero.wounds.current = newMax;
}

/** Équipe/déséquipe un objet d'un héros et recalcule ses armes/armure actives. */
export function toggleEquip(_get: Get, set: Set, heroId: string, uid: string): void {
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = JSON.parse(JSON.stringify(h));
      const it = (clone.items ?? []).find((i) => i.uid === uid);
      if (it) {
        it.equipped = !it.equipped;
        recomputeLoadout(clone);
      }
      return clone;
    }),
  }));
}

/** Applique une mutation de loadout à un héros (clone + recompute), même pattern que toggleEquip. */
function mutLoadout(set: Set, heroId: string, fn: (c: Combatant) => void): void {
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = JSON.parse(JSON.stringify(h));
      fn(clone);
      recomputeLoadout(clone);
      return clone;
    }),
  }));
}

export function createLoadout(_get: Get, set: Set, heroId: string, name: string): void {
  mutLoadout(set, heroId, (c) => loadoutCreate(c, name));
}
export function renameLoadout(_get: Get, set: Set, heroId: string, id: string, name: string): void {
  mutLoadout(set, heroId, (c) => loadoutRename(c, id, name));
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
        const c: Combatant = JSON.parse(JSON.stringify(h));
        c.items = (c.items ?? []).filter((i) => i.uid !== uid);
        recomputeLoadout(c);
        return c;
      }
      if (h.id === toHeroId) {
        const c: Combatant = JSON.parse(JSON.stringify(h));
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
      const clone: Combatant = JSON.parse(JSON.stringify(h));
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

export function grantXp(get: Get, set: Set, heroId: string, amount: number): void {
  let name = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      name = h.name;
      const clone: Combatant = JSON.parse(JSON.stringify(h));
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
      const clone: Combatant = JSON.parse(JSON.stringify(h));
      const inC = inCareerChar(currentCareerLevel(clone)?.characteristics ?? [], char);
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

export function buySkillAdvance(get: Get, set: Set, heroId: string, skillName: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = JSON.parse(JSON.stringify(h));
      const known = clone.skills.some((sk) => sk.name === skillName);
      const inC = inCareerSkill(currentCareerLevel(clone)?.skills ?? [], skillName);
      if (!known) {
        if (!inC) {
          msg = `${clone.name} : « ${skillName} » hors carrière, non acquérable.`;
          return h;
        }
        // Acquérir la Compétence de carrière à advances 0, puis l'augmenter (l'Augmentation est payée).
        const characteristic = CHAR_BY_LABEL[findSkill(skillName)?.characteristic ?? ''] ?? 'Int';
        clone.skills.push({ name: skillName, characteristic, advances: 0 });
      }
      const r = engineBuySkillAdvance(clone, skillName, inC);
      if (!r.ok) {
        msg = `${clone.name} : ${skillName} — ${r.reason}.`;
        return h;
      }
      msg = `${clone.name} : ${skillName} +1 (−${r.cost} PX${inC ? '' : ', hors carrière'}).`;
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

export function buyTalent(get: Get, set: Set, heroId: string, talentName: string): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = JSON.parse(JSON.stringify(h));
      const inC = inCareerTalent(currentCareerLevel(clone)?.talents ?? [], talentName);
      if (!inC) {
        msg = `${clone.name} : Talent « ${talentName} » hors carrière (LDB l.97).`;
        return h;
      }
      const r = engineBuyTalent(clone, talentName);
      if (!r.ok) {
        msg = `${clone.name} : ${talentName} — ${r.reason}.`;
        return h;
      }
      msg = `${clone.name} : Talent ${talentName} (−${r.cost} PX).`;
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

export function trainProsthesis(get: Get, set: Set, heroId: string, uid: string): void {
  // Rachat PX d'une prothèse (LDB 73) : Fausse jambe → réapprendre l'Esquive (200 PX) ; Crochet → racheter
  // la pénalité « deux mains » entière (400 PX) pour manier de nouveau les armes à deux mains.
  const COSTS: Record<string, number> = { 'Fausse jambe': 200, Crochet: 400 };
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = JSON.parse(JSON.stringify(h));
      const it = (clone.items ?? []).find((i) => i.uid === uid);
      const cost = it ? COSTS[it.name] : undefined;
      if (!it || cost == null || !it.equipped) { msg = `${clone.name} : prothèse non portée / non entraînable.`; return h; }
      if (it.prosthesisTrained) { msg = `${clone.name} : ${it.name} déjà entraînée.`; return h; }
      if ((clone.xp ?? 0) < cost) { msg = `${clone.name} : PX insuffisants (${cost}).`; return h; }
      clone.xp = (clone.xp ?? 0) - cost;
      it.prosthesisTrained = true;
      msg = it.name === 'Crochet'
        ? `${clone.name} maîtrise son crochet : armes à deux mains de nouveau possibles (−${cost} PX).`
        : `${clone.name} réapprend l'Esquive avec sa fausse jambe (−${cost} PX).`;
      return clone;
    }),
  }));
  if (msg) get().log(msg);
}

export function changeCareer(get: Get, set: Set, heroId: string, newCareer: string, newLevel: number): void {
  let msg = '';
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = JSON.parse(JSON.stringify(h));
      const lvl = currentCareerLevel(clone);
      const completed = lvl ? isCareerLevelComplete(clone, clone.careerLevel ?? 1, lvl.skills, lvl.talents) : false;
      const r = engineChangeCareer(clone, newCareer, newLevel, completed);
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

/** Écran de victoire : assigne un objet du butin de groupe à un héros (même flux que le marchand). */
export function giveItemToHero(_get: Get, set: Set, label: string, heroId: string): void {
  set((s) => {
    const idx = s.inventory.indexOf(label);
    if (idx < 0) return {}; // déjà assigné / absent du stock de groupe
    const inventory = [...s.inventory.slice(0, idx), ...s.inventory.slice(idx + 1)];
    const party = s.party.map((h) => (h.id === heroId ? addItemToHero(h, label) : h));
    const pv = s.pendingVictory;
    const li = pv ? pv.loot.indexOf(label) : -1;
    const pendingVictory = pv && li >= 0 ? { ...pv, loot: [...pv.loot.slice(0, li), ...pv.loot.slice(li + 1)] } : pv;
    return { inventory, party, pendingVictory };
  });
}

/** HORS COMBAT : un héros utilise un consommable (bandages, potion) depuis sa fiche — même effet
 *  qu'en combat (`applyItemUse`), consommé, journalisé. Le combat passe par `battleUseItem` (coûte l'Action). */
export function usePartyItem(get: Get, set: Set, heroId: string, uid: string): void {
  if (get().battle) return; // en combat → battleUseItem
  const party = get().party;
  const hero = party.find((h) => h.id === heroId);
  const it = hero?.items?.find((i) => i.uid === uid);
  if (!hero || !it) return;
  const eff = itemUse(it, hero);
  if (!eff) return;
  const log = [`${hero.name} utilise : ${it.name}.`, ...applyItemUse(hero, eff)];
  hero.items = (hero.items ?? []).filter((i) => i.uid !== uid);
  set({ party: [...party], journal: [...get().journal.slice(-40), ...log] });
  bus.emit(EVT.SCENE_DIRTY);
}
