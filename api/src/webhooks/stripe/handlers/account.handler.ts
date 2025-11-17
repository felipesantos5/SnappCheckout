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
    console.log(`\n${"=".repeat(80)}`);
    console.log(`👤 WEBHOOK 'account.updated' RECEBIDO`);
    console.log(`${"=".repeat(80)}`);
    console.log(`🆔 Stripe Account ID: ${account.id}`);
    console.log(`📧 Email da Conta: ${account.email}`);

    // O campo 'charges_enabled' é o indicador definitivo de que
    // o onboarding foi concluído e a conta pode receber pagamentos.
    const isOnboardingComplete = account.charges_enabled === true;

    if (!isOnboardingComplete) {
      console.log(`⏳ Onboarding ainda pendente para ${account.id}. Status: charges_enabled=false.`);
      console.log(`${"=".repeat(80)}\n`);
      return;
    }

    console.log(`✅ Onboarding completo! Conta ${account.id} está apta para cobranças.`);

    // 1. Encontra o usuário no seu banco de dados
    const user = await User.findOne({ stripeAccountId: account.id });

    if (!user) {
      console.warn(`⚠️ Usuário com stripeAccountId ${account.id} não encontrado no banco de dados.`);
      console.log(`${"=".repeat(80)}\n`);
      return;
    }

    // 2. Verifica se já está marcado como completo (idempotência)
    if (user.stripeOnboardingComplete) {
      console.log(`ℹ️ Usuário ${user.email} já estava marcado como completo no DB. Nada a fazer.`);
      console.log(`${"=".repeat(80)}\n`);
      return;
    }

    // 3. Atualiza o usuário no banco
    console.log(`💾 Atualizando usuário ${user.email} no banco de dados...`);
    user.stripeOnboardingComplete = true;
    await user.save();

    console.log(`🎉 Usuário ${user.email} atualizado com sucesso!`);
    console.log(`${"=".repeat(80)}\n`);
  } catch (error: any) {
    console.error(`\n❌ ERRO AO PROCESSAR 'account.updated'!`);
    console.error(`Erro: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error(`${"=".repeat(80)}\n`);
    throw error; // Re-lança o erro para que o Stripe tente novamente
  }
};
