/* ============================================
   Catálogo 3D — lógica de la app
   ============================================ */

/* ---------------------------------------------
   1) CONFIGURACIÓN — esto es lo único que
   normalmente necesitas editar.
--------------------------------------------- */
const CONFIG = {
  // ID del Google Sheet (está en la URL: .../d/ESTE_ID/edit)
  SHEET_ID: 'TU_SHEET_ID_AQUI',

  // Nombre exacto de la pestaña de productos
  SHEET_PRODUCTOS: 'Productos',

  // Nombre exacto de la pestaña de colores de filamento disponibles
  SHEET_COLORES: 'Colores',

  // URL del Apps Script publicado como Web App (ver README)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec',

  // Número de WhatsApp donde llegan los pedidos, con código de país,
  // solo dígitos (ej. México: 52 + 10 dígitos)
  WHATSAPP_NUMBER: '5215512345678',

  // Símbolo/formato de moneda
  MONEDA: 'MXN',

  // Estas dos carpetas solo se usan como respaldo si en el Sheet pones
  // nombres de archivo sueltos en vez de links de Google Drive o URLs
  // completas. Si vas a usar Drive para todo, puedes dejarlas tal cual.
  CARPETA_FOTOS: 'fotos/',
  CARPETA_COLORES: 'ColoresFilamentos/',
};

/* ---------------------------------------------
   2) ESTADO
--------------------------------------------- */
let PRODUCTOS = [];
let CATEGORIA_ACTIVA = 'todas';
let ORDEN_ACTIVO = 'relevancia';
let CARRITO = cargarCarrito();

