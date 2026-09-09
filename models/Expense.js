const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 100
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ["UPI", "Cash", "Credit Card", "Debit Card", "NetBanking"],
        default: "Cash"
    }
}, { timestamps: true })

module.exports = mongoose.model('Expense', expenseSchema)