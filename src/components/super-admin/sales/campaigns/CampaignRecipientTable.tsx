import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  MousePointerClick,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Input } from '../../../Input';
import { Button } from '../../../Button';
import { Badge } from '../../../Badge';
import { CampaignRecipient } from '../../../../services/salesCampaign.service';

interface CampaignRecipientTableProps {
  recipients: CampaignRecipient[];
  channel: 'email' | 'whatsapp';
  campaignName: string;
}

export const CampaignRecipientTable: React.FC<CampaignRecipientTableProps> = ({
  recipients = [],
  channel,
  campaignName,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filtered recipients
  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'opened' && (r.status === 'opened' || r.status === 'read')) {
          // match both opened & read
        } else if (r.status !== statusFilter) {
          return false;
        }
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (r.recipientName || '').toLowerCase().includes(q);
        const matchEmail = (r.recipientEmail || '').toLowerCase().includes(q);
        const matchPhone = (r.recipientPhone || '').toLowerCase().includes(q);
        const matchErr = (r.errorMessage || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchErr) {
          return false;
        }
      }

      return true;
    });
  }, [recipients, statusFilter, search]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredRecipients.length / pageSize));
  const paginatedRecipients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecipients.slice(start, start + pageSize);
  }, [filteredRecipients, currentPage, pageSize]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRecipients.length === 0) return;

    const headers = ['Recipient Name', 'Destination', 'Status', 'Sent At', 'Delivered At', 'Error Reason'];
    const rows = filteredRecipients.map((r) => [
      `"${r.recipientName || 'Anonymous'}"`,
      `"${channel === 'email' ? r.recipientEmail || '' : r.recipientPhone || ''}"`,
      `"${r.status}"`,
      `"${r.sentAt ? new Date(r.sentAt).toISOString() : ''}"`,
      `"${r.deliveredAt ? new Date(r.deliveredAt).toISOString() : ''}"`,
      `"${(r.errorMessage || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${campaignName.replace(/[^a-zA-Z0-9_-]/g, '_')}_recipients_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Delivered
          </Badge>
        );
      case 'opened':
      case 'read':
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 gap-1 text-[11px]">
            <Eye className="w-3 h-3" /> {status === 'read' ? 'Read' : 'Opened'}
          </Badge>
        );
      case 'clicked':
        return (
          <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 gap-1 text-[11px]">
            <MousePointerClick className="w-3 h-3" /> Clicked
          </Badge>
        );
      case 'sent':
        return (
          <Badge variant="secondary" className="bg-sky-500/10 text-sky-600 dark:text-sky-400 gap-1 text-[11px]">
            <Clock className="w-3 h-3" /> Sent
          </Badge>
        );
      case 'bounced':
        return (
          <Badge variant="destructive" className="gap-1 text-[11px]">
            <AlertCircle className="w-3 h-3" /> Bounced
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1 text-[11px]">
            <XCircle className="w-3 h-3" /> Failed
          </Badge>
        );
      case 'queued':
      case 'pending':
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
            <Clock className="w-3 h-3" /> {status || 'Pending'}
          </Badge>
        );
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm space-y-4 p-5">
      {/* Table Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Recipient Delivery Log
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {`Inspecting all ${recipients.length.toLocaleString()} targeted recipients across delivery lifecycle.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-muted-foreground" />
            <Input
              placeholder="Search recipient..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 h-9 text-xs"
            />
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              aria-label="Filter by recipient status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened / Read</option>
              <option value="clicked">Clicked</option>
              <option value="bounced">Bounced</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredRecipients.length === 0}
            className="gap-1 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Recipients Data Table */}
      <div className="overflow-x-auto border border-border/80 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
            <tr>
              <th className="py-2.5 px-3.5">Recipient</th>
              <th className="py-2.5 px-3.5">Destination</th>
              <th className="py-2.5 px-3.5">Status</th>
              <th className="py-2.5 px-3.5">Sent Timestamp</th>
              <th className="py-2.5 px-3.5">Delivered Timestamp</th>
              <th className="py-2.5 px-3.5">Error / Diagnostics</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginatedRecipients.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  No recipients found matching current search and filter criteria.
                </td>
              </tr>
            ) : (
              paginatedRecipients.map((r, idx) => (
                <tr key={r._id || idx} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3.5 font-medium text-foreground">
                    {r.recipientName || 'Anonymous'}
                  </td>
                  <td className="py-2.5 px-3.5 text-muted-foreground font-mono">
                    <div className="flex items-center gap-1.5">
                      {channel === 'email' ? (
                        <>
                          <Mail className="w-3 h-3 text-muted-foreground/70" />
                          <span>{r.recipientEmail || '—'}</span>
                        </>
                      ) : (
                        <>
                          <Phone className="w-3 h-3 text-muted-foreground/70" />
                          <span>{r.recipientPhone || '—'}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3.5">{getStatusBadge(r.status)}</td>
                  <td className="py-2.5 px-3.5 text-muted-foreground">
                    {r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-2.5 px-3.5 text-muted-foreground">
                    {r.deliveredAt ? new Date(r.deliveredAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-2.5 px-3.5 max-w-xs truncate text-muted-foreground">
                    {r.errorMessage ? (
                      <span className="text-destructive font-mono text-[11px]" title={r.errorMessage}>
                        {r.errorMessage}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span>
          {`Showing ${paginatedRecipients.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to ${Math.min(
            currentPage * pageSize,
            filteredRecipients.length
          )} of ${filteredRecipients.length.toLocaleString()} recipients`}
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-7 px-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="font-medium text-foreground">
            {`Page ${currentPage} of ${totalPages}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="h-7 px-2"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CampaignRecipientTable;
