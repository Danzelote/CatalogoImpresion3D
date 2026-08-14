/* ============================================
   Catálogo 3D — lógica de la app
   ============================================
   La configuración (tus datos: SHEET_ID, WhatsApp, logo, etc.) vive en
   config.js, que se carga antes que este archivo. Aquí abajo solo hay
   lógica — no necesitas tocar nada de este archivo para configurar tu
   tienda.
   ============================================ */

/* ---------------------------------------------
   2) ESTADO
--------------------------------------------- */
let PRODUCTOS = [];
let COLORES_DISPONIBLES = [];
let POPULARIDAD = {}; // { SKU: piezas pedidas en total }
let CATEGORIA_ACTIVA = 'todas';
let SUBCATEGORIA_ACTIVA = 'todas';
let ORDEN_ACTIVO = 'populares';
let TEXTO_BUSQUEDA = '';
let PAGINA_ACTUAL = 1;
let CARRITO = cargarCarrito();

/* ---------------------------------------------
   3) CARGA DE DATOS DESDE GOOGLE SHEETS
--------------------------------------------- */
function urlCSV(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

// Guarda una copia breve (5 minutos) de los datos del Sheet en el propio
// celular. Si alguien cierra la pestaña y regresa, o cambia de app y
// vuelve, no hay que descargar y procesar todo desde cero otra vez.
const CACHE_MINUTOS = 5;

function leerCache(clave) {
  try {
    const crudo = localStorage.getItem('catalogo3d_cache_' + clave);
    if (!crudo) return null;
    const { datos, guardadoEn } = JSON.parse(crudo);
    if (Date.now() - guardadoEn > CACHE_MINUTOS * 60 * 1000) return null;
    return datos;
  } catch {
    return null;
  }
}

function guardarCache(clave, datos) {
  try {
    localStorage.setItem('catalogo3d_cache_' + clave, JSON.stringify({ datos, guardadoEn: Date.now() }));
  } catch {
    // localStorage lleno o bloqueado: no es grave, simplemente no cachea.
  }
}

async function obtenerCSV(sheetName, claveCache) {
  const cacheado = leerCache(claveCache);
  if (cacheado) return cacheado;

  const res = await fetch(urlCSV(sheetName));
  if (!res.ok) throw new Error('No se pudo leer la pestaña ' + sheetName);
  const csvText = await res.text();
  guardarCache(claveCache, csvText);
  return csvText;
}

async function cargarColores() {
  try {
    const csvText = await obtenerCSV(CONFIG.SHEET_COLORES, 'colores');
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    // Solo se cargan los colores marcados explícitamente como disponibles.
    // Si "Disponible" está vacío o dice "no", ese color no aparece en ningún selector.
    COLORES_DISPONIBLES = parsed.data
      .map(row => ({
        nombre: (row['Color'] || '').trim(),
        foto: resolverFoto((row['Foto'] || '').trim()),
        disponible: (row['Disponible'] || '').toString().trim().toLowerCase() === 'si',
      }))
      .filter(c => c.nombre && c.disponible);
  } catch (err) {
    // No es un error fatal: el catálogo puede vivir sin colores cargados,
    // simplemente ningún producto con "Opciones de color" podrá elegirse.
    console.error(err);
    COLORES_DISPONIBLES = [];
  }
}

// Trae, desde la pestaña "Pedidos", cuántas piezas se han pedido de cada
// SKU en total — se usa para ordenar el catálogo por "más pedidos". Se
// pide aparte y no bloquea la primera pintada del catálogo (ver iniciar());
// en cuanto responde, solo reordena lo que ya se está viendo.
async function cargarPopularidad() {
  try {
    const data = await llamarAppsScript('accion=popularidad');
    if (data.ok && data.conteos) {
      POPULARIDAD = data.conteos;
    }
  } catch (err) {
    console.error(err);
    POPULARIDAD = {};
  }
}

// A diferencia de cargarColores, esta SÍ deja que el error se propague
// (no atrapa el catch) — si el Sheet de productos falla, es un error real
// que debe mostrar el aviso al visitante, no algo de lo que se pueda
// seguir de largo en silencio.
async function cargarProductos() {
  const csvText = await obtenerCSV(CONFIG.SHEET_PRODUCTOS, 'productos');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  PRODUCTOS = parsed.data
    .map(normalizarProducto)
    // Se oculta si falta el nombre, si Activo no dice explícitamente "si",
    // o si el precio está vacío/ inválido (evita mostrar productos en $0).
    .filter(p => p.nombre && p.activo && !isNaN(p.precio))
    .map((p, i) => ({ ...p, _orden: i }));
}

function mostrarErrorCatalogo() {
  document.getElementById('catalog').innerHTML =
    `<div class="state-msg">El catálogo se está actualizando.<br>Por favor recarga la página en unos minutos.</div>`;
}

function normalizarProducto(row) {
  const fotos = [row['Foto1'], row['Foto2'], row['Foto3']]
    .map(f => (f || '').trim())
    .filter(Boolean)
    .map(f => resolverFoto(f))
    .filter(Boolean);

  const categorias = (row['Categorias'] || row['Categorías'] || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => {
      const partes = c.split('>').map(p => p.trim()).filter(Boolean);
      return { padre: partes[0] || '', hijo: partes[1] || '' };
    })
    .filter(c => c.padre);

  const precioTexto = (row['Precio'] || '').toString().trim();
  const precio = precioTexto ? parseFloat(precioTexto.replace(/[^0-9.]/g, '')) : NaN;

  return {
    nombre: (row['Nombre'] || '').trim(),
    sku: (row['SKU'] || '').trim(),
    fotos: fotos.length ? fotos : ['https://placehold.co/500x500/232629/6b6f76?text=Sin+foto'],
    descripcion: (row['Descripcion'] || row['Descripción'] || '').trim(),
    precio,
    categorias,
    // Activo solo cuenta como "si" está escrito explícitamente — vacío = oculto.
    activo: (row['Activo'] || '').toString().trim().toLowerCase() === 'si',
    novedad: (row['Novedades'] || '').toString().trim().toLowerCase() === 'si',
    opcionesColor: (row['Opciones de color'] || row['Opciones De Color'] || '').toString().trim().toLowerCase() === 'si',
    cantidadPorPieza: (row['Piezas por pedido'] || '').toString().trim(),
  };
}

// Saca el ID de un archivo a partir de cualquier formato de link para
// compartir de Google Drive (o si ya es solo el ID, lo usa tal cual).
function extraerIdDrive(valor) {
  const patrones = [
    /\/d\/([a-zA-Z0-9_-]{20,})/,     // .../file/d/ID/view...
    /[?&]id=([a-zA-Z0-9_-]{20,})/,   // ...?id=ID
  ];
  for (const patron of patrones) {
    const match = valor.match(patron);
    if (match) return match[1];
  }
  if (/^[a-zA-Z0-9_-]{20,}$/.test(valor.trim())) return valor.trim();
  return null;
}

// Convierte un link de Google Drive (o una URL completa de cualquier otro
// sitio) en una URL de imagen que sí se puede insertar en la página.
// Ya no se usan carpetas locales del repo — todo viene de Drive o de una
// URL externa completa.
function resolverFoto(valor) {
  if (!valor) return '';

  if (valor.includes('drive.google.com') || /^[a-zA-Z0-9_-]{20,}$/.test(valor.trim())) {
    const id = extraerIdDrive(valor);
    // =w800 le pide a Drive una versión ya redimensionada a 800px de ancho,
    // en vez de la foto original a resolución completa — más rápido en móvil.
    if (id) return `https://lh3.googleusercontent.com/d/${id}=w800`;
  }

  if (/^https?:\/\//i.test(valor)) return valor;

  // No es un link de Drive reconocible ni una URL completa: no hay forma
  // de mostrarlo, se descarta en vez de generar una imagen rota.
  return '';
}

/* ---------------------------------------------
   4) CATEGORÍAS Y SUBCATEGORÍAS AUTOMÁTICAS
--------------------------------------------- */
function etiquetaCategoria(cat) {
  return cat.hijo ? `${cat.padre} › ${cat.hijo}` : cat.padre;
}

function construirArbolCategorias() {
  const arbol = new Map(); // 'Categoría padre' -> Set de subcategorías
  PRODUCTOS.forEach(p => {
    p.categorias.forEach(c => {
      if (!arbol.has(c.padre)) arbol.set(c.padre, new Set());
      if (c.hijo) arbol.get(c.padre).add(c.hijo);
    });
  });
  return arbol;
}

function renderCategorias() {
  const bar = document.getElementById('categoryBar');
  const subBar = document.getElementById('subcategoryBar');
  const arbol = construirArbolCategorias();

  const padres = ['todas', ...Array.from(arbol.keys()).sort()];

  bar.innerHTML = padres.map(c => `
    <button class="category-chip ${c === CATEGORIA_ACTIVA ? 'active' : ''}" data-cat="${escapeAttr(c)}">
      ${c === 'todas' ? 'Todas' : escapeHtml(c)}
    </button>
  `).join('');

  bar.querySelectorAll('.category-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      CATEGORIA_ACTIVA = btn.dataset.cat;
      SUBCATEGORIA_ACTIVA = 'todas';
      reiniciarPagina();
      renderCategorias();
      renderCatalogo();
    });
  });

  const hijos = CATEGORIA_ACTIVA !== 'todas'
    ? Array.from(arbol.get(CATEGORIA_ACTIVA) || []).sort()
    : [];

  if (!hijos.length) {
    subBar.innerHTML = '';
    subBar.classList.remove('visible');
    return;
  }

  subBar.classList.add('visible');
  const opciones = ['todas', ...hijos];
  subBar.innerHTML = opciones.map(h => `
    <button class="subcategory-chip ${h === SUBCATEGORIA_ACTIVA ? 'active' : ''}" data-sub="${escapeAttr(h)}">
      ${h === 'todas' ? 'Todas' : escapeHtml(h)}
    </button>
  `).join('');

  subBar.querySelectorAll('.subcategory-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      SUBCATEGORIA_ACTIVA = btn.dataset.sub;
      reiniciarPagina();
      renderCategorias();
      renderCatalogo();
    });
  });
}

