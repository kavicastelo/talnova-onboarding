import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  salesService,
  CsvPreviewResponse,
  CsvExecuteResponse,
  LeadSource,
} from '../../../services/sales.service';
import { Button } from '../../Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../Dialog';

interface BulkLeadImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

const SAMPLE_CSV_DATA = `name,email,companyName,phone,jobTitle,industry,companySize,estimatedBudget,source,country
"Sarah Jenkins","sarah.jenkins@acmecorp.com","Acme Corp","+1-555-0192","VP Operations","Technology","51-200","45000","import","United States"
"Michael Chang","mchang@fintechsolutions.io","FinTech Solutions","+1-555-0144","Head of HR","Financial Services","201-500","75000","import","Canada"
"Elena Rostova","elena@innovatehealth.org","Innovate Health","+44-20-7946-0912","Director of Talent","Healthcare","11-50","25000","import","United Kingdom"`;

const CANONICAL_FIELDS: Array<{ key: string; label: string; required: boolean; description: string }> = [
  { key: 'email', label: 'Email Address', required: true, description: 'Primary contact identifier and duplicate detector' },
  { key: 'name', label: 'Full Name', required: true, description: 'Prospect contact name' },
  { key: 'companyName', label: 'Company Name', required: true, description: 'Prospect organization name' },
  { key: 'phone', label: 'Phone Number', required: false, description: 'Direct or office phone' },
  { key: 'whatsapp', label: 'WhatsApp Number', required: false, description: 'Mobile messaging number' },
  { key: 'jobTitle', label: 'Job Title / Role', required: false, description: 'Lead position (e.g. VP Operations)' },
  { key: 'industry', label: 'Industry', required: false, description: 'Vertical market sector' },
  { key: 'companySize', label: 'Company Size', required: false, description: 'Employee tier (e.g. 51-200)' },
  { key: 'estimatedBudget', label: 'Estimated Budget ($)', required: false, description: 'Anticipated deal size' },
  { key: 'country', label: 'Country', required: false, description: 'Primary nation' },
  { key: 'region', label: 'Region / City', required: false, description: 'State, province or metropolitan area' },
  { key: 'interestedProduct', label: 'Interested Product', required: false, description: 'Product or module focus' },
];