/* ---------------------------------------------
   3) CARGA DE DATOS DESDE GOOGLE SHEETS
--------------------------------------------- */
function urlCSV(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

async function cargarProductos() {
  const catalogEl = document.getElementById('catalog');
  try {
    const res = await fetch(urlCSV(CONFIG.SHEET_PRODUCTOS));
    if (!res.ok) throw new Error('No se pudo leer el Sheet');
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    PRODUCTOS = parsed.data
      .map(normalizarProducto)
      .filter(p => p.nombre && p.activo !== false)
      .map((p, i) => ({ ...p, _orden: i }));

    renderCategorias();
    renderNovedades();
    renderCatalogo();
  } catch (err) {
    console.error(err);
    catalogEl.innerHTML = `<div class="state-msg">No se pudo cargar el catálogo.<br>Revisa que el Google Sheet sea público ("Cualquiera con el enlace: Lector") y que el SHEET_ID en script.js sea correcto.</div>`;
  }
}

function normalizarProducto(row) {
  const fotos = [row['Foto1'], row['Foto2'], row['Foto3']]
    .map(f => (f || '').trim())
    .filter(Boolean)
    .map(f => resolverFoto(f));

  const categorias = (row['Categorias'] || row['Categorías'] || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

  return {
    nombre: (row['Nombre'] || '').trim(),
    sku: (row['SKU'] || '').trim(),
    fotos: fotos.length ? fotos : ['https://placehold.co/500x500/232629/6b6f76?text=Sin+foto'],
    descripcion: (row['Descripcion'] || row['Descripción'] || '').trim(),
    precio: parseFloat((row['Precio'] || '0').toString().replace(/[^0-9.]/g, '')) || 0,
    categorias,
    activo: (row['Activo'] || 'si').toString().trim().toLowerCase() !== 'no',
    novedad: (row['Novedades'] || 'no').toString().trim().toLowerCase() === 'si',
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

// Convierte lo que hayas puesto en el Sheet a una URL de imagen que sí
// se puede insertar en la página:
// - Un link de "Compartir" de Google Drive → se convierte al formato correcto.
// - Una URL completa de cualquier otro sitio (http...) → se deja igual.
// - Solo un nombre de archivo → se asume que está en el repo, dentro de "carpeta".
function resolverFoto(valor, carpeta = CONFIG.CARPETA_FOTOS) {
  if (!valor) return '';

  if (valor.includes('drive.google.com') || /^[a-zA-Z0-9_-]{20,}$/.test(valor.trim())) {
    const id = extraerIdDrive(valor);
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  }

  if (/^https?:\/\//i.test(valor)) return valor;

  return carpeta + valor;
}

/* ---------------------------------------------
   4) CATEGORÍAS AUTOMÁTICAS
--------------------------------------------- */
function renderCategorias() {
  const bar = document.getElementById('categoryBar');
  const todas = new Set();
  PRODUCTOS.forEach(p => p.categorias.forEach(c => todas.add(c)));

  const categorias = ['todas', ...Array.from(todas).sort()];

  bar.innerHTML = categorias.map(c => `
    <button class="category-chip ${c === CATEGORIA_ACTIVA ? 'active' : ''}" data-cat="${escapeAttr(c)}">
      ${c === 'todas' ? 'Todas' : escapeHtml(c)}
    </button>
  `).join('');

  bar.querySelectorAll('.category-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      CATEGORIA_ACTIVA = btn.dataset.cat;
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
  const novedades = PRODUCTOS.filter(p => p.novedad);

  if (!novedades.length) {
    seccion.style.display = 'none';
    return;
  }
  seccion.style.display = '';

  track.innerHTML = novedades.map(p => `
    <article class="novedad-card" data-sku="${escapeAttr(p.sku)}">
      <div class="novedad-photo">
        <img src="${escapeAttr(p.fotos[0])}" alt="${escapeAttr(p.nombre)}" loading="lazy">
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
      ordenado.sort((a, b) => (a.categorias[0] || '').localeCompare(b.categorias[0] || ''));
      break;
    default:
      // 'relevancia' = se deja tal cual viene del Sheet
      break;
  }
  return ordenado;
}

function renderCatalogo() {
  const catalogEl = document.getElementById('catalog');
  const filtrada = PRODUCTOS.filter(p =>
    CATEGORIA_ACTIVA === 'todas' || p.categorias.includes(CATEGORIA_ACTIVA)
  );
  const lista = ordenarLista(filtrada);

  if (!lista.length) {
    catalogEl.innerHTML = `<div class="state-msg">No hay productos en esta categoría todavía.</div>`;
    return;
  }

  catalogEl.innerHTML = lista.map(p => tarjetaProducto(p)).join('');

  catalogEl.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      agregarAlCarrito(btn.dataset.sku);
    });
  });

  catalogEl.querySelectorAll('.product-photos').forEach(el => {
    let idx = 0;
    const imgs = el.querySelectorAll('img');
    const dots = el.querySelectorAll('.photo-dots span');
    if (imgs.length > 1) {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        imgs[idx].classList.remove('active');
        dots[idx] && dots[idx].classList.remove('active');
        idx = (idx + 1) % imgs.length;
        imgs[idx].classList.add('active');
        dots[idx] && dots[idx].classList.add('active');
      });
    }
  });

  catalogEl.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => abrirModal(card.dataset.sku));
  });
}

function tarjetaProducto(p) {
  const enCarrito = CARRITO.some(i => i.sku === p.sku);
  return `
    <article class="product-card" data-sku="${escapeAttr(p.sku)}">
      <div class="product-photos">
        ${p.fotos.map((f, i) => `<img src="${escapeAttr(f)}" alt="${escapeAttr(p.nombre)}" class="${i === 0 ? 'active' : ''}" loading="lazy">`).join('')}
        ${p.fotos.length > 1 ? `<div class="photo-dots">${p.fotos.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>` : ''}
      </div>
      <div class="product-body">
        <div class="product-name">${escapeHtml(p.nombre)}</div>
        <div class="product-sku">SKU ${escapeHtml(p.sku)}</div>
        ${p.descripcion ? `<div class="product-desc">${escapeHtml(p.descripcion)}</div>` : ''}
        ${p.categorias.length ? `<div class="product-tags">${p.categorias.map(c => `<span class="product-tag">${escapeHtml(c)}</span>`).join('')}</div>` : ''}
        <div class="product-footer">
          <span class="product-price">${formatoPrecio(p.precio)}</span>
          <button class="add-btn ${enCarrito ? 'added' : ''}" data-sku="${escapeAttr(p.sku)}">
            ${enCarrito ? 'Agregado ✓' : 'Agregar'}
          </button>
        </div>
      </div>
    </article>
  `;
}

/* ---------------------------------------------
   5b) MODAL DE DETALLE (vista más grande)
--------------------------------------------- */
function abrirModal(sku) {
  const p = PRODUCTOS.find(x => x.sku === sku);
  if (!p) return;

  const contenido = document.getElementById('modalContent');
  contenido.innerHTML = `
    <div class="modal-photos">
      ${p.fotos.map((f, i) => `<img src="${escapeAttr(f)}" alt="${escapeAttr(p.nombre)}" class="${i === 0 ? 'active' : ''}">`).join('')}
      ${p.fotos.length > 1 ? `<div class="photo-dots">${p.fotos.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>` : ''}
    </div>
    <div class="modal-info">
      <h2>${escapeHtml(p.nombre)}</h2>
      <div class="product-sku">SKU ${escapeHtml(p.sku)}</div>
      ${p.categorias.length ? `<div class="product-tags">${p.categorias.map(c => `<span class="product-tag">${escapeHtml(c)}</span>`).join('')}</div>` : ''}
      <p class="modal-desc">${escapeHtml(p.descripcion) || 'Sin descripción.'}</p>
      <div class="modal-footer">
        <span class="product-price">${formatoPrecio(p.precio)}</span>
        <button class="add-btn" id="modalAddBtn" data-sku="${escapeAttr(p.sku)}">
          ${CARRITO.some(i => i.sku === p.sku) ? 'Agregado ✓' : 'Agregar'}
        </button>
      </div>
    </div>
  `;

  const fotosEl = contenido.querySelector('.modal-photos');
  const imgs = fotosEl.querySelectorAll('img');
  const dots = fotosEl.querySelectorAll('.photo-dots span');
  let idx = 0;
  if (imgs.length > 1) {
    fotosEl.addEventListener('click', () => {
      imgs[idx].classList.remove('active');
      dots[idx] && dots[idx].classList.remove('active');
      idx = (idx + 1) % imgs.length;
      imgs[idx].classList.add('active');
      dots[idx] && dots[idx].classList.add('active');
    });
  }

  document.getElementById('modalAddBtn').addEventListener('click', (ev) => {
    agregarAlCarrito(sku);
    ev.target.textContent = 'Agregado ✓';
  });

  document.getElementById('modalOverlay').classList.add('open');
}

function cerrarModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

/* ---------------------------------------------
   5c) COLORES DE FILAMENTO DISPONIBLES
--------------------------------------------- */
async function cargarColores() {
  const grid = document.getElementById('coloresGrid');
  const seccion = document.querySelector('.colores-section');
  if (!grid) return;

  try {
    const res = await fetch(urlCSV(CONFIG.SHEET_COLORES));
    if (!res.ok) throw new Error('No se pudo leer la pestaña de Colores');
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    const colores = parsed.data
      .map(row => ({
        nombre: (row['Color'] || '').trim(),
        foto: resolverFoto((row['Foto'] || '').trim(), CONFIG.CARPETA_COLORES),
        disponible: (row['Disponible'] || 'si').toString().trim().toLowerCase() !== 'no',
      }))
      .filter(c => c.nombre);

    if (!colores.length) {
      seccion.style.display = 'none';
      return;
    }

    grid.innerHTML = colores.map(c => `
      <div class="color-swatch ${c.disponible ? '' : 'agotado'}">
        <img src="${escapeAttr(c.foto)}" alt="${escapeAttr(c.nombre)}" loading="lazy">
        <span class="color-name">${escapeHtml(c.nombre)}</span>
        <span class="color-status">${c.disponible ? 'Disponible' : 'Agotado'}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    // Si no existe la pestaña "Colores" todavía, simplemente se oculta la sección.
    seccion.style.display = 'none';
  }
}

/* ---------------------------------------------
   6) CARRITO
--------------------------------------------- */
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

function agregarAlCarrito(sku) {
  const producto = PRODUCTOS.find(p => p.sku === sku);
  if (!producto) return;

  const item = CARRITO.find(i => i.sku === sku);
  if (item) {
    item.cantidad += 1;
  } else {
    CARRITO.push({
      sku: producto.sku,
      nombre: producto.nombre,
      precio: producto.precio,
      foto: producto.fotos[0],
      cantidad: 1,
    });
  }
  guardarCarrito();
  renderCarrito();
  renderCatalogo();
  abrirCarrito();
}

function cambiarCantidad(sku, delta) {
  const item = CARRITO.find(i => i.sku === sku);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    CARRITO = CARRITO.filter(i => i.sku !== sku);
  }
  guardarCarrito();
  renderCarrito();
  renderCatalogo();
}

function quitarDelCarrito(sku) {
  CARRITO = CARRITO.filter(i => i.sku !== sku);
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
    itemsEl.innerHTML = CARRITO.map(i => `
      <div class="cart-item">
        <img src="${escapeAttr(i.foto)}" alt="${escapeAttr(i.nombre)}">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(i.nombre)}</div>
          <div class="cart-item-sku">SKU ${escapeHtml(i.sku)}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" data-sku="${escapeAttr(i.sku)}" data-delta="-1">–</button>
            <span>${i.cantidad}</span>
            <button class="qty-btn" data-sku="${escapeAttr(i.sku)}" data-delta="1">+</button>
            <button class="cart-remove" data-sku="${escapeAttr(i.sku)}">quitar</button>
          </div>
        </div>
        <div class="cart-item-price">${formatoPrecio(i.precio * i.cantidad)}</div>
      </div>
    `).join('');

    itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => cambiarCantidad(btn.dataset.sku, parseInt(btn.dataset.delta)));
    });
    itemsEl.querySelectorAll('.cart-remove').forEach(btn => {
      btn.addEventListener('click', () => quitarDelCarrito(btn.dataset.sku));
    });
  }

  const total = CARRITO.reduce((a, i) => a + i.precio * i.cantidad, 0);
  totalEl.textContent = formatoPrecio(total);
}

function abrirCarrito() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
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

  try {
    const query = `data=${encodeURIComponent(JSON.stringify({ items, total }))}`;
    const data = await llamarAppsScript(query);

    if (!data.ok) throw new Error(data.error || 'Error al registrar el pedido');

    CARRITO = [];
    guardarCarrito();
    renderCarrito();
    renderCatalogo();
    cerrarCarrito();

    mostrarConfirmacion(data.orderId, total, items);
  } catch (err) {
    console.error(err);
    alert('No se pudo generar el número de orden automáticamente. Revisa la URL de Apps Script en script.js. Tu pedido no se perdió, sigue en el carrito.');
  } finally {
    orderBtn.disabled = false;
    orderBtn.textContent = 'Ordenar por WhatsApp';
  }
}

