/**
 * Constructeur d'effets réutilisable (triggers ET dialogues).
 * Un effet = une action de gameplay (journal, flag, document, objet, argent,
 * combat, transition, dialogue, test de compétence avec branches…).
 */
import { Effect, EncounterDef, Dialogue, Scene } from '../../state/scene';
import { DIFFICULTY_LABELS, Difficulty } from '../../engine/types';
import { isSocialTest } from '../../engine/skills';
import { DAY_PHASES, DayPhaseKey } from '../../engine/clock';
import { DISEASE_DEFS } from '../../engine/disease';
import { spells } from '../../data';

/** Noms des maladies câblées (LDB 20) proposés dans l'éditeur. */
const DISEASE_NAMES = Object.keys(DISEASE_DEFS);

/** Sorts de la base groupés pour le select de `learnSpell` (audit M9 : fini « libellé exact »). */
const SPELL_GROUPS: [string, string[]][] = (() => {
  const m = new Map<string, string[]>();
  for (const sp of spells) {
    const g = `${sp.type ?? 'Sorts'}${sp.subType ? ` — ${sp.subType}` : ''}`;
    if (!m.has(g)) m.set(g, []);
    m.get(g)!.push(sp.label);
  }
  for (const list of m.values()) list.sort((a, b) => a.localeCompare(b));
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

const EFFECT_TYPES: Effect['type'][] = [
  'journal',
  'setFlag',
  'document',
  'giveTrapping',
  'giveMoney',
  'giveXp',
  'restoreFortune',
  'inflictNightmares',
  'inflictDisease',
  'inflictTrauma',
  'giveSin',
  'corruptionExposure',
  'giveCorruption',
  'learnSpell',
  'rest',
  'mealParty',
  'interlude',
  'startCombat',
  'transition',
  'transitionBack',
  'openWorldMap',
  'startDialogue',
  'openMerchant',
  'medicalAid',
  'test',
  'setTime',
  'endDialogue',
];
const EFFECT_LABEL: Record<Effect['type'], string> = {
  journal: 'Journal',
  setFlag: 'Définir un flag',
  document: 'Document (handout)',
  giveTrapping: 'Donner un objet (équipement/potion/babiole — réel ou custom)',
  giveMoney: 'Donner/retirer de l’argent',
  giveXp: 'Donner des PX (groupe)',
  restoreFortune: 'Regagner la Chance (début de session, max = Destin)',
  inflictNightmares: 'Infliger des cauchemars (trauma nocturne)',
  inflictDisease: 'Infliger une maladie (LDB 20)',
  inflictTrauma: 'Infliger une Blessure Critique (LDB 18)',
  giveSin: 'Points de Péché (prêtre fautif, LDB 40)',
  corruptionExposure: 'Influence corruptrice (Test, LDB 19)',
  giveCorruption: 'Points de Corruption directs (LDB 19)',
  learnSpell: 'Apprendre un sort (trouvaille, sans PX)',
  rest: 'Repos (Dormir / Se reposer N jours)',
  mealParty: 'Repas (nourrit le groupe sans ration — faim à zéro)',
  interlude: 'Entre deux aventures (Événements + Activités, N semaines)',
  startCombat: 'Démarrer un combat',
  transition: 'Transition de scène',
  transitionBack: 'Retour scène précédente',
  openWorldMap: 'Ouvrir la carte du monde (partir en voyage)',
  startDialogue: 'Ouvrir un dialogue',
  openMerchant: 'Ouvrir une boutique (marchand)',
  medicalAid: 'Acte de soin payant (PNJ médecin/guérisseur)',
  test: 'Test de compétence',
  setTime: 'Régler l’heure (jour/nuit)',
  endDialogue: 'Fermer le dialogue',
};

export function newEffect(type: Effect['type']): Effect {
  switch (type) {
    case 'setFlag':
      return { type: 'setFlag', flag: '', value: true };
    case 'document':
      return { type: 'document', title: '', text: '' };
    case 'giveTrapping':
      return { type: 'giveTrapping', trapping: '' };
    case 'giveMoney':
      return { type: 'giveMoney', gold: 0, silver: 0, brass: 0 };
    case 'giveXp':
      return { type: 'giveXp', amount: 50 };
    case 'startCombat':
      return { type: 'startCombat', encounter: '' };
    case 'transition':
      return { type: 'transition', scene: '', entry: '' };
    case 'startDialogue':
      return { type: 'startDialogue', dialogue: '' };
    case 'openMerchant':
      return { type: 'openMerchant', entityId: '' };
    case 'medicalAid':
      return { type: 'medicalAid', act: 'wounds', skill: 50, intBonus: 4 };
    case 'test':
      return { type: 'test', skill: '', difficulty: 'intermediaire', requireSL: 0, onSuccess: [], onFailure: [] };
    case 'openWorldMap':
      return { type: 'openWorldMap' };
    case 'endDialogue':
      return { type: 'endDialogue' };
    case 'restoreFortune':
      return { type: 'restoreFortune' };
    case 'interlude':
      return { type: 'interlude', weeks: 1 };
    case 'inflictNightmares':
      return { type: 'inflictNightmares', heroId: '' };
    case 'inflictDisease':
      return { type: 'inflictDisease', disease: DISEASE_NAMES[0] ?? '', heroId: '' };
    case 'inflictTrauma':
      return { type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'brasD', heroId: '' };
    case 'giveSin':
      return { type: 'giveSin', amount: 1, heroId: '' };
    case 'corruptionExposure':
      return { type: 'corruptionExposure', level: 'mineure', skill: 'Résistance', heroId: '' };
    case 'giveCorruption':
      return { type: 'giveCorruption', amount: 1, heroId: '' };
    case 'learnSpell':
      return { type: 'learnSpell', spell: '', heroId: '' };
    case 'rest':
      return { type: 'rest', days: 1 };
    case 'mealParty':
      return { type: 'mealParty' };
    case 'setTime':
      return { type: 'setTime', phase: 'nuit' };
    default:
      return { type: 'journal', text: '' };
  }
}

function EffectEditor({ effect, onChange, onRemove, ctx }: { effect: Effect; onChange: (e: Effect) => void; onRemove: () => void; ctx: Ctx }) {
  const e = effect as any;
  const upd = (patch: any) => onChange({ ...e, ...patch });
  return (
    <div className="eff-row">
      <div className="eff-head">
        <select value={effect.type} onChange={(ev) => onChange(newEffect(ev.target.value as Effect['type']))}>
          {EFFECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EFFECT_LABEL[t]}
            </option>
          ))}
        </select>
        <button className="btn small danger" onClick={onRemove}>
          ✕
        </button>
      </div>
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
            <input placeholder="Libellé exact (trappings.json), ex. Chemise de mailles" value={e.trapping ?? ''} onChange={(ev) => upd({ trapping: ev.target.value })} />
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
          <label>Journées de repos <input type="number" min={1} value={e.days ?? 1} onChange={(ev) => upd({ days: Math.max(1, Number(ev.target.value) || 1) })} /></label>
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
            <select value={e.skill ?? 'Résistance'} onChange={(ev) => upd({ skill: ev.target.value })}>
              <option value="Résistance">Résistance (Influence physique)</option>
              <option value="Calme">Calme (Corruption spirituelle)</option>
            </select>
            <input placeholder="id du héros (vide = le premier)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
          </>
        )}
        {effect.type === 'giveCorruption' && (
          <>
            <label>Points de Corruption <input type="number" min={1} value={e.amount ?? 1} onChange={(ev) => upd({ amount: Math.max(1, Number(ev.target.value) || 1) })} /></label>
            <input placeholder="id du héros (vide = le premier)" value={e.heroId ?? ''} onChange={(ev) => upd({ heroId: ev.target.value })} />
          </>
        )}
        {effect.type === 'learnSpell' && (
          <>
            <select value={e.spell ?? ''} onChange={(ev) => upd({ spell: ev.target.value })}>
              <option value="">— sort de la base —</option>
              {SPELL_GROUPS.map(([g, list]) => (
                <optgroup key={g} label={g}>
                  {list.map((sp) => (
                    <option key={sp} value={sp}>{sp}</option>
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
        {effect.type === 'medicalAid' && (
          <div className="test-fields">
            <div className="tf-row">
              <label className="dr">
                Acte
                <select value={e.act ?? 'wounds'} onChange={(ev) => upd({ act: ev.target.value })}>
                  <option value="wounds">Soin de Blessures (Guérison)</option>
                  <option value="bleed">Arrêt d’hémorragie (Guérison)</option>
                  <option value="surgery">Chirurgie (1d10 + Hémorragie, LDB 10/18)</option>
                </select>
              </label>
              <label className="dr">Guérison (PNJ)<input type="number" value={e.skill ?? 50} onChange={(ev) => upd({ skill: Number(ev.target.value) })} /></label>
              <label className="dr">Bonus Int<input type="number" value={e.intBonus ?? 4} onChange={(ev) => upd({ intBonus: Number(ev.target.value) })} /></label>
            </div>
            <input placeholder="id du PNJ soigneur (son label = nom affiché ; vide = « Soigneur »)" value={e.entityId ?? ''} onChange={(ev) => upd({ entityId: ev.target.value || undefined })} />
            <span className="branch-label">PNJ soigneur (jamais dans le groupe ; le joueur choisit qui soigner) ; prix via le coût du choix de dialogue (LDB 75).</span>
          </div>
        )}
        {effect.type === 'test' && (
          <div className="test-fields">
            <div className="tf-row">
              <input placeholder="Compétence (ex. Marchandage)" value={e.skill ?? ''} onChange={(ev) => upd({ skill: ev.target.value })} />
              <select value={e.difficulty ?? 'intermediaire'} onChange={(ev) => upd({ difficulty: ev.target.value as Difficulty })}>
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
              <label className="dr">DR≥<input type="number" value={e.requireSL ?? 0} onChange={(ev) => upd({ requireSL: Number(ev.target.value) })} /></label>
              <input placeholder="Outil (ex. Rossignols — qualité Pratique/Bâclé…)" value={e.tool ?? ''} onChange={(ev) => upd({ tool: ev.target.value || undefined })} />
            </div>
            {isSocialTest(e.skill, e.characteristic) && (
              <div className="tf-row">
                <input
                  placeholder="Interlocuteur — groupes (Sociabilité : Animosité/Préjugé −20/−10, ex. « Elfe, Mort-vivant »)"
                  value={(e.vsGroups ?? []).join(', ')}
                  onChange={(ev) => {
                    const g = ev.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    upd({ vsGroups: g.length ? g : undefined });
                  }}
                />
              </div>
            )}
            <div className="branch">
              <span className="branch-label ok">Si RÉUSSITE :</span>
              <EffectList effects={e.onSuccess ?? []} onChange={(x) => upd({ onSuccess: x })} ctx={ctx} />
            </div>
            <div className="branch">
              <span className="branch-label fail">Si ÉCHEC :</span>
              <EffectList effects={e.onFailure ?? []} onChange={(x) => upd({ onFailure: x })} ctx={ctx} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EffectList({ effects, onChange, ctx }: { effects: Effect[]; onChange: (e: Effect[]) => void; ctx: Ctx }) {
  return (
    <div className="eff-list">
      {effects.map((eff, i) => (
        <EffectEditor
          key={i}
          effect={eff}
          ctx={ctx}
          onChange={(ne) => onChange(effects.map((x, j) => (j === i ? ne : x)))}
          onRemove={() => onChange(effects.filter((_, j) => j !== i))}
        />
      ))}
      <button className="btn small" onClick={() => onChange([...effects, newEffect('journal')])}>
        + Effet
      </button>
    </div>
  );
}
