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

| Nombre | SKU | Foto1 | Foto2 | Foto3 | Descripcion | Precio | Categorias | Activo | Novedades | Opciones de color | Cantidad |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dragón articulado | *(se genera solo)* | (link de Drive) | | | Dragón articulado, 25cm | 350 | Figuras > Fantasía | si | si | si | 1 |

- **SKU**: déjalo vacío al agregar un producto nuevo. En cuanto escribas el Nombre, se genera solo (ver paso 2). Si tienes productos viejos sin SKU, corre **Catálogo 3D > Generar SKUs faltantes** una vez para rellenarlos todos.
- **Foto1/2/3**: pega el link de "Compartir" de Google Drive de cada foto (ver paso 4). Todas se muestran del mismo tamaño sin importar sus dimensiones originales.
- **Precio**: si lo dejas vacío, el producto **no aparece** en la página (evita que se vea con precio $0 por accidente).
- **Categorias**: una o varias separadas por coma. Para subcategorías, usa `>`, ej. `Juegos de mesa > Accesorios, Hogar`. Las categorías y subcategorías nuevas aparecen solas en la web, no hay que tocar código.
- **Activo**: escribe `si` para que el producto se muestre. Si lo dejas **vacío o con cualquier otra cosa, no aparece en la página** — es la forma de tenerlo guardado sin publicarlo todavía.
- **Novedades**: pon `si` para que aparezca en el carrusel de "Novedades" hasta arriba. Columna opcional.
- **Opciones de color**: pon `si` para que ese producto muestre un selector de color (tomado de la pestaña Colores) antes del botón de agregar. Si lo dejas vacío, el producto no pide color.
- **Cantidad**: opcional, texto libre. Se muestra en la tarjeta como "Cantidad: X" — útil para aclarar cuando un producto se vende en set de varias piezas (ej. "5 piezas").

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
  DESCRIPCION_SITIO: 'Piezas impresas en 3D, listas para recoger — no vendemos archivos STL.',
  MENSAJE_MATERIAL: 'Todas las piezas se imprimen en PLA. ¿Necesitas otro material? Se cotiza aparte por WhatsApp.',
  MENSAJE_ENVIO: 'Por ahora no hacemos envíos a domicilio: coordinamos un punto de recolección en CDMX.',
};
```

- **SHEET_ID**: la parte de la URL del Sheet entre `/d/` y `/edit`.
- **WHATSAPP_MENSAJE_CONTACTO**: el mensaje que se manda al dar clic en el botón flotante de WhatsApp (dudas generales — los pedidos usan su propio mensaje con número de orden, ese no se toca aquí).
- **LOGO_URL**: pega ahí el link de Drive de tu logo cuando lo tengas listo (mismo formato que las fotos de producto). Mientras esté vacío, el encabezado solo muestra el texto "Catálogo 3D".
- **DESCRIPCION_SITIO / MENSAJE_MATERIAL / MENSAJE_ENVIO**: los textos que aparecen arriba de la página, junto al encabezado. Edítalos las veces que quieras, es texto plano.

## Paso 4 — Fotos de los productos (Google Drive)

1. Comparte la carpeta principal donde tienes todo (ej. `CatalogoImpresiones3D`) como pública: clic derecho → **Compartir** → cambia el acceso general a **"Cualquier usuario con el enlace"**, rol **Lector**. Esto aplica automáticamente a todo lo que tengas adentro — no hace falta repetirlo por cada archivo.
2. Para cada foto: clic derecho sobre el archivo en Drive → **Compartir** → **Copiar enlace**.
3. Pega ese link completo (el largo, con `https://drive.google.com/file/d/...`) en las columnas Foto1/Foto2/Foto3 del Sheet, o en `LOGO_URL` para el logo. La web reconoce automáticamente que es un link de Drive y lo convierte al formato que sí puede mostrarse en una página web.

Las imágenes ya solo se leen desde Drive o desde una URL externa completa — ya no hay carpeta local de fotos en el repo.

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

## Notas técnicas

- El carrito vive en el navegador de cada visitante (localStorage), así que no se comparte entre dispositivos.
- Un mismo producto puede estar varias veces en el carrito si el cliente elige distintos colores — cada color es una línea independiente.
- El número de orden es consecutivo y lo asigna el propio Google Sheet al momento de ordenar (evita que dos personas ordenando al mismo tiempo choquen, gracias a `LockService`).
- Si algún día quieres agregar más columnas (por ejemplo "Material" o "Tiempo de impresión"), solo agrégalas al Sheet y luego a `normalizarProducto()` en `script.js`.
