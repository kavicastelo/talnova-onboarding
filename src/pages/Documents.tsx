import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Send,
  CheckCircle2,
  Building2,
  ArrowRight,
  ShieldCheck,
  Edit3
} from 'lucide-react';
import {
  useDocumentTemplates,
  useEmployeeDocumentInbox,
  useCreateDocumentTemplate,
  useUpdateDocumentTemplate,
  useTemplateSignatures,
  useAssignDocument
} from '../hooks/useDocuments';
import { useRole } from '../context/RoleContext';
import { useEmployees } from '../hooks/useEmployees';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/Card';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { SearchableSelect } from '../components/SearchableSelect';
import { usePagination } from '../hooks/usePagination';
import { useTranslation } from 'react-i18next';

export const Documents: React.FC = () => {
  const { t } = useTranslation(['documents', 'common']);
  const navigate = useNavigate();
  const { role } = useRole();
  const isAdmin = role === 'admin' || role === 'owner';

  const [activeTab, setActiveTab] = useState<'inbox' | 'templates'>(isAdmin ? 'templates' : 'inbox');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isSignaturesModalOpen, setIsSignaturesModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [signaturesTemplate, setSignaturesTemplate] = useState<any>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');

  // Template Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'nda' | 'code_of_conduct' | 'offer_letter' | 'handbook' | 'direct_deposit' | 'custom'>('custom');
  const [newContent, setNewContent] = useState('');
  const [requireSignature, setRequireSignature] = useState(true);
  const [isMandatory, setIsMandatory] = useState(false);
  const [autoAssign, setAutoAssign] = useState(false);

  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = useDocumentTemplates();
  const { data: inbox, isLoading: inboxLoading } = useEmployeeDocumentInbox();
  const { data: employeesData } = useEmployees({ page: 1, limit: 1000 });
  const { data: signatures, isLoading: signaturesLoading } = useTemplateSignatures(signaturesTemplate?._id || null);

  const createTemplateMutation = useCreateDocumentTemplate();
  const updateTemplateMutation = useUpdateDocumentTemplate();
  const assignDocumentMutation = useAssignDocument();

  const employees = employeesData?.employees || [];

  const templatesPagination = usePagination({ data: templates || [], initialPageSize: 6 });
  const inboxPagination = usePagination({ data: inbox || [], initialPageSize: 10 });

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setNewTitle('');
    setNewCategory('custom');
    setNewContent('');
    setRequireSignature(true);
    setIsMandatory(false);
    setAutoAssign(false);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (template: any) => {
    setEditingTemplate(template);
    setNewTitle(template.title);
    setNewCategory(template.category);
    setNewContent(template.content);
    setRequireSignature(template.signatureRequired !== false);
    setIsMandatory(template.isMandatory === true);
    setAutoAssign(template.audience?.autoAssignNewHires === true);
    setIsCreateModalOpen(true);
  };

  const handleOpenSignatures = (template: any) => {
    setSignaturesTemplate(template);
    setIsSignaturesModalOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error(t('toasts.validationError', { defaultValue: 'Please enter a valid title and document content.' }));
      return;
    }

    if (editingTemplate) {
      updateTemplateMutation.mutate(
        {
          id: editingTemplate._id,
          data: {
            title: newTitle,
            category: newCategory,
            content: newContent,
            signatureRequired: requireSignature,
            isMandatory: isMandatory,
            audience: { autoAssignNewHires: autoAssign },
          },
        },
        {
          onSuccess: () => {
            toast.success(t('toasts.templateUpdated', { defaultValue: 'Document template updated successfully!' }));
            setIsCreateModalOpen(false);
            setEditingTemplate(null);
            refetchTemplates();
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || t('toasts.updateTemplateError', { defaultValue: 'Failed to update template' }));
          },
        }
      );
    } else {
      createTemplateMutation.mutate(
        {
          title: newTitle,
          category: newCategory,
          content: newContent,
          signatureRequired: requireSignature,
          isMandatory: isMandatory,
          audience: { autoAssignNewHires: autoAssign },
        },
        {
          onSuccess: () => {
            toast.success(t('toasts.templateCreated', { defaultValue: 'Document template created successfully!' }));
            setIsCreateModalOpen(false);
            setNewTitle('');
            setNewContent('');
            setRequireSignature(true);
            setIsMandatory(false);
            setAutoAssign(false);
            refetchTemplates();
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || t('toasts.createTemplateError', { defaultValue: 'Failed to create template' }));
          },
        }
      );
    }
  };

  const handleAssignDocument = () => {
    if (!selectedTemplateId || !selectedEmpId) {
      toast.error(t('toasts.selectTemplateAndEmp', { defaultValue: 'Please select a template and target employee.' }));
      return;
    }

    assignDocumentMutation.mutate(
      { templateId: selectedTemplateId, employeeId: selectedEmpId },
      {
        onSuccess: () => {
          toast.success(t('toasts.documentAssigned', { defaultValue: 'Document assigned to employee successfully!' }));
          setIsAssignModalOpen(false);
          setSelectedTemplateId(null);
          setSelectedEmpId('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.assignDocumentError', { defaultValue: 'Failed to assign document' }));
        },
      }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-indigo-600" />
            {t('title', { defaultValue: 'Digital Documents & E-Signatures' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle', { defaultValue: 'Manage onboarding document templates, set mandatory compliance rules, and audit cryptographic signatures.' })}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              id="create-template-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4" /> {t('createTemplate', { defaultValue: 'Create Document Template' })}
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b text-sm font-medium">
        {isAdmin && (
          <button
            id="tab-templates"
            className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('templates')}
          >
            <Building2 className="h-4 w-4" /> {t('tabs.templates', { count: templates?.length || 0, defaultValue: `Document Templates (${templates?.length || 0})` })}
          </button>
        )}
        <button
          id="tab-inbox"
          className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'inbox'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('inbox')}
        >
          <FileText className="h-4 w-4" /> {t('tabs.inbox', { count: inbox?.length || 0, defaultValue: `My Document Inbox (${inbox?.length || 0})` })}
        </button>
      </div>

    {/* Tab 1: Document Templates (Admin View) */}
    {activeTab === 'templates' && isAdmin && (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="document-templates-catalog">
          {templatesLoading ? (
            <div className="col-span-full p-8 text-center text-muted-foreground">{t('templates.loading', { defaultValue: 'Loading templates...' })}</div>
          ) : (templates || []).length === 0 ? (
            <div className="col-span-full p-8 text-center text-muted-foreground">
              {t('templates.empty', { defaultValue: 'No document templates created yet. Click "Create Document Template" to add an agreement.' })}
            </div>
          ) : (
            templatesPagination.paginatedData.map((tmpl) => (
              <Card key={tmpl._id} className="hover:border-indigo-500/50 transition-all flex flex-col justify-between shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {tmpl.category === 'nda'
                          ? t('createModal.categories.nda', { defaultValue: 'Non-Disclosure Agreement (NDA)' })
                          : tmpl.category === 'code_of_conduct'
                          ? t('createModal.categories.codeOfConduct', { defaultValue: 'Code of Conduct' })
                          : tmpl.category === 'offer_letter'
                          ? t('createModal.categories.offerLetter', { defaultValue: 'Offer Letter' })
                          : tmpl.category === 'handbook'
                          ? t('createModal.categories.handbook', { defaultValue: 'Employee Handbook Acknowledgment' })
                          : tmpl.category === 'direct_deposit'
                          ? t('createModal.categories.directDeposit', { defaultValue: 'Direct Deposit Form' })
                          : tmpl.category.replace('_', ' ')}
                      </Badge>
                      {tmpl.isMandatory && (
                        <Badge
                          id={`mandatory-badge-${tmpl._id}`}
                          className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] font-semibold"
                        >
                          {t('templates.mandatory', { defaultValue: 'Mandatory' })}
                        </Badge>
                      )}
                      {tmpl.signatureRequired && (
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]">
                          {t('templates.requireSignature', { defaultValue: 'Require Signature' })}
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-muted text-[10px]">
                      v{tmpl.version}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold mt-2">{tmpl.title}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">
                    {tmpl.description || tmpl.content?.substring(0, 100) || t('templates.defaultDesc', { defaultValue: 'Standard electronic document template.' })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {tmpl.audience?.autoAssignNewHires && (
                    <div className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t('templates.autoAssign', { defaultValue: 'Auto-assigns to all new hires' })}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <Button
                      id={`view-signatures-btn-${tmpl._id}`}
                      variant="outline"
                      size="sm"
                      className="text-xs flex items-center justify-center gap-1"
                      onClick={() => handleOpenSignatures(tmpl)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> {t('templates.viewSignatures', { defaultValue: 'View Signatures' })}
                    </Button>
                    <Button
                      id={`edit-template-btn-${tmpl._id}`}
                      variant="outline"
                      size="sm"
                      className="text-xs flex items-center justify-center gap-1"
                      onClick={() => handleOpenEdit(tmpl)}
                    >
                      <Edit3 className="h-3.5 w-3.5 text-muted-foreground" /> {t('templates.edit', { defaultValue: 'Edit' })}
                    </Button>
                  </div>

                  <Button
                    id={`assign-template-btn-${tmpl._id}`}
                    variant="default"
                    className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => {
                      setSelectedTemplateId(tmpl._id);
                      setIsAssignModalOpen(true);
                    }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> {t('templates.assign', { defaultValue: 'Assign to Employee' })}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <SimplePagination
          currentPage={templatesPagination.page}
          totalPages={templatesPagination.totalPages}
          totalItems={templatesPagination.totalItems}
          startIndex={templatesPagination.startIndex}
          endIndex={templatesPagination.endIndex}
          pageSize={templatesPagination.pageSize}
          onPageChange={templatesPagination.setPage}
          onPageSizeChange={templatesPagination.setPageSize}
          itemLabel={t('templates.label', { defaultValue: 'templates' })}
        />
      </div>
    )}

      {/* Tab 2: Employee Document Inbox */}
      {activeTab === 'inbox' && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">{t('inbox.title', { defaultValue: 'Assigned Documents & E-Signatures' })}</CardTitle>
            <CardDescription>{t('inbox.desc', { defaultValue: 'Review and execute pending agreements assigned to you.' })}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {inboxLoading ? (
              <div className="p-8 text-center text-muted-foreground">{t('inbox.loading', { defaultValue: 'Loading inbox...' })}</div>
            ) : (inbox || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t('inbox.empty', { defaultValue: 'No documents assigned to your inbox. All clear!' })}
              </div>
            ) : (
              <div>
                <div className="divide-y">
                  {inboxPagination.paginatedData.map((doc) => (
                    <div
                      key={doc._id}
                      className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/10 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{doc.templateTitle}</h4>
                          <Badge variant="outline" className="text-[10px]">
                            v{doc.templateVersion}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('inbox.assignedOn', { date: new Date(doc.assignedAt).toLocaleDateString(), defaultValue: `Assigned on ${new Date(doc.assignedAt).toLocaleDateString()}` })}{' '}
                          {doc.dueDate ? `| ${t('inbox.dueBy', { date: new Date(doc.dueDate).toLocaleDateString(), defaultValue: `Due by ${new Date(doc.dueDate).toLocaleDateString()}` })}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        {doc.status === 'signed' ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {t('inbox.signed', { defaultValue: 'Signed' })}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                            onClick={() => navigate(`/documents/${doc._id}/sign`)}
                          >
                            {t('inbox.signNow', { defaultValue: 'Sign Agreement' })} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t">
                  <SimplePagination
                    currentPage={inboxPagination.page}
                    totalPages={inboxPagination.totalPages}
                    totalItems={inboxPagination.totalItems}
                    startIndex={inboxPagination.startIndex}
                    endIndex={inboxPagination.endIndex}
                    pageSize={inboxPagination.pageSize}
                    onPageChange={inboxPagination.setPage}
                    onPageSizeChange={inboxPagination.setPageSize}
                    itemLabel={t('inbox.label', { defaultValue: 'documents' })}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: Create / Edit Document Template */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate
                ? t('createModal.editTitle', { defaultValue: 'Edit Document Template' })
                : t('createModal.createTitle', { defaultValue: 'Create Document Template' })}
            </DialogTitle>
            <DialogDescription>
              {t('createModal.desc', { defaultValue: 'Define an electronic agreement, policy, or offer letter.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('createModal.titleLabel', { defaultValue: 'Document Title *' })}
              </label>
              <Input
                id="template-title-input"
                placeholder={t('createModal.titlePlaceholder', { defaultValue: 'e.g. Mutual Non-Disclosure Agreement (NDA)' })}
                value={newTitle}
                onChange={(e: any) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('createModal.categoryLabel', { defaultValue: 'Category *' })}
              </label>
              <SearchableSelect
                id="template-category-select"
                value={newCategory}
                onChange={(val: any) => setNewCategory(val)}
                placeholder={t('createModal.selectCategory', { defaultValue: 'Select category...' })}
                searchPlaceholder={t('createModal.searchCategory', { defaultValue: 'Search category...' })}
                options={[
                  { value: 'nda', label: t('createModal.categories.nda', { defaultValue: 'Non-Disclosure Agreement (NDA)' }) },
                  { value: 'code_of_conduct', label: t('createModal.categories.codeOfConduct', { defaultValue: 'Code of Conduct' }) },
                  { value: 'offer_letter', label: t('createModal.categories.offerLetter', { defaultValue: 'Offer Letter' }) },
                  { value: 'handbook', label: t('createModal.categories.handbook', { defaultValue: 'Employee Handbook Acknowledgment' }) },
                  { value: 'direct_deposit', label: t('createModal.categories.directDeposit', { defaultValue: 'Direct Deposit Form' }) },
                  { value: 'custom', label: t('createModal.categories.custom', { defaultValue: 'Custom Agreement / Security Policy' }) },
                ]}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('createModal.contentLabel', { defaultValue: 'Document Text / Legal Terms *' })}
              </label>
              <p className="text-[11px] text-muted-foreground mb-1">
                {t('createModal.placeholdersHelp', { defaultValue: 'Use placeholders: {{employeeName}}, {{employeeEmail}}, {{department}}, {{companyName}}, {{date}}.' })}
              </p>
              <textarea
                id="template-content-input"
                className="w-full min-h-[160px] text-sm p-3 border rounded-md font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder={t('createModal.contentPlaceholder', { defaultValue: 'Enter the full text, clauses, and agreement content...' })}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2 p-2.5 border rounded-md bg-muted/20">
                <input
                  type="checkbox"
                  id="require-signature-check"
                  checked={requireSignature}
                  onChange={(e) => setRequireSignature(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="require-signature-check" className="text-xs font-medium cursor-pointer">
                  {t('createModal.requireSig', { defaultValue: 'Require Cryptographic E-Signature' })}
                </label>
              </div>

              <div className="flex items-center gap-2 p-2.5 border rounded-md bg-muted/20">
                <input
                  type="checkbox"
                  id="mandatory-compliance-check"
                  checked={isMandatory}
                  onChange={(e) => setIsMandatory(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="mandatory-compliance-check" className="text-xs font-medium cursor-pointer">
                  {t('createModal.mandatory', { defaultValue: 'Mark as Mandatory Compliance Item' })}
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoAssign"
                checked={autoAssign}
                onChange={(e) => setAutoAssign(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="autoAssign" className="text-xs font-medium cursor-pointer">
                {t('createModal.autoAssign', { defaultValue: 'Auto-Assign to All New Hires' })}
              </label>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              {t('createModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              id="save-template-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {createTemplateMutation.isPending || updateTemplateMutation.isPending
                ? t('common:saving', { defaultValue: 'Saving...' })
                : editingTemplate
                ? t('createModal.update', { defaultValue: 'Update Template' })
                : t('createModal.save', { defaultValue: 'Save Template' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: View Signatures Audit Trail */}
      <Dialog open={isSignaturesModalOpen} onOpenChange={setIsSignaturesModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600">
              <ShieldCheck className="h-5 w-5" />
              {t('signaturesModal.title', { defaultValue: 'Audit Trail & Cryptographic Signatures' })} — {signaturesTemplate?.title}
            </DialogTitle>
            <DialogDescription>
              {t('signaturesModal.desc', { defaultValue: 'Verifiable hash signatures captured for this document template.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="p-0 sm:p-0">
            {signaturesLoading ? (
              <div className="p-8 text-center text-muted-foreground">{t('signaturesModal.loading', { defaultValue: 'Loading audit signatures...' })}</div>
            ) : (signatures || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t('signaturesModal.empty', { defaultValue: 'No signatures recorded for this template yet.' })}
              </div>
            ) : (
              <>
                {/* Mobile View: Stacked Cards */}
                <div className="sm:hidden p-4 space-y-3">
                  {(signatures || []).map((sig: any) => {
                    const signerName =
                      sig.signatureData?.signerName ||
                      sig.employeeId?.profile?.fullName ||
                      sig.employeeId?.profile?.firstName ||
                      t('signaturesModal.signerFallback', { defaultValue: 'Signer' });
                    const email = sig.employeeId?.auth?.email || '';
                    const dept = sig.employeeId?.employment?.department || 'General';
                    const signedDate = sig.signedAt || sig.signatureData?.signedAt;
                    const shaHash =
                      sig.signatureData?.sha256Hash ||
                      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    const truncatedHash = shaHash.length > 18 ? `${shaHash.substring(0, 18)}...` : shaHash;

                    return (
                      <div key={sig._id} className="p-3 border rounded-xl bg-card space-y-2 text-xs shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-foreground text-sm block">{signerName}</span>
                            <span className="text-muted-foreground text-[11px]">{dept} {email ? `• ${email}` : ''}</span>
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] shrink-0">
                            {t('signaturesModal.verifiedBadge', { defaultValue: 'Verified SHA-256' })}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground text-[11px] pt-1 border-t border-border/50">
                          <span>{t('signaturesModal.signedAt', { defaultValue: 'Timestamp' })}:</span>
                          <span className="font-mono text-foreground">{signedDate ? new Date(signedDate).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span>{t('signaturesModal.sha256', { defaultValue: 'SHA-256 Checksum' })}:</span>
                          <code className="font-mono text-[10px] bg-muted/70 px-1.5 py-0.5 rounded text-foreground font-semibold">
                            {truncatedHash}
                          </code>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Full Audit Table with overflow protection */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-xs text-left" id="signatures-audit-table">
                    <thead className="bg-muted/50 font-semibold border-b uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3">{t('signaturesModal.signer', { defaultValue: 'Signer' })}</th>
                        <th className="p-3">{t('signaturesModal.deptEmailHeader', { defaultValue: 'Department / Email' })}</th>
                        <th className="p-3">{t('signaturesModal.signedAt', { defaultValue: 'Timestamp' })}</th>
                        <th className="p-3">{t('signaturesModal.sha256', { defaultValue: 'SHA-256 Checksum' })}</th>
                        <th className="p-3 text-right">{t('signaturesModal.statusHeader', { defaultValue: 'Status' })}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(signatures || []).map((sig: any) => {
                        const signerName =
                          sig.signatureData?.signerName ||
                          sig.employeeId?.profile?.fullName ||
                          sig.employeeId?.profile?.firstName ||
                          t('signaturesModal.signerFallback', { defaultValue: 'Signer' });
                        const email = sig.employeeId?.auth?.email || '';
                        const dept = sig.employeeId?.employment?.department || 'General';
                        const signedDate = sig.signedAt || sig.signatureData?.signedAt;
                        const shaHash =
                          sig.signatureData?.sha256Hash ||
                          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                        const truncatedHash = shaHash.length > 16 ? `${shaHash.substring(0, 16)}...` : shaHash;

                        return (
                          <tr key={sig._id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3 font-semibold text-foreground">{signerName}</td>
                            <td className="p-3 text-muted-foreground">
                              {dept} {email ? `• ${email}` : ''}
                            </td>
                            <td className="p-3 text-muted-foreground font-mono">
                              {signedDate ? new Date(signedDate).toLocaleString() : 'N/A'}
                            </td>
                            <td className="p-3">
                              <code className="font-mono text-[11px] bg-muted/70 px-2 py-0.5 rounded text-foreground font-semibold">
                                {truncatedHash}
                              </code>
                            </td>
                            <td className="p-3 text-right">
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                {t('signaturesModal.verifiedBadge', { defaultValue: 'Verified SHA-256' })}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignaturesModalOpen(false)}>
              {t('signaturesModal.close', { defaultValue: 'Close' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Assign Document */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('assignModal.title', { defaultValue: 'Assign Document to Employee' })}</DialogTitle>
            <DialogDescription>{t('assignModal.desc', { defaultValue: 'Select an employee to receive this compliance document.' })}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('assignModal.employeeLabel', { defaultValue: 'Select Target Employee *' })}
              </label>
              <SearchableSelect
                value={selectedEmpId}
                onChange={(val) => setSelectedEmpId(val)}
                placeholder={t('assignModal.selectEmployee', { defaultValue: 'Search & select employee...' })}
                searchPlaceholder={t('assignModal.searchEmployee', { defaultValue: 'Search employee name, email...' })}
                options={employees.map((emp: any) => ({
                  value: emp.id,
                  label: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || t('assignModal.unnamed', { defaultValue: 'Unnamed' }),
                  sublabel: emp.email,
                  badge: emp.department || 'General',
                }))}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              {t('assignModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleAssignDocument}>
              {t('assignModal.assign', { defaultValue: 'Assign Document' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documents;
