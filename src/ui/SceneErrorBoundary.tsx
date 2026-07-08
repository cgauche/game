import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  crashed: boolean;
}

/** Garde de CLASSE (seul moyen React) autour du rendu de la scène iso/POV : un crash de rendu
 *  (ex. #203/régression — TypeError sur une entité sans arme) démonte tout l'arbre React en silence
 *  et coûte la partie (écran noir). Capture, logue, et affiche un panneau de reprise EN FRANÇAIS au
 *  lieu de laisser l'écran noir. Ne PEUT PAS être un composant fonction (pas de hook équivalent à
 *  `componentDidCatch`). */
export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }): void {
    console.error('SceneErrorBoundary : crash de rendu de la scène', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.crashed) {
      return (
        <div className="stage scene-error-boundary">
          <div className="panel">
            <p>La scène a rencontré une erreur de rendu.</p>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
