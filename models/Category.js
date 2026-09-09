const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    categoryBudget: {
        type: Number,
        required: true,
        min: 0,
    },
    categoryName: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
}, { timestamps: true })

module.exports = mongoose.model('Category', categorySchema)