const mongoose = require('mongoose')

const loanFormSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    applicantName: { 
        type: String, required: true 
    },
    applicantEmail: { 
        type: String, required: true 
    },
    applicantAddress: {
        type: String,
        required: true
    },
    applicantPhone: {
        type: String,
        required: true
    },
    loanPurpose: { 
        type: String, required: true 
    },
    creditScore: { 
        type: Number, required: true 
    },
    kycDocument: {
        type: String,
        required: true
    },
    panNumber: {
        type: String,
        required: true
    },
}, { timestamps: true })

module.exports = mongoose.model('LoanForm', loanFormSchema)