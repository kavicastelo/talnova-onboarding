import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ThreadListPane } from '../components/super-admin/sales/inbox/ThreadListPane';
import { MessageStreamPane } from '../components/super-admin/sales/inbox/MessageStreamPane';
import { LeadContextSidebar } from '../components/super-admin/sales/inbox/LeadContextSidebar';
import { MessageComposer } from '../components/super-admin/sales/inbox/MessageComposer';
import { SalesInboxPage } from '../pages/super-admin/sales/SalesInboxPage';
import { ICommThread, InboxCounters } from '../services/salesInbox.service';

describe('INB-002: Super Admin Unified Inbox UI & Response Composer Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCounters: InboxCounters = {
    total: 3,
    open: 1,
    pending: 1,
    resolved: 1,
    unread: 1,
  };

  const mockEmailThread: ICommThread = {
    _id: 'thread-email-1',
    channel: 'email',
    status: 'open',
    subject: 'Enterprise Cloud Architecture Inquiry',
    lastMessageSnippet: 'Can we schedule a 15 min call to review integration?',
    lastMessageAt: '2026-10-18T14:30:00.000Z',
    createdAt: '2026-10-18T12:00:00.000Z',
    updatedAt: '2026-10-18T14:30:00.000Z',
    leadId: {
      _id: 'lead-1',
      firstName: 'Sarah',
      lastName: 'Connor',
      fullName: 'Sarah Connor',
      email: 'sarah.connor@cyberdyne.test',
      phone: '+15551234567',
      companyName: 'Cyberdyne Systems',
      status: 'qualified',
      leadScore: 88,
    },
    contactId: {
      _id: 'contact-1',
      firstName: 'Sarah',
      lastName: 'Connor',
      fullName: 'Sarah Connor',
      email: 'sarah.connor@cyberdyne.test',
      phone: '+15551234567',
      jobTitle: 'VP of Technology',
      role: 'buyer',
    },
    companyId: {
      _id: 'company-1',
      name: 'Cyberdyne Systems',
      domain: 'cyberdyne.test',
      industry: 'Defense & Robotics',
      size: '501-1000',
    },
    dealId: {
      _id: 'deal-1',
      name: 'Cyberdyne Global Platform Deployment',
      stage: 'proposal',
      value: 175000,
      currency: 'USD',
    },
    assignedTo: {
      _id: 'usr-admin-1',
      name: 'Super Admin',
      email: 'admin@talnova.io',
      role: 'super_admin',
    },
    messages: [
      {
        _id: 'msg-1',
        channel: 'email',
        direction: 'inbound',
        from: 'sarah.connor@cyberdyne.test',
        to: ['sales@talnova.io'],
        subject: 'Enterprise Cloud Architecture Inquiry',
        body: 'Can we schedule a 15 min call to review integration?',
        status: 'delivered', // unread
        sentAt: '2026-10-18T14:30:00.000Z',
      },
      {
        _id: 'msg-2',
        channel: 'email',
        direction: 'outbound',
        from: 'sales@talnova.io',
        to: ['sarah.connor@cyberdyne.test'],
        subject: 'Re: Enterprise Cloud Architecture Inquiry',
        body: 'Hi Sarah, absolutely! We would be glad to walk through the architecture.',
        status: 'read',
        sentAt: '2026-10-18T14:45:00.000Z',
        metadata: {
          sentByName: 'Alex Mercer',
        },
      },
    ],
  };

  const mockWhatsAppThread: ICommThread = {
    _id: 'thread-wa-2',
    channel: 'whatsapp',
    status: 'resolved',
    subject: 'WhatsApp API Support Session',
    lastMessageSnippet: 'All credentials updated and tested. Thanks!',
    lastMessageAt: '2026-10-18T11:00:00.000Z',
    createdAt: '2026-10-18T09:00:00.000Z',
    updatedAt: '2026-10-18T11:00:00.000Z',
    leadId: {
      _id: 'lead-2',
      firstName: 'Marcus',
      lastName: 'Wright',
      fullName: 'Marcus Wright',
      email: 'marcus@resistance.test',
      phone: '+15559876543',
      companyName: 'Resistance Logistics',
      status: 'customer',
      leadScore: 92,
    },
    companyId: {
      _id: 'company-2',
      name: 'Resistance Logistics',
      domain: 'resistance.test',
      industry: 'Logistics & Supply Chain',
    },
    assignedTo: {
      _id: 'usr-admin-1',
      name: 'Super Admin',
      email: 'admin@talnova.io',
      role: 'super_admin',
    },
    messages: [
      {
        _id: 'msg-wa-1',
        channel: 'whatsapp',
        direction: 'inbound',
        from: '+15559876543',
        to: ['+18005550000'],
        body: 'Need quick assistance with API token generation.',
        status: 'read',
        sentAt: '2026-10-18T09:00:00.000Z',
      },
      {
        _id: 'msg-wa-2',
        channel: 'whatsapp',
        direction: 'outbound',
        from: '+18005550000',
        to: ['+15559876543'],
        body: 'All credentials updated and tested. Thanks!',
        status: 'read',
        sentAt: '2026-10-18T11:00:00.000Z',
      },
    ],
  };

  /* ========================================================================= */
  /* 1. ThreadListPane Tests                                                   */
  /* ========================================================================= */
  describe('1. ThreadListPane Component', () => {
    it('should render zero-mock clean empty state when threads list is empty', () => {
      const html = renderToString(
        <ThreadListPane
          threads={[]}
          selectedThreadId={null}
          onSelectThread={vi.fn()}
          onChangeChannelFilter={vi.fn()}
          onChangeStatusFilter={vi.fn()}
          unreadOnly={false}
          onToggleUnreadOnly={vi.fn()}
          searchQuery=""
          onSearchChange={vi.fn()}
          counters={{ total: 0, open: 0, pending: 0, resolved: 0, unread: 0 }}
        />
      );

      expect(html).toContain('No conversations found');
      expect(html).toContain('Inbound replies to outreach campaigns');
    });

    it('should render multi-channel thread cards with counterparty info and channel badges', () => {
      const html = renderToString(
        <ThreadListPane
          threads={[mockEmailThread, mockWhatsAppThread]}
          selectedThreadId="thread-email-1"
          onSelectThread={vi.fn()}
          onChangeChannelFilter={vi.fn()}
          onChangeStatusFilter={vi.fn()}
          unreadOnly={false}
          onToggleUnreadOnly={vi.fn()}
          searchQuery=""
          onSearchChange={vi.fn()}
          counters={mockCounters}
        />
      );

      expect(html).toContain('Sarah Connor');
      expect(html).toContain('Cyberdyne Systems');
      expect(html).toContain('Marcus Wright');
      expect(html).toContain('Resistance Logistics');
      expect(html).toContain('Enterprise Cloud Architecture Inquiry');
      expect(html).toContain('WhatsApp API Support Session');

      // Counters check
      expect(html).toContain('All (<!-- -->3<!-- -->)');
      expect(html).toContain('Open (<!-- -->2<!-- -->)');
      expect(html).toContain('Resolved (<!-- -->1<!-- -->)');
      expect(html).toContain('Unread (<!-- -->1<!-- -->)');
    });
  });

  /* ========================================================================= */
  /* 2. MessageStreamPane Tests                                                */
  /* ========================================================================= */
  describe('2. MessageStreamPane Component', () => {
    it('should render thread header, status dropdown, and chronological message bubbles', () => {
      const html = renderToString(
        <MemoryRouter>
          <MessageStreamPane
            thread={mockEmailThread}
            onSendReply={vi.fn()}
            onUpdateStatus={vi.fn()}
            onMarkRead={vi.fn()}
            onRefresh={vi.fn()}
            isSidebarOpen={true}
            onToggleSidebar={vi.fn()}
          />
        </MemoryRouter>
      );

      // Header verification
      expect(html).toContain('Sarah Connor');
      expect(html).toContain('Cyberdyne Systems');
      expect(html).toContain('Email');
      expect(html).toContain('Mark Read');

      // Message stream verification
      expect(html).toContain('Can we schedule a 15 min call to review integration?');
      expect(html).toContain('Hi Sarah, absolutely! We would be glad to walk through the architecture.');
      expect(html).toContain('Alex Mercer');

      // Composer verification inside stream
      expect(html).toContain('Send Reply');
      expect(html).toContain('Quick Replies');
    });
  });

  /* ========================================================================= */
  /* 3. LeadContextSidebar (Customer 360) Tests                                */
  /* ========================================================================= */
  describe('3. LeadContextSidebar Component', () => {
    it('should render customer details, lead score badge, and linked deal details', () => {
      const html = renderToString(
        <MemoryRouter>
          <LeadContextSidebar
            thread={mockEmailThread}
            isOpen={true}
            onToggle={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(html).toContain('Customer 360');
      expect(html).toContain('Sarah Connor');
      expect(html).toContain('VP of Technology');
      expect(html).toContain('Cyberdyne Systems');
      expect(html).toContain('Score <!-- -->88');
      expect(html).toContain('View Full Lead Record');

      // Deal details
      expect(html).toContain('Cyberdyne Global Platform Deployment');
      expect(html).toContain('$175,000');
      expect(html).toContain('Open in Pipeline Kanban');
    });

    it('should collapse into compact trigger button when isOpen is false', () => {
      const html = renderToString(
        <MemoryRouter>
          <LeadContextSidebar
            thread={mockEmailThread}
            isOpen={false}
            onToggle={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(html).not.toContain('id="inbox-lead-context-sidebar"');
      expect(html).toContain('Expand Customer 360 Context');
    });
  });

  /* ========================================================================= */
  /* 4. MessageComposer Tests                                                  */
  /* ========================================================================= */
  describe('4. MessageComposer Component', () => {
    it('should render channel-specific controls for email with subject input and quick replies', () => {
      const html = renderToString(
        <MessageComposer
          thread={mockEmailThread}
          onSend={vi.fn()}
        />
      );

      expect(html).toContain('Email Channel');
      expect(html).toContain('Re: Enterprise Cloud Architecture Inquiry');
      expect(html).toContain('Quick Replies');
      expect(html).toContain('Send Reply');
      expect(html).toContain('After Send:');
      expect(html).toContain('Mark Pending (Awaiting Reply)');
    });

    it('should adapt to WhatsApp channel by omitting subject input and adapting placeholder', () => {
      const html = renderToString(
        <MessageComposer
          thread={mockWhatsAppThread}
          onSend={vi.fn()}
        />
      );

      expect(html).toContain('WhatsApp Channel');
      expect(html).not.toContain('Re: WhatsApp API Support Session');
      expect(html).toContain('Type WhatsApp reply');
    });
  });

  /* ========================================================================= */
  /* 5. SalesInboxPage Tests                                                   */
  /* ========================================================================= */
  describe('5. SalesInboxPage Page Container', () => {
    it('should render page breadcrumbs, title, header actions, and unified container', () => {
      const html = renderToString(
        <MemoryRouter>
          <SalesInboxPage />
        </MemoryRouter>
      );

      expect(html).toContain('Unified Communication Inbox');
      expect(html).toContain('Platform Control');
      expect(html).toContain('Sales &amp; Acquisition');
      expect(html).toContain('New Campaign');
      expect(html).toContain('unified-inbox-container');
    });
  });
});
