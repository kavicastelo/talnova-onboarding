import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import { SessionTimeoutModal } from './SessionTimeoutModal';

export function SessionTimeoutWatcher() {
  const { isWarningOpen, secondsRemaining, stayLoggedIn, logoutNow } = useSessionTimeout();

  return (
    <SessionTimeoutModal
      open={isWarningOpen}
      secondsRemaining={secondsRemaining}
      onStayLoggedIn={stayLoggedIn}
      onLogout={logoutNow}
    />
  );
}
