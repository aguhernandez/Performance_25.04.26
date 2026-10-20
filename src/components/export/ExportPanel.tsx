import { useEffect, useRef, useState } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import type { EngineOutput } from '../../lib/engine/types';
import type { Athlete, Session, NutritionLog } from '../../lib/database.types';
import {
  exportBannisterHistory,
  exportCompartmentHistory,
  exportSessions,
  exportNutrition,
  exportFullReport,
  exportTrainingPeaksCsv,
  exportMonthlySummary,
} from '../../lib/export/csvExport';
import { exportPdfReport } from '../../lib/export/pdfReport';

interface ExportPanelProps {
  engine: EngineOutput;
  athlete: Athlete;
  sessions: Session[];
  nutritionLogs: NutritionLog[];
}

export function ExportPanel({ engine, athlete, sessions, nutritionLogs }: ExportPanelProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const run = (key: string, fn: () => void) => {
    setExporting(key);
    setOpen(false);
    try {
      // Run in the click handler so browsers allow the PDF popup/download.
      fn();
    } finally {
      window.setTimeout(() => setExporting(null), 600);
    }
  };

  const csvActions = [
    {
      key: 'csv_full',
      label: 'Full CSV Report',
      desc: 'Bannister + Compartments + Sessions',
      fn: () => exportFullReport(engine, sessions, athlete.name),
    },
    {
      key: 'csv_bannister',
      label: 'Bannister History',
      desc: 'Daily fitness / fatigue / form',
      fn: () => exportBannisterHistory(engine.history, athlete.name),
    },
    {
      key: 'csv_compartments',
      label: 'Compartment History',
      desc: 'Aerobic / Glycolytic / Neuromuscular',
      fn: () => exportCompartmentHistory(engine.compartmentHistory, athlete.name),
    },
    {
      key: 'csv_sessions',
      label: 'Sessions',
      desc: `${sessions.length} training sessions`,
      fn: () => exportSessions(sessions, athlete.name),
    },
    {
      key: 'csv_nutrition',
      label: 'Nutrition Logs',
      desc: `${nutritionLogs.length} daily logs`,
      fn: () => exportNutrition(nutritionLogs, athlete.name),
    },
    {
      key: 'csv_tp',
      label: 'TrainingPeaks Format',
      desc: 'Compatible with TrainingPeaks import',
      fn: () => exportTrainingPeaksCsv(sessions, athlete.name),
    },
    {
      key: 'csv_monthly',
      label: 'Monthly Summary',
      desc: 'Aggregated by calendar month',
      fn: () => exportMonthlySummary(sessions, athlete.name),
    },
  ];

  return (
    <div ref={rootRef} className={`relative ${open ? 'z-30' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white font-body font-medium text-[12px] px-3 py-2 rounded-xl transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 z-20 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-[16px] shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <p className="font-heading text-[13px]" style={{ color: '#2A1F4A' }}>Export Data</p>
            </div>

            <div className="p-2">
              <p className="font-body text-[9px] uppercase tracking-wider text-gray-400 px-2 mb-1.5 mt-1">PDF Report</p>
              <button
                type="button"
                role="menuitem"
                onClick={() => run('pdf', () => exportPdfReport(engine, athlete, sessions, nutritionLogs))}
                disabled={exporting === 'pdf'}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:bg-gray-800 transition-colors text-left disabled:opacity-60"
              >
                <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-body text-[12px] font-medium text-gray-700 dark:text-gray-200">
                    {exporting === 'pdf' ? 'Opening...' : 'Performance Report PDF'}
                  </p>
                  <p className="font-body text-[10px] text-gray-400">Full summary with charts & tables</p>
                </div>
              </button>

              <p className="font-body text-[9px] uppercase tracking-wider text-gray-400 px-2 mb-1.5 mt-3">CSV / Spreadsheet</p>
              <div className="space-y-0.5">
                {csvActions.map(({ key, label, desc, fn }) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    onClick={() => run(key, fn)}
                    disabled={exporting === key}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:bg-gray-800 transition-colors text-left disabled:opacity-60"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 border border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#2A1F4A] dark:text-[#B8A9E5]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-[12px] font-medium text-gray-700 dark:text-gray-200">
                        {exporting === key ? 'Downloading...' : label}
                      </p>
                      <p className="font-body text-[10px] text-gray-400">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
