// api/create-empresa.js
// Da de alta una empresa nueva (un cliente que te alquila la app) y su usuario
// "owner" inicial. Protegido con un secreto propio (SUPERADMIN_SECRET en Vercel)
// porque todavía no hay un panel de superadmin con su propio login: es un
// paso intermedio hasta que armemos ese panel. Llamalo vos mismo (con curl o
// Postman) cada vez que sumes una empresa nueva.
import { adminAuth, adminDb } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-superadmin-secret'];
  if (!secret || secret !== process.env.SUPERADMIN_SECRET) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  try {
    const { nombreEmpresa, ownerNombre, ownerApellido, ownerEmail, ownerPassword } = req.body || {};
    if (!nombreEmpresa || !ownerNombre || !ownerApellido || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const empresaRef = await adminDb.collection('empresas').add({
      nombre: nombreEmpresa, activa: true, createdAt: new Date()
    });

    const ownerRecord = await adminAuth.createUser({
      email: ownerEmail,
      password: ownerPassword,
      displayName: `${ownerNombre} ${ownerApellido}`
    });

    await adminAuth.setCustomUserClaims(ownerRecord.uid, { role: 'owner', empresaId: empresaRef.id });

    await empresaRef.collection('usuarios').doc(ownerRecord.uid).set({
      nombre: ownerNombre, apellido: ownerApellido, email: ownerEmail,
      role: 'owner', activo: true, createdAt: new Date()
    });

    return res.status(200).json({
      empresaId: empresaRef.id,
      linkRegistroClientes: `https://taxuber.vercel.app/registro-cliente.html?empresa=${empresaRef.id}`
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}
