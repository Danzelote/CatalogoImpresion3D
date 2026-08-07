# Catálogo 3D

Catálogo de productos que se edita 100% desde Google Sheets y se publica
como página estática en GitHub Pages. Incluye carrito con opciones de
color, categorías y subcategorías automáticas, carrusel de novedades,
consulta de status de pedido, botón flotante de WhatsApp, y botón de
pedido que arma un mensaje de WhatsApp con número de orden.

## Cómo está armado

```
Google Sheet (Productos + Colores + Pedidos)
        │
        │  lectura (CSV público)          escritura (Apps Script)
        ▼                                        ▲
   index.html / script.js  ──────── al ordenar ───┘
        │
        ▼
   wa.me (WhatsApp con el pedido ya redactado)
```

- **Leer productos y colores**: la página pide el Sheet como CSV directamente, sin backend. Se actualiza solo al editar el Sheet, sin publicar nada.
- **Registrar pedidos**: un pequeño script (Google Apps Script) genera el número de orden consecutivo y lo guarda en la pestaña "Pedidos". Es la única parte que necesita "escribir" datos.
- **Fotos**: se leen desde Google Drive (links de "Compartir" normales, la web los convierte al formato correcto sola).

## Paso 1 — Crear el Google Sheet

Crea un Sheet nuevo con **tres pestañas**: Productos, Colores y Pedidos.

### Pestaña "Productos"

| Nombre | SKU | Foto1 | Foto2 | Foto3 | Descripcion | Precio | Categorias | Activo | Novedades | Opciones de color | Piezas por pedido |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dragón articulado | *(se genera solo)* | (link de Drive) | | | Dragón articulado, 25cm | 350 | Figuras > Fantasía | si | si | si | 1 |

- **SKU**: déjalo vacío al agregar un producto nuevo. En cuanto escribas el Nombre, se genera solo (ver paso 2). Si tienes productos viejos sin SKU, corre **Catálogo 3D > Generar SKUs faltantes** una vez para rellenarlos todos.
- **Foto1/2/3**: pega el link de "Compartir" de Google Drive de cada foto (ver paso 4). Todas se muestran del mismo tamaño sin importar sus dimensiones originales.
- **Precio**: si lo dejas vacío, el producto **no aparece** en la página (evita que se vea con precio $0 por accidente).
- **Categorias**: una o varias separadas por coma. Para subcategorías, usa `>`, ej. `Juegos de mesa > Accesorios, Hogar`. Las categorías y subcategorías nuevas aparecen solas en la web, no hay que tocar código.
- **Activo**: escribe `si` para que el producto se muestre. Si lo dejas **vacío o con cualquier otra cosa, no aparece en la página** — es la forma de tenerlo guardado sin publicarlo todavía.
- **Novedades**: pon `si` para que aparezca en el carrusel de "Novedades" hasta arriba. Columna opcional.
- **Opciones de color**: pon `si` para que ese producto muestre un selector de color (tomado de la pestaña Colores) antes del botón de agregar. Si lo dejas vacío, el producto no pide color.
- **Piezas por pedido**: opcional, texto libre (ej. "5 piezas", "Par", "1 pieza"). Se muestra en la tarjeta como "Piezas por pedido: X" — para que quede claro cuántas piezas trae el precio, sin que se confunda con la cantidad que el cliente elige en el carrito.

### Pestaña "Colores"

| Color | Disponible |
|---|---|
| Rojo | si |
| Azul cielo | no |

- **Disponible**: solo los que digan `si` aparecen como opción seleccionable en los productos con "Opciones de color" activado. Vacío o `no` = no aparece en ningún lado (no hace falta borrar la fila, solo déjalo así mientras no tengas ese color).
- Esta pestaña ya no tiene una galería aparte en la página — ahora los colores se eligen directo en cada producto que los requiera.

### Pestaña "Pedidos"

No la llenes a mano. Para verla lista desde ya, corre **Catálogo 3D > Preparar hoja de Pedidos** en el menú del Sheet (aparece después del paso 2). Si no la preparas manualmente, se crea sola en cuanto llega el primer pedido real. Sus columnas son:

| Número de orden | Fecha | Productos | Total | Status |
|---|---|---|---|---|
| 000001 | 03/08/2026 10:15 | Torre de dados - Color: Rojo (SKU: P-4K9QZ) x1 | $350 | Pendiente |

No necesitas tocar las primeras 4 columnas — el Apps Script del paso 2 las escribe solo cada vez que alguien da clic en "Ordenar por WhatsApp", siempre con Status inicial **Pendiente**.

