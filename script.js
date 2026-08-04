/* ============================================
   Catálogo 3D — lógica de la app
   ============================================ */

/* ---------------------------------------------
   1) CONFIGURACIÓN — esto es lo único que
   normalmente necesitas editar.
--------------------------------------------- */
const CONFIG = {
  // ID del Google Sheet (está en la URL: .../d/ESTE_ID/edit)
  SHEET_ID: '1wyY5BBbm5ZJBYXs93H21l_2tRvCrYmWrbX_RLUrZjzs',

  // Nombre exacto de la pestaña de productos
  SHEET_PRODUCTOS: 'Productos',

  // Nombre exacto de la pestaña de colores de filamento disponibles
  SHEET_COLORES: 'Colores',

  // URL del Apps Script publicado como Web App (ver README)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyx2v7w4F13VmmqHiU8GIDr1yto5ZwmPSiIOWoTPbVYBnz4Buxxvgses-23y-EzuZI/exec',

  // Número de WhatsApp donde llegan los pedidos, con código de país,
  // solo dígitos (ej. México: 52 + 10 dígitos)
  WHATSAPP_NUMBER: '525531605449',

  // Símbolo/formato de moneda
  MONEDA: 'MXN',

  // Carpeta donde subes las fotos de productos dentro del repo
  CARPETA_FOTOS: 'fotos/',

  // Carpeta donde subes las fotos de los carretes de colores
  CARPETA_COLORES: 'ColoresFilamentos/',
};

/* ---------------------------------------------
   2) ESTADO
--------------------------------------------- */
let PRODUCTOS = [];
let CATEGORIA_ACTIVA = 'todas';
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
      .filter(p => p.nombre && p.activo !== false);

    renderCategorias();
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
  };
}

// Si en el Sheet pusiste solo el nombre del archivo (ej. "dragon.jpg"),
// lo resuelve a la carpeta indicada del repo. Si ya pusiste una URL completa
// (http...), la deja igual.
function resolverFoto(valor, carpeta = CONFIG.CARPETA_FOTOS) {
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
   5) RENDER DEL CATÁLOGO
--------------------------------------------- */
function renderCatalogo() {
  const catalogEl = document.getElementById('catalog');
  const lista = PRODUCTOS.filter(p =>
    CATEGORIA_ACTIVA === 'todas' || p.categorias.includes(CATEGORIA_ACTIVA)
  );

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
--------------------------------------------- */
async function ordenar() {
  if (!CARRITO.length) return;

  const orderBtn = document.getElementById('orderBtn');
  orderBtn.disabled = true;
  orderBtn.textContent = 'Generando pedido…';

  const total = CARRITO.reduce((a, i) => a + i.precio * i.cantidad, 0);

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      // text/plain evita el preflight CORS que Apps Script no maneja bien
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ items: CARRITO, total }),
    });
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || 'Error al registrar el pedido');

    abrirWhatsApp(data.orderId, total);

    CARRITO = [];
    guardarCarrito();
    renderCarrito();
    renderCatalogo();
    cerrarCarrito();
  } catch (err) {
    console.error(err);
    alert('No se pudo generar el número de orden automáticamente. Revisa la URL de Apps Script en script.js. Tu pedido no se perdió, sigue en el carrito.');
  } finally {
    orderBtn.disabled = false;
    orderBtn.textContent = 'Ordenar por WhatsApp';
  }
}

function abrirWhatsApp(orderId, total) {
  const listado = CARRITO.map(i => `- ${i.nombre} (SKU: ${i.sku}) x${i.cantidad}`).join('\n');
  const mensaje =
    `Hola, me gustaría realizar un pedido con el número de orden ${orderId}\n\n` +
    `${listado}\n\n` +
    `Total: ${formatoPrecio(total)}`;

  const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
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

renderCarrito();
cargarProductos();
cargarColores();