function mostrarConfirmacion(orderId, total, items) {
  document.getElementById('confirmText').textContent =
    `Tu pedido quedó guardado con el número de orden ${orderId}.`;

  const btn = document.getElementById('confirmWhatsappBtn');
  btn.onclick = () => {
    abrirWhatsApp(orderId, total, items);
    cerrarConfirmacion();
  };

  document.getElementById('confirmOverlay').classList.add('open');
}

function cerrarConfirmacion() {
  document.getElementById('confirmOverlay').classList.remove('open');
}

function abrirWhatsApp(orderId, total, items) {
  const listado = items.map(i => `- ${i.nombre} (SKU: ${i.sku}) x${i.cantidad}`).join('\n');
  const mensaje =
    `¡Hola! Acabo de hacer un pedido con el número de orden (${orderId})\n\n` +
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

    const clase = claseStatus(data.status);
    resultado.innerHTML = `
      <div class="status-card">
        <div class="status-card-top">
          <span class="status-order-id">Orden ${escapeHtml(data.orderId)}</span>
          <span class="status-badge ${clase}">${escapeHtml(data.status)}</span>
        </div>
        <div class="status-detail">
          <strong>Fecha:</strong> ${escapeHtml(data.fecha)}<br>
          <strong>Productos:</strong> ${escapeHtml(data.productos)}<br>
          <strong>Total:</strong> ${formatoPrecio(parseFloat(data.total) || 0)}
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
   9) EVENTOS INICIALES
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

document.getElementById('sortSelect').addEventListener('change', (ev) => {
  ORDEN_ACTIVO = ev.target.value;
  renderCatalogo();
});

document.getElementById('novPrev').addEventListener('click', () => {
  document.getElementById('novedadesTrack').scrollBy({ left: -220, behavior: 'smooth' });
});
document.getElementById('novNext').addEventListener('click', () => {
  document.getElementById('novedadesTrack').scrollBy({ left: 220, behavior: 'smooth' });
});

renderCarrito();
cargarProductos();
cargarColores();
