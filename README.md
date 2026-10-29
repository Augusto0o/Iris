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

`npm run test:ui` (después de `npm run build`) abre Nubo en Chromium con la geometría de un iPhone 402×874 instalado y comprueba: barra inferior pegada al borde con su despeje en los tres modos de barra de estado, sin scroll horizontal en ninguna app, campos de 16 px (sin zoom al enfocar), diálogo de cuenta debajo de la barra de estado, selector de apps, isla (aviso chico que se va solo, pastilla compacta, ícono centrado), ventanas que bloquean el fondo, liberación de apps inactivas, buscador del ecosistema y tamaño de letra. GitHub Actions lo corre en cada push.

Para cambios de estilo: `node tests/ui/snapshot.mjs <carpeta>` antes y después, y comparar las capturas (24 pantallas en claro y oscuro).


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


## Mejoras del 25 de octubre de 2026

- **CSS ordenado.** `src/style.css` reescrito por componentes, cada propiedad en un solo lugar (sin capas de parches). `src/module-unified.css` sin las reglas muertas de las barras propias de cada app. Verificado con capturas antes/después: idénticas.
- **Pruebas visuales** en `tests/ui/` (ver Validación).
- **Diagnóstico oculto.** "Medidas de pantalla" aparece en Tu cuenta solo después de tocar 5 veces el título de la ventana.
- **Aviso al terminar el Pomodoro con la app cerrada.** Ya estaba: foco manda la hora de fin a `mobile` (`action: timer`), Supabase la guarda en `ecosystem_push_timers` y `pg_cron` envía el push cada minuto. Requiere iniciar sesión y activar las notificaciones en "Notificaciones y atajos".
- **Apps de fondo.** Las apps ocultas sin uso durante 10 minutos se descargan (`src/frame-pool.js`), salvo foco con un Pomodoro o domo con un temporizador de cocina. Se reabren con su pantalla; los datos están en el almacenamiento.
- **Buscador del ecosistema.** El buscador de nubo busca en numio, domo, lecta y foco a la vez (`src/search.js`), sin tildes ni mayúsculas, dentro de notas y subtareas, con filtros por app, y abre el registro en su app.

## Concentración renovada (25 de octubre de 2026)

- **Vista inmersiva** (`src/focus-stage.js`, solo en foco): el tiempo dentro de un anillo de progreso, botones redondos de vidrio (reiniciar, comenzar/pausar, ir al descanso) y las escenas como círculos de color. En horizontal se reacomoda en una fila.
- **Escenas nuevas** dibujadas en el canvas, sin imágenes: Espacio (nebulosas, estrellas, planeta y estrellas fugaces), Bosque (amanecer con rayos de luz, pinos en capas, niebla y luciérnagas), Océano (atardecer con reflejo y oleaje), Lluvia (luces de ciudad desenfocadas, lluvia y gotas en el vidrio) y Fogata (llamas, brasas y resplandor). "Pausar fondo" y el sonido siguen igual.
- **Pantalla de Concentración**: el reloj tiene un anillo que se completa con el bloque.
- **Teclado**: con el teclado abierto la app mantiene su alto completo; antes se achicaba y, cuando iOS desplazaba la pantalla hacia el campo, quedaba media pantalla en blanco.

## Digitalizar y ajustes (25 de octubre de 2026, noche)

- **Digitalizar** (botón de cámara junto al buscador de nubo; `src/scan.js`, `src/scan-parse.js`): sacás o elegís una foto y se lee en el teléfono con Tesseract (español, sin servidor ni costo). Tipos: pago de servicio → gasto o pago de servicio en numio (proveedor, importe, período y vencimiento sugeridos); contrato → domo › Vivienda (fechas, alquiler, depósito, día de pago y el texto completo); dibujo → lecta › Dibujos con el fondo del papel limpio; texto → nota en lecta. Siempre revisás antes de guardar. Los archivos del lector se sirven desde `/ocr` (se copian en el build desde `tesseract.js`, `tesseract.js-core` y `@tesseract.js-data/spa`) y se descargan una sola vez, la primera vez que se usa. La letra a mano se lee peor que el texto impreso.
- **Selector de apps**: la pastilla nace como un círculo sobre el botón Apps y se estira con un resorte (Web Animations, misma física que la isla; `reveal` en `src/mobile-nav.js`). Se abre a los 300 ms y el botón se achica apenas lo tocás. El botón se llama **Apps** (manual de identidad).
- **Configuración**: sin tamaño de letra; el nombre es opcional; sin selector de densidad (todas las apps quedan en compacta).
- **Campos**: sin resaltado al enfocarlos; los de texto largo arrancan en dos líneas y crecen al escribir.
- **foco**: tarjetas del inicio alineadas, botón de modo inmersivo centrado, estado vacío de Hábitos en tarjeta.
- **Difuminado de los avisos**: empieza debajo del encabezado (no toca el nombre de la app ni la flecha de volver).
- **Nombres**: sin "Centro", "Iris" ni otros nombres viejos visibles; el build falla si vuelven a aparecer. El build limpia `dist` antes de compilar.

