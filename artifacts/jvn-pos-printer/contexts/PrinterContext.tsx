import React, { createContext, useContext } from 'react';
import { useAutomaticOrderPrinter } from '@/hooks/useAutomaticOrderPrinter';

type PrinterContextType = ReturnType<typeof useAutomaticOrderPrinter>;

export const PrinterContext = createContext<PrinterContextType | null>(null);

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) throw new Error('usePrinter must be used within PrinterProvider');
  return context;
}

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const printerState = useAutomaticOrderPrinter();
  return (
    <PrinterContext.Provider value={printerState}>
      {children}
    </PrinterContext.Provider>
  );
}