export const BulkLeadImportModal: React.FC<BulkLeadImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview data
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<CsvPreviewResponse | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Execution options
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'overwrite' | 'create_duplicate'>('skip');
  const [defaultSource, setDefaultSource] = useState<LeadSource>('import');
  const [tagInput, setTagInput] = useState<string>('bulk-import');

  // Execution state & results
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<CsvExecuteResponse | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const resetState = () => {
    setStep(1);
    setCsvContent('');
    setFileName('');
    setPreviewData(null);
    setColumnMapping({});
    setPreviewError(null);
    setExecutionResult(null);
    setExecutionError(null);
    setIsLoadingPreview(false);
    setIsExecuting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_DATA], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'talnova_leads_import_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text || '');
      setPreviewError(null);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleLoadPreview = async () => {
    if (!csvContent.trim()) {
      setPreviewError('Please provide CSV data by uploading a file or pasting content.');
      return;
    }

    try {
      setIsLoadingPreview(true);
      setPreviewError(null);
      const preview = await salesService.previewCsvImport(csvContent);
      setPreviewData(preview);

      // Invert mapping so mapping key is canonicalField -> csvHeader
      // Or keep key as canonical field
      const initialMapping: Record<string, string> = {};
      CANONICAL_FIELDS.forEach((f) => {
        // Find if any suggested mapping matched this canonical field
        const matchedHeader = preview.headers.find(
          (h) => preview.suggestedMapping[h] === f.key || h.toLowerCase() === f.key.toLowerCase()
        );
        if (matchedHeader) {
          initialMapping[f.key] = matchedHeader;
        } else {
          initialMapping[f.key] = '';
        }
      });
      setColumnMapping(initialMapping);
      setStep(2);
    } catch (err: any) {
      setPreviewError(err.response?.data?.message || err.message || 'Failed to parse CSV preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExecuteImport = async () => {
    try {
      setIsExecuting(true);
      setExecutionError(null);

      // Invert mapping so it is csvHeader -> canonicalField for backend
      const backendMapping: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([canonical, csvHeader]) => {
        if (csvHeader && csvHeader !== '__skip__') {
          backendMapping[csvHeader] = canonical;
        }
      });

      const tags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await salesService.executeCsvImport({
        csvContent,
        mapping: backendMapping,
        duplicateStrategy,
        defaultValues: {
          source: defaultSource,
          tags,
        },
      });

      setExecutionResult(result);
      setStep(4);
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      setExecutionError(err.response?.data?.message || err.message || 'Failed to execute lead import.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Bulk Lead Import Wizard
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Import prospect accounts from CSV spreadsheets with smart field auto-mapping & duplicate checks.
                </DialogDescription>
              </div>
            </div>

            {/* Stepper Indicator */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <span className={`px-2 py-0.5 rounded-full ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              <span className="text-slate-300">→</span>
              <span className={`px-2 py-0.5 rounded-full ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              <span className="text-slate-300">→</span>
              <span className={`px-2 py-0.5 rounded-full ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              <span className="text-slate-300">→</span>
              <span className={`px-2 py-0.5 rounded-full ${step === 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>4</span>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {/* STEP 1: Upload or Paste CSV */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      inputMode === 'upload'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Upload CSV File
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      inputMode === 'paste'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Paste Raw CSV
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSample}
                  className="flex items-center gap-1.5 text-xs text-slate-600 border-slate-300 hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  Download Sample CSV
                </Button>
              </div>

              {inputMode === 'upload' ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : fileName
                      ? 'border-emerald-400 bg-emerald-50/20'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                      {fileName ? <Check className="w-6 h-6 text-emerald-600" /> : <Upload className="w-6 h-6" />}
                    </div>
                    {fileName ? (
                      <div>
                        <p className="font-semibold text-slate-800">{fileName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Click or drop another file to replace</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-slate-700">Drag & drop your CSV file here, or browse</p>
                        <p className="text-xs text-slate-400 mt-1">Supports UTF-8 CSV with headers (Max 5,000 leads per batch)</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Paste CSV Content with Header Row</label>
                  <textarea
                    rows={8}
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    placeholder="name,email,companyName,phone,jobTitle...&#10;John Doe,john@example.com,Acme Corp,+1234567890,CEO..."
                    className="w-full font-mono text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  />
                </div>
              )}

              {previewError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{previewError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Tips for seamless importing:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                  <li>Ensure the first line contains descriptive column names.</li>
                  <li>Email address is required for contact resolution and duplicate matching.</li>
                  <li>Phone numbers will be automatically normalized to international E.164 standard.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: Field Mapping */}
          {step === 2 && previewData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2 text-xs text-indigo-900">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>
                    Detected <strong>{previewData.totalRows} rows</strong> across <strong>{previewData.headers.length} CSV columns</strong>.
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">
                  Auto-Mapped
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3.5">Talnova Lead Field</th>
                      <th className="py-2.5 px-3.5">Mapped CSV Column</th>
                      <th className="py-2.5 px-3.5">Sample Value (Row 1)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {CANONICAL_FIELDS.map((field) => {
                      const selectedHeader = columnMapping[field.key] || '';
                      const sampleVal = selectedHeader && previewData.sampleRows[0]
                        ? previewData.sampleRows[0][selectedHeader] || '—'
                        : '—';

                      return (
                        <tr key={field.key} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5">
                            <div className="font-medium text-slate-800 flex items-center gap-1.5">
                              {field.label}
                              {field.required && (
                                <span className="text-rose-500 font-bold" title="Required">*</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{field.description}</div>
                          </td>
                          <td className="py-2 px-3.5">
                            <select
                              value={selectedHeader}
                              onChange={(e) =>
                                setColumnMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              className={`w-full text-xs rounded-lg px-2.5 py-1.5 border ${
                                selectedHeader
                                  ? 'border-indigo-300 bg-white text-indigo-900 font-medium'
                                  : field.required
                                  ? 'border-rose-300 bg-rose-50/50 text-rose-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-500'
                              } focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                            >
                              <option value="">(Do Not Map / Leave Blank)</option>
                              {previewData.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3.5 font-mono text-[11px] text-slate-600 truncate max-w-[200px]">
                            {sampleVal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: Duplicate Resolution & Options */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  1. Duplicate Resolution Strategy
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setDuplicateStrategy('skip')}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                      duplicateStrategy === 'skip'
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        duplicateStrategy === 'skip' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}>
                        {duplicateStrategy === 'skip' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-semibold text-xs text-slate-800">Skip Duplicates</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Preserve existing lead details. Any row matching existing email/phone will be skipped.
                    </p>
                  </div>

                  <div
                    onClick={() => setDuplicateStrategy('overwrite')}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                      duplicateStrategy === 'overwrite'
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        duplicateStrategy === 'overwrite' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}>
                        {duplicateStrategy === 'overwrite' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-semibold text-xs text-slate-800">Update Existing</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Overwrite existing lead fields with latest data from CSV rows.
                    </p>
                  </div>

                  <div
                    onClick={() => setDuplicateStrategy('create_duplicate')}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                      duplicateStrategy === 'create_duplicate'
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        duplicateStrategy === 'create_duplicate' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}>
                        {duplicateStrategy === 'create_duplicate' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-semibold text-xs text-slate-800">Always Create</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Create new lead entries without deduplicating (allows duplicate contact records).
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Default Lead Source
                  </label>
                  <select
                    value={defaultSource}
                    onChange={(e) => setDefaultSource(e.target.value as LeadSource)}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="import">Bulk CSV Import</option>
                    <option value="campaign">Outbound Campaign</option>
                    <option value="website">Website / Landing Page</option>
                    <option value="product_demo">Product Demo Request</option>
                    <option value="referral">Referral</option>
                    <option value="other">Other Channel</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Batch Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="q4-leads, enterprise-outreach"
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {executionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{executionError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Automated AI lead scoring and E.164 phone normalization will be performed.</span>
                </div>
                <span className="font-semibold text-slate-700">{previewData?.totalRows || 0} rows pending</span>
              </div>
            </div>
          )}

          {/* STEP 4: Results & Summary */}
          {step === 4 && executionResult && (
            <div className="space-y-5">
              <div className="text-center py-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Lead Import Completed</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Batch ID: <span className="font-mono text-slate-700">{executionResult.batchId}</span>
                </p>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase">Created</p>
                  <p className="text-xl font-bold text-emerald-800 mt-1">{executionResult.created}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-center">
                  <p className="text-[11px] font-semibold text-blue-700 uppercase">Updated</p>
                  <p className="text-xl font-bold text-blue-800 mt-1">{executionResult.updated}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100 text-center">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase">Skipped</p>
                  <p className="text-xl font-bold text-amber-800 mt-1">{executionResult.duplicatesSkipped}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase">Total Rows</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{executionResult.totalRows}</p>
                </div>
              </div>

              {/* Errors table if any */}
              {executionResult.errors && executionResult.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Failed / Invalid Rows ({executionResult.errors.length})</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-rose-100 rounded-xl bg-rose-50/30 p-2">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-rose-100">
                          <th className="py-1 px-2">Row</th>
                          <th className="py-1 px-2">Email</th>
                          <th className="py-1 px-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {executionResult.errors.map((err, idx) => (
                          <tr key={idx} className="text-slate-700">
                            <td className="py-1 px-2 font-mono">{err.row}</td>
                            <td className="py-1 px-2 font-mono text-slate-600">{err.email || '—'}</td>
                            <td className="py-1 px-2 text-rose-600">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between sm:justify-between">
          {step === 1 && (
            <>
              <Button variant="outline" size="sm" onClick={handleClose} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleLoadPreview}
                disabled={isLoadingPreview || !csvContent.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1.5"
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Parsing CSV...
                  </>
                ) : (
                  <>
                    Next: Field Mapping
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="text-xs flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!columnMapping.email) {
                    setPreviewError('Please map the required Email Address field.');
                    return;
                  }
                  setStep(3);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1.5"
              >
                Next: Duplicate Options
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                disabled={isExecuting}
                className="text-xs flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteImport}
                disabled={isExecuting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1.5 shadow-sm"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Importing Leads...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Start Import ({previewData?.totalRows} Leads)
                  </>
                )}
              </Button>
            </>
          )}

          {step === 4 && (
            <div className="w-full flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetState}
                className="text-xs"
              >
                Import More Leads
              </Button>
              <Button
                size="sm"
                onClick={handleClose}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                Done & View Leads
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkLeadImportModal;
