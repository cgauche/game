---
name: feedback-no-padding-status
description: Ne pas padder les bilans avec des « restes » pré-existants/périmés non vérifiés
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 24bd007c-bb00-4fa8-84dd-c36f173caa26
---

Dans les bilans de fin de tâche, **ne lister QUE des points ouverts réels, vérifiés et liés au travail fait**. Ne pas recopier un « Reste à faire » de la roadmap pour paraître exhaustif : l'utilisateur l'a relevé (« C'est encore un sujet les éléments que tu me remontes ? ») et un de mes items était factuellement **faux** (Dragon/Manticore annoncés « hors rig » alors que la roadmap dit qu'ils sont riggés — boilerplate parroté sans vérif).

**Why :** ça noie le vrai signal (« c'est fini, rien d'ouvert ») sous du bruit, et propage des contradictions dans les docs. L'utilisateur veut un statut **honnête et lean**, pas une liste qui gonfle.

**How to apply :** quand une tâche est finie, le dire simplement. Si je mentionne un « reste », d'abord **vérifier dans le code/doc** qu'il est encore vrai ET qu'il découle du travail en cours ; sinon, ne pas le mentionner (ou le cadrer explicitement comme « pré-existant, hors périmètre »). Lié à [[feedback-decisiveness-routine-git]].
