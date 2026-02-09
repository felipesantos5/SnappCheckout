// src/controllers/category.controller.ts
import { Request, Response } from "express";
import * as categoryService from "../services/category.service";

export const listCategories = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const categories = await categoryService.listCategories(ownerId);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
    
    const category = await categoryService.createCategory(ownerId, name);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const { id } = req.params;
    const { name } = req.body;
    
    const category = await categoryService.updateCategory(id, ownerId, name);
    if (!category) return res.status(404).json({ error: "Categoria não encontrada" });
    
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const { id } = req.params;
    
    const success = await categoryService.deleteCategory(id, ownerId);
    if (!success) return res.status(404).json({ error: "Categoria não encontrada" });
    
    res.json({ message: "Categoria deletada com sucesso" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const reorderCategories = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const { categoryIds } = req.body;
    
    await categoryService.reorderCategories(ownerId, categoryIds);
    res.json({ message: "Categorias reordenadas com sucesso" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
