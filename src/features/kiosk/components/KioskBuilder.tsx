import React, { useState, useEffect } from 'react';
import { useKioskBuilder, KioskBuilderProvider } from '../context/KioskBuilderContext';
import { JourneySimulator } from './builder/JourneySimulator';
import {
  Plus, Trash2, ArrowUp, ArrowDown, Type, Image as ImageIcon,
  Video, Eye, Save, Globe, Play, Layers, AlertTriangle, ShieldCheck, Sparkles,
  Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen
} from 'lucide-react';
import { Smartphone, Clock, RotateCcw, Copy, Check, X } from 'lucide-react';
import { MediaAssetPicker } from './builder/MediaAssetPicker';
import { StepTypeStudio } from './builder/StepTypeStudio';
import { KioskJourneyVersion } from '../../../types/kiosk/journey.types';
import { KioskStepType, KioskInteractionType } from '../../../types/kiosk/step.types';
import { KioskBlockType } from '../../../types/kiosk/block.types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface KioskBuilderInnerProps {
  journeyId: string;
  onExit: () => void;
}

export const KioskBuilderInner: React.FC<KioskBuilderInnerProps> = ({ journeyId, onExit }) => {
  const { t } = useTranslation('kiosk');
  const {
    journey,
    hasUnsavedChanges,
    activeStepId,
    activeBlockId,
    validationReport,
    validationErrorDetails,
    isSaving,
    error,
    loadJourney,
    updateJourneyDetails,
    saveJourney,
    publishJourney,
    rollbackJourney,
    listVersions,
    setActiveStepId,
    addStep,
    updateStep,
    removeStep,
    reorderSteps,
    setActiveBlockId,
    addBlockToStep,
    updateBlockInStep,
    removeBlockFromStep,
    validateJourney
  } = useKioskBuilder();

  const [activeTab, setActiveTab] = useState<'journey' | 'step' | 'block' | 'validation'>('journey');
  const [showAddStepMenu, setShowAddStepMenu] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [hotspotToolActive, setHotspotToolActive] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishChangelog, setPublishChangelog] = useState('');
  const [publishScheduleEnabled, setPublishScheduleEnabled] = useState(false);
  const [publishAtDate, setPublishAtDate] = useState('');
  const [publishExpireEnabled, setPublishExpireEnabled] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versions, setVersions] = useState<KioskJourneyVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  // Helper to read persisted panel layout across browser, SSR, and test environments
  const getStoredLayout = () => {
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
      if (storage) {
        const saved = storage.getItem('talnova_kiosk_builder_layout');
        if (saved) return JSON.parse(saved);
      }
    } catch (_) {}
    return null;
  };

  // Resizable panels and Zen canvas mode state with localStorage persistence
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const layout = getStoredLayout();
    if (layout && typeof layout.leftWidth === 'number') {
      return Math.min(Math.max(layout.leftWidth, 200), 450);
    }
    return 280;
  });

  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const layout = getStoredLayout();
    if (layout && typeof layout.rightWidth === 'number') {
      return Math.min(Math.max(layout.rightWidth, 320), 650);
    }
    return 380;
  });

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => {
    const layout = getStoredLayout();
    if (layout && typeof layout.leftCollapsed === 'boolean') {
      return layout.leftCollapsed;
    }
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return true;
    return false;
  });

  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => {
    const layout = getStoredLayout();
    if (layout && typeof layout.rightCollapsed === 'boolean') {
      return layout.rightCollapsed;
    }
    if (typeof window !== 'undefined' && window.innerWidth < 1280) return false;
    return false;
  });

  const [zenMode, setZenMode] = useState(false);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  // Sync panel layout state to localStorage
  useEffect(() => {
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
      if (storage) {
        storage.setItem(
          'talnova_kiosk_builder_layout',
          JSON.stringify({
            leftWidth: leftPanelWidth,
            rightWidth: rightPanelWidth,
            leftCollapsed: leftPanelCollapsed,
            rightCollapsed: rightPanelCollapsed
          })
        );
      }
    } catch (_) {}
  }, [leftPanelWidth, rightPanelWidth, leftPanelCollapsed, rightPanelCollapsed]);

  // Mouse drag listener for resizing side panels
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const newWidth = Math.min(Math.max(e.clientX, 200), 450);
        setLeftPanelWidth(newWidth);
      } else if (isDraggingRight) {
        const windowWidth = window.innerWidth;
        const newWidth = Math.min(Math.max(windowWidth - e.clientX, 320), 650);
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingLeft) setIsDraggingLeft(false);
      if (isDraggingRight) setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDraggingLeft, isDraggingRight]);

  // Load journey data
  useEffect(() => {
    loadJourney(journeyId);
  }, [journeyId]);

  if (!journey) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center bg-slate-950 text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-slate-400">{t('builder.loading', 'Loading Journey Builder...')}</p>
      </div>
    );
  }

  const activeStep = journey.steps?.find(s => s.id === activeStepId);
  const activeBlock = activeStep?.blocks?.find(b => b.id === activeBlockId);

  // Auto-switch tabs to active components
  const selectStep = (id: string) => {
    setActiveStepId(id);
    setActiveBlockId(null);
    setActiveTab('step');
  };

  const selectBlock = (blockId: string) => {
    setActiveBlockId(blockId);
    setActiveTab('block');
  };

  const handleSave = async () => {
    try {
      await saveJourney();
      toast.success(t('builder.toastDraftSaved', 'Draft saved successfully'));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save draft');
    }
  };

  const handlePublish = () => {
    const valid = validateJourney();
    if (!valid) {
      setActiveTab('validation'); // focus validation linter tab to view issues
      toast.error(t('builder.toastCannotPublish', 'Cannot publish: Journey has validation errors.'));
      return;
    }
    setShowPublishModal(true);
  };

  const handleConfirmPublish = async () => {
    setIsPublishing(true);
    try {
      const scheduling = (publishScheduleEnabled || publishExpireEnabled) ? {
        publishAt: publishScheduleEnabled && publishAtDate ? new Date(publishAtDate) : undefined,
        expiresAt: publishExpireEnabled && expiresAtDate ? new Date(expiresAtDate) : undefined
      } : undefined;
      const result = await publishJourney(publishChangelog.trim() || undefined, scheduling);
      if (result) {
        toast.success(t('builder.toastJourneyPublished', 'Kiosk journey published successfully!'));
        setShowPublishModal(false);
        setPublishChangelog('');
      } else {
        setActiveTab('validation');
        toast.error(error || t('builder.toastFailedPublish', 'Failed to publish kiosk journey'));
      }
    } catch (err: any) {
      setActiveTab('validation');
      toast.error(err?.message || t('builder.toastFailedPublish', 'Failed to publish kiosk journey'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpenVersions = async () => {
    setShowVersionModal(true);
    setLoadingVersions(true);
    try {
      const history = await listVersions();
      setVersions(history);
    } catch (err: any) {
      toast.error('Failed to load version history');
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRollback = async (versionNum: number) => {
    if (!window.confirm(`Are you sure you want to rollback to Version ${versionNum}? A new snapshot will be minted with this content.`)) {
      return;
    }
    setRollingBackVersion(versionNum);
    try {
      const restored = await rollbackJourney(versionNum);
      if (restored) {
        toast.success(`Successfully rolled back to Version ${versionNum}!`);
        setShowVersionModal(false);
      } else {
        toast.error(error || `Failed to rollback to Version ${versionNum}`);
      }
    } catch (err: any) {
      toast.error(err?.message || `Failed to rollback to Version ${versionNum}`);
    } finally {
      setRollingBackVersion(null);
    }
  };

  // Step types configuration metadata
  const stepTypes: { value: KioskStepType; label: string; desc: string }[] = [
    { value: 'info_step', label: 'Information Step', desc: 'Display general announcements or static resources.' },
    { value: 'image_step', label: 'Image Step', desc: 'Display diagrams, photos, or maps.' },
    { value: 'video_step', label: 'Video Guide Step', desc: 'Embed tutorials, safety reels, or messages.' },
    { value: 'audio_step', label: 'Audio Announcement', desc: 'Dedicated voice playback slide.' },
    { value: 'warning_step', label: 'Warning Template', desc: 'High-severity safety warning slide.' },
    { value: 'emergency_step', label: 'Emergency Protocol', desc: 'Critical alert/action details.' },
    { value: 'interactive_confirmation', label: 'Interactive Hold', desc: 'Requires touch/hold interaction to pass.' },
    { value: 'ppe_checklist', label: 'PPE Checklist', desc: 'Personal Protective Equipment physical compliance check.' },
    { value: 'knowledge_quiz', label: 'Comprehension Quiz', desc: 'Embedded comprehension questions with passing score.' },
    { value: 'supervisor_gate', label: 'Supervisor Witness Gate', desc: 'Witness signing step requiring supervisor PIN.' },
    { value: 'completion', label: 'Completion Gate', desc: 'Final exit step of the journey.' }
  ];

  const blockTypes: { value: KioskBlockType; label: string; icon: any }[] = [
    { value: 'text', label: 'Rich Text', icon: Type },
    { value: 'image', label: 'Image Frame', icon: ImageIcon },
    { value: 'video', label: 'Video Player', icon: Video },
    { value: 'icon', label: 'Safety Icon', icon: AlertTriangle },
    { value: 'animation', label: 'Animation', icon: Sparkles }
  ];

  // Hotspot image canvas clicking handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hotspotToolActive || !activeStep || activeStep.interaction?.type !== 'hotspot') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    const currentHotspots = activeStep.interaction.hotspots || [];
    const newHotspot = {
      x,
      y,
      radius: 8,
      actionStepId: journey.steps?.[0]?.id || ''
    };

    updateStep(activeStep.id, {
      interaction: {
        ...activeStep.interaction,
        hotspots: [...currentHotspots, newHotspot]
      }
    });
    setHotspotToolActive(false);
  };

  const handleStepTypeChange = (newType: KioskStepType) => {
    if (!activeStep) return;
    const updates: any = { type: newType };
    if (newType === 'ppe_checklist') {
      updates.interaction = {
        ...activeStep.interaction,
        type: 'ppe_checklist',
        ppeItems: activeStep.interaction?.ppeItems?.length
          ? activeStep.interaction.ppeItems
          : ['Hard Hat', 'Safety Glasses', 'Steel Toe Boots']
      };
    } else if (newType === 'knowledge_quiz') {
      updates.interaction = {
        ...activeStep.interaction,
        type: 'quiz',
        quiz: activeStep.interaction?.quiz || {
          passingScore: 80,
          questions: [
            {
              id: 'q-1',
              question: 'Confirm safety procedure comprehension:',
              options: ['I understand and agree to comply', 'I have questions or require help'],
              correctOptionIndex: 0
            }
          ]
        }
      };
    } else if (newType === 'supervisor_gate') {
      updates.requireSupervisorWitness = true;
      updates.interaction = {
        ...activeStep.interaction,
        type: 'supervisor_witness',
        requireSupervisorWitness: true
      };
    } else if (newType === 'interactive_confirmation') {
      updates.interaction = {
        ...activeStep.interaction,
        type: 'hold_to_confirm',
        holdDurationMs: activeStep.interaction?.holdDurationMs || 3000
      };
    }
    updateStep(activeStep.id, updates);
  };

  return (
    <div className="flex h-[90vh] w-full bg-slate-950 text-slate-100 font-sans border border-slate-900 rounded-xl overflow-hidden shadow-2xl">
      {/* 1. LEFT PANEL: STEP TREE LIST */}
      {!zenMode && leftPanelCollapsed && (
        <div
          data-testid="left-panel-collapsed-strip"
          className="w-12 border-r border-slate-900 bg-slate-950 flex flex-col items-center justify-between py-4 shrink-0 transition-all select-none"
        >
          <div className="flex flex-col items-center space-y-4">
            <button
              type="button"
              data-testid="expand-left-panel-btn"
              onClick={() => setLeftPanelCollapsed(false)}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 transition"
              title="Expand Step Hierarchy"
            >
              <PanelLeftOpen className="w-4 h-4 text-emerald-400" />
            </button>
            <div className="[writing-mode:vertical-rl] text-[10px] font-bold tracking-widest uppercase text-slate-500 mt-2 select-none rotate-180">
              Steps ({journey.steps?.length || 0})
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLeftPanelCollapsed(false);
              setShowAddStepMenu(true);
            }}
            className="p-2 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
            title="Add Step"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!zenMode && !leftPanelCollapsed && (
        <>
          <div
            style={{ width: `${leftPanelWidth}px` }}
            className="border-r border-slate-900 bg-slate-950 flex flex-col justify-between shrink-0"
          >
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>{t('builder.stepHierarchy', 'Step Hierarchy')}</span>
                </h3>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    data-testid="collapse-left-panel-btn"
                    onClick={() => setLeftPanelCollapsed(true)}
                    className="p-1.5 rounded-lg border border-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition"
                    title="Collapse Step Hierarchy Panel"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowAddStepMenu(!showAddStepMenu)}
                      className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {showAddStepMenu && (
                      <div className="absolute right-0 mt-2 z-30 w-64 rounded-xl border border-slate-900 bg-slate-950 p-2 shadow-xl">
                        <div className="text-xs font-semibold text-slate-500 p-2 uppercase tracking-wider border-b border-slate-900">
                          Choose Step Type
                        </div>
                        <div className="max-h-60 overflow-y-auto mt-1">
                          {stepTypes.map((type) => (
                            <button
                              key={type.value}
                              onClick={() => {
                                addStep(type.value);
                                setShowAddStepMenu(false);
                              }}
                              className="w-full text-left p-2 rounded-lg hover:bg-slate-900 transition flex flex-col"
                            >
                              <span className="text-sm font-medium text-slate-200">{type.label}</span>
                              <span className="text-[10px] text-slate-500 truncate">{type.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-4">
                {journey.steps?.map((step, index) => {
                  const stepErrors = (validationErrorDetails || []).filter(e => e.stepId === step.id);
                  const hasErrors = stepErrors.length > 0;

                  return (
                    <div
                      key={step.id}
                      onClick={() => selectStep(step.id)}
                      className={`group relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${hasErrors
                          ? activeStepId === step.id
                            ? 'border-rose-500/80 bg-rose-500/10 text-white shadow-sm shadow-rose-950'
                            : 'border-rose-500/40 bg-rose-950/20 text-rose-200 hover:border-rose-500/70'
                          : activeStepId === step.id
                            ? 'border-emerald-500/40 bg-emerald-500/5 text-white'
                            : 'border-slate-900 bg-slate-950 hover:border-slate-800'
                        }`}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${hasErrors
                            ? 'text-rose-400 bg-rose-950/60 border-rose-800/60'
                            : 'text-slate-600 bg-slate-900 border-slate-850'
                          }`}>
                          {index + 1}
                        </span>
                        <div className="flex flex-col truncate">
                          <span className="text-sm font-medium truncate">{step.title}</span>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                              {step.type.replace('_step', '').replace('_', ' ')}
                            </span>
                            {hasErrors && (
                              <span className="inline-flex items-center space-x-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                <span>{stepErrors.length} {stepErrors.length === 1 ? 'issue' : 'issues'}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {index > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reorderSteps(index, index - 1);
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {index < (journey.steps?.length || 0) - 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reorderSteps(index, index + 1);
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeStep(step.id);
                          }}
                          className="p-1 rounded hover:bg-slate-800 text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Global actions at bottom of left panel */}
            <div className="p-4 border-t border-slate-900 space-y-3 bg-slate-950/80">
              {validationErrorDetails.length > 0 && (
                <div
                  onClick={() => setActiveTab('validation')}
                  className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg flex items-center justify-between cursor-pointer hover:bg-rose-500/15 transition"
                >
                  <div className="flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span className="font-semibold">{validationErrorDetails.length} Pre-publish {validationErrorDetails.length === 1 ? 'blocker' : 'blockers'}</span>
                  </div>
                  <span className="text-[10px] underline font-medium">Review & Fix</span>
                </div>
              )}
              {hasUnsavedChanges && (
                <div className="text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/20 p-2 rounded-lg flex items-center space-x-1.5 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('builder.unsavedChanges', 'Unsaved changes on draft.')}</span>
                </div>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-900 py-2.5 text-xs font-bold hover:bg-slate-800 hover:text-white transition flex items-center justify-center space-x-1.5 disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                <button
                  onClick={handlePublish}
                  className="flex-1 rounded-lg bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 transition flex items-center justify-center space-x-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t('builder.publish', 'Publish')}</span>
                </button>
              </div>
              <button
                onClick={onExit}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition py-1"
              >
                Exit Builder
              </button>
            </div>
          </div>
          {/* Draggable Divider Handle for Left Panel */}
          <div
            data-testid="left-resize-handle"
            onMouseDown={() => setIsDraggingLeft(true)}
            className={`w-1.5 hover:w-2 hover:bg-emerald-500/60 active:bg-emerald-500 cursor-col-resize transition-all z-20 shrink-0 ${isDraggingLeft ? 'bg-emerald-500 w-2' : 'bg-slate-900/60'
              }`}
            title="Drag to resize step hierarchy panel"
          />
        </>
      )}
      {/* 2. CENTER PANEL: TABLET PREVIEW CANVAS */}
      <div className="flex-1 bg-slate-900 flex flex-col items-center justify-start relative overflow-hidden border-r border-slate-900">

        {/* Zen Mode Floating Exit Pill */}
        {zenMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-fade-in">
            <button
              type="button"
              data-testid="exit-zen-btn"
              onClick={() => setZenMode(false)}
              className="px-4 py-1.5 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white font-bold text-xs shadow-xl shadow-purple-950 flex items-center space-x-2 backdrop-blur-md border border-purple-400/40 transition"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit Zen Mode</span>
            </button>
          </div>
        )}

        {/* Canvas Header bar */}
        <div className="absolute top-4 left-6 right-6 flex items-center justify-between z-10 bg-slate-900/80 backdrop-blur-sm pb-2">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">{t('builder.activePreviewCanvas', 'Active Preview Canvas')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              data-testid="zen-mode-btn"
              onClick={() => setZenMode(!zenMode)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition ${zenMode
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30'
                  : 'bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-900'
                }`}
              title="Toggle distraction-free Zen canvas mode"
            >
              {zenMode ? <Minimize2 className="w-3.5 h-3.5 text-purple-400" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-400" />}
              <span>{zenMode ? 'Exit Zen' : 'Zen Mode'}</span>
            </button>
            <button
              type="button"
              onClick={handleOpenVersions}
              className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition"
              title="Inspect Immutable Version History & Rollback"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Version History (v{journey.publishing?.version || 1})</span>
            </button>
            <button
              type="button"
              data-testid="open-simulator-btn"
              onClick={() => setShowSimulator(true)}
              className="px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>QA Simulator</span>
            </button>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition ${previewMode
                  ? 'bg-emerald-500 border-emerald-500/20 text-slate-950 hover:bg-emerald-400'
                  : 'bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-900'
                }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{previewMode ? 'Edit Mode' : 'Live Preview'}</span>
            </button>
          </div>
        </div>

        <div className="w-full h-full overflow-y-auto pt-16 pb-8 px-6 flex flex-col items-center justify-start">
          {activeStep ? (
            <div className="w-full max-w-2xl bg-slate-950 rounded-2xl border border-slate-950 p-8 shadow-2xl relative min-h-[400px] flex flex-col justify-between">
              {/* Tablet Mock Bezel details */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-2 bg-slate-800 rounded-full" />

              <div className="space-y-6">
                {/* Emergency Banner Mock preview */}
                {(activeStep.type === 'emergency_step' || activeStep.type === 'warning_step') && (
                  <div className={`p-4 rounded-xl border flex items-center space-x-3 text-sm ${activeStep.type === 'emergency_step'
                      ? 'bg-rose-950/20 border-rose-500/20 text-rose-400 animate-pulse'
                      : 'bg-amber-950/20 border-amber-500/20 text-amber-400'
                    }`}>
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span className="font-medium uppercase">
                      {activeStep.type === 'emergency_step' ? 'Emergency Protocol active' : 'Safety Warning template'}
                    </span>
                  </div>
                )}

                {/* Step-level validation warnings */}
                {(() => {
                  const activeStepErrors = (validationErrorDetails || []).filter(
                    e => e.stepId === activeStep.id && !e.blockId
                  );
                  if (activeStepErrors.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      {activeStepErrors.map((err, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start space-x-2.5">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-[9px] uppercase font-mono font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                                {err.rule.replace(/_/g, ' ')}
                              </span>
                              <span className="font-semibold text-rose-200">{err.message}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <h2 className="text-3xl font-extrabold text-white tracking-tight">
                  {activeStep.title || <span className="text-slate-600 italic">{t('builder.untitledStep', 'Untitled Step')}</span>}
                </h2>

                {/* RENDER BLOCKS IN PREVIEW CONTAINER */}
                <div className="space-y-4">
                  {activeStep.blocks?.length === 0 ? (
                    <div className="border border-dashed border-slate-850 rounded-xl p-8 text-center text-slate-600 text-xs">
                      No block components added yet. Use the selector below to add content blocks.
                    </div>
                  ) : (
                    activeStep.blocks?.map((block) => {
                      const blockErrors = (validationErrorDetails || []).filter(
                        e => e.blockId === block.id
                      );
                      const hasBlockErrors = blockErrors.length > 0;

                      return (
                        <div
                          key={block.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectBlock(block.id);
                          }}
                          className={`group relative p-4 rounded-xl border transition ${hasBlockErrors
                              ? activeBlockId === block.id
                                ? 'border-rose-500 bg-rose-500/10 shadow-sm shadow-rose-950'
                                : 'border-rose-500/60 bg-rose-950/20 hover:border-rose-500'
                              : activeBlockId === block.id
                                ? 'border-emerald-500 bg-emerald-500/5'
                                : 'border-slate-900 bg-slate-950 hover:border-slate-800'
                            }`}
                        >
                          {/* Block metadata tag */}
                          <div className="absolute top-2 right-2 flex items-center space-x-1.5">
                            {hasBlockErrors && (
                              <span className="text-[9px] font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center space-x-1">
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                <span>{blockErrors.length} {blockErrors.length === 1 ? 'error' : 'errors'}</span>
                              </span>
                            )}
                            <span className="text-[9px] font-mono text-slate-600 bg-slate-900 px-2 py-0.5 rounded border border-slate-850 group-hover:border-slate-800">
                              {block.type.toUpperCase()}
                            </span>
                          </div>

                          {block.type === 'text' && (
                            <p className="text-slate-300 text-sm leading-relaxed pr-24">
                              {block.mediaReferences?.en?.textValue || 'Click to edit default English text value...'}
                            </p>
                          )}

                          {block.type === 'image' && (
                            <div
                              onClick={handleCanvasClick}
                              className={`aspect-video w-full rounded-lg bg-slate-900 flex items-center justify-center text-xs text-slate-500 border border-slate-850 relative ${hotspotToolActive ? 'cursor-crosshair border-rose-500 bg-rose-500/5' : ''
                                }`}
                            >
                              {block.mediaReferences?.en?.embedUrl ? (
                                <img src={block.mediaReferences.en.embedUrl} className="h-full w-full object-cover rounded-lg" alt="" />
                              ) : (
                                'Image Frame: No media url linked'
                              )}

                              {/* Render hotspots on top of the image */}
                              {activeStep.interaction?.type === 'hotspot' && (activeStep.interaction.hotspots || []).map((hs, idx) => (
                                <div
                                  key={idx}
                                  style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                                  className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-emerald-500 bg-emerald-500/25 flex items-center justify-center text-[9px] font-bold text-white shadow-lg animate-pulse"
                                >
                                  {idx + 1}
                                </div>
                              ))}
                            </div>
                          )}

                          {block.type === 'video' && (
                            <div className="aspect-video w-full rounded-lg bg-black flex items-center justify-center text-xs text-slate-500">
                              <Play className="w-8 h-8 text-slate-600 mr-2" />
                              <span>Video Player: {block.mediaReferences?.en?.embedUrl ? 'Asset linked' : 'No URL linked'}</span>
                            </div>
                          )}

                          {block.type === 'icon' && (
                            <div className="flex justify-center p-2">
                              <AlertTriangle className="w-12 h-12 text-emerald-500" />
                            </div>
                          )}

                          {block.type === 'animation' && (
                            <div className="border border-slate-900 p-3 rounded-lg text-center text-xs text-emerald-500 font-mono">
                              Animation Block Simulator
                            </div>
                          )}

                          {/* Inline block validation warnings */}
                          {hasBlockErrors && (
                            <div className="mt-3 space-y-1.5 pt-2 border-t border-rose-500/30">
                              {blockErrors.map((err, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                                  <div className="flex items-center space-x-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    <span className="text-[11px] font-medium">{err.message}</span>
                                  </div>
                                  {err.language && (
                                    <span className="text-[9px] font-mono uppercase bg-rose-500/30 text-rose-200 px-1.5 py-0.5 rounded">
                                      {err.language}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Interaction Footer Mock */}
              <div className="mt-8 pt-4 border-t border-slate-900 flex justify-center text-xs text-slate-500">
                {activeStep.interaction?.type === 'tap_to_continue' && 'Tap anywhere to advance'}
                {activeStep.interaction?.type === 'hold_to_confirm' && 'Press & Hold to confirm'}
                {activeStep.interaction?.type === 'yes_no' && (
                  <div className="flex space-x-3 w-full max-w-xs">
                    <div className="flex-1 py-2 text-center bg-emerald-500/10 text-emerald-400 rounded-lg font-bold border border-emerald-500/20">YES</div>
                    <div className="flex-1 py-2 text-center bg-slate-900 text-slate-400 rounded-lg font-bold border border-slate-850">NO</div>
                  </div>
                )}
                {activeStep.interaction?.type === 'hotspot' && (
                  <div className="text-center text-emerald-500 font-medium">
                    Hotspot trigger zones active on image overlays
                  </div>
                )}
              </div>

              {/* Add block overlay drawer */}
              {!previewMode && (
                <div className="mt-6 pt-4 border-t border-slate-900 flex flex-wrap gap-2 justify-center">
                  {blockTypes.map((b) => {
                    const Icon = b.icon;
                    return (
                      <button
                        key={b.value}
                        onClick={() => addBlockToStep(activeStep.id, b.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-900 bg-slate-950 text-slate-400 hover:border-slate-800 hover:text-white transition text-xs flex items-center space-x-1.5"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-600 text-sm max-w-sm my-auto">
              <Layers className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="font-semibold text-slate-500">{t('builder.noStepSelected', 'No Step Selected')}</p>
              <p className="mt-1 text-xs text-slate-500">{t('builder.noStepSelectedDesc', 'Choose or create a step from the left hierarchy panel to begin designing layout blocks.')}</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. RIGHT PANEL: SETTINGS & COMPONENT INSPECTOR */}
      {/* Right panel resize drag handle */}
      {!zenMode && !rightPanelCollapsed && (
        <div
          data-testid="right-resize-handle"
          onMouseDown={() => setIsDraggingRight(true)}
          className={`w-1.5 hover:w-2 hover:bg-emerald-500/60 active:bg-emerald-500 cursor-col-resize transition-all z-20 shrink-0 ${isDraggingRight ? 'bg-emerald-500 w-2' : 'bg-slate-900/60'
            }`}
          title="Drag to resize inspector panel"
        />
      )}

      {/* Collapsed Right Panel Strip */}
      {!zenMode && rightPanelCollapsed && (
        <div
          data-testid="right-panel-collapsed-strip"
          className="w-12 border-l border-slate-900 bg-slate-950 flex flex-col items-center justify-between py-4 shrink-0 transition-all select-none"
        >
          <div className="flex flex-col items-center space-y-4">
            <button
              type="button"
              data-testid="expand-right-panel-btn"
              onClick={() => setRightPanelCollapsed(false)}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 transition"
              title="Expand Inspector Panel"
            >
              <PanelRightOpen className="w-4 h-4 text-emerald-400" />
            </button>
            <div className="[writing-mode:vertical-rl] text-[10px] font-bold tracking-widest uppercase text-slate-500 mt-2 select-none rotate-180">
              Inspector ({activeTab})
            </div>
          </div>
          {validationErrorDetails.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setRightPanelCollapsed(false);
                setActiveTab('validation');
              }}
              className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-xs font-bold animate-pulse"
              title={`${validationErrorDetails.length} validation issues`}
            >
              {validationErrorDetails.length}
            </button>
          )}
        </div>
      )}

      {!zenMode && !rightPanelCollapsed && (
        <div
          style={{ width: `${rightPanelWidth}px` }}
          className="border-l border-slate-900 bg-slate-950 flex flex-col overflow-hidden shrink-0"
        >
          {/* inspector tabs selection bar */}
          <div className="flex items-center border-b border-slate-900 shrink-0">
            <button
              onClick={() => setActiveTab('journey')}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'journey'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
            >
              Journey
            </button>
            <button
              disabled={!activeStepId}
              onClick={() => setActiveTab('step')}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'step'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none'
                }`}
            >
              Step
            </button>
            <button
              disabled={!activeBlockId}
              onClick={() => setActiveTab('block')}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'block'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none'
                }`}
            >
              Block
            </button>
            <button
              onClick={() => setActiveTab('validation')}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center justify-center space-x-1.5 ${activeTab === 'validation'
                  ? validationErrorDetails.length > 0
                    ? 'border-rose-500 text-rose-400'
                    : 'border-emerald-500 text-emerald-400'
                  : validationErrorDetails.length > 0
                    ? 'border-transparent text-rose-400 hover:text-rose-300'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
            >
              <span>Validation</span>
              {validationErrorDetails.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {validationErrorDetails.length}
                </span>
              )}
            </button>
            <button
              type="button"
              data-testid="collapse-right-panel-btn"
              onClick={() => setRightPanelCollapsed(true)}
              className="p-3 text-slate-500 hover:text-slate-300 hover:bg-slate-900 border-l border-slate-900 transition"
              title="Collapse Inspector Panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>

          {/* inspector tab body panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">

            {/* TAB 1: JOURNEY SETTINGS */}
            {activeTab === 'journey' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.journeyTitle', 'Journey Title')}</label>
                  <input
                    type="text"
                    value={journey.title || ''}
                    onChange={(e) => updateJourneyDetails({ title: e.target.value })}
                    className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.description', 'Description')}</label>
                  <textarea
                    value={journey.description || ''}
                    onChange={(e) => updateJourneyDetails({ description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.idleTimeout', 'Idle Timeout (s)')}</label>
                    <input
                      type="number"
                      value={journey.settings?.idleTimeoutSeconds || 60}
                      onChange={(e) => updateJourneyDetails({
                        settings: {
                          autoPlay: journey.settings?.autoPlay ?? false,
                          loopForever: journey.settings?.loopForever ?? false,
                          autoReturnHome: journey.settings?.autoReturnHome ?? false,
                          hideNavigation: journey.settings?.hideNavigation ?? false,
                          disableExit: journey.settings?.disableExit ?? false,
                          idleTimeoutSeconds: Number(e.target.value),
                          requireSupervisorWitness: journey.settings?.requireSupervisorWitness ?? false,
                          security: journey.settings?.security || { protectionType: 'none', pinCode: '' }
                        }
                      })}
                      className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.supportedLangs', 'Supported Langs')}</label>
                    <div className="flex space-x-2 pt-1">
                      {['en', 'es', 'si', 'ta'].map((lang) => {
                        const active = journey.languages ? journey.languages.includes(lang) : false;
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => {
                              const currentLangs = journey.languages || [];
                              const newLangs = active
                                ? currentLangs.filter(l => l !== lang)
                                : [...currentLangs, lang];
                              if (newLangs.length > 0) {
                                updateJourneyDetails({ languages: newLangs });
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider transition ${active
                                ? 'bg-emerald-500 border-emerald-500/20 text-slate-950 hover:bg-emerald-400'
                                : 'bg-slate-950 border-slate-900 text-slate-400 hover:border-slate-800'
                              }`}
                          >
                            {lang}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300">{t('builder.lockWithPin', 'Lock with secure PIN')}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{t('builder.lockWithPinDesc', 'Require 4-digit code to play or edit.')}</p>
                    </div>
                    <button
                      onClick={() => updateJourneyDetails({
                        settings: {
                          autoPlay: journey.settings?.autoPlay ?? false,
                          loopForever: journey.settings?.loopForever ?? false,
                          autoReturnHome: journey.settings?.autoReturnHome ?? false,
                          hideNavigation: journey.settings?.hideNavigation ?? false,
                          disableExit: journey.settings?.disableExit ?? false,
                          idleTimeoutSeconds: journey.settings?.idleTimeoutSeconds ?? 60,
                          requireSupervisorWitness: journey.settings?.requireSupervisorWitness ?? false,
                          security: {
                            protectionType: journey.settings?.security?.protectionType === 'pin' ? 'none' : 'pin',
                            pinCode: journey.settings?.security?.pinCode || ''
                          }
                        }
                      })}
                      className={`w-9 h-5 rounded-full relative transition-colors ${journey.settings?.security?.protectionType === 'pin' ? 'bg-emerald-500' : 'bg-slate-800'
                        }`}
                    >
                      <div className={`w-3.5 h-3.5 bg-slate-950 rounded-full absolute top-0.5 transition-all ${journey.settings?.security?.protectionType === 'pin' ? 'right-0.5' : 'left-0.5'
                        }`} />
                    </button>
                  </div>

                  {journey.settings?.security?.protectionType === 'pin' && (
                    <div className="animate-fade-in">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.accessPin', '4-Digit Access PIN')}</label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="0000"
                        value={journey.settings?.security?.pinCode || ''}
                        onChange={(e) => updateJourneyDetails({
                          settings: {
                            autoPlay: journey.settings?.autoPlay ?? false,
                            loopForever: journey.settings?.loopForever ?? false,
                            autoReturnHome: journey.settings?.autoReturnHome ?? false,
                            hideNavigation: journey.settings?.hideNavigation ?? false,
                            disableExit: journey.settings?.disableExit ?? false,
                            idleTimeoutSeconds: journey.settings?.idleTimeoutSeconds ?? 60,
                            requireSupervisorWitness: journey.settings?.requireSupervisorWitness ?? false,
                            security: {
                              protectionType: 'pin',
                              pinCode: e.target.value.replace(/\D/g, '')
                            }
                          }
                        })}
                        className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm font-mono tracking-widest text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                      />
                    </div>
                  )}

                  {/* Supervisor witness requirement toggle */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-900">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300">Require Supervisor Witness</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Mandates an active supervisor on site before completion.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateJourneyDetails({
                        settings: {
                          autoPlay: journey.settings?.autoPlay ?? false,
                          loopForever: journey.settings?.loopForever ?? false,
                          autoReturnHome: journey.settings?.autoReturnHome ?? false,
                          hideNavigation: journey.settings?.hideNavigation ?? false,
                          disableExit: journey.settings?.disableExit ?? false,
                          idleTimeoutSeconds: journey.settings?.idleTimeoutSeconds ?? 60,
                          requireSupervisorWitness: !journey.settings?.requireSupervisorWitness,
                          security: journey.settings?.security || { protectionType: 'none', pinCode: '' }
                        }
                      })}
                      className={`w-9 h-5 rounded-full relative transition-colors ${journey.settings?.requireSupervisorWitness ? 'bg-emerald-500' : 'bg-slate-800'
                        }`}
                    >
                      <div className={`w-3.5 h-3.5 bg-slate-950 rounded-full absolute top-0.5 transition-all ${journey.settings?.requireSupervisorWitness ? 'right-0.5' : 'left-0.5'
                        }`} />
                    </button>
                  </div>
                </div>

                {/* Validation errors summary link */}
                {validationErrorDetails.length > 0 && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-3 mt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-rose-400 flex items-center space-x-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Validation Blockers ({validationErrorDetails.length})</span>
                      </h4>
                      <button
                        onClick={() => setActiveTab('validation')}
                        className="text-[10px] font-bold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 px-2 py-0.5 rounded transition"
                      >
                        Inspect All
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {validationErrorDetails.slice(0, 3).map((err, errIdx) => (
                        <div key={errIdx} className="text-[11px] text-slate-300 flex items-start space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                          <span className="leading-snug">{err.message}</span>
                        </div>
                      ))}
                      {validationErrorDetails.length > 3 && (
                        <p className="text-[10px] text-slate-500 italic pl-3">
                          + {validationErrorDetails.length - 3} more issues in Validation tab
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STEP SETTINGS */}
            {activeTab === 'step' && activeStep && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.stepTitle', 'Step Title')}</label>
                  <input
                    type="text"
                    value={activeStep.title || ''}
                    onChange={(e) => updateStep(activeStep.id, { title: e.target.value })}
                    className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.stepTypeLayout', 'Step Type Layout')}</label>
                  <select
                    value={activeStep.type}
                    onChange={(e) => handleStepTypeChange(e.target.value as KioskStepType)}
                    className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                  >
                    {stepTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Specialized Context-Aware Step Studio */}
                <div className="pt-2 border-t border-slate-900">
                  <StepTypeStudio
                    step={activeStep}
                    journey={journey}
                    onUpdateStep={(updates) => updateStep(activeStep.id, updates)}
                    onAddBlock={(type) => addBlockToStep(activeStep.id, type)}
                    onUpdateBlock={(blockId, updates) => updateBlockInStep(activeStep.id, blockId, updates)}
                    onSelectBlock={(blockId) => selectBlock(blockId)}
                  />
                </div>

                {/* Step-level Supervisor Witness toggle */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-900">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300">Require Supervisor Witness</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Physical terminal prompts for supervisor badge verification.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateStep(activeStep.id, {
                      requireSupervisorWitness: !activeStep.requireSupervisorWitness
                    })}
                    className={`w-9 h-5 rounded-full relative transition-colors ${activeStep.requireSupervisorWitness ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                  >
                    <div className={`w-3.5 h-3.5 bg-slate-950 rounded-full absolute top-0.5 transition-all ${activeStep.requireSupervisorWitness ? 'right-0.5' : 'left-0.5'
                      }`} />
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-900 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('builder.stepUserInteraction', 'Step User Interaction')}</h4>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.interactionMechanism', 'Interaction Mechanism')}</label>
                    <select
                      value={activeStep.interaction?.type || 'none'}
                      onChange={(e) => updateStep(activeStep.id, {
                        interaction: {
                          type: e.target.value as KioskInteractionType,
                          correctStepId: activeStep.interaction?.correctStepId,
                          incorrectStepId: activeStep.interaction?.incorrectStepId,
                          hotspots: activeStep.interaction?.hotspots,
                          holdDurationMs: activeStep.interaction?.holdDurationMs,
                          quiz: activeStep.interaction?.quiz,
                          ppeItems: activeStep.interaction?.ppeItems || (e.target.value === 'ppe_checklist' ? ['Hard Hat', 'Safety Glasses', 'Steel Toe Boots'] : undefined),
                          requireSupervisorWitness: e.target.value === 'supervisor_witness' ? true : activeStep.interaction?.requireSupervisorWitness
                        }
                      })}
                      className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                    >
                      <option value="none">None (Static Screen)</option>
                      <option value="tap_to_continue">Tap Anywhere to Continue</option>
                      <option value="hold_to_confirm">Hold to Confirm Press Button</option>
                      <option value="yes_no">Yes/No Decision Branches</option>
                      <option value="hotspot">Image Hotspot Area Selector</option>
                      <option value="quiz">Interactive Knowledge Check Quiz</option>
                      <option value="ppe_checklist">PPE Checklist Verification</option>
                      <option value="supervisor_witness">Supervisor Witness Co-Signature</option>
                      <option value="swipe">Swipe Gestures</option>
                    </select>
                  </div>

                  {/* Conditional Settings: Quiz configuration */}
                  {activeStep.interaction?.type === 'quiz' && (
                    <div className="space-y-4 animate-fade-in bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                      <h5 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span>Quiz Configuration</span>
                        <span className="text-[10px] font-mono text-emerald-400">Score: {activeStep.interaction.quiz?.passingScore || 80}%</span>
                      </h5>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Passing Score Percentage (50% - 100%)
                        </label>
                        <input
                          type="number"
                          min={50}
                          max={100}
                          value={activeStep.interaction.quiz?.passingScore ?? 80}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateStep(activeStep.id, {
                              interaction: {
                                ...activeStep.interaction,
                                quiz: {
                                  passingScore: val,
                                  questions: activeStep.interaction?.quiz?.questions || [
                                    { id: 'q1', question: 'Safety Question 1', options: ['Option A', 'Option B'], correctOptionIndex: 0 }
                                  ]
                                }
                              }
                            });
                          }}
                          className="w-full rounded-lg border border-slate-900 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                        />
                      </div>

                      {/* Quiz questions list */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Questions ({(activeStep.interaction.quiz?.questions || []).length})</span>
                          <button
                            type="button"
                            onClick={() => {
                              const current = activeStep.interaction?.quiz?.questions || [];
                              const newQ = {
                                id: `q-${Date.now()}`,
                                question: `New Question ${current.length + 1}`,
                                options: ['Correct Option', 'Incorrect Option'],
                                correctOptionIndex: 0
                              };
                              updateStep(activeStep.id, {
                                interaction: {
                                  ...activeStep.interaction,
                                  quiz: {
                                    passingScore: activeStep.interaction?.quiz?.passingScore ?? 80,
                                    questions: [...current, newQ]
                                  }
                                }
                              });
                            }}
                            className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition"
                          >
                            + Add Question
                          </button>
                        </div>

                        {(activeStep.interaction.quiz?.questions || []).map((q, qIdx) => (
                          <div key={q.id || qIdx} className="p-3 bg-slate-950 rounded-lg border border-slate-900 space-y-2 relative">
                            <button
                              type="button"
                              onClick={() => {
                                const current = [...(activeStep.interaction?.quiz?.questions || [])];
                                current.splice(qIdx, 1);
                                updateStep(activeStep.id, {
                                  interaction: {
                                    ...activeStep.interaction,
                                    quiz: {
                                      passingScore: activeStep.interaction?.quiz?.passingScore ?? 80,
                                      questions: current
                                    }
                                  }
                                });
                              }}
                              className="absolute top-2 right-2 text-rose-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <label className="block text-[9px] font-bold uppercase text-slate-500">Question #{qIdx + 1}</label>
                            <input
                              type="text"
                              value={q.question || ''}
                              onChange={(e) => {
                                const current = [...(activeStep.interaction?.quiz?.questions || [])];
                                current[qIdx] = { ...current[qIdx], question: e.target.value };
                                updateStep(activeStep.id, {
                                  interaction: {
                                    ...activeStep.interaction,
                                    quiz: {
                                      passingScore: activeStep.interaction?.quiz?.passingScore ?? 80,
                                      questions: current
                                    }
                                  }
                                });
                              }}
                              className="w-full rounded border border-slate-900 bg-slate-950 p-2 text-xs text-slate-200 focus:outline-none"
                              placeholder="Enter quiz question..."
                            />

                            <div className="space-y-1.5 pt-1">
                              <label className="block text-[9px] font-bold uppercase text-slate-500">Options (Select Correct Answer):</label>
                              {q.options.map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name={`correct-${q.id || qIdx}`}
                                    checked={q.correctOptionIndex === optIdx}
                                    onChange={() => {
                                      const current = [...(activeStep.interaction?.quiz?.questions || [])];
                                      current[qIdx] = { ...current[qIdx], correctOptionIndex: optIdx };
                                      updateStep(activeStep.id, {
                                        interaction: {
                                          ...activeStep.interaction,
                                          quiz: {
                                            passingScore: activeStep.interaction?.quiz?.passingScore ?? 80,
                                            questions: current
                                          }
                                        }
                                      });
                                    }}
                                    className="accent-emerald-500"
                                  />
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const current = [...(activeStep.interaction?.quiz?.questions || [])];
                                      const opts = [...current[qIdx].options];
                                      opts[optIdx] = e.target.value;
                                      current[qIdx] = { ...current[qIdx], options: opts };
                                      updateStep(activeStep.id, {
                                        interaction: {
                                          ...activeStep.interaction,
                                          quiz: {
                                            passingScore: activeStep.interaction?.quiz?.passingScore ?? 80,
                                            questions: current
                                          }
                                        }
                                      });
                                    }}
                                    className="flex-1 rounded border border-slate-900 bg-slate-950 p-1.5 text-xs text-slate-200 focus:outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conditional Settings: Yes/No decision mapping */}
                  {activeStep.interaction?.type === 'yes_no' && (
                    <div className="space-y-3 animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.ifYesRoute', 'If YES, route to step:')}</label>
                        <select
                          value={activeStep.interaction.correctStepId || ''}
                          onChange={(e) => updateStep(activeStep.id, {
                            interaction: { ...activeStep.interaction, correctStepId: e.target.value }
                          })}
                          className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                        >
                          <option value="">-- Choose Target Step --</option>
                          {journey.steps?.filter(s => s.id !== activeStep.id).map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.ifNoRoute', 'If NO, route to step:')}</label>
                        <select
                          value={activeStep.interaction.incorrectStepId || ''}
                          onChange={(e) => updateStep(activeStep.id, {
                            interaction: { ...activeStep.interaction, incorrectStepId: e.target.value }
                          })}
                          className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                        >
                          <option value="">-- Choose Target Step --</option>
                          {journey.steps?.filter(s => s.id !== activeStep.id).map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Conditional Settings: Hold Duration */}
                  {activeStep.interaction?.type === 'hold_to_confirm' && (
                    <div className="animate-fade-in">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('builder.pressHoldDuration', 'Press Hold Duration (ms)')}</label>
                      <input
                        type="number"
                        value={activeStep.interaction.holdDurationMs || 2000}
                        onChange={(e) => updateStep(activeStep.id, {
                          interaction: { ...activeStep.interaction, holdDurationMs: Number(e.target.value) }
                        })}
                        className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                      />
                    </div>
                  )}

                  {/* Conditional Settings: Hotspots editor overlay */}
                  {activeStep.interaction?.type === 'hotspot' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-900">
                        <span className="text-xs text-slate-300">{t('builder.addTargetHotspot', 'Add target hotspot:')}</span>
                        <button
                          onClick={() => setHotspotToolActive(!hotspotToolActive)}
                          className={`px-3 py-1 rounded text-xs font-semibold transition ${hotspotToolActive
                              ? 'bg-rose-500 text-white'
                              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            }`}
                        >
                          {hotspotToolActive ? 'Cancel tool' : 'Pick coordinates'}
                        </button>
                      </div>
                      {hotspotToolActive && (
                        <p className="text-[10px] text-amber-400 animate-pulse">
                          * Click anywhere on the center canvas image area to drop a new hotspot target coordinate.
                        </p>
                      )}

                      {/* Hotspot list details */}
                      <div className="space-y-2">
                        {(activeStep.interaction.hotspots || []).map((hs, hsIdx) => (
                          <div key={hsIdx} className="bg-slate-950 border border-slate-900 p-3 rounded-lg space-y-2 relative">
                            <button
                              onClick={() => {
                                const updatedHotspots = [...(activeStep.interaction?.hotspots || [])];
                                updatedHotspots.splice(hsIdx, 1);
                                updateStep(activeStep.id, {
                                  interaction: { ...activeStep.interaction, hotspots: updatedHotspots }
                                });
                              }}
                              className="absolute top-2 right-2 p-1 rounded hover:bg-slate-900 text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="text-[10px] font-mono text-slate-500">
                              Hotspot #{hsIdx + 1} (x: {hs.x}%, y: {hs.y}%)
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t('builder.routeClickToStep', 'Route click to step:')}</label>
                              <select
                                value={hs.actionStepId || ''}
                                onChange={(e) => {
                                  const updatedHotspots = [...(activeStep.interaction?.hotspots || [])];
                                  updatedHotspots[hsIdx] = { ...hs, actionStepId: e.target.value };
                                  updateStep(activeStep.id, {
                                    interaction: { ...activeStep.interaction, hotspots: updatedHotspots }
                                  });
                                }}
                                className="w-full rounded border border-slate-900 bg-slate-950 p-2 text-xs text-slate-200 focus:outline-none"
                              >
                                <option value="">-- Choose Target Step --</option>
                                {journey.steps?.filter(s => s.id !== activeStep.id).map(s => (
                                  <option key={s.id} value={s.id}>{s.title}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conditional Settings: PPE Checklist editor */}
                  {activeStep.interaction?.type === 'ppe_checklist' && (
                    <div className="space-y-4 animate-fade-in bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-bold text-slate-300">Mandatory PPE Checklist</h5>
                          <p className="text-[10px] text-slate-500">Worker must check off all required gear before unlocking next step.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentItems = activeStep.interaction?.ppeItems || [];
                            const defaultNew = `Safety Gear Item ${currentItems.length + 1}`;
                            updateStep(activeStep.id, {
                              interaction: {
                                ...activeStep.interaction,
                                ppeItems: [...currentItems, defaultNew]
                              }
                            });
                          }}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition"
                        >
                          + Add Gear Item
                        </button>
                      </div>

                      <div className="space-y-2">
                        {((activeStep.interaction?.ppeItems && activeStep.interaction.ppeItems.length > 0)
                          ? activeStep.interaction.ppeItems
                          : ['Hard Hat', 'Safety Glasses', 'Steel Toe Boots']
                        ).map((item, itemIdx) => (
                          <div key={itemIdx} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={item}
                              onChange={(e) => {
                                const items = [
                                  ...(activeStep.interaction?.ppeItems && activeStep.interaction.ppeItems.length > 0
                                    ? activeStep.interaction.ppeItems
                                    : ['Hard Hat', 'Safety Glasses', 'Steel Toe Boots'])
                                ];
                                items[itemIdx] = e.target.value;
                                updateStep(activeStep.id, {
                                  interaction: { ...activeStep.interaction, ppeItems: items }
                                });
                              }}
                              className="flex-1 rounded-lg border border-slate-900 bg-slate-950 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                              placeholder="e.g. High-Visibility Vest"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const items = [
                                  ...(activeStep.interaction?.ppeItems && activeStep.interaction.ppeItems.length > 0
                                    ? activeStep.interaction.ppeItems
                                    : ['Hard Hat', 'Safety Glasses', 'Steel Toe Boots'])
                                ];
                                items.splice(itemIdx, 1);
                                updateStep(activeStep.id, {
                                  interaction: { ...activeStep.interaction, ppeItems: items }
                                });
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-950/20 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conditional Settings: Knowledge Quiz editor */}
                  {(activeStep.interaction?.type === 'quiz' || activeStep.type === 'knowledge_quiz') && (
                    <div className="space-y-4 animate-fade-in bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-bold text-slate-300">Comprehension Quiz Configuration</h5>
                          <p className="text-[10px] text-slate-500">Worker must pass this quiz to complete the journey (Pre-Publish Rule 4).</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentQuiz = activeStep.interaction?.quiz || { passingScore: 80, questions: [] };
                            const newQuestions = [
                              ...(currentQuiz.questions || []),
                              {
                                id: `q-${Date.now()}`,
                                question: `Safety Comprehension Question ${(currentQuiz.questions || []).length + 1}`,
                                options: ['I understand and will follow this policy', 'I do not agree'],
                                correctOptionIndex: 0
                              }
                            ];
                            updateStep(activeStep.id, {
                              interaction: {
                                ...activeStep.interaction,
                                type: 'quiz',
                                quiz: { ...currentQuiz, questions: newQuestions }
                              }
                            });
                          }}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition"
                        >
                          + Add Question
                        </button>
                      </div>

                      {/* Passing Score Input */}
                      <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-900">
                        <div>
                          <label className="text-xs font-semibold text-slate-300 block">Passing Score Threshold</label>
                          <span className="text-[10px] text-slate-500">Allowed range: 50% - 100%</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min={50}
                            max={100}
                            value={activeStep.interaction?.quiz?.passingScore ?? 80}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 50;
                              const currentQuiz = activeStep.interaction?.quiz || { passingScore: 80, questions: [] };
                              updateStep(activeStep.id, {
                                interaction: {
                                  ...activeStep.interaction,
                                  type: 'quiz',
                                  quiz: { ...currentQuiz, passingScore: Math.min(100, Math.max(50, val)) }
                                }
                              });
                            }}
                            className="w-16 rounded border border-slate-800 bg-slate-900 p-1 text-center text-xs font-bold text-emerald-400 focus:outline-none"
                          />
                          <span className="text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>

                      {/* Questions List */}
                      <div className="space-y-3">
                        {((activeStep.interaction?.quiz?.questions && activeStep.interaction.quiz.questions.length > 0)
                          ? activeStep.interaction.quiz.questions
                          : []
                        ).map((q, qIdx) => (
                          <div key={qIdx} className="p-3 rounded-lg bg-slate-950/80 border border-slate-900 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-emerald-400">Question {qIdx + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentQuiz = activeStep.interaction?.quiz || { passingScore: 80, questions: [] };
                                  const updated = [...(currentQuiz.questions || [])];
                                  updated.splice(qIdx, 1);
                                  updateStep(activeStep.id, {
                                    interaction: {
                                      ...activeStep.interaction,
                                      type: 'quiz',
                                      quiz: { ...currentQuiz, questions: updated }
                                    }
                                  });
                                }}
                                className="text-slate-500 hover:text-rose-400 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <input
                              type="text"
                              value={q.question || ''}
                              onChange={(e) => {
                                const currentQuiz = activeStep.interaction?.quiz || { passingScore: 80, questions: [] };
                                const updated = [...(currentQuiz.questions || [])];
                                updated[qIdx] = { ...updated[qIdx], question: e.target.value };
                                updateStep(activeStep.id, {
                                  interaction: {
                                    ...activeStep.interaction,
                                    type: 'quiz',
                                    quiz: { ...currentQuiz, questions: updated }
                                  }
                                });
                              }}
                              placeholder="Question prompt..."
                              className="w-full rounded border border-slate-900 bg-slate-900/60 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                            />

                            {/* Options */}
                            <div className="space-y-1.5 pl-2">
                              <div className="text-[10px] text-slate-500 font-semibold">Options (Select radio for correct answer):</div>
                              {(q.options || []).map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name={`correct-opt-${qIdx}`}
                                    checked={q.correctOptionIndex === optIdx}
                                    onChange={() => {
                                      const currentQuiz = activeStep.interaction?.quiz || { passingScore: 80, questions: [] };
                                      const updated = [...(currentQuiz.questions || [])];
                                      updated[qIdx] = { ...updated[qIdx], correctOptionIndex: optIdx };
                                      updateStep(activeStep.id, {
                                        interaction: {
                                          ...activeStep.interaction,
                                          type: 'quiz',
                                          quiz: { ...currentQuiz, questions: updated }
                                        }
                                      });
                                    }}
                                    className="accent-emerald-500"
                                  />
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const currentQuiz = activeStep.interaction?.quiz || { passingScore: 80, questions: [] };
                                      const updated = [...(currentQuiz.questions || [])];
                                      const newOpts = [...(updated[qIdx].options || [])];
                                      newOpts[optIdx] = e.target.value;
                                      updated[qIdx] = { ...updated[qIdx], options: newOpts };
                                      updateStep(activeStep.id, {
                                        interaction: {
                                          ...activeStep.interaction,
                                          type: 'quiz',
                                          quiz: { ...currentQuiz, questions: updated }
                                        }
                                      });
                                    }}
                                    placeholder={`Option ${optIdx + 1}`}
                                    className="flex-1 rounded border border-slate-900 bg-slate-900/40 p-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                                  />
                                  {q.options.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentQuiz = activeStep.interaction?.quiz || { passingScore: 80, questions: [] };
                                        const updated = [...(currentQuiz.questions || [])];
                                        const newOpts = [...(updated[qIdx].options || [])];
                                        newOpts.splice(optIdx, 1);
                                        let newCorrect = updated[qIdx].correctOptionIndex;
                                        if (newCorrect >= newOpts.length) newCorrect = 0;
                                        updated[qIdx] = { ...updated[qIdx], options: newOpts, correctOptionIndex: newCorrect };
                                        updateStep(activeStep.id, {
                                          interaction: {
                                            ...activeStep.interaction,
                                            type: 'quiz',
                                            quiz: { ...currentQuiz, questions: updated }
                                          }
                                        });
                                      }}
                                      className="p-1 text-slate-600 hover:text-rose-400"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  const currentQuiz = activeStep.interaction?.quiz || { passingScore: 80, questions: [] };
                                  const updated = [...(currentQuiz.questions || [])];
                                  const newOpts = [...(updated[qIdx].options || []), `Option ${(updated[qIdx].options || []).length + 1}`];
                                  updated[qIdx] = { ...updated[qIdx], options: newOpts };
                                  updateStep(activeStep.id, {
                                    interaction: {
                                      ...activeStep.interaction,
                                      type: 'quiz',
                                      quiz: { ...currentQuiz, questions: updated }
                                    }
                                  });
                                }}
                                className="text-[10px] text-slate-400 hover:text-emerald-400 transition"
                              >
                                + Add Option
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conditional Settings: Supervisor Witness info banner */}
                  {activeStep.interaction?.type === 'supervisor_witness' && (
                    <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-2 animate-fade-in">
                      <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Supervisor Witness Gate</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        At this step, the kiosk player freezes and presents a secure PIN entry overlay. An on-site supervisor or manager must authenticate with their 4-digit witness PIN to sign off before the worker can complete the journey.
                      </p>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* TAB 3: BLOCK SETTINGS */}
            {activeTab === 'block' && activeStep && activeBlock && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex items-center justify-between bg-slate-900/30 p-3 rounded-lg border border-slate-900">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
                    {activeBlock.type} Block ID: {activeBlock.id}
                  </span>
                  <button
                    onClick={() => removeBlockFromStep(activeStep.id, activeBlock.id)}
                    className="p-1.5 rounded-lg border border-slate-900 text-rose-500 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* LOCALIZED MULTILINGUAL CONTENT FOR BLOCK */}
                <div className="space-y-4 pt-3 border-t border-slate-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('builder.multilingualAssets', 'Multilingual Content Assets')}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {(journey.languages || ['en']).length} declared {(journey.languages || ['en']).length === 1 ? 'lang' : 'langs'}
                    </span>
                  </div>

                  {/* Iterate dynamically over all declared languages */}
                  {(journey.languages && journey.languages.length > 0 ? journey.languages : ['en']).map((langCode) => {
                    const langUpper = langCode.toUpperCase();
                    const langErrors = (validationErrorDetails || []).filter(
                      e => e.blockId === activeBlock.id && (e.language === langCode || !e.language)
                    );
                    const hasLangErrors = langErrors.length > 0;
                    const langRef = activeBlock.mediaReferences?.[langCode] || {};

                    return (
                      <div
                        key={langCode}
                        className={`p-4 rounded-xl border space-y-3 transition ${hasLangErrors
                            ? 'border-rose-500/80 bg-rose-950/20 shadow-sm shadow-rose-950'
                            : 'border-slate-900 bg-slate-950'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                            <span className={`w-2.5 h-2.5 rounded ${hasLangErrors ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            <span>Language: {langUpper}</span>
                          </h5>
                          {hasLangErrors && (
                            <span className="text-[9px] font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center space-x-1">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                              <span>Missing Assets</span>
                            </span>
                          )}
                        </div>

                        {/* Display inline validation error message for this language */}
                        {hasLangErrors && (
                          <div className="space-y-1">
                            {langErrors.map((err, errIdx) => (
                              <p key={errIdx} className="text-[11px] text-rose-400 font-medium">
                                • {err.message}
                              </p>
                            ))}
                          </div>
                        )}

                        {activeBlock.type === 'text' && (
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t('builder.textValue', 'Text Value')}</label>
                            <textarea
                              value={langRef.textValue || ''}
                              onChange={(e) => {
                                const refs = activeBlock.mediaReferences || {};
                                updateBlockInStep(activeStep.id, activeBlock.id, {
                                  mediaReferences: {
                                    ...refs,
                                    [langCode]: { ...refs[langCode], textValue: e.target.value }
                                  }
                                });
                              }}
                              rows={3}
                              placeholder={`Enter ${langUpper} text content...`}
                              className={`w-full rounded border p-2.5 text-xs text-slate-200 focus:outline-none transition resize-none ${hasLangErrors && !langRef.textValue
                                  ? 'border-rose-500 focus:border-rose-400 bg-rose-950/20'
                                  : 'border-slate-900 bg-slate-950 focus:border-emerald-500'
                                }`}
                            />
                          </div>
                        )}

                        {(activeBlock.type === 'image' || activeBlock.type === 'video') && (
                          <div className="space-y-1.5">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase">
                              {activeBlock.type === 'image' ? 'Image Media Asset & Cloud Links' : 'Video Media Asset & Cloud Links'}
                            </label>
                            <MediaAssetPicker
                              mediaType={activeBlock.type}
                              currentUploadId={langRef.uploadId}
                              currentEmbedUrl={langRef.embedUrl}
                              languageCode={langCode}
                              onAssetChange={({ uploadId, embedUrl }) => {
                                const refs = activeBlock.mediaReferences || {};
                                updateBlockInStep(activeStep.id, activeBlock.id, {
                                  mediaReferences: {
                                    ...refs,
                                    [langCode]: {
                                      ...refs[langCode],
                                      uploadId: uploadId ?? refs[langCode]?.uploadId,
                                      embedUrl: embedUrl ?? refs[langCode]?.embedUrl
                                    }
                                  }
                                });
                              }}
                            />
                          </div>
                        )}

                        {activeBlock.type === 'audio' && (
                          <div className="space-y-1.5">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase">
                              Audio Stream & Sound Clip Asset
                            </label>
                            <MediaAssetPicker
                              mediaType="audio"
                              currentUploadId={langRef.uploadId}
                              currentEmbedUrl={langRef.embedUrl}
                              languageCode={langCode}
                              onAssetChange={({ uploadId, embedUrl }) => {
                                const refs = activeBlock.mediaReferences || {};
                                updateBlockInStep(activeStep.id, activeBlock.id, {
                                  mediaReferences: {
                                    ...refs,
                                    [langCode]: {
                                      ...refs[langCode],
                                      uploadId: uploadId ?? refs[langCode]?.uploadId,
                                      embedUrl: embedUrl ?? refs[langCode]?.embedUrl
                                    }
                                  }
                                });
                              }}
                            />
                          </div>
                        )}

                        {/* Narration voiceover asset */}
                        <div className="pt-2 border-t border-slate-900 space-y-1.5">
                          <MediaAssetPicker
                            mediaType="audio"
                            currentUploadId={langRef.audioUploadId}
                            languageCode={langCode}
                            label="Narration Voiceover Audio"
                            helperText="Language-specific voiceover audio narration"
                            onAssetChange={({ uploadId }) => {
                              const refs = activeBlock.mediaReferences || {};
                              updateBlockInStep(activeStep.id, activeBlock.id, {
                                mediaReferences: {
                                  ...refs,
                                  [langCode]: {
                                    ...refs[langCode],
                                    audioUploadId: uploadId ?? refs[langCode]?.audioUploadId
                                  }
                                }
                              });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: PRE-PUBLISH VALIDATION LINTER */}
            {activeTab === 'validation' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Pre-Publish Linter</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Terminal deployment integrity & compliance validator
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => validateJourney()}
                    className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                  >
                    Re-check
                  </button>
                </div>

                {/* Status Banner */}
                <div className={`p-4 rounded-xl border ${validationErrorDetails.length === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}>
                  <div className="flex items-center space-x-2 font-bold text-sm">
                    {validationReport?.isValid ? (
                      <>
                        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>Ready for Terminal Publication</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                        <span>{validationErrorDetails.length} Publishing Blockers Found</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs mt-1 text-slate-400">
                    {validationReport?.isValid
                      ? 'All 5 compliance rules satisfied. Journey is ready to deploy to unattended kiosks.'
                      : 'Fix all defects below before deploying to physical kiosks to prevent terminal lockouts.'}
                  </p>
                </div>

                {/* Enforced Rules Checklist */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Enforced Compliance Rules
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { rule: 'step_structure', label: 'Minimum 1 Content Step' },
                      { rule: 'terminal_completion', label: 'Exactly 1 Terminal Completion Step' },
                      { rule: 'media_asset', label: 'S3 Media Asset Verification' },
                      { rule: 'language_translation', label: 'Declared Language Completeness' },
                      { rule: 'quiz_correctness', label: 'Quiz Correctness & Score Bounds (50-100%)' },
                      { rule: 'supervisor_availability', label: 'Supervisor Role Availability' }
                    ].map((item) => {
                      const ruleErrors = (validationErrorDetails || []).filter(e => e.rule === item.rule);
                      const passed = ruleErrors.length === 0;
                      return (
                        <div key={item.rule} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/50 border border-slate-900">
                          <span className="text-slate-300 font-medium">{item.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${passed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                            {passed ? 'PASS' : `${ruleErrors.length} FAIL`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detected Validation Issues List */}
                {validationErrorDetails.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Detected Issues ({validationErrorDetails.length})
                    </div>
                    <div className="space-y-2.5">
                      {validationErrorDetails.map((err, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-900/80 border border-rose-500/30 space-y-2 hover:border-rose-500/60 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase font-mono font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                              {err.rule.replace(/_/g, ' ')}
                            </span>
                            {err.language && (
                              <span className="text-[9px] font-mono uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                LANG: {err.language}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-rose-200 font-medium leading-snug">{err.message}</p>
                          {err.stepId && (
                            <button
                              type="button"
                              onClick={() => {
                                selectStep(err.stepId!);
                                if (err.blockId) {
                                  selectBlock(err.blockId);
                                }
                              }}
                              className="w-full mt-1 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition text-center"
                            >
                              {err.blockId ? 'Go to Defective Block' : 'Go to Defective Step'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
      {showSimulator && journey && (
        <JourneySimulator
          journey={journey}
          initialStepIndex={
            journey.steps && activeStepId
              ? Math.max(0, journey.steps.findIndex(s => s.id === activeStepId))
              : 0
          }
          isOpen={showSimulator}
          onClose={() => setShowSimulator(false)}
        />
      )}

      {/* Enterprise Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Publish Kiosk Journey</h3>
                  <p className="text-xs text-slate-400">Mints immutable snapshot v{(journey.publishing?.version || 0) + 1} for production terminals</p>
                </div>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pre-publish Health Summary */}
            <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${validationErrorDetails.length === 0
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
              }`}>
              <div className="flex items-center space-x-2">
                {validationErrorDetails.length === 0 ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                <span>
                  {validationErrorDetails.length === 0
                    ? 'All pre-publish compliance rules verified'
                    : `${validationErrorDetails.length} validation blockers must be resolved`}
                </span>
              </div>
              <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                Target: v{(journey.publishing?.version || 0) + 1}
              </span>
            </div>

            {/* Changelog input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Version Changelog / Audit Note (Optional)
              </label>
              <textarea
                value={publishChangelog}
                onChange={(e) => setPublishChangelog(e.target.value)}
                placeholder="e.g. Added mandatory PPE checklist and supervisor witness sign-off..."
                rows={3}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition"
              />
            </div>

            {/* Scheduling controls */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={publishScheduleEnabled}
                    onChange={(e) => setPublishScheduleEnabled(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  <span>Schedule for Future Rollout</span>
                </label>
              </div>
              {publishScheduleEnabled && (
                <input
                  type="datetime-local"
                  value={publishAtDate}
                  onChange={(e) => setPublishAtDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              )}

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={publishExpireEnabled}
                    onChange={(e) => setPublishExpireEnabled(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  <span>Automatic Expiration Date</span>
                </label>
              </div>
              {publishExpireEnabled && (
                <input
                  type="datetime-local"
                  value={expiresAtDate}
                  onChange={(e) => setExpiresAtDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={isPublishing || validationErrorDetails.length > 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isPublishing ? 'Publishing Snapshot...' : 'Confirm & Publish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Immutable Version History Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Immutable Version Snapshots (DEF-006)</h3>
                  <p className="text-xs text-slate-400">Cryptographically sealed historical snapshots with one-click rollback</p>
                </div>
              </div>
              <button
                onClick={() => setShowVersionModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingVersions ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  <p className="text-xs">Loading immutable version records...</p>
                </div>
              ) : versions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No published version snapshots recorded yet. Publish your draft to mint Version 1.
                </div>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver._id || ver.version}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-slate-700 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          v{ver.version}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${ver.status === 'published'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}>
                          {ver.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(ver.publishedAt).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRollback(ver.version)}
                        disabled={rollingBackVersion === ver.version}
                        className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-40"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{rollingBackVersion === ver.version ? 'Rolling back...' : `Rollback to v${ver.version}`}</span>
                      </button>
                    </div>

                    {ver.changelog && (
                      <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2 rounded-lg border border-slate-850">
                        "{ver.changelog}"
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                      <div className="flex items-center space-x-1.5 font-mono">
                        <span className="text-[10px] text-slate-600 uppercase">SHA-256:</span>
                        <span className="truncate max-w-[240px] text-slate-400">{ver.contentChecksum}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(ver.contentChecksum);
                            setCopiedChecksum(ver.contentChecksum);
                            setTimeout(() => setCopiedChecksum(null), 2000);
                          }}
                          className="p-1 hover:text-white transition"
                          title="Copy Checksum"
                        >
                          {copiedChecksum === ver.contentChecksum ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-500" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {ver.steps?.length || 0} Steps
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const KioskBuilder: React.FC<{ journeyId: string; onExit: () => void }> = ({ journeyId, onExit }) => {
  return (
    <KioskBuilderProvider>
      <KioskBuilderInner journeyId={journeyId} onExit={onExit} />
    </KioskBuilderProvider>
  );
};
export default KioskBuilder;
