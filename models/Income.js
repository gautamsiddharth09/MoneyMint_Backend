const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
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
    source: {
        type: String,
        required: true,
        trim: true,
    },
    remark: {
        type: String,
        trim: true,
        maxlength: 200
    }
}, { timestamps: true });

const Income = mongoose.model('Income', incomeSchema);

module.exports = Income;