// src/services/offer.service.ts
import Offer, { IOffer, IProductSubDocument } from "../models/offer.model";
// O model 'Product' não é mais necessário aqui
import { customAlphabet } from "nanoid";

const generateSlug = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 16);

/**
 * Transforma um produto para incluir originalPriceInCents e discountPercentage
 * Esses campos são calculados a partir do compareAtPriceInCents
 */
const transformProductForFrontend = (product: IProductSubDocument) => {
  const transformed: any = { ...product };

  if (product.compareAtPriceInCents && product.compareAtPriceInCents > product.priceInCents) {
    transformed.originalPriceInCents = product.compareAtPriceInCents;
    transformed.discountPercentage = Math.round(
      ((product.compareAtPriceInCents - product.priceInCents) / product.compareAtPriceInCents) * 100
    );
  }

  return transformed;
};

/**
 * Transforma uma oferta completa para o formato esperado pelo frontend
 */
const transformOfferForFrontend = (offer: IOffer) => {
  const offerObj = offer.toObject();

  return {
    ...offerObj,
    mainProduct: transformProductForFrontend(offerObj.mainProduct),
    orderBumps: offerObj.orderBumps.map(transformProductForFrontend),
  };
};

// O 'slug' SAI do payload de criação
export type CreateOfferPayload = {
  name: string;
  bannerImageUrl?: string;
  mainProduct: any; // Recebe o objeto
  orderBumps: any[]; // Recebe o array de objetos
  currency: string;
  primaryColor?: string;
  buttonColor?: string;
};

export type UpdateOfferPayload = Partial<CreateOfferPayload>;

/**
 * Cria uma nova Oferta (link de checkout)
 */
export const createOffer = async (payload: CreateOfferPayload, ownerId: string): Promise<IOffer> => {
  try {
    let newSlug = generateSlug();
    let existingSlug = await Offer.findOne({ slug: newSlug });

    while (existingSlug) {
      newSlug = generateSlug();
      existingSlug = await Offer.findOne({ slug: newSlug });
    }

    const offer = new Offer({
      ...payload,
      ownerId,
      slug: newSlug,
    });

    // O Mongoose vai validar o payload.mainProduct e payload.orderBumps
    // contra o productSubSchema definido no model
    await offer.save();
    return offer;
  } catch (error) {
    // O erro que você viu foi pego aqui
    console.error("Erro detalhado ao salvar oferta:", (error as Error).message);
    throw new Error(`Falha ao criar oferta: ${(error as Error).message}`);
  }
};

/**
 * Busca os dados de uma oferta pelo SLUG (rota pública)
 */
export const getOfferBySlug = async (slug: string): Promise<any> => {
  try {
    // --- MUDANÇA PRINCIPAL ---
    // Adicione .populate() para buscar o stripeAccountId do dono
    const offer = await Offer.findOne({ slug }).populate({
      path: "ownerId",
      select: "stripeAccountId", // Selecione APENAS o campo que precisamos
    });

    if (!offer) {
      return null;
    }

    // Transforma a oferta para incluir originalPriceInCents e discountPercentage
    return transformOfferForFrontend(offer);
  } catch (error) {
    throw new Error("Falha ao buscar oferta.");
  }
};

/**
 * Lista todas as ofertas de um usuário (para o dashboard)
 */
export const listOffersByOwner = async (ownerId: string): Promise<IOffer[]> => {
  try {
    // --- MUDANÇA PRINCIPAL ---
    // Removemos o .populate() daqui também
    // O campo 'mainProduct' já contém o objeto com nome e preço
    const offers = await Offer.find({ ownerId }).sort({ createdAt: -1 });

    return offers;
  } catch (error) {
    throw new Error("Falha ao listar ofertas.");
  }
};

export const getOfferById = async (id: string, ownerId: string): Promise<any> => {
  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      // Valida se é um ID do Mongoose
      return null;
    }
    const offer = await Offer.findOne({
      _id: id,
      ownerId: ownerId, // Garante que o usuário é o dono
    });

    if (!offer) {
      return null;
    }

    // Transforma a oferta para incluir originalPriceInCents e discountPercentage
    return transformOfferForFrontend(offer);
  } catch (error) {
    throw new Error("Falha ao buscar oferta por ID.");
  }
};

// --- FUNÇÃO NOVA ADICIONADA AQUI ---
/**
 * Atualiza uma oferta existente.
 */
export const updateOffer = async (id: string, ownerId: string, payload: UpdateOfferPayload): Promise<any> => {
  try {
    // 1. Encontra a oferta (garantindo a posse)
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return null;
    }

    const offer = await Offer.findOne({
      _id: id,
      ownerId: ownerId,
    });

    if (!offer) {
      return null; // Ou lançar um erro de "Não encontrado"
    }

    // 2. Atualiza os campos
    // 'set' é um método do Mongoose que atualiza o documento
    // com os novos valores do payload.
    offer.set(payload);

    // 3. Salva o documento atualizado
    await offer.save();

    // 4. Retorna a oferta transformada
    return transformOfferForFrontend(offer);
  } catch (error) {
    throw new Error(`Falha ao atualizar oferta: ${(error as Error).message}`);
  }
};
