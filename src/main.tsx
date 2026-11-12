import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/noto-serif/400.css';
import '@fontsource/noto-serif/600.css';
import '@fontsource/exo/400.css';
import '@fontsource/exo/500.css';
import '@fontsource/exo/600.css';
import '@fontsource/exo/700.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
