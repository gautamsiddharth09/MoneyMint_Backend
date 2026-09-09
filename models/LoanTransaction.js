const mongoose = require('mongoose')

const loanTransactionSchema = new mongoose.Schema({
    loanDisbursedId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LoanDisbursed',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    transactionAmount: {
        type: Number,
        required: true
    },
    transactionDate: {
        type: Date,
        default: Date.now
    },
    transactionType: {
        type: String,
        enum: ['EMI', 'Partial Prepayment', 'Full Prepayment'],
        required: true
    },
    razorpayPaymentId: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('LoanTransaction', loanTransactionSchema);
