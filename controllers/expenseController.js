const Expense = require('../models/Expense')
const joi = require('joi')

const getExpensesByUserId = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.userId })
    res.status(200).json({ success: true, message: 'Expenses fetched successfully', expenses })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching expenses', error: error.message })
  }
}

const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
    res.status(200).json({ success: true, message: 'Expense fetched successfully', expense })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching expense', error: error.message })
  }
}

const getExpenseByCategoryId = async (req, res) => {
  try {
    const expenses = await Expense.find({ categoryId: req.params.categoryId })
    res.status(200).json({ success: true, message: 'Expenses fetched successfully', expenses })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching expenses', error: error.message })
  }
}

const createExpense = async (req, res) => {
  try {
    const { userId, amount, categoryId, title, paymentMethod } = req.body
    const schema = joi.object({
      userId: joi.string().min(0).required(),
      amount: joi.number().min(0).required(),
      categoryId: joi.string().min(0).required(),
      title: joi.string().min(3).max(100).trim().required(),
      paymentMethod: joi.string().valid('UPI', 'Cash', 'Credit Card', 'Debit Card', 'NetBanking').required()
    })
    const { error } = schema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error.message })
    }

    const newExpense = new Expense({ userId, amount, categoryId, title, paymentMethod })
    await newExpense.save()

    res.status(201).json({ success: true, message: 'Expense created successfully', expense: newExpense })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating expense', error: error.message })
  }
}

const updateExpense = async (req, res) => {
  try {
    const { amount, categoryId, title, paymentMethod } = req.body

    const schema = joi.object({
      amount: joi.number().min(0).optional(),
      categoryId: joi.string().min(0).optional(),
      title: joi.string().min(3).max(100).trim().optional(),
      paymentMethod: joi.string().valid('UPI', 'Cash', 'Credit Card', 'Debit Card', 'NetBanking').optional()
    })

    const { error } = schema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error.message })
    }

    const expense = await Expense.findByIdAndUpdate(req.params.id, { amount, categoryId, title, paymentMethod }, { new: true })
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }

    res.status(200).json({ success: true, message: 'Expense updated successfully', expense })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating expense', error: error.message })
  }
}

const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id)
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }
    res.status(204).json({ success: true, message: 'Expense deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting expense', error: error.message })
  }
}

module.exports = {
  getExpensesByUserId,
  getExpenseById,
  getExpenseByCategoryId,
  createExpense,
  updateExpense,
  deleteExpense
}