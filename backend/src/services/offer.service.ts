// src/services/offer.service.ts
import Offer, { IOffer, IProductSubDocument } from "../models/offer.model";
import Sale from "../models/sale.model";
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
    transformed.discountPercentage = Math.round(((product.compareAtPriceInCents - product.priceInCents) / product.compareAtPriceInCents) * 100);
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
  backgroundColor?: string;
  textColor?: string;
  collectAddress?: boolean;
  collectPhone?: boolean;
  collectDocument?: boolean;
  language?: string;
  upsellLink?: string;
  paypalEnabled: boolean;
  pagarme_pix_enabled: boolean;
  stripe_card_enabled: boolean;
  utmfyWebhookUrl?: string;
  facebookPixelId?: string;
  facebookAccessToken?: string;
  thankYouPageUrl?: string;
  backRedirectUrl?: string;
  autoNotifications?: {
    enabled: boolean;
    genderFilter: 'all' | 'male' | 'female';
    region: 'pt' | 'en' | 'es' | 'fr';
    intervalSeconds: number;
    soundEnabled: boolean;
  };
  customDomain?: string; // Domínio customizado para a oferta
  upsell?: {
    enabled: boolean;
    name: string;
    price: number;
    redirectUrl: string;
  };
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
export const listOffersByOwner = async (ownerId: string, archived?: boolean): Promise<any[]> => {
  try {
    // --- MUDANÇA PRINCIPAL ---
    // Removemos o .populate() daqui também
    // O campo 'mainProduct' já contém o objeto com nome e preço
    const filter: any = { ownerId };

    // Filtra por arquivadas ou não arquivadas (padrão: não arquivadas)
    if (archived === true) {
      filter.archived = true;
    } else if (archived === false || archived === undefined) {
      filter.archived = { $ne: true };
    }

    const offers = await Offer.find(filter).sort({ createdAt: -1 });

    // Para cada oferta, busca o número de vendas
    const offersWithSalesCount = await Promise.all(
      offers.map(async (offer) => {
        const salesCount = await Sale.countDocuments({
          offerId: offer._id,
          status: "succeeded", // Conta apenas vendas bem-sucedidas
        });

        return {
          ...offer.toObject(),
          salesCount,
          checkoutStarted: offer.checkoutStarted || 0, // Inclui o contador de checkout iniciado
        };
      })
    );

    return offersWithSalesCount;
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

/**
 * Deleta uma oferta existente.
 */
export const deleteOffer = async (id: string, ownerId: string): Promise<boolean> => {
  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return false;
    }

    const result = await Offer.deleteOne({
      _id: id,
      ownerId: ownerId, // Garante que o usuário é o dono
    });

    return result.deletedCount > 0;
  } catch (error) {
    throw new Error(`Falha ao deletar oferta: ${(error as Error).message}`);
  }
};

/**
 * Duplica uma oferta existente
 */
export const duplicateOffer = async (id: string, ownerId: string): Promise<IOffer | null> => {
  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return null;
    }

    // Busca a oferta original
    const originalOffer = await Offer.findOne({ _id: id, ownerId: ownerId });

    if (!originalOffer) {
      return null;
    }

    // Cria uma cópia da oferta
    const offerCopy = originalOffer.toObject() as any;

    // Remove campos que não devem ser duplicados
    delete offerCopy._id;
    delete offerCopy.__v;
    delete offerCopy.createdAt;
    delete offerCopy.updatedAt;

    // Gera novo slug único
    offerCopy.slug = generateSlug();

    // Adiciona " (Cópia)" ao nome
    offerCopy.name = `${offerCopy.name} (Cópia)`;

    // Remove IDs dos subdocumentos (mainProduct e orderBumps)
    if (offerCopy.mainProduct) {
      delete offerCopy.mainProduct._id;
    }

    if (offerCopy.orderBumps && offerCopy.orderBumps.length > 0) {
      offerCopy.orderBumps = offerCopy.orderBumps.map((bump: any) => {
        const bumpCopy = { ...bump };
        delete bumpCopy._id;
        return bumpCopy;
      });
    }

    // Cria a nova oferta
    const duplicatedOffer = await Offer.create(offerCopy);

    return duplicatedOffer;
  } catch (error) {
    throw new Error(`Falha ao duplicar oferta: ${(error as Error).message}`);
  }
};

/**
 * Arquiva uma oferta
 */
export const archiveOffer = async (id: string, ownerId: string): Promise<IOffer | null> => {
  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return null;
    }

    const offer = await Offer.findOneAndUpdate(
      { _id: id, ownerId: ownerId },
      { archived: true },
      { new: true }
    );

    return offer;
  } catch (error) {
    throw new Error(`Falha ao arquivar oferta: ${(error as Error).message}`);
  }
};

/**
 * Desarquiva uma oferta
 */
export const unarchiveOffer = async (id: string, ownerId: string): Promise<IOffer | null> => {
  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return null;
    }

    const offer = await Offer.findOneAndUpdate(
      { _id: id, ownerId: ownerId },
      { archived: false },
      { new: true }
    );

    return offer;
  } catch (error) {
    throw new Error(`Falha ao desarquivar oferta: ${(error as Error).message}`);
  }
};

/**
 * Toggle status ativo/inativo de uma oferta
 */
export const toggleOfferActive = async (id: string, ownerId: string): Promise<IOffer | null> => {
  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return null;
    }

    // Busca a oferta atual para pegar o estado atual
    const currentOffer = await Offer.findOne({ _id: id, ownerId: ownerId });

    if (!currentOffer) {
      return null;
    }

    // Toggle do valor atual
    const offer = await Offer.findOneAndUpdate(
      { _id: id, ownerId: ownerId },
      { isActive: !currentOffer.isActive },
      { new: true }
    );

    return offer;
  } catch (error) {
    throw new Error(`Falha ao alterar status da oferta: ${(error as Error).message}`);
  }
};

/**
 * Incrementa o contador de checkout iniciado
 */
export const incrementCheckoutStarted = async (offerId: string): Promise<boolean> => {
  try {
    if (!offerId.match(/^[0-9a-fA-F]{24}$/)) {
      return false;
    }

    const result = await Offer.updateOne({ _id: offerId }, { $inc: { checkoutStarted: 1 } });

    return result.modifiedCount > 0;
  } catch (error) {
    throw new Error(`Falha ao incrementar checkoutStarted: ${(error as Error).message}`);
  }
};
