# Ecosistema Personal 0.4

Centro, Iris, Mi espacio, Journal y Organizador dentro de una única PWA. La ventana principal no navega a otros dominios al cambiar de espacio. Se cargan las herramientas al usarlas y se conservan en memoria para volver sin reiniciarlas.

## Desarrollo

Requiere Node.js 22 o superior.

```sh
npm install
npm run build
npm test
npm run dev
```

El servidor local se abre en `http://127.0.0.1:4174`. La compilación produce `dist/`. Los módulos anteriores están en `legacy/`; `src/module-bridge.js` conecta sus datos y navegación a la entrada común. Los scripts y estilos se minifican, usan nombres con hash y se comparten desde caché. La PWA mantiene el documento principal y carga cada espacio en un contexto interno retenido para preservar las funciones existentes. Esto es una migración incremental, no una reescritura de todas las herramientas.

## GitHub → Vercel

1. Publicar este directorio como raíz del repositorio privado `ecosistema-personal`.
2. En Vercel: Add New → Project → importar ese repositorio desde GitHub.
3. Seleccionar el directorio raíz del repositorio. El archivo `vercel.json` define `npm run build` y la salida `dist`.
4. Elegir el despliegue automático desde la rama principal. Los próximos commits activan una compilación y publicación.

`api/trailer-search.js` es una función de Vercel que mantiene la búsqueda de tráilers. La búsqueda pública de YouTube puede verse limitada por el proveedor; el resto del ecosistema no depende de ella.

## Supabase

El cliente usa exclusivamente la URL y la clave **publishable** del proyecto (visibles por diseño en el navegador). Nunca se deben usar claves secret, service_role ni contraseñas de la base de datos en estos archivos.