### Sonido de concentración (`src/focus-sound.js`)
- Los cinco ambientes se sintetizan en el teléfono (Web Audio), sin grabaciones ni red, y pasan por la misma cadena: reverberación cálida, agudos suaves y compresor leve. Tienen el mismo volumen percibido en el parlante del iPhone (medido con un render sin conexión).
- **Espacio:** acorde abierto en Re que respira y una campana lejana de vez en cuando. **Bosque:** viento en las hojas y pájaros esporádicos a distintas distancias. **Océano:** olas que crecen y se retiran, alternando izquierda y derecha. **Lluvia:** lluvia pareja sin siseo, gotas cercanas y un fondo grave. **Fogata:** rumor cálido con chasquidos irregulares.
- Los eventos (pájaros, olas, chasquidos) se programan con unos segundos de anticipación y al azar, así no se nota un bucle. Un solo contexto de audio: cambiar de ambiente hace un fundido cruzado de 2,4 s, y pausar o reanudar baja y sube el volumen de forma suave.

### Logo, barra de estado y dictado
- **Logo de nubo:** símbolo oficial del manual (la "n"), vectorizado en `public/brand/nubo-light.svg` y `nubo-dark.svg`. Se usa en el encabezado de nubo, en el botón Apps y en el ícono de la pantalla de inicio (`icon.svg`, `nubo-192/512.png`).
- **Barra de estado:** siempre del color del tema de la app. iOS solo lee `theme-color` cuando la app vuelve a primer plano, así que cambiarlo en vivo dejaba la barra negra pegada; `holdStatusBar` quedó vacía a propósito.
- **Sin difuminado arriba:** el velo borroso que aparecía bajo el encabezado con cada aviso se sacó (`#islandVeil`).
- **Dictado:** al tocar un campo de texto (inputs de texto y búsqueda, textareas, editores) aparece un micrófono a la derecha. Usa el reconocimiento de voz del sistema (Web Speech API, `es-AR`), muestra lo que va oyendo y escribe el texto con mayúscula inicial y espacios. Si iOS no lo permite en la app instalada, avisa y queda el micrófono del teclado.

### Teclado, avisos, digitalizar por app, inicio al cambiar e IA
- **Teclado:** con el teclado abierto, las ventanas de cada app se ajustan al área visible (`--kb-top`/`--kb-visible`, que el shell calcula por iframe) y se desplazan por dentro hasta el campo enfocado (`revealFocused`). La página de atrás no se mueve: si iOS la desplaza para mostrar el campo, se vuelve a su lugar (shell y módulos).
- **Sin difuminados:** el aviso de la isla es opaco y los fondos detrás de las ventanas ya no usan blur. La franja de arriba en el modo inmersivo con tema claro es la barra de estado de iOS: no se puede cambiar de color con la app abierta.
- **Digitalizar desde cada app:** botón de cámara en el encabezado. numio: pagos de servicio. domo: boletas de servicio (se registran como pago en Servicios; si el servicio no existe se crea) y contratos. lecta: textos y dibujos. foco: listas de tareas (cada renglón, una tarea). nubo sigue ofreciendo todo.
- **Cambiar de app** (botón Apps o accesos de nubo) abre siempre el inicio de esa app.
- **IA:** función `api/ai.js` en Vercel con varios proveedores, en orden: **Groq** (gratis, console.groq.com), **Gemini** (plan gratuito de Google AI Studio), **Grok** (xAI) y **Claude**. Dentro de cada proveedor, si un modelo se queda sin cupo prueba el siguiente; si el proveedor entero falla pasa al próximo. Variables en Vercel → Settings → Environment Variables: `GROQ_API_KEY` y/o `GEMINI_API_KEY` (alcanza con una), `AI_ALLOWED_EMAILS` (recomendada: tu correo), opcionales `XAI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_PROVIDERS` (orden), `GROQ_MODEL`/`GEMINI_MODEL`/`XAI_MODEL`/`AI_MODEL` (listas separadas por comas). Una clave por proveedor: no se reparten pedidos entre varios proyectos para sumar cupo (las condiciones de Google no lo permiten). Solo responde a una cuenta de nubo con sesión iniciada.


### Escaneo como el iPhone, concentración, lecta con grafo e IA
- **Digitalizar:** cada foto pasa por un recorte: la app encuentra la hoja (`src/scan-crop.js`), podés mover las cuatro esquinas (con lupa), se endereza la perspectiva y elegís el aspecto (Documento, Color, Gris, Blanco y negro, Girar). La página recortada se guarda: dentro de la nota (textos) o como copia en lecta › Escaneos (boletas, contratos, listas). Las imágenes van a IndexedDB (`src/scan-store.js`, mucho más espacio que el almacenamiento de las apps) y la nota guarda `<img data-scan="…">`. Por ahora no viajan a la nube ni a la copia de seguridad: quedan en el teléfono.
- **Concentración:** Sonido, Volumen y Fondo son controles redondos con su nombre; el volumen se puede arrastrar (el bloqueo de desplazamiento ya no lo frena) y el sonido suena apenas lo activás, también en pausa.
- **nubo:** el botón Más pasó a ser Ajustes (Actividad ya tiene su pestaña).
- **Selector de apps:** pastilla clara en tema claro y grafito en oscuro; al soltar se recoge hacia el botón.
- **lecta** (`src/lecta-plus.js`, como en Personal OS): botones Nueva idea, Mapa desde un texto y Grafo de conocimiento en Inicio, Notas y Mapas. El grafo une notas, ideas, mapas, libros, películas, música y frases por vínculos a mano, etiquetas, menciones y temas en común; se mueve con el dedo y se acerca pellizcando. Cada nota muestra «Relacionado». En el editor, el botón IA resume, explica, corrige, reformula, traduce, saca ideas clave, convierte en tareas de foco o arma un mapa (sobre lo seleccionado o la nota entera).

### lecta como Personal OS: notas, enlaces, dibujo y grabaciones
- **Notas** (`src/lecta-notes.js`): lista con buscador, cuadernos (Todas, Favoritas, Ideas y cada cuaderno), orden y tarjetas con extracto, etiquetas, casillas hechas y miniatura de la foto. El editor suma subrayado, tachado, lista numerada, casillas (se tildan tocándolas), fotos (van al depósito de imágenes), contador de palabras y guardado automático (Guardar no duplica la nota).
- **Enlaces:** sección nueva (en Más y en el buscador de nubo) para guardar enlaces con título, etiquetas y nota; se filtran por etiqueta y se buscan. Botón Pegar. Un enlace que llega como `#/journal/links?guardar=…` se abre listo para guardar.
- **Dibujo** (`src/lecta-draw.js`): lápiz, marcador, borrador, línea, flecha, rectángulo, óvalo, texto y mover; colores, grosor, deshacer/rehacer, fondo blanco, cuadriculado, punteado o una foto. Mantener el dedo quieto al terminar un trazo lo convierte en línea, rectángulo u óvalo. Se guardan las formas para seguir editando.
- **Grabaciones** (`src/lecta-audio.js`): hasta 60 minutos, con pausa, contador y nivel; el audio va al depósito del teléfono (IndexedDB), no al almacenamiento de la app.
- **Teclado:** la ventana sigue al cursor mientras escribís (antes, en notas largas quedaba debajo del borde).
- **Arriba:** en la app instalada todo empieza 14 px más abajo, así el difuminado de iOS no toca el nombre, el logo ni los botones.

### Recomendaciones con ficha, voz a texto, grafo y escaneo más preciso
- **Recomendaciones:** en Películas y Música, lo que sugiere la IA entra al catálogo de descubrir (chip «✨ Para vos» y «Sorprendeme») con portada y enlace del catálogo de Apple, sinopsis sin spoilers, género real, tráiler y los botones de siempre (Quiero ver, Ya la vi, A una lista, No recomendar más). Se guardan en `S.prefs.aiDiscovery`. Libros sigue con lista. La tarjeta tiene botón para cerrar y los pedidos a la IA se cortan a los 60 s.
- **Grabaciones → texto:** se graban en partes de ~3,5 MB (el reproductor las encadena) y cada parte se pasa a texto en `/api/ai` (`Content-Type: audio/*`) con Whisper de Groq (`whisper-large-v3-turbo`, respaldo Gemini). Después: «Convertir en nota» (cuaderno Grabaciones) o «Sacar tareas» (a foco). Opción «Pasar a texto al guardar».
- **Grafo:** se dibuja con el tamaño real y se vuelve a centrar si cambia; un dedo desplaza la página y dos dedos mueven y acercan el grafo.
- **Escaneo:** además de la región clara, busca los cuatro lados rectos de la hoja (gradientes + líneas de Hough), afina cada lado con los puntos de borde y elige el cuadrilátero que mejor calza; funciona con hoja clara sobre mesa clara y con renglones impresos adentro.

### Editor de notas de Personal OS, escaneo como Notas del iPhone y fichas de películas (26 de octubre de 2026)
- **Editor de notas** (`src/lecta-editor.js`): pantalla completa con botones redondos arriba (volver, deshacer, rehacer, leer y «…»), la fecha, un título grande y opcional (si lo dejás vacío se usa la primera línea) y el texto. Abajo, una cápsula flotante con el selector de estilo («Cuerpo»: título, subtítulo, cita, listas, casillas, monoespaciado, subrayado, tachado), negrita y cursiva, foto, dibujo (se pinta encima de la nota y queda como imagen) y dictado (grabás, «✓» y la IA escribe el texto donde estaba el cursor), más el botón blanco de IA con sus acciones. En «…» quedan cuaderno, fecha, etiquetas, favorita, relaciones y la papelera. Sigue guardando solo.
- **Escanear como Notas:** la cámara se abre en vivo y marca la hoja en azul mientras apuntás; en **Automático** saca la foto sola cuando el teléfono queda quieto, en **Manual** con el botón (si no encuentra la hoja te deja mover las esquinas). Filtros Documento, Color, Gris, Blanco y negro y Foto. Las páginas se apilan en la esquina con su número: tocándolas corregís el recorte, el aspecto o el giro de cualquiera, o la borrás; «Guardar (n)» las lee y guarda. También se pueden traer de Fotos. Si la cámara no está disponible vuelve al botón de sacar foto. `vercel.json` ahora permite la cámara en la propia app (`camera=(self)`).
- **Recomendaciones con IA:** una barra chica («Pedile a la IA…») en Libros, Películas y Música. Sinopsis más completas y siempre en español. Las películas toman portada y sinopsis oficial de `/api/movie`; los libros vuelven como tapas (Open Library) que abren su ficha con «Quiero leer».
- **Ficha de película:** «Resumen sin spoilers» (IA: planteo, temas y tono, a quién le puede gustar), **Dónde verla en Argentina** (incluida en, gratis, alquiler, compra) con enlace a JustWatch, duración, y «Quiero ver» guarda y cierra la ficha.
- **`/api/movie`** (Vercel): con `TMDB_API_KEY` (gratis en themoviedb.org → Configuración → API; sirve la clave v3 o el token de lectura) trae de TMDB la portada, la sinopsis en español y las plataformas de Argentina (datos de JustWatch). Sin esa clave, la portada sale del catálogo de Apple o de Wikipedia, la sinopsis de Wikipedia en español, y en lugar de plataformas aparece «Buscar en JustWatch».


