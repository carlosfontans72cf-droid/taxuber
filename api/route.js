// api/route.js — Proxy de Google Maps (sin CORS)
// La API key ahora sale de una variable de entorno (GOOGLE_MAPS_API_KEY en
// Vercel) en vez de estar escrita en el código. La key que tenías en el
// archivo original quedó expuesta en este chat, así que te recomiendo
// regenerarla en Google Cloud Console y cargar la nueva acá.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, address, origin, destination, mode } = req.query;
  const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  try {
    if (type === 'geocode' && address) {
      const query = encodeURIComponent(address);
      const fullQuery = /uruguay|argentina|brasil/i.test(address)
        ? query
        : `${query},%20Uruguay`;

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${fullQuery}&key=${API_KEY}&language=es`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        return res.status(400).json({ error: data.error_message || `Error: ${data.status}` });
      }
      return res.status(200).json(data);

    } else if (type === 'directions' && origin && destination) {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode || 'driving'}&key=${API_KEY}&language=es`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        return res.status(400).json({ error: data.error_message || `Error: ${data.status}` });
      }
      return res.status(200).json(data);

    } else {
      return res.status(400).json({ error: 'Parámetros faltantes' });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
