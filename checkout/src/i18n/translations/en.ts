import type { Translation } from "./pt";

export const en: Translation = {
  // Order Summary
  orderSummary: {
    title: "Order Summary",
    hideTitle: "Hide order summary",
    subtotal: "Subtotal",
    originalSubtotal: "Original subtotal",
    discount: "Discount",
    subtotalWithDiscount: "Subtotal with discount",
    extraProduct: "Extra Product",
    total: "Total",
    save: "Save",
  },

  // Payment Methods
  payment: {
    title: "Payment",
    creditCard: "Credit Card",
    pix: "PIX",
    wallet: "Digital Wallet",
    applePay: "Apple Pay",
    googlePay: "Google Pay",
  },

  // Contact Info
  contact: {
    title: "Contact",
    email: "Email*",
    emailPlaceholder: "youremail@example.com",
    name: "Full name*",
    namePlaceholder: "Your name",
    phone: "Phone",
    phonePlaceholder: "(00) 00000-0000",
  },

  // Address Info
  address: {
    title: "Shipping Address",
    zipCode: "ZIP Code*",
    zipCodePlaceholder: "00000-000",
    street: "Street*",
    streetPlaceholder: "Street name",
    number: "Number*",
    numberPlaceholder: "123",
    complement: "Complement",
    complementPlaceholder: "Apt, suite, etc",
    neighborhood: "Neighborhood*",
    neighborhoodPlaceholder: "Neighborhood name",
    city: "City*",
    cityPlaceholder: "City name",
    state: "State*",
    statePlaceholder: "State",
    country: "Country*",
    countryPlaceholder: "Country",
  },

  // Credit Card Form
  creditCard: {
    cardNumber: "Card number",
    expiry: "MM/YY",
    cvc: "CVV",
    cardholderName: "Name on card",
    cardholderNamePlaceholder: "As it appears on card",
  },

  // PIX
  pix: {
    title: "PIX Payment",
    instruction: "Open your bank app and scan the code below",
    instructions: "Scan the QR Code or copy the PIX code to complete the payment.",
    scanQR: "Scan the QR Code with your bank app",
    copy_button: "Copy PIX code",
    copyCode: "Copy PIX code",
    copied: "Code copied!",
    waiting: "Waiting for payment confirmation...",
    waitingPayment: "Waiting for payment confirmation...",
    success: "Payment confirmed! Redirecting...",
    expired: "Expired",
  },

  // Buttons
  buttons: {
    submit: "Complete purchase",
    submitPix: "Generate PIX",
    processing: "processing payment...",
    continue: "Continue",
    back: "Back",
  },

  // Validation Messages
  validation: {
    required: "This field is required",
    invalidEmail: "Invalid email",
    invalidPhone: "Invalid phone",
    invalidCard: "Invalid card",
  },

  // Success/Error Messages
  messages: {
    success: "Payment Approved!",
    successDescription: "Thank you for your purchase. Details have been sent to your email.",
    error: "An unknown error occurred.",
    pixNotImplemented: "PIX payment not yet implemented.",
    cardElementNotFound: "Card component not found.",
    pixGenerated: "PIX generated successfully!",
    loading: "Loading...",
    redirecting: "Redirecting securely...",
  },

  // Product
  product: {
    quantity: "Quantity",
    price: "Price",
    discount: "% OFF",
  },

  orderBump: {
    action: "Add product",
  },

  notification: {
    purchase: "just purchased",
  },
};
