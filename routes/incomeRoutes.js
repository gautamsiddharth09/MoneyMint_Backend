const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const { getIncomesByUserId, getIncomeById, createIncome, updateIncome, deleteIncome } = require('../controllers/incomeController')
const router = express.Router()

router.get('/user-incomes', authMiddleware, getIncomesByUserId)
router.get('/get-income-by-id/:id', authMiddleware, getIncomeById)
router.post('/create-income', authMiddleware, createIncome)
router.put('/update-income/:id', authMiddleware, updateIncome)
router.delete('/delete-income/:id', authMiddleware, deleteIncome)

module.exports = router