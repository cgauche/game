/**
 * Constructeur d'effets réutilisable (triggers, dialogues, rencontres, props interactifs).
 * Un effet = une action de gameplay (journal, flag, objet, argent, combat, transition, test…).
 *
 * v2 : chaque effet est une rangée REPLIÉE résumée en clair (`effectSummary`) qu'on déplie pour
 * éditer ; « + Effet » ouvre un picker par CATÉGORIE (fini le select plat de 27 types) ; les
 * effets se réordonnent (l'ordre d'application compte — `applyEffects`).
 */
import { Effect, EncounterDef, Dialogue, Scene } from '../../state/scene';
import { EMPTY_FLOW } from '../../state/flow';
import { EFFECT_HANDLERS, EFFECT_GROUP_ORDER } from '../../state/combatEffects';
import { DAY_PHASES, DayPhaseKey } from '../../engine/clock';
import { DISEASE_DEFS } from '../../engine/disease';
import { spells, trappings as trappingsData, refLabel, WATER_EXPOSURE } from '../../data';
import { giveTrappingLabel } from '../../engine/items';
import { FlowEditor } from './FlowEditor';
import { GameOpEditor, opSummary } from './GameOpEditor';
import { RefField } from '../compendium/RefField';
import { CHAR_KEYS, CHAR_LABELS, CharKey, DIFFICULTY_LABELS, Difficulty } from '../../engine/types';
import { CHAOS_ALIGN_LABELS, ChaosAlign } from '../../engine/corruption';

/** Noms des maladies câblées (LDB 20) proposés dans l'éditeur. */
const DISEASE_NAMES = Object.keys(DISEASE_DEFS);

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

/** Contexte « projet » des selects guidés (M9), depuis la scène active + les autres scènes. */
export function effectCtxOf(scene: Scene, otherScenes: Scene[] = []): Pick<Ctx, 'merchants' | 'scenes'> {
  return {
    merchants: scene.entities.filter((e) => e.merchant).map((e) => ({ id: e.id, label: e.label })),
    scenes: [scene, ...otherScenes].map((sc) => ({ id: sc.id, nom: sc.nom, entries: Object.keys(sc.entryPoints ?? {}) })),
  };
}

