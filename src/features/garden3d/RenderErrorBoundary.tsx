import { Component, type ReactNode } from 'react';

interface RenderErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: unknown) => void;
  resetKeys?: readonly unknown[];
}

interface RenderErrorBoundaryState {
  error: Error | null;
}

function resetKeysChanged(prev: readonly unknown[] = [], next: readonly unknown[] = []): boolean {
  if (prev.length !== next.length) return true;
  for (let index = 0; index < prev.length; index += 1) {
    if (!Object.is(prev[index], next[index])) return true;
  }
  return false;
}

export class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  state: RenderErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RenderErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: RenderErrorBoundaryProps) {
    if (this.state.error && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.handleReset);
    }

    return this.props.children;
  }
}