**Sí tienes que actualizar tú la columna Status** conforme avanza cada pedido, para que el cliente pueda consultarlo desde la web (sección "Consultar mi pedido"). Sugeridos: `Pendiente`, `En proceso`, `Listo`, `Entregado`, `Cancelado` (tienen colorcito especial en la web). Cualquier otra palabra también funciona, solo se muestra en gris neutro.

### Hazlo visible

**Compartir** (arriba a la derecha) → **Cualquier usuario con el enlace** → **Lector**. No necesitas "Publicar en la web", solo que sea visible por link.

## Paso 2 — Conectar Apps Script (genera SKUs y números de orden)

1. En el Sheet: **Extensiones > Apps Script**.
2. Borra el contenido de `Código.gs` y pega el contenido de [`apps-script/Codigo.gs`](apps-script/Codigo.gs) de este proyecto.
3. Guarda (ícono de disco).
4. **Implementar > Nueva implementación**:
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Autoriza los permisos cuando te los pida (es tu propio script, es seguro).
6. Copia la **URL de la aplicación web** que te da — la vas a pegar en `script.js`.
7. Recarga el Sheet. Ahora verás un menú **Catálogo 3D** arriba, y desde ese momento el SKU se genera solo cada vez que escribes un Nombre nuevo en Productos.

## Paso 3 — Configurar la web

Abre `script.js` y edita el bloque `CONFIG` al inicio:

```js
const CONFIG = {
  SHEET_ID: 'pega-aquí-el-id-del-sheet',
  SHEET_PRODUCTOS: 'Productos',
  SHEET_COLORES: 'Colores',
  APPS_SCRIPT_URL: 'pega-aquí-la-url-del-paso-2',
  WHATSAPP_NUMBER: '5215512345678',
  WHATSAPP_MENSAJE_CONTACTO: '¡Hola! Vi tu catálogo de impresiones 3D y tengo unas dudas.',
  MONEDA: 'MXN',
  LOGO_URL: '',
  BANNER_URL: '',
  DESCRIPCION_SITIO: 'Piezas impresas en 3D, listas para recoger — no vendemos archivos STL.',
  MENSAJE_MATERIAL: 'Todas las piezas se imprimen en PLA. ¿Necesitas otro material? Se cotiza aparte por WhatsApp.',
  MENSAJE_ENVIO: 'Por ahora no hacemos envíos a domicilio: coordinamos un punto de recolección en CDMX.',
};
```

- **SHEET_ID**: la parte de la URL del Sheet entre `/d/` y `/edit`.
- **WHATSAPP_MENSAJE_CONTACTO**: el mensaje que se manda al dar clic en el botón flotante de WhatsApp (dudas generales — los pedidos usan su propio mensaje con número de orden, ese no se toca aquí).
- **LOGO_URL**: pega ahí el link de Drive de tu logo cuando lo tengas listo (mismo formato que las fotos de producto). Mientras esté vacío, el encabezado solo muestra el texto "Catálogo 3D".
- **BANNER_URL**: link de Drive de una imagen horizontal para mostrar arriba de la página. Mientras esté vacío, se sigue viendo el texto de `DESCRIPCION_SITIO` / `MENSAJE_MATERIAL` / `MENSAJE_ENVIO`. En cuanto le pongas una URL, esos textos se ocultan y se muestra la imagen en su lugar (es una cosa o la otra, no las dos a la vez).
- **DESCRIPCION_SITIO / MENSAJE_MATERIAL / MENSAJE_ENVIO**: los textos que aparecen arriba de la página mientras no tengas `BANNER_URL` puesto. Edítalos las veces que quieras, es texto plano.

## Paso 4 — Fotos de los productos (Google Drive)

1. Comparte la carpeta principal donde tienes todo (ej. `CatalogoImpresiones3D`) como pública: clic derecho → **Compartir** → cambia el acceso general a **"Cualquier usuario con el enlace"**, rol **Lector**. Esto aplica automáticamente a todo lo que tengas adentro — no hace falta repetirlo por cada archivo.
2. Para cada foto: clic derecho sobre el archivo en Drive → **Compartir** → **Copiar enlace**.
3. Pega ese link completo (el largo, con `https://drive.google.com/file/d/...`) en las columnas Foto1/Foto2/Foto3 del Sheet, o en `LOGO_URL` para el logo. La web reconoce automáticamente que es un link de Drive y lo convierte al formato que sí puede mostrarse en una página web.

