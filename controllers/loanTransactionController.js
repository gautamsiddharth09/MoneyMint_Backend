const LoanTransaction = require('../models/LoanTransaction')
const joi = require('joi')
const LoanDisbursed = require('../models/LoanDisbursed')

const getLoanTransactionsByLoanDisbursedId = async (req, res) => {
    try{
        const loanDisbursedId = req.params.loanDisbursedId

        const loanDisbursed = await LoanDisbursed.findById(loanDisbursedId)

        if(!loanDisbursed){
            return res.status(404).json({ success: false, message: "Loan not found!" })
        }

        const loanTransactions = await LoanTransaction.find({ loanDisbursedId })

        if(!loanTransactions){
            return res.status(404).json({ success: false, message: "No loan transactions found!" })
        }

        res.status(200).json({ success: true, message: "Loan transactions found successfully!", data: loanTransactions })
    }catch(err){
        res.status(500).json({ success: false, message: "Internal Server Error!", error: err.message })
    }
}

const createLoanTransaction = async (req, res) => {
    try{
        const { loanDisbursedId, transactionAmount, transactionType, razorpayPaymentId } = req.body
        const userId = req.user.userId

        const schema = joi.object({
            loanDisbursedId: joi.string().required(),
            transactionAmount: joi.number().required(),
            transactionType: joi.string().required(),
            razorpayPaymentId: joi.string().required(),
        })

        const { error } = schema.validate(req.body)
        if(error){
            return res.status(400).json({ success: false, message: error.details[0].message })
        }

        const loanDisbursed = await LoanDisbursed.findById(loanDisbursedId)

        if(!loanDisbursed){
            return res.status(404).json({ success: false, message: "Loan disbursed not found!" })
        }

        if(loanDisbursed.principalAmountLeft < transactionAmount){
            return res.status(400).json({ success: false, message: "Transaction amount is greater than the principal amount left!" })
        }

        let finalPrincipalAmount = loanDisbursed.principalAmountLeft - transactionAmount
        if(finalPrincipalAmount < 0){
            finalPrincipalAmount = 0
        }

        const loanTransaction = await LoanTransaction.create({
            loanDisbursedId, transactionAmount, transactionType, razorpayPaymentId, userId
        })

        await LoanDisbursed.findByIdAndUpdate(loanDisbursedId, { principalAmountLeft: finalPrincipalAmount })

        res.status(201).json({ success: true, message: "Loan transaction created successfully!", data: loanTransaction })
    }catch(err){
        res.status(500).json({ success: false, message: "Internal Server Error!", error: err.message })
    }
}

module.exports = {
    getLoanTransactionsByLoanDisbursedId,
    createLoanTransaction,
}