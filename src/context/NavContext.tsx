import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type PageId =
  | 'dashboard'
  | 'compiler'
  | 'simulator'
  | 'tests'
  | 'conflicts'
  | 'versions'
  | 'approvals'
  | 'audit'
  | 'architecture';

interface NavContextValue {
  page: PageId;
  params: Record<string, string>;
  navigate: (page: PageId, params?: Record<string, string>) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageId>('dashboard');
  const [params, setParams] = useState<Record<string, string>>({});

  const navigate = useCallback((newPage: PageId, newParams: Record<string, string> = {}) => {
    setPage(newPage);
    setParams(newParams);
    window.scrollTo(0, 0);
  }, []);

  return (
    <NavContext.Provider value={{ page, params, navigate }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}

export type { PageId };
