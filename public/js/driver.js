// driver.js - Panel del Chofer
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, getCurrentLocation, calculateRouteCost } from './utils.js';

let driverId = sessionStorage.getItem('userId');
let driverName = sessionStorage.getItem('fullName');

if (!driverId || !driverName) {
  window.location.href = '/';
}

let map, marker;
let watchId = null;
let tripActive = false;

// Mostrar nombre
const nombreEl = document.getElementById('driver-name');
if (nombreEl) nombreEl.textContent = driverName;

// Mapa
async function initMap() {
  try {
    const pos = await getCurrentLocation();
    map = L.map('driver-map').setView([pos.lat, pos.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
    marker = L.marker([pos.lat, pos.lng]).addTo(map).bindPopup('Tu ubicación').openPopup();
    startGPS();
  } catch (e) {
    console.warn('GPS no disponible:', e);
    map = L.map('driver-map').setView([-34.6037, -58.3816], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
    showAlert('GPS no disponible', 'warning');
  }
}

function startGPS() {
  if (!navigator.geolocation) {
    showAlert('GPS no soportado', 'warning');
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      if (marker) marker.setLatLng([latitude, longitude]);
      try {
        await updateDoc(doc(db, 'users', driverId), {
          lat: latitude, lng: longitude, lastUpdate: serverTimestamp()
        });
      } catch(err) { console.log('Error GPS:', err); }
    },
    (err) => showAlert('Señal GPS débil', 'warning'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

// Calcular costo
window.calculateCost = async () => {
  const origen = document.getElementById('trip-origen').value.trim();
  const destino = document.getElementById('trip-destino').value.trim();
  const personas = parseInt(document.getElementById('trip-personas').value) || 1;

  if (!origen || !destino) return showAlert('Escribí origen y destino', 'warning');

  try {
    const priceSnap = await getDoc(doc(db, 'config', 'prices'));
    const precios = priceSnap.exists() ? priceSnap.data() : { porPersona:0, porZona:0, porKm:0, porHora:0 };
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

// Iniciar viaje
window.startTrip = async () => {
  if (tripActive) return showAlert('Ya hay un viaje activo', 'warning');
  if (!window._tripData) return showAlert('Primero calculá el costo', 'warning');

  const datos = window._tripData;
  try {
    await addDoc(collection(db, 'trips'), {
      userId: driverId,
      nombreConductor: driverName,
      origen: datos.origen,
      destino: datos.destino,
      pasajeros: datos.personas,
      costoTotal: datos.costo,
      distanciaKm: datos.distanceKm,
      estado: 'en_curso',
      fechaInicio: serverTimestamp()
    });
    tripActive = true;
    showAlert('Viaje iniciado', 'success');
  } catch(err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

// Finalizar viaje
window.endTrip = async () => {
  if (!tripActive) return showAlert('No hay viaje activo', 'warning');

  try {
    const consulta = query(collection(db, 'trips'), where('userId', '==', driverId), where('estado', '==', 'en_curso'));
    const resultado = await getDocs(consulta);

    if (resultado.empty) {
      tripActive = false;
      return showAlert('No hay viaje activo', 'warning');
    }

    await updateDoc(doc(db, 'trips', resultado.docs[0].id), {
      estado: 'finalizado',
      fechaFin: serverTimestamp()
    });

    tripActive = false;
    showAlert('Viaje finalizado', 'success');
  } catch(err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

// Enviar alerta
window.sendAlert = async (tipo) => {
  const desc = document.getElementById('alert-descripcion').value.trim();
  if (!desc) return showAlert('Escribí un detalle', 'warning');

  try {
    const userDoc = await getDoc(doc(db, 'users', driverId));
    const userData = userDoc.exists() ? userDoc.data() : {};

    await addDoc(collection(db, 'alerts'), {
      tipo, descripcion: desc, userId: driverId,
      nombreConductor: driverName,
      lat: userData.lat || null, lng: userData.lng || null,
      fechaHora: serverTimestamp()
    });

    showAlert(`Alerta enviada: ${tipo}`, 'danger');
    document.getElementById('alert-descripcion').value = '';
    document.getElementById('panic-dropdown')?.classList.remove('show');
  } catch(err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

// Botón pánico
const btnPanico = document.getElementById('panic-btn');
if (btnPanico) {
  btnPanico.addEventListener('click', () => {
    document.getElementById('panic-dropdown')?.classList.toggle('show');
  });
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.panic-container')) {
    document.getElementById('panic-dropdown')?.classList.remove('show');
  }
});

initMap();