### Contraseñas, Documentos, temporizadores y widgets reales (26 de octubre de 2026, tarde)
- **Contraseñas** (`src/vault.js`, en nubo › Ajustes y en Accesos rápidos): como la bóveda de Personal OS. Se guardan solo en este teléfono (IndexedDB `nubo-vault`), cifradas con AES-GCM 256 y una clave derivada de tu contraseña maestra (PBKDF2-SHA256, 310 000 vueltas). La maestra no se guarda ni se envía a ningún lado. Face ID opcional (passkey con PRF, iOS 18 o superior), generador, medidor de fuerza, categorías, favoritas, búsqueda, cambio de maestra y copia cifrada para exportar e importar. Se bloquea sola a los 5 minutos sin uso o tras 1 minuto en segundo plano. No se sincroniza con Supabase a propósito.
- **Documentos** (lecta › Más › Documentos): nuevo tipo de escaneo «Documento» desde cualquier app. Guarda todas las páginas tal cual (con el filtro Documento), con nombre, etiquetas y, si querés, el texto leído para buscarlo. Se ven, se comparten y se borran.
- **Temporizadores de cocina** (domo › Cocina): varios a la vez con nombre, atajos de 1 a 60 minutos o minutos y segundos a mano, pausa, +1 minuto y cancelar; al terminar suenan y vibran hasta que los apagás. La isla muestra el más próximo con Cancelar o Apagar.
- **Concentración:** «Terminar sesión» en la pantalla inmersiva y «Terminar» en la isla cuando está en pausa.
- **Widgets de nubo** (`src/widgets.js`): ahora leen los datos reales de cada app: tareas de hoy, agenda, hábitos, concentración, gastos del mes, servicios por pagar, cocina, última nota y películas para ver, más accesos rápidos. Chicos o anchos, se reordenan arrastrando en modo Editar y se agregan desde una galería. El resumen del día también usa los datos de foco.
- **Íconos de las apps:** van dentro del código (data URI) y además quedan en la caché, así no fallan con mala conexión.
- **Notas:** al tocar una nota vacía con el teclado abierto, el cursor ya no se pierde. Las fotos y los dibujos dentro de las notas ya no se borran al guardar.
- **Dónde verla:** logos de las plataformas como íconos de app, con «Ver todas las opciones».
- **IA:** Groq pide JSON y menos razonamiento con gpt-oss (el resumen sin spoilers ya no queda cortado); el modelo retirado `llama-3.3-70b-versatile` se cambió por `llama-3.1-8b-instant`.


### numio como Iris, libros gratis, inglés con IA y avisos (26 de octubre de 2026, noche)
- **numio › Balance** (`src/numio-plus.js`): cuánto te queda para gastar este mes y por día (ingresos o su promedio − lo gastado − lo que falta pagar: cuotas o resumen de tarjeta, servicios, suscripciones − tu ahorro objetivo). Categorías contra tu promedio de 3 meses (en rojo donde te pasás), reparto 50/30/20, recomendaciones y «Consejos de la IA».
- **¿Puedo hacer este gasto?:** importe, en qué y cómo (efectivo/débito o tarjeta en cuotas). Responde «Sí, podés», «Con cuidado» o «No conviene», con la cuenta; con tarjeta calcula desde qué mes caen las cuotas. Segunda opinión de la IA opcional.
- **Suscripciones** (en Más): Netflix, Spotify, YouTube, Disney+, Prime, Max, ChatGPT… mensuales o anuales, en pesos o dólares, con la tarjeta con que se pagan. Total por mes y por año, próxima renovación y «Registrar cobro» (crea la compra con tarjeta o el gasto).
- **Resúmenes de tarjeta:** en Tarjetas › Importar resumen subís el PDF (o una foto). Se lee el texto (PDF.js en el teléfono; OCR si es foto), la IA saca cierre, vencimiento, total, mínimo y consumos. Podés actualizar los días de la tarjeta y sumar los consumos que falten. Leer los resúmenes del correo de forma automática necesitaría conectar Gmail, que no está.
- **Avisos** (`supabase/functions/mobile`, hay que publicarla en Supabase): con el estilo de Recordatorios de Apple (el título es la cosa; abajo, cuándo y cuánto): cierre de tarjeta el día anterior, vencimiento 2 días antes y el mismo día (con total y mínimo si importaste el resumen), renovaciones de suscripciones, servicios, eventos 30 minutos antes y tareas con recordatorio. El teléfono vuelve a registrar su suscripción de avisos cada vez que abrís la app, así no se desactivan solas.
- **Menos avisos en pantalla:** confirmaciones como «Guardado» ya no aparecen; solo problemas, temporizadores, recordatorios y deshacer.
- **lecta › Libros:** «Leyendo ahora» con página y porcentaje, y «Actualizar avance» (+5, +10, +25, +50 páginas o «Lo terminé»). **Leer gratis:** clásicos de dominio público de Project Gutenberg (`api/book.js`), en español o inglés, que se leen dentro de la app con letra ajustable, sin conexión una vez abiertos, guardando por dónde vas; también se pueden abrir en Apple Books (EPUB).
- **Inglés** (`src/lecta-english.js`): lecciones nuevas con IA para tu nivel sobre el tema que quieras (se abren en el mismo reproductor de lecciones), **Conversar** con un tutor (por voz o texto, con corrección suave y traducción) y «Corregir con IA» en el diario en inglés, que suma las palabras nuevas a tu repaso.
- **Grafo:** las etiquetas, géneros y autores compartidos son nodos grises que agrupan, en lugar de una maraña de líneas; al tocar algo se ve con qué se conecta y por qué («mismo género: Ciencia ficción», «de Denis Villeneuve», «hablan de…»), también escrito sobre las líneas.
- **Películas:** tráileres primero en español latino (TMDB para México/Argentina y búsquedas «doblaje latino»; los de España quedan después). Las portadas salen de TMDB siempre que esté (arregla, por ejemplo, la de «Ratatouille», que traía la foto del plato) y se buscan también en Para ver, el diario y las listas. Cuando se terminan las recomendaciones de un género, la IA trae más de ese género.
- **Archivos:** los íconos de las apps viven en `src/brand-icons.json` (el build los escribe en `/brand/`), para seguir debajo del límite de 90 archivos de GitHub.


