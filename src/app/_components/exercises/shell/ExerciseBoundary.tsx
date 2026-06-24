"use client";
/* ExerciseBoundary — a React error boundary around the projected Display.
   The validator rejects malformed specs before the VM runs, but a render
   that throws (a bad expr the validator can't reach, a renderer bug) must
   not blank the whole page. We catch it, show the message inline, and
   auto-recover when `resetKey` changes (e.g. the playground edits the spec). */
import React from "react";

interface Props {
  /** Change this to clear a caught error — typically the current spec. */
  resetKey?: unknown;
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

export class ExerciseBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="exg-cp__log" style={{ color: "var(--rose-400)" }}>
          Display error: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
