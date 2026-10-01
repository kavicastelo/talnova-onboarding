import React from 'react';

export interface KioskLiveAnnouncerProps {
  currentStepIndex?: number;
  totalSteps?: number;
  stepTitle?: string;
  isEmergency?: boolean;
  isWarning?: boolean;
  emergencyTitle?: string;
  tamperingDetected?: boolean;
  customPoliteMessage?: string;
  customAssertiveMessage?: string;
  className?: string;
}

/**
 * Universal Screen Reader ARIA Live Region Architecture (K-ACC-003).
 *
 * Implements:
 * 1. aria-live="polite" for deterministic step advance announcements ("Screen X of Y: [Step Title]")
 * 2. aria-live="assertive" for emergency broadcasts, hazard warnings, and tampering alerts
 */
export const KioskLiveAnnouncer: React.FC<KioskLiveAnnouncerProps> = ({
  currentStepIndex = 0,
  totalSteps = 0,
  stepTitle = '',
  isEmergency = false,
  isWarning = false,
  emergencyTitle,
  tamperingDetected = false,
  customPoliteMessage,
  customAssertiveMessage,
  className = ''
}) => {
  // Build polite message for step navigation
  const politeMessage =
    customPoliteMessage !== undefined
      ? customPoliteMessage
      : totalSteps > 0
      ? `Screen ${currentStepIndex + 1} of ${totalSteps}: ${stepTitle || 'Safety Step'}`
      : stepTitle || '';

  // Build assertive message for emergency, warning, or security tampering
  let assertiveMessage = customAssertiveMessage || '';
  if (!assertiveMessage) {
    if (isEmergency) {
      assertiveMessage = `EMERGENCY PROTOCOL: ${emergencyTitle || 'Immediate evacuation order active'}`;
    } else if (isWarning) {
      assertiveMessage = `SAFETY WARNING: ${stepTitle || 'Hazard Alert'}`;
    } else if (tamperingDetected) {
      assertiveMessage = 'SECURITY ALERT: Unauthorized client-side modification detected. Step reset.';
    }
  }

  return (
    <div
      id="kiosk-live-announcer"
      data-testid="kiosk-live-announcer"
      aria-label="Screen Reader Live Announcements"
      className={`sr-only pointer-events-none select-none ${className}`}
    >
      {/* 1. Polite live region: announces step transitions and progress counter */}
      <div
        id="kiosk-aria-live-polite"
        data-testid="kiosk-aria-live-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {politeMessage}
      </div>

      {/* 2. Assertive live region: interrupts screen reader for emergency alerts and hazards */}
      <div
        id="kiosk-aria-live-assertive"
        data-testid="kiosk-aria-live-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {assertiveMessage}
      </div>
    </div>
  );
};

export default KioskLiveAnnouncer;