/* ---------------------------------------------
   4b) NOVEDADES (carrusel)
--------------------------------------------- */
function renderNovedades() {
  const seccion = document.getElementById('novedadesSection');
  const track = document.getElementById('novedadesTrack');
  const novedades = PRODUCTOS
    .filter(p => p.novedad)
    .sort((a, b) => b._orden - a._orden) // más nuevo primero
    .slice(0, 10);

  if (!novedades.length) {
    seccion.style.display = 'none';
    return;
  }
  seccion.style.display = '';

  track.innerHTML = novedades.map(p => `
    <article class="novedad-card" data-sku="${escapeAttr(p.sku)}">
      <div class="novedad-photo">
        <img src="${escapeAttr(p.fotos[0])}" alt="${escapeAttr(p.nombre)}" loading="lazy" decoding="async">
      </div>
      <div class="novedad-info">
        <span class="novedad-name">${escapeHtml(p.nombre)}</span>
        <span class="novedad-price">${formatoPrecio(p.precio)}</span>
      </div>
    </article>
  `).join('');

  track.querySelectorAll('.novedad-card').forEach(card => {
    card.addEventListener('click', () => abrirModal(card.dataset.sku));
  });
}

/* ---------------------------------------------
   5) RENDER DEL CATÁLOGO
--------------------------------------------- */
function ordenarLista(lista) {
  const ordenado = [...lista];
  switch (ORDEN_ACTIVO) {
    case 'populares':
      // Los empatados (incluyendo 0-0 cuando aún no hay pedidos) se quedan
      // en su orden original del Sheet — el sort de JS es estable.
      ordenado.sort((a, b) => (POPULARIDAD[b.sku] || 0) - (POPULARIDAD[a.sku] || 0));
      break;
    case 'nuevo':
      ordenado.sort((a, b) => b._orden - a._orden);
      break;
    case 'precio-asc':
      ordenado.sort((a, b) => a.precio - b.precio);
      break;
    case 'precio-desc':
      ordenado.sort((a, b) => b.precio - a.precio);
      break;
    case 'categoria':
      ordenado.sort((a, b) => (a.categorias[0]?.padre || '').localeCompare(b.categorias[0]?.padre || ''));
      break;
    default:
      // 'relevancia' = se deja tal cual viene del Sheet
      break;
  }
  return ordenado;
}

