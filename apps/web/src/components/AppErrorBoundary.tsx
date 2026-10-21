import { Component, type ReactNode } from "react";
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    console.error("ClearHire could not render this view");
  }
  render() {
    if (this.state.failed)
      return (
        <main className="container">
          <h1>This view couldn’t load</h1>
          <p role="alert">
            Reload to try again. If the problem continues, return to ClearHire
            later.
          </p>
          <button onClick={() => window.location.reload()}>
            Reload ClearHire
          </button>
        </main>
      );
    return this.props.children;
  }
}
