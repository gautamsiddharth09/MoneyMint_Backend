const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const {
  getLoanTransactionsByLoanDisbursedId,
  createLoanTransaction,
} = require('../controllers/loanTransactionController')
const router = express.Router()

router.get('/loan-transactions/:loanDisbursedId', authMiddleware, getLoanTransactionsByLoanDisbursedId)
router.post('/loan-transaction', authMiddleware, createLoanTransaction)

module.exports = router