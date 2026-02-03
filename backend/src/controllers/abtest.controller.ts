// src/controllers/abtest.controller.ts
import { Request, Response } from "express";
import * as abTestService from "../services/abtest.service";
import { CreateABTestPayload, UpdateABTestPayload } from "../services/abtest.service";

/**
 * Controller para CRIAR um novo teste A/B
 */
export const handleCreateABTest = async (req: Request, res: Response) => {
  try {
    const payload = req.body as CreateABTestPayload;
    const ownerId = req.userId!;

    const abTest = await abTestService.createABTest(payload, ownerId);
    res.status(201).json(abTest);
  } catch (error) {
    res.status(400).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para LISTAR todos os testes A/B do usuário
 */
export const handleListMyABTests = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const tests = await abTestService.listABTestsByOwner(ownerId);
    res.status(200).json(tests);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para BUSCAR um teste A/B por ID
 */
export const handleGetABTestById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.userId!;
    const test = await abTestService.getABTestById(id, ownerId);

    if (!test) {
      return res.status(404).json({ error: { message: "Teste A/B não encontrado ou não pertence a você." } });
    }
    res.status(200).json(test);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para ATUALIZAR um teste A/B
 */
export const handleUpdateABTest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.userId!;
    const payload = req.body as UpdateABTestPayload;

    const test = await abTestService.updateABTest(id, ownerId, payload);

    if (!test) {
      return res.status(404).json({ error: { message: "Teste A/B não encontrado ou não pertence a você." } });
    }
    res.status(200).json(test);
  } catch (error) {
    res.status(400).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para DELETAR um teste A/B
 */
export const handleDeleteABTest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.userId!;

    const deleted = await abTestService.deleteABTest(id, ownerId);

    if (!deleted) {
      return res.status(404).json({ error: { message: "Teste A/B não encontrado ou não pertence a você." } });
    }
    res.status(200).json({ message: "Teste A/B deletado com sucesso." });
  } catch (error) {
    res.status(400).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para DUPLICAR um teste A/B
 */
export const handleDuplicateABTest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.userId!;

    const duplicatedTest = await abTestService.duplicateABTest(id, ownerId);

    if (!duplicatedTest) {
      return res.status(404).json({ error: { message: "Teste A/B não encontrado ou não pertence a você." } });
    }
    res.status(201).json(duplicatedTest);
  } catch (error) {
    res.status(400).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para buscar teste A/B por slug e randomizar oferta (público)
 */
export const handleGetABTestBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";

    const result = await abTestService.getABTestBySlugAndRandomize(slug, ip, userAgent);

    if (!result) {
      return res.status(404).json({ error: { message: "Teste A/B não encontrado ou desativado." } });
    }

    // Cache mais curto para A/B tests já que cada request pode ter resultado diferente
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};

/**
 * Controller para tracking de eventos em A/B tests (público)
 * Usado para registrar "initiate_checkout" quando cliente preenche email
 */
export const handleTrackABTestEvent = async (req: Request, res: Response) => {
  const { abTestId, offerId, type } = req.body;

  // Resposta imediata para não travar o cliente
  res.status(200).send();

  // Processamento async isolado para evitar unhandled rejections
  try {
    if (!abTestId || !offerId || !["initiate_checkout"].includes(type)) {
      return;
    }

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";

    await abTestService.trackABTestEvent(abTestId, offerId, type, ip, userAgent);
  } catch (error) {
    console.error("Erro tracking A/B test:", error);
  }
};
