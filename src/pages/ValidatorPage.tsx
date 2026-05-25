import { useState, useContext, useRef } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { RulesContext, FileType } from "../rulesContext";
import { validateData, ValidationError } from "../lib/validation";
import { performCrossCheck, ReferenceMap } from "../lib/crossCheck";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Trash2,
  ClipboardList,
  ShieldCheck,
  Database,
} from "lucide-react";

const fileTypesList: { label: string; value: FileType }[] = [
  { label: "Chart of Accounts", value: "coa" },
  { label: "Vendors", value: "vendors" },
  { label: "Invoices", value: "invoices" },
  { label: "Expense Transactions", value: "transactions" },
  { label: "Purchase Orders", value: "purchase_orders" },
  { label: "Budget", value: "budget" },
  { label: "FX Rates", value: "fx_rates" },
];

interface ResultState {
  total: number;
  errors: ValidationError[];
}

export function ValidatorPage() {
  const [mode, setMode] = useState<"unselected" | "single" | "full">(
    "unselected",
  );

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="bg-purple-50 text-[#4f3b8a] p-5 rounded-xl mb-8 shadow-sm border border-purple-200 flex justify-between items-center">
        <div>
          <h2 className="font-bold text-xl mb-2 flex items-center gap-2">
            <Database size={22} className="text-[#00d1c1]" /> Data Validation
            Hub
          </h2>
          <p className="text-sm opacity-90">
            Validate your data efficiently and securely.
          </p>
        </div>
        {mode !== "unselected" && (
          <button
            onClick={() => setMode("unselected")}
            className="text-sm bg-white border border-purple-200 px-3 py-1.5 rounded-lg font-medium hover:bg-purple-100 transition-colors"
          >
            Change Mode
          </button>
        )}
      </div>

      {mode === "unselected" && (
        <div className="grid md:grid-cols-2 gap-6 mt-12">
          <Card
            className="hover:border-[#00d1c1] cursor-pointer transition-all hover:shadow-md ring-2 ring-transparent hover:ring-cyan-50"
            onClick={() => setMode("single")}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 text-[#4f3b8a] rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet size={24} />
              </div>
              <CardTitle>Single File Validation</CardTitle>
              <CardDescription className="pt-2">
                Quickly validate a single CSV file against basic rules. No
                cross-checks between files will be performed. Freeform upload.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card
            className="hover:border-[#00d1c1] cursor-pointer transition-all hover:shadow-md ring-2 ring-transparent hover:ring-cyan-50"
            onClick={() => setMode("full")}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-cyan-100 text-[#00d1c1] rounded-full flex items-center justify-center mb-4">
                <ShieldCheck size={24} />
              </div>
              <CardTitle>Full Instance Validation</CardTitle>
              <CardDescription className="pt-2">
                Perform sequential validation with intelligent cross-checks.
                Upload all relevant instance data files step-by-step.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {mode === "single" && (
        <SingleValidationMode onBack={() => setMode("unselected")} />
      )}
      {mode === "full" && (
        <FullValidationMode onBack={() => setMode("unselected")} />
      )}
    </div>
  );
}

// Result Summary Component
function ResultsSummary({
  res,
  title,
  onClear,
}: {
  res: ResultState;
  title: string;
  onClear: () => void;
}) {
  const [filterType, setFilterType] = useState<
    "all" | "error" | "warning" | "crosscheck"
  >("all");
  const [filterKey, setFilterKey] = useState<string | null>(null);

  const errs = res.errors.filter((e) => e.type === "error" || !e.type);
  const warns = res.errors.filter((e) => e.type === "warning");
  const crossErrs = res.errors.filter((e) => e.isCrossCheck);

  const getSummary = () => {
    const counts: Record<
      string,
      { count: number; type: string; field: string; message: string }
    > = {};
    res.errors.forEach((e) => {
      const key = `${e.field}: ${e.message}`;
      if (!counts[key])
        counts[key] = {
          count: 0,
          type: e.type || "error",
          field: e.field,
          message: e.message,
        };
      counts[key].count++;
    });
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
  };

  const summaryItems = getSummary();
  const rowErrors = new Set(
    errs.filter((e) => typeof e.row === "number").map((e) => e.row),
  );
  const failedRowsCount = rowErrors.size;
  const headerErrors = errs.filter((e) => e.row === "Header");
  const hasHeaderError = headerErrors.length > 0;
  const isMajorMismatch = headerErrors.some((e) =>
    e.message.includes("MAJOR MISMATCH"),
  );
  const successRows = hasHeaderError ? 0 : res.total - failedRowsCount;
  const isSuccess = errs.length === 0;

  const getFilteredErrors = () => {
    let filtered = res.errors;
    if (filterKey)
      filtered = filtered.filter(
        (e) => `${e.field}: ${e.message}` === filterKey,
      );
    if (filterType === "all") return filtered;
    if (filterType === "crosscheck")
      return filtered.filter((e) => e.isCrossCheck);
    return filtered.filter(
      (e) =>
        (e.type || "error") === filterType &&
        (filterType !== "error" || !e.isCrossCheck),
    );
  };

  const exportCSV = () => {
    if (res.errors.length === 0) return alert("No errors to export.");
    const csvHeader =
      "Type,Row,Column Name,Value,Error Found,Solution Proposed\n";
    const csvContent = res.errors
      .map(
        (e) =>
          `"${e.type || (e.isCrossCheck ? "cross-check" : "error")}","${e.row}","${e.field}","${String(e.actualValue !== undefined ? e.actualValue : "").replace(/"/g, '""')}","${e.message.replace(/"/g, '""')}","${e.solution ? e.solution.replace(/"/g, '""') : ""}"`,
      )
      .join("\n");
    const blob = new Blob([csvHeader + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/\s+/g, "_")}_errors.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-6 border-t border-purple-100 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h3 className="font-bold text-lg flex items-center gap-2 text-[#4f3b8a]">
          {isSuccess ? (
            <CheckCircle className="text-green-500" />
          ) : (
            <AlertCircle className="text-red-500" />
          )}
          {title} Results
        </h3>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="bg-[#4CAF50] text-white rounded p-1.5 px-3 text-xs flex items-center gap-1 hover:bg-[#43a047] transition-colors"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={onClear}
            className="bg-red-50 text-red-600 rounded p-1.5 px-3 text-xs flex items-center gap-1 hover:bg-red-100 transition-colors"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 mb-4 text-sm bg-purple-50/30 p-4 rounded-lg border border-purple-100">
        <div className="flex flex-col">
          <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">
            Total Rows in File
          </span>
          <span className="text-2xl font-bold text-[#4f3b8a]">{res.total}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">
            {isMajorMismatch ? "Status" : "Successful"}
          </span>
          <span
            className={`text-2xl font-bold ${isMajorMismatch ? "text-red-500" : "text-green-600"}`}
          >
            {isMajorMismatch ? "BLOCKED" : successRows}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">
            {isMajorMismatch ? "Issue Type" : "Failed Rows"}
          </span>
          <span className="text-2xl font-bold text-red-600">
            {isMajorMismatch ? "FORMAT" : failedRowsCount}
          </span>
        </div>
      </div>

      {hasHeaderError && (
        <div
          className={`mb-6 p-5 border-l-4 rounded-r-lg ${isMajorMismatch ? "bg-red-600 text-white border-red-800 animate-pulse" : "bg-red-100 border-red-500 text-red-700"}`}
        >
          <div className="flex items-center gap-3 font-bold mb-2">
            <AlertCircle size={24} />
            <span className="text-lg">
              {isMajorMismatch
                ? "CRITICAL: WRONG FILE TYPE DETECTED"
                : "FILE HEADER ERROR"}
            </span>
          </div>
          <p
            className={`${isMajorMismatch ? "text-white/90" : "text-red-600"} text-sm font-medium`}
          >
            {isMajorMismatch
              ? "The uploaded file structure does not look like a valid data set for this category. Row-level validation was skipped for safety."
              : "The uploaded file is missing some required columns. Please check the summary below for details."}
          </p>
          {isMajorMismatch && (
            <div className="mt-4 pt-4 border-t border-white/20 text-xs italic">
              Expected column patterns for <strong>{title}</strong> were not
              found.
            </div>
          )}
        </div>
      )}

      {summaryItems.length > 0 && (
        <div className="mb-6 space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide px-1">
            Issue Summary
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summaryItems.map(([label, data], idx) => (
              <div
                key={idx}
                onClick={() => setFilterKey(filterKey === label ? null : label)}
                className={`p-2.5 rounded-lg border flex items-center justify-between text-sm cursor-pointer transition-all hover:shadow-sm ${filterKey === label ? "ring-2 ring-[#4f3b8a] ring-offset-1 font-bold" : ""} ${data.type === "warning" ? "bg-yellow-50 border-yellow-100 text-yellow-800" : "bg-red-50 border-red-100 text-red-800"}`}
              >
                <span className="font-medium truncate mr-2" title={label}>
                  {label.split(": ").slice(1).join(": ") || label}
                </span>
                <Badge
                  variant="outline"
                  className={`ml-auto font-bold border-current shrink-0 ${data.type === "warning" ? "bg-yellow-100" : "bg-red-100"}`}
                >
                  {data.count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.errors.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 pb-2">
            <button
              onClick={() => {
                setFilterType("all");
                setFilterKey(null);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === "all" && !filterKey ? "bg-[#4f3b8a] text-white shadow-sm" : "bg-purple-50 text-[#725bb4] hover:bg-purple-100"}`}
            >
              All ({res.errors.length})
            </button>
            <button
              onClick={() => {
                setFilterType("error");
                setFilterKey(null);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === "error" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
            >
              Errors ({errs.length - crossErrs.length})
            </button>
            {crossErrs.length > 0 && (
              <button
                onClick={() => {
                  setFilterType("crosscheck");
                  setFilterKey(null);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === "crosscheck" ? "bg-[#00d1c1] text-white" : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100"}`}
              >
                Cross-Check ({crossErrs.length})
              </button>
            )}
            {warns.length > 0 && (
              <button
                onClick={() => {
                  setFilterType("warning");
                  setFilterKey(null);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === "warning" ? "bg-yellow-500 text-white" : "bg-yellow-700/10 text-yellow-700 hover:bg-yellow-700/20"}`}
              >
                Warnings ({warns.length})
              </button>
            )}
            {filterKey && (
              <Badge
                variant="secondary"
                className="bg-[#4f3b8a] text-white border-none flex gap-1 items-center px-3 py-1 rounded-full text-[10px] animate-in fade-in duration-300"
              >
                FILTER: {filterKey.split(": ")[0]}
                <button
                  onClick={() => setFilterKey(null)}
                  className="ml-1 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <Trash2 size={10} />
                </button>
              </Badge>
            )}
          </div>

          <div className="border border-purple-100 rounded-lg shadow-sm overflow-hidden bg-white">
            <div className="max-h-[500px] overflow-y-auto relative">
              {(() => {
                const filtered = getFilteredErrors();

                if (filtered.length === 0)
                  return (
                    <div className="text-gray-500 italic p-6 text-center bg-gray-50">
                      No issues for this filter.
                    </div>
                  );

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-purple-50 text-[#4f3b8a] font-semibold uppercase tracking-wider z-10 border-b border-purple-200 shadow-xs">
                        <tr>
                          <th className="px-4 py-3 bg-purple-50 text-[#4f3b8a] font-semibold uppercase tracking-wider whitespace-nowrap">Row</th>
                          <th className="px-4 py-3 bg-purple-50 text-[#4f3b8a] font-semibold uppercase tracking-wider whitespace-nowrap">Column / Field</th>
                          <th className="px-4 py-3 bg-purple-50 text-[#4f3b8a] font-semibold uppercase tracking-wider whitespace-nowrap">Severity</th>
                          <th className="px-4 py-3 bg-purple-50 text-[#4f3b8a] font-semibold uppercase tracking-wider">Issue Found</th>
                          <th className="px-4 py-3 bg-purple-50 text-[#4f3b8a] font-semibold uppercase tracking-wider">Actual Value</th>
                          <th className="px-4 py-3 bg-purple-50 text-[#4f3b8a] font-semibold uppercase tracking-wider">Recommended Action / Solution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100">
                        {filtered.slice(0, 150).map((e, idx) => (
                          <tr
                            key={idx}
                            className="odd:bg-white even:bg-slate-50/50 hover:bg-purple-50/25 transition-colors animate-in fade-in duration-200"
                          >
                            <td className="px-4 py-3 font-semibold text-[#4f3b8a] whitespace-nowrap">
                              Row {e.row}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap font-mono text-[11px]">
                              {e.field}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {e.type === "warning" ? (
                                <Badge className="bg-yellow-105 text-yellow-800 shadow-none border-transparent text-[10px] uppercase">
                                  Warning
                                </Badge>
                              ) : e.isCrossCheck ? (
                                <Badge className="bg-[#00d1c1] text-white shadow-none border-transparent text-[10px] uppercase tracking-wider">
                                  Cross-Check
                                </Badge>
                              ) : (
                                <Badge className="bg-red-105 text-red-800 shadow-none border-transparent text-[10px] uppercase tracking-wider">
                                  Error
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700 min-w-[200px] leading-relaxed">
                              {e.message}
                            </td>
                            <td className="px-4 py-3 min-w-[120px]">
                              {e.actualValue !== undefined ? (
                                <span className="inline-block text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono border border-slate-200 truncate max-w-[200px]" title={String(e.actualValue)}>
                                  "{String(e.actualValue)}"
                                </span>
                              ) : (
                                <span className="text-gray-400 italic text-[11px]">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 min-w-[240px] leading-relaxed">
                              {e.solution ? (
                                <div className="text-green-700 text-xs bg-green-50 p-2 rounded border border-green-100 inline-flex items-start gap-1 shadow-2xs">
                                  <span className="shrink-0">💡</span>
                                  <span>{e.solution}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-[11px]">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            {getFilteredErrors().length > 150 && (
              <div className="text-center text-xs text-gray-500 p-3 bg-gray-50 rounded-b-lg border-t border-purple-50">
                Showing first 150 validation issues. Please export the CSV to see all errors.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Single Validation Mode
function SingleValidationMode({ onBack }: { onBack: () => void }) {
  const { rules } = useContext(RulesContext);
  const [fileType, setFileType] = useState<FileType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<ResultState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizeHeader = (rawHeader: string) => {
    let lower = rawHeader.trim().toLowerCase();
    const match = lower.match(/\((g_[a-z0-9_]+)\)/);
    if (match) return match[1];
    lower = lower.replace(/\s+/g, "_");
    if (!lower.startsWith("g_")) return "g_" + lower;
    return lower;
  };

  const parseCommonTransform = (value: any, field: string) => {
    if (
      field.toLowerCase() === "g_email" ||
      field.toLowerCase() === "g_cc_email"
    ) {
      return value
        ? value
            .toString()
            .replace(/^\ufeff/, "")
            .replace(/[^\x20-\x7E]/g, "")
            .trim()
        : value;
    }
    return value;
  };

  const handleFile = (uploadedFile: File) => {
    if (!fileType) return alert("Select a file type first.");
    setFile(uploadedFile);
    setIsProcessing(true);
    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      transform: parseCommonTransform,
      complete: (resultsParsed) => {
        setIsProcessing(false);
        const data = resultsParsed.data as any[];
        if (!data || data.length === 0)
          return alert("File is empty or could not be parsed.");
        const headers = resultsParsed.meta.fields || [];
        const standardErrors = validateData(
          fileType as FileType,
          data,
          headers,
          rules[fileType as FileType] || [],
        );
        // No cross checks in single mode
        setResults({ total: data.length, errors: standardErrors });
      },
      error: (error) => {
        setIsProcessing(false);
        alert("Error parsing CSV: " + error.message);
      },
    });
  };

  return (
    <Card className="mt-8 border-2 border-[#00d1c1] shadow-md ring-4 ring-cyan-50 animate-in fade-in duration-500">
      <CardHeader className="bg-white rounded-t-xl pb-4">
        <CardTitle className="text-lg text-[#001b44]">
          Single File Validation
        </CardTitle>
        <CardDescription>
          Validate a single file independently without cross-referencing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!results ? (
          <div className="grid md:grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-xl border border-gray-200">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Select File Type to Validate
              </label>
              <Select
                value={fileType}
                onValueChange={(val) => setFileType(val as FileType)}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {fileTypesList.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {ft.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Choose CSV File
              </label>
              <div className="relative h-10 w-full overflow-hidden rounded-md border border-input bg-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  disabled={!fileType || isProcessing}
                  onChange={(e) => {
                    if (e.target.files && fileType)
                      handleFile(e.target.files[0]);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                />
                <div
                  className={`flex h-full items-center px-3 text-sm flex-1 ${!fileType ? "text-gray-400 bg-gray-100" : "text-[#725bb4] font-medium bg-purple-50"}`}
                >
                  {!fileType
                    ? "Select a file type first"
                    : isProcessing
                      ? "Validating..."
                      : "Click to select CSV file..."}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#4f3b8a] hover:bg-[#3d2d6c] font-normal shadow-sm">
                  {fileTypesList.find((f) => f.value === fileType)?.label}
                </Badge>
                <span className="font-medium text-gray-700">{file?.name}</span>
              </div>
              <button
                onClick={() => {
                  setResults(null);
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="text-xs text-gray-500 hover:text-red-500 font-medium"
              >
                Use different file
              </button>
            </div>
            <ResultsSummary
              res={results}
              title={`${fileTypesList.find((f) => f.value === fileType)?.label} Validation`}
              onClear={() => {
                setResults(null);
                setFile(null);
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Full Validation Mode
type StepState = {
  status: "pending" | "skipped" | "completed";
  file?: File;
  results?: ResultState;
  map?: ReferenceMap;
};

function FullValidationMode({ onBack }: { onBack: () => void }) {
  const { rules } = useContext(RulesContext);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [states, setStates] = useState<Record<FileType, StepState>>({
    coa: { status: "pending" },
    vendors: { status: "pending" },
    invoices: { status: "pending" },
    transactions: { status: "pending" },
    purchase_orders: { status: "pending" },
    budget: { status: "pending" },
    fx_rates: { status: "pending" },
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const normalizeHeader = (rawHeader: string) => {
    let lower = rawHeader.trim().toLowerCase();
    const match = lower.match(/\((g_[a-z0-9_]+)\)/);
    if (match) return match[1];
    lower = lower.replace(/\s+/g, "_");
    if (!lower.startsWith("g_")) return "g_" + lower;
    return lower;
  };

  const parseCommonTransform = (value: any, field: string) => {
    if (
      field.toLowerCase() === "g_email" ||
      field.toLowerCase() === "g_cc_email"
    ) {
      return value
        ? value
            .toString()
            .replace(/^\ufeff/, "")
            .replace(/[^\x20-\x7E]/g, "")
            .trim()
        : value;
    }
    return value;
  };

  const handleFile = (uploadedFile: File, type: FileType) => {
    setIsProcessing(true);
    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      transform: parseCommonTransform,
      complete: (resultsParsed) => {
        setIsProcessing(false);
        const data = resultsParsed.data as any[];
        if (!data || data.length === 0)
          return alert("File is empty or could not be parsed.");
        const headers = resultsParsed.meta.fields || [];

        const coaMap = states.coa.map || {};
        const vendorMap = states.vendors.map || {};

        const standardErrors = validateData(
          type,
          data,
          headers,
          rules[type] || [],
        );
        const finalErrors = performCrossCheck(
          standardErrors,
          data,
          type,
          coaMap,
          vendorMap,
          rules[type] || [],
        );

        const map: ReferenceMap = {};
        if (type === "coa") {
          data.forEach((row) => {
            if (row.g_source_system_id) {
              if (!map[row.g_source_system_id])
                map[row.g_source_system_id] = [];
              map[row.g_source_system_id].push(row);
            }
          });
        } else if (type === "vendors") {
          data.forEach((row) => {
            if (row.g_source_system_id) map[row.g_source_system_id] = row;
          });
        }

        setStates((prev) => ({
          ...prev,
          [type]: {
            status: "completed",
            file: uploadedFile,
            results: { total: data.length, errors: finalErrors },
            map,
          },
        }));

        // Block progress if major mismatch in reference data
        const isMajorMismatch = finalErrors.some(e => e.row === "Header" && e.message.includes("MAJOR MISMATCH"));
        if ((type === "coa" || type === "vendors") && isMajorMismatch) {
            alert(`CRITICAL ERROR: This file does not match the expected format for ${type.toUpperCase()}. You MUST fix the headers or select the correct file to proceed as this data is used for cross-checking subsequent files.`);
            return;
        }

        if (currentStepIndex < fileTypesList.length - 1) {
          setCurrentStepIndex(currentStepIndex + 1);
        }
      },
      error: (error) => {
        setIsProcessing(false);
        alert("Error parsing CSV: " + error.message);
      },
    });
  };

  const skipStep = (type: FileType) => {
    setStates((prev) => ({
      ...prev,
      [type]: { status: "skipped" },
    }));
    if (currentStepIndex < fileTypesList.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const generateReport = () => {
    let lines = ["=== Gappify Integration Validation Report ==="];
    fileTypesList.forEach((ft) => {
      const state = states[ft.value];
      lines.push("");
      lines.push(`--- ${ft.label} ---`);
      if (state.status === "skipped") {
        lines.push("Status: Not Applicable / Skipped");
      } else if (state.status === "completed" && state.results) {
        lines.push(`Status: Evaluated ${state.results.total} records`);
        const errs = state.results.errors.filter(
          (e) => e.type === "error" || !e.type,
        );
        const warns = state.results.errors.filter((e) => e.type === "warning");
        lines.push(`Errors: ${errs.length} | Warnings: ${warns.length}`);

        if (errs.length > 0 || warns.length > 0) {
          lines.push(`Top Issues:`);
          const counts: Record<string, number> = {};
          state.results.errors.forEach((e) => {
            counts[e.message] = (counts[e.message] || 0) + 1;
          });
          const summary = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          summary.forEach((s) =>
            lines.push(`  - ${s[0]} (${s[1]} occurrences)`),
          );
        }
      } else {
        lines.push("Status: Pending");
      }
    });
    return lines.join("\n");
  };

  const generateConsolidatedCsv = () => {
    let allErrors: any[] = [];
    fileTypesList.forEach((ft) => {
      const state = states[ft.value];
      if (state.status === "completed" && state.results) {
        state.results.errors.forEach((e) => {
          allErrors.push({ ...e, sourceFile: ft.label });
        });
      }
    });

    if (allErrors.length === 0) return alert("No errors to export.");

    const csvHeader =
      "Source File,Type,Row,Column Name,Value,Error Found,Solution Proposed\n";
    const csvContent = allErrors
      .map(
        (e) =>
          `"${e.sourceFile}","${e.type || (e.isCrossCheck ? "cross-check" : "error")}","${e.row}","${e.field}","${String(e.actualValue !== undefined ? e.actualValue : "").replace(/"/g, '""')}","${e.message.replace(/"/g, '""')}","${e.solution ? e.solution.replace(/"/g, '""') : ""}"`,
      )
      .join("\n");

    const blob = new Blob([csvHeader + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `consolidated_validation_errors.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsPdf = async () => {
    const reportElement = document.getElementById("report-content");
    if (!reportElement) return;

    try {
      const canvas = await html2canvas(reportElement, {
        scale: 1.5,
        logging: false,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          // Remove all stylesheet content that might contain oklch
          const styles = clonedDoc.getElementsByTagName("style");
          for (let i = 0; i < styles.length; i++) {
              if (styles[i].innerHTML.includes("oklch")) {
                  styles[i].innerHTML = styles[i].innerHTML.replace(/oklch\([^)]+\)/g, "#000");
              }
          }
          
          // Fallback override style
          const style = clonedDoc.createElement("style");
          style.innerHTML = `
            * {
              color-scheme: light !important;
            }
            #report-content {
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
              width: 1000px !important;
              padding: 40px !important;
            }
            .no-pdf {
                display: none !important;
            }
          `;
          clonedDoc.head.appendChild(style);

          const clonedReport = clonedDoc.getElementById("report-content");
          if (clonedReport) {
            const allElements = clonedReport.getElementsByTagName("*");
            for (let i = 0; i < allElements.length; i++) {
              const el = allElements[i] as HTMLElement;
              const inlineStyle = el.getAttribute("style") || "";
              if (inlineStyle.includes("oklch")) {
                  const sanitized = inlineStyle.replace(/oklch\([^)]+\)/g, "#000");
                  el.setAttribute("style", sanitized);
              }
            }
          }
        },
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.75);
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
      pdf.save("Gappify_Integration_Report.pdf");
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };
  const generateHtmlReport = () => {
    let html = `<div style="font-family: sans-serif; max-width: 800px; line-height: 1.5; color: #1e293b;">`;
    html += `<h2 style="color: #4f3b8a; border-bottom: 2px solid #00d1c1; padding-bottom: 8px; margin-top: 0; margin-bottom: 20px;">Gappify Integration Validation Report</h2>`;
    fileTypesList.forEach((ft) => {
      const state = states[ft.value];
      const isSuccess =
        state.status === "completed" && state.results?.errors.length === 0;
      html += `<div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background-color: ${isSuccess ? "#f0fdf4" : state.status === "completed" ? "#fff" : "#f8fafc"}">`;
      html += `<h3 style="margin-top: 0; margin-bottom: 12px; color: #1e293b;">${ft.label}</h3>`;
      if (state.status === "skipped") {
        html += `<p style="margin: 0; color: #64748b;">Status: <strong>Not Applicable / Skipped</strong></p>`;
      } else if (state.status === "completed" && state.results) {
        html += `<p style="margin: 0 0 8px 0; color: #334155;">Status: <strong>Evaluated ${state.results.total} records</strong></p>`;
        const errs = state.results.errors.filter(
          (e) => e.type === "error" || !e.type,
        );
        const warns = state.results.errors.filter((e) => e.type === "warning");

        html += `<p style="margin: 0 0 12px 0;">`;
        if (errs.length === 0 && warns.length === 0) {
          html += `<span style="color: #16a34a; font-weight: bold;">✅ Perfect! No errors or warnings found.</span>`;
        } else {
          html += `<span style="color: #dc2626; font-weight: bold;">Errors: ${errs.length}</span> <span style="color: #94a3b8; margin: 0 8px;">|</span> <span style="color: #ca8a04; font-weight: bold;">Warnings: ${warns.length}</span>`;
        }
        html += `</p>`;

        if (errs.length > 0 || warns.length > 0) {
          html += `<h4 style="margin: 0 0 8px 0; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Top Issues:</h4>`;
          const counts: Record<string, number> = {};
          state.results.errors.forEach((e) => {
            counts[e.message] = (counts[e.message] || 0) + 1;
          });
          const summary = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

          html += `<ul style="margin: 0; padding-left: 20px; color: #475569;">`;
          summary.forEach((s) => {
            html += `<li style="margin-bottom: 4px;"><strong>${s[0]}</strong> <span style="color: #94a3b8;">(${s[1]} occurrences)</span></li>`;
          });
          html += `</ul>`;
        }
      } else {
        html += `<p style="margin: 0; color: #64748b;">Status: <strong>Pending</strong></p>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
    return html;
  };

  const copyToClipboard = async () => {
    const plainText = generateReport();
    const htmlContent = generateHtmlReport();

    try {
      const clipboardItem = new ClipboardItem({
        "text/plain": new Blob([plainText], { type: "text/plain" }),
        "text/html": new Blob([htmlContent], { type: "text/html" }),
      });
      await navigator.clipboard.write([clipboardItem]);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      // Fallback
      await navigator.clipboard.writeText(plainText);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  return (
    <div className="space-y-6 mt-8">
      <p className="text-gray-600 mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-100 flex items-center gap-2">
        <ShieldCheck size={20} className="text-yellow-600" />
        <span>
          In <strong>Full Instance Validation</strong> mode, files will be cross
          referenced with upstream data. Process each file or mark it as Not
          Applicable (N/A).
        </span>
      </p>

      {fileTypesList.map((ft, index) => {
        const type = ft.value;
        const state = states[type];
        const isActive = currentStepIndex === index;
        const isPast = index <= currentStepIndex && state.status !== "pending";

        if (!isActive && !isPast) return null;

        return (
          <Card
            key={type}
            className={`transition-all duration-300 border-2 ${isActive ? "border-[#00d1c1] shadow-md ring-4 ring-cyan-50" : "border-purple-100 shadow-sm opacity-80"} relative animate-in fade-in slide-in-from-bottom-2`}
          >
            {isActive && index > 0 && (
              <div className="absolute -top-7 left-10 w-0.5 h-6 bg-[#00d1c1] -z-10"></div>
            )}
            {isPast && index < fileTypesList.length - 1 && (
              <div className="absolute -bottom-7 left-10 w-0.5 h-6 bg-green-200 -z-10"></div>
            )}

            <CardHeader className="bg-white rounded-t-xl pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isActive ? "bg-[#00d1c1] text-[#001b44]" : state.status === "completed" && state.results?.errors.length === 0 ? "bg-green-100 text-green-600" : state.status === "skipped" ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-600"}`}
                >
                  {state.status === "completed" &&
                  state.results?.errors.length === 0 ? (
                    <CheckCircle size={16} />
                  ) : state.status === "skipped" ? (
                    "-"
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="flex-1 flex justify-between items-center pr-2">
                  <div>
                    <CardTitle className="text-lg text-[#001b44] flex items-center gap-2">
                      {ft.label}
                      {state.status === "skipped" && (
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-500 shadow-none font-normal"
                        >
                          Skipped
                        </Badge>
                      )}
                    </CardTitle>
                    {index > 0 && (
                      <CardDescription className="text-xs">
                        Checks against{" "}
                        {fileTypesList
                          .slice(0, index)
                          .filter((i) => states[i.value].status === "completed")
                          .map((i) => i.label)
                          .join(", ") || "no upstream items"}
                      </CardDescription>
                    )}
                  </div>
                  {isPast && state.status !== "pending" && (
                    <button
                      onClick={() => {
                        setStates((prev) => ({
                          ...prev,
                          [type]: { status: "pending" },
                        }));
                        setCurrentStepIndex(index);
                        setReportVisible(false);
                      }}
                      className="text-xs text-[#00d1c1] underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {state.status === "pending" && isActive && (
                <div className="bg-cyan-50/50 rounded-xl border border-dashed border-[#00d1c1] p-6 flex flex-col items-center justify-center text-center">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) =>
                          e.target.files && handleFile(e.target.files[0], type)
                        }
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isProcessing}
                      />
                      <button className="px-6 py-2 bg-[#00d1c1] hover:bg-[#00bdae] text-[#001b44] font-bold rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-[#00d1c1] focus:ring-offset-2 disabled:opacity-50 min-w-[200px]">
                        {isProcessing ? "Validating..." : `Upload ${ft.label}`}
                      </button>
                    </div>
                    <button
                      onClick={() => skipStep(type)}
                      className="px-6 py-2 bg-white hover:bg-gray-50 text-gray-700 font-medium border border-gray-300 rounded-lg shadow-sm transition-all"
                    >
                      Not Applicable
                    </button>
                  </div>
                </div>
              )}
              {state.status === "completed" && state.results && (
                <div>
                  <div className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded-lg border border-gray-200 mb-2">
                    <span className="font-medium text-gray-700 truncate max-w-[250px]">
                      {state.file?.name}
                    </span>
                  </div>
                  <ResultsSummary
                    res={state.results}
                    title={`${ft.label} Validation`}
                    onClear={() => {
                      setStates((prev) => ({
                        ...prev,
                        [type]: { status: "pending" },
                      }));
                      setCurrentStepIndex(index);
                      setReportVisible(false);
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {(currentStepIndex === fileTypesList.length - 1 &&
        states[fileTypesList[fileTypesList.length - 1].value].status !==
          "pending") ||
      currentStepIndex >= fileTypesList.length
        ? !reportVisible && (
            <div className="flex justify-center mt-12 mb-8 items-center flex-col animate-in fade-in duration-500">
              <h3 className="text-[#4f3b8a] text-xl font-bold mb-4">
                All validations complete!
              </h3>
              <button
                onClick={() => setReportVisible(true)}
                className="flex items-center gap-2 bg-[#4f3b8a] hover:bg-[#3d2d6c] text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg transition-transform hover:scale-105"
              >
                <ClipboardList size={24} />
                Create Integration Report
              </button>
            </div>
          )
        : null}

      {reportVisible && (
        <Card className="mt-8 border-2 border-[#4f3b8a] shadow-xl animate-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="bg-[#4f3b8a] text-white rounded-t-lg">
            <CardTitle className="text-xl flex items-center gap-2 text-white">
              <ClipboardList size={22} /> Integration Report
            </CardTitle>
            <CardDescription className="text-purple-200">
              Copy and paste this report into an email to share with the
              customer.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 mb-6">
                <button
                    onClick={exportAsPdf}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors"
                >
                    <Download size={16} /> Export as PDF
                </button>
                <button
                    onClick={generateConsolidatedCsv}
                    className="flex items-center gap-2 bg-[#4CAF50] hover:bg-[#43a047] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors"
                >
                    <FileSpreadsheet size={16} /> Export Detailed Errors (CSV)
                </button>
                <button
                    onClick={copyToClipboard}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all ${copyFeedback ? "bg-green-500 text-white" : "bg-[#00d1c1] text-[#001b44] hover:bg-[#00bdae]"}`}
                >
                    {copyFeedback ? (
                        <>
                            <CheckCircle size={16} /> Copied!
                        </>
                    ) : (
                        <>
                            <ClipboardList size={16} /> Copy to Clipboard
                        </>
                    )}
                </button>
            </div>

            <div className="relative">
              <div
                id="report-content"
                style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    width: "100%",
                    height: "24rem", // equivalent to h-96
                    padding: "2rem", // equivalent to p-8
                    outline: "none",
                    overflowY: "auto"
                }}
                dangerouslySetInnerHTML={{ __html: generateHtmlReport() }}
              />
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => {
                  onBack();
                  setReportVisible(false);
                  setCurrentStepIndex(0);
                  setStates({
                    coa: { status: "pending" },
                    vendors: { status: "pending" },
                    invoices: { status: "pending" },
                    transactions: { status: "pending" },
                    purchase_orders: { status: "pending" },
                    budget: { status: "pending" },
                    fx_rates: { status: "pending" },
                  });
                }}
                className="text-[#4f3b8a] hover:underline font-medium"
              >
                Start New Validation
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
