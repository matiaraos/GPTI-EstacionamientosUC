# 01 · Cuentas y acceso

**Fuente** · RF-01–03, RN-01 y PP-01–03/PP-23. **Dependencia** · Base del repo.

Un integrante de la comunidad UC puede registrar su cuenta y patente, iniciar y cerrar sesión, y recuperar el acceso por correo institucional. El panel exige un rol administrativo autorizado.

## Implementación

- Incorporar registro, acceso, recuperación y cierre de sesión en la app móvil. Guardar las credenciales de sesión en almacenamiento seguro.
- En la API, validar correo institucional y formato chileno de patente, registrar cuenta y vehículo en una operación, almacenar el hash de la contraseña, validar sesiones y roles, y emitir enlaces de recuperación temporales y de un solo uso.
- Incorporar inicio de sesión administrativo en el panel. La API verifica el rol en cada operación protegida y limita a los usuarios finales a sus propios recursos.

## Aceptación

- Un registro válido crea la cuenta con su patente. Correo externo o duplicado y patente inválida se rechazan sin crear registros parciales.
- Credenciales inválidas reciben un error que no identifica cuál dato falló. Una cuenta común recibe rechazo al llamar directamente a una operación administrativa.
- Cerrar sesión invalida el acceso de esa sesión. Un enlace de recuperación vencido o reutilizado se rechaza.

## Decisiones abiertas

Confirmar los dominios institucionales habilitados y cómo se habilitará a los primeros administradores. Confirmar el proveedor de correo y la vigencia del enlace antes de validar recuperación con correo real.
