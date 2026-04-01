import React from 'react';
import { Sidebar } from './components/Sidebar';
import { MonitoringTable } from './components/MonitoringTable';
import { Dashboard } from './components/Dashboard';
import { ProductProvider, useProducts } from './context/ProductContext';

const DashboardContent: React.FC = () => {
  const { activeProduct, dismissError, error, isLoading } = useProducts();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900 truncate max-w-[300px]">
              {activeProduct?.name || 'Main Dashboard'}
            </h2>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {error ? (
            <div className="px-8 pt-6">
              <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                <span>{error}</span>
                <button
                  onClick={dismissError}
                  className="rounded-md border border-red-200 bg-white px-3 py-1 font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center bg-slate-50 px-8">
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-semibold text-slate-500 shadow-sm">
                Loading BCH Product Monitor data...
              </div>
            </div>
          ) : activeProduct ? (
            <MonitoringTable />
          ) : (
            <Dashboard />
          )}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <ProductProvider>
      <DashboardContent />
    </ProductProvider>
  );
}
