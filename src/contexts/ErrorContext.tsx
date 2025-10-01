import React, { createContext, useState, useContext, ReactNode } from 'react';

type ErrorRecord = {
  id: string;
  message: string;
  timestamp: Date;
  details?: any;
  source: 'UI' | 'API';
};

type ErrorContextType = {
  errors: ErrorRecord[];
  addError: (error: any, source: 'UI' | 'API') => void;
  clearErrors: () => void;
};

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider = ({ children }: { children: ReactNode }) => {
  const [errors, setErrors] = useState<ErrorRecord[]>([]);

  const addError = (error: any, source: 'UI' | 'API') => {
    console.error(`[${source} Error]`, error);
    const newError: ErrorRecord = {
      id: `err-${Date.now()}-${Math.random()}`,
      message: error.message || 'Ein unbekannter Fehler ist aufgetreten.',
      timestamp: new Date(),
      details: error.stack || error.data || error,
      source,
    };
    setErrors(prev => [newError, ...prev]);
  };

  const clearErrors = () => {
    setErrors([]);
  };

  return (
    <ErrorContext.Provider value={{ errors, addError, clearErrors }}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};