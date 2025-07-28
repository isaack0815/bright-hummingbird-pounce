import React, { Component, ErrorInfo, ReactNode, PropsWithChildren } from 'react';
import { useError } from '@/contexts/ErrorContext';

interface CustomProps {
  addError: (error: any, source: 'UI' | 'API') => void;
}

type Props = PropsWithChildren<CustomProps>;

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

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

const ErrorBoundaryWithContext: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { addError } = useError();
  return <ErrorBoundary addError={addError}>{children}</ErrorBoundary>;
};

export default ErrorBoundaryWithContext;