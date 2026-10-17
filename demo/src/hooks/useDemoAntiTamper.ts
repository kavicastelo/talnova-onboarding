import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { detectBot } from '../utils/botDetection';

export interface AntiTamperOptions {
  enableDebuggerTrap?: boolean;
  blockContextMenu?: boolean;
  blockKeyboardShortcuts?: boolean;
  blockAssetDrag?: boolean;
  detectDevTools?: boolean;
}

export function useDemoAntiTamper(options: AntiTamperOptions = {}) {
  const {
    enableDebuggerTrap = true,
    blockContextMenu = true,
    blockKeyboardShortcuts = true,
    blockAssetDrag = true,
    detectDevTools = true,
  } = options;

  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [tamperAttemptCount, setTamperAttemptCount] = useState(0);

  const notifyRestricted = useCallback((action: string) => {
    setTamperAttemptCount((prev) => prev + 1);
    toast.error(`Security Restriction: ${action} is disabled in the demonstration environment.`, {
      id: 'demo-anti-tamper-alert',
      duration: 3500,
    });
  }, []);

  // Bot & Automation check
  useEffect(() => {
    const res = detectBot();
    if (res.isBot) {
      if (typeof window !== 'undefined' && window.location) {
        const path = window.location.pathname;
        if (!path.includes('access-denied') && !path.includes('403')) {
          const target = path.startsWith('/demo')
            ? '/demo/access-denied?reason=bot_detected'
            : '/403?reason=bot_detected';
          window.location.replace(target);
        }
      }
    }
  }, []);

  // 1. Keyboard Shortcut Interception
  useEffect(() => {
    if (!blockKeyboardShortcuts || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key ? e.key.toUpperCase() : '';

      // Block F12
      if (key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        notifyRestricted('Developer Tools shortcut (F12)');
        setIsDevToolsOpen(true);
        return false;
      }

      // Block Ctrl+Shift+I (DevTools)
      if (isCmdOrCtrl && e.shiftKey && (key === 'I' || e.keyCode === 73)) {
        e.preventDefault();
        e.stopPropagation();
        notifyRestricted('Inspect element shortcut');
        setIsDevToolsOpen(true);
        return false;
      }

      // Block Ctrl+Shift+J (Console)
      if (isCmdOrCtrl && e.shiftKey && (key === 'J' || e.keyCode === 74)) {
        e.preventDefault();
        e.stopPropagation();
        notifyRestricted('Developer Console shortcut');
        setIsDevToolsOpen(true);
        return false;
      }

      // Block Ctrl+Shift+C (Inspect Element target)
      if (isCmdOrCtrl && e.shiftKey && (key === 'C' || e.keyCode === 67)) {
        e.preventDefault();
        e.stopPropagation();
        notifyRestricted('Element inspection shortcut');
        setIsDevToolsOpen(true);
        return false;
      }

      // Block Ctrl+U (View Source)
      if (isCmdOrCtrl && (key === 'U' || e.keyCode === 85)) {
        e.preventDefault();
        e.stopPropagation();
        notifyRestricted('View Source shortcut');
        return false;
      }

      // Block Ctrl+S (Save Page)
      if (isCmdOrCtrl && (key === 'S' || e.keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        notifyRestricted('Save Page shortcut');
        return false;
      }

      // Block Ctrl+P (Print / PDF extraction)
      if (isCmdOrCtrl && (key === 'P' || e.keyCode === 80)) {
        e.preventDefault();
        e.stopPropagation();
        notifyRestricted('Print & Export shortcut');
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [blockKeyboardShortcuts, notifyRestricted]);

  // 2. Right Click (Context Menu) Interception
  useEffect(() => {
    if (!blockContextMenu || typeof document === 'undefined') return;

    const handleContextMenu = (e: MouseEvent) => {
      // Allow right-click only inside inputs or textareas if needed for pasting,
      // but block across all layout/canvas/cards/text
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (!isInput) {
        e.preventDefault();
        e.stopPropagation();
        notifyRestricted('Context menu / Right click');
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu, true);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [blockContextMenu, notifyRestricted]);

  // 3. Asset Drag Interception (Prevents dragging images / SVG icons to desktop)
  useEffect(() => {
    if (!blockAssetDrag || typeof document === 'undefined') return;

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'IMG' || target.tagName === 'SVG' || target.closest('svg'))) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('dragstart', handleDragStart, true);
    return () => {
      document.removeEventListener('dragstart', handleDragStart, true);
    };
  }, [blockAssetDrag]);

  // 4. DevTools Open Detection & Debugger Trap
  useEffect(() => {
    if (!detectDevTools || typeof window === 'undefined') return;

    const checkDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;

      if (widthThreshold || heightThreshold) {
        setIsDevToolsOpen(true);
        console.clear();

        if (enableDebuggerTrap && (import.meta as any).env?.PROD) {
          try {
            // Evaluates debugger in a dynamic function to prevent devtools stepping
            Function('debugger')();
          } catch {
            // Ignore error if debugger is blocked
          }
        }
      }
    };

    const intervalId = setInterval(checkDevTools, 1200);
    window.addEventListener('resize', checkDevTools);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('resize', checkDevTools);
    };
  }, [detectDevTools, enableDebuggerTrap]);

  const dismissDevToolsWarning = useCallback(() => {
    setIsDevToolsOpen(false);
  }, []);

  return {
    isDevToolsOpen,
    tamperAttemptCount,
    dismissDevToolsWarning,
  };
}
