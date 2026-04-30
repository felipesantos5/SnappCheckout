// src/models/user.model.ts
import mongoose, { Schema, Document, model, Model } from "mongoose";
import bcrypt from "bcrypt";

// Interface para o documento (para tipagem)
export interface IPaypalBilling {
  trialStartDate: Date | null;
  status: "trial" | "active" | "blocked";
  currentCycleStart: Date | null;
  currentCycleEnd: Date | null;
  lastPaymentDate: Date | null;
  lastChargeAmountInCents: number;
  pendingFeeInCents: number;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  stripeAccountId?: string;
  stripeOnboardingComplete: boolean;
  paypalClientId?: string;
  paypalClientSecret?: string;
  pagarme_api_key?: string;
  pagarme_encryption_key?: string;
  automaticNotifications: boolean;
  acknowledgedMilestones: string[];
  // SMTP para envio de emails
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  // PayPal Billing
  paypalBilling: IPaypalBilling;
  // Métodos
  comparePassword(password: string): Promise<boolean>;
}

// Schema do Mongoose
const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      // Nunca armazene a senha em texto puro
      type: String,
      required: true,
      select: false, // Não retorna o hash por padrão nas buscas
    },

    // --- NOVOS CAMPOS STRIPE CONNECT ---
    stripeAccountId: {
      type: String,
      unique: true,
      sparse: true, // Permite 'null' serem únicos
    },
    stripeOnboardingComplete: {
      type: Boolean,
      default: false, // Começa como falso
    },

    // --- NOVOS CAMPOS PAYPAL ---
    paypalClientId: {
      type: String,
      default: "",
    },
    paypalClientSecret: {
      type: String,
      default: "",
      select: false, // Não retorna por padrão por segurança
    },

    // --- NOVOS CAMPOS PAGAR.ME ---
    pagarme_api_key: {
      type: String,
      default: "",
      select: false, // Não retorna por padrão por segurança
    },
    pagarme_encryption_key: {
      type: String,
      default: "",
      select: false, // Não retorna por padrão por segurança
    },

    // --- NOVO CAMPO NOTIFICAÇÕES ---
    automaticNotifications: {
      type: Boolean,
      default: false,
    },

    // --- MILESTONES DE FATURAMENTO ---
    acknowledgedMilestones: {
      type: [String],
      default: [],
    },

    // --- SMTP PARA EMAILS ---
    smtpHost: { type: String, default: "" },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: "" },
    smtpPass: { type: String, default: "", select: false },
    smtpFromEmail: { type: String, default: "" },
    smtpFromName: { type: String, default: "" },

    // --- PAYPAL BILLING ---
    paypalBilling: {
      trialStartDate: { type: Date, default: null },
      status: { type: String, enum: ["trial", "active", "blocked"], default: "trial" },
      currentCycleStart: { type: Date, default: null },
      currentCycleEnd: { type: Date, default: null },
      lastPaymentDate: { type: Date, default: null },
      lastChargeAmountInCents: { type: Number, default: 0 },
      pendingFeeInCents: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true, // Adiciona createdAt e updatedAt
  }
);

// --- Hashing da Senha ---
userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("passwordHash")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// --- Método de Instância ---
userSchema.methods.comparePassword = function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

const User: Model<IUser> = mongoose.models.User || model<IUser>("User", userSchema);

export default User;
