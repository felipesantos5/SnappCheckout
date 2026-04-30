import type { Translation } from "./pt";

export const de: Translation = {
  // Order Summary
  orderSummary: {
    title: "Bestellübersicht",
    hideTitle: "Bestellübersicht ausblenden",
    subtotal: "Zwischensumme",
    originalSubtotal: "Ursprüngliche Zwischensumme",
    discount: "Rabatt",
    subtotalWithDiscount: "Zwischensumme mit Rabatt",
    extraProduct: "Extra Produkt",
    total: "Gesamt",
    save: "Sparen",
    purchaseDetails: "Bestelldetails",
    hide: "Ausblenden",
    totalToday: "Heute gesamt",
    couponPlaceholder: "Rabattgutschein eingeben",
    apply: "Anwenden",
    remove: "Entfernen",
    youSave: "Sie sparen",
    couponApplied: "Gutschein angewendet",
    subscriptionBadge: "Abonnement",
    interval: {
      day: "/Tag",
      week: "/Woche",
      month: "/Monat",
      year: "/Jahr",
    },
  },

  // Payment Methods
  payment: {
    title: "Zahlungsmethode",
    creditCard: "Kreditkarte",
    pix: "PIX",
    wallet: "Digitale Geldbörse",
    applePay: "Apple Pay",
    googlePay: "Google Pay",
  },

  // Contact Info
  contact: {
    title: "Persönliche Informationen",
    email: "E-Mail*",
    emailPlaceholder: "E-Mail",
    name: "Vollständiger Name*",
    namePlaceholder: "Vollständiger Name",
    phone: "Telefon",
    phonePlaceholder: "Telefon",
  },

  // Address Info
  address: {
    title: "Lieferadresse",
    zipCode: "Postleitzahl*",
    zipCodePlaceholder: "00000",
    street: "Straße*",
    streetPlaceholder: "Straßenname",
    number: "Hausnummer*",
    numberPlaceholder: "123",
    complement: "Zusatz",
    complementPlaceholder: "Wohnung, Etage, usw.",
    neighborhood: "Stadtteil*",
    neighborhoodPlaceholder: "Stadtteilname",
    city: "Stadt*",
    cityPlaceholder: "Stadtname",
    state: "Bundesland*",
    statePlaceholder: "Bundesland",
    country: "Land*",
    countryPlaceholder: "Land",
  },

  // Credit Card Form
  creditCard: {
    cardNumber: "Kartennummer",
    expiry: "MM/JJ",
    cvc: "CVV",
    cardholderName: "Karteninhaber",
    cardholderNamePlaceholder: "Vollständiger Name auf der Karte",
    document: "Dokument",
  },

  // PIX
  pix: {
    title: "PIX-Zahlung",
    instruction: "Öffnen Sie Ihre Banking-App und scannen Sie den Code unten",
    instructions: "Scannen Sie den QR-Code oder kopieren Sie den PIX-Code, um die Zahlung abzuschließen.",
    scanQR: "Scannen Sie den QR-Code mit Ihrer Banking-App",
    copy_button: "PIX-Code kopieren",
    copyCode: "PIX-Code kopieren",
    copied: "Code kopiert!",
    waiting: "Warten auf Zahlungsbestätigung...",
    waitingPayment: "Warten auf Zahlungsbestätigung...",
    success: "Zahlung bestätigt! Weiterleitung...",
    expired: "Abgelaufen",
  },

  // Buttons
  buttons: {
    submit: "ZAHLUNG ABSCHLIESSEN",
    submitPix: "PIX generieren",
    processing: "Zahlung wird verarbeitet...",
    continue: "Weiter",
    back: "Zurück",
    secureTransaction: "Sichere und Verschlüsselte Transaktion",
  },

  // Validation Messages
  validation: {
    required: "Dieses Feld ist erforderlich",
    invalidEmail: "Ungültige E-Mail",
    invalidPhone: "Ungültige Telefonnummer",
    invalidCard: "Ungültige Karte",
  },

  // Success/Error Messages
  messages: {
    success: "Zahlung genehmigt!",
    successDescription: "Vielen Dank für Ihren Einkauf. Die Details wurden an Ihre E-Mail gesendet.",
    error: "Ein unbekannter Fehler ist aufgetreten.",
    pixNotImplemented: "PIX-Zahlung noch nicht implementiert.",
    cardElementNotFound: "Kartenkomponente nicht gefunden.",
    pixGenerated: "PIX erfolgreich generiert!",
    loading: "Wird geladen...",
    redirecting: "Sichere Weiterleitung...",
    fillRequiredFields: "Bitte geben Sie Ihren Namen und Ihre E-Mail ein, um fortzufahren",
  },

  // Product
  product: {
    price: "Preis",
    discount: "% RABATT",
  },

  orderBump: {
    action: "Produkt hinzufügen",
    addedToCart: "Zum Warenkorb hinzugefügt",
  },

  notification: {
    purchase: "hat gerade gekauft",
  },
};
