import { useState } from 'react';
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

  const run = async (key: string, fn: () => void) => {
    setExporting(key);
    await new Promise(r => setTimeout(r, 80));
    fn();
    setTimeout(() => setExporting(null), 600);
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
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900 font-body font-medium text-[12px] px-3 py-2 rounded-xl transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 w-72 bg-white border border-gray-200 rounded-[16px] shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-heading text-[13px]" style={{ color: '#514163' }}>Export Data</p>
            </div>

            <div className="p-2">
              <p className="font-body text-[9px] uppercase tracking-wider text-gray-400 px-2 mb-1.5 mt-1">PDF Report</p>
              <button
                onClick={() => run('pdf', () => exportPdfReport(engine, athlete, sessions, nutritionLogs))}
                disabled={exporting === 'pdf'}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
              >
                <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-body text-[12px] font-medium text-gray-700">
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
                    onClick={() => run(key, fn)}
                    disabled={exporting === key}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
                  >
                    <div className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-green-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-[12px] font-medium text-gray-700">
                        {exporting === key ? 'Downloading...' : label}
                      </p>
                      <p className="font-body text-[10px] text-gray-400">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