export interface Ctx {
  encounters: EncounterDef[];
  dialogues: Dialogue[];
  /** Entités marchandes de la scène (audit M9 : select au lieu d'un id à taper). Absent = input. */
  merchants?: { id: string; label?: string }[];
  /** Scènes du projet (id + nom + points d'entrée) pour les transitions. Absent = input. */
  scenes?: { id: string; nom?: string; entries: string[] }[];
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

/** Résumé HUMAIN d'un effet (rangée repliée) — PUR, testé. */
export function effectSummary(effect: Effect, ctx?: Pick<Ctx, 'scenes'>): string {
  const e = effect as any;
  const icon = EFFECT_ICON[effect.type] ?? '•';
  switch (effect.type) {
    case 'journal': return `${icon} Journal : ${e.text ? `« ${cut(e.text)} »` : '(vide)'}`;
    case 'setFlag': return `${icon} Flag ${e.flag || '?'} = ${e.value === false ? 'faux' : 'vrai'}`;
    case 'document': return `${icon} Document : ${e.title || '(sans titre)'}`;
    case 'giveTrapping': return `${icon} Objet : ${giveTrappingLabel(e) || '?'}${e.qualities?.length ? ` (+${e.qualities.length} qualité(s))` : ''}`;
    case 'giveMoney': {
      const parts = [e.gold ? `${e.gold} CO` : '', e.silver ? `${e.silver} pa` : '', e.brass ? `${e.brass} sc` : ''].filter(Boolean);
      return `${icon} Argent : ${parts.join(' ') || '0'}`;
    }
    case 'giveXp': return `${icon} ${e.amount ?? 0} PX (groupe)`;
    case 'restoreFortune': return `${icon} Regagner la Chance`;
    case 'inflictNightmares': return `${icon} Cauchemars${e.heroId ? ` → ${e.heroId}` : ''}`;
    case 'inflictDisease': return `${icon} Maladie : ${e.disease || '?'}`;
    case 'inflictTrauma': return `${icon} Critique : ${e.kind ?? 'fracture'} (${e.location ?? '?'})`;
    case 'ops': {
      const who = e.on === 'hero' ? '1ᵉʳ héros' : e.on === 'caster' ? 'lanceur' : e.on === 'target' ? 'cible' : 'groupe';
      return `${icon} ${who} : ${(e.ops ?? []).map(opSummary).join(', ') || '(aucune op)'}`;
    }
    case 'zoneBlast': return `${icon} Souffle ${(e.ops ?? []).length} op(s) rayon ${e.radius ?? 0} @(${e.center?.x ?? 0},${e.center?.y ?? 0})`;
    case 'fall': return `${icon} Chute ${e.metres ?? 0} m → ${e.target === 'hero' ? (e.heroId || '1ᵉʳ héros') : 'groupe'}${e.to ? ` ⤓(${e.to.x},${e.to.y}${e.to.z ? `,z${e.to.z}` : ''})` : ''}`;
    case 'setLight': return `${icon} Lumière ${Math.round((e.level ?? 1) * 100)} %`;
    case 'setDoor': return `${icon} Porte (${e.x ?? 0},${e.y ?? 0},${e.side ?? 'N'}) ${e.open ? 'ouverte' : 'fermée'}`;
    case 'giveSin': return `${icon} ${e.amount ?? 1} point(s) de Péché`;
    case 'corruptionExposure': return `${icon} Influence corruptrice (${e.level ?? 'mineure'}, ${e.skill ?? 'au choix'})${e.align ? ` — ${CHAOS_ALIGN_LABELS[e.align as ChaosAlign]}` : ''}`;
    case 'waterExposure': return `${icon} Eau souillée (${e.mode === 'immersion' ? 'immersion' : 'ingestion'}${e.source ? ` · ${e.source}` : ''}) → ${e.target === 'party' ? 'groupe' : (e.heroId || '1ᵉʳ héros')}`;
    case 'learnSpell': return `${icon} Apprendre : ${e.spell ? refLabel('spells', { id: e.spell }) : '?'}`;
    case 'petitePriere': {
      const n = e.reward ? (e.reward.kind === 'seq' ? e.reward.steps.length : 1) : 0;
      return `${icon} Petites Prières (site sacré)${e.heroId ? ` → ${e.heroId}` : ''} · ${n} bloc(s) si exaucée`;
    }
    case 'rest': return `${icon} Repos ${e.days ?? 1} nuit(s) (${e.lodging ?? 'maison'}${e.quality === 'pietre' ? ', piètre' : ''})`;
    case 'mealParty': return `${icon} Repas du groupe`;
    case 'interlude': return `${icon} Interlude : ${e.weeks ?? 1} semaine(s)`;
    case 'startCombat': return `${icon} Combat : ${e.encounter || '?'}`;
    case 'transition': {
      const sc = ctx?.scenes?.find((s) => s.id === e.scene);
      return `${icon} Vers ${sc?.nom ?? e.scene ?? '?'}${e.entry ? ` @ ${e.entry}` : ''}`;
    }
    case 'transitionBack': return `${icon} Retour scène précédente`;
    case 'openWorldMap': return `${icon} Carte du monde (voyage)`;
    case 'startDialogue': return `${icon} Dialogue : ${e.dialogue || '?'}`;
    case 'openMerchant': return `${icon} Boutique : ${e.entityId || '?'}`;
    case 'medicalAid': return `${icon} Soins payants (${(e.acts ?? (e.act ? [0] : [])).length} acte(s))`;
    case 'extendedTest': return `${icon} Test Étendu ${e.skill ? refLabel('skills', { id: e.skill, spec: e.spec }) : (e.characteristic || '?')} → DR cumulé ${e.targetDR ?? 0}${e.flag ? ` (flag ${e.flag})` : ''}`;
    case 'forceDoor': return `${icon} Enfoncer « ${e.label || '?'} » (BE ${e.doorBE ?? 0}, B ${e.doorB ?? 0})${e.flag ? ` → flag ${e.flag}` : ''}`;
    case 'setTime': return `${icon} Heure → ${DAY_PHASES.find((p) => p.key === e.phase)?.label ?? e.phase}`;
    case 'delayedEffect': {
      const when = e.afterMinutes != null
        ? `dans ${e.afterMinutes} min`
        : `à ${String(e.atHour ?? 0).padStart(2, '0')}:${String(e.atMinute ?? 0).padStart(2, '0')}`;
      const n = e.flow ? (e.flow.kind === 'seq' ? e.flow.steps.length : 1) : 0;
      return `${icon} Différé ${when} → ${n} bloc(s)${e.cancelFlag ? ` · annulé si ${e.cancelFlag}` : ''}`;
    }
    case 'endDialogue': return `${icon} Fermer le dialogue`;
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
        {effect.type === 'medicalAid' && (() => {
          // Schéma : une LISTE d'actes tarifés (le débit a lieu à l'acte, dans l'infirmerie).
          const ACTS: { key: 'wounds' | 'bleed' | 'trauma' | 'surgery'; label: string }[] = [
            { key: 'wounds', label: '🩹 Soin de Blessures' },
            { key: 'bleed', label: '🩸 Arrêt d’hémorragie' },
            { key: 'trauma', label: '🦵 Soin de déchirure' },
            { key: 'surgery', label: '🔪 Chirurgie' },
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
            <span className="eff-summary">{effectSummary(eff, ctx)}</span>
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
                  {EFFECT_ICON[t]} {EFFECT_LABEL[t]}
                </button>
              ))}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
