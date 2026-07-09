/**
 * Constructeur d'effets réutilisable (triggers, dialogues, rencontres, props interactifs).
 * Un effet = une action de gameplay (journal, flag, objet, argent, combat, transition, test…).
 *
 * v2 : chaque effet est une rangée REPLIÉE résumée en clair (`effectSummary`) qu'on déplie pour
 * éditer ; « + Effet » ouvre un picker par CATÉGORIE (fini le select plat de 27 types) ; les
 * effets se réordonnent (l'ordre d'application compte — `applyEffects`).
 */
import { Effect, EncounterDef, Dialogue, Scene } from '../../state/scene';
import { Icon } from '../Icon';
import { EMPTY_FLOW } from '../../state/flow';
import { EFFECT_HANDLERS, EFFECT_GROUP_ORDER } from '../../state/combatEffects';
import { DAY_PHASES, DayPhaseKey } from '../../engine/clock';
import { DISEASE_DEFS } from '../../engine/disease';
import { spells, trappings as trappingsData, refLabel, WATER_EXPOSURE, vehicles, findVehicleById, crewRoles } from '../../data';
import { MANANN_FACTORS, findManannFactor } from '../../engine/seaVoyage';
import { giveTrappingLabel } from '../../engine/items';
import { FlowEditor } from './FlowEditor';
import { GameOpEditor, opSummary } from './GameOpEditor';
import { RefField } from '../compendium/RefField';
import { CHAR_KEYS, CHAR_LABELS, CharKey, DIFFICULTY_LABELS, Difficulty } from '../../engine/types';
import { CHAOS_ALIGN_LABELS, ChaosAlign } from '../../engine/corruption';
import { POWER_ESTIMATE, clampMight } from '../../engine/massBattle';
import { battleSceneById, type MassBattleSpec } from '../../state/massBattleFlow';
import { activitiesFor } from '../../engine/activities';

/** Noms des maladies câblées (LDB 20) proposés dans l'éditeur. */
const DISEASE_NAMES = Object.keys(DISEASE_DEFS);

/** Navires dotables (`setVessel`) : véhicules à facette `ship` de `vehicles.json` (embarcations). */
const SHIP_VEHICLES = vehicles.filter((v) => v.ship);

/** Roster d'équipage salarié (`crew: CrewHire[]`) — partagé par `setVessel` (dotation) et
 *  `adjustVessel` (#233, patch du navire de campagne existant). */
