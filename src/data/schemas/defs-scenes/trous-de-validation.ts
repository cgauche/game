/**
 * TROUS DE VALIDATION de `defs-scenes/` (#1466 L1a T3-c) — liste NOMINATIVE datée (2026-08-24) et
 * DÉCROISSANTE des `z.custom<T>()` du module. Un `z.custom` sans refine accepte TOUT au runtime :
 * il ne tient que le type TypeScript, donc le document mal formé passe la porte. Chaque entrée
 * porte sa raison MESURÉE et son lot de mort ; aucune ne s'ajoute sans les deux, aucune ne se
 * retire autrement que par le commit qui ÉCRIT le schéma de la forme.
 *
 * Clé = `<fichier>:<symbole>` (le symbole exporté, ou le champ porteur pour un `z.custom` inline).
 * Le cliquet vit dans `trous-de-validation.test.ts` : un site hors liste, ou une entrée sans site,
 * est ROUGE et se NOMME.
 */
export const TROUS_DE_VALIDATION: Readonly<Record<string, { raison: string; lot: string }>> = {
  'communs.ts:customStatblockSchema': {
    raison:
      'CustomStatblock (engine/statblock.ts:11) = un PROFIL entier authoré à la main (char partiels, TraitInstance[], SkillRef[], TalentRef[], sorts, groupes) — sa forme est celle de l’entité créature, pas une feuille de scène : l’écrire ici la dupliquerait avant que le schéma d’entité existe.',
    lot: 'L2 #1463 — concept « statblocs/créatures » (les gardes FK nominatives tombent concept par concept en L2/L3, clause B du ticket) ; le schéma de scène le composera au lieu de le redéclarer.',
  },
  'scene.ts:optionalEntrySchema': {
    raison:
      'OptionalEntry (engine/statEntry.ts:137) = TraitInstance | OptionalNote — même famille que les traits d’un statbloc (TraitInstance y est déjà la brique), et sa discrimination se fait par PRÉSENCE de `note` (isOptionalNote), pas par un discriminant.',
    lot: 'L2 #1463 — concept « statblocs/créatures », même lot que `customStatblockSchema` : TraitInstance écrit une fois pour les deux, sinon deux graphies de la même brique.',
  },
  'scene.ts:authoredShipPosteSchema': {
    raison:
      'AuthoredShipPoste (engine/types.ts:1198) porte DEUX formes vivantes en même temps — la neuve (`trappingId`) et l’ANCIENNE pré-#222 (`item: ItemInstance` copié en entier, migrée par `hydratePoste`) — plus `WeaponEnchant[]` : l’écrire strict aujourd’hui exigerait le schéma d’ItemInstance ET de figer une forme que la migration efface encore.',
    lot: 'L3 #1463 — lot NAVAL (postes/artillerie MDG) : la forme ancienne meurt avec la migration, l’ItemInstance vient avec le lot possessions.',
  },
  'narratif.ts:objets': {
    raison:
      'TrappingData EMBARQUÉ dans un preset narratif ≠ schéma de catalogue (mesuré T3-b : `type:"divers"` sans enveloppe de dataset) — le schéma de l’objet appartient au catalogue des possessions, pas au bloc narratif.',
    lot: 'L3 #1463 — lot POSSESSIONS/trappings : le bloc narratif référencera le schéma de catalogue une fois écrit.',
  },
};
