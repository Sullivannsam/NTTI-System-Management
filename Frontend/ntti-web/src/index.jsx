import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { hydrate, flush } from './api';

const root = ReactDOM.createRoot(document.getElementById('root'));

/* The data layer needs one round-trip to the API before any page can read its
   data synchronously. Show a tiny splash while that happens so the app never
   renders an empty screen. */
function Splash() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        fontSize: 15,
        letterSpacing: 0.3,
      }}
    >
      Loading NTTI…
    </div>
  );
}

root.render(
  <React.StrictMode>
    <Splash />
  </React.StrictMode>
);

hydrate().finally(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

/* Writes are debounced; push the last edit out when the tab is backgrounded or
   closed so a change made just before leaving still reaches the API. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
window.addEventListener('pagehide', () => flush());

reportWebVitals();
