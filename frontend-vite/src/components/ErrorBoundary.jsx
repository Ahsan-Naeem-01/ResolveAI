import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production this would go to a logging service.
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "grid",
            placeItems: "center",
            height: "100vh",
            padding: 32,
          }}
        >
          <div
            className="card"
            style={{ maxWidth: 480, padding: 24, textAlign: "center" }}
          >
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              Something went wrong
            </div>
            <div className="muted small" style={{ marginBottom: 16 }}>
              {String(this.state.error.message || this.state.error)}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
