import { useGame } from './store';

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
 */
function buildApi() {
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
  };
}

export function installDevtools() {
  const w = window as unknown as { __wfrp?: ReturnType<typeof buildApi>; __game?: typeof useGame };
  w.__wfrp = buildApi();
  w.__game = useGame; // rétro-compat (recettes antérieures)
}
