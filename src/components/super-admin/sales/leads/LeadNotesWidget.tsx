import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, Send, User, Clock } from 'lucide-react';
import { Button } from '../../../../components/Button';
import { salesService, LeadItem } from '../../../../services/sales.service';

interface LeadNotesWidgetProps {
  lead: LeadItem;
  onNoteAdded?: () => void;
}

export function LeadNotesWidget({ lead, onNoteAdded }: LeadNotesWidgetProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

  const mutation = useMutation({
    mutationFn: (newContent: string) => salesService.addLeadNote(lead._id, newContent),
    onSuccess: () => {
      toast.success('Internal note added to lead');
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales-lead', lead._id] });
      if (onNoteAdded) onNoteAdded();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to add note';
      toast.error(msg);
    },
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Note content cannot be empty');
      return;
    }
    mutation.mutate(content.trim());
  };

  const notes = lead.notes || [];

  return (
    <div className="space-y-5">
      {/* Note Composer Form */}
      <form onSubmit={handleAddNote} className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="lead-note-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            Add Internal CRM Note
          </label>
          <span className="text-[10px] text-slate-400">Visible to Super Admins</span>
        </div>

        <textarea
          id="lead-note-input"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Record call summary, client expectations, pain points, or next steps..."
          className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        />

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {content.length} characters
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !content.trim()}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 h-8 px-3"
          >
            <Send className="w-3 h-3" />
            {mutation.isPending ? 'Saving...' : 'Post Note'}
          </Button>
        </div>
      </form>

      {/* Notes List */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
          <span>Logged Notes</span>
          <span className="text-[11px] font-normal lowercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
        </h4>

        {notes.length === 0 ? (
          <div className="text-center py-8 px-4 bg-white rounded-xl border border-dashed border-slate-200">
            <MessageSquare className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">No notes posted yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Use the composer above to log key insights, meeting notes, or follow-up details.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notes
              .slice()
              .reverse()
              .map((note, idx) => {
                const author = note.createdBy?.name || note.createdBy?.email || 'Super Admin';
                const formattedDate = new Date(note.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={note._id || idx}
                    className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                          <User className="w-3 h-3" />
                        </div>
                        <span>{author}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

export default LeadNotesWidget;
