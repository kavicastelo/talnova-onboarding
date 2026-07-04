import React, { useState, useEffect } from 'react';
import { useKioskBuilder, KioskBuilderProvider } from '../context/KioskBuilderContext';
import { 
  Plus, Trash2, ArrowUp, ArrowDown, Type, Image as ImageIcon,
  Video, Eye, Save, Globe, Play, Layers, AlertTriangle, ShieldCheck, Sparkles
} from 'lucide-react';
import { KioskStepType, KioskInteractionType } from '../../../types/kiosk/step.types';
import { KioskBlockType } from '../../../types/kiosk/block.types';

interface KioskBuilderInnerProps {
  journeyId: string;
  onExit: () => void;
}

const KioskBuilderInner: React.FC<KioskBuilderInnerProps> = ({ journeyId, onExit }) => {
  const {
    journey,
    hasUnsavedChanges,
    activeStepId,
    activeBlockId,
    validationErrors,
    isSaving,
    loadJourney,
    updateJourneyDetails,
    saveJourney,
    publishJourney,
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

  const [activeTab, setActiveTab] = useState<'journey' | 'step' | 'block'>('journey');
  const [showAddStepMenu, setShowAddStepMenu] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [hotspotToolActive, setHotspotToolActive] = useState(false);

  // Load journey data
  useEffect(() => {
    loadJourney(journeyId);
  }, [journeyId]);

  if (!journey) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center bg-slate-950 text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-slate-400">Loading Journey Builder...</p>
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
    await saveJourney();
  };

  const handlePublish = async () => {
    const valid = validateJourney();
    if (!valid) {
      setActiveTab('journey'); // focus settings to view validation errors
      return;
    }
    const result = await publishJourney();
    if (result) {
      // success handled by context
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

  return (
    <div className="flex h-[90vh] w-full bg-slate-950 text-slate-100 font-sans border border-slate-900 rounded-xl overflow-hidden shadow-2xl">
      {/* 1. LEFT PANEL: STEP TREE LIST */}
      <div className="w-80 border-r border-slate-900 bg-slate-950 flex flex-col justify-between shrink-0">
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Step Hierarchy</span>
            </h3>
            <div className="relative">
              <button
                onClick={() => setShowAddStepMenu(!showAddStepMenu)}
                className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
              >
                <Plus className="w-4 h-4" />
              </button>
              {showAddStepMenu && (
                <div className="absolute left-0 mt-2 z-30 w-64 rounded-xl border border-slate-900 bg-slate-950 p-2 shadow-xl">
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

          <div className="space-y-2 mt-4">
            {journey.steps?.map((step, index) => (
              <div
                key={step.id}
                onClick={() => selectStep(step.id)}
                className={`group relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                  activeStepId === step.id
                    ? 'border-emerald-500/40 bg-emerald-500/5 text-white'
                    : 'border-slate-900 bg-slate-950 hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-900 px-2 py-0.5 rounded border border-slate-850">
                    {index + 1}
                  </span>
                  <div className="flex flex-col truncate">
                    <span className="text-sm font-medium truncate">{step.title}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                      {step.type.replace('_step', '').replace('_', ' ')}
                    </span>
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
            ))}
          </div>
        </div>

        {/* Global actions at bottom of left panel */}
        <div className="p-4 border-t border-slate-900 space-y-3 bg-slate-950/80">
          {hasUnsavedChanges && (
            <div className="text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/20 p-2 rounded-lg flex items-center space-x-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Unsaved changes on draft.</span>
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
              <span>Publish</span>
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

      {/* 2. CENTER PANEL: TABLET PREVIEW CANVAS */}
      <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden border-r border-slate-900">
        
        {/* Canvas Header bar */}
        <div className="absolute top-4 left-6 right-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Active Preview Canvas</span>
          </div>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition ${
              previewMode 
                ? 'bg-emerald-500 border-emerald-500/20 text-slate-950 hover:bg-emerald-400' 
                : 'bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{previewMode ? 'Edit Mode' : 'Live Preview'}</span>
          </button>
        </div>

        {activeStep ? (
          <div className="w-full max-w-2xl bg-slate-950 rounded-2xl border border-slate-950 p-8 shadow-2xl relative min-h-[400px] flex flex-col justify-between">
            {/* Tablet Mock Bezel details */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-2 bg-slate-800 rounded-full" />
            
            <div className="space-y-6">
              {/* Emergency Banner Mock preview */}
              {(activeStep.type === 'emergency_step' || activeStep.type === 'warning_step') && (
                <div className={`p-4 rounded-xl border flex items-center space-x-3 text-sm ${
                  activeStep.type === 'emergency_step' 
                    ? 'bg-rose-950/20 border-rose-500/20 text-rose-400 animate-pulse' 
                    : 'bg-amber-950/20 border-amber-500/20 text-amber-400'
                }`}>
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span className="font-medium uppercase">
                    {activeStep.type === 'emergency_step' ? 'Emergency Protocol active' : 'Safety Warning template'}
                  </span>
                </div>
              )}

              <h2 className="text-3xl font-extrabold text-white tracking-tight">
                {activeStep.title || <span className="text-slate-600 italic">Untitled Step</span>}
              </h2>

              {/* RENDER BLOCKS IN PREVIEW CONTAINER */}
              <div className="space-y-4">
                {activeStep.blocks?.length === 0 ? (
                  <div className="border border-dashed border-slate-850 rounded-xl p-8 text-center text-slate-600 text-xs">
                    No block components added yet. Use the selector below to add content blocks.
                  </div>
                ) : (
                  activeStep.blocks?.map((block) => (
                    <div
                      key={block.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectBlock(block.id);
                      }}
                      className={`group relative p-4 rounded-xl border transition ${
                        activeBlockId === block.id
                          ? 'border-emerald-500 bg-emerald-500/5'
                          : 'border-slate-900 bg-slate-950 hover:border-slate-800'
                      }`}
                    >
                      {/* Block metadata tag */}
                      <span className="absolute top-2 right-2 text-[9px] font-mono text-slate-600 bg-slate-900 px-2 py-0.5 rounded border border-slate-850 group-hover:border-slate-800">
                        {block.type.toUpperCase()}
                      </span>

                      {block.type === 'text' && (
                        <p className="text-slate-300 text-sm leading-relaxed">
                          {block.mediaReferences?.en?.textValue || 'Click to edit default English text value...'}
                        </p>
                      )}

                      {block.type === 'image' && (
                        <div
                          onClick={handleCanvasClick}
                          className={`aspect-video w-full rounded-lg bg-slate-900 flex items-center justify-center text-xs text-slate-500 border border-slate-850 relative ${
                            hotspotToolActive ? 'cursor-crosshair border-rose-500 bg-rose-500/5' : ''
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
                    </div>
                  ))
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
          <div className="text-center text-slate-600 text-sm max-w-sm">
            <Layers className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="font-semibold text-slate-500">No Step Selected</p>
            <p className="mt-1 text-xs">Choose or create a step from the left hierarchy panel to begin designing layout blocks.</p>
          </div>
        )}
      </div>

      {/* 3. RIGHT PANEL: SETTINGS & COMPONENT INSPECTOR */}
      <div className="w-96 border-l border-slate-900 bg-slate-950 flex flex-col overflow-hidden">
        {/* inspector tabs selection bar */}
        <div className="flex border-b border-slate-900 shrink-0">
          <button
            onClick={() => setActiveTab('journey')}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'journey'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Journey Settings
          </button>
          <button
            disabled={!activeStepId}
            onClick={() => setActiveTab('step')}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'step'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none'
            }`}
          >
            Step Settings
          </button>
          <button
            disabled={!activeBlockId}
            onClick={() => setActiveTab('block')}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'block'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none'
            }`}
          >
            Block Settings
          </button>
        </div>

        {/* inspector tab body panel */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* TAB 1: JOURNEY SETTINGS */}
          {activeTab === 'journey' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Journey Title</label>
                <input
                  type="text"
                  value={journey.title || ''}
                  onChange={(e) => updateJourneyDetails({ title: e.target.value })}
                  className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Description</label>
                <textarea
                  value={journey.description || ''}
                  onChange={(e) => updateJourneyDetails({ description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Idle Timeout (s)</label>
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
                        security: journey.settings?.security || { protectionType: 'none', pinCode: '' }
                      }
                    })}
                    className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Supported Langs</label>
                  <div className="flex space-x-2 pt-1">
                    {['en', 'es'].map((lang) => {
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
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider transition ${
                            active
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
                    <h4 className="text-xs font-semibold text-slate-300">Lock with secure PIN</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Require 4-digit code to play or edit.</p>
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
                        security: {
                          protectionType: journey.settings?.security?.protectionType === 'pin' ? 'none' : 'pin',
                          pinCode: journey.settings?.security?.pinCode || ''
                        }
                      }
                    })}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      journey.settings?.security?.protectionType === 'pin' ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 bg-slate-950 rounded-full absolute top-0.5 transition-all ${
                      journey.settings?.security?.protectionType === 'pin' ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {journey.settings?.security?.protectionType === 'pin' && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">4-Digit Access PIN</label>
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
              </div>

              {/* Validation errors listing */}
              {validationErrors.length > 0 && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-4 space-y-2 mt-4">
                  <h4 className="text-xs font-bold text-rose-400 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Validation Blockers ({validationErrors.length})</span>
                  </h4>
                  <ul className="list-disc pl-4 space-y-1">
                    {validationErrors.map((err, errIdx) => (
                      <li key={errIdx} className="text-[11px] text-slate-400 font-light leading-relaxed">
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STEP SETTINGS */}
          {activeTab === 'step' && activeStep && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Step Title</label>
                <input
                  type="text"
                  value={activeStep.title || ''}
                  onChange={(e) => updateStep(activeStep.id, { title: e.target.value })}
                  className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Step Type Layout</label>
                <select
                  value={activeStep.type}
                  onChange={(e) => updateStep(activeStep.id, { type: e.target.value as KioskStepType })}
                  className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                >
                  {stepTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-900 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Step User Interaction</h4>
                
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Interaction Mechanism</label>
                  <select
                    value={activeStep.interaction?.type || 'none'}
                    onChange={(e) => updateStep(activeStep.id, {
                      interaction: { 
                        type: e.target.value as KioskInteractionType,
                        correctStepId: activeStep.interaction?.correctStepId,
                        incorrectStepId: activeStep.interaction?.incorrectStepId,
                        hotspots: activeStep.interaction?.hotspots,
                        holdDurationMs: activeStep.interaction?.holdDurationMs
                      }
                    })}
                    className="w-full rounded-lg border border-slate-900 bg-slate-950 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                  >
                    <option value="none">None (Static Screen)</option>
                    <option value="tap_to_continue">Tap Anywhere to Continue</option>
                    <option value="hold_to_confirm">Hold to Confirm Press Button</option>
                    <option value="yes_no">Yes/No Decision Branches</option>
                    <option value="hotspot">Image Hotspot Area Selector</option>
                    <option value="swipe">Swipe Gestures</option>
                  </select>
                </div>

                {/* Conditional Settings: Yes/No decision mapping */}
                {activeStep.interaction?.type === 'yes_no' && (
                  <div className="space-y-3 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">If YES, route to step:</label>
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
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">If NO, route to step:</label>
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
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Press Hold Duration (ms)</label>
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
                      <span className="text-xs text-slate-300">Add target hotspot:</span>
                      <button
                        onClick={() => setHotspotToolActive(!hotspotToolActive)}
                        className={`px-3 py-1 rounded text-xs font-semibold transition ${
                          hotspotToolActive 
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
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Route click to step:</label>
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

              </div>
            </div>
          )}

          {/* TAB 3: BLOCK SETTINGS */}
          {activeTab === 'block' && activeStep && activeBlock && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between bg-slate-900/30 p-3 rounded-lg border border-slate-900">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
                  {activeBlock.type} Block ID
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
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Multilingual Content Assets</span>
                </div>

                {/* English Content configuration */}
                <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-3">
                  <h5 className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                    <span>English (EN)</span>
                  </h5>

                  {activeBlock.type === 'text' && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Text Value</label>
                      <textarea
                        value={activeBlock.mediaReferences?.en?.textValue || ''}
                        onChange={(e) => {
                          const refs = activeBlock.mediaReferences || {};
                          updateBlockInStep(activeStep.id, activeBlock.id, {
                            mediaReferences: {
                              ...refs,
                              en: { ...refs.en, textValue: e.target.value }
                            }
                          });
                        }}
                        rows={3}
                        className="w-full rounded border border-slate-900 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition resize-none"
                      />
                    </div>
                  )}

                  {(activeBlock.type === 'image' || activeBlock.type === 'video') && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Asset URL / path</label>
                      <input
                        type="text"
                        value={activeBlock.mediaReferences?.en?.embedUrl || ''}
                        onChange={(e) => {
                          const refs = activeBlock.mediaReferences || {};
                          updateBlockInStep(activeStep.id, activeBlock.id, {
                            mediaReferences: {
                              ...refs,
                              en: { ...refs.en, embedUrl: e.target.value }
                            }
                          });
                        }}
                        className="w-full rounded border border-slate-900 bg-slate-950 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                        placeholder="https://example.com/asset.jpg"
                      />
                    </div>
                  )}

                  {/* Narration voiceover asset */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Voiceover audio path</label>
                    <input
                      type="text"
                      value={activeBlock.mediaReferences?.en?.audioUploadId || ''}
                      onChange={(e) => {
                        const refs = activeBlock.mediaReferences || {};
                        updateBlockInStep(activeStep.id, activeBlock.id, {
                          mediaReferences: {
                            ...refs,
                            en: { ...refs.en, audioUploadId: e.target.value }
                          }
                        });
                      }}
                      className="w-full rounded border border-slate-900 bg-slate-950 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                      placeholder="audio-upload-uuid"
                    />
                  </div>
                </div>

                {/* Spanish Content configuration */}
                <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-3">
                  <h5 className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-sky-500" />
                    <span>Spanish (ES)</span>
                  </h5>

                  {activeBlock.type === 'text' && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Text Value</label>
                      <textarea
                        value={activeBlock.mediaReferences?.es?.textValue || ''}
                        onChange={(e) => {
                          const refs = activeBlock.mediaReferences || {};
                          updateBlockInStep(activeStep.id, activeBlock.id, {
                            mediaReferences: {
                              ...refs,
                              es: { ...refs.es, textValue: e.target.value }
                            }
                          });
                        }}
                        rows={3}
                        className="w-full rounded border border-slate-900 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition resize-none"
                      />
                    </div>
                  )}

                  {(activeBlock.type === 'image' || activeBlock.type === 'video') && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Asset URL / path</label>
                      <input
                        type="text"
                        value={activeBlock.mediaReferences?.es?.embedUrl || ''}
                        onChange={(e) => {
                          const refs = activeBlock.mediaReferences || {};
                          updateBlockInStep(activeStep.id, activeBlock.id, {
                            mediaReferences: {
                              ...refs,
                              es: { ...refs.es, embedUrl: e.target.value }
                            }
                          });
                        }}
                        className="w-full rounded border border-slate-900 bg-slate-950 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                        placeholder="https://example.com/asset-es.jpg"
                      />
                    </div>
                  )}

                  {/* Narration voiceover asset */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Voiceover audio path</label>
                    <input
                      type="text"
                      value={activeBlock.mediaReferences?.es?.audioUploadId || ''}
                      onChange={(e) => {
                        const refs = activeBlock.mediaReferences || {};
                        updateBlockInStep(activeStep.id, activeBlock.id, {
                          mediaReferences: {
                            ...refs,
                            es: { ...refs.es, audioUploadId: e.target.value }
                          }
                        });
                      }}
                      className="w-full rounded border border-slate-900 bg-slate-950 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                      placeholder="audio-upload-uuid"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
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
