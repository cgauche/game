import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneErrorBoundary, type SceneErrorBoundaryProps } from './SceneErrorBoundary';

// React SSR (renderToStaticMarkup) n'exécute PAS le cycle de commit (componentDidCatch/
// getDerivedStateFromError ne sont jamais déclenchés) : on ne peut donc pas faire jeter un enfant
// à travers un rendu SSR complet pour vérifier la capture. On pilote donc la classe directement
// (état crashé simulé + render()) — c'est le SEUL point d'accès pour tester une error boundary
// sans navigateur/jsdom (absent de ce dépôt, cf. vite.config.ts `environment: 'node'`).
function crashedMarkup(props: Omit<SceneErrorBoundaryProps, 'children'>): string {
  const instance = new SceneErrorBoundary({ children: null, ...props });
  instance.state = SceneErrorBoundary.getDerivedStateFromError();
  return renderToStaticMarkup(instance.render() as React.ReactElement);
}

describe('SceneErrorBoundary — #225 périmètre étendu', () => {
  it('enfant qui NE jette PAS : rend les enfants normalement', () => {
    const html = renderToStaticMarkup(
      <SceneErrorBoundary>
        <div className="marker">contenu normal</div>
      </SceneErrorBoundary>,
    );
    expect(html).toContain('marker');
    expect(html).toContain('contenu normal');
  });

  it('défaut (comportement de scène historique) : état crashé → panneau de repli, PAS un arbre vide', () => {
    const html = crashedMarkup({});
    expect(html).not.toBe('');
    expect(html).toContain('scene-error-boundary');
    expect(html).toContain('La scène a rencontré une erreur de rendu.');
    expect(html).toContain('Recharger');
  });

  it('#225 — paramétrée en filet de niveau écran : message/libellé/classe custom, panneau de repli PAS un arbre vide', () => {
    const html = crashedMarkup({
      className: 'app-error-boundary',
      message: "Une erreur d'affichage est survenue. Votre partie n'est pas perdue.",
      retryLabel: 'Revenir à la scène',
      onRetry: () => {},
    });
    expect(html).not.toBe('');
    expect(html).toContain('app-error-boundary');
    expect(html).toContain('Votre partie n');
    expect(html).toContain('est pas perdue.');
    expect(html).toContain('Revenir à la scène');
    // Une seule classe de boundary réutilisée : pas de second panneau générique "Recharger".
    expect(html).not.toContain('Recharger');
  });

  it('handleRetry : onRetry fourni → réessaie le rendu (crashed=false) SANS recharger la page', () => {
    const instance = new SceneErrorBoundary({ children: null, onRetry: () => {} });
    instance.state = SceneErrorBoundary.getDerivedStateFromError();
    instance.setState = (partial) => { instance.state = { ...instance.state, ...(partial as Partial<typeof instance.state>) }; };
    instance.handleRetry();
    expect(instance.state.crashed).toBe(false);
  });
});
