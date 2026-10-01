import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Flame,
  Volume2,
  VolumeX,
  PhoneCall,
  MapPin,
  Compass,
  Lock,
  ArrowRight,
  ShieldAlert,
  Radio
} from 'lucide-react';
import { KioskEmergency } from '../../../../types/kiosk/emergency.types';
import { emergencyService } from '../../services/emergency.service';

export interface EmergencyEvacuationOverlayProps {
  emergency: KioskEmergency;
  onDismiss?: () => void;
}

export const EmergencyEvacuationOverlay: React.FC<EmergencyEvacuationOverlayProps> = ({
  emergency
}) => {
  const [isMuted, setIsMuted] = useState(() => emergencyService.getSiren().getIsMuted());
  const [pulseTick, setPulseTick] = useState(0);

  // Flashing alert interval
  useEffect(() => {
    const timer = setInterval(() => {
      setPulseTick((prev) => (prev + 1) % 2);
    }, 800);
    return () => clearInterval(timer);
  }, []);

  // Trap all keyboard events to prevent navigating away
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      // Block common navigation keys
      if (['Escape', 'Tab', 'Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'Backspace', 'F11', 'F5'].includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Toggle siren audio
  const handleToggleSiren = () => {
    const muted = emergencyService.getSiren().toggleMute();
    setIsMuted(muted);
  };

  const getEmergencyIcon = () => {
    switch (emergency.type) {
      case 'fire':
        return <Flame className="w-10 h-10 text-amber-300 animate-bounce" />;
      case 'gas_leak':
      case 'toxic_spill':
        return <Radio className="w-10 h-10 text-yellow-300 animate-pulse" />;
      default:
        return <AlertTriangle className="w-10 h-10 text-red-200 animate-pulse" />;
    }
  };

  const formatEmergencyType = (type: string) => {
    return type.toUpperCase().replace('_', ' ');
  };

  return (
    <div
      data-testid="emergency-evacuation-overlay"
      id="emergency-evacuation-overlay"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed inset-0 z-[200] select-none overflow-y-auto bg-slate-950/95 backdrop-blur-2xl flex flex-col border-[6px] border-red-600 transition-colors duration-500 shadow-[inset_0_0_100px_rgba(220,38,38,0.5)]"
      style={{
        boxShadow: pulseTick === 0
          ? 'inset 0 0 120px rgba(239, 68, 68, 0.6), 0 0 80px rgba(220, 38, 38, 0.8)'
          : 'inset 0 0 60px rgba(185, 28, 28, 0.4), 0 0 30px rgba(185, 28, 28, 0.4)'
      }}
    >
      {/* Top High-Priority Flashing Emergency Banner */}
      <header
        data-testid="emergency-banner"
        className={`w-full py-4 px-6 md:px-12 flex flex-wrap items-center justify-between transition-colors duration-500 ${
          pulseTick === 0 ? 'bg-red-700 text-white' : 'bg-red-900 text-red-100'
        } shadow-2xl border-b border-red-500/60`}
      >
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-red-950/80 rounded-2xl border border-red-400 shadow-inner flex items-center justify-center">
            {getEmergencyIcon()}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black tracking-widest bg-white text-red-900 uppercase">
                {emergency.severity.toUpperCase()}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-red-200">
                OFFICIAL SAFETY OVERRIDE • {formatEmergencyType(emergency.type)}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white mt-0.5">
              {emergency.title || 'IMMEDIATE EVACUATION ORDER'}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-4 mt-3 sm:mt-0">
          {emergency.soundSiren && (
            <button
              onClick={handleToggleSiren}
              data-testid="siren-toggle"
              aria-label="Toggle Siren Mute"
              className="min-h-[48px] min-w-[48px] flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/20 text-white text-sm font-semibold transition active:scale-95"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-5 h-5 text-red-300" />
                  <span>Siren Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-5 h-5 text-emerald-300 animate-pulse" />
                  <span>Siren Playing</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-950/90 border border-red-400 text-red-200 text-sm font-bold">
            <Lock className="w-4 h-4 text-red-400" />
            <span>TERMINAL CONTROLS LOCKED</span>
          </div>
        </div>
      </header>

      {/* Main Evacuation Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 text-white">
        
        {/* Left Column: Evacuation Map & Assembly Zone (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          
          {/* Facility Evacuation Map Card */}
          <div
            data-testid="evacuation-map"
            className="rounded-3xl border border-red-500/40 bg-slate-900/80 p-6 backdrop-blur-xl shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <Compass className="w-6 h-6 text-emerald-400" />
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Facility Evacuation Map & Exits
                </h2>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                ACTIVE ESCAPE VECTORS
              </span>
            </div>

            {emergency.evacuationMapUrl ? (
              <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700 bg-black min-h-[300px] flex items-center justify-center">
                <img
                  src={emergency.evacuationMapUrl}
                  alt="Emergency Evacuation Floor Plan"
                  className="w-full h-auto max-h-[420px] object-contain"
                />
              </div>
            ) : (
              /* Vector Architectural Floorplan Schematic */
              <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/90 p-4 min-h-[320px] flex flex-col justify-between">
                <svg
                  viewBox="0 0 600 320"
                  className="w-full h-auto drop-shadow-md select-none"
                  style={{ maxHeight: '340px' }}
                >
                  <defs>
                    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="1" />
                    </pattern>
                    <linearGradient id="primaryRoute" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="secondaryRoute" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
                    </linearGradient>
                  </defs>

                  {/* Floorplan Grid Background */}
                  <rect width="600" height="320" fill="url(#grid)" />

                  {/* Building Perimeter Walls */}
                  <rect x="40" y="40" width="520" height="240" rx="12" fill="none" stroke="#475569" strokeWidth="4" />

                  {/* Room Compartments */}
                  <rect x="40" y="40" width="160" height="110" fill="#0f172a" fillOpacity="0.7" stroke="#334155" strokeWidth="2" />
                  <text x="120" y="95" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">WORKSHOP A</text>

                  <rect x="40" y="170" width="160" height="110" fill="#0f172a" fillOpacity="0.7" stroke="#334155" strokeWidth="2" />
                  <text x="120" y="225" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">STORAGE BAY</text>

                  <rect x="400" y="40" width="160" height="110" fill="#0f172a" fillOpacity="0.7" stroke="#334155" strokeWidth="2" />
                  <text x="480" y="95" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">LOGISTICS HUB</text>

                  {/* Central Main Corridor */}
                  <rect x="220" y="60" width="160" height="200" rx="6" fill="#1e293b" fillOpacity="0.5" stroke="#334155" strokeDasharray="4 4" />
                  <text x="300" y="110" fill="#cbd5e1" fontSize="12" textAnchor="middle" fontWeight="bold">CENTRAL ATRIUM</text>

                  {/* Primary Evacuation Pathway (Green Line to East Door) */}
                  <path
                    d="M 300 170 L 300 150 L 560 150"
                    fill="none"
                    stroke="url(#primaryRoute)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="8 6"
                    className="animate-pulse"
                  />

                  {/* Secondary Evacuation Pathway (Amber Line to South Door) */}
                  <path
                    d="M 300 170 L 300 280"
                    fill="none"
                    stroke="url(#secondaryRoute)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="6 6"
                  />

                  {/* Current Kiosk Terminal Node */}
                  <circle cx="300" cy="170" r="14" fill="#ef4444" />
                  <circle cx="300" cy="170" r="22" fill="#ef4444" fillOpacity="0.3" className="animate-ping" />
                  <text x="300" y="174" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="900">YOU</text>
                  <text x="300" y="200" fill="#fca5a5" fontSize="10" textAnchor="middle" fontWeight="bold">CURRENT TERMINAL</text>

                  {/* Primary Exit Marker (East) */}
                  <g transform="translate(530, 130)">
                    <rect width="60" height="40" rx="6" fill="#065f46" stroke="#10b981" strokeWidth="2" />
                    <text x="30" y="24" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="black">EXIT A</text>
                  </g>

                  {/* Secondary Exit Marker (South) */}
                  <g transform="translate(270, 260)">
                    <rect width="60" height="30" rx="6" fill="#78350f" stroke="#f59e0b" strokeWidth="2" />
                    <text x="30" y="19" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="black">EXIT B</text>
                  </g>
                </svg>

                {/* Map Legend */}
                <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                    <span className="text-slate-300 font-medium">Your Current Kiosk</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded bg-emerald-500 shadow-sm" />
                    <span className="text-slate-300 font-medium">Primary Escape Route</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded bg-amber-500 shadow-sm" />
                    <span className="text-slate-300 font-medium">Secondary Exit</span>
                  </div>
                </div>
              </div>
            )}

            {/* Exit Details Badges */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-emerald-900/80 text-emerald-300">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase text-emerald-400">Primary Exit</div>
                  <div className="text-sm font-semibold text-white">
                    {emergency.primaryExit || 'Main East Stairwell Ground Floor Exit'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-amber-900/80 text-amber-300">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase text-amber-400">Secondary Alternate Exit</div>
                  <div className="text-sm font-semibold text-white">
                    {emergency.secondaryExit || 'South Bay Loading Dock Fire Escape Door'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Assembly Zone Card */}
          <div
            data-testid="assembly-zone"
            className="rounded-3xl border border-indigo-500/30 bg-slate-900/80 p-6 backdrop-blur-xl shadow-2xl flex flex-col space-y-3"
          >
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-800">
              <MapPin className="w-6 h-6 text-indigo-400" />
              <div>
                <h3 className="text-lg font-bold text-white">Designated Muster & Assembly Zone</h3>
                <p className="text-xs text-indigo-300">Report immediately for mandatory headcount</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 text-indigo-100 font-semibold text-base">
              {emergency.assemblyZone || 'Assembly Area 1: North Parking Lot Courtyard (Flagpole Zone)'}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300 pt-1">
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="font-bold text-white block mb-0.5">1. Walk, Don't Run</span>
                Proceed quickly along marked routes. Leave bulky gear behind.
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="font-bold text-white block mb-0.5">2. Avoid Elevators</span>
                Use stairwells and fire escape corridors exclusively.
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="font-bold text-white block mb-0.5">3. Check-In With Warden</span>
                Report directly to safety wardens at the muster point for roll call.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Alert Directives & Emergency Contacts (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* Emergency Directives & Instructions */}
          <div className="rounded-3xl border border-red-500/40 bg-gradient-to-b from-red-950/60 to-slate-900/90 p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-red-900/60">
              <ShieldAlert className="w-6 h-6 text-red-400" />
              <h3 className="text-lg font-bold text-white">Emergency Instructions</h3>
            </div>

            <div className="text-base text-red-100 leading-relaxed font-medium bg-red-950/40 p-4 rounded-2xl border border-red-800/40">
              {emergency.message}
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs space-y-1">
              <div className="font-bold uppercase tracking-wider flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Notice for Plant Personnel</span>
              </div>
              <p>
                All onboarding sessions, sign-offs, and briefing quizzes are automatically paused.
                No progress or dwell time records will be lost.
              </p>
            </div>
          </div>

          {/* Emergency Phone Contacts List */}
          <div
            data-testid="emergency-contacts"
            className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-xl shadow-2xl flex-1 flex flex-col space-y-4"
          >
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <PhoneCall className="w-6 h-6 text-emerald-400" />
              <div>
                <h3 className="text-lg font-bold text-white">Emergency Contacts</h3>
                <p className="text-xs text-slate-400">Direct safety lines for plant response</p>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              {(emergency.emergencyContacts && emergency.emergencyContacts.length > 0
                ? emergency.emergencyContacts
                : [
                    { name: 'Plant Safety Dispatcher', phone: '+1 (555) 911-0420', role: 'Control Room 24/7' },
                    { name: 'Fire Response Coordinator', phone: '+1 (555) 911-0112', role: 'First Response Unit' },
                    { name: 'Site Security Operations', phone: 'Extension 2222', role: 'Security Desk' }
                  ]
              ).map((contact, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex items-center justify-between hover:bg-slate-800 transition"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-white">{contact.name}</div>
                    {contact.role && (
                      <div className="text-xs text-slate-400">{contact.role}</div>
                    )}
                  </div>
                  <a
                    href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}
                    className="min-h-[48px] min-w-[48px] flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-mono text-sm font-bold active:scale-95 transition"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>{contact.phone}</span>
                  </a>
                </div>
              ))}
            </div>

            {/* Lockout Notice */}
            <div className="pt-3 border-t border-slate-800 flex items-center space-x-3 text-xs text-slate-400">
              <Lock className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>
                Standard UI navigation is disabled until this alert is cleared by safety controllers.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmergencyEvacuationOverlay;
