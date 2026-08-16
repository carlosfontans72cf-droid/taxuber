// owner.js - Panel del Dueño
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, formatDate, exportToExcel, calculateRouteCost } from './utils.js';

let map, markers = {};
const nombreUsuario = sessionStorage.getItem('fullName');
const infoEl = document.getElementById('user-info');
if (infoEl && nombreUsuario) infoEl.textContent = nombreUsuario;

async function init() {
  try {
    await Promise.all([loadDrivers(), loadPrices(), loadAlerts(), loadStats(), initMap()]);
    setupListeners();
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
}

function setupListeners() {
  document.getElementById('btn-add-driver')?.addEventListener('click', addDriver);
  document.getElementById('btn-add-manager')?.addEventListener('click', addManager);
  document.getElementById('btn-save-prices')?.addEventListener('click', savePrices);
  document.getElementById('btn-refresh-alerts')?.addEventListener('click', loadAlerts);
  document.getElementById('btn-load-history')?.addEventListener('click', loadHistory);
  document.getElementById('btn-export-excel')?.addEventListener('click', exportHistory);
  document.getElementById('btn-block-app')?.addEventListener('click', blockApp);
  document.getElementById('btn-unblock-app')?.addEventListener('click', unblockApp);
  document.getElementById('btn-calc-trip')?.addEventListener('click', calcTrip);
  document.getElementById('btn-create-trip')?.addEventListener('click', createTrip);
}

async function loadDrivers() {
  const tbody = document.getElementById('drivers-list');
  if (!tbody) return;
  tbody.innerHTML = '';

  const select = document.getElementById('trip-chofer');
  if (select) select.innerHTML = '<option value="">-- Seleccionar --</option>';

  try {
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach(d => {
      const data = d.data();
      if (data.role === 'owner') return;

      const rol = data.role === 'manager' ? 'Admin' : 'Chofer';
      const activo = data.activo ? 'Activo' : 'Inactivo';
      const clase = data.activo ? 'badge-active' : 'badge-inactive';

      if (select && data.role === 'driver' && data.activo) {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${data.nombre} ${data.apellido}`;
        opt.dataset.nombre = `${data.nombre} ${data.apellido}`;
        select.appendChild(opt);
      }

      const mensaje = `Hola ${data.nombre}, tus credenciales Taxuber:\nUsuario: ${data.nombre} ${data.apellido}\nContraseña: ${data.password}\nApp: https://taxuber.vercel.app`;

      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${data.nombre} ${data.apellido} <small>(${rol})</small></td>
        <td><span class="badge ${clase}">${activo}</span></td>
        <td>
          <button class="btn btn-sm btn-info" onclick="toggleUser('${d.id}', ${!data.activo})">${data.activo ? 'Desactivar' : 'Activar'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser('${d.id}')">Eliminar</button>
          <a href="https://wa.me/?text=${encodeURIComponent(mensaje)}" target="_blank" class="btn btn-sm btn-success">WhatsApp</a>
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
  const clave = document.getElementById('driver-password').value;

  if (!nombre || !apellido || !clave) return showAlert('Completá todos los datos', 'warning');

  try {
    await addDoc(collection(db, 'users'), { nombre, apellido, password: clave, role: 'driver', activo: true, createdAt: serverTimestamp() });
    document.getElementById('driver-nombre').value = '';
    document.getElementById('driver-apellido').value = '';
    document.getElementById('driver-password').value = '';
    showAlert('Chofer registrado', 'success');
    loadDrivers();
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

window.addManager = async () => {
  const nombre = document.getElementById('manager-nombre').value.trim();
  const apellido = document.getElementById('manager-apellido').value.trim();
  const clave = document.getElementById('manager-password').value;

  if (!nombre || !apellido || !clave) return showAlert('Completá todos los datos', 'warning');

  try {
    await addDoc(collection(db, 'users'), { nombre, apellido, password: clave, role: 'manager', activo: true, createdAt: serverTimestamp() });
    document.getElementById('manager-nombre').value = '';
    document.getElementById('manager-apellido').value = '';
    document.getElementById('manager-password').value = '';
    showAlert('Admin registrado', 'success');
    loadDrivers();
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

window.toggleUser = async (id, nuevoEstado) => {
  try {
    await updateDoc(doc(db, 'users', id), { activo: nuevoEstado });
    showAlert(nuevoEstado ? 'Activado' : 'Desactivado', 'info');
    loadDrivers();
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

window.deleteUser = async (id) => {
  if (!confirm('¿Eliminar usuario?')) return;
  try { await deleteDoc(doc(db, 'users', id)); showAlert('Eliminado', 'success'); loadDrivers(); }
  catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

async function loadPrices() {
  const doc = await getDoc(doc(db, 'config', 'prices'));
  if (doc.exists()) {
    const p = doc.data();
    const el = (id) => document.getElementById(id);
    if (el('price-persona')) el('price-persona').value = p.porPersona || 0;
    if (el('price-zona')) el('price-zona').value = p.porZona || 0;
    if (el('price-km')) el('price-km').value = p.porKm || 0;
    if (el('price-hora')) el('price-hora').value = p.porHora || 0;
  }
}

async function savePrices() {
  try {
    await setDoc(doc(db, 'config', 'prices'), {
      porPersona: parseFloat(document.getElementById('price-persona').value) || 0,
      porZona: parseFloat(document.getElementById('price-zona').value) || 0,
      porKm: parseFloat(document.getElementById('price-km').value) || 0,
      porHora: parseFloat(document.getElementById('price-hora').value) || 0,
      updatedAt: serverTimestamp()
    });
    showAlert('Precios guardados', 'success');
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
}

// Crear viaje
window.calcTrip = async () => {
  const origen = document.getElementById('owner-trip-origen')?.value.trim();
  const destino = document.getElementById('owner-trip-destino')?.value.trim();
  const personas = parseInt(document.getElementById('owner-trip-personas')?.value) || 1;

  if (!origen || !destino) return showAlert('Escribí origen y destino', 'warning');

  try {
    const priceSnap = await getDoc(doc(db, 'config', 'prices'));
    const precios = priceSnap.exists() ? priceSnap.data() : { porPersona:0, porZona:0, porKm:0, porHora:0 };
    const resultado = await calculateRouteCost(origen, destino, precios, personas);

    const resDiv = document.getElementById('owner-trip-result');
    if (resDiv) {
      resDiv.style.display = 'block';
      document.getElementById('owner-trip-cost-display').textContent = resultado.costo;
      document.getElementById('owner-trip-distance-display').textContent = resultado.distance;
      document.getElementById('owner-trip-duration-display').textContent = resultado.duration;
    }
    window._ownerTrip = { ...resultado, origen, destino, personas };
    showAlert('Cálculo realizado', 'success');
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

window.createTrip = async () => {
  if (!window._ownerTrip) return showAlert('Primero calculá el costo', 'warning');
  const select = document.getElementById('trip-chofer');
  const choferId = select?.value;
  const choferNombre = select?.selectedOptions[0]?.dataset.nombre || 'Sin asignar';

  if (!choferId) return showAlert('Seleccioná un chofer', 'warning');

  const datos = window._ownerTrip;
  try {
    await addDoc(collection(db, 'trips'), {
      userId: choferId, nombreConductor: choferNombre,
      origen: datos.origen, destino: datos.destino,
      pasajeros: datos.personas, costoTotal: datos.costo,
      distanciaKm: datos.distanceKm, estado: 'asignado',
      creadoPor: 'owner', fechaInicio: serverTimestamp()
    });
    document.getElementById('owner-trip-origen').value = '';
    document.getElementById('owner-trip-destino').value = '';
    document.getElementById('owner-trip-result').style.display = 'none';
    window._ownerTrip = null;
    select.value = '';
    showAlert('Viaje creado', 'success');
    loadHistory();
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

function initMap() {
  const cont = document.getElementById('live-map');
  if (!cont) return;
  map = L.map('live-map').setView([-34.6037, -58.3816], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
  escucharUbicaciones();
}

function escucharUbicaciones() {
  onSnapshot(collection(db, 'users'), (cambios) => {
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};
    cambios.forEach(docSnap => {
      const datos = docSnap.data();
      if (datos.activo && datos.lat && datos.lng) {
        const icono = datos.role === 'manager' ? '' : '🚖';
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
    const snap = await getDocs(collection(db, 'alerts'));
    const alertas = [];
    snap.forEach(d => alertas.push({ id: d.id, ...d.data() }));
    alertas.sort((a, b) => {
      const dA = a.fechaHora?.toDate?.() || new Date(0);
      const dB = b.fechaHora?.toDate?.() || new Date(0);
      return dB - dA;
    });
    alertas.forEach(a => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `<strong>️ ${a.tipo}</strong> - ${a.descripcion}<br><small>${a.nombreConductor || 'Sin nombre'} | ${formatDate(a.fechaHora)}</small>
        <div class="btn-group" style="margin-top:10px">
          <button class="btn btn-sm btn-danger" onclick="deleteAlert('${a.id}')">Borrar</button>
        </div>`;
      cont.appendChild(div);
    });
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
}

window.deleteAlert = async (id) => {
  try { await deleteDoc(doc(db, 'alerts', id)); loadAlerts(); showAlert('Eliminada', 'success'); }
  catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

async function loadHistory() {
  const tabla = document.getElementById('history-list');
  if (!tabla) return;
  tabla.innerHTML = '';
  try {
    const snap = await getDocs(collection(db, 'trips'));
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
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
}

window.deleteTrip = async (id) => {
  if (!confirm('¿Eliminar viaje?')) return;
  try { await deleteDoc(doc(db, 'trips', id)); loadHistory(); showAlert('Eliminado', 'success'); }
  catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
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

async function blockApp() {
  if (!confirm('¿Bloquear la app?')) return;
  try {
    await setDoc(doc(db, 'config', 'appStatus'), { blocked: true, fechaBloqueo: serverTimestamp() });
    showAlert('App BLOQUEADA', 'danger');
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
}

async function unblockApp() {
  try {
    await setDoc(doc(db, 'config', 'appStatus'), { blocked: false }, { merge: true });
    showAlert('App DESBLOQUEADA', 'success');
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
}

async function loadStats() {
  try {
    const [users, trips, alerts] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'trips')),
      getDocs(collection(db, 'alerts'))
    ]);
    const el1 = document.getElementById('stat-drivers');
    const el2 = document.getElementById('stat-trips');
    const el3 = document.getElementById('stat-alerts');
    if (el1) el1.textContent = users.size;
    if (el2) el2.textContent = trips.size;
    if (el3) el3.textContent = alerts.size;
  } catch (err) { console.warn(err); }
}

init();