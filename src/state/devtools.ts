import { useGame } from './store';
import { checkBattleOver } from './combatFlow';
import { ev } from './combatLog';
import { isOutOfAction } from '../engine/conditions';
import { formatImperial } from '../engine/clock';
import type { Combatant } from '../engine/types';

/**
 * Outils de recette navigateur (DEV uniquement) — exposés sur `window.__wfrp`.
 *
 * But (demande utilisateur 2026-06-11) : piloter le jeu et CARTOGRAPHIER la scène depuis
 * Playwright SANS chasser les coordonnées pixel des tokens. Depuis une recette :
 *   __wfrp.state()        → instantané lisible (écran, dialogue, combat, position du groupe)
 *   __wfrp.entities()     → liste des entités de la scène + leur mode d'accès
 *   __wfrp.talk('id')     → téléporte le groupe à côté de l'entité et l'interpelle (dialogue/marchand)
 *   __wfrp.goto('id')     → place le groupe sur la case de l'entité (déclenche portes/triggers au pas)
 *   __wfrp.screen('menu') → navigue vers un écran
 *   __wfrp.killEnemies()  → élimine tous les ennemis du combat et déclenche la victoire (flux normal)
 *   __wfrp.healParty()    → groupe à neuf (PB max, états/critiques/maladies purgés)
 *   __wfrp.give(co)       → crédite la bourse (couronnes d'or) ; __wfrp.xp(n) → +PX au groupe
 *   __wfrp.flags()        → drapeaux de scénario ; __wfrp.flag('id', true) → force un drapeau
 *   __wfrp.go('scene-id') → saute vers une scène du projet ; __wfrp.fight() → liste/lance une rencontre
 *   __wfrp.time(min)      → avance l'horloge ; __wfrp.rest(jours) → dort (cascade quotidienne #T3)
 */
