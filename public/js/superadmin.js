// superadmin.js - Panel del superadmin (vos, el dueño de Taxuber como negocio)
import { auth, db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { guardPage, logout } from './panel-common.js';
import { showAlert, formatDate } from './utils.js';

guardPage(['superadmin'], (session) => {
  const el = document.getElementById('admin-name');
  if (el) el.textContent = session.nombre || 'Superadmin';
  loadEmpresas();
  document.getElementById('btn-refresh')?.addEventListener('click', loadEmpresas);
  document.getElementById('btn-crear-empresa')?.addEventListener('click', crearEmpresa);
});

async function callApi(path, body) {
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error en el servidor');
  return data;
}

async function loadEmpresas() {
  const cont = document.getElementById('empresas-list');
  if (!cont) return;
  cont.innerHTML = 'Cargando...';

  try {
    const snap = await getDocs(collection(db, 'empresas'));
    const empresas = [];
    snap.forEach(d => empresas.push({ id: d.id, ...d.data() }));
    empresas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    cont.innerHTML = '';
    if (!empresas.length) {
      cont.innerHTML = '<p style="color:#888">Todavía no hay empresas cargadas.</p>';
      return;
    }

    empresas.forEach(e => {
      const activa = e.activa !== false;
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <div><strong>${e.nombre || '(sin nombre)'}</strong>
          <span class="badge ${activa ? 'badge-active' : 'badge-inactive'}">${activa ? 'Activa' : 'Bloqueada'}</span>
        </div>
        <div style="font-size:0.85rem;color:#888">ID: ${e.id} · Creada: ${formatDate(e.createdAt)}</div>
        <div style="font-size:0.85rem;word-break:break-all;">
          Link de clientes: /registro-cliente.html?empresa=${e.id}
        </div>
        <div class="btn-group" style="margin-top:10px">
          <button class="btn btn-sm ${activa ? 'btn-danger' : 'btn-success'}" onclick="toggleEmpresa('${e.id}', ${activa})">
            ${activa ? 'Bloquear' : 'Desbloquear'}
          </button>
        </div>`;
      cont.appendChild(div);
    });
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
}

window.toggleEmpresa = async (empresaId, estaActiva) => {
  const accion = estaActiva ? 'bloquear' : 'desbloquear';
  if (!confirm(`¿Seguro que querés ${accion} esta empresa?`)) return;

  try {
    await callApi('/api/toggle-empresa', { empresaId, activa: !estaActiva });
    showAlert(estaActiva ? 'Empresa bloqueada' : 'Empresa desbloqueada', 'success');
    loadEmpresas();
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

async function crearEmpresa() {
  const nombreEmpresa = document.getElementById('nueva-empresa-nombre').value.trim();
  const ownerNombre = document.getElementById('nueva-empresa-owner-nombre').value.trim();
  const ownerApellido = document.getElementById('nueva-empresa-owner-apellido').value.trim();
  const ownerEmail = document.getElementById('nueva-empresa-owner-email').value.trim();
  const ownerPassword = document.getElementById('nueva-empresa-owner-password').value;

  if (!nombreEmpresa || !ownerNombre || !ownerApellido || !ownerEmail || !ownerPassword) {
    return showAlert('Completá todos los datos', 'warning');
  }

  try {
    const data = await callApi('/api/create-empresa', {
      nombreEmpresa, ownerNombre, ownerApellido, ownerEmail, ownerPassword
    });
    showAlert('Empresa creada', 'success');
    ['nueva-empresa-nombre', 'nueva-empresa-owner-nombre', 'nueva-empresa-owner-apellido', 'nueva-empresa-owner-email', 'nueva-empresa-owner-password']
      .forEach(id => { document.getElementById(id).value = ''; });
    loadEmpresas();

    const mensaje = `Hola ${ownerNombre}, te creamos tu cuenta en Taxuber:\nEmail: ${ownerEmail}\nContraseña: ${ownerPassword}\nApp: ${window.location.origin}\nLink para tus clientes: ${data.linkRegistroClientes}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
}

window.logout = logout;
