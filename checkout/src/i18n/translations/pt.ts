export const pt = {
  // Order Summary
  orderSummary: {
    title: "Resumo do pedido",
    hideTitle: "Ocultar resumo do pedido",
    subtotal: "Subtotal",
    originalSubtotal: "Subtotal original",
    discount: "Desconto",
    subtotalWithDiscount: "Subtotal com desconto",
    extraProduct: "Produto Extra",
    total: "Total",
    save: "Economize",
  },

  // Payment Methods
  payment: {
    title: "Pagamento",
    creditCard: "Cartão de Crédito",
    pix: "PIX",
    wallet: "Carteira Digital",
    applePay: "Apple Pay",
    googlePay: "Google Pay",
  },

  // Contact Info
  contact: {
    title: "Contato",
    email: "E-mail*",
    emailPlaceholder: "seuemail@exemplo.com",
    name: "Nome completo*",
    namePlaceholder: "Seu nome",
    phone: "Celular",
    phonePlaceholder: "(00) 00000-0000",
  },

  // Address Info
  address: {
    title: "Endereço de Entrega",
    zipCode: "CEP*",
    zipCodePlaceholder: "00000-000",
    street: "Rua*",
    streetPlaceholder: "Nome da rua",
    number: "Número*",
    numberPlaceholder: "123",
    complement: "Complemento",
    complementPlaceholder: "Apto, bloco, etc",
    neighborhood: "Bairro*",
    neighborhoodPlaceholder: "Nome do bairro",
    city: "Cidade*",
    cityPlaceholder: "Nome da cidade",
    state: "Estado*",
    statePlaceholder: "UF",
    country: "País*",
    countryPlaceholder: "Brasil",
  },

  // Credit Card Form
  creditCard: {
    cardNumber: "Número do cartão",
    expiry: "MM/AA",
    cvc: "CVV",
    cardholderName: "Nome impresso no cartão",
    cardholderNamePlaceholder: "Como está no cartão",
  },

  // PIX
  pix: {
    title: "Pagamento via PIX",
    instruction: "Abra o app do seu banco e escaneie o código abaixo",
    instructions: "Escaneie o QR Code ou copie o código PIX para finalizar o pagamento.",
    scanQR: "Escaneie o QR Code com o app do seu banco",
    copy_button: "Copiar código copia e cola",
    copyCode: "Copiar código PIX",
    copied: "Código copiado!",
    waiting: "Aguardando confirmação do pagamento...",
    waitingPayment: "Aguardando confirmação do pagamento...",
    success: "Pagamento confirmado! Redirecionando...",
    expired: "Expirado",
  },

  // Buttons
  buttons: {
    submit: "Finalizar compra",
    submitPix: "Gerar PIX",
    processing: "Processando pagamento...",
    continue: "Continuar",
    back: "Voltar",
  },

  // Validation Messages
  validation: {
    required: "Este campo é obrigatório",
    invalidEmail: "E-mail inválido",
    invalidPhone: "Telefone inválido",
    invalidCard: "Cartão inválido",
  },

  // Success/Error Messages
  messages: {
    success: "Pagamento Aprovado!",
    successDescription: "Obrigado pela sua compra. Os detalhes foram enviados para o seu e-mail.",
    error: "Ocorreu um erro desconhecido.",
    pixNotImplemented: "Pagamento com PIX ainda não implementado.",
    cardElementNotFound: "Componente do cartão não encontrado.",
    pixGenerated: "PIX gerado com sucesso!",
    loading: "Carregando...",
    redirecting: "Redirecionando com segurança...",
  },

  // Product
  product: {
    price: "Preço",
    discount: "% OFF",
  },

  orderBump: {
    action: "Adicionar produto",
  },

  notification: {
    purchase: "acabou de comprar",
  },
};

export type Translation = typeof pt;
