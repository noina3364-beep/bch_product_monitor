import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Sidebar } from './components/SidebarV2';
import { MonitoringTable } from './components/MonitoringTableV2';
import { Dashboard } from './components/Dashboard';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { ProductProvider, useProducts } from './context/ProductContextV2';
import type { BackupPayload } from './types';

const DashboardContent: React.FC = () => {
  const { activeProduct, dismissError, error, exportBackup, importBackup, isLoading } = useProducts();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImport, setPendingImport] = useState<{ filename: string; payload: BackupPayload } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const visibleError = error ?? localError;

  const handleExport = async () => {
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      anchor.href = url;
      anchor.download = `bch-product-monitor-backup-${timestamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setLocalError(exportError instanceof Error ? exportError.message : 'Export failed');
    }
  };

  const handleImportSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      setPendingImport({
        filename: file.name,
        payload: JSON.parse(content) as BackupPayload,
      });
      setLocalError(null);
    } catch (importError) {
      setLocalError(importError instanceof Error ? importError.message : 'Invalid backup file');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="min-h-16 shrink-0 border-b border-slate-200 bg-white px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <h2 className="max-w-[420px] text-xl font-bold leading-tight text-slate-900 break-words">
                {activeProduct?.name || 'Main Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportSelection}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Upload size={15} />
              Import Backup
            </button>
            <button
              onClick={() => void handleExport()}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Download size={15} />
              Export Backup
            </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {visibleError ? (
            <div className="px-8 pt-6">
              <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                <span>{visibleError}</span>
                <button
                  onClick={() => {
                    dismissError();
                    setLocalError(null);
                  }}
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

      <ConfirmationDialog
        isOpen={pendingImport !== null}
        title="Replace current data with this backup?"
        message={
          pendingImport
            ? `Import "${pendingImport.filename}" and replace the current products, funnels, channels, targets, and values?`
            : ''
        }
        confirmLabel="Import Backup"
        tone="primary"
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          if (!pendingImport) {
            return;
          }

          void importBackup(pendingImport.payload)
            .then(() => {
              setPendingImport(null);
              setLocalError(null);
            })
            .catch((importError) => {
              setLocalError(importError instanceof Error ? importError.message : 'Import failed');
              setPendingImport(null);
            });
        }}
      />
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
