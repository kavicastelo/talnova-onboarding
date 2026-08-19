import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Building2,
  ArrowRight
} from 'lucide-react';
import {
  useDocumentTemplates,
  useEmployeeDocumentInbox,
  useCreateDocumentTemplate,
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

export const Documents: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useRole();
  const isAdmin = role === 'admin' || role === 'owner';

  const [activeTab, setActiveTab] = useState<'inbox' | 'templates'>(isAdmin ? 'templates' : 'inbox');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');

  // Template Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'nda' | 'code_of_conduct' | 'offer_letter' | 'handbook' | 'direct_deposit' | 'custom'>('custom');
  const [newContent, setNewContent] = useState('');
  const [autoAssign, setAutoAssign] = useState(false);

  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = useDocumentTemplates();
  const { data: inbox, isLoading: inboxLoading } = useEmployeeDocumentInbox();
  const { data: employeesData } = useEmployees({ page: 1, limit: 100 });

  const createTemplateMutation = useCreateDocumentTemplate();
  const assignDocumentMutation = useAssignDocument();

  const employees = employeesData?.employees || [];

  const handleCreateTemplate = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Please enter a valid title and document content.');
      return;
    }

    createTemplateMutation.mutate(
      {
        title: newTitle,
        category: newCategory,
        content: newContent,
        signatureRequired: true,
        audience: { autoAssignNewHires: autoAssign },
      },
      {
        onSuccess: () => {
          toast.success('Document template created successfully!');
          setIsCreateModalOpen(false);
          setNewTitle('');
          setNewContent('');
          setAutoAssign(false);
          refetchTemplates();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to create template');
        }
      }
    );
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
        }
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
            Manage onboarding document templates, assign e-signature requests, and complete legally binding agreements.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" /> Create Template
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b text-sm font-medium">
        {isAdmin && (
          <button
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templatesLoading ? (
              <div className="col-span-full p-8 text-center text-muted-foreground">Loading templates...</div>
            ) : (templates || []).length === 0 ? (
              <div className="col-span-full p-8 text-center text-muted-foreground">
                No document templates created yet. Click "Create Template" to add an NDA or Code of Conduct.
              </div>
            ) : (
              templates?.map((t) => (
                <Card key={t._id} className="hover:border-indigo-500/50 transition-all flex flex-col justify-between">
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {t.category.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline" className="bg-muted text-[10px]">
                        v{t.version}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold mt-2">{t.title}</CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">
                      {t.description || 'Standard electronic document template.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    {t.audience?.autoAssignNewHires && (
                      <div className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Auto-assigns to all new hires
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full text-xs"
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
              <div className="divide-y">
                {inbox?.map((doc) => (
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
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Pending Signature
                        </Badge>
                      )}

                      <Button
                        size="sm"
                        className={doc.status === 'signed' ? 'variant-outline text-xs' : 'bg-indigo-600 text-white hover:bg-indigo-700 text-xs'}
                        onClick={() => navigate(`/documents/${doc._id}/sign`)}
                      >
                        {doc.status === 'signed' ? 'View Document' : 'Sign Now'} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: Create Document Template */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Document Template</DialogTitle>
            <DialogDescription>
              Configure reusable agreements (NDA, Code of Conduct) with dynamic variable placeholders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Document Title</label>
              <Input
                placeholder="e.g. Non-Disclosure Agreement (NDA)"
                value={newTitle}
                onChange={(e: any) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Category</label>
              <select
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={newCategory}
                onChange={(e: any) => setNewCategory(e.target.value)}
              >
                <option value="nda">Non-Disclosure Agreement (NDA)</option>
                <option value="code_of_conduct">Code of Conduct</option>
                <option value="offer_letter">Offer Letter</option>
                <option value="handbook">Employee Handbook Acknowledgment</option>
                <option value="direct_deposit">Direct Deposit Form</option>
                <option value="custom">Custom Agreement</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Document Body Content (HTML / Text)
              </label>
              <p className="text-[11px] text-muted-foreground mb-1">
                Use placeholders: <code>{"{{employeeName}}"}</code>, <code>{"{{employeeEmail}}"}</code>, <code>{"{{department}}"}</code>, <code>{"{{companyName}}"}</code>, <code>{"{{date}}"}</code>.
              </p>
              <textarea
                className="w-full min-h-[160px] text-sm p-3 border rounded-md font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="This Agreement is entered into on {{date}} by and between {{companyName}} and {{employeeName}} ({{employeeEmail}})..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
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
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleCreateTemplate}>
              Create Template
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
