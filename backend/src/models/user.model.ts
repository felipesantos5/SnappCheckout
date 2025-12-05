// src/models/user.model.ts
import mongoose, { Schema, Document, model, Model } from "mongoose";
import bcrypt from "bcrypt";

// Interface para o documento (para tipagem)
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  stripeAccountId?: string; // <-- NOVO: Armazena o ID da conta (ex: acct_...)
  stripeOnboardingComplete: boolean; // <-- NOVO: Controla se o onboarding foi concluído
  paypalClientId?: string; // <-- NOVO: PayPal Client ID
  paypalClientSecret?: string; // <-- NOVO: PayPal Client Secret
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
