import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Root-level proactive fix for ResizeObserver loop issues (common with Monaco Editor)
// Wrapping the callback in requestAnimationFrame deferences any layout changes triggered 
// within the observer to the next frame, preventing the "loop limit exceeded" error.
if (typeof window !== 'undefined' && window.ResizeObserver) {
  const RO = window.ResizeObserver;
  window.ResizeObserver = class ResizeObserver extends RO {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          if (Array.isArray(entries) && entries.length > 0) {
            callback(entries, observer);
          }
        });
      });
    }
  };

  const isResizeObserverError = (err: any) => {
    try {
      if (!err) return false;
      const message = typeof err === 'string' ? err : err.message || (typeof err.toString === 'function' ? err.toString() : '');
      return (
        typeof message === 'string' &&
        message.toLowerCase().includes('resizeobserver') &&
        (message.toLowerCase().includes('loop') || message.toLowerCase().includes('notification'))
      );
    } catch (e) {
      return false;
    }
  };

  const originalError = window.console.error;
  window.console.error = (...args) => {
    if (args.some(isResizeObserverError)) return;
    originalError.apply(window.console, args);
  };

  const originalWarn = window.console.warn;
  window.console.warn = (...args) => {
    if (args.some(isResizeObserverError)) return;
    originalWarn.apply(window.console, args);
  };

  window.addEventListener('error', (e) => {
    if (isResizeObserverError(e.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