**Ojo con los "chips inteligentes":** si arrastras el archivo directo desde Drive a la celda, o Sheets te lo convierte automáticamente en una tarjetita con icono de archivo (en vez de texto normal), esa celda **no sirve** — Sheets no exporta el link real de esos chips, solo el nombre del archivo, y la foto no va a cargar. Para evitarlo, pega el link con **Ctrl+Shift+V** (pegar sin formato) en vez de Ctrl+V normal, y confirma que la celda se vea como texto plano de una URL larga, sin ningún ícono al inicio.

Las imágenes ya solo se leen desde Drive o desde una URL externa completa — ya no hay carpeta local de fotos en el repo.

## Nombre de la tienda, ícono y vista previa al compartir

- **Nombre visible en el encabezado**: se controla con `CONFIG.NOMBRE_TIENDA` en `script.js`.
- **Título de la pestaña del navegador y vista previa al compartir el link** (WhatsApp, Facebook, etc.): estos **no** se pueden controlar desde `script.js` — los lee un "robot" que no ejecuta JavaScript, así que viven directo en `index.html` como texto fijo (`<title>` y las etiquetas `og:`). Si cambias el nombre de la tienda, actualízalo en los **dos** lugares.
- **Ícono (favicon) y logo al compartir**: en `index.html`, cerca del inicio, hay 3 líneas con `TU_LOGO_URL_AQUI` que hay que reemplazar una sola vez:
  1. Publica el sitio con tu `LOGO_URL` ya configurado (paso 3).
  2. Abre el sitio ya en línea, clic derecho sobre el logo del encabezado → **"Copiar dirección de la imagen"**.
  3. Pega esa URL reemplazando las 3 apariciones de `TU_LOGO_URL_AQUI` en `index.html`.
  4. Vuelve a subir `index.html`.

## Paso 5 — Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub y sube estos archivos: `index.html`, `style.css`, `script.js`.
2. **Settings > Pages > Source**: rama `main`, carpeta `/ (root)`.
3. En un par de minutos tu catálogo queda en `https://tu-usuario.github.io/tu-repo/`.

## Cómo se usa día a día

- **Agregar producto**: nueva fila en "Productos" con nombre, fotos (link de Drive), precio, categoría, y márcalo `Activo: si`. El SKU se genera solo. Listo, aparece en la web al recargar.
- **Nueva categoría o subcategoría**: solo escríbela en la columna Categorias de cualquier producto (usa `>` para subcategoría) — el filtro se genera solo.
- **Nuevo color**: agrégalo en la pestaña Colores con `Disponible: si`. Aparece automáticamente en el selector de cualquier producto con "Opciones de color" activado.
- **Ver pedidos**: todos quedan en la pestaña "Pedidos" con número de orden, fecha, productos (incluye el color elegido si aplica), y total.
- **Actualizar el status de un pedido**: edita la columna Status en "Pedidos" — el cliente lo ve al consultar su número de orden en la web.

## Búsqueda, Novedades y orden del catálogo

- **Buscador**: el ícono de lupa junto al carrito despliega un campo de texto que filtra por nombre, descripción o SKU, combinado con el filtro de categoría activo.
- **Novedades**: el carrusel de arriba siempre muestra los productos marcados `Novedades: si` **más recientes primero**, con un máximo de **10** — no hace falta quitarle la marca a los viejos, se van cayendo solos del carrusel conforme agregas productos nuevos (aunque la marca se las quedes puesta).
- **Catálogo (orden por default): "Más pedidos"**. El selector "Filtrar" ordena por cuántas piezas se han pedido de cada producto en total (leyendo la pestaña Pedidos), de mayor a menor. Los que aún no tienen pedidos se acomodan entre sí en el orden del Sheet. Esto es intencional: así "Novedades" (arriba) y el catálogo (abajo) muestran dos cosas distintas — lo recién agregado vs. lo que más se vende — en vez de verse repetidos. Si prefieres ver el orden tal cual está en el Sheet, esa opción sigue disponible en el mismo selector como "Orden del Sheet".

## Notas técnicas

- El carrito vive en el navegador de cada visitante (localStorage), así que no se comparte entre dispositivos.
- Un mismo producto puede estar varias veces en el carrito si el cliente elige distintos colores — cada color es una línea independiente.
- El número de orden es consecutivo y lo asigna el propio Google Sheet al momento de ordenar (evita que dos personas ordenando al mismo tiempo choquen, gracias a `LockService`).
- Si algún día quieres agregar más columnas (por ejemplo "Material" o "Tiempo de impresión"), solo agrégalas al Sheet y luego a `normalizarProducto()` en `script.js`.
