import { useGame } from './store';
import { checkBattleOver, resolveTalentFreeAttacks } from './combatFlow';
import { pushCombatStep } from './combatEffects';
import type { PendingBladeTrap } from './pendings';
import { bus, EVT } from './bus';
import { ev } from './combatLog';
import { isOutOfAction, addCondition } from '../engine/conditions';
import { formatImperial } from '../engine/clock';
import { testScenarios } from '../scenes/test-scenarios';
import { hoverTargeting } from './targeting';
import { getViewZ, setViewZ } from '../gameIso/viewLevel';
import { rule, setRule } from '../engine/policy';
import { pickActiveModalKey, autoPolicyOf } from './modalArbiter';
import { willAutoResolve } from './combatAuto';
import { aiDriven } from './combatGate';
import type { Combatant } from '../engine/types';
import type { Cadence } from '../engine/cadence';

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
 *   __wfrp.scenario('id', seed?) → lance un scénario de test PRÊT À JOUER (sans menu, Round 1 acquitté,
 *                           initiative déterministe si seed) ; sans arg : liste les ids
 *   __wfrp.hover('id')    → survol PROGRAMMATIQUE (tooltip + réticule de visée, sans souris) ; null efface
 *   __wfrp.aim('id')      → vérité state du ciblage (ok/invalid + raison, compétence, dégâts)
 *   __wfrp.battle()       → snapshot combat (round, actif, modales, combattants en une ligne chacun)
 *   __wfrp.log(n)         → queue lisible des journaux (exploration + feed de combat)
 *   __wfrp.turn('id')     → TRICHE : donne le tour à un combattant ; __wfrp.place('id',{x,y}) → téléporte
 *   __wfrp.modal()        → modale(s) ouvertes ; __wfrp.roll()/confirm()/cancel() → pilote LA modale
 *                           (convention <flux>Roll/Confirm/Cancel ; reveals/Round ont leur verbe propre)
 *   __wfrp.killEnemies()  → élimine tous les ennemis du combat et déclenche la victoire (flux normal)
 *   __wfrp.healParty()    → groupe à neuf (PB max, états/critiques/maladies purgés)
 *   __wfrp.give(co)       → crédite la bourse (couronnes d'or) ; __wfrp.xp(n) → +PX au groupe
 *   __wfrp.flags()        → drapeaux de scénario ; __wfrp.flag('id', true) → force un drapeau
 *   __wfrp.go('scene-id') → saute vers une scène du projet ; __wfrp.fight() → liste/lance une rencontre
 *   __wfrp.time(min)      → avance l'horloge ; __wfrp.rest(jours) → dort (cascade quotidienne #T3)
 *   __wfrp.quality(id,label,av?) → ajoute un Atout d'arme à l'arme active + Avantages (test renversement…)
 */
/** Flux « jet différé » pilotable parmi des `pending*` ouverts — convention pending<Flux> ↔
 *  <flux>Roll/Confirm/Cancel. Les files à verbe propre (révélations, pause de Round, victoire)
 *  et les invites de CIBLAGE (Cleave/DualStrike/choix de monture) sont exclues. */
function devFluxOf(open: string[]): string | null {
  const special = new Set(['pendingReveals', 'pendingRoundStart', 'pendingVictory', 'pendingCleave', 'pendingDualStrike', 'pendingMountTarget']);
  const k = open.find((x) => !special.has(x));
  if (!k) return null;
  const name = k.slice('pending'.length);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** Pilote LA modale ouverte par convention (cf. __wfrp.roll/confirm/cancel). */
function devDriveModal(verb: 'Roll' | 'Confirm' | 'Cancel'): string {
  const s = useGame.getState() as unknown as Record<string, unknown>;
  const open = Object.keys(s).filter((k) => /^pending/.test(k) && (Array.isArray(s[k]) ? (s[k] as unknown[]).length > 0 : s[k] != null));
  if (!open.length) return '❌ aucune modale ouverte';
  // Files à verbe propre d'abord : révélation témoin, pause d'ouverture de Round.
  if (verb === 'Confirm') {
    if (open.includes('pendingReveals')) { (s.dismissReveal as () => void)(); return '✅ révélation acquittée'; }
    if (open.includes('pendingRoundStart')) { (s.confirmRoundStart as () => void)(); return '✅ Round lancé'; }
  }
  const flux = devFluxOf(open);
  if (!flux) return `❌ pas de flux pilotable parmi : ${open.join(', ')}`;
  const fn = s[flux + verb];
  if (typeof fn !== 'function') return `❌ action ${flux}${verb} introuvable (modales ouvertes : ${open.join(', ')})`;
  (fn as () => void)();
  return `✅ ${flux}${verb}()`;
}

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
      (g().scene?.entities ?? []).filter((e) => !e.combat?.hiddenUntilCombat).map((e) => ({
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
    goto: (idOrXY: string | { x: number; y: number; z?: number }) => {
      // Cible une entité (sa case ET son étage z) ou des coordonnées brutes {x,y,z?}.
      const ent = typeof idOrXY === 'string' ? find(idOrXY) : null;
      const pt = typeof idOrXY === 'string' ? (ent ? { x: ent.pos.x, y: ent.pos.y, z: ent.z } : undefined) : idOrXY;
      if (!pt) return `❌ cible introuvable`;
      g().moveParty({ ...pt });
      return `✅ groupe → (${pt.x},${pt.y}${pt.z ? `,z${pt.z}` : ''})`;
    },

    /** VISUALISER LE MULTI-NIVEAUX — décompose le rendu étage par étage (tuiles pleines/vides, murs,
     *  élévation min/max) + l'étage actuellement mis en avant. Pour comprendre « ce qui est au-dessus
     *  / en dessous / au même plan ». */
    levels: () => {
      const s = g();
      const sc = s.scene;
      if (!sc) return '❌ aucune scène';
      const wallsByZ: Record<number, number> = {};
      for (const wl of sc.walls ?? []) wallsByZ[wl.z ?? 0] = (wallsByZ[wl.z ?? 0] ?? 0) + 1;
      return {
        etageActif: getViewZ() ?? (s.partyPos.z ?? 0),
        override: getViewZ(),
        groupeZ: s.partyPos.z ?? 0,
        etages: [...sc.levels].sort((a, b) => a.z - b.z).map((l) => {
          const pleines = l.tiles.filter((t) => t !== 'vide').length;
          const elevs = (l.elev ?? []).filter((e) => e !== 0);
          return {
            z: l.z,
            tuilesPleines: pleines,
            vide: l.tiles.length - pleines,
            murs: wallsByZ[l.z] ?? 0,
            elevation: elevs.length ? { cases: elevs.length, min: Math.min(...elevs), max: Math.max(...elevs) } : 'plat',
          };
        }),
      };
    },

    /** DEBUG affichage multi-niveaux : force l'étage AFFICHÉ (les autres ne sont pas rendus).
     *  `__wfrp.viewLevel(1)` montre l'étage ; `__wfrp.viewLevel(0)` le rez ; `__wfrp.viewLevel(null)`
     *  = automatique (l'étage suit le groupe). Sans argument : renvoie l'override courant. */
    viewLevel: (z?: number | null) => {
      if (z === undefined) return { override: getViewZ(), note: 'null = auto (suit le groupe)' };
      setViewZ(z);
      return `✅ étage affiché : ${z === null ? 'auto (suit le groupe)' : z}`;
    },

    /** PLAN ASCII de l'étage (défaut = l'étage AFFICHÉ) — la DONNÉE rendue en box-drawing, à comparer
     *  ligne pour ligne avec ce qui est à l'écran (vue du dessus). Tuiles : `.` parquet · `,` dalle ·
     *  `M` marbre · `S` surélevé · `s` contrebas · `#` escalier · espace=vide. Arêtes : `-`/`|` mur ·
     *  `:` porte · `/ \` diagonale. `console.log(__wfrp.ascii())` pour l'alignement monospace. */
    ascii: (z?: number) => {
      const s = g();
      const sc = s.scene;
      if (!sc) return '❌ aucune scène';
      const zz = z ?? getViewZ() ?? (s.partyPos.z ?? 0);
      const W = sc.dimensions.w, H = sc.dimensions.h;
      const lvl = sc.levels.find((l) => l.z === zz) ?? sc.levels[0];
      const tiles = lvl.tiles, elev = lvl.elev ?? [];
      const wall = new Map<string, boolean>(), diag = new Map<string, string>(), stair = new Set<string>();
      for (const w of sc.walls ?? []) {
        if ((w.z ?? 0) !== zz) continue;
        if (w.side === 'N' || w.side === 'E') wall.set(`${w.x},${w.y},${w.side}`, !!w.door);
        else diag.set(`${w.x},${w.y}`, w.side);
      }
      for (const st of sc.stairs ?? []) if (st.from.z === zz || st.to.z === zz) stair.add(`${st.from.x},${st.from.y}`);
      const cell = (x: number, y: number) => {
        if (stair.has(`${x},${y}`)) return '#';
        const d = diag.get(`${x},${y}`); if (d) return d;
        const t = tiles[y * W + x], e = elev[y * W + x] ?? 0;
        if (t === 'planches') return e > 0 ? 'S' : e < 0 ? 's' : 'P';
        return t === 'plancher' ? '.' : t === 'dalle' ? ',' : t === 'marbre' ? 'M' : t === 'vide' ? ' ' : '?';
      };
      const rows: string[] = [];
      for (let gy = 0; gy <= 2 * H; gy++) {
        let line = '';
        for (let gx = 0; gx <= 2 * W; gx++) {
          const ox = gx % 2 === 1, oy = gy % 2 === 1;
          if (ox && oy) line += cell((gx - 1) / 2, (gy - 1) / 2);
          else if (!ox && !oy) line += '+';
          else if (ox && !oy) { const wl = wall.get(`${(gx - 1) / 2},${gy / 2},N`); line += wl === undefined ? ' ' : wl ? ':' : '-'; }
          else { const wl = wall.get(`${gx / 2 - 1},${(gy - 1) / 2},E`); line += wl === undefined ? ' ' : wl ? ':' : '|'; }
        }
        rows.push(line.replace(/\s+$/, ''));
      }
      return `étage z=${zz} (${W}×${H})\n` + rows.join('\n');
    },

    /** Navigue vers un écran (menu/party/creator/editor/test/coop/campaign). */
    screen: (screen: string) => {
      g().setScreen(screen as never);
      return g().screen;
    },

    /** Survol PROGRAMMATIQUE (combat) : pose la tuile survolée d'IsoStage comme si la souris y
     *  était — tooltip + réticule se rendent sans chasser les pixels. `null` efface. Accepte un id
     *  de combattant, un id d'entité de scène, ou {x,y}. */
    hover: (idOrXY: string | { x: number; y: number } | null) => {
      const hook = (window as unknown as { __wfrpSetHover?: (t: { x: number; y: number } | null) => void }).__wfrpSetHover;
      if (!hook) return '❌ IsoStage non monté';
      if (idOrXY == null) {
        hook(null);
        return '✅ survol effacé';
      }
      const pt = typeof idOrXY === 'string'
        ? g().battle?.combatants.find((c) => c.id === idOrXY)?.pos ?? find(idOrXY)?.pos
        : idOrXY;
      if (!pt) return '❌ cible introuvable (combattant ou entité)';
      hook({ ...pt });
      return `✅ survol (${pt.x},${pt.y})`;
    },

    /** Vérité STATE du ciblage au survol — ce que le clic ferait sur cette cible pour l'actif :
     *  {kind:'ok'|'invalid'|'none', line, title, skill, base, mod, dmg | reason}. */
    aim: (id: string) => {
      const b = g().battle;
      if (!b) return '❌ pas de combat';
      const active = b.combatants.find((c) => c.id === b.order[b.turn]);
      const target = b.combatants.find((c) => c.id === id);
      if (!active || !target) return '❌ actif ou cible introuvable';
      return hoverTargeting(() => useGame.getState(), active, target);
    },

    /** Lance un SCÉNARIO DE TEST sans passer par le menu : __wfrp.scenario('ciblage', 42).
     *  Sans argument : liste les ids. `seed` (optionnel) rend l'initiative DÉTERMINISTE. Le combat
     *  démarre PRÊT (la pause d'ouverture du Round 1 est acquittée). */
    scenario: (id?: string, seed?: number) => {
      if (!id) return testScenarios.map((sc) => `${sc.id} — ${sc.icon} ${sc.title}`);
      const sc = testScenarios.find((t) => t.id === id);
      if (!sc) return `❌ « ${id} » introuvable — ids : ${testScenarios.map((t) => t.id).join(', ')}`;
      const s = g();
      if (seed != null) s.seedRng(seed);
      s.setParty(sc.makeParty());
      if (sc.extraScenes?.length || sc.worldMap) s.loadProject([sc.scene, ...(sc.extraScenes ?? [])], sc.scene.id, sc.worldMap ?? null);
      else s.startScene(sc.scene);
      if (sc.autoCombat) g().startCombat(sc.autoCombat);
      if (g().pendingRoundStart) g().confirmRoundStart();
      s.setScreen('campaign');
      return `✅ scénario « ${sc.title} » lancé${sc.autoCombat ? ' (combat direct, prêt à jouer)' : ''}`;
    },

    /** Snapshot COMBAT compact : round, actif, modales ouvertes, et chaque combattant en une ligne. */
    battle: () => {
      const s = g();
      const b = s.battle;
      if (!b) return '❌ pas de combat en cours';
      const pendings = Object.keys(s).filter((k) => {
        if (!/^pending/.test(k)) return false;
        const v = (s as unknown as Record<string, unknown>)[k];
        return Array.isArray(v) ? v.length > 0 : v != null;
      });
      return {
        round: b.round, over: b.over, action: b.action, selectedSpellId: b.selectedSpellId,
        actif: b.order[b.turn], acted: b.acted, movementUsed: b.movementUsed,
        modales: pendings,
        combatants: b.combatants.map((c) => ({
          id: c.id, name: c.name, kind: c.kind, pos: c.pos,
          pb: `${c.wounds.current}/${c.wounds.max}`,
          états: (c.conditions ?? []).map((x) => `${x.name}${x.value > 1 ? ` ×${x.value}` : ''}`),
        })),
      };
    },

    /** TRICHE de recette : donne le TOUR à un combattant (réinitialise Action/Mouvement du tour).
     *  Saute les bornes de Round (pas de cascade de fin de Round) — pour mettre en place une
     *  situation, pas pour simuler une partie. */
    turn: (id: string) => {
      const b = g().battle;
      if (!b || b.over) return '❌ pas de combat en cours';
      const idx = b.order.indexOf(id);
      const c = b.combatants.find((x) => x.id === id);
      if (idx < 0 || !c) return `❌ « ${id} » absent de l'ordre d'initiative`;
      if (isOutOfAction(c)) return `❌ ${c.name} est hors de combat`;
      useGame.setState({
        battle: { ...b, turn: idx, acted: false, movementUsed: 0, movedPreAction: false, action: null, selectedSpellId: null, preview: null, reachable: new Map(), moveSnapshot: null },
      });
      bus.emit(EVT.SCENE_DIRTY);
      return `✅ au tour de ${c.name}`;
    },

    /** TRICHE de recette : téléporte un COMBATTANT (mise en place de situations LdV/portée). */
    place: (id: string, pt: { x: number; y: number }) => {
      const b = g().battle;
      const c = b?.combatants.find((x) => x.id === id);
      if (!b || !c) return '❌ combattant introuvable (combat uniquement — hors combat : goto)';
      c.pos = { ...pt };
      useGame.setState({ battle: { ...b } });
      bus.emit(EVT.SCENE_DIRTY);
      return `✅ ${c.name} → (${pt.x},${pt.y})`;
    },

    /** Queue LISIBLE des journaux : les `n` dernières lignes du journal d'exploration ET du
     *  feed de combat (texte brut) — fini le mapping à la main dans les recettes. */
    log: (n = 8) => {
      const s = g();
      return {
        journal: s.journal.slice(-n),
        combat: (s.battle?.log ?? []).slice(-n).map((e) => `[${e.kind}] ${e.text}`),
      };
    },

    /** Modale(s) `pending*` ouvertes + les actions de pilotage dérivées (convention <flux>Roll/Confirm/Cancel). */
    modal: () => {
      const s = g() as unknown as Record<string, unknown>;
      const open = Object.keys(s).filter((k) => /^pending/.test(k) && (Array.isArray(s[k]) ? (s[k] as unknown[]).length > 0 : s[k] != null));
      if (!open.length) return { open: [], actions: [] };
      const flux = devFluxOf(open);
      const names = flux ? ['Roll', 'Confirm', 'Cancel'].map((v) => flux + v).filter((n) => typeof s[n] === 'function') : [];
      return { open, pilote: flux ? names : open.includes('pendingReveals') ? ['dismissReveal'] : open.includes('pendingRoundStart') ? ['confirmRoundStart'] : [] };
    },

    /** Lance le jet de LA modale ouverte (convention <flux>Roll) */
    roll: () => devDriveModal('Roll'),
    /** Applique/acquitte LA modale ouverte (reveals → dismissReveal, Round → confirmRoundStart, sinon <flux>Confirm). */
    confirm: () => devDriveModal('Confirm'),
    /** Annule LA modale ouverte (<flux>Cancel). */
    cancel: () => devDriveModal('Cancel'),

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

    /** RECETTE : octroie un Talent à un combattant (par id) — ex. Mâchoires d'acier pour tester son trigger. */
    talent: (id: string, talentId: string, times = 1) => {
      const grant = (c: Combatant): Combatant =>
        c.id === id ? { ...c, talents: [...(c.talents ?? []), { talentId, times }] } : c;
      useGame.setState((s) => ({
        party: s.party.map(grant),
        battle: s.battle ? { ...s.battle, combatants: s.battle.combatants.map(grant) } : s.battle,
      }));
      return `✅ ${id} → ${talentId}`;
    },

    /** RECETTE : simule une CHARGE de `enemyId` sur un héros (défaut : le plus proche) — déclenche le
     *  trigger `onCharged` (Frappe réactive : modale de choix puis Test d'Initiative influençable). C'est
     *  le MÊME appel que le mouvement d'IA quand un ennemi se rue au contact (resolveTalentFreeAttacks). */
    charge: (enemyId: string, heroId?: string) => {
      const s = g();
      const b = s.battle;
      if (!b || b.over) return '❌ pas de combat en cours';
      const enemy = b.combatants.find((c) => c.id === enemyId);
      if (!enemy) return `❌ ennemi « ${enemyId} » introuvable`;
      const heroes = b.combatants.filter((c) => c.kind === 'hero' && !isOutOfAction(c));
      const target = heroId
        ? heroes.find((c) => c.id === heroId)
        : (enemy.pos
            ? heroes.slice().sort((a, c) => {
                const d = (h: Combatant) => h.pos ? Math.max(Math.abs(h.pos.x - enemy.pos!.x), Math.abs(h.pos.y - enemy.pos!.y)) : 1e9;
                return d(a) - d(c);
              })[0]
            : heroes[0]);
      if (!target) return '❌ aucun héros chargeable';
      resolveTalentFreeAttacks(() => useGame.getState(), useGame.setState, target, 'onCharged', enemy);
      bus.emit(EVT.SCENE_DIRTY);
      return `✅ ${enemy.name} charge ${target.name} (onCharged)`;
    },

    /** RECETTE : ajoute un Atout/Défaut (par libellé OU id de qualité) à l'arme ACTIVE d'un combattant
     *  et, optionnellement, lui crédite des Avantages — ex. `quality('hero-1','Déstabilisante',2)` pour
     *  tester le renversement onHit influençable. La qualité est reconnue label/id/casse (resolveQualities). */
    quality: (id: string, label = 'Déstabilisante', advantage?: number) => {
      const tweak = (c: Combatant): Combatant => {
        if (c.id !== id) return c;
        const weapons = (c.weapons ?? []).map((w, i) => (i === 0 ? { ...w, qualities: [...(w.qualities ?? []), label] } : w));
        return { ...c, weapons, ...(advantage != null ? { advantage } : {}) };
      };
      useGame.setState((s) => ({
        party: s.party.map(tweak),
        battle: s.battle ? { ...s.battle, combatants: s.battle.combatants.map(tweak) } : s.battle,
      }));
      const c = g().battle?.combatants.find((x) => x.id === id) ?? g().party.find((x) => x.id === id);
      return c ? `✅ ${c.name} : arme « ${c.weapons?.[0]?.name} » + ${label}${advantage != null ? ` · ${advantage} Av` : ''}` : `❌ ${id} introuvable`;
    },

    /** RECETTE : applique un État à un combattant (par id) via le VRAI addCondition → déclenche les
     *  triggers onGainCondition (Mâchoires d'acier ouvre alors sa modale de Résistance influençable). */
    condition: (id: string, name = 'sonne', n = 1) => {
      const s = g();
      const c = s.battle?.combatants.find((x) => x.id === id) ?? s.party.find((x) => x.id === id);
      if (!c) return `❌ combattant ${id} introuvable`;
      addCondition(c, name, n);
      useGame.setState((st) => ({
        party: [...st.party],
        battle: st.battle ? { ...st.battle, combatants: [...st.battle.combatants] } : st.battle,
      }));
      return `✅ ${c.name} : +${n} ${name}`;
    },

    /** RECETTE : ouvre l'étape de CHOIX « Piège-lame » (LDB 62 l.292-295) — `bladeTrap('hero-1','enemy-1', 2)`.
     *  Le héros `defenderId` a paré avec une arme Piège-lame face à la lame de `attackerId` (uid assigné si
     *  besoin) ; `defSL` = DR de la défense ajouté au Test opposé. Choisir « Piéger » ouvre alors un Test
     *  opposé de Force CADENCE-AWARE (héros manuel → étape influençable) ; succès → désarme (Stupéfiant →
     *  brise sauf Incassable). Reproduit l'entrée de production sans avoir à forcer un Critique défensif. */
    bladeTrap: (defenderId: string, attackerId: string, defSL = 4) => {
      const b = g().battle;
      if (!b) return '❌ pas en combat';
      const defender = b.combatants.find((c) => c.id === defenderId);
      const attacker = b.combatants.find((c) => c.id === attackerId);
      if (!defender || !attacker) return `❌ défenseur/attaquant introuvable (${defenderId}/${attackerId})`;
      const weapon = attacker.weapons?.[0];
      if (!weapon) return `❌ ${attacker.name} n'a pas d'arme active`;
      if (!weapon.uid) weapon.uid = `dev-blade-${attackerId}`; // uid universel requis pour cibler la lame
      const pbt: PendingBladeTrap = { defenderId, attackerId, weapon, parryWeaponUid: defender.weapons?.[0]?.uid ?? 'parry', defSL, roll: 33 };
      pushCombatStep(useGame.setState, {
        id: `cons-bladetrap-${defenderId}`, kind: 'bladeTrap', actorId: defenderId, icon: '🗡️',
        label: 'Parade — piéger la lame ?',
        options: [{ key: 'trap', label: '🗡️ Piéger la lame' }, { key: 'crit', label: '💥 Coup Critique' }],
        defaultChoice: 'crit', bladeTrap: pbt, interactive: true,
      });
      useGame.setState((s) => ({ battle: s.battle ? { ...s.battle, combatants: [...s.battle.combatants] } : s.battle }));
      return `✅ Piège-lame : ${defender.name} pare ${attacker.name} (${weapon.name}, +${defSL} DR) → choix Piéger/Critique`;
    },

    /** RECETTE : met un combattant en FOCALISATION (DR cumulé sur un sort) — `focus('hero-1')` →
     *  Armure Aethyrique DR 3. Frapper ensuite le focaliseur (attaque ennemie / `__wfrp.condition` +
     *  dégâts) déclenche `checkFocusInterruption` : Test de Calme Difficile INFLUENÇABLE (héros manuel). */
    focus: (id: string, spell = 'armure-aethyrique', dr = 3) => {
      const s = g();
      const c = s.battle?.combatants.find((x) => x.id === id) ?? s.party.find((x) => x.id === id);
      if (!c) return `❌ combattant ${id} introuvable`;
      c.focus = { spell, dr };
      useGame.setState((st) => ({
        party: [...st.party],
        battle: st.battle ? { ...st.battle, combatants: [...st.battle.combatants] } : st.battle,
      }));
      return `✅ ${c.name} : Focalisation ${spell} (DR ${dr})`;
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

    /** RECETTE : règle (ou lit) la Cadence de combat — manuel = défaut ; rapide = jets auto-lancés
     *  sans dépense ; auto = l'IA joue aussi les héros + Destin auto. Surcharge runtime (non persistée). */
    cadence: (mode?: Cadence) => {
      if (!mode) return `cadence = ${rule('combat-cadence')} (manuel | rapide | auto)`;
      setRule('combat-cadence', mode);
      return `✅ Cadence de combat → ${mode}`;
    },

    /** RECETTE : diagnostic d'AUTO-CADENCE — « pourquoi ça avance / ça se fige ? ». Montre le mode, la
     *  modale active + sa politique, le verdict `willAutoResolve` (rendue ou masquée+auto-pilotée), tous
     *  les `pending*` ouverts, et l'acteur courant (aiDriven). Un `pending*` ouvert avec cadence ≠ manuel
     *  ET `willAutoResolve:false` sans attente de choix joueur = soft-lock probable (modale invisible non pilotée). */
    auto: () => {
      const s = useGame.getState();
      const sr = s as unknown as Record<string, unknown>;
      const open = Object.keys(sr).filter((k) => /^pending/.test(k) && (Array.isArray(sr[k]) ? (sr[k] as unknown[]).length > 0 : sr[k] != null));
      const b = s.battle;
      const act = b && !b.over ? b.combatants.find((c) => c.id === b.order[b.turn]) : undefined;
      const key = pickActiveModalKey(s);
      return {
        cadence: rule('combat-cadence'),
        activeModal: key,
        policy: autoPolicyOf(s)?.mode ?? null,
        willAutoResolve: willAutoResolve(s),
        openPendings: open,
        roundPause: !!s.pendingRoundStart,
        medic: !!s.medic,
        active: act ? { id: act.id, kind: act.kind, aiDriven: aiDriven(s, act), acted: !!b!.acted } : null,
      };
    },
  };
}

export function installDevtools() {
  const w = window as unknown as { __wfrp?: ReturnType<typeof buildApi>; __game?: typeof useGame };
  w.__wfrp = buildApi();
  w.__game = useGame; // rétro-compat (recettes antérieures)
}
