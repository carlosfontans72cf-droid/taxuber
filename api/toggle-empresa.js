// api/toggle-empresa.js
// Solo el superadmin puede bloquear/desbloquear una empresa entera (por ej.
// si no pagó el alquiler de la app). Al bloquearla, todos sus usuarios
// (dueño, admins, choferes, clientes) quedan afuera en el próximo refresh
// de sesión, sin tener que tocar cuenta por cuenta.
import { adminDb, verifyCaller } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const caller = await verifyCaller(req);
    if (caller.role !== 'superadmin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { empresaId, activa } = req.body || {};
    if (!empresaId || typeof activa !== 'boolean') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const ref = adminDb.collection('empresas').doc(empresaId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });

    await ref.update({ activa });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}
