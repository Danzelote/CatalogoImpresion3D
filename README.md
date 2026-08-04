# Catálogo 3D

Catálogo de productos que se edita 100% desde Google Sheets y se publica
como página estática en GitHub Pages. Incluye carrito, categorías
automáticas y botón de pedido que arma un mensaje de WhatsApp.

## Cómo está armado

```
Google Sheet (Productos + Pedidos)
        │
        │  lectura (CSV público)          escritura (Apps Script)
        ▼                                        ▲
   index.html / script.js  ──────── al ordenar ───┘
        │
        ▼
   wa.me (WhatsApp con el pedido ya redactado)
```

- **Leer productos**: la página pide el Sheet como CSV directamente, sin backend. Se actualiza solo al editar el Sheet, sin publicar nada.
- **Registrar pedidos**: un pequeño script (Google Apps Script) genera el número de orden consecutivo y lo guarda en la pestaña "Pedidos". Es la única parte que necesita "escribir" datos.

## Paso 1 — Crear el Google Sheet

Crea un Sheet nuevo con **tres pestañas**: Productos, Colores y Pedidos.

### Pestaña "Productos"

| Nombre | SKU | Foto1 | Foto2 | Foto3 | Descripcion | Precio | Categorias | Activo |
|---|---|---|---|---|---|---|---|---|
| Dragón articulado | *(se genera solo)* | dragon-1.jpg | dragon-2.jpg | | Dragón articulado impreso en PLA, 25cm | 350 | Figuras, Fantasía | si |

- **SKU**: déjalo vacío al agregar un producto nuevo. En cuanto escribas el Nombre, se genera solo (ver paso 2). Si tienes productos viejos sin SKU, corre **Catálogo 3D > Generar SKUs faltantes** una vez para rellenarlos todos.
- **Foto1/2/3**: escribe el nombre **completo del archivo, con extensión**, exactamente igual a como lo subiste (mayúsculas/minúsculas incluidas): `TorreDadosPortatil_01.jpg`, no `TorreDadosPortatil_01`. GitHub Pages distingue mayúsculas de minúsculas, así que `Foto.JPG` y `foto.jpg` son archivos distintos para él. También puedes pegar una URL completa (`https://...`) si prefieres otro hosting.
- **Categorias**: escribe una o varias separadas por coma, ej. `Figuras, Fantasía`. Las etiquetas nuevas aparecen solas en la web, no hay que tocar código.
- **Activo**: pon `no` para ocultar un producto sin borrarlo.
- **Novedades**: pon `si` para que ese producto aparezca en el carrusel de "Novedades" hasta arriba de la página. Es una columna opcional — si no la agregas, el carrusel simplemente no se muestra.

### Pestaña "Colores" (opcional — galería de colores de filamento)

| Color | Foto | Disponible |
|---|---|---|
| Rojo | rojo.jpg | si |
| Azul cielo | azul-cielo.jpg | no |

- **Foto**: igual que en Productos, nombre de archivo con extensión o URL completa. Sube las fotos de los carretes a la misma carpeta `fotos/`.
- **Disponible**: `si` o `no`. Los que digas `no` se muestran en gris con la etiqueta "Agotado", sin necesidad de borrarlos.
- Si no vas a usar esta sección todavía, no pasa nada: la web simplemente no la muestra si la pestaña está vacía o no existe.

### Pestaña "Pedidos"

No la llenes a mano. Para verla lista desde ya, corre **Catálogo 3D > Preparar hoja de Pedidos** en el menú del Sheet (aparece después del paso 2). Si no la preparas manualmente, se crea sola en cuanto llega el primer pedido real. Sus columnas son:

| Número de orden | Fecha | Productos | Total | Status |
|---|---|---|---|---|
| 000001 | 03/08/2026 10:15 | Torre de dados (SKU: P-4K9QZ) x1, Dragón (SKU: P-88XJ2) x2 | $1050 | Pendiente |

No necesitas tocar las primeras 4 columnas — el Apps Script del paso 2 las escribe solo cada vez que alguien da clic en "Ordenar por WhatsApp", siempre con Status inicial **Pendiente**.

**Sí tienes que actualizar tú la columna Status** conforme avanza cada pedido, para que el cliente pueda consultarlo desde la web (sección "Consultar mi pedido"). Escribe lo que prefieras, por ejemplo:

- `Pendiente` (automático al crearse)
- `En proceso`
- `Listo`
- `Entregado`
- `Cancelado`

Estos 5 valores tienen un color especial asignado en la web (naranja, verde o rojo según el caso); si escribes otra palabra distinta también funciona, solo se muestra en gris neutro.

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
7. Recarga el Sheet. Ahora verás un menú **Catálogo 3D** arriba, y desde ese momento el SKU se genera solo cada vez que escribes un Nombre nuevo en Productos. El menú te sirve para: rellenar SKUs de productos que ya tenías antes de instalar esto, y para preparar la pestaña de Pedidos.

## Paso 3 — Configurar la web

Abre `script.js` y edita solo el bloque `CONFIG` al inicio:

```js
const CONFIG = {
  SHEET_ID: 'pega-aquí-el-id-del-sheet',       // está en la URL del Sheet
  SHEET_PRODUCTOS: 'Productos',
  APPS_SCRIPT_URL: 'pega-aquí-la-url-del-paso-2',
  WHATSAPP_NUMBER: '5215512345678',              // tu número, código de país + número, solo dígitos
  MONEDA: 'MXN',
  CARPETA_FOTOS: 'fotos/',
};
```

El `SHEET_ID` es la parte de la URL entre `/d/` y `/edit`:
`https://docs.google.com/spreadsheets/d/`**`ESTE_PEDAZO`**`/edit`

## Paso 4 — Fotos de los productos (Google Drive)

1. Comparte la carpeta principal donde tienes todo (ej. `CatalogoImpresiones3D`) como pública: clic derecho → **Compartir** → cambia el acceso general a **"Cualquier usuario con el enlace"**, rol **Lector**. Esto aplica automáticamente a todo lo que tengas adentro, incluidas las subcarpetas de productos y colores — no hace falta repetirlo por cada archivo.
2. Para cada foto: clic derecho sobre el archivo en Drive → **Compartir** → **Copiar enlace**.
3. Pega ese link tal cual (el largo, con `https://drive.google.com/file/d/...`) en las columnas Foto1/Foto2/Foto3 del Sheet, o en la columna Foto de la pestaña Colores. La web reconoce automáticamente que es un link de Drive y lo convierte al formato que sí puede mostrarse en una página web — no necesitas editarlo tú.

Todas se muestran del mismo tamaño automáticamente sin importar las dimensiones originales del archivo (la web las recorta a un cuadro parejo).

Si en algún momento prefieres subir fotos directo al repo de GitHub en vez de Drive, también funciona: solo pon el nombre del archivo con extensión en vez del link, y la web lo busca en la carpeta `fotos/` (o `ColoresFilamentos/`) del repo.

## Paso 5 — Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub y sube estos archivos (`index.html`, `style.css`, `script.js`, tu carpeta `fotos/`).
2. **Settings > Pages > Source**: rama `main`, carpeta `/ (root)`.
3. En un par de minutos tu catálogo queda en `https://tu-usuario.github.io/tu-repo/`.

## Cómo se usa día a día

- **Agregar producto**: nueva fila en "Productos" con nombre, fotos, precio, categoría. Corre **Catálogo 3D > Generar SKUs faltantes** en el Sheet. Listo, aparece en la web al recargar.
- **Nueva categoría**: solo escríbela en la columna Categorias de cualquier producto — el filtro se genera solo.
- **Ver pedidos**: todos quedan en la pestaña "Pedidos" con número de orden, fecha, productos y total.
- **Cambiar el número de WhatsApp**: edita `WHATSAPP_NUMBER` en `script.js`.

## Notas técnicas

- El carrito vive en el navegador de cada visitante (localStorage), así que no se comparte entre dispositivos.
- El número de orden es consecutivo y lo asigna el propio Google Sheet al momento de ordenar (evita que dos personas ordenando al mismo tiempo choquen, gracias a `LockService`).
- Si algún día quieres agregar más columnas (por ejemplo "Material" o "Tiempo de impresión"), solo agrégalas al Sheet y luego a `normalizarProducto()` en `script.js`.
