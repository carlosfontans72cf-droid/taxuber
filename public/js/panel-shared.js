// panel-shared.js - Lógica común entre el Panel Admin y el Panel Dueño.
// manager.js y owner.js eran casi el mismo archivo copiado y pegado; ahora
// ambos llaman a makePanel() con distintas opciones según lo que cada rol
// puede hacer.
import { auth } from './firebase-config.js';
import { empresaCol, empresaDoc } from './panel-common.js';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, formatDate, exportToExcel, calculateRouteCost } from './utils.js';

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

// opts: { includeManagerCreation: bool, includeBlockApp: bool, tripPrefix: 'owner' | 'manager' }
export function makePanel(empresaId, opts = {}) {
  let map, markers = {};
  let driversCache = []; // choferes activos, para el selector de "Pedidos de Clientes"
  const prefix = opts.tripPrefix;

  async function loadDrivers() {
    const tbody = document.getElementById('drivers-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const select = document.getElementById('trip-chofer');
    if (select) select.innerHTML = '<option value="">-- Seleccionar --</option>';
    driversCache = [];

    try {
      const snap = await getDocs(empresaCol(empresaId, 'usuarios'));
      snap.forEach(d => {
        const data = d.data();
        if (data.role === 'owner' || data.role === 'cliente') return;

        const rol = data.role === 'manager' ? 'Admin' : 'Chofer';
        const activo = data.activo !== false ? 'Activo' : 'Inactivo';
        const clase = data.activo !== false ? 'badge-active' : 'badge-inactive';

        if (data.role === 'driver' && data.activo !== false) {
          driversCache.push({ id: d.id, nombre: `${data.nombre} ${data.apellido}` });
        }

        if (select && data.role === 'driver' && data.activo !== false) {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = `${data.nombre} ${data.apellido}`;
          opt.dataset.nombre = `${data.nombre} ${data.apellido}`;
          select.appendChild(opt);
        }

        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${data.nombre} ${data.apellido} <small>(${rol})</small></td>
          <td><span class="badge ${clase}">${activo}</span></td>
          <td>
            <button class="btn btn-sm btn-info" onclick="toggleUser('${d.id}', ${data.activo === false})">${data.activo === false ? 'Activar' : 'Desactivar'}</button>
            <button class="btn btn-sm btn-danger" onclick="deleteUser('${d.id}')">Eliminar</button>
          </td>`;
        tbody.appendChild(fila);
      });
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  }

  window.addDriver = async () => {
    const nombre = document.getElementById('driver-nombre').value.trim();
    const apellido = document.getElementById('driver-apellido').value.trim();
    const email = document.getElementById('driver-email').value.trim();
    const clave = document.getElementById('driver-password').value;

    if (!nombre || !apellido || !email || !clave) return showAlert('Completá todos los datos', 'warning');

    try {
      await callApi('/api/create-user', { nombre, apellido, email, password: clave, role: 'driver' });
      ['driver-nombre', 'driver-apellido', 'driver-email', 'driver-password'].forEach(id => {
        document.getElementById(id).value = '';
      });
      showAlert('Chofer registrado', 'success');
      // Único momento en que tenemos la contraseña en texto plano (ya no se guarda en ningún lado).
      const mensaje = `Hola ${nombre}, tus credenciales Taxuber:\nEmail: ${email}\nContraseña: ${clave}\nApp: https://taxuber.vercel.app`;
      window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
      loadDrivers();
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  };

  if (opts.includeManagerCreation) {
    window.addManager = async () => {
      const nombre = document.getElementById('manager-nombre').value.trim();
      const apellido = document.getElementById('manager-apellido').value.trim();
      const email = document.getElementById('manager-email').value.trim();
      const clave = document.getElementById('manager-password').value;

      if (!nombre || !apellido || !email || !clave) return showAlert('Completá todos los datos', 'warning');

      try {
        await callApi('/api/create-user', { nombre, apellido, email, password: clave, role: 'manager' });
        ['manager-nombre', 'manager-apellido', 'manager-email', 'manager-password'].forEach(id => {
          document.getElementById(id).value = '';
        });
        showAlert('Admin registrado', 'success');
        const mensaje = `Hola ${nombre}, tus credenciales Taxuber:\nEmail: ${email}\nContraseña: ${clave}\nApp: https://taxuber.vercel.app`;
        window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
        loadDrivers();
      } catch (err) {
        showAlert(`Error: ${err.message}`, 'danger');
      }
    };
  }

  window.toggleUser = async (id, nuevoEstado) => {
    try {
      await callApi('/api/toggle-user', { uid: id, activo: nuevoEstado });
      showAlert(nuevoEstado ? 'Usuario activado' : 'Usuario desactivado', 'info');
      loadDrivers();
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  };

  window.deleteUser = async (id) => {
    if (!confirm('¿Eliminar usuario?')) return;
    try {
      await callApi('/api/delete-user', { uid: id });
      showAlert('Usuario eliminado', 'success');
      loadDrivers();
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  };

  async function loadPrices() {
    try {
      const priceDoc = await getDoc(empresaDoc(empresaId, 'config', 'prices'));
      if (priceDoc.exists()) {
        const p = priceDoc.data();
        const el = (id) => document.getElementById(id);
        if (el('price-persona')) el('price-persona').value = p.porPersona || 0;
        if (el('price-zona')) el('price-zona').value = p.porZona || 0;
        if (el('price-km')) el('price-km').value = p.porKm || 0;
        if (el('price-hora')) el('price-hora').value = p.porHora || 0;
      }
    } catch (err) {
      console.error('Error cargando precios:', err);
    }
  }

  async function savePrices() {
    try {
      await setDoc(empresaDoc(empresaId, 'config', 'prices'), {
        porPersona: parseFloat(document.getElementById('price-persona').value) || 0,
        porZona: parseFloat(document.getElementById('price-zona').value) || 0,
        porKm: parseFloat(document.getElementById('price-km').value) || 0,
        porHora: parseFloat(document.getElementById('price-hora').value) || 0,
        updatedAt: serverTimestamp()
      });
      showAlert('Precios guardados', 'success');
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  }

  window.calcTrip = async () => {
    const origen = document.getElementById(`${prefix}-trip-origen`)?.value.trim();
    const destino = document.getElementById(`${prefix}-trip-destino`)?.value.trim();
    const personas = parseInt(document.getElementById(`${prefix}-trip-personas`)?.value) || 1;

    if (!origen || !destino) return showAlert('Escribí origen y destino', 'warning');

    try {
      const priceSnap = await getDoc(empresaDoc(empresaId, 'config', 'prices'));
      const precios = priceSnap.exists() ? priceSnap.data() : { porPersona: 0, porZona: 0, porKm: 0, porHora: 0 };
      const resultado = await calculateRouteCost(origen, destino, precios, personas);

      const resDiv = document.getElementById(`${prefix}-trip-result`);
      if (resDiv) {
        resDiv.style.display = 'block';
        document.getElementById(`${prefix}-trip-cost-display`).textContent = resultado.costo;
        document.getElementById(`${prefix}-trip-distance-display`).textContent = resultado.distance;
        document.getElementById(`${prefix}-trip-duration-display`).textContent = resultado.duration;
      }
      window._panelTrip = { ...resultado, origen, destino, personas };
      showAlert('Cálculo realizado', 'success');
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  };

  window.createTrip = async () => {
    if (!window._panelTrip) return showAlert('Primero calculá el costo', 'warning');
    const select = document.getElementById('trip-chofer');
    const choferId = select?.value;
    const choferNombre = select?.selectedOptions[0]?.dataset.nombre || 'Sin asignar';

    if (!choferId) return showAlert('Seleccioná un chofer', 'warning');

    const datos = window._panelTrip;
    try {
      await addDoc(empresaCol(empresaId, 'trips'), {
        userId: choferId, nombreConductor: choferNombre,
        origen: datos.origen, destino: datos.destino,
        pasajeros: datos.personas, costoTotal: datos.costo,
        distanciaKm: datos.distanceKm, estado: 'asignado',
        creadoPor: prefix, fechaInicio: serverTimestamp()
      });
      document.getElementById(`${prefix}-trip-origen`).value = '';
      document.getElementById(`${prefix}-trip-destino`).value = '';
      document.getElementById(`${prefix}-trip-result`).style.display = 'none';
      window._panelTrip = null;
      select.value = '';
      showAlert('Viaje creado', 'success');
      loadHistory();
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  };

  // --- Pedidos de clientes (estado "solicitado", sin chofer asignado aún) ---
  async function loadPendingRequests() {
    const cont = document.getElementById('pending-requests');
    if (!cont) return;
    cont.innerHTML = '';

    try {
      const snap = await getDocs(empresaCol(empresaId, 'trips'));
      const pendientes = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.estado === 'solicitado') pendientes.push({ id: d.id, ...data });
      });
      pendientes.sort((a, b) => {
        const dA = a.fechaInicio?.toDate?.() || new Date(0);
        const dB = b.fechaInicio?.toDate?.() || new Date(0);
        return dA - dB; // los más viejos primero
      });

      if (!pendientes.length) {
        cont.innerHTML = '<p style="color:#888">No hay pedidos de clientes pendientes.</p>';
        return;
      }

      const opcionesChofer = driversCache.length
        ? driversCache.map(c => `<option value="${c.id}" data-nombre="${c.nombre}">${c.nombre}</option>`).join('')
        : '<option value="">-- No hay choferes activos --</option>';

      pendientes.forEach(v => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <div><strong>${v.nombreCliente || 'Cliente'}</strong>: ${v.origen} → ${v.destino}</div>
          <div>$ ${v.costoTotal} · ${v.pasajeros} pasajero(s) · ${formatDate(v.fechaInicio)}</div>
          <div class="btn-group" style="margin-top:10px">
            <select class="form-control" id="assign-select-${v.id}" style="max-width:220px; display:inline-block;">
              ${opcionesChofer}
            </select>
            <button class="btn btn-sm btn-success" onclick="assignDriverToTrip('${v.id}')">Asignar Chofer</button>
          </div>`;
        cont.appendChild(div);
      });
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  }

  window.assignDriverToTrip = async (tripId) => {
    const select = document.getElementById(`assign-select-${tripId}`);
    const choferId = select?.value;
    const choferNombre = select?.selectedOptions[0]?.dataset.nombre;

    if (!choferId) return showAlert('Seleccioná un chofer', 'warning');

    try {
      await updateDoc(empresaDoc(empresaId, 'trips', tripId), {
        userId: choferId, nombreConductor: choferNombre, estado: 'asignado'
      });
      showAlert('Chofer asignado', 'success');
      loadPendingRequests();
      loadHistory();
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  };

  function initLiveMap() {
    const cont = document.getElementById('live-map');
    if (!cont) return;
    map = L.map('live-map').setView([-34.6037, -58.3816], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
    escucharUbicaciones();
  }

  function escucharUbicaciones() {
    onSnapshot(empresaCol(empresaId, 'usuarios'), (cambios) => {
      Object.values(markers).forEach(m => map.removeLayer(m));
      markers = {};
      cambios.forEach(docSnap => {
        const datos = docSnap.data();
        if (datos.activo !== false && datos.lat && datos.lng) {
          const icono = datos.role === 'manager' ? '👔' : (datos.role === 'driver' ? '🚖' : null);
          if (!icono) return;
          markers[docSnap.id] = L.marker([datos.lat, datos.lng]).addTo(map)
            .bindPopup(`<b>${icono} ${datos.nombre} ${datos.apellido}</b>`);
        }
      });
    });
  }

  async function loadAlerts() {
    const cont = document.getElementById('alerts-list');
    if (!cont) return;
    cont.innerHTML = '';
    try {
      const snap = await getDocs(empresaCol(empresaId, 'alerts'));
      const alertas = [];
      snap.forEach(d => alertas.push({ id: d.id, ...d.data() }));
      alertas.sort((a, b) => {
        const dA = a.fechaHora?.toDate?.() || new Date(0);
        const dB = b.fechaHora?.toDate?.() || new Date(0);
        return dB - dA;
      });
      alertas.forEach(a => {
        const div = document.createElement('div');
        div.className = 'card alert-card';
        div.innerHTML = `<strong>⚠️ ${a.tipo}</strong> - ${a.descripcion}<br><small>${a.nombreConductor || 'Sin nombre'} | ${formatDate(a.fechaHora)}</small>
          <div class="btn-group" style="margin-top:10px">
            <button class="btn btn-sm btn-danger" onclick="deleteAlert('${a.id}')">Borrar</button>
          </div>`;
        cont.appendChild(div);
      });
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  }

  window.deleteAlert = async (id) => {
    try {
      await deleteDoc(empresaDoc(empresaId, 'alerts', id));
      loadAlerts();
      showAlert('Alerta eliminada', 'success');
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  };

  async function loadHistory() {
    const tabla = document.getElementById('history-list');
    if (!tabla) return;
    tabla.innerHTML = '';
    try {
      const snap = await getDocs(empresaCol(empresaId, 'trips'));
      const viajes = [];
      snap.forEach(d => viajes.push({ id: d.id, ...d.data() }));
      viajes.sort((a, b) => {
        const dA = a.fechaInicio?.toDate?.() || new Date(0);
        const dB = b.fechaInicio?.toDate?.() || new Date(0);
        return dB - dA;
      });
      viajes.forEach(v => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${v.nombreConductor || 'Sin asignar'}</td><td>${v.origen || ''} → ${v.destino || ''}</td><td>$ ${v.costoTotal || 0}</td><td>${formatDate(v.fechaInicio)}</td><td><button class="btn btn-sm btn-danger" onclick="deleteTrip('${v.id}')">Eliminar</button></td>`;
        tabla.appendChild(fila);
      });
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  }

  window.deleteTrip = async (id) => {
    if (!confirm('¿Eliminar viaje?')) return;
    try {
      await deleteDoc(empresaDoc(empresaId, 'trips', id));
      loadHistory();
      showAlert('Viaje eliminado', 'success');
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  };

  function exportHistory() {
    const filas = [];
    document.querySelectorAll('#history-list tr').forEach(fila => {
      const celdas = fila.querySelectorAll('td');
      if (celdas.length >= 4) {
        filas.push({ Chofer: celdas[0].textContent, Ruta: celdas[1].textContent, Costo: celdas[2].textContent, Fecha: celdas[3].textContent });
      }
    });
    exportToExcel(filas, 'taxuber.xlsx');
  }

  async function loadStats() {
    try {
      const promesas = [getDocs(empresaCol(empresaId, 'usuarios')), getDocs(empresaCol(empresaId, 'trips'))];
      if (opts.includeBlockApp) promesas.push(getDocs(empresaCol(empresaId, 'alerts')));
      const results = await Promise.all(promesas);
      const el1 = document.getElementById('stat-drivers');
      const el2 = document.getElementById('stat-trips');
      const el3 = document.getElementById('stat-alerts');
      if (el1) el1.textContent = results[0].size;
      if (el2) el2.textContent = results[1].size;
      if (el3 && results[2]) el3.textContent = results[2].size;
    } catch (err) {
      console.warn(err);
    }
  }

  if (opts.includeBlockApp) {
    window.blockApp = async () => {
      if (!confirm('¿Bloquear la app para tu empresa?')) return;
      try {
        await setDoc(empresaDoc(empresaId, 'config', 'appStatus'), { blocked: true, fechaBloqueo: serverTimestamp() });
        showAlert('Empresa BLOQUEADA', 'danger');
      } catch (err) {
        showAlert(`Error: ${err.message}`, 'danger');
      }
    };
    window.unblockApp = async () => {
      try {
        await setDoc(empresaDoc(empresaId, 'config', 'appStatus'), { blocked: false }, { merge: true });
        showAlert('Empresa DESBLOQUEADA', 'success');
      } catch (err) {
        showAlert(`Error: ${err.message}`, 'danger');
      }
    };
  }

  function setupListeners() {
    document.getElementById('btn-add-driver')?.addEventListener('click', window.addDriver);
    document.getElementById('btn-add-manager')?.addEventListener('click', window.addManager);
    document.getElementById('btn-save-prices')?.addEventListener('click', savePrices);
    document.getElementById('btn-refresh-alerts')?.addEventListener('click', loadAlerts);
    document.getElementById('btn-load-history')?.addEventListener('click', loadHistory);
    document.getElementById('btn-export-excel')?.addEventListener('click', exportHistory);
    document.getElementById('btn-refresh-requests')?.addEventListener('click', loadPendingRequests);
    document.getElementById('btn-calc-trip')?.addEventListener('click', window.calcTrip);
    document.getElementById('btn-create-trip')?.addEventListener('click', window.createTrip);
    document.getElementById('btn-block-app')?.addEventListener('click', window.blockApp);
    document.getElementById('btn-unblock-app')?.addEventListener('click', window.unblockApp);
  }

  return {
    init: async () => {
      // Los botones se conectan primero, pase lo que pase con la carga de datos de abajo.
      // Antes, si loadPrices/initLiveMap fallaban (ej: empresa nueva sin precios cargados
      // todavía), el error cortaba la ejecución ANTES de llegar a setupListeners() y los
      // botones quedaban sin funcionar, sin ningún aviso visible.
      setupListeners();

      try {
        await loadDrivers(); // primero, porque loadPendingRequests necesita driversCache
      } catch (err) {
        console.error('Error cargando usuarios:', err);
      }

      await Promise.allSettled([loadPrices(), loadAlerts(), loadStats(), loadPendingRequests()]);

      try {
        initLiveMap();
      } catch (err) {
        console.error('Error inicializando el mapa:', err);
      }
    }
  };
}