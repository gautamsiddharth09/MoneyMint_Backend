const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const { getLoanDisbursed, getLoan, createLoanDisbursed } = require('../controllers/loanDisbursedController')
const router = express.Router()

router.get('/loan-disbursed/:id', authMiddleware, getLoanDisbursed)
router.get('/get-loan', authMiddleware, getLoan)
router.post('/loan-disbursed', authMiddleware, createLoanDisbursed)

module.exports = router