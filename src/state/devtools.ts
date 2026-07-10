import { useGame, SCREENS } from './store';
import { portRepairVessel, portCareenVessel, portInstallUpgrade } from './seaVoyageFlow';
import { actorIn } from './combatOrParty';
import { checkBattleOver, resolveFreeAttacks, approachFearTrigger, aiTurnLog, clearAiTurnLog, maybeRunEnemyTurn, applyEffects } from './combatFlow';
import { setAiTrace } from './ai';
import { pushCombatStep } from './combatEffects';
import type { PendingBladeTrap } from './pendings';
import { bus, EVT } from './bus';
import { ev } from './combatLog';
import { isOutOfAction, addCondition } from '../engine/conditions';
import { applyOps } from '../engine/ops';
import { parseQualityInstance } from '../engine/qualities/normalize';
import { formatImperial } from '../engine/clock';
import { testScenarios } from '../scenes/test-scenarios';
import { hoverTargeting } from './targeting';
import { maneuverShip } from './shipManeuver';
import { getViewZ, setViewZ } from './viewLevel';
import { setRevealAll } from './visionState';
import { rule, setRule, resetRule, ruleDef, OPTIONAL_RULES, type RuleValue } from '../engine/policy';
import { pickActiveModalKey, autoPolicyOf } from './modalArbiter';
import { willAutoResolve } from './combatAuto';
import { aiDriven } from './combatGate';
import type { Combatant } from '../engine/types';

