// driver.js - Panel del Chofer (multiempresa)
import {
  updateDoc, addDoc, query, where, getDocs, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, getCurrentLocation, calculateRouteCost, decodePolyline, distanciaARuta } from './utils.js';
import { guardPage, empresaCol, empresaDoc, logout } from './panel-common.js';

let empresaId, driverId, driverName;
let map, marker;
let tripActive = false;
let rutaActiva = null;       // puntos [lat,lng] de la ruta del viaje en curso
let fueraDeRutaAvisado = false; // para no mandar la alerta repetida en cada GPS tick
const UMBRAL_FUERA_DE_RUTA_M = 200; // metros

guardPage(['driver'], (session) => {
  empresaId = session.empresaId;
  driverId = session.uid;
  driverName = session.nombre;

  const nombreEl = document.getElementById('driver-name');
  if (nombreEl) nombreEl.textContent = driverName;

  initMap();
});

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
  navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      if (marker) marker.setLatLng([latitude, longitude]);
      try {
        await updateDoc(empresaDoc(empresaId, 'usuarios', driverId), {
          lat: latitude, lng: longitude, lastUpdate: serverTimestamp()
        });
      } catch (err) { console.log('Error GPS:', err); }

      // Si hay un viaje en curso con ruta calculada, chequear desvío.
      if (tripActive && rutaActiva?.length) {
        const distancia = distanciaARuta([latitude, longitude], rutaActiva);
        if (distancia > UMBRAL_FUERA_DE_RUTA_M && !fueraDeRutaAvisado) {
          fueraDeRutaAvisado = true;
          try {
            await addDoc(empresaCol(empresaId, 'alerts'), {
              tipo: 'Fuera de Ruta',
              descripcion: `El chofer se alejó ~${Math.round(distancia)}m de la ruta planeada.`,
              userId: driverId, nombreConductor: driverName,
              lat: latitude, lng: longitude, fechaHora: serverTimestamp()
            });
          } catch (err) { console.log('Error alerta fuera de ruta:', err); }
        } else if (distancia <= UMBRAL_FUERA_DE_RUTA_M) {
          fueraDeRutaAvisado = false; // vuelve a la ruta -> puede avisar de nuevo si se desvía otra vez
        }
      }
    },
    () => showAlert('Señal GPS débil', 'warning'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

window.calculateCost = async () => {
  const origen = document.getElementById('trip-origen').value.trim();
  const destino = document.getElementById('trip-destino').value.trim();
  const personas = parseInt(document.getElementById('trip-personas').value) || 1;
  const modo = document.getElementById('trip-modo')?.value || 'km';

  if (!origen || !destino) return showAlert('Escribí origen y destino', 'warning');

  try {
    const priceSnap = await getDoc(empresaDoc(empresaId, 'config', 'prices'));
    const precios = priceSnap.exists() ? priceSnap.data() : { porPersona: 0, porZona: 0, porKm: 0, porHora: 0 };
    const resultado = await calculateRouteCost(origen, destino, precios, personas, modo);

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

window.startTrip = async () => {
  if (tripActive) return showAlert('Ya hay un viaje activo', 'warning');
  if (!window._tripData) return showAlert('Primero calculá el costo', 'warning');

  const datos = window._tripData;
  try {
    await addDoc(empresaCol(empresaId, 'trips'), {
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
    rutaActiva = decodePolyline(datos.polyline);
    fueraDeRutaAvisado = false;
    showAlert('Viaje iniciado', 'success');

    // Abre Google Maps con navegación real turn-by-turn para este viaje.
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(datos.origen)}&destination=${encodeURIComponent(datos.destino)}&travelmode=driving`;
    window.open(mapsUrl, '_blank');
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

window.endTrip = async () => {
  if (!tripActive) return showAlert('No hay viaje activo', 'warning');

  try {
    const consulta = query(empresaCol(empresaId, 'trips'), where('userId', '==', driverId), where('estado', '==', 'en_curso'));
    const resultado = await getDocs(consulta);

    if (resultado.empty) {
      tripActive = false;
      return showAlert('No hay viaje activo', 'warning');
    }

    await updateDoc(empresaDoc(empresaId, 'trips', resultado.docs[0].id), {
      estado: 'finalizado',
      fechaFin: serverTimestamp()
    });

    tripActive = false;
    rutaActiva = null;
    fueraDeRutaAvisado = false;
    showAlert('Viaje finalizado', 'success');
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

window.sendAlert = async (tipo) => {
  const desc = document.getElementById('alert-descripcion').value.trim();
  if (!desc) return showAlert('Escribí un detalle', 'warning');

  try {
    const userDoc = await getDoc(empresaDoc(empresaId, 'usuarios', driverId));
    const userData = userDoc.exists() ? userDoc.data() : {};

    await addDoc(empresaCol(empresaId, 'alerts'), {
      tipo, descripcion: desc, userId: driverId,
      nombreConductor: driverName,
      lat: userData.lat || null, lng: userData.lng || null,
      fechaHora: serverTimestamp()
    });

    showAlert(`Alerta enviada: ${tipo}`, 'danger');
    document.getElementById('alert-descripcion').value = '';
    document.getElementById('panic-dropdown')?.classList.remove('show');
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

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

window.logout = logout;
