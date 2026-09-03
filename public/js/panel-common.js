// panel-common.js - Helpers compartidos entre todos los paneles (multiempresa)
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Protege una página de dashboard: exige sesión activa y un rol permitido.
// Refresca el token para traer los custom claims más recientes (empresaId, role) -
// así si un owner/manager te desactiva, el próximo refresh te saca del panel.
// Llama a onReady({ uid, empresaId, role, nombre }) si todo está bien.
export function guardPage(allowedRoles, onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/';
      return;
    }
    try {
      const tokenResult = await user.getIdTokenResult(true);
      const { role, empresaId } = tokenResult.claims;

      if (!role || !empresaId || !allowedRoles.includes(role)) {
        await signOut(auth);
        window.location.href = '/';
        return;
      }

      onReady({
        uid: user.uid,
        empresaId,
        role,
        nombre: user.displayName || ''
      });
    } catch (err) {
      console.error('Error de sesión:', err);
      window.location.href = '/';
    }
  });
}

// Referencias a las subcolecciones de la empresa actual, ej:
// empresaCol(empresaId, 'trips') === collection(db, 'empresas', empresaId, 'trips')
export const empresaCol = (empresaId, nombre) => collection(db, 'empresas', empresaId, nombre);
export const empresaDoc = (empresaId, nombre, id) => doc(db, 'empresas', empresaId, nombre, id);

export function logout() {
  signOut(auth).then(() => window.location.href = '/');
}
