import React from 'react';
import { KioskRevokedScreen } from './KioskRevokedScreen';
import { KioskDevice } from '../../../types/kiosk/device.types';

export interface KioskRevokedOverlayProps {
  device?: Partial<KioskDevice> | null;
  customMessage?: string;
  onReEnroll?: () => void;
}

export const KioskRevokedOverlay: React.FC<KioskRevokedOverlayProps> = ({
  customMessage,
  onReEnroll
}) => {
  return (
    <div data-testid="kiosk-revoked-overlay" className="w-full h-full">
      <KioskRevokedScreen customMessage={customMessage} onReEnroll={onReEnroll} />
    </div>
  );
};

export default KioskRevokedOverlay;
