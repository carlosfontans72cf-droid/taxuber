// client.js - Panel del Cliente (nuevo rol)
import {
  addDoc, query, where, getDocs, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, formatDate, calculateRouteCost } from './utils.js';
import { guardPage, empresaCol, empresaDoc, logout } from './panel-common.js';

let empresaId, clientId, clientName;

guardPage(['cliente'], (session) => {
  empresaId = session.empresaId;
  clientId = session.uid;
  clientName = session.nombre;

  const el = document.getElementById('client-name');
  if (el) el.textContent = clientName;

  loadMyTrips();
});

window.calculateCost = async () => {
  const origen = document.getElementById('trip-origen').value.trim();
  const destino = document.getElementById('trip-destino').value.trim();
  const personas = parseInt(document.getElementById('trip-personas').value) || 1;

  if (!origen || !destino) return showAlert('Escribí origen y destino', 'warning');

  try {
    const priceSnap = await getDoc(empresaDoc(empresaId, 'config', 'prices'));
    const precios = priceSnap.exists() ? priceSnap.data() : { porPersona: 0, porZona: 0, porKm: 0, porHora: 0 };
    const resultado = await calculateRouteCost(origen, destino, precios, personas);

    document.getElementById('trip-result').style.display = 'block';
    document.getElementById('trip-cost-display').textContent = resultado.costo;
    document.getElementById('trip-distance-display').textContent = resultado.distance;
    document.getElementById('trip-duration-display').textContent = resultado.duration;

    window._tripData = { ...resultado, origen, destino, personas };
    showAlert('Cálculo realizado', 'success');
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

window.requestTrip = async () => {
  if (!window._tripData) return showAlert('Primero calculá el costo', 'warning');
  const datos = window._tripData;

  try {
    await addDoc(empresaCol(empresaId, 'trips'), {
      clienteId: clientId, nombreCliente: clientName,
      origen: datos.origen, destino: datos.destino,
      pasajeros: datos.personas, costoTotal: datos.costo,
      distanciaKm: datos.distanceKm, estado: 'solicitado',
      creadoPor: 'cliente', fechaInicio: serverTimestamp()
    });
    showAlert('Viaje solicitado. Pronto te asignan un chofer.', 'success');
    document.getElementById('trip-result').style.display = 'none';
    window._tripData = null;
    loadMyTrips();
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

async function loadMyTrips() {
  const tabla = document.getElementById('my-trips');
  if (!tabla) return;
  tabla.innerHTML = '';

  try {
    const q = query(empresaCol(empresaId, 'trips'), where('clienteId', '==', clientId));
    const snap = await getDocs(q);
    const viajes = [];
    snap.forEach(d => viajes.push({ id: d.id, ...d.data() }));
    viajes.sort((a, b) => {
      const dA = a.fechaInicio?.toDate?.() || new Date(0);
      const dB = b.fechaInicio?.toDate?.() || new Date(0);
      return dB - dA;
    });
    viajes.forEach(v => {
      const fila = document.createElement('tr');
      fila.innerHTML = `<td>${v.origen} → ${v.destino}</td><td>$ ${v.costoTotal}</td><td>${v.estado}</td><td>${formatDate(v.fechaInicio)}</td>`;
      tabla.appendChild(fila);
    });
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
}

window.logout = logout;

// NOTA: hoy los viajes "solicitado" quedan pendientes de que un admin/dueño
// les asigne un chofer desde su panel. Falta agregar ahí un botón para
// tomar esos viajes sueltos (ver MIGRACION.md, sección "Próximos pasos").