/**
 * Outils de recette navigateur (DEV uniquement) — exposés sur `window.__wfrp`.
 *
 * But (demande utilisateur 2026-06-11) : piloter le jeu et CARTOGRAPHIER la scène depuis
 * Playwright SANS chasser les coordonnées pixel des tokens. Depuis une recette :
 *   __wfrp.state()        → instantané lisible (écran, dialogue, combat, position du groupe)
 *   __wfrp.entities()     → liste des entités de la scène + leur mode d'accès
 *   __wfrp.screenPos('id') → bounding box ÉCRAN du token (combat ET exploration, `data-cid`) — LECTURE
 *                           seule (`getBoundingClientRect`), `null` si absent du DOM
 *   __wfrp.talk('id')     → téléporte le groupe à côté de l'entité et l'interpelle (dialogue/marchand)
 *   __wfrp.goto('id')     → place le groupe sur la case de l'entité (déclenche portes/triggers au pas)
 *   __wfrp.screen('menu') → navigue vers un écran
 *   __wfrp.scenario('id', seed?) → lance un scénario de test PRÊT À JOUER (sans menu, Round 1 acquitté,
 *                           initiative déterministe si seed) ; sans arg : liste les ids
 *   __wfrp.hover('id')    → survol PROGRAMMATIQUE (tooltip + réticule de visée, sans souris) ; null efface
 *   __wfrp.aim('id')      → vérité state du ciblage (ok/invalid + raison, compétence, dégâts)
 *   __wfrp.pad('A'|'B'|…) → simule un BOUTON de manette (Playwright n'a pas l'API Gamepad) — MÊME chemin
 *                           que le pad réel ; __wfrp.padDir('up'|'down'|'left'|'right') → croix/stick
 *   __wfrp.battle()       → snapshot combat (round, actif, modales, combattants en une ligne chacun)
 *   __wfrp.log(n)         → queue lisible des journaux (exploration + feed de combat)
 *   __wfrp.aiLog(n)       → DIAGNOSTIC IA : action choisie + classement des candidats (intention) par tour
 *   __wfrp.turn('id')     → TRICHE : donne le tour à un combattant ; __wfrp.place('id',{x,y}) → téléporte
 *   __wfrp.turnShip('id', 'tribord'|'babord'|crans) → vire le cap d'un NAVIRE (manœuvre) → re-mappe ses bordées
 *   __wfrp.modal()        → modale(s) ouvertes ; __wfrp.roll()/confirm()/cancel() → pilote LA modale
 *                           (convention <flux>Roll/Confirm/Cancel ; reveals/Round ont leur verbe propre)
 *   __wfrp.killEnemies()  → élimine tous les ennemis du combat et déclenche la victoire (flux normal)
 *   __wfrp.dealDamage('id', n) → inflige n Dégâts (op wounds, VRAI pipeline : armure de coque, reddition/naufrage)
 *   __wfrp.combatEnd({…}) → arme les conséquences de fin de combat (critique infectant + exposition
 *                           Corruption) puis termine le combat en LAISSANT la cascade ouverte (influençable)
 *   __wfrp.healParty()    → groupe à neuf (PB max, états/critiques/maladies purgés)
 *   __wfrp.give(co)       → crédite la bourse (couronnes d'or) ; __wfrp.xp(n) → +PX au groupe
 *   __wfrp.giveTrapping(heroId, trappingId, qty?) → donne un objet de catalogue à un héros (VRAI
 *                           pipeline giveTrapping : item bien formé, qualités comprises)
 *   __wfrp.flags()        → drapeaux de scénario ; __wfrp.flag('id', true) → force un drapeau
 *   __wfrp.go('scene-id') → saute vers une scène du projet ; __wfrp.fight() → liste/lance une rencontre
 *   __wfrp.fear(h,e,i?)   → pose une Peur (Indice) de h envers e puis simule l'approche (Test de Calme ou Brisé)
 *   __wfrp.time(min)      → avance l'horloge ; __wfrp.rest(jours) → dort (cascade quotidienne #T3)
 *   __wfrp.quality(id,label,av?) → ajoute un Atout d'arme à l'arme active + Avantages (test renversement…)
 *   __wfrp.seed(n)        → ré-ensemence le RNG de bataille (déterminisme, EN COURS de combat)
 *   __wfrp.fastForward(n?) → avance les tours IA (BORNÉ à `n` scrutations) jusqu'au prochain tour d'un
 *                           combattant piloté HUMAIN ou la fin du combat — MÊME machinerie (advanceTurn/
 *                           maybeRunEnemyTurn), juste sans les délais de lisibilité (chorégraphie)
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
  if (!open.length) return '✗ aucune modale ouverte';
  // Files à verbe propre d'abord : révélation témoin, pause d'ouverture de Round.
  if (verb === 'Confirm') {
    if (open.includes('pendingReveals')) { (s.dismissReveal as () => void)(); return '✓ révélation acquittée'; }
    if (open.includes('pendingRoundStart')) { (s.confirmRoundStart as () => void)(); return '✓ Round lancé'; }
  }
  const flux = devFluxOf(open);
  if (!flux) return `✗ pas de flux pilotable parmi : ${open.join(', ')}`;
  const fn = s[flux + verb];
  if (typeof fn !== 'function') return `✗ action ${flux}${verb} introuvable (modales ouvertes : ${open.join(', ')})`;
  (fn as () => void)();
  return `✓ ${flux}${verb}()`;
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

    /** OBSERVATION seule : bounding box ÉCRAN du token `id` (combat ET exploration — même canal
     *  `data-cid`, #226) via `getBoundingClientRect`. `null` si le token n'est pas dans le DOM
     *  (hors vue, scène/combat sans ce token). Zéro action — ne pilote rien. */
    screenPos: (id: string): { x: number; y: number; width: number; height: number } | null => {
      const el = document.querySelector(`[data-cid="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },

    /** ACCÈS DIRECT : ouvre le dialogue/marchand d'une entité (téléporte le groupe à côté puis interagit). */
    talk: (id: string) => {
      const ent = find(id);
      if (!ent) return `✗ « ${id} » introuvable — voir __wfrp.entities()`;
      useGame.setState({ partyPos: { ...ent.pos } });
      g().interactEntity(id);
      const s = g();
      if (s.dialogue) return `✓ dialogue ouvert (${id})`;
      if (s.merchant) return `✓ marchand ouvert (${id})`;
      return `rien déclenché (${id}) — l'entité n'a ni dialogue ni marchand`;
    },

    /** Place le groupe sur la case d'une entité/coord (déclenche portes, triggers, fouilles au pas). */
    goto: (idOrXY: string | { x: number; y: number; z?: number }) => {
      // Cible une entité (sa case ET son étage z) ou des coordonnées brutes {x,y,z?}.
      const ent = typeof idOrXY === 'string' ? find(idOrXY) : null;
      const pt = typeof idOrXY === 'string' ? (ent ? { x: ent.pos.x, y: ent.pos.y, z: ent.z } : undefined) : idOrXY;
      if (!pt) return `✗ cible introuvable`;
      g().moveParty({ ...pt });
      return `✓ groupe → (${pt.x},${pt.y}${pt.z ? `,z${pt.z}` : ''})`;
    },

    /** VISUALISER LE MULTI-NIVEAUX — décompose le rendu couche par couche (tuiles pleines/vides, murs,
     *  hauteur MÉTRIQUE min/max en mètres) + l'étage actuellement mis en avant. Pour comprendre « ce qui
     *  est au-dessus / en dessous / au même plan ». */
    levels: () => {
      const s = g();
      const sc = s.scene;
      if (!sc) return '✗ aucune scène';
      const wallsByZ: Record<number, number> = {};
      for (const wl of sc.walls ?? []) wallsByZ[wl.z ?? 0] = (wallsByZ[wl.z ?? 0] ?? 0) + 1;
      return {
        etageActif: getViewZ() ?? (s.partyPos.z ?? 0),
        override: getViewZ(),
        groupeZ: s.partyPos.z ?? 0,
        couches: [...sc.layers].sort((a, b) => a.z - b.z).map((l) => {
          const pleines = l.tiles.filter((t) => t !== 'vide').length;
          const hs = (l.height ?? []).filter((h) => h !== 0);
          return {
            z: l.z,
            tuilesPleines: pleines,
            vide: l.tiles.length - pleines,
            murs: wallsByZ[l.z] ?? 0,
            hauteur: hs.length ? { cases: hs.length, minM: Math.min(...hs), maxM: Math.max(...hs) } : 'plat',
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
      return `✓ étage affiché : ${z === null ? 'auto (suit le groupe)' : z}`;
    },

    /** PLAN ASCII de la couche (défaut = celle AFFICHÉE) — la DONNÉE rendue en box-drawing, à comparer
     *  ligne pour ligne avec ce qui est à l'écran (vue du dessus). Tuiles : `.` parquet · `,` dalle ·
     *  `M` marbre · `S` surélevé · `s` contrebas (hauteur métrique ≷ 0) · espace=vide. Arêtes : `-`/`|`
     *  mur · `:` porte · `/ \` diagonale. `console.log(__wfrp.ascii())` pour l'alignement monospace. */
    ascii: (z?: number) => {
      const s = g();
      const sc = s.scene;
      if (!sc) return '✗ aucune scène';
      const zz = z ?? getViewZ() ?? (s.partyPos.z ?? 0);
      const W = sc.dimensions.w, H = sc.dimensions.h;
      const lvl = sc.layers.find((l) => l.z === zz) ?? sc.layers[0];
      const tiles = lvl.tiles, height = lvl.height ?? [];
      const wall = new Map<string, boolean>(), diag = new Map<string, string>();
      for (const w of sc.walls ?? []) {
        if ((w.z ?? 0) !== zz) continue;
        if (w.side === 'N' || w.side === 'E') wall.set(`${w.x},${w.y},${w.side}`, !!w.door);
        else diag.set(`${w.x},${w.y}`, w.side);
      }
      const cell = (x: number, y: number) => {
        const d = diag.get(`${x},${y}`); if (d) return d;
        const t = tiles[y * W + x], h = height[y * W + x] ?? 0;
        if (t === 'planches') return h > 0 ? 'S' : h < 0 ? 's' : 'P';
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

    /** Navigue vers un écran (menu/party/creator/editor/test/coop/campaign) — id invalide = `throw`
     *  IMMÉDIAT (liste des ids valides) plutôt qu'un routage silencieux vers un écran blanc (#211,
     *  ex. 'game' n'existe pas : `SCREENS` est la source unique, `state/store.ts`). */
    screen: (screen: string) => {
      if (!(SCREENS as readonly string[]).includes(screen)) {
        throw new Error(`__wfrp.screen : id invalide « ${screen} » — écrans valides : ${SCREENS.join(', ')}`);
      }
      g().setScreen(screen as never);
      return g().screen;
    },

    /** Brouillard ON/OFF (recette) : `fog(false)` ou `fog()` révèle TOUTE la carte pour diagnostiquer le
     *  RENDU sans la vision ; `fog(true)` rétablit le brouillard normal. Bump `partyPos` (dep du useMemo
     *  de visibilité d'IsoStage) → recalcul + re-render immédiat. */
    fog: (on = false) => {
      setRevealAll(!on);
      useGame.setState((s) => ({ partyPos: { ...s.partyPos } }));
      return on ? 'brouillard ON' : 'brouillard OFF — toute la carte révélée';
    },

    /** DEBUG carte (recette) : overlay d'annotation partagé sur IsoStage — coordonnées `x,y` (+`z{n}`)
     *  centrées par case, teinte par étage (z1 cyan / z2 violet), pastilles de rôle de structure
     *  (courtine rouge / tour orange / porte jaune / escalier bleu) + légende. Pour pointer la MÊME case
     *  que l'utilisateur sans chasser les pixels. Sans argument : BASCULE ; `labels(true)`/`labels(false)`
     *  force. Zéro coût quand OFF (overlay non rendu). */
    labels: (on?: boolean) => {
      const v = on ?? !g().debugLabels;
      useGame.setState({ debugLabels: v });
      return v ? 'labels ON' : 'labels OFF';
    },

    /** Survol PROGRAMMATIQUE (combat) : pose la tuile survolée d'IsoStage comme si la souris y
     *  était — tooltip + réticule se rendent sans chasser les pixels. `null` efface. Accepte un id
     *  de combattant, un id d'entité de scène, ou {x,y}. */
    hover: (idOrXY: string | { x: number; y: number } | null) => {
      const hook = (window as unknown as { __wfrpSetHover?: (t: { x: number; y: number } | null) => void }).__wfrpSetHover;
      if (!hook) return '✗ IsoStage non monté';
      if (idOrXY == null) {
        hook(null);
        return '✓ survol effacé';
      }
      const pt = typeof idOrXY === 'string'
        ? g().battle?.combatants.find((c) => c.id === idOrXY)?.pos ?? find(idOrXY)?.pos
        : idOrXY;
      if (!pt) return '✗ cible introuvable (combattant ou entité)';
      hook({ ...pt });
      return `✓ survol (${pt.x},${pt.y})`;
    },

    /** Simule un BOUTON de manette (combat) en passant par le shim DEV installé par `useGamepad`
     *  (`window.__wfrpPad`) — MÊME chemin que la vraie manette, sans API Gamepad (Playwright). `name`
     *  ∈ A|B|X|Y|LB|RB|LT|RT|Back. devtools n'importe RIEN de `src/ui` : il passe par window (layering). */
    pad: (name: string) => (window as unknown as { __wfrpPad?: (n: string) => void }).__wfrpPad?.(name),

    /** Simule une DIRECTION de manette (croix/stick) via `window.__wfrpPadDir` — `dir` ∈ up|down|left|right.
     *  Carte = déplace le curseur de combat ; menu/modale = déplace le focus. */
    padDir: (dir: string) => (window as unknown as { __wfrpPadDir?: (d: string) => void }).__wfrpPadDir?.(dir),

    /** Vérité STATE du ciblage au survol — ce que le clic ferait sur cette cible pour l'actif :
     *  {kind:'ok'|'invalid'|'none', line, title, skill, base, mod, dmg | reason}. */
    aim: (id: string) => {
      const b = g().battle;
      if (!b) return '✗ pas de combat';
      const active = b.combatants.find((c) => c.id === b.order[b.turn]);
      const target = b.combatants.find((c) => c.id === id);
      if (!active || !target) return '✗ actif ou cible introuvable';
      return hoverTargeting(() => useGame.getState(), active, target);
    },

    /** Lance un SCÉNARIO DE TEST sans passer par le menu : __wfrp.scenario('entrainement', 42).
     *  Sans argument : liste les ids. `seed` (optionnel) rend l'initiative DÉTERMINISTE. Le combat
     *  démarre PRÊT (la pause d'ouverture du Round 1 est acquittée). */
    scenario: (id?: string, seed?: number) => {
      if (!id) return testScenarios.map((sc) => `${sc.id} — ${sc.title}`);
      const sc = testScenarios.find((t) => t.id === id);
      if (!sc) return `✗ « ${id} » introuvable — ids : ${testScenarios.map((t) => t.id).join(', ')}`;
      clearAiTurnLog(); // trace IA vierge pour ce scénario
      const s = g();
      if (seed != null) s.seedRng(seed);
      if (sc.rules) for (const [rid, v] of Object.entries(sc.rules)) setRule(rid, v);
      s.setParty(sc.makeParty());
      if (sc.extraScenes?.length || sc.worldMap) s.loadProject([sc.scene, ...(sc.extraScenes ?? [])], sc.scene.id, sc.worldMap ?? null);
      else s.startScene(sc.scene);
      if (sc.money) useGame.setState({ money: sc.money }); // bourse du scénario (après le reset du lancement)
      if (sc.vessel) useGame.setState({ vessel: sc.vessel }); // navire de campagne (voyage/combat maritime)
      if (sc.autoCombat) g().startCombat(sc.autoCombat);
      if (g().pendingRoundStart) g().confirmRoundStart();
      if (sc.massBattle) {
        // Interlude AVANT la bataille (ADE II ch.8 l.65) : son budget d'Activités (max 3) est celui dans
        // lequel puise la préparation. La préparation se joue DANS le menu d'interlude (« Interlude c'est
        // interlude ») — `startMassBattle` reste donc sur l'écran d'interlude tant qu'un interlude est ouvert.
        if (sc.interludeWeeks) g().startInterlude(sc.interludeWeeks);
        g().startMassBattle(sc.massBattle);
        return `✓ bataille de masse « ${sc.title} » lancée${sc.interludeWeeks ? ' (préparation dans le menu d\'interlude)' : ''}`;
      }
      s.setScreen('campaign');
      return `✓ scénario « ${sc.title} » lancé${sc.autoCombat ? ' (combat direct, prêt à jouer)' : ''}`;
    },

    /** Lance une bataille de masse de démonstration (ADE II 08) sans scénario : __wfrp.massBattle(60, 40, 3).
     *  Les Scènes de COMBAT ne s'amorcent que si la scène courante porte les rencontres attendues. */
    massBattle: (ally = 50, enemy = 55, rounds = 3) => {
      g().startMassBattle({ allyMight: ally, enemyMight: enemy, plannedRounds: rounds, terrain: 'Les deux armées se font face dans la plaine.' });
      return `✓ bataille de masse lancée — Puissance ${ally} contre ${enemy}, ${rounds} Round(s)`;
    },

    /** Snapshot COMBAT compact : round, actif, modales ouvertes, et chaque combattant en une ligne. */
    battle: () => {
      const s = g();
      const b = s.battle;
      if (!b) return '✗ pas de combat en cours';
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
      if (!b || b.over) return '✗ pas de combat en cours';
      const idx = b.order.indexOf(id);
      const c = b.combatants.find((x) => x.id === id);
      if (idx < 0 || !c) return `✗ « ${id} » absent de l'ordre d'initiative`;
      if (isOutOfAction(c)) return `✗ ${c.name} est hors de combat`;
      useGame.setState({
        battle: { ...b, turn: idx, acted: false, movementUsed: 0, movedPreAction: false, action: null, selectedSpellId: null, preview: null, reachable: new Map(), moveSnapshot: null },
      });
      bus.emit(EVT.SCENE_DIRTY);
      return `✓ au tour de ${c.name}`;
    },

    /** TRICHE de recette : téléporte un COMBATTANT (mise en place de situations LdV/portée). Cible une
     *  COQUE à postes (`postes` non vide) ou un membre d'ÉQUIPAGE de poste (`ShipPoste.crewIds`) →
     *  déplace la FORMATION SOLIDAIRE (coque + tout l'équipage des postes de la coque, MÊME delta —
     *  sémantique de `pushCommitTile`, targetingModes.ts : `pushCommitTile` n'est pas réutilisable ici,
     *  liée à `battle.reachable`/Action/Mouvement du chef ; delta ré-implémenté ici) — téléporter la
     *  coque SEULE désynchronise aperçu (postes) et vérité de portée (équipage resté en arrière), piège
     *  vécu en recette. Combattant simple (ni coque ni crew) : téléportation directe inchangée. */
    place: (id: string, pt: { x: number; y: number }) => {
      const b = g().battle;
      const c = b?.combatants.find((x) => x.id === id);
      if (!b || !c || !c.pos) return '✗ combattant introuvable (combat uniquement — hors combat : goto)';
      const hull = c.postes?.length ? c : b.combatants.find((h) => h.postes?.some((p) => p.crewIds?.includes(c.id)));
      if (!hull?.pos) {
        c.pos = { ...pt };
        useGame.setState({ battle: { ...b } });
        bus.emit(EVT.SCENE_DIRTY);
        return `✓ ${c.name} → (${pt.x},${pt.y})`;
      }
      const delta = { x: pt.x - c.pos.x, y: pt.y - c.pos.y };
      const crewIds = new Set<string>();
      for (const p of hull.postes ?? []) for (const cid of p.crewIds ?? []) crewIds.add(cid);
      const movers = [hull, ...[...crewIds]
        .map((cid) => b.combatants.find((x) => x.id === cid))
        .filter((x): x is Combatant => !!x?.pos && x.id !== hull.id)];
      const moved = movers.map((m) => {
        m.pos = { x: m.pos!.x + delta.x, y: m.pos!.y + delta.y };
        return m.id;
      });
      useGame.setState({ battle: { ...b } });
      bus.emit(EVT.SCENE_DIRTY);
      return { msg: `✓ formation (${hull.name}) → delta (${delta.x},${delta.y}) — ${moved.length} déplacé(s)`, moved };
    },

    /** TRICHE de recette : VIRE le cap d'un NAVIRE (manœuvre, MDG ch.13) → re-mappe ses arcs de bordée.
     *  `side` = 'tribord'/'babord' (90°) ou un nombre de crans de 45° (>0 tribord, <0 bâbord). Vérifier
     *  ensuite avec `__wfrp.aim('cible')` qu'elle (re)tombe — ou sort — de l'arc. */
    turnShip: (shipId: string, side: 'tribord' | 'babord' | number = 'tribord') => {
      const b = g().battle;
      const ship = b?.combatants.find((x) => x.id === shipId);
      if (!b || !ship) return '✗ navire introuvable (combat uniquement)';
      const before = g().facing[shipId];
      if (!before) return `✗ ${ship.name} n'a pas de cap (facing) — pas un navire orienté ?`;
      g().shipTurn(shipId, typeof side === 'number' ? side : side === 'tribord' ? 2 : -2);
      return `✓ ${ship.name} : cap ${before} → ${g().facing[shipId]}`;
    },

    /** Recette : MANŒUVRE un navire (MDG ch.13) — le barreur (meilleur en Voile/Ramer de l'équipage, ou
     *  `helmsmanId`) jette un Test de Navigation → `resolveShipManeuver` → vire SUR RÉUSSITE. `side` =
     *  'tribord'/'babord' (90°) ou crans. Contrairement à `turnShip` (triche), ce virage PEUT échouer. */
    maneuver: (shipId: string, side: 'tribord' | 'babord' | number = 'tribord', helmsmanId?: string) => {
      const b = g().battle;
      const ship = b?.combatants.find((x) => x.id === shipId);
      if (!b || !ship) return '✗ navire introuvable (combat uniquement)';
      const before = g().facing[shipId];
      const r = maneuverShip(() => useGame.getState(), shipId, typeof side === 'number' ? side : side === 'tribord' ? 2 : -2, helmsmanId);
      if (!r) return '✗ manœuvre impossible';
      return r.success
        ? `✓ ${ship.name} vire (DR ${r.dr}, barreur ${r.helmsman ?? '—'}) : ${before} → ${g().facing[shipId]}`
        : `✗ ${ship.name} rate la manœuvre (DR ${r.dr}) — cap ${before} inchangé`;
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

    /** DIAGNOSTIC IA (DEV) : les `n` derniers tours pilotés par l'IA — action CHOISIE + classement des
     *  candidats (l'« intention » : `kind[:sort][→cible]=utilité`, top 8 par utilité ↓). « (forcé) » =
     *  garde psychologie/RAW hors scoring (frénésie/Brisé/Bestial/recover/fin) → classement vide. Défaut 50. */
    aiLog: (n = 50) =>
      aiTurnLog().slice(-n).map((r) =>
        `R${r.round} ${r.name}: ${r.action}${r.top.length ? '  | ' + r.top.map((t) => `${t.kind}${t.spell ? ':' + t.spell : ''}${t.targetId ? '→' + t.targetId : ''}=${t.utility}`).join('  ') : '  (forcé)'}`),

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
      if (!s.battle || s.battle.over) return '✗ pas de combat en cours';
      const slain = s.battle.combatants.filter((c) => c.kind === 'enemy' && !isOutOfAction(c));
      if (!slain.length) return 'aucun ennemi encore debout';
      const combatants = s.battle.combatants.map((c) =>
        c.kind === 'enemy' && !isOutOfAction(c)
          ? { ...c, dead: true, wounds: { ...c.wounds, current: 0 } }
          : c,
      );
      useGame.setState({
        battle: {
          ...s.battle,
          combatants,
          log: [...s.battle.log, ev('info', `Recette : ${slain.length} ennemi(s) éliminé(s).`)],
        },
      });
      checkBattleOver(() => useGame.getState(), useGame.setState);
      // La victoire peut ouvrir une cascade de fin de combat (Tests de Résistance maladie/Corruption) AVANT
      // l'écran de victoire — recette : on la résout d'office (sans influence) pour atteindre la victoire.
      if (useGame.getState().pendingCascade?.combatEndBoundary) {
        useGame.getState().cascadeResolveAll();
        useGame.getState().cascadeFinish();
      }
      return `✓ ${slain.length} ennemi(s) éliminé(s) — ${useGame.getState().battle?.over ?? 'combat en cours'}`;
    },

    /** RECETTE : inflige `n` Dégâts (op `wounds`, VRAI pipeline `applyOps`) à un combattant du combat — armure
     *  de coque/PA appliquée, États dérivés, puis `checkBattleOver` (reddition/naufrage/victoire). Sert à
     *  éprouver l'issue navale sans jouer chaque tir. `n` par défaut 5. */
    dealDamage: (id: string, n = 5) => {
      const s = g();
      if (!s.battle || s.battle.over) return '✗ pas de combat en cours';
      const target = s.battle.combatants.find((c) => c.id === id);
      if (!target) return `✗ « ${id} » introuvable dans le combat — voir __wfrp.battle()`;
      const caster = s.battle.combatants.find((c) => c.kind === 'hero' && !isOutOfAction(c)) ?? target;
      const lines = applyOps(target, [{ op: 'wounds', amount: n }], { caster });
      useGame.setState({
        battle: { ...s.battle, log: [...s.battle.log, ev('info', `Recette : ${n} Dégâts infligés à ${target.name}.`), ...lines.map((l) => ev('info', l))] },
      });
      checkBattleOver(() => useGame.getState(), useGame.setState);
      const after = useGame.getState().battle?.combatants.find((c) => c.id === id);
      return `✓ ${target.name} : ${after?.wounds.current ?? target.wounds.current}/${target.wounds.max} PB — ${useGame.getState().battle?.over ?? 'combat en cours'}`;
    },

    /** RECETTE : ARME les conséquences de fin de combat (LDB 18/19/20) puis termine le combat par le
     *  flux NORMAL (`checkBattleOver`) en LAISSANT la cascade OUVERTE — contrairement à `killEnemies`
     *  qui la résout d'office. C'est la mise en place de la recette « cascade de fin de combat » :
     *   - `tookCriticalThisFight` posé sur le héros → Test d'Infection post-critique (LDB 20 l.72) ;
     *   - trait `corruption` (Mineure/Modérée/Majeure) posé sur un ennemi présent → Test d'exposition
     *     à la Corruption (LDB 19) pour TOUS les héros survivants ;
     *   - Destin/Résilience CRÉDITÉS au héros (≥1 chacun) → les boutons Chance/Résilience sont visibles
     *     dans la modale (preuve que le Test est INFLUENÇABLE avant l'écran de victoire).
     *  Puis tous les ennemis sont mis hors d'action et `checkBattleOver` ouvre la cascade
     *  (`combatEndBoundary`) AVANT `pendingVictory` — à conduire à la main (cascadeRoll/Next, Chance/
     *  Résilience), sa fermeture enchaîne sur l'écran de victoire. `level` ∈ Mineure|Modérée|Majeure. */
    combatEnd: (opts?: { heroId?: string; critical?: boolean; corruption?: string | false }) => {
      const s = g();
      if (!s.battle || s.battle.over) return '✗ pas de combat en cours';
      const level = opts?.corruption === undefined ? 'Modérée' : opts.corruption;
      const hero = (opts?.heroId
        ? s.battle.combatants.find((c) => c.id === opts.heroId && c.kind === 'hero')
        : s.battle.combatants.find((c) => c.kind === 'hero' && !isOutOfAction(c)));
      if (!hero) return '✗ aucun héros survivant ciblable';
      if (opts?.critical !== false) hero.tookCriticalThisFight = true; // Infection post-critique (LDB 20 l.72)
      hero.woundDressed = false; // pas de pansement → l'Infection s'applique
      hero.fortune = Math.max(1, hero.fortune ?? 0); // Chance visible (relance)
      hero.resilience = Math.max(1, hero.resilience ?? 0); // Résilience visible (« Je ne faillirai pas ! »)
      const enemy = s.battle.combatants.find((c) => c.kind === 'enemy');
      if (level && enemy) {
        const traits = (enemy.traits ?? []).filter((t) => t.id !== 'corruption');
        enemy.traits = [...traits, { id: 'corruption', arg: level }]; // exposition à la Corruption (LDB 85 → 19)
      }
      const combatants = s.battle.combatants.map((c) =>
        c.kind === 'enemy' && !isOutOfAction(c) ? { ...c, dead: true, wounds: { ...c.wounds, current: 0 } } : c,
      );
      useGame.setState({
        battle: { ...s.battle, combatants, log: [...s.battle.log, ev('info', 'Recette : conséquences de fin de combat armées.')] },
      });
      // Flux NORMAL : ouvre la cascade de fin de combat ; si elle s'ouvre (héros manuel), la victoire est
      // DIFFÉRÉE à sa fermeture (on NE la résout PAS ici — c'est tout l'intérêt de la recette).
      checkBattleOver(() => useGame.getState(), useGame.setState);
      const pc = useGame.getState().pendingCascade;
      return pc?.combatEndBoundary
        ? `✓ cascade de fin de combat OUVERTE (${pc.participants.length} jet(s)) AVANT la victoire — conduire à la main`
        : `pas de cascade ouverte (over=${useGame.getState().battle?.over ?? '—'}) — héros non-interactif ?`;
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
      return `✓ groupe soigné (${g().party.length} héros)`;
    },

    /** RECETTE : crédite la bourse du groupe (en couronnes d'or). */
    give: (gold = 10) => {
      g().creditPartyMoney({ gold, silver: 0, brass: 0 }, 'Recette');
      return g().money;
    },

    /** RECETTE : donne un objet de CATALOGUE à un héros (défaut : le premier), par le VRAI pipeline
     *  `giveTrapping` du store (`applyEffects` → `itemFromGive` : item bien formé, qualités du catalogue,
     *  rangement/Encombrement recalculés). `qty` (optionnel) fixe la quantité de l'instance reçue —
     *  ex. `__wfrp.giveTrapping('hero-1', 'boulet-et-poudre', 6)` pour charger le coffre d'un canon. */
    giveTrapping: (heroId: string | undefined, trappingId: string, qty?: number) => {
      const s = g();
      const hero = heroId ? s.party.find((h) => h.id === heroId) : s.party[0];
      if (!hero) return `✗ héros « ${heroId ?? '(défaut)'} » introuvable — ${s.party.map((h) => h.id).join(', ')}`;
      applyEffects(() => useGame.getState(), useGame.setState, [{ type: 'giveTrapping', trappingId, heroId: hero.id }]);
      const after = useGame.getState().party.find((h) => h.id === hero.id);
      const it = [...(after?.items ?? [])].reverse().find((i) => i.trappingId === trappingId);
      if (!it) return `✗ don échoué (trappingId « ${trappingId} » inconnu au catalogue ?)`;
      if (qty != null) { it.qty = qty; useGame.setState((st) => ({ party: [...st.party] })); }
      return `✓ ${after!.name} reçoit « ${it.name} »${qty != null ? ` ×${qty}` : ''}`;
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
      return `✓ ${id} → ${talentId}`;
    },

    /** RECETTE : simule une CHARGE de `enemyId` sur un héros (défaut : le plus proche) — déclenche le
     *  trigger `onCharged` (Frappe réactive : modale de choix puis Test d'Initiative influençable). C'est
     *  le MÊME appel que le mouvement d'IA quand un ennemi se rue au contact (resolveFreeAttacks). */
    charge: (enemyId: string, heroId?: string) => {
      const s = g();
      const b = s.battle;
      if (!b || b.over) return '✗ pas de combat en cours';
      const enemy = b.combatants.find((c) => c.id === enemyId);
      if (!enemy) return `✗ ennemi « ${enemyId} » introuvable`;
      const heroes = b.combatants.filter((c) => c.kind === 'hero' && !isOutOfAction(c));
      const target = heroId
        ? heroes.find((c) => c.id === heroId)
        : (enemy.pos
            ? heroes.slice().sort((a, c) => {
                const d = (h: Combatant) => h.pos ? Math.max(Math.abs(h.pos.x - enemy.pos!.x), Math.abs(h.pos.y - enemy.pos!.y)) : 1e9;
                return d(a) - d(c);
              })[0]
            : heroes[0]);
      if (!target) return '✗ aucun héros chargeable';
      resolveFreeAttacks(() => useGame.getState(), useGame.setState, target, 'onCharged', enemy);
      bus.emit(EVT.SCENE_DIRTY);
      return `✓ ${enemy.name} charge ${target.name} (onCharged)`;
    },

    /** RECETTE : ajoute un Atout/Défaut (par libellé OU id de qualité) à l'arme ACTIVE d'un combattant
     *  et, optionnellement, lui crédite des Avantages — ex. `quality('hero-1','Déstabilisante',2)` pour
     *  tester le renversement onHit influençable. La qualité est reconnue label/id/casse (resolveQualities). */
    quality: (id: string, label = 'Déstabilisante', advantage?: number) => {
      const tweak = (c: Combatant): Combatant => {
        if (c.id !== id) return c;
        const weapons = (c.weapons ?? []).map((w, i) => (i === 0 ? { ...w, qualities: [...(w.qualities ?? []), parseQualityInstance(label) ?? { id: label }] } : w));
        return { ...c, weapons, ...(advantage != null ? { advantage } : {}) };
      };
      useGame.setState((s) => ({
        party: s.party.map(tweak),
        battle: s.battle ? { ...s.battle, combatants: s.battle.combatants.map(tweak) } : s.battle,
      }));
      const c = actorIn(g(), id);
      return c ? `✓ ${c.name} : arme « ${c.weapons?.[0]?.name} » + ${label}${advantage != null ? ` · ${advantage} Av` : ''}` : `✗ ${id} introuvable`;
    },

    /** RECETTE : applique un État à un combattant (par id) via le VRAI addCondition → déclenche les
     *  triggers onGainCondition (Mâchoires d'acier ouvre alors sa modale de Résistance influençable). */
    condition: (id: string, name = 'sonne', n = 1) => {
      const s = g();
      const c = actorIn(s, id);
      if (!c) return `✗ combattant ${id} introuvable`;
      addCondition(c, name, n);
      useGame.setState((st) => ({
        party: [...st.party],
        battle: st.battle ? { ...st.battle, combatants: [...st.battle.combatants] } : st.battle,
      }));
      return `✓ ${c.name} : +${n} ${name}`;
    },

    /** RECETTE : ouvre l'étape de CHOIX « Piège-lame » (LDB 62 l.292-295) — `bladeTrap('hero-1','enemy-1', 2)`.
     *  Le héros `defenderId` a paré avec une arme Piège-lame face à la lame de `attackerId` (uid assigné si
     *  besoin) ; `defSL` = DR de la défense ajouté au Test opposé. Choisir « Piéger » ouvre alors un Test
     *  opposé de Force CADENCE-AWARE (héros manuel → étape influençable) ; succès → désarme (Stupéfiant →
     *  brise sauf Incassable). Reproduit l'entrée de production sans avoir à forcer un Critique défensif. */
    bladeTrap: (defenderId: string, attackerId: string, defSL = 4) => {
      const b = g().battle;
      if (!b) return '✗ pas en combat';
      const defender = b.combatants.find((c) => c.id === defenderId);
      const attacker = b.combatants.find((c) => c.id === attackerId);
      if (!defender || !attacker) return `✗ défenseur/attaquant introuvable (${defenderId}/${attackerId})`;
      const weapon = attacker.weapons?.[0];
      if (!weapon) return `✗ ${attacker.name} n'a pas d'arme active`;
      if (!weapon.uid) weapon.uid = `dev-blade-${attackerId}`; // uid universel requis pour cibler la lame
      const pbt: PendingBladeTrap = { defenderId, attackerId, weapon, parryWeaponUid: defender.weapons?.[0]?.uid ?? 'parry', defSL, roll: 33 };
      pushCombatStep(useGame.setState, {
        id: `cons-bladetrap-${defenderId}`, kind: 'bladeTrap', actorId: defenderId, icon: 'journal/backstab',
        label: 'Parade — piéger la lame ?',
        options: [{ key: 'trap', label: 'Piéger la lame' }, { key: 'crit', label: 'Coup Critique' }],
        defaultChoice: 'crit', bladeTrap: pbt, interactive: true,
      });
      useGame.setState((s) => ({ battle: s.battle ? { ...s.battle, combatants: [...s.battle.combatants] } : s.battle }));
      return `✓ Piège-lame : ${defender.name} pare ${attacker.name} (${weapon.name}, +${defSL} DR) → choix Piéger/Critique`;
    },

    /** RECETTE : met un combattant en FOCALISATION (DR cumulé sur un sort) — `focus('hero-1')` →
     *  Armure Aethyrique DR 3. Frapper ensuite le focaliseur (attaque ennemie / `__wfrp.condition` +
     *  dégâts) déclenche `checkFocusInterruption` : Test de Calme Difficile INFLUENÇABLE (héros manuel). */
    focus: (id: string, spell = 'armure-aethyrique', dr = 3) => {
      const s = g();
      const c = actorIn(s, id);
      if (!c) return `✗ combattant ${id} introuvable`;
      c.focus = { spell, dr };
      useGame.setState((st) => ({
        party: [...st.party],
        battle: st.battle ? { ...st.battle, combatants: [...st.battle.combatants] } : st.battle,
      }));
      return `✓ ${c.name} : Focalisation ${spell} (DR ${dr})`;
    },

    /** RECETTE : pose une Peur active de `heroId` envers `enemyId` (Indice) puis simule l'APPROCHE de la
     *  source (LDB 21 l.29) — `fear('hero-1','enemy-1', 2)`. C'est le MÊME appel que le mouvement d'IA quand
     *  une source de Peur se rapproche (`approachFearTrigger`) : le héros doit réussir un Test de Calme
     *  Intermédiaire (héros manuel → étape de cascade INFLUENÇABLE) ou gagner un État Brisé. */
    fear: (heroId: string, enemyId: string, indice = 2) => {
      const b = g().battle;
      if (!b || b.over) return '✗ pas de combat en cours';
      const hero = b.combatants.find((c) => c.id === heroId);
      const enemy = b.combatants.find((c) => c.id === enemyId);
      if (!hero || !enemy) return `✗ héros/source introuvable (${heroId}/${enemyId})`;
      if (!hero.pos || !enemy.pos) return '✗ positions inconnues';
      hero.psychState = [
        ...(hero.psychState ?? []).filter((p) => !(p.type === 'peur' && p.sourceId === enemyId)),
        { type: 'peur', sourceId: enemyId, indice, calmeDR: 0 }, // Peur active (non vaincue) envers la source
      ];
      // `fromPos` plus loin que la position actuelle → l'approche est mesurée comme un rapprochement réel.
      const fromPos = { x: enemy.pos.x + Math.sign(enemy.pos.x - hero.pos.x || 1) * 5, y: enemy.pos.y };
      useGame.setState((s) => ({ battle: s.battle ? { ...s.battle, combatants: [...s.battle.combatants] } : s.battle }));
      approachFearTrigger(() => useGame.getState(), useGame.setState, enemy, fromPos);
      bus.emit(EVT.SCENE_DIRTY);
      return `✓ ${enemy.name} (Peur ${indice}) s'approche de ${hero.name} → Test de Calme ou Brisé`;
    },

    /** RECETTE : saute vers une scène du projet/de la campagne par id (machinerie de transition). */
    go: (sceneId: string, entry?: string) => {
      g().transitionTo(sceneId, entry);
      const after = g().scene?.id;
      return after === sceneId ? `✓ scène → ${sceneId}` : `✗ « ${sceneId} » inconnue (scène : ${after ?? '—'})`;
    },

    /** RECETTE : liste les rencontres de la scène (sans argument) ou en lance une. */
    fight: (encounterId?: string) => {
      const encs = g().scene?.encounters ?? [];
      if (!encounterId) return encs.map((e) => e.id);
      if (!encs.some((e) => e.id === encounterId))
        return `✗ rencontre inconnue — dispo : ${encs.map((e) => e.id).join(', ') || 'aucune'}`;
      g().startCombat(encounterId);
      return g().battle ? `✓ combat lancé (${encounterId})` : `rien lancé (rencontre vide ?)`;
    },

    /** RECETTE #30 : services du chantier naval au port — réparation (1 CO/Blessure, MDG ch.13
     *  l.643), carénage (Salissures, l.150-159), pose d'Amélioration (ch.12 l.195-364). */
    chantier: (what: 'reparer' | 'carener' | string = 'reparer', units = 1) => {
      const get = useGame.getState.bind(useGame);
      const set = useGame.setState.bind(useGame);
      const lines = what === 'reparer' ? portRepairVessel(get, set)
        : what === 'carener' ? portCareenVessel(get, set)
        : portInstallUpgrade(get, set, what, units);
      return lines.join('\n');
    },

    /** RECETTE : avance l'horloge (purge les effets à durée d'horloge). */
    time: (minutes = 60) => {
      g().advanceTime(minutes);
      return `${formatImperial(g().gameTime)}`;
    },

    /** RECETTE : le groupe dort N jours — déroule la cascade quotidienne #T3 (rations/faim,
     *  maladies, convalescence des critiques). */
    rest: (days = 1) => {
      g().restParty(days);
      return `+${days} j → ${formatImperial(g().gameTime)}`;
    },

    /** RECETTE : RÈGLES OPTIONNELLES (policy.ts / « règles maison »). `rules()` liste toutes les règles
     *  (id = valeur · forme) ; `rules(id)` détaille une règle ; `rules(id, value)` la règle (surcharge
     *  runtime, NON persistée) ; `rules(id, null)` réinitialise au défaut. Inclut le MODE AUTO du combat :
     *  `rules('combat-cadence', 'auto')` (auto = l'IA joue aussi les héros ; 'rapide' = jets auto sans
     *  dépense ; 'manuel' = défaut). Valide la valeur selon le `kind` (flag/param/mode). */
    rules: (id?: string, value?: RuleValue | null) => {
      const shape = (r: { kind: string; options?: string[]; min?: number; max?: number }) =>
        r.kind === 'mode' ? `{${r.options?.join('|')}}` : r.kind === 'param' ? `[${r.min}…${r.max}]` : '(true|false)';
      if (id == null) return OPTIONAL_RULES.map((r) => `${r.group} · ${r.id} = ${JSON.stringify(rule(r.id))}  ${shape(r)}`);
      const def = ruleDef(id);
      if (!def) return `règle inconnue : ${id} — voir __wfrp.rules()`;
      if (value === undefined) return `${def.id} = ${JSON.stringify(rule(id))} · ${def.label} (défaut ${JSON.stringify(def.default)} · ${shape(def)}) — ${def.ref}`;
      if (value === null) { resetRule(id); useGame.getState().resumeCadence(); return `${id} → défaut ${JSON.stringify(def.default)}`; }
      let v: RuleValue = value;
      if (def.kind === 'flag') v = value === true || value === 'true' || value === 'on';
      else if (def.kind === 'param') v = Number(value);
      else if (def.kind === 'mode' && !def.options?.includes(String(value))) return `${id} : valeur invalide « ${value} » — options : ${def.options?.join(' | ')}`;
      setRule(id, v);
      useGame.getState().resumeCadence(); // cadence : ré-entre la boucle si on bascule auto/rapide en plein tour
      return `✓ ${id} → ${JSON.stringify(v)}`;
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

    /** RECETTE : ré-ensemence le RNG de bataille (`makeRNG`/`seedBattleRng`, déterminisme) — MÊME action
     *  que `store.seedRng` (utilisée par `scenario(id, seed)` au lancement), exposée pour re-seeder EN
     *  COURS de combat, recette reproductible sans relancer le scénario. */
    seed: (n: number) => {
      g().seedRng(n);
      return `✓ RNG de bataille re-ensemencé (seed ${n})`;
    },

    /** RECETTE : avance les tours IA jusqu'au prochain tour d'un combattant piloté HUMAIN, ou la fin du
     *  combat — SANS chemin parallèle : passe par la MÊME machinerie que la partie réelle
     *  (`maybeRunEnemyTurn`/`advanceTurn`/`runEnemyAI`), on accélère seulement les délais de lisibilité
     *  du Réalisateur (`combatDirector.beatHold`, TEMPO) le temps de l'avance — restaurés à la fin (y
     *  compris si `maxIters` est atteint). `maxIters` (scrutations, pas des tours) est un GARDE-FOU
     *  anti-boucle infinie, jamais une taille de tour attendue. Un coût de recette, pas un raccourci du
     *  flux testé (doctrine __wfrp : ne saute que le bruit IA, jamais l'action du joueur). */
    fastForward: (maxIters = 400) =>
      new Promise<string>((resolve, reject) => {
        // `globalThis` (pas `window`) : identique en navigateur (window === globalThis) ET testable
        // hors DOM (vitest tourne les tests d'état en environnement 'node', sans `window`). La
        // référence RESTAURÉE doit être la MÊME que celle capturée (jamais un clone `.bind`) — sous
        // fake timers, réassigner un clone empêche `vi.useRealTimers()` de reconnaître son propre
        // mock et casse `globalThis.setTimeout` pour tout test ultérieur du même worker (#flake).
        type TimeoutSetter = (cb: (...a: unknown[]) => void, ms?: number, ...a: unknown[]) => unknown;
        const g2 = globalThis as unknown as { setTimeout: TimeoutSetter };
        const real = g2.setTimeout;
        const fast: TimeoutSetter = (cb, _ms, ...a) => real(cb, 0, ...a);
        g2.setTimeout = fast;
        let restored = false;
        // idempotent + déclenchée sur TOUTE sortie (résolution normale OU exception) : jamais de
        // patch de `setTimeout` qui survit à un throw imprévu dans `status`/`kick`/`tick`.
        const restore = () => { if (!restored) { restored = true; g2.setTimeout = real; } };
        let n = 0;
        let lastKey = ''; // « round:tour » vu à la scrutation précédente
        let stalled = 0;
        const finish = (msg: string) => { restore(); resolve(msg); };
        const fail = (e: unknown) => { restore(); reject(e); };
        const status = (): { done: boolean; msg: string } => {
          const s = g();
          const b = s.battle;
          if (!b || b.over) return { done: true, msg: b?.over ? `✓ combat terminé (${b.over})` : '✓ pas de combat en cours' };
          const c = b.combatants.find((x) => x.id === b.order[b.turn]);
          if (!c || !aiDriven(s, c)) return { done: true, msg: `✓ tour de ${c?.name ?? '—'} (piloté)` };
          return { done: false, msg: '' };
        };
        // Relance `maybeRunEnemyTurn` seulement au PREMIER constat d'immobilité (round:tour inchangé
        // depuis la dernière scrutation) — jamais à chaque scrutation : la machinerie EST déjà
        // auto-perpétuante (`advanceTurn` rappelle `maybeRunEnemyTurn` à chaque tour) ; la relancer en
        // boucle empilerait des `runEnemyAI` redondants sur le MÊME combattant (le ciblage par id ne
        // vérifie pas que c'est encore son tour) et casserait l'ordre d'initiative.
        const kick = () => maybeRunEnemyTurn(() => useGame.getState(), useGame.setState);
        const tick = () => {
          try {
            const r = status();
            if (r.done) { finish(r.msg); return; }
            const b = g().battle!;
            const key = `${b.round}:${b.turn}`;
            if (key === lastKey) { if (++stalled === 1) kick(); } else { lastKey = key; stalled = 0; }
            if (n++ >= maxIters) { finish(`✗ borne atteinte (${maxIters} scrutations) sans tour humain — voir __wfrp.auto()`); return; }
            real(tick, 4);
          } catch (e) {
            fail(e);
          }
        };
        try {
          kick(); // amorce si rien n'est déjà en vol (ex. juste après confirmRoundStart)
          tick();
        } catch (e) {
          fail(e);
        }
      }),
  };
}

export function installDevtools() {
  const w = window as unknown as { __wfrp?: ReturnType<typeof buildApi>; __game?: typeof useGame };
  w.__wfrp = buildApi();
  w.__game = useGame; // handle brut du store (à côté de __wfrp) pour les recettes navigateur
  setAiTrace(true); // DEV uniquement (devtools chargé en dev) → la trace de décision IA s'enregistre
}
