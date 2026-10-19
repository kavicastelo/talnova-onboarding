import { useMemo } from 'react';
import {
  Clock,
  Sparkles,
  MessageSquare,
  Tag,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { LeadItem } from '../../../../services/sales.service';

interface LeadTimelineProps {
  lead: LeadItem;
}

interface TimelineEvent {
  id: string;
  type: 'creation' | 'score' | 'note' | 'status' | 'contact' | 'followup';
  title: string;
  description?: string;
  timestamp: string | Date;
  badge?: string;
  badgeColor?: string;
  icon: typeof Clock;
}

export function LeadTimeline({ lead }: LeadTimelineProps) {
  const events = useMemo(() => {
    const list: TimelineEvent[] = [];

    // 1. Lead Created Event
    if (lead.createdAt) {
      list.push({
        id: `created-${lead._id}`,
        type: 'creation',
        title: 'Lead Captured',
        description: `Captured via ${lead.source.replace('_', ' ')} channel into CRM.`,
        timestamp: lead.createdAt,
        badge: 'Created',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        icon: Sparkles,
      });
    }

    // 2. Score breakdown events
    if (lead.scoreBreakdown && lead.scoreBreakdown.length > 0) {
      lead.scoreBreakdown.forEach((sb, idx) => {
        const sign = sb.points >= 0 ? '+' : '';
        list.push({
          id: `score-${idx}-${sb.rule}`,
          type: 'score',
          title: `Scoring Rule: ${sb.rule}`,
          description: `Applied rule adjustments to lead qualification rating.`,
          timestamp: sb.timestamp || lead.updatedAt,
          badge: `${sign}${sb.points} pts`,
          badgeColor:
            sb.points >= 0
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-rose-100 text-rose-800 border-rose-200',
          icon: Tag,
        });
      });
    }

    // 3. Notes events
    if (lead.notes && lead.notes.length > 0) {
      lead.notes.forEach((n, idx) => {
        const author = n.createdBy?.name || n.createdBy?.email || 'Super Admin';
        list.push({
          id: `note-${idx}-${n._id || idx}`,
          type: 'note',
          title: `Note Added by ${author}`,
          description: n.content,
          timestamp: n.createdAt,
          badge: 'Note',
          badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: MessageSquare,
        });
      });
    }

    // 4. Last contact date
    if (lead.lastContactDate) {
      list.push({
        id: `contact-${lead.lastContactDate}`,
        type: 'contact',
        title: 'Prospect Interaction Recorded',
        description: 'Customer contact logged on record.',
        timestamp: lead.lastContactDate,
        badge: 'Touchpoint',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: CheckCircle2,
      });
    }

    // 5. Next follow-up date
    if (lead.nextFollowUpDate) {
      list.push({
        id: `followup-${lead.nextFollowUpDate}`,
        type: 'followup',
        title: 'Follow-Up Scheduled',
        description: 'Scheduled next action with decision maker.',
        timestamp: lead.nextFollowUpDate,
        badge: 'Scheduled',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: Calendar,
      });
    }

    // Sort descending (most recent first)
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [lead]);

  if (events.length === 0) {
    return (
      <div className="py-12 px-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">No timeline activity recorded yet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Activity will automatically populate as notes, status changes, and scoring events occur on this lead.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {events.map((event) => {
        const IconComponent = event.icon;
        const formattedDate = new Date(event.timestamp).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div key={event.id} className="relative group">
            {/* Timeline node dot */}
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <IconComponent className="w-4 h-4 text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-900">{event.title}</h4>
                </div>
                {event.badge && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      event.badgeColor || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {event.badge}
                  </span>
                )}
              </div>

              {event.description && (
                <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap leading-relaxed">
                  {event.description}
                </p>
              )}

              <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default LeadTimeline;
