const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const { getLoanForm, createLoanForm } = require('../controllers/loanFormController')
const router = express.Router()

router.get('/loan-form/:id', authMiddleware, getLoanForm)
router.post('/loan-form', authMiddleware, createLoanForm)

module.exports = router