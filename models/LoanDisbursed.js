const mongoose = require('mongoose');

const loanDisbursedSchema = new mongoose.Schema({
    loanFormId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LoanForm',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    disbursedAmount: {
        type: Number,
        required: true
    },
    disbursedDate: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    disbursedInterest: {
        type: Number,
        required: true
    },
    disbursedDuration: {
        type: Number,
        required: true
    },
    emiAmount: {
        type: Number,
        required: true
    },
    principalAmountLeft: {
        type: Number,
        required: true
    },
    lastEmiReminderDueDate: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('LoanDisbursed', loanDisbursedSchema);