function CrewRosterFields({ e, upd }: { e: any; upd: (patch: any) => void }) {
  return (
    <>
      <div className="mini-title">Équipage salarié (barème MDG 14 — solde prélevée chaque semaine)</div>
      {(e.crew ?? []).map((h: { roleId: string; count: number }, i: number) => (
        <div className="tf-row" key={i}>
          <select value={h.roleId} onChange={(ev) => upd({ crew: (e.crew ?? []).map((x: { roleId: string; count: number }, j: number) => (j === i ? { ...x, roleId: ev.target.value } : x)) })}>
            {crewRoles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <label className="dr">×<input type="number" min={1} style={{ width: '3.6em' }} value={h.count} onChange={(ev) => upd({ crew: (e.crew ?? []).map((x: { roleId: string; count: number }, j: number) => (j === i ? { ...x, count: Math.max(1, Number(ev.target.value) || 1) } : x)) })} /></label>
          <button type="button" className="btn small" onClick={() => upd({ crew: (e.crew ?? []).filter((_: unknown, j: number) => j !== i) })}>Retirer</button>
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => upd({ crew: [...(e.crew ?? []), { roleId: crewRoles[0].id, count: 1 }] })}>+ poste salarié</button>
    </>
  );
}

/** Toutes les facettes d'AUTEUR (libellé/icône/groupe/fabrique) sont lues sur le REGISTRE unique
 *  `EFFECT_HANDLERS` (state/combatEffects) — fin des Records parallèles. Le `summary` (qui dépend
 *  d'`opSummary`) et le RENDU des champs (`EffectFields`, JSX) restent ici, côté UI. */
const EFFECT_TYPES = Object.keys(EFFECT_HANDLERS) as Effect['type'][];

/** Sorts de la base groupés pour le select de `learnSpell` (audit M9 : fini « libellé exact »). */
const SPELL_GROUPS: [string, { id: string; label: string }[]][] = (() => {
  const m = new Map<string, { id: string; label: string }[]>();
  for (const sp of spells) {
    const g = `${sp.type ?? 'Sorts'}${sp.subType ? ` — ${sp.subType}` : ''}`;
    if (!m.has(g)) m.set(g, []);
    m.get(g)!.push({ id: sp.id, label: sp.label });
  }
  for (const list of m.values()) list.sort((a, b) => a.label.localeCompare(b.label));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
})();

/** Contexte « projet » des selects guidés (M9), depuis la scène active + les autres scènes.
 *  `worldMap` est PROJET (pas scène) : passé par le fournisseur quand il y a structurellement
 *  accès à la carte du monde (Editor) — absent ⇒ fallback texte pour `openPort`. */
export function effectCtxOf(
  scene: Scene,
  otherScenes: Scene[] = [],
  worldMap?: { places: { id: string; label: string }[] },
): Pick<Ctx, 'merchants' | 'scenes' | 'places' | 'personas'> {
  return {
    merchants: scene.entities.filter((e) => e.merchant).map((e) => ({ id: e.id, label: e.label })),
    scenes: [scene, ...otherScenes].map((sc) => ({ id: sc.id, nom: sc.nom, entries: Object.keys(sc.entryPoints ?? {}) })),
    places: worldMap?.places.map((p) => ({ id: p.id, label: p.label })),
    // Effet `castSpell` (#98) : lanceur/cible = un « personnage » de la scène (Combatant.id ==
    // SceneEntity.id EN COMBAT — cf. combatSlice) ou un héros du groupe (id libre hors combat).
    personas: scene.entities.filter((e) => e.kind === 'personnage').map((e) => ({ id: e.id, label: e.label })),
  };
}

export interface Ctx {
  encounters: EncounterDef[];
  dialogues: Dialogue[];
  /** Entités marchandes de la scène (audit M9 : select au lieu d'un id à taper). Absent = input. */
  merchants?: { id: string; label?: string }[];
  /** Scènes du projet (id + nom + points d'entrée) pour les transitions. Absent = input. */
  scenes?: { id: string; nom?: string; entries: string[] }[];
  /** Lieux de la carte du monde (id + label) pour `openPort`. Absent = input. */
  places?: { id: string; label: string }[];
  /** Entités « personnage » de la scène (id + label) — lanceur/cible de `castSpell` (#98). Absent = input. */
  personas?: { id: string; label?: string }[];
}

/** Libellé / icône d'un type d'effet — dérivés du REGISTRE unique (plus de Record parallèle à
 *  maintenir : la source de vérité est `EFFECT_HANDLERS[t].label/icon`). */
export const EFFECT_LABEL = Object.fromEntries(
  EFFECT_TYPES.map((t) => [t, EFFECT_HANDLERS[t].label]),
) as Record<Effect['type'], string>;
export const EFFECT_ICON = Object.fromEntries(
  EFFECT_TYPES.map((t) => [t, EFFECT_HANDLERS[t].icon]),
) as Record<Effect['type'], string>;

/** Picker « + Effet » : les types groupés par intention d'auteur — reconstruit depuis le `group` de
 *  chaque handler, dans l'ordre des groupes (`EFFECT_GROUP_ORDER`) et l'ordre de déclaration intra-groupe. */
export const EFFECT_GROUPS: [string, Effect['type'][]][] = EFFECT_GROUP_ORDER.map((g) => [
  g,
  EFFECT_TYPES.filter((t) => EFFECT_HANDLERS[t].group === g),
]);

const cut = (s: string, n = 46) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Résumé HUMAIN d'un effet (rangée repliée) — texte SEUL, PUR, testé. L'icône (`EFFECT_ICON`) est
 *  rendue séparément par l'appelant via `<Icon>` (même patron que `opSummary`/`OP_ICON`). */
export function effectSummary(effect: Effect, ctx?: Pick<Ctx, 'scenes'>): string {
  const e = effect as any;
  switch (effect.type) {
    case 'journal': return `Journal : ${e.text ? `« ${cut(e.text)} »` : '(vide)'}`;
    case 'setFlag': return `Flag ${e.flag || '?'} = ${e.value === false ? 'faux' : 'vrai'}`;
    case 'setObjective': return `Objectif [${e.id || '?'}] : ${e.text ? `« ${cut(e.text)} »` : '(vide)'}`;
    case 'clearObjective': return e.id ? `Retirer l'objectif [${e.id}]` : `Retirer tous les objectifs`;
    case 'document': return `Document : ${e.title || '(sans titre)'}`;
    case 'giveTrapping': return `Objet : ${giveTrappingLabel(e) || '?'}${e.qualities?.length ? ` (+${e.qualities.length} qualité(s))` : ''}`;
    case 'giveMoney': {
      const parts = [e.gold ? `${e.gold} CO` : '', e.silver ? `${e.silver} pa` : '', e.brass ? `${e.brass} sc` : ''].filter(Boolean);
      return `Argent : ${parts.join(' ') || '0'}`;
    }
    case 'giveXp': return `${e.amount ?? 0} PX (groupe)`;
    case 'restoreFortune': return `Regagner la Chance`;
    case 'inflictNightmares': return `Cauchemars${e.heroId ? ` → ${e.heroId}` : ''}`;
    case 'inflictDisease': return `Maladie : ${e.disease || '?'}`;
    case 'inflictHunger': return `Faim ×${e.days ?? 1} → ${e.target === 'hero' ? (e.heroId || '1ᵉʳ héros') : 'groupe'}`;
    case 'inflictThirst': return `Soif ×${e.days ?? 1} → ${e.target === 'hero' ? (e.heroId || '1ᵉʳ héros') : 'groupe'}`;
    case 'exposureNight': return `Exposition ${e.kind === 'chaleur' ? 'chaleur' : 'froid'} ×${e.count ?? 2} → ${e.target === 'hero' ? (e.heroId || '1ᵉʳ héros') : 'groupe'}`;
    case 'inflictTrauma': return `Critique : ${e.kind ?? 'fracture'} (${e.location ?? '?'})`;
    case 'ambitionLost': return `Ambition anéantie → Trauma${e.heroId ? ` → ${e.heroId}` : ''}`;
    case 'inflictPsychology': return `${e.kind === 'terreur' ? 'Terreur' : 'Peur'} ${e.indice ?? 1} — ${e.label || '?'} → ${e.target === 'hero' ? (e.heroId || '1ᵉʳ héros') : 'groupe'}`;
    case 'ops': {
      const who = e.on === 'hero' ? '1ᵉʳ héros' : e.on === 'caster' ? 'lanceur' : e.on === 'target' ? 'cible' : 'groupe';
      return `${who} : ${(e.ops ?? []).map(opSummary).join(', ') || '(aucune op)'}`;
    }
    case 'zoneBlast': return `Souffle ${(e.ops ?? []).length} op(s) rayon ${e.radius ?? 0} @(${e.center?.x ?? 0},${e.center?.y ?? 0})`;
    case 'fall': return `Chute ${e.metres ?? 0} m → ${e.target === 'hero' ? (e.heroId || '1ᵉʳ héros') : 'groupe'}${e.to ? ` ⤓(${e.to.x},${e.to.y}${e.to.z ? `,z${e.to.z}` : ''})` : ''}`;
    case 'setLight': return `Lumière ${Math.round((e.level ?? 1) * 100)} %`;
    case 'setDoor': return `Porte (${e.x ?? 0},${e.y ?? 0},${e.side ?? 'N'}) ${e.open ? 'ouverte' : 'fermée'}`;
    case 'giveSin': return `${e.amount ?? 1} point(s) de Péché`;
    case 'corruptionExposure': return `Influence corruptrice (${e.level ?? 'mineure'}, ${e.skill ?? 'au choix'})${e.align ? ` — ${CHAOS_ALIGN_LABELS[e.align as ChaosAlign]}` : ''}`;
    case 'waterExposure': return `Eau souillée (${e.mode === 'immersion' ? 'immersion' : 'ingestion'}${e.source ? ` · ${e.source}` : ''}) → ${e.target === 'party' ? 'groupe' : (e.heroId || '1ᵉʳ héros')}`;
    case 'learnSpell': return `Apprendre : ${e.spell ? refLabel('spells', { id: e.spell }) : '?'}`;
    case 'castSpell': return `Incanter ${e.spellId ? refLabel('spells', { id: e.spellId }) : '?'} — ${e.casterId || '?'}${e.targetId ? ` → ${e.targetId}` : ''}${e.mode === 'forceSuccess' ? ' (garanti)' : ''}`;
    case 'petitePriere': {
      const n = e.reward ? (e.reward.kind === 'seq' ? e.reward.steps.length : 1) : 0;
      return `Petites Prières (site sacré)${e.heroId ? ` → ${e.heroId}` : ''} · ${n} bloc(s) si exaucée`;
    }
    case 'rest': return `Repos ${e.days ?? 1} nuit(s) (${e.lodging ?? 'maison'}${e.quality === 'pietre' ? ', piètre' : ''})`;
    case 'mealParty': return `Repas du groupe`;
    case 'interlude': return `Interlude : ${e.weeks ?? 1} semaine(s)`;
    case 'startCombat': return `Combat : ${e.encounter || '?'}`;
    case 'startMassBattle': {
      const b: MassBattleSpec = e.battle ?? {};
      const rounds = b.plannedRounds ?? 1;
      const sit = b.situations?.length ? `, ${b.situations.length} situation(s)` : '';
      return `Combat de masse : ${b.allyName || 'Alliés'} (${b.allyMight ?? 0}) vs ${b.enemyName || 'Ennemis'} (${b.enemyMight ?? 0}) — ${rounds} Round${rounds > 1 ? 's' : ''}${sit}`;
    }
    case 'transition': {
      const sc = ctx?.scenes?.find((s) => s.id === e.scene);
      return `Vers ${sc?.nom ?? e.scene ?? '?'}${e.entry ? ` @ ${e.entry}` : ''}`;
    }
    case 'transitionBack': return `Retour scène précédente`;
    case 'openWorldMap': return `Carte du monde (voyage)`;
    case 'setVessel': return `Navire : ${e.name?.trim() ? `« ${e.name.trim()} » (${e.vehicleId ? (findVehicleById(e.vehicleId)?.label ?? e.vehicleId) : '?'})` : (e.vehicleId ? (findVehicleById(e.vehicleId)?.label ?? e.vehicleId) : '?')}${e.hullMax != null ? ` · coque ${e.hullCurrent ?? e.hullMax}/${e.hullMax}` : ''}${e.saboteurDR != null ? ` · sabotage ${e.saboteurDR} DR` : ''}${e.crew?.length ? ` · équipage ${e.crew.reduce((s: number, h: { count: number }) => s + h.count, 0)}` : ''}`;
    case 'adjustVessel': {
      const parts: string[] = [];
      if (e.name?.trim()) parts.push(`nom « ${e.name.trim()} »`);
      if (e.morale != null) parts.push(`moral ${e.morale}`);
      if (e.hullMax != null) parts.push(`coque ${e.hullCurrent ?? e.hullMax}/${e.hullMax}`);
      else if (e.hullCurrent != null) parts.push(`coque actuelle ${e.hullCurrent}`);
      if (e.saboteurDR != null) parts.push(`sabotage ${e.saboteurDR} DR`);
      if (e.crew?.length) parts.push(`équipage ${e.crew.reduce((s: number, h: { count: number }) => s + h.count, 0)}`);
      return `Ajuster le navire : ${parts.length ? parts.join(', ') : '(aucun champ)'}`;
    }
    case 'adjustManann': return e.factorId
      ? `Manann : facteur « ${findManannFactor(e.factorId)?.label ?? e.factorId} »`
      : `Manann : ${e.delta ? `${e.delta.sign < 0 ? '−' : '+'}${e.delta.flat}${e.delta.d10 ? `+${e.delta.d10}d10` : ''}` : '?'}`;
    case 'startDialogue': return `Dialogue : ${e.dialogue || '?'}`;
    case 'openMerchant': return `Boutique : ${e.entityId || '?'}`;
    case 'openPort': return `Port : ${e.placeId || '?'}`;
    case 'openTavernGames': return `Jeux de taverne`;
    case 'medicalAid': return `Soins payants (${(e.acts ?? (e.act ? [0] : [])).length} acte(s))`;
    case 'extendedTest': return `Test Étendu ${e.skill ? refLabel('skills', { id: e.skill, spec: e.spec }) : (e.characteristic || '?')} → DR cumulé ${e.targetDR ?? 0}${e.flag ? ` (flag ${e.flag})` : ''}`;
    case 'forceDoor': return `Enfoncer « ${e.label || '?'} » (BE ${e.doorBE ?? 0}, B ${e.doorB ?? 0})${e.flag ? ` → flag ${e.flag}` : ''}`;
    case 'setTime': return `Heure → ${DAY_PHASES.find((p) => p.key === e.phase)?.label ?? e.phase}`;
    case 'delayedEffect': {
      const when = e.afterMinutes != null
        ? `dans ${e.afterMinutes} min`
        : `à ${String(e.atHour ?? 0).padStart(2, '0')}:${String(e.atMinute ?? 0).padStart(2, '0')}`;
      const n = e.flow ? (e.flow.kind === 'seq' ? e.flow.steps.length : 1) : 0;
      return `Différé ${when} → ${n} bloc(s)${e.cancelFlag ? ` · annulé si ${e.cancelFlag}` : ''}`;
    }
    case 'endDialogue': return `Fermer le dialogue`;
  }
}

/** Effet par défaut d'un type — délégué à la FABRIQUE du registre (`EFFECT_HANDLERS[t].make`). */
export function newEffect(type: Effect['type']): Effect {
  return EFFECT_HANDLERS[type].make();
}

/** Corps DÉPLIÉ d'un effet (feuille `do` d'un Flow) : select de type (groupé) + champs spécifiques. */
export function EffectFields({ effect, onChange, ctx }: { effect: Effect; onChange: (e: Effect) => void; ctx: Ctx }) {
  const e = effect as any;
  const upd = (patch: any) => onChange({ ...e, ...patch });
  return (
    <div className="eff-body">
      <select className="eff-type" value={effect.type} onChange={(ev) => onChange(newEffect(ev.target.value as Effect['type']))}>
        {EFFECT_GROUPS.map(([g, types]) => (
          <optgroup key={g} label={g}>
            {types.map((t) => (
              <option key={t} value={t}>
                {EFFECT_LABEL[t]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="eff-fields">
        {effect.type === 'journal' && <input placeholder="Texte du journal" value={e.text ?? ''} onChange={(ev) => upd({ text: ev.target.value })} />}
        {effect.type === 'setFlag' && (
          <>
            <input placeholder="nom_du_flag" value={e.flag ?? ''} onChange={(ev) => upd({ flag: ev.target.value })} />
            <label className="radio">
              <input type="checkbox" checked={e.value !== false} onChange={(ev) => upd({ value: ev.target.checked })} /> vrai
            </label>
          </>
        )}
        {effect.type === 'setObjective' && (
          <>
            <input placeholder="id_de_l_objectif (stable — re-poser = mise à jour)" value={e.id ?? ''} onChange={(ev) => upd({ id: ev.target.value })} />
            <input placeholder="Consigne joueur (ex. « Retrouver Gustav au port »)" value={e.text ?? ''} onChange={(ev) => upd({ text: ev.target.value })} />
          </>
        )}
        {effect.type === 'clearObjective' && (
          <input placeholder="id de l'objectif à retirer (vide = tous)" value={e.id ?? ''} onChange={(ev) => upd({ id: ev.target.value || undefined })} />
        )}
        {effect.type === 'document' && (
          <>
            <input placeholder="Titre" value={e.title ?? ''} onChange={(ev) => upd({ title: ev.target.value })} />
            <textarea placeholder="Texte du document (sauts de ligne autorisés)" value={e.text ?? ''} onChange={(ev) => upd({ text: ev.target.value })} />
          </>
        )}
        {effect.type === 'giveTrapping' && (
          <>
            <input list="dl-trappings-give" placeholder="Objet de catalogue (sinon nom custom hors-base)"
              value={e.trappingId ? (trappingsData.find((t) => t.id === e.trappingId)?.label ?? e.trappingId) : (e.custom ?? '')}
              onChange={(ev) => {
                const v = ev.target.value;
                const t = trappingsData.find((x) => x.label.toLowerCase() === v.toLowerCase());
                upd(t ? { trappingId: t.id, custom: undefined } : { custom: v || undefined, trappingId: undefined });
              }} />
            <datalist id="dl-trappings-give">{trappingsData.map((t) => <option key={t.id} value={t.label} />)}</datalist>
            <input
              placeholder="Qualités magiques ajoutées (virgules, ex. De plaies atroces)"
              value={(e.qualities ?? []).join(', ')}
              onChange={(ev) => {
                const q = ev.target.value.split(',').map((s: string) => s.trim()).filter(Boolean);
                upd({ qualities: q.length ? q : undefined });
              }}
            />
            <label className="radio">
              <input type="checkbox" checked={e.identified === false} onChange={(ev) => upd({ identified: ev.target.checked ? false : undefined })} /> non identifié (qualités masquées jusqu’à Évaluation)
            </label>
          </>
        )}
        {effect.type === 'inflictNightmares' && (
          <input placeholder="id du héros (vide = le premier)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
        )}
        {effect.type === 'ambitionLost' && (
          <input placeholder="id du héros (vide = le premier)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
        )}
        {effect.type === 'inflictDisease' && (
          <>
            <select value={e.disease ?? ''} onChange={(ev) => upd({ disease: ev.target.value })}>
              {DISEASE_NAMES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <input placeholder="id du héros (vide = le premier)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
          </>
        )}
        {effect.type === 'inflictHunger' && (
          <div className="tf-row">
            <select value={e.target ?? 'party'} onChange={(ev) => upd({ target: ev.target.value })}>
              <option value="party">Tout le groupe</option>
              <option value="hero">Un héros</option>
            </select>
            {e.target === 'hero' && (
              <input placeholder="id du héros (vide = 1ᵉʳ)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value || undefined })} />
            )}
            <label className="dr">Jours affamés <input type="number" min={1} style={{ width: '3.2em' }} value={e.days ?? 1} onChange={(ev) => upd({ days: Math.max(1, Number(ev.target.value) || 1) })} /></label>
          </div>
        )}
        {effect.type === 'inflictThirst' && (
          <div className="tf-row">
            <select value={e.target ?? 'party'} onChange={(ev) => upd({ target: ev.target.value })}>
              <option value="party">Tout le groupe</option>
              <option value="hero">Un héros</option>
            </select>
            {e.target === 'hero' && (
              <input placeholder="id du héros (vide = 1ᵉʳ)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value || undefined })} />
            )}
            <label className="dr">Jours assoiffés <input type="number" min={1} style={{ width: '3.2em' }} value={e.days ?? 1} onChange={(ev) => upd({ days: Math.max(1, Number(ev.target.value) || 1) })} /></label>
          </div>
        )}
        {effect.type === 'exposureNight' && (
          <div className="tf-row">
            <select value={e.kind ?? 'froid'} onChange={(ev) => upd({ kind: ev.target.value })}>
              <option value="froid">Froid (négatives, blizzard)</option>
              <option value="chaleur">Chaleur (désert, fournaise)</option>
            </select>
            <select value={e.target ?? 'party'} onChange={(ev) => upd({ target: ev.target.value })}>
              <option value="party">Tout le groupe</option>
              <option value="hero">Un héros</option>
            </select>
            {e.target === 'hero' && (
              <input placeholder="id du héros (vide = 1ᵉʳ)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value || undefined })} />
            )}
            <label className="dr">Tests <input type="number" min={1} style={{ width: '3.2em' }} value={e.count ?? 2} onChange={(ev) => upd({ count: Math.max(1, Number(ev.target.value) || 1) })} /></label>
          </div>
        )}
        {effect.type === 'inflictTrauma' && (
          <>
            <select value={e.kind ?? 'fracture'} onChange={(ev) => upd({ kind: ev.target.value })}>
              <option value="dechirure">Déchirure musculaire</option>
              <option value="fracture">Fracture</option>
              <option value="amputation">Amputation</option>
            </select>
            {e.kind !== 'amputation' && (
              <select value={e.severity ?? 'mineur'} onChange={(ev) => upd({ severity: ev.target.value })}>
                <option value="mineur">Mineure</option>
                <option value="majeur">Majeure</option>
              </select>
            )}
            <select value={e.location ?? 'brasD'} onChange={(ev) => upd({ location: ev.target.value })}>
              <option value="tete">Tête</option>
              <option value="brasG">Bras gauche</option>
              <option value="brasD">Bras droit</option>
              <option value="corps">Corps</option>
              <option value="jambeG">Jambe gauche</option>
              <option value="jambeD">Jambe droite</option>
            </select>
            <input placeholder="id du héros (vide = le premier)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
          </>
        )}
        {effect.type === 'rest' && (
          <div className="tf-row">
            <label className="dr">
              Lieu
              <select value={e.lodging ?? 'maison'} onChange={(ev) => upd({ lodging: ev.target.value })}>
                <option value="auberge">Auberge (chambres/repas payants)</option>
                <option value="maison">Chez soi (gratuit)</option>
                <option value="camp">Campement (dehors)</option>
              </select>
            </label>
            <label className="dr">
              Qualité
              <select value={e.quality ?? 'normale'} onChange={(ev) => upd({ quality: ev.target.value === 'pietre' ? 'pietre' : undefined })}>
                <option value="normale">Normale</option>
                <option value="pietre">Piètre (½ prix, à risque)</option>
              </select>
            </label>
            <label className="dr">Nuits <input type="number" min={1} value={e.days ?? 1} onChange={(ev) => upd({ days: Math.max(1, Number(ev.target.value) || 1) })} /></label>
          </div>
        )}
        {effect.type === 'interlude' && (
          <label>Semaines d'interlude <input type="number" min={1} max={12} value={e.weeks ?? 1} onChange={(ev) => upd({ weeks: Math.max(1, Number(ev.target.value) || 1) })} /></label>
        )}
        {effect.type === 'giveSin' && (
          <>
            <label>Péchés (1-3 selon gravité) <input type="number" min={1} max={3} value={e.amount ?? 1} onChange={(ev) => upd({ amount: Math.max(1, Number(ev.target.value) || 1) })} /></label>
            <input placeholder="id du héros (vide = premier sachant Prier)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
          </>
        )}
        {effect.type === 'inflictPsychology' && (
          <div className="tf-row">
            <select value={e.kind ?? 'peur'} onChange={(ev) => upd({ kind: ev.target.value })}>
              <option value="peur">Peur</option>
              <option value="terreur">Terreur</option>
            </select>
            <label className="dr">Indice <input type="number" min={1} style={{ width: '3.2em' }} value={e.indice ?? 1} onChange={(ev) => upd({ indice: Math.max(1, Number(ev.target.value) || 1) })} /></label>
            <input placeholder="Source (apparition, présage…)" value={e.label ?? ''} onChange={(ev) => upd({ label: ev.target.value })} />
            <select value={e.target ?? 'party'} onChange={(ev) => upd({ target: ev.target.value })}>
              <option value="party">Tout le groupe</option>
              <option value="hero">Un héros</option>
            </select>
            {e.target === 'hero' && (
              <input placeholder="id du héros (vide = 1ᵉʳ)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value || undefined })} />
            )}
          </div>
        )}
        {effect.type === 'corruptionExposure' && (
          <>
            <select value={e.level ?? 'mineure'} onChange={(ev) => upd({ level: ev.target.value })}>
              <option value="mineure">Exposition mineure (échec : +1)</option>
              <option value="moderee">Exposition modérée (+2 / +1 si DR 0-1)</option>
              <option value="majeure">Exposition majeure (+3 / +2 / +1 selon DR)</option>
            </select>
            {/* Compétence déterminée en amont (verrouillée en jeu) ou « au choix » (nature indéterminée,
                LDB 19 l.26 → le joueur tranche dans la modale, comme la Défense). */}
            <select value={e.skill ?? ''} onChange={(ev) => upd({ skill: (ev.target.value || undefined) as 'resistance' | 'calme' | undefined })}>
              <option value="">Au choix du joueur (nature indéterminée)</option>
              <option value="resistance">Résistance (Influence physique)</option>
              <option value="calme">Calme (Corruption spirituelle)</option>
            </select>
            {/* Alignement de la SOURCE (Puissance du Chaos) : si une mutation survient, force la table
                EDOC alignée. « règle globale » = laisse décider le réglage Règles maison. */}
            <select value={e.align ?? ''} onChange={(ev) => upd({ align: (ev.target.value || undefined) as ChaosAlign | undefined })}>
              <option value="">Mutation : règle globale (par défaut)</option>
              {(Object.keys(CHAOS_ALIGN_LABELS) as ChaosAlign[]).map((k) => (
                <option key={k} value={k}>Table EDOC : {CHAOS_ALIGN_LABELS[k]}</option>
              ))}
            </select>
            <input placeholder="id du héros (vide = le premier)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
          </>
        )}
        {effect.type === 'waterExposure' && (
          <>
            {/* Mode RAW (T2C p.91) : ingestion (boire de l'eau non bouillie) / immersion (chute, nage —
                le tableau « Blessures et États » ne s'applique qu'à l'immersion, dérivé du héros). */}
            <select value={e.mode ?? 'ingestion'} onChange={(ev) => upd({ mode: ev.target.value })}>
              <option value="ingestion">Ingestion (boire de l’eau non bouillie)</option>
              <option value="immersion">Immersion (chute / nage)</option>
            </select>
            {/* Tableau 1 « Source d'eau » : le modificateur de la zone d'eau, choix d'AUTEUR. */}
            <select value={e.source ?? ''} onChange={(ev) => upd({ source: ev.target.value || undefined })}>
              <option value="">Source d’eau : Campagne (+0)</option>
              {WATER_EXPOSURE.modifiers.filter((m) => m.table === 'source-d-eau').map((m) => (
                <option key={m.id} value={m.id}>{m.label} ({m.mod > 0 ? '+' : ''}{m.mod})</option>
              ))}
            </select>
            <select value={e.target ?? 'hero'} onChange={(ev) => upd({ target: ev.target.value })}>
              <option value="hero">Un héros</option>
              <option value="party">Tout le groupe</option>
            </select>
            {(e.target ?? 'hero') === 'hero' && (
              <input placeholder="id du héros (vide = le premier)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
            )}
          </>
        )}
        {effect.type === 'learnSpell' && (
          <>
            <select value={e.spell ?? ''} onChange={(ev) => upd({ spell: ev.target.value })}>
              <option value="">— sort de la base —</option>
              {SPELL_GROUPS.map(([g, list]) => (
                <optgroup key={g} label={g}>
                  {list.map((sp) => (
                    <option key={sp.id} value={sp.id}>{sp.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input placeholder="id du héros (vide = premier au Talent éligible)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
          </>
        )}
        {effect.type === 'castSpell' && (
          <>
            {ctx.personas ? (
              <select value={e.casterId ?? ''} onChange={(ev) => upd({ casterId: ev.target.value })}>
                <option value="">— lanceur (personnage de la scène ou id de héros) —</option>
                {ctx.personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.label ? `${p.label} (${p.id})` : p.id}</option>
                ))}
              </select>
            ) : (
              <input placeholder="id du lanceur (personnage de la scène ou héros)" value={e.casterId ?? ''} onChange={(ev) => upd({ casterId: ev.target.value })} />
            )}
            <select value={e.spellId ?? ''} onChange={(ev) => upd({ spellId: ev.target.value })}>
              <option value="">— sort/prière —</option>
              {SPELL_GROUPS.map(([g, list]) => (
                <optgroup key={g} label={g}>
                  {list.map((sp) => (
                    <option key={sp.id} value={sp.id}>{sp.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {ctx.personas ? (
              <select value={e.targetId ?? ''} onChange={(ev) => upd({ targetId: ev.target.value || undefined })}>
                <option value="">— cible : le lanceur (soi) —</option>
                {ctx.personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.label ? `${p.label} (${p.id})` : p.id}</option>
                ))}
              </select>
            ) : (
              <input placeholder="id de la cible (vide = le lanceur)" value={e.targetId ?? ''} onChange={(ev) => upd({ targetId: ev.target.value || undefined })} />
            )}
            <select value={e.mode ?? 'jet'} onChange={(ev) => upd({ mode: ev.target.value })}>
              <option value="jet">Jet réel (RAW — modale influençable si piloté par un humain)</option>
              <option value="forceSuccess">Rituel garanti (arbitrage d'auteur, aucun jet)</option>
            </select>
          </>
        )}
        {effect.type === 'setVessel' && (
          <>
            <select value={e.vehicleId ?? ''} onChange={(ev) => upd({ vehicleId: ev.target.value })}>
              <option value="">— navire de campagne —</option>
              {SHIP_VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <input placeholder="Nom du navire (ex. « Le Cormoran » — vide = nom du type)" value={e.name ?? ''} onChange={(ev) => upd({ name: ev.target.value || undefined })} />
            <div className="tf-row">
              <label className="dr">Moral initial <input type="number" min={0} max={100} style={{ width: '3.6em' }} value={e.morale ?? 75} onChange={(ev) => upd({ morale: Math.max(0, Math.min(100, Number(ev.target.value) || 0)) })} /></label>
              <label className="dr">Coque max (vide = intacte) <input type="number" min={1} style={{ width: '3.6em' }} value={e.hullMax ?? ''} onChange={(ev) => upd({ hullMax: ev.target.value === '' ? undefined : Math.max(1, Number(ev.target.value)) })} /></label>
              {e.hullMax != null && (
                <label className="dr">Coque actuelle <input type="number" min={0} style={{ width: '3.6em' }} value={e.hullCurrent ?? e.hullMax} onChange={(ev) => upd({ hullCurrent: Math.max(0, Number(ev.target.value) || 0) })} /></label>
              )}
              <label className="dr">Sabotage DR (vide = aucun, MDG 14 l.45-47) <input type="number" min={-5} max={0} style={{ width: '3.6em' }} value={e.saboteurDR ?? ''} onChange={(ev) => upd({ saboteurDR: ev.target.value === '' ? undefined : Math.max(-5, Math.min(0, Number(ev.target.value) || 0)) })} /></label>
            </div>
            <CrewRosterFields e={e} upd={upd} />
          </>
        )}
        {effect.type === 'adjustVessel' && (
          <>
            <div className="mini-title">Navire de campagne courant — champs vides = INCHANGÉS (#233)</div>
            <input placeholder="Nom du navire (vide = inchangé)" value={e.name ?? ''} onChange={(ev) => upd({ name: ev.target.value || undefined })} />
            <div className="tf-row">
              <label className="dr">Moral (vide = inchangé) <input type="number" min={0} max={100} style={{ width: '3.6em' }} value={e.morale ?? ''} onChange={(ev) => upd({ morale: ev.target.value === '' ? undefined : Math.max(0, Math.min(100, Number(ev.target.value) || 0)) })} /></label>
              <label className="dr">Coque max (vide = inchangée) <input type="number" min={1} style={{ width: '3.6em' }} value={e.hullMax ?? ''} onChange={(ev) => upd({ hullMax: ev.target.value === '' ? undefined : Math.max(1, Number(ev.target.value)) })} /></label>
              <label className="dr">Coque actuelle (vide = inchangée) <input type="number" min={0} style={{ width: '3.6em' }} value={e.hullCurrent ?? ''} onChange={(ev) => upd({ hullCurrent: ev.target.value === '' ? undefined : Math.max(0, Number(ev.target.value) || 0) })} /></label>
              <label className="dr">Sabotage DR (vide = inchangé, MDG 14 l.45-47) <input type="number" min={-5} max={0} style={{ width: '3.6em' }} value={e.saboteurDR ?? ''} onChange={(ev) => upd({ saboteurDR: ev.target.value === '' ? undefined : Math.max(-5, Math.min(0, Number(ev.target.value) || 0)) })} /></label>
            </div>
            <CrewRosterFields e={e} upd={upd} />
          </>
        )}
        {effect.type === 'adjustManann' && (
          <>
            <select
              value={e.factorId ?? '__delta'}
              onChange={(ev) => upd(ev.target.value === '__delta'
                ? { factorId: undefined, delta: e.delta ?? { flat: 5, d10: 0, sign: 1 } }
                : { factorId: ev.target.value, delta: undefined })}
            >
              <option value="__delta">— delta libre (événement narratif hors-tableau) —</option>
              {MANANN_FACTORS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            {!e.factorId && (
              <div className="tf-row">
                <select value={e.delta?.sign ?? 1} onChange={(ev) => upd({ delta: { ...(e.delta ?? { flat: 0, d10: 0, sign: 1 }), sign: Number(ev.target.value) as 1 | -1 } })}>
                  <option value={1}>+</option>
                  <option value={-1}>−</option>
                </select>
                <label className="dr">Fixe <input type="number" min={0} style={{ width: '3.6em' }} value={e.delta?.flat ?? 0} onChange={(ev) => upd({ delta: { ...(e.delta ?? { flat: 0, d10: 0, sign: 1 }), flat: Math.max(0, Number(ev.target.value) || 0) } })} /></label>
                <label className="dr">d10 <input type="number" min={0} style={{ width: '3.6em' }} value={e.delta?.d10 ?? 0} onChange={(ev) => upd({ delta: { ...(e.delta ?? { flat: 0, d10: 0, sign: 1 }), d10: Math.max(0, Number(ev.target.value) || 0) } })} /></label>
              </div>
            )}
          </>
        )}
        {effect.type === 'giveMoney' && (
          <div className="money-fields">
            <label>CO<input type="number" value={e.gold ?? 0} onChange={(ev) => upd({ gold: Number(ev.target.value) })} /></label>
            <label>SC<input type="number" value={e.silver ?? 0} onChange={(ev) => upd({ silver: Number(ev.target.value) })} /></label>
            <label>PA<input type="number" value={e.brass ?? 0} onChange={(ev) => upd({ brass: Number(ev.target.value) })} /></label>
          </div>
        )}
        {effect.type === 'giveXp' && (
          <label className="dr">
            PX (groupe)
            <input type="number" value={e.amount ?? 0} onChange={(ev) => upd({ amount: Number(ev.target.value) })} />
          </label>
        )}
        {effect.type === 'setTime' && (
          <label className="dr">
            Régler l’heure sur
            <select value={e.phase ?? 'nuit'} onChange={(ev) => onChange({ type: 'setTime', phase: ev.target.value as DayPhaseKey })}>
              {DAY_PHASES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.icon} {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {effect.type === 'petitePriere' && (
          <div className="test-fields">
            <input placeholder="id du héros (vide = premier non-Béni)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value || undefined })} />
            <div className="branch">
              <span className="branch-label">Si la Prière est exaucée (bonus, don, flag…) :</span>
              <FlowEditor flow={e.reward ?? EMPTY_FLOW} onChange={(reward) => upd({ reward })} ctx={ctx} />
            </div>
          </div>
        )}
        {effect.type === 'delayedEffect' && (
          <div className="test-fields">
            <div className="tf-row">
              <select
                value={e.afterMinutes != null ? 'rel' : 'abs'}
                onChange={(ev) =>
                  ev.target.value === 'rel'
                    ? onChange({ type: 'delayedEffect', afterMinutes: e.afterMinutes ?? 60, flow: e.flow ?? EMPTY_FLOW, cancelFlag: e.cancelFlag })
                    : onChange({ type: 'delayedEffect', atHour: e.atHour ?? 0, atMinute: e.atMinute ?? 0, flow: e.flow ?? EMPTY_FLOW, cancelFlag: e.cancelFlag })
                }
              >
                <option value="rel">Compte à rebours (minutes)</option>
                <option value="abs">Heure du jour (prochaine occurrence)</option>
              </select>
              {e.afterMinutes != null ? (
                <label className="dr">dans <input type="number" min={0} value={e.afterMinutes ?? 0} onChange={(ev) => upd({ afterMinutes: Number(ev.target.value) })} /> min</label>
              ) : (
                <label className="dr">à <input type="number" min={0} max={23} value={e.atHour ?? 0} onChange={(ev) => upd({ atHour: Number(ev.target.value) })} />:<input type="number" min={0} max={59} value={e.atMinute ?? 0} onChange={(ev) => upd({ atMinute: Number(ev.target.value) })} /></label>
              )}
              <input placeholder="Flag d’annulation (désamorçage, optionnel)" value={e.cancelFlag ?? ''} onChange={(ev) => upd({ cancelFlag: ev.target.value || undefined })} />
            </div>
            <div className="branch">
              <span className="branch-label">À l’échéance (effets · conditions · tests) :</span>
              <FlowEditor flow={e.flow ?? EMPTY_FLOW} onChange={(flow) => upd({ flow })} ctx={ctx} />
            </div>
          </div>
        )}
        {effect.type === 'ops' && (
          <div className="test-fields">
            <div className="tf-row">
              <label className="dr">
                Cible
                <select value={e.on ?? 'party'} onChange={(ev) => upd({ on: ev.target.value })}>
                  <option value="party">Tout le groupe</option>
                  <option value="hero">Un héros</option>
                  <option value="target">La cible (sort)</option>
                  <option value="caster">Le lanceur (sort)</option>
                </select>
              </label>
              {e.on === 'hero' && (
                <input placeholder="id du héros (vide = 1ᵉʳ)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value || undefined })} />
              )}
            </div>
            <GameOpEditor ops={e.ops ?? []} onChange={(ops) => upd({ ops })} />
          </div>
        )}
        {effect.type === 'setLight' && (
          <div className="tf-row">
            <label className="dr" style={{ flex: 1 }}>
              Lumière {Math.round((e.level ?? 1) * 100)} %
              <input type="range" min={0} max={100} value={Math.round((e.level ?? 1) * 100)} onChange={(ev) => upd({ level: Number(ev.target.value) / 100 })} style={{ width: '100%' }} />
            </label>
          </div>
        )}
        {effect.type === 'fall' && (
          <div className="tf-row">
            <select value={e.target ?? 'party'} onChange={(ev) => upd({ target: ev.target.value })}>
              <option value="party">Tout le groupe</option>
              <option value="hero">Un héros</option>
            </select>
            {e.target === 'hero' && (
              <input placeholder="id du héros (vide = 1ᵉʳ)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value || undefined })} />
            )}
            <label className="dr">Hauteur (m) <input type="number" min={0} style={{ width: '3.2em' }} value={e.metres ?? 0} onChange={(ev) => upd({ metres: Number(ev.target.value) })} /></label>
            <label className="dr">
              <input type="checkbox" checked={!!e.to} onChange={(ev) => upd({ to: ev.target.checked ? { x: 0, y: 0, z: 0 } : undefined })} /> Reposer le groupe
            </label>
            {e.to && (
              <label className="dr">→ <input type="number" style={{ width: '3.2em' }} value={e.to.x} onChange={(ev) => upd({ to: { ...e.to, x: Number(ev.target.value) } })} />,<input type="number" style={{ width: '3.2em' }} value={e.to.y} onChange={(ev) => upd({ to: { ...e.to, y: Number(ev.target.value) } })} /> z<input type="number" style={{ width: '3em' }} value={e.to.z ?? 0} onChange={(ev) => upd({ to: { ...e.to, z: Number(ev.target.value) } })} /></label>
            )}
          </div>
        )}
        {effect.type === 'setDoor' && (
          <div className="tf-row">
            <label className="dr">Porte <input type="number" style={{ width: '3.2em' }} value={e.x ?? 0} onChange={(ev) => upd({ x: Number(ev.target.value) })} />,<input type="number" style={{ width: '3.2em' }} value={e.y ?? 0} onChange={(ev) => upd({ y: Number(ev.target.value) })} /></label>
            <select value={e.side ?? 'N'} onChange={(ev) => upd({ side: ev.target.value })}>
              <option value="N">arête N</option>
              <option value="E">arête E</option>
            </select>
            <label className="dr"><input type="checkbox" checked={e.open !== false} onChange={(ev) => upd({ open: ev.target.checked })} /> Ouverte</label>
          </div>
        )}
        {effect.type === 'zoneBlast' && (
          <div className="test-fields">
            <div className="tf-row">
              <label className="dr">Centre <input type="number" style={{ width: '3.2em' }} value={e.center?.x ?? 0} onChange={(ev) => upd({ center: { x: Number(ev.target.value), y: e.center?.y ?? 0 } })} />,<input type="number" style={{ width: '3.2em' }} value={e.center?.y ?? 0} onChange={(ev) => upd({ center: { x: e.center?.x ?? 0, y: Number(ev.target.value) } })} /></label>
              <label className="dr">Rayon <input type="number" min={0} style={{ width: '3.2em' }} value={e.radius ?? 0} onChange={(ev) => upd({ radius: Number(ev.target.value) })} /></label>
            </div>
            <GameOpEditor ops={e.ops ?? []} onChange={(ops) => upd({ ops })} />
          </div>
        )}
        {effect.type === 'startCombat' && (
          <select value={e.encounter ?? ''} onChange={(ev) => upd({ encounter: ev.target.value })}>
            <option value="">— rencontre —</option>
            {ctx.encounters.map((en) => (
              <option key={en.id} value={en.id}>
                {en.id}
              </option>
            ))}
          </select>
        )}
        {effect.type === 'startMassBattle' && (
          <MassBattleFields battle={e.battle ?? {}} onChange={(battle) => upd({ battle })} ctx={ctx} />
        )}
        {effect.type === 'transition' && (ctx.scenes ? (
          <>
            <select value={e.scene ?? ''} onChange={(ev) => upd({ scene: ev.target.value, entry: '' })}>
              <option value="">— scène du projet —</option>
              {ctx.scenes.map((sc) => (
                <option key={sc.id} value={sc.id}>{sc.nom ? `${sc.nom} (${sc.id})` : sc.id}</option>
              ))}
            </select>
            {(() => {
              const entries = ctx.scenes!.find((sc) => sc.id === e.scene)?.entries ?? [];
              return entries.length ? (
                <select value={e.entry ?? ''} onChange={(ev) => upd({ entry: ev.target.value })}>
                  <option value="">— point d'entrée : départ par défaut —</option>
                  {entries.map((en) => (
                    <option key={en} value={en}>{en}</option>
                  ))}
                </select>
              ) : null;
            })()}
          </>
        ) : (
          <>
            <input placeholder="id de la scène cible" value={e.scene ?? ''} onChange={(ev) => upd({ scene: ev.target.value })} />
            <input placeholder="point d’entrée (optionnel)" value={e.entry ?? ''} onChange={(ev) => upd({ entry: ev.target.value })} />
          </>
        ))}
        {effect.type === 'startDialogue' && (
          <select value={e.dialogue ?? ''} onChange={(ev) => upd({ dialogue: ev.target.value })}>
            <option value="">— dialogue —</option>
            {ctx.dialogues.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id}
              </option>
            ))}
          </select>
        )}
        {effect.type === 'openMerchant' && (ctx.merchants ? (
          ctx.merchants.length ? (
            <select value={e.entityId ?? ''} onChange={(ev) => upd({ entityId: ev.target.value })}>
              <option value="">— entité marchande de la scène —</option>
              {ctx.merchants.map((mch) => (
                <option key={mch.id} value={mch.id}>{mch.label ? `${mch.label} (${mch.id})` : mch.id}</option>
              ))}
            </select>
          ) : (
            <span className="branch-label">Aucune entité marchande dans la scène — donnez d'abord un archétype de marchand à un PNJ (Inspecteur).</span>
          )
        ) : (
          <input placeholder="id de l’entité marchande (doit porter un archétype)" value={e.entityId ?? ''} onChange={(ev) => upd({ entityId: ev.target.value })} />
        ))}
        {effect.type === 'openPort' && (ctx.places ? (
          ctx.places.length ? (
            <select value={e.placeId ?? ''} onChange={(ev) => upd({ placeId: ev.target.value })}>
              <option value="">— lieu de la carte du monde —</option>
              {ctx.places.map((p) => (
                <option key={p.id} value={p.id}>{p.label} ({p.id})</option>
              ))}
            </select>
          ) : (
            <span className="branch-label">Aucun lieu sur la carte du monde — créez-en un d'abord (onglet Monde).</span>
          )
        ) : (
          <input placeholder="id du lieu (carte du monde)" value={e.placeId ?? ''} onChange={(ev) => upd({ placeId: ev.target.value })} />
        ))}
        {effect.type === 'medicalAid' && (() => {
          // Schéma : une LISTE d'actes tarifés (le débit a lieu à l'acte, dans l'infirmerie).
          const ACTS: { key: 'wounds' | 'bleed' | 'trauma' | 'surgery'; label: string | JSX.Element }[] = [
            { key: 'wounds', label: <><Icon id="journal/heal" size="sm" /> Soin de Blessures</> },
            { key: 'bleed', label: <><Icon id="condition/bleeding" size="sm" /> Arrêt d’hémorragie</> },
            { key: 'trauma', label: <><Icon id="medical/tear" size="sm" /> Soin de déchirure</> },
            { key: 'surgery', label: <><Icon id="medical/scalpel" size="sm" /> Chirurgie</> },
          ];
          const acts: { act: string; cost?: { gold?: number; silver?: number; brass?: number } }[] =
            e.acts ?? [];
          const setActs = (next: typeof acts) => upd({ acts: next, act: undefined });
          const setCost = (k: string, field: 'gold' | 'silver' | 'brass', v: number) =>
            setActs(acts.map((a) => (a.act === k ? { ...a, cost: { ...a.cost, [field]: v || undefined } } : a)));
          return (
            <div className="test-fields">
              {ACTS.map(({ key, label }) => {
                const en = acts.find((a) => a.act === key);
                return (
                  <div className="tf-row" key={key}>
                    <label className="dr">
                      <input
                        type="checkbox"
                        checked={!!en}
                        onChange={() => setActs(en ? acts.filter((a) => a.act !== key) : [...acts, { act: key, cost: { silver: 5 } }])}
                      />
                      {label}
                    </label>
                    {en && (
                      <>
                        <label className="dr">CO<input type="number" min={0} value={en.cost?.gold ?? 0} onChange={(ev) => setCost(key, 'gold', Number(ev.target.value))} /></label>
                        <label className="dr">pa<input type="number" min={0} value={en.cost?.silver ?? 0} onChange={(ev) => setCost(key, 'silver', Number(ev.target.value))} /></label>
                        <label className="dr">sc<input type="number" min={0} value={en.cost?.brass ?? 0} onChange={(ev) => setCost(key, 'brass', Number(ev.target.value))} /></label>
                      </>
                    )}
                  </div>
                );
              })}
              <div className="tf-row">
                <label className="dr">Guérison (PNJ)<input type="number" value={e.skill ?? 50} onChange={(ev) => upd({ skill: Number(ev.target.value) })} /></label>
                <label className="dr">Bonus Int<input type="number" value={e.intBonus ?? 4} onChange={(ev) => upd({ intBonus: Number(ev.target.value) })} /></label>
              </div>
              <input placeholder="id du PNJ soigneur (son label = nom affiché ; vide = « Soigneur »)" value={e.entityId ?? ''} onChange={(ev) => upd({ entityId: ev.target.value || undefined })} />
              <span className="branch-label">Le PNJ soigne dans son infirmerie : chaque acte coché est proposé à son tarif, débité au lancement de l’acte.</span>
            </div>
          );
        })()}
        {effect.type === 'extendedTest' && (
          <>
            <input placeholder="Libellé (ex. Crocheter la serrure)" value={e.label ?? ''} onChange={(ev) => upd({ label: ev.target.value })} />
            <div className="tf-row">
              <RefField cfg={{ ds: 'skills', single: true, spec: true }} fieldKey="Compétence" value={e.skill ? { id: e.skill, spec: e.spec } : undefined} onChange={(v) => { const r = v as { id: string; spec?: string } | null; upd({ skill: r?.id || undefined, spec: r?.spec || undefined }); }} nullable />
              <label className="dr">Carac.
                <select value={e.characteristic ?? ''} onChange={(ev) => upd({ characteristic: (ev.target.value || undefined) as CharKey | undefined })}>
                  <option value="">— (de la compétence) —</option>
                  {CHAR_KEYS.map((c) => <option key={c} value={c}>{CHAR_LABELS[c]}</option>)}
                </select>
              </label>
              <label className="dr">Difficulté
                <select value={e.difficulty ?? 'intermediaire'} onChange={(ev) => upd({ difficulty: ev.target.value as Difficulty })}>
                  {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                </select>
              </label>
              <label className="dr">DR cible<input type="number" value={e.targetDR ?? 5} onChange={(ev) => upd({ targetDR: Number(ev.target.value) || 0 })} /></label>
            </div>
            <input placeholder="flag posé à la réussite (option)" value={e.flag ?? ''} onChange={(ev) => upd({ flag: ev.target.value || undefined })} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Combat de masse / Puissance de Bataille (ADE II 08) — édition du `MassBattleSpec` authoré ──────
const MB_KIND_LABEL: Record<string, string> = { test: 'Test', combat: 'Combat', threat: 'Menace', hold: 'Tenue', rally: 'Rassemblement' };

/** Catalogue des Scènes de Round (`ActivityDef` contexte 'bataille-round') — source des pickers. */
const BATTLE_SCENES = (): { id: string; label: string; sceneKind?: string }[] => activitiesFor('bataille-round');

/** Enchaînements (`chains`) d'une Scène, dérivés de ses bandes d'issue. */
function sceneChainIds(id: string): string[] {
  return (battleSceneById(id)?.outcomes ?? []).flatMap((b) => b.chains ?? []);
}

/** Première Scène du catalogue non encore présente dans `used` (repli : la première). */
function firstUnusedScene(used: string[]): string {
  const cat = BATTLE_SCENES();
  return (cat.find((s) => !used.includes(s.id)) ?? cat[0]).id;
}

/** Scènes de COMBAT/MENACE référencées (catalogue effectif ∪ situations ∪ enchaînements déterministes)
 *  → celles pour lesquelles l'auteur peut mapper une rencontre de la scène courante. */
function referencedCombatScenes(b: MassBattleSpec): string[] {
  const pool = b.scenes && b.scenes.length ? b.scenes : BATTLE_SCENES().map((s) => s.id);
  const ids = new Set<string>([...pool, ...((b.situations ?? []).flat())]);
  for (const id of [...ids]) for (const c of sceneChainIds(id)) ids.add(c);
  return [...ids].filter((id) => { const k = battleSceneById(id)?.sceneKind; return k === 'combat' || k === 'threat'; });
}

/** Multi-sélection de Scènes de bataille (patron de `ListRefField` sur le catalogue des Scènes de Round) :
 *  une rangée `<select>` par Scène choisie (id STABLE stocké, libellé affiché) + Ajouter / ✕. */
function SceneMultiSelect({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const list = value ?? [];
  const set = (next: string[]) => onChange(next);
  return (
    <div>
      {list.map((id, i) => (
        <div key={i} className="de-reflrow">
          <select value={id} onChange={(ev) => set(list.map((s, j) => (j === i ? ev.target.value : s)))}>
            {!BATTLE_SCENES().some((o) => o.id === id) && <option value={id}>{id} (inconnu)</option>}
            {BATTLE_SCENES().map((o) => <option key={o.id} value={o.id}>{o.label} · {MB_KIND_LABEL[o.sceneKind ?? '']}</option>)}
          </select>
          <button className="btn small danger" title="Retirer la Scène" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, firstUnusedScene(list)])}>+ Scène</button>
      {!list.length && placeholder && <span className="branch-label">{placeholder}</span>}
    </div>
  );
}

/** Éditeur complet du `MassBattleSpec` (armées, Rounds, situations par Round, rencontres de combat).
 *  Réutilise les primitives d'effet (`.test-fields`/`.tf-row`/`.dr`, patron `ListRefField`, select de
 *  rencontre de `startCombat`). Aucun id tapé : toute Scène/rencontre passe par un picker. */
function MassBattleFields({ battle, onChange, ctx }: { battle: MassBattleSpec; onChange: (b: MassBattleSpec) => void; ctx: Ctx }) {
  const b = battle ?? ({ allyMight: 50, enemyMight: 50 } as MassBattleSpec);
  const set = (patch: Partial<MassBattleSpec>) => onChange({ ...b, ...patch });
  const rounds = Math.max(1, Math.floor(b.plannedRounds ?? 1));
  const situations = b.situations ?? [];
  const setSituations = (next: string[][]) => set({ situations: next.length ? next : undefined });
  const combatScenes = referencedCombatScenes(b);
  return (
    <div className="test-fields">
      <div className="tf-row">
        <label className="dr" style={{ flex: 1 }}>Alliés<input value={b.allyName ?? ''} placeholder="Armée des Personnages" onChange={(ev) => set({ allyName: ev.target.value || undefined })} /></label>
        <label className="dr" style={{ flex: 1 }}>Ennemis<input value={b.enemyName ?? ''} placeholder="Armée ennemie" onChange={(ev) => set({ enemyName: ev.target.value || undefined })} /></label>
      </div>
      <div className="tf-row">
        <label className="dr">Puissance alliée<input type="number" min={0} max={100} value={b.allyMight ?? 0} onChange={(ev) => set({ allyMight: clampMight(Number(ev.target.value) || 0) })} /></label>
        <label className="dr">Puissance ennemie<input type="number" min={0} max={100} value={b.enemyMight ?? 0} onChange={(ev) => set({ enemyMight: clampMight(Number(ev.target.value) || 0) })} /></label>
        <label className="dr">Estimer (force relative)
          <select value="" onChange={(ev) => { const r = POWER_ESTIMATE.find((p) => p.id === ev.target.value); if (r) set({ allyMight: r.ally, enemyMight: r.enemy }); }}>
            <option value="">— remplir les Puissances —</option>
            {POWER_ESTIMATE.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.ally}/{p.enemy})</option>)}
          </select>
        </label>
      </div>
      <div className="tf-row">
        <label className="dr">Rounds prévus<input type="number" min={1} value={rounds} onChange={(ev) => set({ plannedRounds: Math.max(1, Number(ev.target.value) || 1) })} /></label>
        <label className="dr">Taille de tirage<input type="number" min={1} value={b.situationSize ?? 3} onChange={(ev) => set({ situationSize: Math.max(1, Number(ev.target.value) || 1) })} /></label>
        <label className="dr">Modif. permanent (Planification)<input type="number" value={b.allyMod ?? 0} onChange={(ev) => set({ allyMod: Number(ev.target.value) || 0 })} /></label>
      </div>
      <label className="dr">Terrain (description)<input value={b.terrain ?? ''} placeholder="Configuration du terrain (narratif)" onChange={(ev) => set({ terrain: ev.target.value || undefined })} /></label>
      <div className="branch">
        <span className="branch-label">Catalogue de Scènes (pioche des situations) — vide = tout le catalogue.</span>
        <SceneMultiSelect value={b.scenes ?? []} onChange={(scenes) => set({ scenes: scenes.length ? scenes : undefined })} placeholder="Aucune restriction : les 12 Scènes du catalogue sont disponibles." />
      </div>
      <div className="branch">
        <span className="branch-label">Situations authorées (une par Round ; au-delà, la dernière se répète ; aucune = tirage aléatoire de « Taille de tirage »).</span>
        {situations.map((sit, i) => (
          <div key={i} className="branch">
            <span className="branch-label">Round {i + 1} <button className="btn small danger" title="Retirer la situation" onClick={() => setSituations(situations.filter((_, j) => j !== i))}>✕</button></span>
            <SceneMultiSelect value={sit} onChange={(next) => setSituations(situations.map((s, j) => (j === i ? next : s)))} placeholder="Situation vide (seuls imposés / menaces présentés)." />
          </div>
        ))}
        <button className="btn small" onClick={() => setSituations([...situations, []])}>+ Situation (Round {situations.length + 1})</button>
      </div>
      <div className="branch">
        <span className="branch-label">Rencontres des Scènes de combat / menace (rencontre de la scène courante ; vide = rencontre par défaut de la Scène).</span>
        {combatScenes.length ? combatScenes.map((id) => (
          <div key={id} className="de-reflrow">
            <span className="dr" style={{ minWidth: 140 }}>{battleSceneById(id)?.label ?? id}</span>
            <select
              value={b.sceneEncounters?.[id] ?? ''}
              onChange={(ev) => {
                const next = { ...(b.sceneEncounters ?? {}) };
                if (ev.target.value) next[id] = ev.target.value; else delete next[id];
                set({ sceneEncounters: Object.keys(next).length ? next : undefined });
              }}
            >
              <option value="">— rencontre par défaut —</option>
              {ctx.encounters.map((en) => <option key={en.id} value={en.id}>{en.id}</option>)}
            </select>
          </div>
        )) : <span className="branch-label">Aucune Scène de combat / menace dans le catalogue et les situations.</span>}
      </div>
    </div>
  );
}

/** Ferme le `<details>` parent du bouton cliqué (picker « + Effet »). */
export function closeDetails(el: HTMLElement) {
  el.closest('details')?.removeAttribute('open');
}

export function EffectList({ effects, onChange, ctx }: { effects: Effect[]; onChange: (e: Effect[]) => void; ctx: Ctx }) {
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= effects.length) return;
    const next = [...effects];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="eff-list">
      {effects.map((eff, i) => (
        <details className="eff-row" key={i}>
          <summary>
            <span className="eff-summary"><Icon id={EFFECT_ICON[eff.type]} size="sm" /> {effectSummary(eff, ctx)}</span>
            <span className="eff-actions" onClick={(e) => e.preventDefault()}>
              <button className="btn small" title="Monter (l'ordre d'application compte)" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button className="btn small" title="Descendre" disabled={i === effects.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              <button className="btn small danger" title="Supprimer l'effet" onClick={() => onChange(effects.filter((_, j) => j !== i))}>✕</button>
            </span>
          </summary>
          <EffectFields
            effect={eff}
            ctx={ctx}
            onChange={(ne) => onChange(effects.map((x, j) => (j === i ? ne : x)))}
          />
        </details>
      ))}
      <details className="eff-add">
        <summary className="btn small">+ Effet</summary>
        <div className="eff-add-menu panel">
          {EFFECT_GROUPS.map(([g, types]) => (
            <div key={g} className="eff-add-group">
              <div className="mini-title">{g}</div>
              {types.map((t) => (
                <button
                  key={t}
                  className="eff-add-item"
                  onClick={(e) => {
                    onChange([...effects, newEffect(t)]);
                    closeDetails(e.currentTarget);
                  }}
                >
                  <Icon id={EFFECT_ICON[t]} size="sm" /> {EFFECT_LABEL[t]}
                </button>
              ))}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
