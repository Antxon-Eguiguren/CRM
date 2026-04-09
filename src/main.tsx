import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App.tsx';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth-context';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="erp-crm-theme"
        disableTransitionOnChange
      >
        <AuthProvider>
          <App />
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
