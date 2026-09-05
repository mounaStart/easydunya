import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Affiche une erreur lisible au lieu d'un écran blanc (APK / WebView). */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full rounded-2xl bg-white border border-rose-200 shadow-lg p-5">
            <h1 className="text-lg font-bold text-rose-700">Easy Dunya — erreur au démarrage</h1>
            <p className="mt-2 text-sm text-slate-600 break-words">{this.state.error.message}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-brand-600 text-white py-3 font-semibold"
              onClick={() => window.location.reload()}
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
