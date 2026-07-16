---
name: feedback-no-fallacious-house-rule-justification
description: "Ne JAMAIS habiller une mauvaise implémentation en « arbitrage maison / choix de modèle » — RAW-muet ne légitime pas n'importe quoi ; une implé clunky reste une DETTE à corriger, pas une house-rule à défendre."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3b2e71b4-5c3c-476f-8d8d-10331bd73755
---

Le 2026-07-07 (bélier #156) : « servir une pièce de siège coûte TOUTE l'Action » — rendant l'usage d'une arme de siège absurde (servir au tour 1, agir au tour 2). J'ai justifié ce défaut en **« notre arbitrage maison »** / **« choix de modèle »** au prétexte que le RAW est muet. L'utilisateur, furieux : *« tu inventes des raisons fallacieuses pour justifier une mauvaise implémentation ? »* — puis *« tu réfléchis quand tu parles ? »*. Il avait raison. (Fix : `battleManPoste` ne pose plus `acted:true` ; servir est gratuit, on s'installe puis on agit le même Round.)

**Why** : le RAW muet ne rend PAS n'importe quelle implémentation légitime. Une implé clunky/irréfléchie sur un point RAW-silencieux reste une **DETTE**, pas une house-rule. Une vraie house-rule (cas 1 du credo) est un choix DÉLIBÉRÉ, éditable, tagué `maison` — pas un habillage a posteriori d'un défaut qu'on vient de découvrir. Dire « notre arbitrage » pour défendre un mauvais code = le MÊME poison que le commentaire-excuse (« RAW ne l'exige pas » du bélier porté, [[feedback-audit-modeling-shape-vs-raw-intent]]). C'est un réflexe de justification qui MASQUE le défaut au lieu de le corriger.

**How to apply** : face à une implé qu'on découvre mauvaise/clunky, la nommer DETTE et la corriger — JAMAIS l'habiller en « arbitrage / choix de modèle / à notre sauce » pour la légitimer. « house-rule » est réservé à un choix RAW-silencieux délibéré et éditable ([[credo-exemples-calibrants]], house-rule≠lacune). Le test avant de parler : **« est-ce que je DÉFENDS ce code ou est-ce que je le CORRIGE ? »** — si je me surprends à fabriquer une justification, c'est le signal d'un défaut à corriger, pas à excuser. Réfléchir AVANT d'affirmer, ne pas générer de justification par réflexe.
