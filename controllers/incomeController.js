const Income = require('../models/Income')
const joi = require('joi')

exports.getIncomesByUserId = async (req, res) => {
    try {
        const userId = req.user.userId
        const incomeSources = await Income.find({ userId })

        res.status(200).json({
            success: true,
            message: 'Income sources fetched successfully!',
            incomeSources,
        })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Internal Server Error!', error: err })
    }
}

exports.getIncomeById = async (req, res) => {
    try {
        const income = await Income.findById(req.params.id)
        if (!income) {
            return res.status(404).json({ success: false, message: 'Income not found!' })
        }

        res.status(200).json({ success: true, message: 'Income fetched successfully!', income })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Internal Server Error!', error: err })
    }
}

exports.createIncome = async (req, res) => {
    try {
        const { userId, amount, source, remark } = req.body

        const schema = joi.object({
            userId: joi.string().required(),
            amount: joi.number().min(0).required(),
            source: joi.string().trim().required(),
            remark: joi.string().trim().max(200).optional().allow(''),
        })

        const { error } = schema.validate({ userId, amount, source, remark })
        if (error) {
            return res.status(400).json({ success: false, message: error.message })
        }

        const newIncome = new Income({ userId, amount, source, remark })
        await newIncome.save()

        res.status(201).json({ success: true, message: 'Income added successfully!', income: newIncome })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Internal Server Error!', error: err })
    }
}

exports.updateIncome = async (req, res) => {
    try {
        const incomeId = req.params.id
        const { amount, source, remark } = req.body

        const schema = joi.object({
            amount: joi.number().min(0).optional(),
            source: joi.string().trim().optional(),
            remark: joi.string().trim().max(200).optional().allow(''),
        })

        const { error } = schema.validate({ amount, source, remark })
        if (error) {
            return res.status(400).json({ success: false, message: error.message })
        }

        const income = await Income.findById(incomeId)
        if (!income) {
            return res.status(404).json({ success: false, message: 'Income not found!' })
        }

        const updatedIncome = await Income.findByIdAndUpdate(
            incomeId,
            { amount, source, remark },
            { new: true }
        )

        res.status(200).json({
            success: true,
            message: 'Income updated successfully!',
            income: updatedIncome,
        })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Internal Server Error!', error: err })
    }
}

exports.deleteIncome = async (req, res) => {
    try {
        const income = await Income.findByIdAndDelete(req.params.id)
        if (!income) {
            return res.status(404).json({ success: false, message: 'Income not found!' })
        }

        res.status(204).json({ success: true, message: 'Income deleted successfully!' })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Internal Server Error!', error: err })
    }
}
