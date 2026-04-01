import React from 'react';
import { Sidebar } from './components/Sidebar';
import { MonitoringTable } from './components/MonitoringTable';
import { Dashboard } from './components/Dashboard';
import { ProductProvider, useProducts } from './context/ProductContext';
import { Search } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { activeProduct } = useProducts();

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
          {activeProduct ? (
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