function renderCatalogo() {
  const catalogEl = document.getElementById('catalog');
  const filtrada = PRODUCTOS.filter(p => {
    if (CATEGORIA_ACTIVA !== 'todas') {
      const coincideCategoria = p.categorias.some(c => {
        if (c.padre !== CATEGORIA_ACTIVA) return false;
        if (SUBCATEGORIA_ACTIVA === 'todas') return true;
        return c.hijo === SUBCATEGORIA_ACTIVA;
      });
      if (!coincideCategoria) return false;
    }
    if (TEXTO_BUSQUEDA) {
      const texto = `${p.nombre} ${p.descripcion} ${p.sku}`.toLowerCase();
      if (!texto.includes(TEXTO_BUSQUEDA)) return false;
    }
    return true;
  });
  const ordenada = ordenarLista(filtrada);

  if (!ordenada.length) {
    catalogEl.innerHTML = `<div class="state-msg">${TEXTO_BUSQUEDA ? 'No encontramos productos con esa búsqueda.' : 'No hay productos en esta categoría todavía.'}</div>`;
    renderPaginacion(0);
    return;
  }

  const porPagina = CONFIG.PRODUCTOS_POR_PAGINA;
  const totalPaginas = Math.max(1, Math.ceil(ordenada.length / porPagina));
  if (PAGINA_ACTUAL > totalPaginas) PAGINA_ACTUAL = totalPaginas;
  const inicio = (PAGINA_ACTUAL - 1) * porPagina;
  const lista = ordenada.slice(inicio, inicio + porPagina);

  catalogEl.innerHTML = lista.map(p => tarjetaProducto(p)).join('');

  catalogEl.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      manejarClicAgregar(btn, btn.closest('.product-card'));
    });
  });

  catalogEl.querySelectorAll('.color-select').forEach(sel => {
    sel.addEventListener('click', (ev) => ev.stopPropagation());
  });
  vincularSelectColor(catalogEl);

  catalogEl.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => abrirModal(card.dataset.sku));
  });

  renderPaginacion(totalPaginas);
}

function renderPaginacion(totalPaginas) {
  const cont = document.getElementById('pagination');

  if (totalPaginas <= 1) {
    cont.classList.remove('visible');
    cont.innerHTML = '';
    return;
  }

  cont.classList.add('visible');
  cont.innerHTML = `
    <button id="pagAnterior" ${PAGINA_ACTUAL <= 1 ? 'disabled' : ''}>‹ Anterior</button>
    <span class="pagination-label">Página ${PAGINA_ACTUAL} de ${totalPaginas}</span>
    <button id="pagSiguiente" ${PAGINA_ACTUAL >= totalPaginas ? 'disabled' : ''}>Siguiente ›</button>
  `;

  document.getElementById('pagAnterior').addEventListener('click', () => cambiarPagina(PAGINA_ACTUAL - 1));
  document.getElementById('pagSiguiente').addEventListener('click', () => cambiarPagina(PAGINA_ACTUAL + 1));
}

