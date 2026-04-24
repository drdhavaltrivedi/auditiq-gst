import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  BarChart3,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

// No longer needed for Audit logic since we moved to Vercel Functions
// const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface FlaggedTransaction {
  row: number;
  date: string;
  invoice_number: string;
  gstin: string;
  amount: number;
  gst_rate: number;
  gst_amount: number;
  vendor: string;
  issues: string[];
}

interface AuditResult {
  total: number;
  flagged_count: number;
  clean_count: number;
  flagged_transactions: FlaggedTransaction[];
  ai_explanation: string;
}

function IssueTag({ issue }: { issue: string }) {
  const color = issue.toLowerCase().includes("duplicate")
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : issue.toLowerCase().includes("missing") || issue.toLowerCase().includes("invalid gstin")
    ? "bg-red-100 text-red-800 border-red-200"
    : issue.toLowerCase().includes("rate")
    ? "bg-orange-100 text-orange-800 border-orange-200"
    : "bg-rose-100 text-rose-800 border-rose-200";

  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${color} leading-tight`}>
      {issue}
    </span>
  );
}

function AiExplanation({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(true);

  const lines = text.split("\n").filter(Boolean);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Sparkles size={16} className="text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">AI Compliance Analysis</p>
            <p className="text-xs text-gray-500">Powered by Google Gemini</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="mt-4 space-y-2">
            {lines.map((line, i) => {
              const isHeader = /^#{1,3}\s/.test(line) || /^\d+\.\s+\*\*/.test(line);
              const isBullet = /^[•\-\*]\s/.test(line);
              const cleaned = line
                .replace(/^#{1,3}\s+/, "")
                .replace(/\*\*(.*?)\*\*/g, "$1")
                .replace(/^[•\-\*]\s+/, "");

              if (isHeader) {
                return (
                  <p key={i} className="font-semibold text-gray-900 text-sm mt-4 first:mt-0">
                    {cleaned}
                  </p>
                );
              }
              if (isBullet) {
                return (
                  <div key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{cleaned}</span>
                  </div>
                );
              }
              return (
                <p key={i} className="text-sm text-gray-700 leading-relaxed">
                  {cleaned}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const valid = f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls");
    if (!valid) {
      setError("Please upload a CSV or Excel (.xlsx / .xls) file.");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const runAudit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const resp = await fetch("/api/audit", {
        method: "POST",
        body: form,
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error ?? "An unexpected error occurred.");
        return;
      }

      setResult(data);
    } catch (e) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const complianceRate = result
    ? Math.round((result.clean_count / result.total) * 100)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <BarChart3 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">AuditIQ</h1>
            <p className="text-xs text-gray-500 leading-none mt-0.5">GST Compliance Assistant</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-500">AI Ready</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto pb-2">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
            GST Transaction Audit
          </h2>
          <p className="mt-2 text-gray-500 text-sm leading-relaxed">
            Upload your transaction data and get instant rule-based GST validation with
            AI-generated compliance explanations.
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload size={15} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Upload Transaction Data</span>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragging
                ? "border-blue-400 bg-blue-50"
                : file
                ? "border-green-400 bg-green-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <FileSpreadsheet size={24} className="text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); setError(null); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors mt-1"
                >
                  <X size={12} /> Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <FileText size={24} className="text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Drop your file here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Supports CSV, XLSX, XLS — max 10MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Expected columns hint */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-gray-400">Expected columns:</span>
            {["Date", "Invoice Number", "GSTIN", "Amount", "GST Rate", "GST Amount", "Vendor"].map((col) => (
              <span key={col} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                {col}
              </span>
            ))}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <XCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={runAudit}
            disabled={!file || loading}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm py-3 rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyzing transactions…
              </>
            ) : (
              <>
                <BarChart3 size={16} />
                Run Audit
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Records</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{result.total}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Flagged</p>
                <p className={`text-3xl font-bold mt-1 ${result.flagged_count > 0 ? "text-red-600" : "text-gray-900"}`}>
                  {result.flagged_count}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Clean</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{result.clean_count}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Compliance Rate</p>
                <p className={`text-3xl font-bold mt-1 ${(complianceRate ?? 0) < 80 ? "text-amber-600" : "text-green-600"}`}>
                  {complianceRate}%
                </p>
              </div>
            </div>

            {/* Compliance Bar */}
            <div className="bg-white border border-gray-200 rounded-xl px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">Compliance Health</span>
                <span className="text-xs text-gray-500">{result.clean_count} of {result.total} records passed</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    (complianceRate ?? 0) >= 90 ? "bg-green-500" : (complianceRate ?? 0) >= 70 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${complianceRate}%` }}
                />
              </div>
            </div>

            {/* AI Explanation */}
            <AiExplanation text={result.ai_explanation} />

            {/* Flagged Transactions Table */}
            {result.flagged_count > 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <AlertTriangle size={15} className="text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Flagged Transactions</p>
                    <p className="text-xs text-gray-500">{result.flagged_count} records require attention</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Row</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">GSTIN</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">GST Rate</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">GST Amt</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {result.flagged_transactions.map((t) => (
                        <tr key={t.row} className="hover:bg-red-50/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.row}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{t.date || "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.invoice_number || "—"}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[140px] truncate">{t.vendor || "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.gstin || <span className="text-red-500">Missing</span>}</td>
                          <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">₹{t.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">{t.gst_rate}%</td>
                          <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">₹{t.gst_amount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {t.issues.map((issue, j) => (
                                <IssueTag key={j} issue={issue} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl px-6 py-10 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle size={24} className="text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">All Transactions Passed</p>
                  <p className="text-sm text-gray-500 mt-1">No compliance issues were detected in this dataset.</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Sample Data Helper */}
        {!result && !loading && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Validation Rules</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: "🔴", title: "Missing GSTIN", desc: "Transactions with no GSTIN or invalid format are flagged" },
                { icon: "🟠", title: "Invalid GST Rate", desc: "Only 5%, 12%, 18%, and 28% are valid under GST law" },
                { icon: "🔵", title: "Calculation Mismatch", desc: "GST Amount must equal Base Amount × GST Rate / 100" },
                { icon: "🟡", title: "Duplicate Invoice", desc: "Invoice numbers appearing more than once are flagged" },
              ].map((r) => (
                <div key={r.title} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg leading-none mt-0.5">{r.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-gray-200 py-6">
        <p className="text-center text-xs text-gray-400">
          AuditIQ — Rule-based GST validation powered by Google Gemini AI
        </p>
      </footer>
    </div>
  );
}
