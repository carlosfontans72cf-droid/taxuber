// Utilidades simplificadas

export function showAlert(message, type = 'info') {
  const colors = {
    success: '#28A745',
    danger: '#DC3545',
    warning: '#FFC107',
    info: '#17A2B8'
  };

  const div = document.createElement('div');
  div.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:9999;
    padding:15px 25px;border-radius:8px;color:white;
    font-weight:600;background:${colors[type] || colors.info};
    box-shadow:0 4px 15px rgba(0,0,0,0.3);
    transition: all 0.3s ease; opacity:1;
  `;
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 4000);
}

export function formatDate(timestamp) {
  if (!timestamp) return '—';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Inválida';
    return date.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('GPS no soportado'));
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        const mensajes = {
          1: 'Permiso denegado',
          2: 'GPS no disponible',
          3: 'Tiempo agotado'
        };
        reject(new Error(mensajes[err.code] || 'Error de ubicación'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

// Geocodificación vía servidor (sin CORS)
async function geocode(address) {
  if (!address?.trim()) throw new Error('Dirección vacía');

  const url = `/api/route?type=geocode&address=${encodeURIComponent(address)}`;
  const response = await fetch(url).then(r => r.json());

  if (response.error) throw new Error(response.error);
  if (response.status !== 'OK' || !response.results?.length) {
    throw new Error(`No encontré: "${address}"`);
  }

  return response.results[0];
}

// Calcular ruta y costo.
// modo: 'todos' (default, usado por Admin/Dueño) suma km+hora+zona+persona,
// tal como funcionaba siempre. 'km' | 'hora' | 'zona' (usado por el Chofer)
// usa SOLO esa tarifa + persona — el chofer elige el modo, nunca los precios.
export async function calculateRouteCost(origen, destino, precios, personas = 1, modo = 'todos') {
  if (!origen?.trim() || !destino?.trim()) {
    throw new Error('Escribí origen y destino');
  }

  const origResult = await geocode(origen);
  const destResult = await geocode(destino);

  const oLat = origResult.geometry.location.lat;
  const oLng = origResult.geometry.location.lng;
  const dLat = destResult.geometry.location.lat;
  const dLng = destResult.geometry.location.lng;

  const url = `/api/route?type=directions&origin=${oLat},${oLng}&destination=${dLat},${dLng}&mode=driving`;
  const dirResponse = await fetch(url).then(r => r.json());

  if (dirResponse.error) throw new Error(dirResponse.error);
  if (dirResponse.status !== 'OK' || !dirResponse.routes?.length) {
    throw new Error('No se pudo calcular la ruta');
  }

  const leg = dirResponse.routes[0].legs[0];
  const distanceKm = Number((leg.distance.value / 1000).toFixed(2));
  const durationHours = Number((leg.duration.value / 3600).toFixed(2));

  const pKm = precios?.porKm || 0;
  const pHora = precios?.porHora || 0;
  const pPersona = precios?.porPersona || 0;
  const pZona = precios?.porZona || 0;

  let costoBase;
  if (modo === 'km') costoBase = distanceKm * pKm;
  else if (modo === 'hora') costoBase = durationHours * pHora;
  else if (modo === 'zona') costoBase = pZona;
  else costoBase = distanceKm * pKm + durationHours * pHora + pZona; // 'todos'

  const costoTotal = (costoBase + personas * pPersona).toFixed(2);

  return {
    costo: `$${costoTotal}`,
    distance: leg.distance.text,
    duration: leg.duration.text,
    distanceKm,
    durationHours,
    polyline: dirResponse.routes[0].overview_polyline?.points || null,
    origenCoords: { lat: oLat, lng: oLng },
    destinoCoords: { lat: dLat, lng: dLng }
  };
}

// Decodifica el "encoded polyline" que devuelve Google Directions a una lista
// de [lat, lng] que Leaflet puede dibujar directo con L.polyline(...).
export function decodePolyline(encoded) {
  if (!encoded) return [];
  let index = 0, lat = 0, lng = 0;
  const puntos = [];

  while (index < encoded.length) {
    let result = 1, shift = 0, b;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 1;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    puntos.push([lat * 1e-5, lng * 1e-5]);
  }
  return puntos;
}

// Distancia en metros entre dos puntos [lat,lng] (fórmula de Haversine).
function distanciaMetros([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Distancia aproximada en metros de un punto al segmento más cercano de una
// ruta (lista de puntos [lat,lng]). Se usa para la alerta de "fuera de ruta".
export function distanciaARuta(punto, rutaPuntos) {
  if (!rutaPuntos?.length) return 0;
  if (rutaPuntos.length === 1) return distanciaMetros(punto, rutaPuntos[0]);

  let minDist = Infinity;
  for (let i = 0; i < rutaPuntos.length - 1; i++) {
    // Aproximación: distancia al punto más cercano entre los dos extremos
    // del segmento (suficiente para segmentos cortos de una polilínea de ruta).
    const dA = distanciaMetros(punto, rutaPuntos[i]);
    const dB = distanciaMetros(punto, rutaPuntos[i + 1]);
    minDist = Math.min(minDist, dA, dB);
  }
  return minDist;
}

export function exportToExcel(data, filename = 'taxuber.xlsx') {
  if (typeof XLSX === 'undefined') {
    return showAlert('Librería Excel no cargada', 'warning');
  }
  if (!data?.length) {
    return showAlert('Sin registros', 'info');
  }
  try {
    const hoja = XLSX.utils.json_to_sheet(data);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Datos');
    XLSX.writeFile(libro, filename);
    showAlert('Exportado correctamente', 'success');
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
}