function cambiarPagina(nueva) {
  PAGINA_ACTUAL = nueva;
  renderCatalogo();
  document.getElementById('catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Cualquier cambio de filtro/orden/búsqueda regresa a la página 1, para
// nunca dejar a alguien viendo una "página 3" que ya no tiene tantos
// productos con el nuevo filtro.
function reiniciarPagina() {
  PAGINA_ACTUAL = 1;
}

const ICONO_CARRITO = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;

function opcionesColorHTML(sku) {
  if (!COLORES_DISPONIBLES.length) {
    return `<p class="color-hint">Aún no hay colores cargados — pregunta por WhatsApp.</p>`;
  }
  return `
    <div class="color-select-wrap">
      <label>Color</label>
      <div class="color-select-row">
        <select class="color-select" data-sku="${escapeAttr(sku)}">
          <option value="">Elige un color</option>
          ${COLORES_DISPONIBLES.map(c => `<option value="${escapeAttr(c.nombre)}">${escapeHtml(c.nombre)}</option>`).join('')}
        </select>
        <img class="color-preview" alt="Vista previa del color" decoding="async">
      </div>
      <span class="color-hint">¿No ves tu color? Pregúntanos por WhatsApp.</span>
    </div>
  `;
}

// Cambia la miniatura junto al selector según el color elegido, usando
// la foto de esa pestaña "Colores" del Sheet.
function vincularSelectColor(contenedor) {
  contenedor.querySelectorAll('.color-select-wrap').forEach(wrap => {
    const select = wrap.querySelector('.color-select');
    const preview = wrap.querySelector('.color-preview');
    if (!select || !preview) return;

    select.addEventListener('change', () => {
      const color = COLORES_DISPONIBLES.find(c => c.nombre === select.value);
      if (color && color.foto) {
        preview.src = color.foto;
        preview.classList.add('visible');
      } else {
        preview.classList.remove('visible');
        preview.removeAttribute('src');
      }
    });
  });
}

function tarjetaProducto(p) {
  const enCarrito = !p.opcionesColor && CARRITO.some(i => i.sku === p.sku);
  return `
    <article class="product-card" data-sku="${escapeAttr(p.sku)}">
      <div class="product-photos">
        ${p.fotos.map((f, i) => `<img src="${escapeAttr(f)}" alt="${escapeAttr(p.nombre)}" class="${i === 0 ? 'active' : ''}" loading="lazy" decoding="async">`).join('')}
        ${p.fotos.length > 1 ? `<div class="photo-dots">${p.fotos.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>` : ''}
      </div>
      <div class="product-body">
        <div class="product-name">${escapeHtml(p.nombre)}</div>
        <div class="product-sku">SKU ${escapeHtml(p.sku)}</div>
        ${p.cantidadPorPieza ? `<div class="product-quantity">Piezas por pedido: ${escapeHtml(p.cantidadPorPieza)}</div>` : ''}
        ${p.descripcion ? `<div class="product-desc">${escapeHtml(p.descripcion)}</div>${p.descripcion.length > 140 ? '<span class="desc-more">Leer más</span>' : ''}` : ''}
        ${p.categorias.length ? `<div class="product-tags">${p.categorias.map(c => `<span class="product-tag">${escapeHtml(etiquetaCategoria(c))}</span>`).join('')}</div>` : ''}
        ${p.opcionesColor ? opcionesColorHTML(p.sku) : ''}
        <div class="product-footer">
          <span class="product-price">${formatoPrecio(p.precio)}</span>
          <button class="add-btn ${enCarrito ? 'added' : ''}" data-sku="${escapeAttr(p.sku)}">
            ${enCarrito ? 'Agregado ✓' : `Agregar ${ICONO_CARRITO}`}
          </button>
        </div>
      </div>
    </article>
  `;
}

// Lógica compartida del botón "Agregar", usada tanto en la tarjeta del
// catálogo como en el modal de detalle: valida el color si el producto
// lo requiere, antes de mandarlo al carrito.
function manejarClicAgregar(boton, contenedor) {
  const sku = boton.dataset.sku;
  const colorSelect = contenedor.querySelector('.color-select');
  const color = colorSelect ? colorSelect.value : '';

  if (colorSelect && !color) {
    colorSelect.focus();
    colorSelect.classList.add('color-select-error');
    setTimeout(() => colorSelect.classList.remove('color-select-error'), 1200);
    return;
  }

  agregarAlCarrito(sku, color);

  if (colorSelect) {
    boton.innerHTML = 'Agregado ✓';
  }
}

function urlProducto(sku) {
  return `${location.origin}${location.pathname}#producto=${encodeURIComponent(sku)}`;
}

async function compartirProducto(p) {
  const url = urlProducto(p.sku);
  const texto = `${p.nombre} — ${formatoPrecio(p.precio)}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: p.nombre, text: texto, url });
    } catch {
      // El usuario cerró el cuadro de compartir sin elegir nada — no hacer nada.
    }
    return;
  }

  // Respaldo para computadora, donde no existe el compartir nativo:
  // abre WhatsApp Web con el link ya listo para mandar.
  const mensaje = `${texto}\n${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
}

/* ---------------------------------------------
   5b) MODAL DE DETALLE (vista más grande)
--------------------------------------------- */
function abrirModal(sku) {
  const p = PRODUCTOS.find(x => x.sku === sku);
  if (!p) return;

  const enCarrito = !p.opcionesColor && CARRITO.some(i => i.sku === p.sku);

  const contenido = document.getElementById('modalContent');
  contenido.innerHTML = `
    <div class="modal-photos">
      ${p.fotos.map((f, i) => `<img src="${escapeAttr(f)}" alt="${escapeAttr(p.nombre)}" class="${i === 0 ? 'active' : ''}" decoding="async">`).join('')}
      ${p.fotos.length > 1 ? `<div class="photo-dots">${p.fotos.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>` : ''}
    </div>
    <div class="modal-info">
      <h2>${escapeHtml(p.nombre)}</h2>
      <div class="product-sku">SKU ${escapeHtml(p.sku)}</div>
      ${p.cantidadPorPieza ? `<div class="product-quantity">Piezas por pedido: ${escapeHtml(p.cantidadPorPieza)}</div>` : ''}
      ${p.categorias.length ? `<div class="product-tags">${p.categorias.map(c => `<span class="product-tag">${escapeHtml(etiquetaCategoria(c))}</span>`).join('')}</div>` : ''}
      <p class="modal-desc">${escapeHtml(p.descripcion) || 'Sin descripción.'}</p>
      ${p.opcionesColor ? opcionesColorHTML(p.sku) : ''}
      <div class="modal-footer">
        <span class="product-price">${formatoPrecio(p.precio)}</span>
        <button class="add-btn ${enCarrito ? 'added' : ''}" id="modalAddBtn" data-sku="${escapeAttr(p.sku)}">
          ${enCarrito ? 'Agregado ✓' : `Agregar ${ICONO_CARRITO}`}
        </button>
      </div>
    </div>
  `;

  history.replaceState(null, '', urlProducto(p.sku));

  const fotosEl = contenido.querySelector('.modal-photos');
  const imgs = fotosEl.querySelectorAll('img');
  const dots = fotosEl.querySelectorAll('.photo-dots span');
  let idx = 0;

  function mostrarFoto(nuevoIdx) {
    imgs[idx].classList.remove('active');
    dots[idx] && dots[idx].classList.remove('active');
    idx = (nuevoIdx + imgs.length) % imgs.length;
    imgs[idx].classList.add('active');
    dots[idx] && dots[idx].classList.add('active');
  }

  if (imgs.length > 1) {
    // Clic (o tap sin deslizar): avanza a la siguiente foto.
    fotosEl.addEventListener('click', () => mostrarFoto(idx + 1));

    // Deslizar con el dedo: izquierda = siguiente, derecha = anterior.
    let touchStartX = null;
    fotosEl.addEventListener('touchstart', (ev) => {
      touchStartX = ev.touches[0].clientX;
    }, { passive: true });

    fotosEl.addEventListener('touchend', (ev) => {
      if (touchStartX === null) return;
      const deltaX = ev.changedTouches[0].clientX - touchStartX;
      touchStartX = null;

      if (Math.abs(deltaX) < 40) return; // fue un tap, no un swipe — lo maneja el 'click'

      ev.preventDefault(); // evita que también dispare el 'click' de avance
      mostrarFoto(deltaX < 0 ? idx + 1 : idx - 1);
    });
  }

  document.getElementById('modalAddBtn').addEventListener('click', (ev) => {
    manejarClicAgregar(ev.currentTarget, contenido);
  });

  // El botón de compartir ahora vive en la barra fija (fuera de modalContent,
  // así que no se vuelve a crear cada vez) — se reasigna con onclick para
  // que siempre apunte al producto actualmente abierto, sin acumular
  // listeners de productos anteriores.
  document.getElementById('modalShareBtn').onclick = () => compartirProducto(p);

  vincularSelectColor(contenido);

  document.getElementById('modalOverlay').classList.add('open');
}

function cerrarModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  if (location.hash.startsWith('#producto=')) {
    history.replaceState(null, '', location.pathname);
  }
}

/* ---------------------------------------------
   6) CARRITO
   Cada línea del carrito se identifica por SKU + color (si aplica),
   así un mismo producto puede estar en el carrito en varios colores
   a la vez, cada uno como renglón independiente.
--------------------------------------------- */
function claveCarrito(sku, color) {
  return color ? `${sku}::${color}` : sku;
}

function cargarCarrito() {
  try {
    return JSON.parse(localStorage.getItem('catalogo3d_carrito')) || [];
  } catch {
    return [];
  }
}

function guardarCarrito() {
  localStorage.setItem('catalogo3d_carrito', JSON.stringify(CARRITO));
}

function agregarAlCarrito(sku, color = '') {
  const producto = PRODUCTOS.find(p => p.sku === sku);
  if (!producto) return;

  const clave = claveCarrito(sku, color);
  const item = CARRITO.find(i => claveCarrito(i.sku, i.color) === clave);
  if (item) {
    item.cantidad += 1;
  } else {
    CARRITO.push({
      sku: producto.sku,
      nombre: producto.nombre,
      precio: producto.precio,
      foto: producto.fotos[0],
      color: color || '',
      cantidad: 1,
    });
  }
  guardarCarrito();
  renderCarrito();
  avisarCarrito();
}

function cambiarCantidad(clave, delta) {
  const item = CARRITO.find(i => claveCarrito(i.sku, i.color) === clave);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    CARRITO = CARRITO.filter(i => claveCarrito(i.sku, i.color) !== clave);
  }
  guardarCarrito();
  renderCarrito();
  renderCatalogo();
}

function quitarDelCarrito(clave) {
  CARRITO = CARRITO.filter(i => claveCarrito(i.sku, i.color) !== clave);
  guardarCarrito();
  renderCarrito();
  renderCatalogo();
}

function renderCarrito() {
  const itemsEl = document.getElementById('cartItems');
  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotal');

  const totalItems = CARRITO.reduce((a, i) => a + i.cantidad, 0);
  countEl.textContent = totalItems;

  if (!CARRITO.length) {
    itemsEl.innerHTML = `<div class="cart-empty">Aún no agregas productos.</div>`;
  } else {
    itemsEl.innerHTML = CARRITO.map(i => {
      const clave = claveCarrito(i.sku, i.color);
      return `
      <div class="cart-item">
        <img src="${escapeAttr(i.foto)}" alt="${escapeAttr(i.nombre)}" decoding="async">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(i.nombre)}</div>
          <div class="cart-item-sku">SKU ${escapeHtml(i.sku)}${i.color ? ' · Color: ' + escapeHtml(i.color) : ''}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" data-clave="${escapeAttr(clave)}" data-delta="-1">–</button>
            <span>${i.cantidad}</span>
            <button class="qty-btn" data-clave="${escapeAttr(clave)}" data-delta="1">+</button>
            <button class="cart-remove" data-clave="${escapeAttr(clave)}">quitar</button>
          </div>
        </div>
        <div class="cart-item-price">${formatoPrecio(i.precio * i.cantidad)}</div>
      </div>
    `;
    }).join('');

    itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => cambiarCantidad(btn.dataset.clave, parseInt(btn.dataset.delta)));
    });
    itemsEl.querySelectorAll('.cart-remove').forEach(btn => {
      btn.addEventListener('click', () => quitarDelCarrito(btn.dataset.clave));
    });
  }

  const total = CARRITO.reduce((a, i) => a + i.precio * i.cantidad, 0);
  totalEl.textContent = formatoPrecio(total);
}

