import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// tailwind.css também carrega global.css (na camada "app").
import './styles/tailwind.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
