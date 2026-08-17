/**
 * Primitive GÉNÉRIQUE de migration séquentielle de document versionné (Lot 2 — pérennité 10 ans).
 * Consommée par `roster.ts` (`ROSTER_MIGRATIONS`, export de héros) et `worldMap.ts`
 * (`PROJECT_MIGRATIONS`, documents de campagne authorés) — des documents PORTABLES, produits par un
 * auteur ou exportés vers une autre machine.
 *
 * Les sauvegardes de PARTIE ne migrent PLUS (arbitrage utilisateur 2026-08-17 : au changement de forme
 * persistée, `SAVE_VERSION` monte et les saves antérieures se JETTENT, `saves.ts`). Ne pas purger le
 * roster ni les projets par imitation : ce sont d'autres axes persistants, avec leurs consommateurs.
 *
 * Sémantique : un doc `vN` traverse `migrations[N]`, `[N+1]`… jusqu'à
 * `targetVersion`. Refus explicite (retourne `null`, jamais une exception ni une donnée corrompue) si :
 * pas un objet, `version` absente/non numérique, version FUTURE (plus récente que l'app — on ne devine
 * pas une structure inconnue), trou dans la chaîne (pas de migrateur pour une version rencontrée), ou
 * un migrateur qui ne fait pas progresser `version`.
 */

/** Table de migrations séquentielles : la clé N met à niveau un doc vN → v(N+1). */
export type MigrationMap = Record<number, (doc: Record<string, unknown>) => Record<string, unknown>>;

export function migrateDoc(parsed: unknown, targetVersion: number, migrations: MigrationMap): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  let doc = parsed as Record<string, unknown>;
  let v = typeof doc.version === 'number' ? doc.version : NaN;
  if (!Number.isFinite(v) || v > targetVersion) return null; // version inconnue ou plus récente que l'app
  while (v < targetVersion) {
    const up = migrations[v];
    if (!up) return null; // pas de migrateur pour cette version → on refuse (plutôt que corrompre)
    doc = up(doc);
    const next = typeof doc.version === 'number' ? doc.version : NaN;
    if (!Number.isFinite(next) || next <= v) return null; // un migrateur DOIT faire progresser la version
    v = next;
  }
  return doc;
}
