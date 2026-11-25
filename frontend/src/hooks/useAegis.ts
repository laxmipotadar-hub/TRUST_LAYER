import { useContext } from 'react';
import { AppContext, type AppContextValue } from '../context/AppContext';

export function useAegis(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAegis must be used inside AppProvider');
  }
  return ctx;
}
