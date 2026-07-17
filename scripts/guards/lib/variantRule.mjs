// Mécanique de garde « `variants[].when.rule` ∈ `OPTIONAL_RULES` » (#563/#564 Lot 3 item 1). Une
// variante réglée (`variantSchema`, `src/data/schemas/common.ts:151`) référence LE registre
// `OPTIONAL_RULES` (`src/engine/policy.ts:43`) par id STABLE — jamais un label, jamais un id fantôme
// (gate fantôme = une variante que `rule()` ne peut jamais activer, silencieusement morte). Module
// ESM pur, exécutable par `node` nu — consommé par `src/data/variants-integrity.test.ts`.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Réfs `variants[].when.rule` d'un dataset, à TOUTE profondeur (même patron de walk que
 *  `folioIntegrity.mjs:citedEntriesOf`). Clé = id STABLE de l'entrée porteuse + index de variante.
 *  @param {unknown} data @returns {{ key: string, rule: string }[]} */
export function variantRulesOf(data) {
  /** @type {{ key: string, rule: string }[]} */
  const out = []
  /** @param {unknown} node @param {string} path */
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`))
      return
    }
    const rec = /** @type {Record<string, unknown>} */ (node)
    const variants = rec.variants
    if (Array.isArray(variants)) {
      const ownerId = typeof rec.id === 'string' ? rec.id : path || '?'
      variants.forEach((v, i) => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return
        const rv = /** @type {Record<string, unknown>} */ (v)
        const when = rv.when
        if (when && typeof when === 'object' && !Array.isArray(when) && typeof (/** @type {Record<string, unknown>} */ (when)).rule === 'string') {
          out.push({ key: `${ownerId}.variants[${i}]`, rule: /** @type {string} */ (/** @type {Record<string, unknown>} */ (when).rule) })
        }
      })
    }
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'variants') continue
      walk(v, path ? `${path}.${k}` : k)
    }
  }
  walk(data, '')
  return out
}

/**
 * Scanne `src/data/*.json` pour les `variants[].when.rule` qui ne référencent PAS le registre
 * `OPTIONAL_RULES` — gate fantôme (une variante que rien n'active jamais).
 * @param {string} dataDir @param {ReadonlySet<string>} knownRuleIds
 * @returns {{ key: string, file: string, rule: string }[]}
 */
export function unknownVariantRules(dataDir, knownRuleIds) {
  /** @type {{ key: string, file: string, rule: string }[]} */
  const violations = []
  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json')).sort()
  for (const f of files) {
    let data
    try {
      data = JSON.parse(readFileSync(join(dataDir, f), 'utf8'))
    } catch {
      continue
    }
    for (const e of variantRulesOf(data)) {
      if (!knownRuleIds.has(e.rule)) violations.push({ key: `${f}:${e.key}`, file: f, rule: e.rule })
    }
  }
  return violations
}
