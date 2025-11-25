export const es = {
  // Order Summary
  orderSummary: {
    title: "Resumen del pedido",
    hideTitle: "Ocultar resumen del pedido",
    subtotal: "Subtotal",
    originalSubtotal: "Subtotal original",
    discount: "Descuento",
    subtotalWithDiscount: "Subtotal con descuento",
    extraProduct: "Producto Extra",
    total: "Total",
    save: "Ahorre",
  },

  // Payment Methods
  payment: {
    title: "Pago",
    creditCard: "Tarjeta de Crédito",
    pix: "PIX",
    wallet: "Cartera Digital",
    applePay: "Apple Pay",
    googlePay: "Google Pay",
  },

  // Contact Info
  contact: {
    title: "Contacto",
    email: "Correo electrónico*",
    emailPlaceholder: "tucorreo@ejemplo.com",
    name: "Nombre completo*",
    namePlaceholder: "Tu nombre",
    phone: "Teléfono",
    phonePlaceholder: "+34 000 000 000",
  },

  // Address Info
  address: {
    title: "Dirección de Entrega",
    zipCode: "Código Postal*",
    zipCodePlaceholder: "00000",
    street: "Calle*",
    streetPlaceholder: "Nombre de la calle",
    number: "Número*",
    numberPlaceholder: "123",
    complement: "Complemento",
    complementPlaceholder: "Piso, puerta, etc",
    neighborhood: "Barrio*",
    neighborhoodPlaceholder: "Nombre del barrio",
    city: "Ciudad*",
    cityPlaceholder: "Nombre de la ciudad",
    state: "Provincia/Estado*",
    statePlaceholder: "Provincia",
    country: "País*",
    countryPlaceholder: "España",
  },

  // Credit Card Form
  creditCard: {
    cardNumber: "Número de tarjeta",
    expiry: "MM/AA",
    cvc: "CVV",
    cardholderName: "Nombre en la tarjeta",
    cardholderNamePlaceholder: "Como aparece en la tarjeta",
  },

  // PIX
  pix: {
    title: "Pago vía PIX",
    instructions: "Escanee el código QR o copie el código PIX para finalizar el pago.",
    scanQR: "Escanee el código QR con la app de tu banco",
    copyCode: "Copiar código PIX",
    copied: "¡Código copiado!",
    waitingPayment: "Esperando confirmación del pago...",
  },

  // Buttons
  buttons: {
    submit: "Finalizar compra",
    submitPix: "Generar PIX",
    processing: "Procesando pago...",
    continue: "Continuar",
    back: "Volver",
  },

  // Validation Messages
  validation: {
    required: "Este campo es obligatorio",
    invalidEmail: "Correo electrónico inválido",
    invalidPhone: "Teléfono inválido",
    invalidCard: "Tarjeta inválida",
  },

  // Success/Error Messages
  messages: {
    success: "¡Pago Aprobado!",
    successDescription: "Gracias por tu compra. Los detalles han sido enviados a tu correo electrónico.",
    error: "Ocurrió un error desconocido.",
    pixNotImplemented: "Pago con PIX aún no implementado.",
    cardElementNotFound: "Componente de tarjeta no encontrado.",
    pixGenerated: "¡PIX generado con éxito!",
    loading: "Cargando...",
    redirecting: "Redirigiendo de forma segura...",
  },

  // Product
  product: {
    quantity: "Cantidad",
    price: "Precio",
    discount: "% DE DESCUENTO",
  },

  orderBump: {
    action: "Añadir producto",
  },
};

export type Translation = typeof es;