### Cierres de tarjeta en el Calendario (27 de octubre de 2026)
- **Cierres al Calendario** (numio › Tarjetas): un archivo de calendario con cada cierre y vencimiento de tus tarjetas y cada renovación de suscripción, que se repiten todos los meses (o años) con alarmas: el día anterior al cierre, 2 días antes y el mismo día del vencimiento. Los avisos los da el Calendario del iPhone, sin depender de nubo.

---

## Anexo: auditoría de layout

Auditoría de barras — 25 octubre 2026

Problemas confirmados en código:
- Reglas acumuladas mezclaban fixed, absolute, top calculado y bottom.
- El margen inferior sumaba 30px a hasta 34px de safe area.
- Se extendía la altura visible usando 100vh, aunque la prueba M3 mostró recorte.
- Los iframes reservaban espacio para una navegación que ya vive fuera de ellos.

Cambio: un único grid raíz con filas para inset superior, contenido y navegación. La navegación ocupa espacio real; ya no se superpone al contenido. El margen inferior es max(8px, despeje pendiente), no una suma. No se usa screen.height ni 100vh para ampliar el área dibujable.

Referencias primarias:
- https://webkit.org/blog/7929/designing-websites-for-iphone-x/
- https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html
- https://www2.webkit.org/show_bug.cgi?id=300445

Limitación pendiente: el color y la geometría de la barra de estado de una PWA instalada dependen de WebKit y de los metadatos guardados al instalar. No se puede certificar el resultado físico desde un navegador de escritorio. El reporte de WebKit describe regresiones edge-to-edge; estas no se resuelven agregando píxeles fuera del viewport.

## Barra inferior demasiado alta en la PWA instalada (25 octubre 2026)

Medición en iPhone 402×874 pt: el viewport en standalone mide 812 pt. iOS pinta los 62 pt restantes debajo de la página (WebKit bug 301994) y ningún elemento del DOM puede llegar ahí. Esa franja ya despeja el indicador de inicio, pero la barra le sumaba otros 34 pt de safe area y un mínimo de 30 px: los iconos quedaban unos 96 pt por encima del borde.

Cambio: `bottomClearance()` en `src/viewport.js` resta esa franja del inset inferior. Si iOS vuelve a dar el viewport completo (874 pt), la franja es 0 y la barra recupera sus 34 pt normales sin tocar nada. El mínimo bajó de 30 px a 8 px para no dejar aire de más en Android o escritorio.

Referencia: https://bugs.webkit.org/show_bug.cgi?id=301994

## Barra de estado opaca (versión 3)

Medición real en el iPhone (panel de diagnóstico): pantalla 402×874, innerHeight y visible 812, safe area ↑62 ↓34. Con `black-translucent` la vista empieza en 0 y termina en 812; los 62 pt de abajo los pinta iOS y ningún elemento llega ahí.

Cambio: `apple-mobile-web-app-status-bar-style` pasa a `default`. La vista debería empezar debajo de la barra de estado y llegar al borde inferior, con la barra de navegación pegada abajo y sus 34 pt de despeje. `bottomClearance()` solo descuenta la franja cuando la safe area superior es mayor a 0 (contenido detrás de la barra de estado). El color de la barra de estado sigue a `theme-color`, que ya se sincroniza con el color del encabezado.

