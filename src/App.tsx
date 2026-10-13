import { ThemeProvider } from '@/context/ThemeContext';
import { PolicyProvider } from '@/context/PolicyContext';
import { NavProvider, useNav } from '@/context/NavContext';
import { Layout } from '@/components/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { CompilerPage } from '@/pages/CompilerPage';
import { SimulatorPage } from '@/pages/SimulatorPage';
import { TestSuitePage } from '@/pages/TestSuitePage';
import { ConflictDetectorPage } from '@/pages/ConflictDetectorPage';
import { VersionsPage } from '@/pages/VersionsPage';
import { ApprovalsPage } from '@/pages/ApprovalsPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { ArchitecturePage } from '@/pages/ArchitecturePage';

function PageRouter() {
  const { page } = useNav();

  switch (page) {
    case 'dashboard':
      return <DashboardPage />;
    case 'compiler':
      return <CompilerPage />;
    case 'simulator':
      return <SimulatorPage />;
    case 'tests':
      return <TestSuitePage />;
    case 'conflicts':
      return <ConflictDetectorPage />;
    case 'versions':
      return <VersionsPage />;
    case 'approvals':
      return <ApprovalsPage />;
    case 'audit':
      return <AuditLogPage />;
    case 'architecture':
      return <ArchitecturePage />;
    default:
      return <DashboardPage />;
  }
}

function App() {
  return (
    <ThemeProvider>
      <PolicyProvider>
        <NavProvider>
          <Layout>
            <PageRouter />
          </Layout>
        </NavProvider>
      </PolicyProvider>
    </ThemeProvider>
  );
}

export default App;
