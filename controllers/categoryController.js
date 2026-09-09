const Category = require('../models/Category')
const joi = require('joi')

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
    res.status(200).json({ success: true, message: 'Categories fetched successfully', categories })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching categories', error: error.message })
  }
}

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' })
    }
    res.status(200).json({ success: true, message: 'Category fetched successfully', category })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching category', error: error.message })
  }
}

exports.createCategory = async (req, res) => {
  try {
    const { userId, categoryBudget, categoryName } = req.body

    const schema = joi.object({
      userId: joi.string().min(0).required(),
      categoryBudget: joi.number().min(0).required(),
      categoryName: joi.string().min(3).max(50).trim().required()
    })

    const { error } = schema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error.message })
    }

    const newCategory = new Category({ userId, categoryBudget, categoryName })
    await newCategory.save()
    res.status(201).json({ success: true, message: 'Category created successfully', category: newCategory })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating category', error: error.message })
  }
}

exports.updateCategory = async (req, res) => {
  try {
    const { categoryBudget, categoryName } = req.body

    const schema = joi.object({
      categoryBudget: joi.number().min(0).optional(),
      categoryName: joi.string().min(3).max(50).trim().optional()
    })

    const { error } = schema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error.message })
    }

    const category = await Category.findByIdAndUpdate(req.params.id, { categoryBudget, categoryName }, { new: true })
    if (!category) {    
      return res.status(404).json({ success: false, message: 'Category not found' })
    }

    res.status(200).json({ success: true, message: 'Category updated successfully', category })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating category', error: error.message })
  }
}

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id)
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' })
    }
    res.status(204).json({ success: true, message: 'Category deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting category', error: error.message })
  }
}