Requiere borrar la app del inicio y volver a agregarla: iOS guarda este metadato al instalar.

## Versión 5 — selector, zoom y ventanas

- Selector de apps: pastilla compacta oscura con íconos circulares (referencia: selector de cuentas de Instagram). Se elige deslizando en horizontal; soltar sin mover no cambia de app. El ícono elegido se agranda y su nombre aparece arriba; un punto marca la app actual.
- Zoom: `maximum-scale=1,user-scalable=no` en el viewport, `touch-action:pan-x pan-y` en cada documento, gestos de pellizco bloqueados en `src/touch-guard.js`, y campos a 16px para que iOS no haga zoom al enfocar el buscador.
- Ventanas: con un `dialog` abierto (o el Pomodoro en pantalla completa) solo scrollea la ventana; `src/touch-guard.js` frena el arrastre sobre el fondo, tanto en el shell como en cada app.

## Versión 6 — isla de actividad

- `src/island.js` reescrito: la actividad en curso (Pomodoro, cocina) es una pastilla compacta; se expande al tocarla o tirarla hacia abajo y vuelve sola a los 6 s. Los avisos entran como tarjeta; si hay una actividad en curso esperan en una burbuja al costado (con contador) en vez de taparla. La burbuja intercambia lo que está adelante. `urgent:true` pasa adelante igual.
- Movimiento en `src/motion.js`: tiempos y resortes portados de expo-dynamic-notifications (MIT) como curvas `linear()`; gota → pastilla → tarjeta, contenido que aparece desde el desenfoque, salida inversa. Arrastre que sigue al dedo; se cierra por distancia (36 px) o velocidad (420 px/s) y si no, vuelve con resorte.
- De SmartIsland (GPLv3) se tomaron solo ideas (prioridad de lo que está en curso, burbuja secundaria, compacta/expandida); no se copió código.

## Versión 7 — correcciones de la isla y la barra

- La isla parpadeaba cada segundo: el Pomodoro manda su tiempo cada segundo y la isla lo tomaba como una actividad nueva. Ahora la actividad se identifica por su `id`; el texto se actualiza sin animación.
- Pastilla compacta: solo ícono y tiempo, para no tapar el título del encabezado.
- Con la burbuja al lado, la tarjeta se achica para que la burbuja no quede fuera de pantalla.
- Barra inferior: con la barra de estado opaca, iOS informa 0 de safe area abajo aunque el iPhone tenga indicador de inicio. En iPhone con Face ID instalado como app se usa 34 pt (21 en horizontal) como mínimo, salvo que la franja del sistema ya lo despeje.

## Versión 8 — ajustes de la isla

- Íconos dibujados en SVG (el glifo de texto ◷ quedaba descentrado).
- Expandir/colapsar sin rebote ni fase más grande (resorte sin sobrepaso, 480 ms); se libera el `max-width` durante la animación y el texto se actualiza antes de medir, así el tamaño baja parejo sin saltos.
- El tiempo lo calcula la isla a partir de la hora de fin (`due`) que mandan foco y el temporizador de cocina: sigue corriendo aunque iOS congele la app que quedó oculta.
- Cerrar o subir una actividad en curso ya no la pierde: queda minimizada en un círculo; tocarla o tirarla hacia abajo la trae de vuelta. Mientras está minimizada los avisos pasan adelante.

## Versión 9 — avisos chicos y gota líquida

- Bug: los avisos no se iban solos. Foco informa su estado cada segundo y cada informe reiniciaba la cuenta regresiva del aviso. Ahora la cuenta pertenece a un aviso y solo se reinicia si cambia el aviso.
- Bug: al cerrar, el aviso se cerraba, se abría y se cerraba. El mismo informe por segundo volvía a lanzar la salida a mitad de camino. Ahora la salida no se repite si ya está en curso.
- Aviso de guardado/sincronizado más chico (340 × 54 px), claro en tema claro y gris en oscuro, una línea de texto.
- Gota líquida (`src/goo.js`, filtro SVG): sale negra del borde superior con cuello, se suelta, cae tiñéndose del color de la tarjeta y se estira en ella; al cerrar hace el camino inverso. Con la barra de estado opaca sale del borde de la página; si la página corre bajo la barra de estado, sale del borde de la isla real.

## Versión 10 — cerrar el contador y difuminado

