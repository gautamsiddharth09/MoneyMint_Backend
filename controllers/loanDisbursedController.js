const LoanDisbursed = require('../models/LoanDisbursed')
const joi = require('joi')

const getLoanDisbursed = async (req, res) => {
    try{
        const loanId = req.params.id

        const loanDisbursed = await LoanDisbursed.findById(loanId)

        if(!loanDisbursed){
            return res.status(404).json({ success: false, message: "Loan disbursed not found!" })
        }

        res.status(200).json({ success: true, message: "Loan disbursed found successfully!", data: loanDisbursed })
    }catch(err){
        res.status(500).json({ success: false, message: "Internal Server Error!", error: err.message })
    }
}

const createLoanDisbursed = async (req, res) => {
    try{
        const { loanFormId, disbursedAmount, isActive, disbursedInterest, disbursedDuration, emiAmount, principalAmountLeft } = req.body
        const userId = req.user.userId

        const schema = joi.object({
            loanFormId: joi.string().required(),
            disbursedAmount: joi.number().required(),
            isActive: joi.boolean().required(),
            disbursedInterest: joi.number().required(),
            disbursedDuration: joi.number().required(),
            emiAmount: joi.number().required(),
            principalAmountLeft: joi.number().required(),
        })

        const { error } = schema.validate(req.body)
        if(error){
            return res.status(400).json({ success: false, message: error.message })
        }

        const existingLoan = await LoanDisbursed.findOne({ userId, isActive: true })
        if(existingLoan){
            return res.status(400).json({ success: false, message: "You already have an active loan!" })
        }

        const loanDisbursed = await LoanDisbursed.create({
            loanFormId, disbursedAmount, isActive, disbursedInterest, disbursedDuration, emiAmount, principalAmountLeft, userId
        })

        res.status(201).json({ success: true, message: "Loan disbursed created successfully!", data: loanDisbursed })
    }catch(err){
        res.status(500).json({ success: false, message: "Internal Server Error!", error: err.message })
    }
}

const getLoan = async (req, res) => {
    try{
        const userId = req.user.userId
        const loanDisbursed = await LoanDisbursed.findOne({ userId, isActive: true })

        if(!loanDisbursed){
            return res.status(404).json({ success: false, message: "Loan disbursed not found!" })
        }

        res.status(200).json({ success: true, message: "Loan disbursed found successfully!", data: loanDisbursed })
    }catch(err){
        res.status(500).json({ success: false, message: "Internal Server Error!", error: err.message })
    }
}

module.exports = {
    getLoanDisbursed,
    createLoanDisbursed,
    getLoan,
}