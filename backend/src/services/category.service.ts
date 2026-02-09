// src/services/category.service.ts
import Category, { ICategory } from "../models/category.model";
import Offer from "../models/offer.model";

export const listCategories = async (ownerId: string): Promise<ICategory[]> => {
  return await Category.find({ ownerId }).sort({ order: 1, name: 1 });
};

export const createCategory = async (ownerId: string, name: string): Promise<ICategory> => {
  const category = new Category({ ownerId, name });
  return await category.save();
};

export const updateCategory = async (id: string, ownerId: string, name: string): Promise<ICategory | null> => {
  const category = await Category.findOneAndUpdate(
    { _id: id, ownerId },
    { name },
    { new: true }
  );
  
  if (category) {
    // Sincroniza o nome no campo string 'group' para compatibilidade
    await Offer.updateMany({ categoryId: id, ownerId }, { group: name });
  }
  
  return category;
};

export const deleteCategory = async (id: string, ownerId: string): Promise<boolean> => {
  const result = await Category.deleteOne({ _id: id, ownerId });
  
  if (result.deletedCount > 0) {
    // Ao deletar uma categoria, removemos a referência nas ofertas
    await Offer.updateMany({ categoryId: id, ownerId }, { $unset: { categoryId: 1 } });
    return true;
  }
  
  return false;
};

export const reorderCategories = async (ownerId: string, categoryIds: string[]): Promise<void> => {
  const operations = categoryIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, ownerId },
      update: { order: index },
    },
  }));
  
  await Category.bulkWrite(operations);
};
