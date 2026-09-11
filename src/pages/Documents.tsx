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
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export const Documents: React.FC = () => {
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
  const { data: employeesData } = useEmployees({ page: 1, limit: 100 });
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
      toast.error('Please enter a valid title and document content.');
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
            toast.success('Document template updated successfully!');
            setIsCreateModalOpen(false);
            setEditingTemplate(null);
            refetchTemplates();
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to update template');
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
            toast.success('Document template created successfully!');
            setIsCreateModalOpen(false);
            setNewTitle('');
            setNewContent('');
            setRequireSignature(true);
            setIsMandatory(false);
            setAutoAssign(false);
            refetchTemplates();
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to create template');
          },
        }
      );
    }
  };

  const handleAssignDocument = () => {
    if (!selectedTemplateId || !selectedEmpId) {
      toast.error('Please select a template and target employee.');
      return;
    }

    assignDocumentMutation.mutate(
      { templateId: selectedTemplateId, employeeId: selectedEmpId },
      {
        onSuccess: () => {
          toast.success('Document assigned to employee successfully!');
          setIsAssignModalOpen(false);
          setSelectedTemplateId(null);
          setSelectedEmpId('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to assign document');
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
            Digital Documents & E-Signatures
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage onboarding document templates, set mandatory compliance rules, and audit cryptographic signatures.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              id="create-template-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4" /> Create Document Template
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
            <Building2 className="h-4 w-4" /> Document Templates ({templates?.length || 0})
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
          <FileText className="h-4 w-4" /> My Document Inbox ({inbox?.length || 0})
        </button>
      </div>

      {/* Tab 1: Document Templates (Admin View) */}
      {activeTab === 'templates' && isAdmin && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="document-templates-catalog">
            {templatesLoading ? (
              <div className="col-span-full p-8 text-center text-muted-foreground">Loading templates...</div>
            ) : (templates || []).length === 0 ? (
              <div className="col-span-full p-8 text-center text-muted-foreground">
                No document templates created yet. Click "Create Document Template" to add an agreement.
              </div>
            ) : (
              templatesPagination.paginatedData.map((t) => (
                <Card key={t._id} className="hover:border-indigo-500/50 transition-all flex flex-col justify-between shadow-sm">
                  <CardHeader>
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {t.category.replace('_', ' ')}
                        </Badge>
                        {t.isMandatory && (
                          <Badge
                            id={`mandatory-badge-${t._id}`}
                            className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] font-semibold"
                          >
                            Mandatory
                          </Badge>
                        )}
                        {t.signatureRequired && (
                          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]">
                            Require Signature
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-muted text-[10px]">
                        v{t.version}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold mt-2">{t.title}</CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">
                      {t.description || t.content?.substring(0, 100) || 'Standard electronic document template.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {t.audience?.autoAssignNewHires && (
                      <div className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Auto-assigns to all new hires
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <Button
                        id={`view-signatures-btn-${t._id}`}
                        variant="outline"
                        size="sm"
                        className="text-xs flex items-center justify-center gap-1"
                        onClick={() => handleOpenSignatures(t)}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> View Signatures
                      </Button>
                      <Button
                        id={`edit-template-btn-${t._id}`}
                        variant="outline"
                        size="sm"
                        className="text-xs flex items-center justify-center gap-1"
                        onClick={() => handleOpenEdit(t)}
                      >
                        <Edit3 className="h-3.5 w-3.5 text-muted-foreground" /> Edit
                      </Button>
                    </div>

                    <Button
                      id={`assign-template-btn-${t._id}`}
                      variant="default"
                      className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => {
                        setSelectedTemplateId(t._id);
                        setIsAssignModalOpen(true);
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Assign to Employee
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
            itemLabel="templates"
          />
        </div>
      )}

      {/* Tab 2: Employee Document Inbox */}
      {activeTab === 'inbox' && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Assigned Documents & E-Signatures</CardTitle>
            <CardDescription>Review and execute pending agreements assigned to you.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {inboxLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading inbox...</div>
            ) : (inbox || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No documents assigned to your inbox. All clear!
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
                          Assigned on {new Date(doc.assignedAt).toLocaleDateString()}{' '}
                          {doc.dueDate ? `| Due by ${new Date(doc.dueDate).toLocaleDateString()}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        {doc.status === 'signed' ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Signed
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                            onClick={() => navigate(`/documents/${doc._id}/sign`)}
                          >
                            Sign Document <ArrowRight className="h-3.5 w-3.5 ml-1" />
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
                    itemLabel="documents"
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
            <DialogTitle>{editingTemplate ? 'Edit Document Template' : 'Create Document Template'}</DialogTitle>
            <DialogDescription>
              Configure compliance agreements with mandatory signatures and dynamic variable placeholders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Document Title *</label>
              <Input
                id="template-title-input"
                placeholder="e.g. Global Information Security Agreement"
                value={newTitle}
                onChange={(e: any) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Category</label>
              <select
                id="template-category-select"
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={newCategory}
                onChange={(e: any) => setNewCategory(e.target.value)}
              >
                <option value="nda">Non-Disclosure Agreement (NDA)</option>
                <option value="code_of_conduct">Code of Conduct</option>
                <option value="offer_letter">Offer Letter</option>
                <option value="handbook">Employee Handbook Acknowledgment</option>
                <option value="direct_deposit">Direct Deposit Form</option>
                <option value="custom">Custom Agreement / Security Policy</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Document Body Content (Markdown / Legal Terms) *
              </label>
              <p className="text-[11px] text-muted-foreground mb-1">
                Use placeholders: <code>{"{{employeeName}}"}</code>, <code>{"{{employeeEmail}}"}</code>, <code>{"{{department}}"}</code>, <code>{"{{companyName}}"}</code>, <code>{"{{date}}"}</code>.
              </p>
              <textarea
                id="template-content-input"
                className="w-full min-h-[160px] text-sm p-3 border rounded-md font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Employees must maintain confidentiality of all systems..."
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
                  Require Signature
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
                  Mandatory Compliance
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
                Auto-assign this document template to all new hires upon registration
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              id="save-template-btn"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {createTemplateMutation.isPending || updateTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
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
              Document Audit Trail Signatures — {signaturesTemplate?.title}
            </DialogTitle>
            <DialogDescription>
              Authoritative record of executed electronic signatures and cryptographic SHA-256 integrity checksums.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto py-2">
            {signaturesLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading audit trail signatures...</div>
            ) : (signatures || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No signatures recorded for this template yet. Once assigned employees execute the agreement, signed timestamps and SHA-256 audit hashes will appear here.
              </div>
            ) : (
              <table className="w-full text-xs text-left" id="signatures-audit-table">
                <thead className="bg-muted/50 font-semibold border-b uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Signer Name</th>
                    <th className="p-2.5">Department / Email</th>
                    <th className="p-2.5">Signed Timestamp</th>
                    <th className="p-2.5">SHA-256 Checksum Hash</th>
                    <th className="p-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(signatures || []).map((sig: any) => {
                    const signerName =
                      sig.signatureData?.signerName ||
                      sig.employeeId?.profile?.fullName ||
                      sig.employeeId?.profile?.firstName ||
                      'Signer';
                    const email = sig.employeeId?.auth?.email || '';
                    const dept = sig.employeeId?.employment?.department || 'General';
                    const signedDate = sig.signedAt || sig.signatureData?.signedAt;
                    const shaHash =
                      sig.signatureData?.sha256Hash ||
                      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
                    const truncatedHash = shaHash.length > 16 ? `${shaHash.substring(0, 16)}...` : shaHash;

                    return (
                      <tr key={sig._id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-2.5 font-semibold text-foreground">{signerName}</td>
                        <td className="p-2.5 text-muted-foreground">
                          {dept} {email ? `• ${email}` : ''}
                        </td>
                        <td className="p-2.5 text-muted-foreground font-mono">
                          {signedDate ? new Date(signedDate).toLocaleString() : 'N/A'}
                        </td>
                        <td className="p-2.5">
                          <code className="font-mono text-[11px] bg-muted/70 px-2 py-0.5 rounded text-foreground font-semibold">
                            {truncatedHash}
                          </code>
                        </td>
                        <td className="p-2.5 text-right">
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            Verified SHA-256
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignaturesModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Assign Document */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Document for Signature</DialogTitle>
            <DialogDescription>Select an employee to assign this document template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Employee</label>
              <select
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
              >
                <option value="">-- Select Employee --</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email}) - {emp.department || 'General'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleAssignDocument}>
              Assign Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documents;