La configuración pública se entrega en `src/public-config.json`; Vercel puede reemplazarla con `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Si ambas faltan, la app funciona localmente y muestra que la nube no está configurada.

La migración de `supabase/migrations/` crea `ecosystem_documents`, con aislamiento por usuario mediante RLS y una función que comprueba versiones antes de guardar. No reemplaza datos de aplicaciones anteriores. La sincronización actual conserva un documento por espacio; no constituye todavía el modelo relacional final para informes financieros, inventario y relaciones entre registros.

En Ajustes → Cuenta, sincronización y copia de seguridad se puede crear una cuenta, iniciar sesión, sincronizar y exportar/importar todos los espacios. La confirmación por correo depende de la configuración de Supabase Auth. Configure la URL del sitio y las redirecciones autorizadas en Supabase al obtener el dominio final de Vercel.

Los cambios se guardan primero en el dispositivo. Un conflicto entre dispositivos requiere elegir qué versión conservar. Los datos locales se separan por usuario. Al iniciar sesión no se suben automáticamente los datos de invitado: la importación se hace desde la cuenta.

## Llevar datos del prototipo

El navegador separa el almacenamiento por dominio. Antes de cambiar de dominio, descargue la copia desde la versión unificada anterior y luego impórtela en Vercel. Los datos que estaban en el dominio independiente del Centro anterior permanecen allí; no pueden leerse automáticamente desde otro dominio.

El funcionamiento sin conexión cubre la interfaz ya almacenada. Búsquedas, tráilers y sincronización requieren conexión. No se guardan en el service worker respuestas privadas de Supabase ni llamadas a la API.

## Validación

`npm test` verifica compilación de los cinco espacios, alcance de la PWA, copias, separación de cuentas, revisión esperada en la nube y conflictos. Las pruebas contra Supabase real y el dispositivo instalado deben repetirse después del despliegue y el inicio de sesión.


## iPhone y actividades

Ajustes > Atajos de iPhone muestra enlaces para la acción Abrir URL de Atajos: gasto, ingreso, nota y tarea. Abren formularios existentes; vos revisás y guardás. No llevan credenciales y no reemplazan aún los atajos antiguos que registraban datos en segundo plano.

La cápsula web confirma cambios y permite volver al Pomodoro en curso. Implementación propia en CSS/JavaScript inspirada en expo-dynamic-notifications; no incluye el paquete React Native ni controla ActivityKit. Funciona con la app abierta. iOS puede suspender JavaScript con la pantalla bloqueada.

Para la isla real: cliente nativo iOS con extensión WidgetKit y ActivityKit, App Intents para Siri/Atajos y APNs para actualizaciones remotas. Casos: Pomodoro, descanso y temporizador de recetas. No se ha creado ni publicado una app nativa.

Para recordatorios con la PWA cerrada: Web Push con permiso explícito desde la app instalada, suscripciones por usuario, claves VAPID de servidor y envío programado. No está conectado en esta entrega.

La zona superior usa black-translucent, viewport-fit=cover, área segura y el color del panel activo. Verificar en iPhone físico; iOS puede conservar metadatos de instalaciones anteriores.



## Integraciones móviles (24 de octubre de 2026)

Ajustes → Notificaciones y atajos permite activar/desactivar Web Push por dispositivo, enviar una prueba y crear/revocar claves de atajos. En iPhone se necesita instalar la PWA en la pantalla de inicio y conceder permiso. Una petición aceptada por el proveedor no demuestra que iOS haya mostrado el aviso: verificarlo en el teléfono.

La función Supabase `mobile` verifica sesiones con Auth o claves aleatorias de creación de registros (hash SHA-256 en servidor, caducidad de un año, revocación). El endpoint `record` exige `requestId` estable al reintentar y guarda documento + comprobante atómicamente, con control de revisión. Solo admite gastos/ingresos ordinarios con cuenta, categoría y método válidos, notas de texto y tareas. Los préstamos, las transferencias y las compras con crédito conservan sus formularios específicos. No hay claves privadas en el frontend.

Cron ejecuta el envío cada minuto. Tareas/eventos con recordatorio, servicios pendientes de Iris y temporizadores registrados se envían con una ventana de recuperación de cinco minutos, claves de deduplicación y eliminación de suscripciones caducadas. Horario de tareas y servicios: Argentina. Un aviso puede tardar aproximadamente un minuto y depende de la conexión y de los ajustes de iOS. Los cambios sin sincronizar todavía no pueden programar recordatorios de tareas/servicios en el servidor. Los temporizadores cancelados sin conexión pueden conservar su aviso pendiente.

Las tablas móviles tienen RLS, ningún permiso para anon/authenticated y acceso exclusivo del servidor. El aviso informativo del asesor `rls_enabled_no_policy` es intencional: el cliente no debe consultarlas. VAPID y el secreto del programador se generan en el servidor. El asesor también informa una configuración previa de Auth: protección de contraseñas filtradas desactivada; ver https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

La isla es una cápsula web, no ActivityKit de iOS. Tiene cola de avisos, pausa durante modales/toasts, Pomodoro con pausa/reanudación, temporizador de cocina, próximo evento a 15 minutos y confirmación de sincronización. Las acciones de deshacer anteriores se conservan y ocultan temporalmente la cápsula. Las notificaciones del sistema son independientes de esta cápsula.


## Identidad Nubo y navegación móvil

La identidad Graphite & Paper proviene de la presentación suministrada por el usuario: Iris → numio, Mi espacio → domo, Journal → lecta, Organizador → foco, panel Centro → nubo. Los SVG claros y oscuros se conservan en public/brand. Las rutas y claves internas continúan iguales para conservar los datos y los atajos.

La ventana principal mide el viewport visible y las áreas seguras de iOS; cada módulo recibe solo el margen inferior calculado, limitado a 34 px. La barra móvil tiene una fila de 54 px y 16 px de padding, más ese margen, sin filas implícitas ni altura mínima heredada. Al abrir el teclado se oculta la barra. Verificado en navegador a 390 × 844: las cinco barras terminan en y=844 y miden 70 px sin área segura simulada; la validación física de iPhone queda a cargo de la prueba en el dispositivo.