export function buildApi() {
  const g = () => useGame.getState();
  const find = (id: string) => g().scene?.entities.find((e) => e.id === id);
  return {
    /** Le store brut (sélecteurs, getState, setState) — pour les cas non couverts par les helpers. */
    store: useGame,

    /** Instantané lisible de l'état courant. */
    state: () => {
      const s = g();
      return {
        screen: s.screen,
        sceneId: s.scene?.id,
        sceneName: s.scene?.nom,
        partyPos: s.partyPos,
        mode: s.mode,
        inDialogue: !!s.dialogue,
        dialogueSpeaker: s.dialogue?.speakerId,
        inCombat: !!s.battle,
        party: s.party.map((h) => ({ id: h.id, name: h.name })),
        money: s.money,
      };
    },

    /** CARTOGRAPHIE : toutes les entités de la scène + comment y accéder. */
    entities: () =>
      (g().scene?.entities ?? []).map((e) => ({
        id: e.id,
        label: e.label,
        kind: e.kind,
        pos: e.pos,
        access: e.dialogueId ? 'talk' : e.merchant ? 'merchant' : e.interact ? 'interact' : '—',
      })),

    /** ACCÈS DIRECT : ouvre le dialogue/marchand d'une entité (téléporte le groupe à côté puis interagit). */
    talk: (id: string) => {
      const ent = find(id);
      if (!ent) return `❌ « ${id} » introuvable — voir __wfrp.entities()`;
      useGame.setState({ partyPos: { ...ent.pos } });
      g().interactEntity(id);
      const s = g();
      if (s.dialogue) return `✅ dialogue ouvert (${id})`;
      if (s.merchant) return `✅ marchand ouvert (${id})`;
      return `⚠️ rien déclenché (${id}) — l'entité n'a ni dialogue ni marchand`;
    },

    /** Place le groupe sur la case d'une entité/coord (déclenche portes, triggers, fouilles au pas). */
    goto: (idOrXY: string | { x: number; y: number }) => {
      const pt = typeof idOrXY === 'string' ? find(idOrXY)?.pos : idOrXY;
      if (!pt) return `❌ cible introuvable`;
      g().moveParty({ ...pt });
      return `✅ groupe → (${pt.x},${pt.y})`;
    },

    /** Navigue vers un écran (menu/party/creator/editor/test/coop/campaign). */
    screen: (screen: string) => {
      g().setScreen(screen as never);
      return g().screen;
    },

    /** RECETTE : élimine tous les ennemis du combat en cours puis passe par le flux de
     *  victoire NORMAL (`checkBattleOver` : finalize, pendingVictory/butin, onVictory).
     *  `dead` couvre aussi les ennemis « importants » que la Mort Subite à 0 PB ne sort pas. */
    killEnemies: () => {
      const s = g();
      if (!s.battle || s.battle.over) return '❌ pas de combat en cours';
      const slain = s.battle.combatants.filter((c) => c.kind === 'enemy' && !isOutOfAction(c));
      if (!slain.length) return '⚠️ aucun ennemi encore debout';
      const combatants = s.battle.combatants.map((c) =>
        c.kind === 'enemy' && !isOutOfAction(c)
          ? { ...c, dead: true, wounds: { ...c.wounds, current: 0 } }
          : c,
      );
      useGame.setState({
        battle: {
          ...s.battle,
          combatants,
          log: [...s.battle.log, ev('info', `💀 Recette : ${slain.length} ennemi(s) éliminé(s).`)],
        },
      });
      checkBattleOver(() => useGame.getState(), useGame.setState);
      return `✅ ${slain.length} ennemi(s) éliminé(s) — ${useGame.getState().battle?.over ?? 'combat en cours'}`;
    },

    /** RECETTE : remet le groupe à neuf — PB max, états purgés, critiques/maladies effacés,
     *  morts relevés (party ET clones du combat en cours). */
    healParty: () => {
      const fix = (c: Combatant): Combatant => ({
        ...c,
        wounds: { ...c.wounds, current: c.wounds.max },
        conditions: [],
        criticalWounds: 0,
        diseases: [],
        dead: false,
        outOfRencontre: false,
      });
      useGame.setState((s) => ({
        party: s.party.map(fix),
        battle: s.battle
          ? { ...s.battle, combatants: s.battle.combatants.map((c) => (c.kind === 'hero' ? fix(c) : c)) }
          : s.battle,
      }));
      return `✅ groupe soigné (${g().party.length} héros)`;
    },

    /** RECETTE : crédite la bourse du groupe (en couronnes d'or). */
    give: (gold = 10) => {
      g().creditPartyMoney({ gold, silver: 0, brass: 0 }, 'Recette');
      return g().money;
    },

    /** RECETTE : +PX à tout le groupe (teste l'avancement). */
    xp: (amount = 100) => {
      useGame.setState((s) => ({ party: s.party.map((h) => ({ ...h, xp: (h.xp ?? 0) + amount })) }));
      return g().party.map((h) => `${h.name} : ${h.xp} PX`);
    },

    /** RECETTE : drapeaux de scénario (portes de l'arène, etc.). */
    flags: () => g().flags,
    flag: (id: string, value = true) => {
      useGame.setState((s) => ({ flags: { ...s.flags, [id]: value } }));
      return g().flags;
    },

    /** RECETTE : saute vers une scène du projet/de la campagne par id (machinerie de transition). */
    go: (sceneId: string, entry?: string) => {
      g().transitionTo(sceneId, entry);
      const after = g().scene?.id;
      return after === sceneId ? `✅ scène → ${sceneId}` : `❌ « ${sceneId} » inconnue (scène : ${after ?? '—'})`;
    },

    /** RECETTE : liste les rencontres de la scène (sans argument) ou en lance une. */
    fight: (encounterId?: string) => {
      const encs = g().scene?.encounters ?? [];
      if (!encounterId) return encs.map((e) => e.id);
      if (!encs.some((e) => e.id === encounterId))
        return `❌ rencontre inconnue — dispo : ${encs.map((e) => e.id).join(', ') || 'aucune'}`;
      g().startCombat(encounterId);
      return g().battle ? `✅ combat lancé (${encounterId})` : `⚠️ rien lancé (rencontre vide ?)`;
    },

    /** RECETTE : avance l'horloge (purge les effets à durée d'horloge). */
    time: (minutes = 60) => {
      g().advanceTime(minutes);
      return `🕐 ${formatImperial(g().gameTime)}`;
    },

    /** RECETTE : le groupe dort N jours — déroule la cascade quotidienne #T3 (rations/faim,
     *  maladies, convalescence des critiques). */
    rest: (days = 1) => {
      g().restParty(days);
      return `🛏️ +${days} j → ${formatImperial(g().gameTime)}`;
    },
  };
}

export function installDevtools() {
  const w = window as unknown as { __wfrp?: ReturnType<typeof buildApi>; __game?: typeof useGame };
  w.__wfrp = buildApi();
  w.__game = useGame; // rétro-compat (recettes antérieures)
}
