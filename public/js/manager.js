// manager.js - Panel Administrador (multiempresa)
import { guardPage, logout } from './panel-common.js';
import { makePanel } from './panel-shared.js';

guardPage(['manager', 'owner'], (session) => {
  const infoEl = document.getElementById('user-info');
  if (infoEl) infoEl.textContent = session.nombre;

  const panel = makePanel(session.empresaId, {
    includeManagerCreation: false,
    includeBlockApp: false,
    tripPrefix: 'manager'
  });
  panel.init();
});

window.logout = logout;
