// src/models/category.model.ts
import mongoose, { Schema, Document, model, Model } from "mongoose";

export interface ICategory extends Document {
  ownerId: Schema.Types.ObjectId;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Garantir que o nome da categoria seja único por usuário
categorySchema.index({ ownerId: 1, name: 1 }, { unique: true });

const Category: Model<ICategory> = mongoose.models.Category || model<ICategory>("Category", categorySchema);

export default Category;