function abrirCarrito() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
}

// Le da un pequeño destello al botón de "Carrito" cada vez que se agrega
// un producto, en vez de abrir el carrito completo (se sentía invasivo).
function avisarCarrito() {
  const boton = document.getElementById('cartToggle');
  boton.classList.remove('bump');
  void boton.offsetWidth; // fuerza el reinicio de la animación si ya estaba corriendo
  boton.classList.add('bump');
}

function cerrarCarrito() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
}

/* ---------------------------------------------
   7) ENVÍO DE PEDIDO → Apps Script → WhatsApp
   Usamos JSONP (una etiqueta <script>) en vez de fetch, porque
   Apps Script no manda encabezados CORS y varios navegadores
   (Safari en particular) bloquean leer la respuesta de un fetch
   cruzado entre dominios sin esos encabezados.
--------------------------------------------- */
function llamarAppsScript(query) {
  return new Promise((resolve, reject) => {
    const callbackName = 'catalogo3dCallback_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const script = document.createElement('script');

    const limpiar = () => {
      clearTimeout(temporizador);
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (resultado) => {
      resolve(resultado);
      limpiar();
    };

    const temporizador = setTimeout(() => {
      reject(new Error('Tiempo de espera agotado contactando Apps Script'));
      limpiar();
    }, 15000);

    script.onerror = () => {
      reject(new Error('No se pudo contactar la URL de Apps Script'));
      limpiar();
    };

    script.src = `${CONFIG.APPS_SCRIPT_URL}?callback=${callbackName}&${query}`;
    document.body.appendChild(script);
  });
}

async function ordenar() {
  if (!CARRITO.length) return;

  const orderBtn = document.getElementById('orderBtn');
  orderBtn.disabled = true;
  orderBtn.textContent = 'Generando pedido…';

  const total = CARRITO.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const items = [...CARRITO];
  const nombreCliente = document.getElementById('nombreClienteInput').value.trim();

  try {
    const payload = { items, total, nombre: nombreCliente };
    const query = `data=${encodeURIComponent(JSON.stringify(payload))}`;
    const data = await llamarAppsScript(query);

    if (!data.ok) throw new Error(data.error || 'Error al registrar el pedido');

    CARRITO = [];
    guardarCarrito();
    renderCarrito();
    renderCatalogo();
    cerrarCarrito();

    document.getElementById('nombreClienteInput').value = '';

    mostrarConfirmacion(data.orderId, total, items, nombreCliente);
  } catch (err) {
    console.error(err);
    alert('No se pudo generar el número de orden automáticamente. Revisa la URL de Apps Script en script.js. Tu pedido no se perdió, sigue en el carrito.');
  } finally {
    orderBtn.disabled = false;
    orderBtn.textContent = 'Ordenar por WhatsApp';
  }
}

function mostrarConfirmacion(orderId, total, items, nombreCliente) {
  document.getElementById('confirmText').textContent =
    `Tu pedido quedó guardado con el número de orden ${orderId}.`;

  const btn = document.getElementById('confirmWhatsappBtn');
  btn.onclick = () => {
    abrirWhatsApp(orderId, total, items, nombreCliente);
    cerrarConfirmacion();
  };

  document.getElementById('confirmOverlay').classList.add('open');
}

function cerrarConfirmacion() {
  document.getElementById('confirmOverlay').classList.remove('open');
}

function abrirWhatsApp(orderId, total, items, nombreCliente) {
  const listado = items.map(i => {
    const colorTxt = i.color ? ` - Color: ${i.color}` : '';
    return `- ${i.nombre}${colorTxt} (SKU: ${i.sku}) x${i.cantidad}`;
  }).join('\n');

  const saludo = nombreCliente
    ? `Hola, soy ${nombreCliente} y acabo de hacer un pedido con el número de orden (${orderId})`
    : `¡Hola! Acabo de hacer un pedido con el número de orden (${orderId})`;

  const mensaje =
    `${saludo}\n\n` +
    `${listado}\n\n` +
    `Total: ${formatoPrecio(total)}`;

  const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}

/* ---------------------------------------------
   7b) CONSULTAR STATUS DE UN PEDIDO
--------------------------------------------- */
async function consultarStatus(numeroOrden) {
  const query = `accion=consultar&orden=${encodeURIComponent(numeroOrden)}`;
  return llamarAppsScript(query);
}

function claseStatus(status) {
  return (status || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/\s+/g, '-');
}

async function manejarConsultaStatus(ev) {
  ev.preventDefault();
  const input = document.getElementById('statusInput');
  const boton = document.getElementById('statusBtn');
  const resultado = document.getElementById('statusResult');
  const numero = input.value.trim();

  if (!numero) return;

  boton.disabled = true;
  boton.textContent = 'Buscando…';
  resultado.innerHTML = '';

  try {
    const data = await consultarStatus(numero);

    if (!data.ok) throw new Error(data.error || 'Error al consultar');

    if (!data.encontrado) {
      resultado.innerHTML = `<div class="status-not-found">No encontramos ningún pedido con el número "${escapeHtml(numero)}". Revisa que esté correcto.</div>`;
      return;
    }

    const total = parseFloat(data.total) || 0;
    const anticipo = parseFloat(data.anticipo) || 0;
    const saldo = Math.max(0, total - anticipo);

    resultado.innerHTML = `
      <div class="status-card">
        <div class="status-card-top">
          <span class="status-order-id">Orden ${escapeHtml(data.orderId)}</span>
          <div class="status-badges">
            <span class="status-badge ${claseStatus(data.status)}">${escapeHtml(data.status)}</span>
            <span class="status-badge ${claseStatus(data.pago)}">${escapeHtml(data.pago)}</span>
          </div>
        </div>
        <div class="status-detail">
          <strong>Fecha:</strong> ${escapeHtml(data.fecha)}<br>
          <strong>Productos:</strong> ${escapeHtml(data.productos)}<br>
          <strong>Total:</strong> ${formatoPrecio(total)}
        </div>
        <div class="status-pago-box">
          <span>Anticipo recibido: ${formatoPrecio(anticipo)}</span>
          <span class="saldo">Saldo: ${formatoPrecio(saldo)}</span>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    resultado.innerHTML = `<div class="status-not-found">No se pudo consultar el status en este momento. Intenta de nuevo en un momento.</div>`;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Consultar';
  }
}

function abrirStatusPopup() {
  document.getElementById('statusOverlay').classList.add('open');
}

function cerrarStatusPopup() {
  document.getElementById('statusOverlay').classList.remove('open');
}

/* ---------------------------------------------
   8) UTILIDADES
--------------------------------------------- */
function formatoPrecio(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: CONFIG.MONEDA }).format(n);
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

/* ---------------------------------------------
   9) ENCABEZADO: logo, descripción y botón de WhatsApp flotante
--------------------------------------------- */
// La barra de búsqueda es "sticky" pero su posición (top) depende de la
// altura real del header (varía según el tamaño del logo) — se calcula
// en JS en vez de dejarla fija en CSS, así nunca se monta encima.
function ajustarPosicionBusqueda() {
  const header = document.querySelector('.site-header');
  const searchBar = document.getElementById('searchBar');
  searchBar.style.top = `${header.offsetHeight}px`;
}
window.addEventListener('resize', ajustarPosicionBusqueda);

function iniciarEncabezado() {
  document.getElementById('brandName').textContent = CONFIG.NOMBRE_TIENDA;

  if (CONFIG.LOGO_URL) {
    const logo = document.getElementById('brandLogo');
    const src = resolverFoto(CONFIG.LOGO_URL);
    if (src) {
      logo.onload = ajustarPosicionBusqueda;
      logo.src = src;
      logo.style.display = 'block';
    }
  }

  const bannerSrc = CONFIG.BANNER_URL ? resolverFoto(CONFIG.BANNER_URL) : '';
  const howtoBanner = document.getElementById('howtoBanner');
  if (bannerSrc) {
    const banner = document.getElementById('heroBanner');
    banner.src = bannerSrc;
    banner.style.display = 'block';
    howtoBanner.style.display = 'none';
  } else {
    document.getElementById('heroDesc').textContent = CONFIG.DESCRIPCION_SITIO;
    document.getElementById('heroExtra').textContent =
      `${CONFIG.MENSAJE_MATERIAL} ${CONFIG.MENSAJE_ENVIO}`;
    howtoBanner.style.display = '';
  }

  const whatsappFloat = document.getElementById('whatsappFloat');
  whatsappFloat.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(CONFIG.WHATSAPP_MENSAJE_CONTACTO)}`;
}

/* ---------------------------------------------
   10) EVENTOS INICIALES
--------------------------------------------- */
document.getElementById('cartToggle').addEventListener('click', abrirCarrito);
document.getElementById('cartClose').addEventListener('click', cerrarCarrito);
document.getElementById('cartOverlay').addEventListener('click', cerrarCarrito);
document.getElementById('orderBtn').addEventListener('click', ordenar);
document.getElementById('modalClose').addEventListener('click', cerrarModal);
document.getElementById('modalOverlay').addEventListener('click', (ev) => {
  if (ev.target.id === 'modalOverlay') cerrarModal();
});

document.getElementById('confirmOverlay').addEventListener('click', (ev) => {
  if (ev.target.id === 'confirmOverlay') cerrarConfirmacion();
});

document.getElementById('statusForm').addEventListener('submit', manejarConsultaStatus);

document.getElementById('orderStatusToggle').addEventListener('click', abrirStatusPopup);
document.getElementById('statusClose').addEventListener('click', cerrarStatusPopup);
document.getElementById('statusOverlay').addEventListener('click', (ev) => {
  if (ev.target.id === 'statusOverlay') cerrarStatusPopup();
});

document.getElementById('sortSelect').addEventListener('change', (ev) => {
  ORDEN_ACTIVO = ev.target.value;
  reiniciarPagina();
  renderCatalogo();
});

document.getElementById('novPrev').addEventListener('click', () => {
  document.getElementById('novedadesTrack').scrollBy({ left: -220, behavior: 'smooth' });
});
document.getElementById('novNext').addEventListener('click', () => {
  document.getElementById('novedadesTrack').scrollBy({ left: 220, behavior: 'smooth' });
});

document.getElementById('searchToggle').addEventListener('click', () => {
  const bar = document.getElementById('searchBar');
  bar.classList.add('open');
  document.getElementById('searchInput').focus();
});
document.getElementById('searchClose').addEventListener('click', () => {
  document.getElementById('searchBar').classList.remove('open');
  document.getElementById('searchInput').value = '';
  TEXTO_BUSQUEDA = '';
  mostrarOcultarNovedades();
  reiniciarPagina();
  renderCatalogo();
});
document.getElementById('searchInput').addEventListener('input', (ev) => {
  TEXTO_BUSQUEDA = ev.target.value.trim().toLowerCase();
  mostrarOcultarNovedades();
  reiniciarPagina();
  renderCatalogo();
});

// Con el teclado abierto en celular, Novedades le quita espacio a los
// resultados de la búsqueda (a veces quedan tapados por el teclado) —
// se oculta mientras se está buscando algo, y regresa al borrar/cerrar.
function mostrarOcultarNovedades() {
  const seccion = document.getElementById('novedadesSection');
  if (!seccion) return;
  if (TEXTO_BUSQUEDA) {
    seccion.dataset.ocultaPorBusqueda = 'si';
    seccion.style.display = 'none';
  } else if (seccion.dataset.ocultaPorBusqueda === 'si') {
    delete seccion.dataset.ocultaPorBusqueda;
    // Solo la regresamos si sí hay Novedades que mostrar — renderNovedades()
    // ya decide eso normalmente, así que se lo dejamos a él.
    renderNovedades();
  }
}

// El filtrado ya pasa al vuelo mientras se escribe, así que al dar Enter
// no hay que recargar nada — solo se cierra el teclado del celular.
document.getElementById('searchBar').addEventListener('submit', (ev) => {
  ev.preventDefault();
  document.getElementById('searchInput').blur();
});

/* ---------------------------------------------
   POPUP DE SUSCRIPCIÓN A NOVEDADES (entrada al sitio)
--------------------------------------------- */
const CLAVE_POPUP_NEWSLETTER = 'catalogo3d_popup_newsletter';

function yaVioPopupNewsletter() {
  try {
    return !!localStorage.getItem(CLAVE_POPUP_NEWSLETTER);
  } catch {
    return true; // si localStorage falla, mejor no insistir
  }
}

function marcarPopupNewsletterVisto() {
  try {
    localStorage.setItem(CLAVE_POPUP_NEWSLETTER, 'si');
  } catch {
    // no es grave si no se pudo guardar
  }
}

function mostrarPopupNewsletter() {
  if (yaVioPopupNewsletter()) return;
  document.getElementById('newsletterOverlay').classList.add('open');
}

function cerrarPopupNewsletter() {
  document.getElementById('newsletterOverlay').classList.remove('open');
  marcarPopupNewsletterVisto();
}

document.getElementById('newsletterClose').addEventListener('click', cerrarPopupNewsletter);
document.getElementById('newsletterAhoraNo').addEventListener('click', cerrarPopupNewsletter);
document.getElementById('newsletterOverlay').addEventListener('click', (ev) => {
  if (ev.target.id === 'newsletterOverlay') cerrarPopupNewsletter();
});

document.getElementById('newsletterForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const input = document.getElementById('newsletterPopupEmail');
  const boton = document.getElementById('newsletterPopupBtn');
  const resultado = document.getElementById('newsletterPopupResult');
  const correo = input.value.trim();
  if (!correo) return;

  boton.disabled = true;
  boton.textContent = 'Enviando…';
  resultado.textContent = '';

  try {
    const query = `accion=suscribir&correo=${encodeURIComponent(correo)}`;
    const data = await llamarAppsScript(query);
    if (!data.ok) throw new Error(data.error || 'No se pudo suscribir');

    resultado.innerHTML = '<div class="status-not-found" style="color:var(--teal);">¡Listo! Ya estás suscrito.</div>';
    marcarPopupNewsletterVisto();
    setTimeout(cerrarPopupNewsletter, 1400);
  } catch (err) {
    console.error(err);
    resultado.innerHTML = '<div class="status-not-found">No se pudo suscribir, intenta de nuevo.</div>';
  } finally {
    boton.disabled = false;
    boton.textContent = 'Suscribirme';
  }
});

async function iniciar() {
  iniciarEncabezado();
  renderCarrito();
  ajustarPosicionBusqueda();

  try {
    // Colores y productos se piden al mismo tiempo de verdad, y se espera
    // a ambos antes de pintar — así el catálogo aparece en cuanto la más
    // lenta de las dos responda, no la suma de las dos.
    await Promise.all([cargarColores(), cargarProductos()]);
    renderCategorias();
    renderNovedades();
    renderCatalogo();
  } catch (err) {
    console.error(err);
    mostrarErrorCatalogo();
    return;
  }

  // Si alguien entró desde un link compartido (#producto=SKU), abre ese
  // producto directo en vez de dejarlo buscándolo en el catálogo.
  const match = location.hash.match(/producto=([^&]+)/);
  if (match) {
    const sku = decodeURIComponent(match[1]);
    if (PRODUCTOS.some(p => p.sku === sku)) abrirModal(sku);
  }

  // La popularidad ("más pedidos") se pide aparte y no bloquea la primera
  // pintada — cuando llega, solo reordena en silencio si ese es el orden activo.
  cargarPopularidad().then(() => {
    if (ORDEN_ACTIVO === 'populares') renderCatalogo();
  });

  // Popup de novedades: aparece unos segundos después, para no interrumpir
  // apenas se abre la página — y solo si nunca se ha visto en este navegador.
  setTimeout(mostrarPopupNewsletter, 2500);
}

iniciar();
