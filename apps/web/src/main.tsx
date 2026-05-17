import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { i18n } from './i18n';
import { AuthProvider } from './features/auth/AuthProvider';
import { ClickyProvider } from './features/clicky/ClickyProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <BrowserRouter>
          <ClickyProvider>
            <App />
          </ClickyProvider>
        </BrowserRouter>
      </AuthProvider>
    </I18nextProvider>
  </React.StrictMode>,
);
