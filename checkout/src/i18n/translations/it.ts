import type { Translation } from "./pt";

export const it: Translation = {
  // Order Summary
  orderSummary: {
    title: "Riepilogo ordine",
    hideTitle: "Nascondi riepilogo ordine",
    subtotal: "Subtotale",
    originalSubtotal: "Subtotale originale",
    discount: "Sconto",
    subtotalWithDiscount: "Subtotale con sconto",
    extraProduct: "Prodotto Extra",
    total: "Totale",
    save: "Risparmia",
  },

  // Payment Methods
  payment: {
    title: "Pagamento",
    creditCard: "Carta di Credito",
    pix: "PIX",
    wallet: "Portafoglio Digitale",
    applePay: "Apple Pay",
    googlePay: "Google Pay",
  },

  // Contact Info
  contact: {
    title: "Contatto",
    email: "Email*",
    emailPlaceholder: "tuaemail@esempio.com",
    name: "Nome completo*",
    namePlaceholder: "Il tuo nome",
    phone: "Telefono",
    phonePlaceholder: "+39 000 0000000",
  },

  // Address Info
  address: {
    title: "Indirizzo di Consegna",
    zipCode: "CAP*",
    zipCodePlaceholder: "00000",
    street: "Via*",
    streetPlaceholder: "Nome della via",
    number: "Numero civico*",
    numberPlaceholder: "123",
    complement: "Complemento",
    complementPlaceholder: "Interno, scala, ecc.",
    neighborhood: "Quartiere*",
    neighborhoodPlaceholder: "Nome del quartiere",
    city: "Città*",
    cityPlaceholder: "Nome della città",
    state: "Provincia*",
    statePlaceholder: "Provincia",
    country: "Paese*",
    countryPlaceholder: "Paese",
  },

  // Credit Card Form
  creditCard: {
    cardNumber: "Numero della carta",
    expiry: "MM/AA",
    cvc: "CVV",
    cardholderName: "Nome sulla carta",
    cardholderNamePlaceholder: "Come appare sulla carta",
  },

  // PIX
  pix: {
    title: "Pagamento PIX",
    instruction: "Apri l'app della tua banca e scansiona il codice qui sotto",
    instructions: "Scansiona il codice QR o copia il codice PIX per completare il pagamento.",
    scanQR: "Scansiona il codice QR con l'app della tua banca",
    copy_button: "Copia codice PIX",
    copyCode: "Copia codice PIX",
    copied: "Codice copiato!",
    waiting: "In attesa di conferma del pagamento...",
    waitingPayment: "In attesa di conferma del pagamento...",
    success: "Pagamento confermato! Reindirizzamento...",
    expired: "Scaduto",
  },

  // Buttons
  buttons: {
    submit: "Completa acquisto",
    submitPix: "Genera PIX",
    processing: "Elaborazione pagamento...",
    continue: "Continua",
    back: "Indietro",
  },

  // Validation Messages
  validation: {
    required: "Questo campo è obbligatorio",
    invalidEmail: "Email non valida",
    invalidPhone: "Telefono non valido",
    invalidCard: "Carta non valida",
  },

  // Success/Error Messages
  messages: {
    success: "Pagamento Approvato!",
    successDescription: "Grazie per il tuo acquisto. I dettagli sono stati inviati alla tua email.",
    error: "Si è verificato un errore sconosciuto.",
    pixNotImplemented: "Pagamento PIX non ancora implementato.",
    cardElementNotFound: "Componente carta non trovato.",
    pixGenerated: "PIX generato con successo!",
    loading: "Caricamento...",
    redirecting: "Reindirizzamento sicuro...",
    fillRequiredFields: "Compila il tuo nome e la tua email per continuare",
  },

  // Product
  product: {
    price: "Prezzo",
    discount: "% SCONTO",
  },

  orderBump: {
    action: "Aggiungi prodotto",
  },

  notification: {
    purchase: "ha appena acquistato",
  },
};
