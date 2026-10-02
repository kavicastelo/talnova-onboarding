import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Award,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Calendar,
  RefreshCw,
  Copy,
  Check,
  Building2,
  Clock,
  TrendingUp,
  FileText,
  Search,
  Sun
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell
} from 'recharts';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { toast } from 'sonner';
import { kioskService } from '../../features/kiosk/services/kiosk.service';
import {
  KioskComplianceSummary,
  DepartmentCompliance
} from '../../types/kiosk/compliance.types';
import { KioskJourney } from '../../types/kiosk/journey.types';

export interface KioskComplianceDashboardProps {
  isTab?: boolean;
}

export const KioskComplianceDashboard: React.FC<KioskComplianceDashboardProps> = ({ isTab = false }) => {
  const { t } = useTranslation(['kiosk', 'common']);

  // Loading & error state
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<KioskComplianceSummary | null>(null);
  const [departments, setDepartments] = useState<DepartmentCompliance[]>([]);
  const [journeys, setJourneys] = useState<KioskJourney[]>([]);

  // Filter states
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'q1' | 'q2' | 'q3' | 'q4' | '30d' | '7d' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [recentSearch, setRecentSearch] = useState<string>('');
  const [activeTableTab, setActiveTableTab] = useState<'departments' | 'recent'>('departments');

  // Handle Date Presets
  const applyDatePreset = (preset: 'all' | 'q1' | 'q2' | 'q3' | 'q4' | '30d' | '7d') => {
    setDatePreset(preset);
    const currentYear = new Date().getFullYear();
    const now = new Date();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'q1') {
      setStartDate(`${currentYear}-01-01`);
      setEndDate(`${currentYear}-03-31`);
    } else if (preset === 'q2') {
      setStartDate(`${currentYear}-04-01`);
      setEndDate(`${currentYear}-06-30`);
    } else if (preset === 'q3') {
      setStartDate(`${currentYear}-07-01`);
      setEndDate(`${currentYear}-09-30`);
    } else if (preset === 'q4') {
      setStartDate(`${currentYear}-10-01`);
      setEndDate(`${currentYear}-12-31`);
    } else if (preset === '30d') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().substring(0, 10));
      setEndDate(now.toISOString().substring(0, 10));
    } else if (preset === '7d') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().substring(0, 10));
      setEndDate(now.toISOString().substring(0, 10));
    }
  };

  // Fetch compliance data
  const fetchData = async () => {
    setLoading(true);
    try {
      const filterParams = {
        journeyId: selectedJourneyId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        department: selectedDepartment !== 'all' ? selectedDepartment : undefined
      };

      const [summaryRes, deptsRes, journeysRes] = await Promise.all([
        kioskService.getComplianceSummary(filterParams),
        kioskService.getComplianceByDepartment(filterParams),
        kioskService.listJourneys()
      ]);

      setSummary(summaryRes);
      setDepartments(deptsRes.departments || []);
      setJourneys(journeysRes.journeys || []);
    } catch (err: any) {
      console.error('Error fetching kiosk compliance data:', err);
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to load safety compliance data'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedJourneyId, selectedDepartment, startDate, endDate]);

  // Handle Export CSV
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await kioskService.exportComplianceReport({
        journeyId: selectedJourneyId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        format: 'csv'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `compliance-audit-report-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        t('compliance.exportSuccess', { defaultValue: 'Compliance audit report CSV exported successfully.' })
      );
    } catch (err: any) {
      console.error('Failed to export CSV compliance audit report:', err);
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to export compliance report'
      );
    } finally {
      setExporting(false);
    }
  };

  // Handle Export JSON Audit Packet
  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      const { blob, filename } = await kioskService.exportComplianceReport({
        journeyId: selectedJourneyId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        format: 'json'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename?.replace('.csv', '.json') || `compliance-audit-packet-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        t('compliance.exportJsonSuccess', { defaultValue: 'Cryptographic audit packet JSON downloaded.' })
      );
    } catch (err: any) {
      console.error('Failed to export JSON audit packet:', err);
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to export JSON audit packet'
      );
    } finally {
      setExportingJson(false);
    }
  };

  const handleCopyChecksum = (checksum: string) => {
    if (!checksum) return;
    navigator.clipboard.writeText(checksum);
    setCopiedChecksum(checksum);
    toast.success('SHA-256 HMAC checksum copied to clipboard');
    setTimeout(() => setCopiedChecksum(null), 2500);
  };

  // Filtered recent completions
  const filteredRecentCompletions = useMemo(() => {
    if (!summary?.recentCompletions) return [];
    if (!recentSearch.trim()) return summary.recentCompletions;
    const query = recentSearch.toLowerCase();
    return summary.recentCompletions.filter(
      (r) =>
        r.workerName.toLowerCase().includes(query) ||
        r.workerEmail.toLowerCase().includes(query) ||
        r.department.toLowerCase().includes(query) ||
        r.journeyTitle.toLowerCase().includes(query) ||
        r.verificationChecksum.toLowerCase().includes(query)
    );
  }, [summary?.recentCompletions, recentSearch]);

  // Aggregate Shift Breakdown from all departments
  const aggregatedShiftData = useMemo(() => {
    let morning = 0;
    let afternoon = 0;
    let night = 0;

    departments.forEach((d) => {
      d.shiftBreakdown?.forEach((s) => {
        if (s.shift.toLowerCase().includes('morning')) morning += s.completions;
        else if (s.shift.toLowerCase().includes('afternoon')) afternoon += s.completions;
        else if (s.shift.toLowerCase().includes('night')) night += s.completions;
      });
    });

    return [
      { shift: 'Morning (06:00 - 14:00)', completions: morning, color: '#f59e0b' },
      { shift: 'Afternoon (14:00 - 22:00)', completions: afternoon, color: '#3b82f6' },
      { shift: 'Night (22:00 - 06:00)', completions: night, color: '#6366f1' }
    ];
  }, [departments]);

  // Status badge styling
  const renderStatusBadge = (status: 'compliant' | 'needs_attention' | 'at_risk' | string, rate: number) => {
    if (rate >= 85 || status === 'compliant') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          {t('compliance.statusCompliant', { defaultValue: 'Compliant (OSHA Ready)' })}
        </span>
      );
    }
    if (rate >= 70 || status === 'needs_attention') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          {t('compliance.statusNeedsAttention', { defaultValue: 'Needs Attention' })}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        {t('compliance.statusAtRisk', { defaultValue: 'At Risk (< 70%)' })}
      </span>
    );
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m 0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className={isTab ? 'space-y-6 pt-2' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6'}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              OSHA Audit Packet Engine
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-300">Regulatory Standard 29 CFR 1910</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Safety Compliance Dashboard
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Enterprise frontline safety tracking, supervisor witness attestations, shift completions, and verifiable cryptographic compliance packets.
          </p>
        </div>

        {/* Global Export & Refresh Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            data-testid="refresh-compliance-btn"
            className="border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh', { defaultValue: 'Refresh' })}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            disabled={exportingJson || loading}
            data-testid="export-json-btn"
            className="border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <FileText className="w-4 h-4 mr-1.5 text-indigo-400" />
            {exportingJson ? 'Exporting...' : 'Audit Packet (JSON)'}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            data-testid="export-compliance-btn"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-900/30 flex items-center gap-1.5 border-0"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Generating CSV...' : 'Export Compliance Report'}
          </Button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <Card className="p-4 bg-white shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Date Range:
            </span>
            <button
              onClick={() => applyDatePreset('all')}
              data-testid="filter-preset-all"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                datePreset === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => applyDatePreset('q1')}
              data-testid="filter-preset-q1"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                datePreset === 'q1'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Q1
            </button>
            <button
              onClick={() => applyDatePreset('q2')}
              data-testid="filter-preset-q2"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                datePreset === 'q2'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Q2
            </button>
            <button
              onClick={() => applyDatePreset('q3')}
              data-testid="filter-preset-q3"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                datePreset === 'q3'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Q3
            </button>
            <button
              onClick={() => applyDatePreset('q4')}
              data-testid="filter-preset-q4"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                datePreset === 'q4'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Q4
            </button>
            <button
              onClick={() => applyDatePreset('30d')}
              data-testid="filter-preset-30d"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                datePreset === '30d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => applyDatePreset('7d')}
              data-testid="filter-preset-7d"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                datePreset === '7d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Last 7 Days
            </button>
          </div>

          {/* Granular Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Custom Date Pickers */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setStartDate(e.target.value);
                }}
                data-testid="start-date-input"
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Start Date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setEndDate(e.target.value);
                }}
                data-testid="end-date-input"
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="End Date"
              />
            </div>

            {/* Journey Filter */}
            <select
              value={selectedJourneyId}
              onChange={(e) => setSelectedJourneyId(e.target.value)}
              data-testid="journey-filter-select"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Safety Journeys</option>
              {journeys.map((j) => (
                <option key={j._id} value={j._id}>
                  {j.title}
                </option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              data-testid="department-filter-select"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.department} value={d.department}>
                  {d.department}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Primary KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Organization-Wide Compliance Rate */}
        <Card className="p-5 border-l-4 border-l-indigo-600 bg-white shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Org Compliance Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-extrabold text-slate-900 tracking-tight"
              data-testid="metric-compliance-percentage"
            >
              {loading ? '--' : `${summary?.completionRate ?? 0}%`}
            </span>
            <span className="text-xs text-slate-400">Target: 85%</span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                (summary?.completionRate ?? 0) >= 85
                  ? 'bg-emerald-500'
                  : (summary?.completionRate ?? 0) >= 70
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(summary?.completionRate ?? 0, 100)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            {renderStatusBadge(summary?.complianceStatus || 'needs_attention', summary?.completionRate || 0)}
            <span className="text-xs text-slate-500 font-medium">
              {summary?.completedSessions ?? 0} / {summary?.totalSessions ?? 0} done
            </span>
          </div>
        </Card>

        {/* Metric 2: Certified Frontline Workers */}
        <Card className="p-5 border-l-4 border-l-emerald-600 bg-white shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Certified Workers
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-extrabold text-slate-900 tracking-tight"
              data-testid="metric-certified-workers"
            >
              {loading ? '--' : summary?.certifiedWorkersCount ?? 0}
            </span>
            <span className="text-xs text-slate-500">
              of {summary?.totalWorkersCount ?? 0} workforce
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${
                  summary?.totalWorkersCount
                    ? Math.round(((summary?.certifiedWorkersCount || 0) / summary.totalWorkersCount) * 100)
                    : 0
                }%`
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Workforce Coverage:</span>
            <span className="font-semibold text-emerald-700">
              {summary?.totalWorkersCount
                ? Math.round(((summary?.certifiedWorkersCount || 0) / summary.totalWorkersCount) * 100)
                : 0}
              %
            </span>
          </div>
        </Card>

        {/* Metric 3: Supervisor Witness Sign-offs */}
        <Card className="p-5 border-l-4 border-l-amber-500 bg-white shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Supervisor Sign-offs
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-extrabold text-slate-900 tracking-tight"
              data-testid="metric-supervisor-signoffs"
            >
              {loading ? '--' : summary?.supervisorSignOffsCount ?? 0}
            </span>
            <span className="text-xs text-slate-500">attestations</span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${
                  summary?.completedSessions
                    ? Math.round(((summary?.supervisorSignOffsCount || 0) / summary.completedSessions) * 100)
                    : 0
                }%`
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Attestation Ratio:</span>
            <span className="font-semibold text-amber-700">
              {summary?.completedSessions
                ? Math.round(((summary?.supervisorSignOffsCount || 0) / summary.completedSessions) * 100)
                : 0}
              % of completions
            </span>
          </div>
        </Card>

        {/* Metric 4: Total Sessions & Avg Duration */}
        <Card className="p-5 border-l-4 border-l-purple-600 bg-white shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Sessions
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-extrabold text-slate-900 tracking-tight"
              data-testid="metric-total-sessions"
            >
              {loading ? '--' : summary?.totalSessions ?? 0}
            </span>
            <span className="text-xs text-slate-500">terminal runs</span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div className="bg-purple-600 h-2 rounded-full w-full" />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Avg Session Time:</span>
            <span className="font-semibold text-purple-700">
              {formatDuration(summary?.averageDurationSeconds || 0)}
            </span>
          </div>
        </Card>
      </div>

      {/* Visual Charts: Historical Trend & Department Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: 6-Week Historical Compliance Trend (2 cols on lg) */}
        <Card className="lg:col-span-2 p-5 bg-white shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Historical Compliance Rate Trend (6 Weeks)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Weekly verified training completion % measured against the OSHA 85% target threshold
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                Completion Rate %
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span className="w-3 h-0.5 border-t border-emerald-500 border-dashed inline-block" />
                OSHA Target (85%)
              </span>
            </div>
          </div>

          <div className="h-64 w-full" data-testid="historical-trend-chart">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Loading compliance telemetry trends...
              </div>
            ) : (summary?.historicalTrends?.length ?? 0) === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No historical trend data for the selected range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={summary?.historicalTrends}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val: any, name: string) => [
                      name === 'completionRate' ? `${val}%` : val,
                      name === 'completionRate'
                        ? 'Completion Rate'
                        : name === 'targetRate'
                        ? 'Regulatory Target'
                        : name
                    ]}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                  <ReferenceLine
                    y={85}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: '85% Target',
                      position: 'top',
                      fill: '#10b981',
                      fontSize: 10
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completionRate"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#trendGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Chart 2: Shift Distribution (1 col on lg) */}
        <Card className="p-5 bg-white shadow-sm border border-slate-200">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              Shift Distribution
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Completed sessions across facility operational shifts
            </p>
          </div>

          <div className="h-64 w-full" data-testid="shift-distribution-chart">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Loading shift telemetry...
              </div>
            ) : aggregatedShiftData.every((s) => s.completions === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
                <Sun className="w-8 h-8 text-slate-300 mb-2" />
                No shift completion logs found for the active period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aggregatedShiftData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    dataKey="shift"
                    type="category"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    width={90}
                    tickFormatter={(val) => val.split(' ')[0]}
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val} sessions`, 'Completed']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="completions" radius={[0, 6, 6, 0]}>
                    {aggregatedShiftData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Chart 3: Department Breakdown Horizontal Bar Chart */}
      <Card className="p-5 bg-white shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Departmental Compliance Rate Comparison
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Completion percentage breakdown across plant departments & divisions
            </p>
          </div>
        </div>

        <div className="h-56 w-full" data-testid="department-breakdown-chart">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Loading department breakdown...
            </div>
          ) : departments.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              No department data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departments}
                margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="department" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: any, name: string) => [
                    `${val}%`,
                    name === 'completionRate' ? 'Compliance Rate' : name
                  ]}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                />
                <ReferenceLine
                  y={85}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{
                    value: '85% Target',
                    position: 'insideTopRight',
                    fill: '#10b981',
                    fontSize: 10
                  }}
                />
                <Bar dataKey="completionRate" radius={[6, 6, 0, 0]}>
                  {departments.map((entry, index) => {
                    const color =
                      entry.completionRate >= 85
                        ? '#10b981'
                        : entry.completionRate >= 70
                        ? '#f59e0b'
                        : '#f43f5e';
                    return <Cell key={`dept-cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Tables Section: Department Breakdown & Recent Verified Completions */}
      <Card className="bg-white shadow-sm border border-slate-200 overflow-hidden">
        {/* Sub-tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 pt-4 gap-6 bg-slate-50/50">
          <button
            onClick={() => setActiveTableTab('departments')}
            data-testid="tab-departments-table"
            className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTableTab === 'departments'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Department Breakdown ({departments.length})
          </button>

          <button
            onClick={() => setActiveTableTab('recent')}
            data-testid="tab-recent-completions"
            className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTableTab === 'recent'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Recent Verified Completions ({summary?.recentCompletions?.length ?? 0})
          </button>
        </div>

        {/* TAB 1: Department Breakdown Table */}
        {activeTableTab === 'departments' && (
          <div className="overflow-x-auto" data-testid="department-table-container">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-6">Department</th>
                  <th className="py-3.5 px-4 text-center">Certified / Total Workers</th>
                  <th className="py-3.5 px-4 text-center">Completed Sessions</th>
                  <th className="py-3.5 px-4 text-center">Supervisor Sign-offs</th>
                  <th className="py-3.5 px-4 text-center">Dropouts</th>
                  <th className="py-3.5 px-6 text-right">Compliance Rate</th>
                  <th className="py-3.5 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading departmental breakdown...
                    </td>
                  </tr>
                ) : departments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No department data found.
                    </td>
                  </tr>
                ) : (
                  departments.map((dept) => (
                    <tr
                      key={dept.department}
                      className="hover:bg-slate-50/80 transition"
                      data-testid={`department-row-${dept.department}`}
                    >
                      <td className="py-4 px-6 font-semibold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {dept.department}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="font-semibold text-slate-800">
                          {dept.certifiedWorkers}
                        </span>{' '}
                        <span className="text-slate-400 text-xs">/ {dept.totalWorkers}</span>
                      </td>
                      <td className="py-4 px-4 text-center font-medium text-slate-700">
                        {dept.completedSessions}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs">
                          <UserCheck className="w-3 h-3 text-amber-600" />
                          {dept.supervisorSignOffs}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center text-xs text-rose-600 font-medium">
                        {dept.dropouts}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${
                                dept.completionRate >= 85
                                  ? 'bg-emerald-500'
                                  : dept.completionRate >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(dept.completionRate, 100)}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-900 w-10 text-right">
                            {dept.completionRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {renderStatusBadge(
                          dept.completionRate >= 85 ? 'compliant' : dept.completionRate >= 70 ? 'needs_attention' : 'at_risk',
                          dept.completionRate
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: Recent Verified Completions Table */}
        {activeTableTab === 'recent' && (
          <div className="p-4 space-y-4">
            {/* Search Input */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  placeholder="Search worker name, email, department..."
                  value={recentSearch}
                  onChange={(e) => setRecentSearch(e.target.value)}
                  className="pl-9 text-xs"
                  data-testid="search-recent-input"
                />
              </div>
              <span className="text-xs text-slate-400">
                Displaying latest verified completions with cryptographic SHA-256 HMAC proofs
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-sm text-slate-600" data-testid="recent-completions-table">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Worker</th>
                    <th className="py-3 px-4">Department / Role</th>
                    <th className="py-3 px-4">Journey</th>
                    <th className="py-3 px-4">Terminal</th>
                    <th className="py-3 px-4">Completed Date</th>
                    <th className="py-3 px-4">Supervisor Witness</th>
                    <th className="py-3 px-4 text-right">Verification Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading verified completion audit records...
                      </td>
                    </tr>
                  ) : filteredRecentCompletions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No verified completions found.
                      </td>
                    </tr>
                  ) : (
                    filteredRecentCompletions.map((record) => (
                      <tr key={record.sessionId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{record.workerName}</div>
                          <div className="text-xs text-slate-400">{record.workerEmail}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="font-medium text-slate-800">{record.department}</div>
                          <div className="text-slate-400">{record.jobTitle}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-indigo-700">
                          {record.journeyTitle}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="font-medium text-slate-700">{record.deviceName}</div>
                          <div className="text-slate-400">{record.deviceLocation}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {record.completedAt
                            ? new Date(record.completedAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {record.supervisorWitness ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {record.supervisorWitness.supervisorName} (
                              {record.supervisorWitness.method})
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Self-attested</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {record.verificationChecksum ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <code className="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200 max-w-[130px] truncate">
                                {record.verificationChecksum}
                              </code>
                              <button
                                onClick={() => handleCopyChecksum(record.verificationChecksum)}
                                title="Copy verification checksum"
                                data-testid={`copy-checksum-${record.sessionId}`}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition"
                              >
                                {copiedChecksum === record.verificationChecksum ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">--</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default KioskComplianceDashboard;
