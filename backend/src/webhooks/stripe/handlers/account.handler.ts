// api/src/webhooks/stripe/handlers/account.handler.ts
import { Stripe } from "stripe";
import User from "../../../models/user.model";

/**
 * Handler para o evento 'account.updated'
 * 1. Recebe o objeto da conta conectada
 * 2. Verifica se a conta está apta a receber cobranças
 * 3. Atualiza o status de onboarding no banco de dados local
 */
export const handleAccountUpdated = async (account: Stripe.Account): Promise<void> => {
  try {

    // O campo 'charges_enabled' é o indicador definitivo de que
    // o onboarding foi concluído e a conta pode receber pagamentos.
    const isOnboardingComplete = account.charges_enabled === true;

    if (!isOnboardingComplete) {
      return;
    }


    // 1. Encontra o usuário no seu banco de dados
    const user = await User.findOne({ stripeAccountId: account.id });

    if (!user) {
      console.warn(`⚠️ Usuário com stripeAccountId ${account.id} não encontrado no banco de dados.`);
      return;
    }

    // 2. Verifica se já está marcado como completo (idempotência)
    if (user.stripeOnboardingComplete) {
      return;
    }

    // 3. Atualiza o usuário no banco
    user.stripeOnboardingComplete = true;
    await user.save();

  } catch (error: any) {
    console.error(`\n❌ ERRO AO PROCESSAR 'account.updated'!`);
    console.error(`Erro: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error(`${"=".repeat(80)}\n`);
    throw error; // Re-lança o erro para que o Stripe tente novamente
  }
};
