import React, { useState, useMemo } from 'react';
import { RepLeaderboardData } from '../../../../services/salesAnalytics.service';
import {
  Trophy,
  Search,
  ArrowUpDown,
  DollarSign,
  Briefcase,
  Percent,
  Layers,
} from 'lucide-react';

export interface RepPerformanceTableProps {
  data: RepLeaderboardData | null;
  loading?: boolean;
}

type SortField = 'totalBookings' | 'winRate' | 'dealsWon' | 'activePipelineValue' | 'quotaAttainment';

export const RepPerformanceTable: React.FC<RepPerformanceTableProps> = ({
  data,
  loading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('totalBookings');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const reps = data?.reps || [];
  const teamSummary = data?.teamSummary || {
    totalBookings: 0,
    totalDealsWon: 0,
    teamWinRate: 0,
    averageDealSize: 0,
    totalActivePipeline: 0,
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Filter and sort reps
  const filteredAndSortedReps = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = reps.filter(
      (r) =>
        r.repName.toLowerCase().includes(q) ||
        r.repEmail.toLowerCase().includes(q)
    );

    result.sort((a, b) => {
      const valA = a[sortField] || 0;
      const valB = b[sortField] || 0;
      return sortDirection === 'desc' ? valB - valA : valA - valB;
    });

    return result;
  }, [reps, searchQuery, sortField, sortDirection]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header and Team Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Trophy className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Sales Representative Performance Leaderboard
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Individual rep win rates, bookings, quota attainment, and active open pipeline attribution
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search rep by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Team Aggregates Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
        <div>
          <p className="text-[10px] uppercase font-semibold text-slate-500 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-600" />
            Total Bookings
          </p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">
            {formatCurrency(teamSummary.totalBookings)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-slate-500 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-600" />
            Deals Won
          </p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">
            {`${teamSummary.totalDealsWon} deals`}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-slate-500 flex items-center gap-1">
            <Percent className="w-3 h-3 text-indigo-600" />
            Team Win Rate
          </p>
          <p className="text-sm font-bold text-indigo-950 mt-0.5">
            {`${teamSummary.teamWinRate}%`}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-slate-500">
            Avg Deal Size
          </p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">
            {formatCurrency(teamSummary.averageDealSize)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-slate-500 flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-purple-600" />
            Active Pipeline
          </p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">
            {formatCurrency(teamSummary.totalActivePipeline)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Sales Representative</th>
              <th className="py-3 px-3">Deals (Won / Lost)</th>
              <th
                onClick={() => handleSort('winRate')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Win Rate
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('totalBookings')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Bookings &amp; Avg Size
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('activePipelineValue')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Active Pipeline
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('quotaAttainment')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-1">
                  Quota Attainment
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span>Aggregating sales rep leaderboards…</span>
                  </div>
                </td>
              </tr>
            ) : filteredAndSortedReps.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Layers className="w-6 h-6 text-slate-300" />
                    <span>No sales representatives recorded in this period</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedReps.map((rep, idx) => {
                const isTopRep = idx === 0 && rep.totalBookings > 0;
                return (
                  <tr
                    key={rep.repId}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      isTopRep ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Representative Name & Email */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {rep.avatarUrl ? (
                          <img
                            src={rep.avatarUrl}
                            alt={rep.repName}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {rep.repName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                            <span>{rep.repName}</span>
                            {isTopRep && (
                              <span title="Leaderboard Rank 1">
                                <Trophy className="w-3.5 h-3.5 text-amber-500 inline" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">{rep.repEmail}</p>
                        </div>
                      </div>
                    </td>

                    {/* Deals won vs lost */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-emerald-700">
                        {`${rep.dealsWon} won`}
                      </span>{' '}
                      / <span className="text-slate-500">{`${rep.dealsLost} lost`}</span>
                      <p className="text-[10px] text-slate-400">{`${rep.dealsClosed} closed`}</p>
                    </td>

                    {/* Win rate */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          rep.winRate >= 60
                            ? 'bg-emerald-100 text-emerald-800'
                            : rep.winRate >= 40
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {`${rep.winRate}%`}
                      </span>
                    </td>

                    {/* Bookings & Avg Size */}
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{formatCurrency(rep.totalBookings)}</p>
                      <p className="text-[10px] text-slate-400">
                        Avg: {formatCurrency(rep.averageDealSize)}
                      </p>
                    </td>

                    {/* Active Pipeline */}
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(rep.activePipelineValue)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {`${rep.openDealsCount} open deals`}
                      </p>
                    </td>

                    {/* Quota Progress Bar */}
                    <td className="py-3 px-4 min-w-40">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-500">{`Target: ${formatCurrency(rep.quotaTarget)}`}</span>
                        <span
                          className={`font-bold ${
                            rep.quotaAttainment >= 100
                              ? 'text-emerald-700'
                              : rep.quotaAttainment >= 75
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {`${rep.quotaAttainment}%`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            rep.quotaAttainment >= 100
                              ? 'bg-emerald-500'
                              : rep.quotaAttainment >= 75
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min(100, rep.quotaAttainment)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RepPerformanceTable;
