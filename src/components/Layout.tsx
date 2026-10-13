import {
  LayoutDashboard,
  FileCode2,
  PlayCircle,
  TestTube2,
  AlertTriangle,
  GitCompareArrows,
  CheckCircle2,
  ScrollText,
  Building2,
  Shield,
  Moon,
  Sun,
  Menu,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNav, type PageId } from '@/context/NavContext';
import { useTheme } from '@/context/ThemeContext';
import { usePolicyContext } from '@/context/PolicyContext';
import { ROLES } from '@/lib/storage';

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: ReactNode; group: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, group: 'Overview' },
  { id: 'compiler', label: 'Policy Compiler', icon: <FileCode2 size={18} />, group: 'Authoring' },
  { id: 'simulator', label: 'Policy Simulator', icon: <PlayCircle size={18} />, group: 'Authoring' },
  { id: 'tests', label: 'Test Suite', icon: <TestTube2 size={18} />, group: 'Validation' },
  { id: 'conflicts', label: 'Conflict Detector', icon: <AlertTriangle size={18} />, group: 'Validation' },
  { id: 'versions', label: 'Versions & Diff', icon: <GitCompareArrows size={18} />, group: 'Governance' },
  { id: 'approvals', label: 'Approvals', icon: <CheckCircle2 size={18} />, group: 'Governance' },
  { id: 'audit', label: 'Audit Log', icon: <ScrollText size={18} />, group: 'Governance' },
  { id: 'architecture', label: 'Architecture', icon: <Building2 size={18} />, group: 'System' },
];

const GROUPS = ['Overview', 'Authoring', 'Validation', 'Governance', 'System'];

export function Layout({ children }: { children: ReactNode }) {
  const { page, navigate } = useNav();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, setCurrentUser, policies } = usePolicyContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activePolicies = policies.filter((p) => {
    const v = p.versions.find((vv) => vv.id === p.currentVersionId);
    return v?.status === 'active';
  }).length;

  const sidebar = (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-200 dark:border-slate-800 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-sm">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">PolicyForge</span>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 -mt-0.5 font-medium uppercase tracking-wider">Policy Control System</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {GROUPS.map((group) => (
          <div key={group}>
            <p className="px-3 text-[10px] font-semibold text-gray-400 dark:text-slate-600 uppercase tracking-wider mb-1.5">{group}</p>
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                <div
                  key={item.id}
                  className={`nav-item ${page === item.id ? 'nav-item-active' : 'nav-item-inactive'}`}
                  onClick={() => { navigate(item.id); setSidebarOpen(false); }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {currentUser.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <select
              className="w-full bg-transparent text-sm font-medium text-gray-700 dark:text-slate-300 focus:outline-none cursor-pointer truncate"
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value as typeof currentUser)}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">{activePolicies} active policies</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:block w-64 shrink-0">{sidebar}</aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 animate-slide-up">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} className="text-gray-600 dark:text-slate-300" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400 dark:text-slate-500">
              <Shield size={14} className="text-blue-500" />
              <span className="font-medium">{NAV_ITEMS.find((n) => n.id === page)?.label || 'Dashboard'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Engine Online
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-600 dark:text-slate-300"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
            {children}
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <button
          className="lg:hidden fixed top-4 right-4 z-[60] p-2 rounded-lg bg-white dark:bg-slate-900 shadow-lg"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={20} className="text-gray-600 dark:text-slate-300" />
        </button>
      )}
    </div>
  );
}
