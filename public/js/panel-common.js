// panel-common.js - Helpers compartidos entre todos los paneles (multiempresa)
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Protege una página de dashboard: exige sesión activa y un rol permitido.
// Refresca el token para traer los custom claims más recientes (empresaId, role) -
// así si un owner/manager te desactiva, el próximo refresh te saca del panel.
// El rol "superadmin" no tiene empresaId (administra todas las empresas).
// Para el resto de los roles, además chequea que el superadmin no haya
// bloqueado la empresa (empresas/{empresaId}.activa === false).
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

      if (!role || !allowedRoles.includes(role)) {
        await signOut(auth);
        window.location.href = '/';
        return;
      }

      if (role !== 'superadmin') {
        if (!empresaId) {
          await signOut(auth);
          window.location.href = '/';
          return;
        }
        const empresaSnap = await getDoc(doc(db, 'empresas', empresaId));
        if (empresaSnap.exists() && empresaSnap.data().activa === false) {
          await signOut(auth);
          window.location.href = '/?bloqueada=1';
          return;
        }
      }

      onReady({
        uid: user.uid,
        empresaId: empresaId || null,
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
