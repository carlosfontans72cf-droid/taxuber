// api/create-empresa.js
// Da de alta una empresa nueva (un cliente que te alquila la app) y su usuario
// "owner" inicial. Se puede llamar de dos formas: con el header
// x-superadmin-secret (para el alta inicial con curl), o ya logueado como
// superadmin desde el panel /pages/superadmin.html (con tu token de sesión).
import { adminAuth, adminDb, verifyCaller } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-superadmin-secret'];
  let autorizado = Boolean(secret && secret === process.env.SUPERADMIN_SECRET);

  if (!autorizado) {
    try {
      const caller = await verifyCaller(req);
      autorizado = caller.role === 'superadmin';
    } catch (_) {
      // sin token válido tampoco -> sigue no autorizado
    }
  }

  if (!autorizado) {
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
