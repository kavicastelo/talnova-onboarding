import '../../src/index.css';
import '../../src/i18n';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../src/queryClient';
import { DemoApp } from './DemoApp';
import { disableReactDevTools, neuterConsole, enforceDomainLock } from './security/antiTamper';
import { enforceBotDefense } from './utils/botDetection';

// Pre-emptively disable React DevTools hook, scrub console, domain lock, and block bots
enforceDomainLock();
disableReactDevTools();
neuterConsole();
enforceBotDefense();

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <QueryClientProvider client={queryClient}>
      <DemoApp />
    </QueryClientProvider>
  );
}