- Al terminar un bloque, foco vuelve a arrancar el contador y la × solo lo minimizaba: no se podía sacar. Ahora la × lo cierra del todo (aunque esté corriendo) y vuelve solo en cuanto cambia su estado (pausa, reanudar, sesión nueva). Deslizar hacia arriba minimiza si está corriendo y cierra si está en pausa.
- Se quitó el desenfoque animado del texto (en iPhone podía quedar trabado, con el título borroso). El texto aparece con opacidad y escala.
- Como en la referencia: tarjeta de aviso tipo vidrio esmerilado y un difuminado suave sobre la parte de arriba de la app mientras se ve un aviso (`#islandVeil`). Se desactiva con "Reducir transparencia".

## Versión 11 — la gota pegada a la isla (prueba)

- Con la barra de estado opaca la página empieza debajo de ella (62 pt) y la isla real termina en ~48 pt: la gota aparecía separada, "de la nada". La franja intermedia la pinta iOS.
- Prueba: mientras la gota cae o sube, `theme-color` pasa a negro (#050505) para que la franja de la barra de estado y la isla se vean como una sola forma de la que gotea; al terminar vuelve al color del tema (si el tema cambió en el medio, al nuevo). Solo con barra opaca.
- Depende de que iOS aplique el cambio de `theme-color` al instante en la app instalada; si no lo hace, alternativas: volver a `black-translucent` (gota desde la isla real, pero franja de 62 pt abajo) o reemplazar la gota por un deslizamiento.


## Vaquitas (28 de octubre de 2026)

numio › Más › Vaquitas divide gastos con amigos. Una **juntada** es una sola cuenta. Un **viaje** tiene varias vaquitas adentro (nafta, hospedaje, asado), cada una con su gente, más los gastos sueltos entre todos. Cada gasto guarda quién pagó y cómo se divide: partes iguales, montos exactos, por partes o por porcentaje. numio calcula quién le transfiere a quién con pocas transferencias (nunca más de una por persona menos una). Las cuentas se hacen en centavos, y "Pagado" las descuenta. Al cargar un gasto podés sumar tu parte a tus gastos de numio (método "Vaquita"), así el Balance cuenta solo lo que te toca a vos.

- **Sin sesión:** las vaquitas quedan en el teléfono, dentro de los datos de numio.
- **Con sesión:** se guardan en Supabase, en las tablas `vq_*` de `supabase/migrations/20261028190000_vaquitas.sql`. Hay que correr ese archivo una vez en Supabase › SQL Editor. Ven la vaquita quien la armó y los que se sumaron con su cuenta. Cargan gastos quien la armó y, si se activa, los que se sumaron con el link.
- **Link** `/v/<token>`: muestra la vaquita sin cuenta y solo para ver (función `vq_shared`). En numio › Vaquitas › Unirme se pega el link y se elige quién sos (función `vq_join`). Nadie puede tomar el lugar de alguien que ya tiene cuenta vinculada.
- **Archivos:** la lógica está en `src/vaquitas-core.js` (pruebas en `tests/vaquitas.test.mjs`), la pantalla en `src/numio-vaquitas.js` y la página del link en `src/vaquita-public.js`.

### Amigos, recordatorios y comprobantes (28/10, noche)

- **Amigos por @usuario** (numio › Vaquitas › Amigos, con sesión iniciada): elegís tu @usuario y tu alias, buscás a otros por su @usuario exacto y les mandás una solicitud. Cuando aceptan, aparecen al armar una vaquita y entran directo. Solo podés sumar con su cuenta a tus amigos: lo controla Supabase, no la app.
- **Recordar un pago:** en "Quién le paga a quién", cuando alguien te debe, el botón Recordar abre WhatsApp con el monto y tu alias. Si esa persona tiene cuenta, además le aparece un aviso en su numio.
- **Comprobantes de Mercado Pago:** en Registrar un gasto y en el gasto de una vaquita podés elegir una captura o pegar la imagen copiada (Compartir comprobante → Copiar). Se lee en el teléfono y completa el monto, a quién, la fecha, el medio y el número de operación. Si era plata que recibiste, pasa a Ingreso. Dentro de una vaquita, el mismo comprobante no se puede cargar dos veces.
- Las tablas nuevas (`vq_profiles`, `vq_friends`, `vq_reminders`) están en el mismo `supabase/migrations/20261028190000_vaquitas.sql`. Hay que correrlo de nuevo; se puede correr las veces que haga falta.
