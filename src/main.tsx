import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registrar Service Worker generado por Vite PWA
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegistered(registration) {
      if (registration) {
        console.log('Service Worker registrado con éxito:', registration.scope);
      }
    },
    onRegisterError(error) {
      console.error('Error al registrar el Service Worker:', error);
    }
  });
}
