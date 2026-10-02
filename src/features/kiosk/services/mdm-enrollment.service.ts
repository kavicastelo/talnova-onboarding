import { apiClient } from '../../../api/client';
import { deviceIdentityService } from './device-identity.service';
import { KioskDevice } from '../../../types/kiosk/device.types';

export interface MdmAppConfig {
  organizationSlug: string;
  enrollmentSecret: string;
  deviceHardwareId?: string;
  deviceName?: string;
  location?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  rawConfig?: Record<string, any>;
}

export interface MdmEnrollmentResult {
  success: boolean;
  enrolled: boolean;
  token?: string;
  device?: KioskDevice;
  error?: string;
}

export class MdmEnrollmentService {
  /**
   * Helper to normalize raw key-value pairs from MDM Managed AppConfig providers
   * (Microsoft Intune, VMware Workspace ONE, Jamf, MobileIron).
   */
  private extractFromObject(obj: any): MdmAppConfig | null {
    if (!obj || typeof obj !== 'object') return null;

    const organizationSlug =
      obj.organizationSlug ||
      obj.organization_slug ||
      obj.orgSlug ||
      obj.org_slug ||
      obj.organization ||
      obj.tenant ||
      obj.company_id ||
      obj.companySlug;

    const enrollmentSecret =
      obj.enrollmentSecret ||
      obj.enrollment_secret ||
      obj.secret ||
      obj.mdmSecret ||
      obj.mdm_secret ||
      obj.enrollmentToken ||
      obj.enrollment_token ||
      obj.authToken;

    const deviceHardwareId =
      obj.deviceHardwareId ||
      obj.device_hardware_id ||
      obj.hardwareGuid ||
      obj.hardware_guid ||
      obj.deviceId ||
      obj.device_id ||
      obj.deviceSerial ||
      obj.serialNumber ||
      obj.serial_number;

    const deviceName =
      obj.deviceName ||
      obj.device_name ||
      obj.name ||
      obj.kioskName ||
      obj.kiosk_name;

    const location =
      obj.location ||
      obj.siteId ||
      obj.site_id ||
      obj.facility ||
      obj.siteName;

    const deviceModel =
      obj.deviceModel ||
      obj.device_model ||
      obj.model;

    const osVersion = obj.osVersion || obj.os_version;
    const appVersion = obj.appVersion || obj.app_version;

    if (!organizationSlug || !enrollmentSecret) {
      return null;
    }

    return {
      organizationSlug: String(organizationSlug).trim(),
      enrollmentSecret: String(enrollmentSecret).trim(),
      deviceHardwareId: deviceHardwareId ? String(deviceHardwareId).trim() : undefined,
      deviceName: deviceName ? String(deviceName).trim() : undefined,
      location: location ? String(location).trim() : undefined,
      deviceModel: deviceModel ? String(deviceModel).trim() : undefined,
      osVersion: osVersion ? String(osVersion).trim() : undefined,
      appVersion: appVersion ? String(appVersion).trim() : undefined,
      rawConfig: obj,
    };
  }

  /**
   * Inspects browser global contexts for MDM Managed AppConfig XML / JSON payloads.
   * Priority:
   * 1. window.appConfig (Standard Intune Android Enterprise / iOS AppConfig)
   * 2. window.__TALNOVA_MDM_CONFIG__ (Talnova Enterprise MDM Injection wrapper)
   * 3. window.TALNOVA_KIOSK_CONFIG (Kiosk Launcher fallback)
   */
  detectAppConfig(): MdmAppConfig | null {
    const win: any =
      typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
        ? globalThis
        : null;

    if (!win) return null;

    // 1. Inspect window.appConfig (Intune Managed AppConfig standard)
    if (win.appConfig) {
      let configObj = win.appConfig;
      if (typeof configObj === 'string') {
        try {
          configObj = JSON.parse(configObj);
        } catch {
          // Non-JSON string, skip
        }
      }
      const extracted = this.extractFromObject(configObj);
      if (extracted) return extracted;
    }

    // 2. Inspect window.__TALNOVA_MDM_CONFIG__
    if (win.__TALNOVA_MDM_CONFIG__) {
      let configObj = win.__TALNOVA_MDM_CONFIG__;
      if (typeof configObj === 'string') {
        try {
          configObj = JSON.parse(configObj);
        } catch {
          // Skip
        }
      }
      const extracted = this.extractFromObject(configObj);
      if (extracted) return extracted;
    }

    // 3. Inspect window.TALNOVA_KIOSK_CONFIG
    if (win.TALNOVA_KIOSK_CONFIG) {
      const extracted = this.extractFromObject(win.TALNOVA_KIOSK_CONFIG);
      if (extracted) return extracted;
    }

    return null;
  }

