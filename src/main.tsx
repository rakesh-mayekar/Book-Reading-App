import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/noto-serif/400.css';
import '@fontsource/noto-serif/500.css';
import '@fontsource/noto-serif/600.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/exo/400.css';
import '@fontsource/exo/500.css';
import '@fontsource/exo/600.css';
import '@fontsource/exo/700.css';
import './styles.css';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
