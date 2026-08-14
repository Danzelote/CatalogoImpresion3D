/* ============================================
   San Pedro 3D — Configuración
   ============================================
   ESTE es el único archivo que necesitas editar con tus datos.
   Cuando te comparta actualizaciones de script.js por nuevas funciones,
   este archivo NO se toca — lo subes una sola vez y ya.
   ============================================ */

const CONFIG = {
  // ID del Google Sheet (está en la URL: .../d/ESTE_ID/edit)
  SHEET_ID: 'TU_SHEET_ID_AQUI',

  // Nombres exactos de las pestañas
  SHEET_PRODUCTOS: 'Productos',
  SHEET_COLORES: 'Colores',

  // URL del Apps Script publicado como Web App (ver README)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec',

  // Número de WhatsApp donde llegan los pedidos y las dudas de contacto,
  // con código de país, solo dígitos (ej. México: 52 + 10 dígitos)
  WHATSAPP_NUMBER: '5215512345678',

  // Mensaje predeterminado del botón flotante de contacto (dudas generales,
  // no pedidos — esos usan su propio mensaje con número de orden)
  WHATSAPP_MENSAJE_CONTACTO: '¡Hola! Vi tu catálogo de impresiones 3D y tengo unas dudas.',

  // Símbolo/formato de moneda
  MONEDA: 'MXN',

  // Cuántos productos se muestran por página en el catálogo antes de
  // pasar a "Siguiente".
  PRODUCTOS_POR_PAGINA: 12,

  // Nombre de la tienda que se muestra junto al logo en el encabezado.
  // OJO: esto NO cambia el título de la pestaña del navegador ni lo que
  // sale al compartir el link — eso vive directo en index.html (<title>
  // y las etiquetas og:) porque las lee un "robot" que no ejecuta este
  // script. Si cambias el nombre aquí, actualízalo también allá.
  NOMBRE_TIENDA: 'San Pedro 3D',

  // URL de la imagen de tu logotipo (Drive o cualquier URL completa).
  // Si la dejas vacía, solo se muestra el texto "Catálogo 3D".
  LOGO_URL: '',

  // URL de una imagen de banner horizontal para el encabezado (Drive o
  // cualquier URL completa). Si la llenas, se muestra esa imagen en vez
  // del texto de abajo. Si la dejas vacía, se sigue viendo el texto.
  BANNER_URL: '',

  // Textos del encabezado — edítalos las veces que quieras sin tocar HTML.
  DESCRIPCION_SITIO: 'Piezas impresas en 3D, listas para recoger — no vendemos archivos STL.',
  MENSAJE_MATERIAL: 'Todas las piezas se imprimen en PLA. ¿Necesitas otro material? Se cotiza aparte por WhatsApp.',
  MENSAJE_ENVIO: 'Por ahora no hacemos envíos a domicilio: coordinamos un punto de recolección en CDMX.',
};