  /**
   * Checks whether valid MDM Managed AppConfig credentials are present in the runtime environment.
   */
  hasMdmConfig(): boolean {
    return this.detectAppConfig() !== null;
  }

  /**
   * Checks if this terminal has already completed zero-touch MDM enrollment.
   */
  isAutoEnrollmentCompleted(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return (
      deviceIdentityService.isPaired() &&
      localStorage.getItem('kiosk_mdm_enrolled') === 'true'
    );
  }

  /**
   * Performs automatic zero-touch device registration and pairing via MDM AppConfig credentials.
   * On success:
   * 1. Stores device token and credentials in deviceIdentityService and storage.
   * 2. Clears any previous revocation lockouts.
   * 3. Dispatches global 'talnova:kiosk:mdm_enrolled' custom event.
   */
  async enrollDevice(overrideConfig?: Partial<MdmAppConfig>): Promise<MdmEnrollmentResult> {
    const detected = this.detectAppConfig();
    const config: MdmAppConfig | null = overrideConfig
      ? ({ ...(detected || {}), ...overrideConfig } as MdmAppConfig)
      : detected;

    if (!config || !config.organizationSlug || !config.enrollmentSecret) {
      return {
        success: false,
        enrolled: false,
        error: 'No valid MDM AppConfig detected (missing organizationSlug or enrollmentSecret)',
      };
    }

    try {
      // Resolve device hardware identifier (either from AppConfig or resilient hardware GUID)
      const hardwareId =
        config.deviceHardwareId ||
        (await deviceIdentityService.getOrCreateHardwareGuid());

      const payload = {
        organizationSlug: config.organizationSlug,
        enrollmentSecret: config.enrollmentSecret,
        deviceId: hardwareId,
        deviceHardwareId: hardwareId,
        name: config.deviceName || `Kiosk ${hardwareId.slice(-4).toUpperCase()}`,
        location: config.location || 'Enterprise Facility',
        deviceModel: config.deviceModel,
        osVersion: config.osVersion,
        appVersion: config.appVersion,
      };

      const res = await apiClient.post<any>('/kiosk/devices/enroll/mdm', payload);

      const token =
        res.data?.deviceToken ||
        res.data?.token ||
        res.data?.data?.deviceToken ||
        res.data?.data?.token;

      const device = res.data?.device || res.data?.data?.device;

      if (!token || !device) {
        throw new Error('Invalid response from MDM enrollment endpoint: missing device or token');
      }

      // Persist credentials and reset any revocation lockout
      deviceIdentityService.clearRevocationStatus();
      deviceIdentityService.setDeviceCredentials(device, token);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('kiosk_mdm_enrolled', 'true');
        localStorage.setItem('kiosk_mdm_org_slug', config.organizationSlug);
      }

      // Dispatch event to inform terminal components
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          const evt = typeof CustomEvent === 'function'
            ? new CustomEvent('talnova:kiosk:mdm_enrolled', { detail: { device, token, config } })
            : { type: 'talnova:kiosk:mdm_enrolled', detail: { device, token, config } };
          window.dispatchEvent(evt as any);
        } catch {
          // Ignore event dispatch failures in headless environments
        }
      }

      return {
        success: true,
        enrolled: true,
        token,
        device,
      };
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to complete MDM zero-touch enrollment';

      return {
        success: false,
        enrolled: false,
        error: msg,
      };
    }
  }
}

export const mdmEnrollmentService = new MdmEnrollmentService();
export default mdmEnrollmentService;
