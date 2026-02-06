// src/controllers/settings.controller.ts
import { Request, Response } from "express";
import User from "../models/user.model";
import { encrypt, decrypt, isEncrypted } from "../helper/encryption";
import { createPagarMeService } from "../services/pagarme.service";

export const getSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await User.findById(userId)
      .select("+paypalClientSecret +pagarme_api_key +pagarme_encryption_key");
    
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Desencripta as credenciais da Pagar.me se existirem
    let pagarmeApiKey = "";
    let pagarmeEncryptionKey = "";

    if (user.pagarme_api_key && isEncrypted(user.pagarme_api_key)) {
      try {
        pagarmeApiKey = decrypt(user.pagarme_api_key);
      } catch (error) {
        console.error("[Settings] Erro ao desencriptar pagarme_api_key");
      }
    }

    if (user.pagarme_encryption_key && isEncrypted(user.pagarme_encryption_key)) {
      try {
        pagarmeEncryptionKey = decrypt(user.pagarme_encryption_key);
      } catch (error) {
        console.error("[Settings] Erro ao desencriptar pagarme_encryption_key");
      }
    }

    res.status(200).json({
      paypalClientId: user.paypalClientId || "",
      paypalClientSecret: user.paypalClientSecret || "",
      pagarme_api_key: pagarmeApiKey,
      pagarme_encryption_key: pagarmeEncryptionKey,
      automaticNotifications: user.automaticNotifications ?? false,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { 
      paypalClientId, 
      paypalClientSecret, 
      pagarme_api_key,
      pagarme_encryption_key,
      automaticNotifications 
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Atualiza PayPal
    if (paypalClientId !== undefined) {
      user.paypalClientId = paypalClientId;
    }
    if (paypalClientSecret !== undefined) {
      user.paypalClientSecret = paypalClientSecret;
    }

    // Atualiza Pagar.me com validação e encriptação
    if (pagarme_api_key !== undefined || pagarme_encryption_key !== undefined) {
      const newApiKey = pagarme_api_key !== undefined ? pagarme_api_key : 
        (user.pagarme_api_key ? decrypt(user.pagarme_api_key) : "");
      
      const newEncryptionKey = pagarme_encryption_key !== undefined ? pagarme_encryption_key : 
        (user.pagarme_encryption_key ? decrypt(user.pagarme_encryption_key) : "");

      // Se ambas as chaves foram fornecidas, valida antes de salvar
      if (newApiKey && newEncryptionKey) {
        try {
          const pagarmeService = createPagarMeService(newApiKey, newEncryptionKey);
          const isValid = await pagarmeService.validateCredentials();

          if (!isValid) {
            return res.status(400).json({ 
              error: "Credenciais da Pagar.me inválidas. Verifique suas chaves." 
            });
          }

        } catch (error: any) {
          console.error("[Settings] Erro ao validar credenciais Pagar.me:", error);
          return res.status(400).json({ 
            error: "Não foi possível validar as credenciais da Pagar.me. Verifique se estão corretas." 
          });
        }
      }

      // Encripta e salva as credenciais
      if (pagarme_api_key !== undefined) {
        user.pagarme_api_key = pagarme_api_key ? encrypt(pagarme_api_key) : "";
      }
      if (pagarme_encryption_key !== undefined) {
        user.pagarme_encryption_key = pagarme_encryption_key ? encrypt(pagarme_encryption_key) : "";
      }
    }

    // Atualiza notificações automáticas
    if (automaticNotifications !== undefined) {
      user.automaticNotifications = automaticNotifications;
    }

    await user.save();

    res.status(200).json({ message: "Configurações atualizadas com sucesso." });
  } catch (error: any) {
    console.error("[Settings] Erro ao atualizar configurações:", error);
    res.status(500).json({ error: error.message });
  }
};
