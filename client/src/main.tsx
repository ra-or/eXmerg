import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initConsoleBanner } from './consoleBanner';
import { useStore } from './store/useStore';
import './index.css';

initConsoleBanner();

if (typeof document !== 'undefined') {
  document.documentElement.lang = useStore.getState().locale;
}

fetch('/api/stats/pageview', { method: 'POST' }).catch(() => {});

const queryClient = new QueryClient();
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
