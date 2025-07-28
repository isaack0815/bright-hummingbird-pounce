import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useError } from '@/contexts/ErrorContext';

interface Props {
  children: ReactNode;
  addError: (error: any, source: 'UI' | 'API') => void;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  // This is a static method, so we can't use context here.
  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  // We'll get the context via a wrapper component.
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { addError } = this.props;
    addError({ message: error.message, stack: errorInfo.componentStack }, 'UI');
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            <h1 className="text-2xl font-bold text-destructive">Ein Fehler ist aufgetreten.</h1>
            <p className="text-muted-foreground mt-2">Bitte laden Sie die Seite neu oder überprüfen Sie die Fehlerkonsole.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to inject the context function into the class component
const ErrorBoundaryWithContext: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { addError } = useError();
  return <ErrorBoundary addError={addError}>{children}</ErrorBoundary>;
};

export default ErrorBoundaryWithContext;