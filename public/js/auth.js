// Sistema de autenticación simplificado
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const btnLogin = document.getElementById('btn-login');
const errorDiv = document.getElementById('login-error');

btnLogin.addEventListener('click', async () => {
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const password = document.getElementById('password').value;

  errorDiv.textContent = '';
  btnLogin.disabled = true;
  btnLogin.textContent = 'Entrando...';

  try {
    if (!nombre || !apellido || !password) {
      errorDiv.textContent = 'Completá todos los campos';
      throw new Error('Faltan datos');
    }

    const usersRef = collection(db, 'users');
    const consulta = query(
      usersRef,
      where('nombre', '==', nombre),
      where('apellido', '==', apellido)
    );
    const resultado = await getDocs(consulta);

    if (resultado.empty) {
      errorDiv.textContent = 'Usuario no registrado';
      throw new Error('Usuario no encontrado');
    }

    let datosUsuario = null;
    let idUsuario = null;

    for (const registro of resultado.docs) {
      const datos = registro.data();
      if (datos.password === password) {
        if (!datos.activo) {
          errorDiv.textContent = 'Cuenta desactivada';
          throw new Error('Usuario inactivo');
        }
        datosUsuario = datos;
        idUsuario = registro.id;
        break;
      }
    }

    if (!datosUsuario) {
      errorDiv.textContent = 'Contraseña incorrecta';
      throw new Error('Contraseña incorrecta');
    }

    // Guardar sesión
    sessionStorage.setItem('userRole', datosUsuario.role);
    sessionStorage.setItem('userId', idUsuario);
    sessionStorage.setItem('fullName', `${datosUsuario.nombre} ${datosUsuario.apellido}`);

    // Redirección según rol
    let destino = '/pages/dashboard-driver.html';
    if (datosUsuario.role === 'owner') destino = '/pages/dashboard-owner.html';
    else if (datosUsuario.role === 'manager') destino = '/pages/dashboard-manager.html';

    window.location.href = destino;

  } catch (error) {
    console.error('Error login:', error);
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = 'Iniciar Sesión';
  }
});

// Botón mostrar/ocultar contraseña
document.addEventListener('click', e => {
  const btn = e.target.closest('.ver-contrasena');
  if (!btn) return;
  const campo = document.getElementById(btn.dataset.target);
  if (!campo) return;
  campo.type = campo.type === 'password' ? 'text' : 'password';
  btn.textContent = campo.type === 'password' ? '👁' : '🙈';
});