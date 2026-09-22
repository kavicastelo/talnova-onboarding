import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../Dialog';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Input } from '../Input';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Settings2,
  Check,
  RefreshCw,
  Edit2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { parseDelimitedText } from '../../utils/csv-parser';
import { autoDetectColumnMapping, CANONICAL_EMPLOYEE_FIELDS } from '../../utils/column-mapper';
import { employeeService } from '../../services/employee.service';
import { useOrganizationCapabilities } from '../../hooks/useOrganizationCapabilities';
import { toast } from 'sonner';

interface BulkImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'options' | 'importing' | 'completed';

export const BulkImportWizard: React.FC<BulkImportWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [detectedDelimiter, setDetectedDelimiter] = useState<string>(',');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Validation State
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);

  // Automation Options
  const { isEmailAvailable, emailReason } = useOrganizationCapabilities();
  const [triggerWorkflows, setTriggerWorkflows] = useState<boolean>(true);
  const [autoAssignRoleChecklists, setAutoAssignRoleChecklists] = useState<boolean>(true);
  const [sendInvites, setSendInvites] = useState<boolean>(false);
  const [updateExisting, setUpdateExisting] = useState<boolean>(false);

  // Import Progress State
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importResults, setImportResults] = useState<{
    successCount: number;
    updatedCount: number;
    failures: Array<{ email: string; reason: string }>;
  } | null>(null);

  const resetState = () => {
    setCurrentStep('upload');
    setFileName('');
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setValidationReport(null);
    setImportProgress(0);
    setImportResults(null);
    setEditingCell(null);
  };

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onClose();
  };

  // 1. File Upload & Ingestion
  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      const parsed = parseDelimitedText(content);
      setDetectedDelimiter(parsed.delimiter);
      setRawHeaders(parsed.headers);
      setRawRows(parsed.rows);

      // Auto-detect columns
      const autoMap = autoDetectColumnMapping(parsed.headers);
      setColumnMapping(autoMap);

      if (parsed.headers.length > 0 && parsed.rows.length > 0) {
        toast.success(`Parsed ${parsed.rows.length} rows with delimiter '${parsed.delimiter === '\t' ? 'TAB' : parsed.delimiter}'`);
        setCurrentStep('mapping');
      } else {
        toast.error('Could not parse any rows from this file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  // Sample CSV Template Download
  const downloadSampleTemplate = () => {
    const csvContent =
      'Work Email,Staff Name,Role,Department,Position,Manager Email,Hire Date,Contract Type,Location\n' +
      'alex.rivera@acme.corp,Alex Rivera,employee,Engineering,Senior Fullstack Engineer,kavindu.kokila.info@gmail.com,2026-10-01,full_time,Tokyo\n' +
      'maya.lin@acme.corp,Maya Lin,employee,Product,Lead UX Designer,kavindu.kokila.info@gmail.com,2026-10-05,full_time,San Francisco\n' +
      'david.kim@acme.corp,David Kim,manager,Warehouse Operations,Shift Supervisor,kavindu.kokila.info@gmail.com,2026-09-20,full_time,Chicago\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'talnova_bulk_employee_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Generate Mapped Payload from rawRows and columnMapping
  const mappedUsers = useMemo(() => {
    return rawRows.map((row) => {
      const mappedUser: Record<string, any> = {};
      Object.entries(columnMapping).forEach(([header, targetField]) => {
        if (targetField && targetField !== '__ignore__') {
          mappedUser[targetField] = row[header];
        }
      });
      return mappedUser;
    });
  }, [rawRows, columnMapping]);

  // Check required mappings
  const hasEmailMapped = useMemo(() => {
    return Object.values(columnMapping).includes('email');
  }, [columnMapping]);

  const hasNameMapped = useMemo(() => {
    const values = Object.values(columnMapping);
    return values.includes('fullName') || values.includes('firstName');
  }, [columnMapping]);

  // 3. Trigger Server Validation
  const runValidation = async () => {
    if (!hasEmailMapped) {
      toast.error('Please map a column to Email Address before proceeding.');
      return;
    }
    if (!hasNameMapped) {
      toast.error('Please map a column to Full Name or First Name.');
      return;
    }

    setIsValidating(true);
    try {
      const report = await employeeService.validateBulkImport(mappedUsers, {
        updateExisting,
        triggerWorkflows,
        autoAssignRoleChecklists,
        sendInvites,
      });
      setValidationReport(report);
      setCurrentStep('preview');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Validation request failed');
    } finally {
      setIsValidating(false);
    }
  };

  // In-cell correction handler
  const handleCellEdit = (rowIndex: number, field: string, newValue: string) => {
    // Find the original CSV column that maps to this field
    const sourceHeader = Object.keys(columnMapping).find((h) => columnMapping[h] === field);
    if (!sourceHeader) return;

    setRawRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [sourceHeader]: newValue,
      };
      return updated;
    });

    setEditingCell(null);
  };

  // 4. Final Execution
  const executeImport = async () => {
    setIsImporting(true);
    setCurrentStep('importing');
    setImportProgress(10);

    try {
      const CHUNK_SIZE = 250;
      let totalSuccess = 0;
      let totalUpdated = 0;
      const allFailures: Array<{ email: string; reason: string }> = [];

      for (let i = 0; i < mappedUsers.length; i += CHUNK_SIZE) {
        const chunk = mappedUsers.slice(i, i + CHUNK_SIZE);
        const res = await employeeService.importEmployees(chunk, {
          updateExisting,
          triggerWorkflows,
          autoAssignRoleChecklists,
          sendInvites,
        });

        totalSuccess += res.imported ?? res.successCount ?? 0;
        totalUpdated += res.updated ?? res.updatedCount ?? 0;
        if (res.failures && res.failures.length > 0) {
          allFailures.push(...res.failures);
        } else if (res.errors && res.errors.length > 0) {
          allFailures.push(...res.errors);
        }

        const pct = Math.min(95, Math.round(((i + chunk.length) / mappedUsers.length) * 100));
        setImportProgress(pct);
      }

      setImportProgress(100);
      setImportResults({
        successCount: totalSuccess,
        updatedCount: totalUpdated,
        failures: allFailures,
      });
      setCurrentStep('completed');
      toast.success(`Import complete! ${totalSuccess} created, ${totalUpdated} updated.`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Import failed');
      setIsImporting(false);
    }
  };

  // Filtered rows for preview table
  const displayedRowIndices = useMemo(() => {
    if (!validationReport) return mappedUsers.map((_, i) => i);
    const errorRows = new Set((validationReport.errors || []).map((e: any) => e.row - 1));
    const conflictRows = new Set((validationReport.conflicts || []).map((c: any) => c.row - 1));

    return mappedUsers.map((_, i) => i).filter((idx) => {
      const isErr = errorRows.has(idx) || conflictRows.has(idx);
      if (previewFilter === 'errors') return isErr;
      if (previewFilter === 'valid') return !isErr;
      return true;
    });
  }, [mappedUsers, validationReport, previewFilter]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b bg-card">
          <div className="flex flex-col sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  Dynamic Bulk User Import
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                    Smart Mapper
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 text-muted-foreground">
                  Ingest employee records with fuzzy header detection, error correction, and automated workflow triggers.
                </DialogDescription>
              </div>
            </div>

            {/* Stepper indicators */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground shrink-0">
              <span className={currentStep === 'upload' ? 'text-primary font-bold' : ''}>1. File</span>
              <span>&rarr;</span>
              <span className={currentStep === 'mapping' ? 'text-primary font-bold' : ''}>2. Map</span>
              <span>&rarr;</span>
              <span className={currentStep === 'preview' ? 'text-primary font-bold' : ''}>3. Verify</span>
              <span>&rarr;</span>
              <span className={currentStep === 'options' ? 'text-primary font-bold' : ''}>4. Options</span>
            </div>
          </div>
        </DialogHeader>

        {/* Wizard Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Upload */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                }}
                className="border-2 border-dashed rounded-2xl p-10 text-center hover:border-primary/50 transition-colors bg-muted/20 hover:bg-muted/30 cursor-pointer flex flex-col items-center justify-center gap-3"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv,.tsv,.txt';
                  input.onchange = (e: any) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  };
                  input.click();
                }}
              >
                <div className="p-4 rounded-full bg-primary/10 text-primary">
                  <Upload className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-foreground">Click to upload or drag & drop</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports standard CSV, TSV, or tab-delimited text files (RFC 4180 compliant)
                  </p>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono">
                  .CSV • .TSV • UTF-8
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30 text-xs">
                <div>
                  <span className="font-semibold block text-foreground">Need a starting template?</span>
                  <span className="text-muted-foreground">Download our pre-configured corporate employee import sheet.</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSampleTemplate}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5 text-primary" /> Download Sample CSV
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Dynamic Column Mapping */}
          {currentStep === 'mapping' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Map Columns to Talnova Fields</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Our fuzzy detection engine has pre-matched headers. Review or adjust mappings below.
                  </p>
                </div>
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <span>File: <strong className="text-foreground">{fileName}</strong> ({rawRows.length} rows)</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    Delimiter: {detectedDelimiter === '\t' ? 'TAB' : detectedDelimiter === ';' ? 'Semicolon' : 'Comma'}
                  </Badge>
                </div>
              </div>

              {(!hasEmailMapped || !hasNameMapped) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Required fields: <strong>Email Address</strong> and <strong>Full Name</strong> (or First Name) must be mapped to proceed.
                  </span>
                </div>
              )}

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">CSV Column</th>
                      <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">Sample Values</th>
                      <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">Target Talnova Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rawHeaders.map((header) => {
                      const sample1 = rawRows[0]?.[header] || '';
                      const sample2 = rawRows[1]?.[header] || '';
                      const currentMappedField = columnMapping[header] || '__ignore__';

                      return (
                        <tr key={header} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-foreground">
                            {header}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                            {sample1 || sample2 ? (
                              <span>
                                {sample1} {sample2 ? `• ${sample2}` : ''}
                              </span>
                            ) : (
                              <em className="text-muted-foreground/60">(empty)</em>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={currentMappedField}
                              onChange={(e) => {
                                setColumnMapping((prev) => ({
                                  ...prev,
                                  [header]: e.target.value,
                                }));
                              }}
                              className="text-xs p-1.5 border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary w-64"
                            >
                              <option value="__ignore__">⛔ Ignore this column</option>
                              <optgroup label="Core Profile">
                                {CANONICAL_EMPLOYEE_FIELDS.map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label} {f.required ? '*' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & In-Cell Correction Grid */}
          {currentStep === 'preview' && validationReport && (
            <div className="space-y-4">
              {/* Validation Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border bg-card text-center">
                  <span className="text-xs text-muted-foreground font-medium block">Total Ingested</span>
                  <span className="text-xl font-bold text-foreground">{validationReport.totalRows}</span>
                </div>
                <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-center">
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium block">Ready to Import</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {validationReport.validCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border bg-rose-500/10 border-rose-500/20 text-center">
                  <span className="text-xs text-rose-700 dark:text-rose-300 font-medium block">Validation Errors</span>
                  <span className="text-xl font-bold text-rose-700 dark:text-rose-300">
                    {validationReport.errorCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-center">
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-medium block">Warnings / Conflicts</span>
                  <span className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    {validationReport.conflictCount + validationReport.warningCount}
                  </span>
                </div>
              </div>

              {/* Filter controls & In-Cell editing notice */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold ${previewFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    All ({mappedUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('valid')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold ${previewFilter === 'valid'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    Valid Only ({validationReport.validCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('errors')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold ${previewFilter === 'errors'
                      ? 'bg-rose-600 text-white'
                      : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    Errors Only ({validationReport.errorCount + validationReport.conflictCount})
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Edit2 className="h-3 w-3" /> Click any cell to edit & fix values in-place
                </span>
              </div>

              {/* Data Table with In-Cell Editor */}
              <div className="border rounded-xl overflow-x-auto max-h-72">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 sticky top-0 border-b">
                    <tr>
                      <th className="p-2.5 font-semibold text-muted-foreground">#</th>
                      <th className="p-2.5 font-semibold text-muted-foreground">Status</th>
                      <th className="p-2.5 font-semibold text-muted-foreground">Email</th>
                      <th className="p-2.5 font-semibold text-muted-foreground">Name</th>
                      <th className="p-2.5 font-semibold text-muted-foreground">Department</th>
                      <th className="p-2.5 font-semibold text-muted-foreground">Job Title</th>
                      <th className="p-2.5 font-semibold text-muted-foreground">Manager Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayedRowIndices.slice(0, 50).map((rowIndex) => {
                      const user = mappedUsers[rowIndex];
                      const rowNum = rowIndex + 1;
                      const rowError = (validationReport.errors || []).find((e: any) => e.row === rowNum);
                      const rowConflict = (validationReport.conflicts || []).find((c: any) => c.row === rowNum);

                      const hasErr = Boolean(rowError);
                      const hasConflict = Boolean(rowConflict);

                      return (
                        <tr
                          key={rowIndex}
                          className={`hover:bg-muted/30 transition-colors ${hasErr ? 'bg-rose-500/5' : hasConflict ? 'bg-amber-500/5' : ''
                            }`}
                        >
                          <td className="p-2.5 font-mono text-[11px] text-muted-foreground">{rowNum}</td>
                          <td className="p-2.5">
                            {hasErr ? (
                              <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 gap-1">
                                <AlertCircle className="h-2.5 w-2.5" /> {rowError.reason}
                              </Badge>
                            ) : hasConflict ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" /> Exists
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Ready
                              </Badge>
                            )}
                          </td>

                          {/* Email Cell */}
                          <td
                            className="p-2.5 font-mono cursor-pointer hover:underline"
                            onClick={() => setEditingCell({ rowIndex, field: 'email' })}
                          >
                            {editingCell?.rowIndex === rowIndex && editingCell?.field === 'email' ? (
                              <Input
                                autoFocus
                                defaultValue={user.email || ''}
                                onBlur={(e) => handleCellEdit(rowIndex, 'email', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellEdit(rowIndex, 'email', (e.target as any).value);
                                }}
                                className="h-6 text-xs p-1 font-mono"
                              />
                            ) : (
                              <span className={!user.email || rowError?.field === 'email' ? 'text-rose-600 font-bold' : ''}>
                                {user.email || '<missing email>'}
                              </span>
                            )}
                          </td>

                          {/* Name Cell */}
                          <td
                            className="p-2.5 cursor-pointer hover:underline"
                            onClick={() => setEditingCell({ rowIndex, field: 'fullName' })}
                          >
                            {editingCell?.rowIndex === rowIndex && editingCell?.field === 'fullName' ? (
                              <Input
                                autoFocus
                                defaultValue={user.fullName || user.firstName || ''}
                                onBlur={(e) => handleCellEdit(rowIndex, 'fullName', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellEdit(rowIndex, 'fullName', (e.target as any).value);
                                }}
                                className="h-6 text-xs p-1"
                              />
                            ) : (
                              <span>{user.fullName || user.firstName || '<missing name>'}</span>
                            )}
                          </td>

                          {/* Department Cell */}
                          <td
                            className="p-2.5 cursor-pointer hover:underline"
                            onClick={() => setEditingCell({ rowIndex, field: 'department' })}
                          >
                            {editingCell?.rowIndex === rowIndex && editingCell?.field === 'department' ? (
                              <Input
                                autoFocus
                                defaultValue={user.department || ''}
                                onBlur={(e) => handleCellEdit(rowIndex, 'department', e.target.value)}
                                className="h-6 text-xs p-1"
                              />
                            ) : (
                              <span>{user.department || 'General'}</span>
                            )}
                          </td>

                          {/* Job Title */}
                          <td className="p-2.5 text-muted-foreground">{user.jobTitle || '—'}</td>

                          {/* Manager Email */}
                          <td
                            className="p-2.5 font-mono text-[11px] cursor-pointer hover:underline"
                            onClick={() => setEditingCell({ rowIndex, field: 'managerEmail' })}
                          >
                            {editingCell?.rowIndex === rowIndex && editingCell?.field === 'managerEmail' ? (
                              <Input
                                autoFocus
                                defaultValue={user.managerEmail || ''}
                                onBlur={(e) => handleCellEdit(rowIndex, 'managerEmail', e.target.value)}
                                className="h-6 text-xs p-1 font-mono"
                              />
                            ) : (
                              <span>{user.managerEmail || '—'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {displayedRowIndices.length > 50 && (
                  <div className="p-2 text-center text-[11px] text-muted-foreground bg-muted/30 border-t">
                    Showing first 50 of {displayedRowIndices.length} filtered records. All {mappedUsers.length} records will be submitted.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Automation Settings */}
          {currentStep === 'options' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">Import Automation & Orchestration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure post-ingestion behaviors and autonomous lifecycle engine triggers.
                </p>
              </div>

              <div className="space-y-4">
                {/* Workflow Triggering Toggle */}
                <div className="p-4 rounded-xl border bg-card flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                      <Sparkles className="h-4 w-4 text-primary" /> Trigger Autonomous Workflows & Journeys
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Evaluates departmental and regional stage gates to automatically assign the appropriate onboarding journey.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerWorkflows}
                    onChange={(e) => setTriggerWorkflows(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer mt-0.5"
                  />
                </div>

                {/* Role-Based Checklists Toggle */}
                <div className="p-4 rounded-xl border bg-card flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                      <Layers className="h-4 w-4 text-indigo-600" /> Auto-Assign Role-Based Checklists & Relative Tasks
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically binds default checklists matched to role/dept, setting relative deadlines from now (e.g. +3 days, +7 days).
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoAssignRoleChecklists}
                    onChange={(e) => setAutoAssignRoleChecklists(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer mt-0.5"
                  />
                </div>

                {/* Email Invitation Toggle */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-xs text-foreground flex items-center gap-2">
                        Send Welcome & Invitation Emails
                        {!isEmailAvailable && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                            Email Config Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Sends an onboarding portal activation email with temporary login credentials (<code className="font-mono bg-muted px-1 rounded">Welcome@2026!</code>).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={sendInvites && isEmailAvailable}
                      disabled={!isEmailAvailable}
                      onChange={(e) => setSendInvites(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer mt-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  {!isEmailAvailable && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs flex items-start gap-2" data-testid="bulk-import-email-warning">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-foreground">Email Service Not Configured: </span>
                        <span className="text-muted-foreground">
                          {emailReason || 'Configure an email provider in Settings > Integrations before sending invitations.'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Upsert Mode Radio */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="font-bold text-xs text-foreground">Existing User Conflict Resolution</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label
                      className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-colors ${!updateExisting ? 'border-primary bg-primary/5 font-semibold text-primary' : 'hover:bg-muted/10'
                        }`}
                    >
                      <input
                        type="radio"
                        name="conflict-handling"
                        checked={!updateExisting}
                        onChange={() => setUpdateExisting(false)}
                        className="text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="text-xs">Skip Existing Records</div>
                        <div className="text-[10px] text-muted-foreground font-normal">Ignores rows matching registered emails</div>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-colors ${updateExisting ? 'border-primary bg-primary/5 font-semibold text-primary' : 'hover:bg-muted/10'
                        }`}
                    >
                      <input
                        type="radio"
                        name="conflict-handling"
                        checked={updateExisting}
                        onChange={() => setUpdateExisting(true)}
                        className="text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="text-xs">Update Profile Data (Upsert)</div>
                        <div className="text-[10px] text-muted-foreground font-normal">Overwrites department, title, manager line</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Importing & Progress */}
          {currentStep === 'importing' && (
            <div className="py-12 text-center space-y-4">
              <RefreshCw className="h-10 w-10 text-primary animate-spin mx-auto" />
              <div>
                <h4 className="font-bold text-base text-foreground">Importing Employees & Triggering Automations</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Processing batches, instantiating onboarding cases, and binding role checklists...
                </p>
              </div>
              <div className="w-full max-w-md mx-auto bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground">{importProgress}% completed</span>
            </div>
          )}

          {/* STEP 6: Completion Report */}
          {currentStep === 'completed' && importResults && (
            <div className="py-8 text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Bulk Import Completed Successfully</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Employee profiles created and connected with reporting managers and onboarding checklists.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="p-3 border rounded-xl bg-card">
                  <span className="text-xs text-muted-foreground block">New Users</span>
                  <span className="text-lg font-bold text-emerald-600">+{importResults.successCount}</span>
                </div>
                <div className="p-3 border rounded-xl bg-card">
                  <span className="text-xs text-muted-foreground block">Updated</span>
                  <span className="text-lg font-bold text-primary">{importResults.updatedCount}</span>
                </div>
                <div className="p-3 border rounded-xl bg-card">
                  <span className="text-xs text-muted-foreground block">Failed / Skipped</span>
                  <span className="text-lg font-bold text-muted-foreground">{importResults.failures.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex items-center justify-between">
          <div>
            {currentStep === 'mapping' && (
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep('upload')} className="gap-1 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to File
              </Button>
            )}
            {currentStep === 'preview' && (
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep('mapping')} className="gap-1 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Adjust Mappings
              </Button>
            )}
            {currentStep === 'options' && (
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep('preview')} className="gap-1 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Preview
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep !== 'completed' && currentStep !== 'importing' && (
              <Button variant="outline" size="sm" onClick={handleClose} className="text-xs">
                Cancel
              </Button>
            )}

            {currentStep === 'mapping' && (
              <Button
                size="sm"
                onClick={runValidation}
                disabled={!hasEmailMapped || !hasNameMapped || isValidating}
                className="gap-1 text-xs font-semibold"
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Validating...
                  </>
                ) : (
                  <>
                    Verify & Preview <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            )}

            {currentStep === 'preview' && (
              <Button
                size="sm"
                onClick={() => setCurrentStep('options')}
                className="gap-1 text-xs font-semibold"
              >
                <Settings2 className="h-3.5 w-3.5" /> Configure Options &rarr;
              </Button>
            )}

            {currentStep === 'options' && (
              <Button
                size="sm"
                onClick={executeImport}
                disabled={isImporting}
                className="gap-1 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Start Bulk Import ({mappedUsers.length} rows)
              </Button>
            )}

            {currentStep === 'completed' && (
              <Button size="sm" onClick={handleClose} className="text-xs font-semibold">
                Done & Return to Directory
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkImportWizard;
