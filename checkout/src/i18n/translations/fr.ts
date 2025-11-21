import type { Translation } from "./pt";

export const fr: Translation = {
  // Order Summary
  orderSummary: {
    title: "Résumé de la commande",
    hideTitle: "Masquer le résumé de la commande",
    subtotal: "Sous-total",
    originalSubtotal: "Sous-total original",
    discount: "Réduction",
    subtotalWithDiscount: "Sous-total avec réduction",
    extraProduct: "Produit Extra",
    total: "Total",
    save: "Économisez",
  },

  // Payment Methods
  payment: {
    title: "Paiement",
    creditCard: "Carte de crédit",
    pix: "PIX",
  },

  // Contact Info
  contact: {
    title: "Contact",
    email: "E-mail*",
    emailPlaceholder: "votreemail@exemple.com",
    name: "Nom complet*",
    namePlaceholder: "Votre nom",
    phone: "Téléphone",
    phonePlaceholder: "(00) 00000-0000",
  },

  // Address Info
  address: {
    title: "Adresse de Livraison",
    zipCode: "Code Postal*",
    zipCodePlaceholder: "00000-000",
    street: "Rue*",
    streetPlaceholder: "Nom de la rue",
    number: "Numéro*",
    numberPlaceholder: "123",
    complement: "Complément",
    complementPlaceholder: "Appt, bâtiment, etc",
    neighborhood: "Quartier*",
    neighborhoodPlaceholder: "Nom du quartier",
    city: "Ville*",
    cityPlaceholder: "Nom de la ville",
    state: "État*",
    statePlaceholder: "État",
    country: "Pays*",
    countryPlaceholder: "Pays",
  },

  // Credit Card Form
  creditCard: {
    cardNumber: "Numéro de carte",
    expiry: "MM/AA",
    cvc: "CVV",
    cardholderName: "Nom sur la carte",
    cardholderNamePlaceholder: "Tel qu'il apparaît sur la carte",
  },

  // PIX
  pix: {
    title: "Paiement PIX",
    instructions: "Scannez le QR Code ou copiez le code PIX pour finaliser le paiement.",
    scanQR: "Scannez le QR Code avec l'application de votre banque",
    copyCode: "Copier le code PIX",
    copied: "Code copié!",
    waitingPayment: "En attente de confirmation du paiement...",
  },

  // Buttons
  buttons: {
    submit: "Finaliser l'achat",
    submitPix: "Générer PIX",
    processing: "traitement du paiement...",
    continue: "Continuer",
    back: "Retour",
  },

  // Validation Messages
  validation: {
    required: "Ce champ est obligatoire",
    invalidEmail: "E-mail invalide",
    invalidPhone: "Téléphone invalide",
    invalidCard: "Carte invalide",
  },

  // Success/Error Messages
  messages: {
    success: "Paiement Approuvé!",
    successDescription: "Merci pour votre achat. Les détails ont été envoyés à votre e-mail.",
    error: "Une erreur inconnue s'est produite.",
    pixNotImplemented: "Paiement PIX pas encore implémenté.",
    cardElementNotFound: "Composant de carte introuvable.",
    pixGenerated: "PIX généré avec succès!",
    loading: "Chargement...",
    redirecting: "Redirection sécurisée...",
  },

  // Product
  product: {
    quantity: "Quantité",
    price: "Prix",
    discount: "% DE RÉDUCTION",
  },

  orderBump: {
    action: "Ajouter un produit",
  },
};
