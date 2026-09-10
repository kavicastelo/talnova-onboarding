export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] ServiceWorker registered with scope: ', registration.scope);
        })
        .catch((error) => {
          console.error('[PWA] ServiceWorker registration failed: ', error);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
    }
  }
}
