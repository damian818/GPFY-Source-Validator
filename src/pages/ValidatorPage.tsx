import { useState, useContext, useRef } from "react";
import Papa from "papaparse";
import { RulesContext, FileType } from "../rulesContext";
import { validateData, ValidationError } from "../lib/validation";
import { performCrossCheck, ReferenceMap } from "../lib/crossCheck";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { CheckCircle, AlertCircle, FileUp, Database, FileSpreadsheet, Copy, Download, Trash2, ArrowRight } from "lucide-react";

const otherFileTypes: { label: string; value: FileType }[] = [
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
  const { rules } = useContext(RulesContext);

  const [step, setStep] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // COA State
  const [coaFile, setCoaFile] = useState<File | null>(null);
  const [coaResults, setCoaResults] = useState<ResultState | null>(null);
  const [coaMap, setCoaMap] = useState<ReferenceMap>({});

  // Vendor State
  const [vendorFile, setVendorFile] = useState<File | null>(null);
  const [vendorResults, setVendorResults] = useState<ResultState | null>(null);
  const [vendorMap, setVendorMap] = useState<ReferenceMap>({});

  // Other Files State
  const [otherFileType, setOtherFileType] = useState<FileType | "">("");
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [otherResults, setOtherResults] = useState<ResultState | null>(null);

  // File Input Refs for resetting
  const coaInputRef = useRef<HTMLInputElement>(null);
  const vendorInputRef = useRef<HTMLInputElement>(null);
  const otherInputRef = useRef<HTMLInputElement>(null);

  const parseCommonTransform = (value: any, field: string) => {
    if (field.toLowerCase() === "g_email" || field.toLowerCase() === "g_cc_email") {
      return value ? value.toString().replace(/^\ufeff/, "").replace(/[^\x20-\x7E]/g, "").trim() : value;
    }
    return value;
  };

  const normalizeHeader = (rawHeader: string) => {
    let lower = rawHeader.trim().toLowerCase();
    
    const match = lower.match(/\((g_[a-z0-9_]+)\)/);
    if (match) return match[1];
    
    lower = lower.replace(/\s+/g, '_');

    if (!lower.startsWith("g_")) {
      return "g_" + lower;
    }
    
    return lower;
  };

  const handleCOAFile = (file: File) => {
    setCoaFile(file);
    setIsProcessing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      transform: parseCommonTransform,
      complete: (resultsParsed) => {
        setIsProcessing(false);
        const data = resultsParsed.data as any[];
        if (!data || data.length === 0) return alert("COA file is empty or could not be parsed.");

        const headers = resultsParsed.meta.fields || [];
        const standardErrors = validateData("coa", data, headers, rules["coa"] || []);

        const map: ReferenceMap = {};
        data.forEach((row) => {
          if (row.g_source_system_id) {
            if (!map[row.g_source_system_id]) {
               map[row.g_source_system_id] = [];
            }
            map[row.g_source_system_id].push(row);
          }
        });
        
        setCoaMap(map);
        setCoaResults({ total: data.length, errors: standardErrors });
        if (step < 2) setStep(2);
      },
      error: (error) => {
        setIsProcessing(false);
        alert("Error parsing COA CSV: " + error.message);
      },
    });
  };

  const handleVendorFile = (file: File) => {
    setVendorFile(file);
    setIsProcessing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      transform: parseCommonTransform,
      complete: (resultsParsed) => {
        setIsProcessing(false);
        const data = resultsParsed.data as any[];
        if (!data || data.length === 0) return alert("Vendor file is empty or could not be parsed.");

        const headers = resultsParsed.meta.fields || [];
        const standardErrors = validateData("vendors", data, headers, rules["vendors"] || []);
        
        const finalErrors = performCrossCheck(standardErrors, data, "vendors", coaMap, {}, rules["vendors"] || []);

        const map: ReferenceMap = {};
        data.forEach((row) => {
          if (row.g_source_system_id) map[row.g_source_system_id] = row;
        });

        setVendorMap(map);
        setVendorResults({ total: data.length, errors: finalErrors });
        if (step < 3) setStep(3);
      },
      error: (error) => {
        setIsProcessing(false);
        alert("Error parsing Vendor CSV: " + error.message);
      },
    });
  };

  const handleOtherFile = (file: File, type: FileType) => {
    setOtherFile(file);
    setIsProcessing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      transform: parseCommonTransform,
      complete: (resultsParsed) => {
        setIsProcessing(false);
        const data = resultsParsed.data as any[];
        if (!data || data.length === 0) return alert("File is empty or could not be parsed.");

        const headers = resultsParsed.meta.fields || [];
        const standardErrors = validateData(type, data, headers, rules[type] || []);
        
        const finalErrors = performCrossCheck(standardErrors, data, type, coaMap, vendorMap, rules[type] || []);

        setOtherResults({ total: data.length, errors: finalErrors });
      },
      error: (error) => {
        setIsProcessing(false);
        alert("Error parsing CSV: " + error.message);
      },
    });
  };

  const clearCOA = () => {
    setCoaFile(null);
    setCoaResults(null);
    setCoaMap({});
    if (coaInputRef.current) coaInputRef.current.value = "";
    // Cascade clear
    clearVendor();
    setStep(1);
  };

  const clearVendor = () => {
    setVendorFile(null);
    setVendorResults(null);
    setVendorMap({});
    if (vendorInputRef.current) vendorInputRef.current.value = "";
    // Cascade clear
    clearOther();
    if (step > 2) setStep(2);
  };

  const clearOther = () => {
    setOtherFile(null);
    setOtherResults(null);
    if (otherInputRef.current) otherInputRef.current.value = "";
  };

  const exportCSV = (errors: ValidationError[], filename: string) => {
    if (errors.length === 0) return alert("No errors to export.");
    const csvHeader = "Type,Row,Column Name,Value,Error Found,Solution Proposed\\n";
    const csvContent = errors.map(e => `"${e.type || (e.isCrossCheck ? 'cross-check' : 'error')}","${e.row}","${e.field}","${String(e.actualValue !== undefined ? e.actualValue : '').replace(/"/g, '""')}","${e.message.replace(/"/g, '""')}","${e.solution ? e.solution.replace(/"/g, '""') : ''}"`).join("\\n");
    
    const blob = new Blob([csvHeader + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const ResultsSummary = ({ res, title, onClear }: { res: ResultState; title: string; onClear: () => void; }) => {
    const [filterType, setFilterType] = useState<"all" | "error" | "warning" | "crosscheck">("all");
    const [filterKey, setFilterKey] = useState<string | null>(null);

    const errs = res.errors.filter(e => e.type === "error" || !e.type);
    const warns = res.errors.filter(e => e.type === "warning");
    const crossErrs = res.errors.filter(e => e.isCrossCheck);
    
    // Group issues for summary
    const getSummary = () => {
      const counts: Record<string, { count: number; type: string; field: string; message: string }> = {};
      res.errors.forEach(e => {
        const key = `${e.field}: ${e.message}`;
        if (!counts[key]) counts[key] = { count: 0, type: e.type || 'error', field: e.field, message: e.message };
        counts[key].count++;
      });
      return Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
    };

    const summaryItems = getSummary();
    
    const rowErrors = new Set(errs.map(e => e.row));
    const failedRows = rowErrors.size;
    const successRows = res.total - failedRows;
    const isSuccess = errs.length === 0;

    const getFilteredErrors = () => {
      let filtered = res.errors;

      if (filterKey) {
        filtered = filtered.filter(e => `${e.field}: ${e.message}` === filterKey);
      }

      if (filterType === "all") return filtered;
      if (filterType === "crosscheck") return filtered.filter(e => e.isCrossCheck);
      return filtered.filter(e => (e.type || 'error') === filterType && (filterType !== 'error' || !e.isCrossCheck));
    };

    return (
      <div className="mt-6 border-t border-purple-100 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2 text-[#4f3b8a]">
            {isSuccess ? <CheckCircle className="text-green-500" /> : <AlertCircle className="text-red-500" />}
            {title} Results
          </h3>
          <div className="flex gap-2">
            <button onClick={() => exportCSV(res.errors, `${title.replace(/\s+/g, "_")}_errors.csv`)} className="bg-[#4CAF50] text-white rounded p-1.5 px-3 text-xs flex items-center gap-1 hover:bg-[#43a047] transition-colors"><Download size={14}/> Export</button>
            <button onClick={onClear} className="bg-red-50 text-red-600 rounded p-1.5 px-3 text-xs flex items-center gap-1 hover:bg-red-100 transition-colors"><Trash2 size={14}/> Clear</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 mb-4 text-sm bg-purple-50/30 p-4 rounded-lg">
          <div className="flex flex-col">
            <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">Total Rows</span>
            <span className="text-2xl font-bold text-[#4f3b8a]">{res.total}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">Successful</span>
            <span className="text-2xl font-bold text-green-600">{successRows}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">Failed</span>
            <span className="text-2xl font-bold text-red-600">{failedRows}</span>
          </div>
        </div>

        {summaryItems.length > 0 && (
          <div className="mb-6 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide px-1">Issue Summary</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {summaryItems.map(([label, data], idx) => (
                <div 
                  key={idx} 
                  onClick={() => setFilterKey(filterKey === label ? null : label)}
                  className={`p-2.5 rounded-lg border flex items-center justify-between text-sm cursor-pointer transition-all hover:shadow-sm ${filterKey === label ? 'ring-2 ring-[#4f3b8a] ring-offset-1 font-bold' : ''} ${data.type === 'warning' ? 'bg-yellow-50 border-yellow-100 text-yellow-800' : 'bg-red-50 border-red-100 text-red-800'}`}
                >
                  <span className="font-medium truncate mr-2" title={label}>{label}</span>
                  <Badge variant="outline" className={`ml-auto font-bold border-current ${data.type === 'warning' ? 'bg-yellow-100' : 'bg-red-100'}`}>
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
              <button onClick={() => { setFilterType("all"); setFilterKey(null); }} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === 'all' && !filterKey ? 'bg-[#4f3b8a] text-white shadow-sm' : 'bg-purple-50 text-[#725bb4] hover:bg-purple-100'}`}>All ({res.errors.length})</button>
              <button onClick={() => { setFilterType("error"); setFilterKey(null); }} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === 'error' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>Errors ({errs.length - crossErrs.length})</button>
              {(crossErrs.length > 0) && <button onClick={() => { setFilterType("crosscheck"); setFilterKey(null); }} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === 'crosscheck' ? 'bg-[#00d1c1] text-white' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}>Cross-Check ({crossErrs.length})</button>}
              {(warns.length > 0) && <button onClick={() => { setFilterType("warning"); setFilterKey(null); }} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterType === 'warning' ? 'bg-yellow-500 text-white' : 'bg-yellow-700/10 text-yellow-700 hover:bg-yellow-700/20'}`}>Warnings ({warns.length})</button>}
              {filterKey && (
                <Badge variant="secondary" className="bg-[#4f3b8a] text-white border-none flex gap-1 items-center px-3 py-1 rounded-full text-[10px] animate-in fade-in duration-300">
                  FILTER: {filterKey.split(': ')[0]}
                  <button onClick={() => setFilterKey(null)} className="ml-1 hover:text-red-300 transition-colors cursor-pointer"><Trash2 size={10} /></button>
                </Badge>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto pr-2 space-y-3">
              {(() => {
                const filtered = getFilteredErrors();
                const byRow: Record<string, ValidationError[]> = {};
                filtered.forEach(e => {
                  const key = String(e.row);
                  if (!byRow[key]) byRow[key] = [];
                  byRow[key].push(e);
                });

                if (filtered.length === 0) return <div className="text-gray-500 italic p-4 text-center border rounded-lg bg-gray-50">No issues for this filter.</div>;

                return Object.entries(byRow).slice(0, 50).map(([r, errGrp]) => (
                  <div key={r} className="bg-white border border-purple-100 rounded-lg p-3 shadow-sm">
                    <div className="font-bold text-[#4f3b8a] border-b border-purple-50 pb-2 mb-2 flex items-center justify-between text-sm">
                      <span>Row {r}</span>
                      <span className="text-xs font-normal text-gray-400">{errGrp.length} issue(s)</span>
                    </div>
                    <ul className="space-y-2">
                      {errGrp.map((e, idx) => (
                        <li key={idx} className="flex gap-2 text-sm items-start">
                          <div className="mt-0.5">
                            {e.type === 'warning' ? <Badge className="bg-yellow-100 text-yellow-800 shadow-none border-transparent text-[10px] uppercase">Warning</Badge>
                              : e.isCrossCheck ? <Badge className="bg-[#00d1c1] text-white shadow-none border-transparent text-[10px] uppercase tracking-wider">Cross-Check</Badge>
                              : <Badge className="bg-red-100 text-red-800 shadow-none border-transparent text-[10px] uppercase tracking-wider">Error</Badge>}
                          </div>
                          <div className="flex-1 leading-tight">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="font-semibold text-gray-700">'{e.field}':</span>
                              <span className="text-gray-600">{e.message}</span>
                              {e.actualValue !== undefined && (
                                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                   Value: "{String(e.actualValue)}"
                                </span>
                              )}
                            </div>
                            {e.solution && <div className="text-green-700 mt-1 text-xs bg-green-50 p-1.5 rounded inline-block w-full border border-green-100 break-words">💡 {e.solution}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ));
              })()}
              {getFilteredErrors().length > 50 && (
                <div className="text-center text-xs text-gray-500 p-2 bg-gray-50 rounded-lg border border-gray-100">Showing first 50 rows. Export to see all issues.</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="bg-purple-50 text-[#4f3b8a] p-5 rounded-xl mb-8 shadow-sm border border-purple-200">
        <h2 className="font-bold text-xl mb-2 flex items-center gap-2"><Database size={22} className="text-[#00d1c1]" /> Data Validation Hub</h2>
        <p className="text-sm opacity-90">Follow the sequential flow to validate your data. The engine automatically cross-checks dependencies downstream. Start with your Chart of Accounts.</p>
      </div>

      <div className="space-y-6 relative">
        {/* Step 1: COA */}
        <Card className={`transition-all duration-300 border-2 ${step === 1 ? 'border-[#00d1c1] shadow-md ring-4 ring-cyan-50' : 'border-purple-100 shadow-sm'}`}>
          <CardHeader className="bg-white rounded-t-xl pb-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === 1 ? 'bg-[#00d1c1] text-[#001b44]' : (coaResults && coaResults.errors.length === 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500')}`}>
                {coaResults && coaResults.errors.length === 0 ? <CheckCircle size={16} /> : "1"}
              </div>
              <div>
                <CardTitle className="text-lg text-[#001b44]">Chart of Accounts (COA)</CardTitle>
                <CardDescription>Master dataset for validation mapping</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!coaResults ? (
              <div className="bg-cyan-50/50 rounded-xl border border-dashed border-[#00d1c1] p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-white text-[#00d1c1] rounded-full flex items-center justify-center mb-3 shadow-sm">
                  <FileSpreadsheet size={24} />
                </div>
                <h3 className="text-base font-bold text-[#001b44]">Upload COA File</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">Upload your COA CSV to establish the baseline rules.</p>
                <div className="relative">
                  <input
                    ref={coaInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => e.target.files && handleCOAFile(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isProcessing}
                  />
                  <button className="px-6 py-2 bg-[#00d1c1] hover:bg-[#00bdae] text-[#001b44] font-bold rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-[#00d1c1] focus:ring-offset-2 disabled:opacity-50">
                    {isProcessing ? "Validating..." : "Select File"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-gray-500" />
                    <span className="font-medium text-gray-700">{coaFile?.name}</span>
                  </div>
                  <button onClick={clearCOA} className="text-xs text-gray-500 hover:text-red-500 font-medium">Use different file</button>
                </div>
                <ResultsSummary res={coaResults} title="COA Validation" onClear={clearCOA} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Vendors */}
        <Card className={`transition-all duration-300 border-2 ${step === 2 ? 'border-[#00d1c1] shadow-md ring-4 ring-cyan-50' : 'border-purple-100 shadow-sm'} ${step < 2 ? 'opacity-60 grayscale-[50%]' : ''}`}>
          <div className="absolute -top-3 left-10 w-0.5 h-6 bg-gray-300 -z-10"></div>
          <CardHeader className="bg-white rounded-t-xl pb-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === 2 ? 'bg-[#00d1c1] text-[#001b44]' : (step > 2 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500')}`}>
                {(step > 2 && vendorResults && vendorResults.errors.length === 0) ? <CheckCircle size={16} /> : "2"}
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg text-[#001b44] flex items-center justify-between">
                  <span>Vendors</span>
                  {step >= 2 && <Badge variant="secondary" className="bg-purple-100 text-[#725bb4] text-xs font-normal border-purple-200">Cross-checks with COA</Badge>}
                </CardTitle>
                <CardDescription>Upload vendor list to validate against COA</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {step < 2 ? (
              <div className="text-center p-6 text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                Please complete Chart of Accounts (COA) upload first.
              </div>
            ) : !vendorResults ? (
              <div className="bg-cyan-50/50 rounded-xl border border-dashed border-[#00d1c1] p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-white text-[#00d1c1] rounded-full flex items-center justify-center mb-3 shadow-sm">
                  <FileUp size={24} />
                </div>
                <h3 className="text-base font-bold text-[#001b44]">Upload Vendor File</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">This file will be automatically cross-checked against your loaded COA.</p>
                <div className="relative">
                  <input
                    ref={vendorInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => e.target.files && handleVendorFile(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isProcessing}
                  />
                  <button className="px-6 py-2 bg-[#00d1c1] hover:bg-[#00bdae] text-[#001b44] font-bold rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-[#00d1c1] focus:ring-offset-2 disabled:opacity-50">
                    {isProcessing ? "Validating..." : "Select File"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <FileUp size={16} className="text-gray-500" />
                    <span className="font-medium text-gray-700">{vendorFile?.name}</span>
                  </div>
                  <button onClick={clearVendor} className="text-xs text-gray-500 hover:text-red-500 font-medium">Use different file</button>
                </div>
                <ResultsSummary res={vendorResults} title="Vendor Validation" onClear={clearVendor} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Other Files */}
        <Card className={`transition-all duration-300 border-2 ${step === 3 ? 'border-[#00d1c1] shadow-md ring-4 ring-cyan-50' : 'border-purple-100 shadow-sm'} ${step < 3 ? 'opacity-60 grayscale-[50%]' : ''}`}>
          <div className="absolute -top-3 left-10 w-0.5 h-6 bg-gray-300 -z-10"></div>
          <CardHeader className="bg-white rounded-t-xl pb-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === 3 ? 'bg-[#00d1c1] text-[#001b44]' : 'bg-gray-100 text-gray-500'}`}>
                3
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg text-[#001b44] flex items-center justify-between">
                  <span>Transactions & Other</span>
                  {step >= 3 && <Badge variant="secondary" className="bg-purple-100 text-[#725bb4] text-xs font-normal border-purple-200">Cross-checks with COA & Vendors</Badge>}
                </CardTitle>
                <CardDescription>Validate remaining operational data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {step < 3 ? (
              <div className="text-center p-6 text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                Please complete Vendors upload first to establish full reference data.
              </div>
            ) : (
              <div className="space-y-6">
                {!otherResults ? (
                  <div className="grid md:grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-xl border border-gray-200">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Select File Type to Validate</label>
                      <Select value={otherFileType} onValueChange={(val) => setOtherFileType(val as FileType)}>
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {otherFileTypes.map(ft => (
                            <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Choose CSV File</label>
                      <div className="relative h-10 w-full overflow-hidden rounded-md border border-input bg-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <input
                          ref={otherInputRef}
                          type="file"
                          accept=".csv"
                          disabled={!otherFileType || isProcessing}
                          onChange={(e) => {
                            if (e.target.files && otherFileType) {
                              handleOtherFile(e.target.files[0], otherFileType as FileType);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                        />
                        <div className={`flex h-full items-center px-3 text-sm ${!otherFileType ? 'text-gray-400 bg-gray-100' : 'text-[#725bb4] font-medium bg-purple-50'}`}>
                          {!otherFileType ? "Select a file type first" : "Click to select CSV file..."}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-gray-50 p-3 rounded-lg border border-gray-200 gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#4f3b8a] hover:bg-[#3d2d6c] font-normal shadow-sm">
                          {otherFileTypes.find(f => f.value === otherFileType)?.label}
                        </Badge>
                        <span className="font-medium text-gray-700 truncate max-w-[200px] sm:max-w-xs">{otherFile?.name}</span>
                      </div>
                      <button onClick={clearOther} className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-md text-gray-600 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors font-medium">Validate another file</button>
                    </div>
                    <ResultsSummary res={otherResults} title={`${otherFileTypes.find(f => f.value === otherFileType)?.label} Validation`} onClear={clearOther} />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
