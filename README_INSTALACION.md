# Recuerdos 1996 — Diario vintage para iPhone

**Versión PWA lista para publicar. Sin Mac, sin Xcode, sin cable USB, sin Sideloadly y sin pagos.**

## Qué lleva

- Calendario por meses con indicadores de páginas escritas y favoritas.
- Editor de texto en papel rayado, ampliable según el contenido y con guardado automático.
- Fotografías ilimitadas dentro del espacio disponible: seleccionar varias, arrastrarlas con el dedo, cambiar su tamaño, rotarlas, ponerlas al frente o eliminarlas. Se colocan libremente encima de la hoja.
- Dado «Sorpréndeme»: abre una página escrita elegida al azar.
- Lista de favoritos y buscador por texto.
- Modo día y noche.
- Uso sin conexión después de abrirla con internet una primera vez.
- **Copias de seguridad JSON** de todas las páginas y fotos, y restauración completa.
- Datos almacenados localmente mediante IndexedDB. No se envían textos o fotos al alojamiento web.

## Publicarla gratis desde Windows (método sencillo)

1. Descomprime `Recuerdos1996_PWA.zip` en Windows.
2. Abre **https://app.netlify.com/drop** e inicia sesión o crea una cuenta gratuita si te la pide.
3. Arrastra la **carpeta `Recuerdos1996_PWA` completa** a la zona de despliegue de Netlify Drop (o selecciona la carpeta según la interfaz).
4. Netlify generará una dirección HTTPS terminada en `.netlify.app`. Guárdala, porque es la dirección de tu app.

No subas el ZIP sin descomprimir ni el directorio que lo contiene: el archivo `index.html` debe quedar en la raíz publicada.

## Instalarla en iPhone

1. En tu iPhone, abre **Safari**.
2. Visita la dirección `https://....netlify.app` que te proporcionó Netlify.
3. Pulsa el botón **Compartir** de Safari.
4. Selecciona **Añadir a pantalla de inicio** (si no aparece, busca en las opciones de compartir).
5. Activa **Abrir como app web** cuando esté disponible y pulsa **Añadir**.
6. Abre el nuevo icono **Recuerdos '96** que aparece en la pantalla de inicio.

Si en un primer momento no carga sin internet, ábrela conectada durante unos instantes para guardar los recursos sin conexión. Luego podrás utilizarla offline.

## Cómo colocar fotografías

En cualquier día, pulsa **Añadir fotos**, selecciona una o varias fotos y acepta. Las imágenes aparecen como pequeñas polaroids encima de la hoja. Arrastra una foto con el dedo para moverla. Al tocarla, verás herramientas: − más pequeña, + más grande, ↻ girar, ⇧ al frente, × borrar. También puedes arrastrar la esquinita ↘ para cambiar su tamaño. El texto puede quedar visualmente detrás de las fotografías; el editor y las fotografías son capas superpuestas.

## Copias de seguridad: importantísimo

- Pulsa **Copia** y guarda el archivo `Recuerdos1996_Copia_FECHA.json` en **Archivos**, iCloud Drive o en otro lugar seguro.
- Para recuperarlo pulsa **Restaurar** y selecciona el JSON. **La restauración sustituye el diario actual** tras una confirmación.
- Haz una copia cada cierto tiempo, sobre todo antes de cambiar de teléfono, borrar Safari o eliminar la app.
- La cantidad de imágenes depende del almacenamiento disponible. iOS puede borrar datos de sitios/aplicaciones web al liberar espacio; por eso la copia es fundamental.
- No guardes información realmente importante en una única copia local.

## Privacidad

El alojamiento web recibe los archivos públicos del programa, **no las páginas que escribes ni las fotos que agregas**. Los textos y fotografías se guardan en el dispositivo y no se sincronizan entre iPhone y PC. Para mover tu diario de un aparato a otro usa **Copia → Restaurar**. Si usas un dispositivo compartido, otra persona con acceso a él podría abrir la app.

## Actualizarla

Para publicar una nueva versión, vuelve a arrastrar la carpeta actualizada en la sección de despliegues del mismo sitio de Netlify. No crees otra dirección, o tus datos locales quedarán asociados al sitio anterior. Las actualizaciones del programa se descargan al estar conectado.

## Información técnica

- PWA autocontenida: HTML, CSS, JS, iconos, manifiesto y Service Worker. Sin dependencias externas.
- Almacenamiento IndexedDB con almacenes `entries` y `photos`.
- La función de exportación recopila todos los datos y puede crear archivos grandes si hay muchas fotografías.
- Requiere HTTPS para el Service Worker y la instalación PWA; la opción Netlify Drop cumple este requisito.
- Pruebas previas a distribuir: comprobar la interfaz, edición, guardado, fotografías, copia y restauración.
