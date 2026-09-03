// owner.js - Panel del Dueño (multiempresa)
import { guardPage, logout } from './panel-common.js';
import { makePanel } from './panel-shared.js';

guardPage(['owner'], (session) => {
  const infoEl = document.getElementById('user-info');
  if (infoEl) infoEl.textContent = session.nombre;

  // Link que le pasás a tus clientes para que se registren solos, ya vinculados a tu empresa.
  const linkEl = document.getElementById('client-invite-link');
  if (linkEl) {
    const link = `${window.location.origin}/registro-cliente.html?empresa=${session.empresaId}`;
    linkEl.textContent = link;
    linkEl.href = link;
  }

  const panel = makePanel(session.empresaId, {
    includeManagerCreation: true,
    includeBlockApp: true,
    tripPrefix: 'owner'
  });
  panel.init();
});

window.logout = logout;
