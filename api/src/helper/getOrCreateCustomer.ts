import stripe from "../lib/stripe";

export const getOrCreateCustomer = async (stripeAccountId: string, email: string, name: string, phone: string): Promise<string> => {
  // Busca se já existe cliente com esse email na conta conectada
  const existingCustomers = await stripe.customers.list({ email, limit: 1 }, { stripeAccount: stripeAccountId });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Cria novo cliente na conta conectada
  const newCustomer = await stripe.customers.create({ email, name, phone }, { stripeAccount: stripeAccountId });

  return newCustomer.id;
};
