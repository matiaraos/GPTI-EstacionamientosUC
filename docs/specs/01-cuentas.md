# 01 · Cuentas y acceso

**Fuente** · RF-01–03, RN-01 y PP-01–03/PP-23. **Dependencia** · Base del repo.

Un integrante de la comunidad UC puede registrar su cuenta y patente, iniciar y cerrar sesión, y recuperar el acceso por correo institucional. El panel exige un rol administrativo autorizado.

## 01A · Acceso y base visual

**Base y dependencias** · Monorepo con app Expo, panel React y API Express de diagnóstico.

**Entrega** · App con registro, inicio y cierre de sesión y almacenamiento seguro. Panel con acceso administrativo. API con roles, hash de contraseña y registro atómico de cuenta y patente chilena. Usar un dominio ficticio configurable y un administrador de prueba provisionado localmente. En la primera pantalla, definir colores, tipografía y espaciado y extraer solo los componentes que necesita ese flujo.

**Aceptación** · Un registro válido permite iniciar sesión. Un correo externo o duplicado y una patente inválida se rechazan sin registros parciales. Credenciales incorrectas reciben un error genérico. Cerrar sesión invalida el acceso de esa sesión y la API rechaza operaciones administrativas de cuentas comunes. En móvil, los campos y la acción principal siguen accesibles con teclado abierto.

**Pendiente para piloto** · Confirmar dominios y procedimiento para habilitar a los primeros administradores antes de usar cuentas reales.

## 01B · Recuperación por correo

**Base y dependencias** · 01A.

**Entrega** · Extender la app y la API con solicitud y confirmación de recuperación. Usar un canal de prueba y una vigencia configurable para validar el flujo localmente.

**Aceptación** · Un enlace válido permite cambiar la contraseña una vez. Enlaces vencidos o reutilizados se rechazan y una solicitud para un correo desconocido recibe la misma respuesta pública.

**Pendiente para piloto** · Confirmar proveedor de correo, vigencia y entrega real.
