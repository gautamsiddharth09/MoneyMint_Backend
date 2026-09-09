const crypto = require('crypto')
const joi = require('joi')
const Razorpay = require('razorpay')
const LoanDisbursed = require('../models/LoanDisbursed')
const LoanTransaction = require('../models/LoanTransaction')

/** Shared Razorpay client — uses keys from .env */
function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys are not configured on the server')
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}

/** Validate loan ownership and payment amount before creating an order. */
async function validateLoanPayment(userId, loanDisbursedId, transactionAmount) {
  const loan = await LoanDisbursed.findById(loanDisbursedId)

  if (!loan) {
    return { error: 'Loan not found!', status: 404 }
  }

  if (String(loan.userId) !== String(userId)) {
    return { error: 'You are not authorized to pay for this loan!', status: 403 }
  }

  if (!loan.isActive) {
    return { error: 'This loan is no longer active!', status: 400 }
  }

  if (transactionAmount > loan.principalAmountLeft) {
    return { error: 'Transaction amount is greater than the principal amount left!', status: 400 }
  }

  if (transactionAmount <= 0) {
    return { error: 'Transaction amount must be greater than zero!', status: 400 }
  }

  return { loan }
}

/**
 * POST /razorpay/create-order
 * Creates a Razorpay order for a loan payment (EMI / prepayment).
 */
const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.user.userId
    const { loanDisbursedId, transactionAmount, transactionType } = req.body

    const schema = joi.object({
      loanDisbursedId: joi.string().required(),
      transactionAmount: joi.number().positive().required(),
      transactionType: joi
        .string()
        .valid('EMI', 'Partial Prepayment', 'Full Prepayment')
        .required(),
    })

    const { error } = schema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message })
    }

    const validation = await validateLoanPayment(userId, loanDisbursedId, transactionAmount)
    if (validation.error) {
      return res.status(validation.status).json({ success: false, message: validation.error })
    }

    const razorpay = getRazorpayInstance()
    const amountInPaise = Math.round(transactionAmount * 100)

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `loan_${loanDisbursedId}_${Date.now()}`,
      notes: {
        loanDisbursedId,
        transactionType,
        userId: String(userId),
        transactionAmount: String(transactionAmount),
      },
    })

    res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully!',
      data: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to create Razorpay order',
      error: err.message,
    })
  }
}

/**
 * POST /razorpay/verify
 * Verifies Razorpay payment signature, then records the loan transaction.
 */
const verifyRazorpayCheckout = async (req, res) => {
  try {
    const userId = req.user.userId
    const {
      loanDisbursedId,
      transactionAmount,
      transactionType,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body

    const schema = joi.object({
      loanDisbursedId: joi.string().required(),
      transactionAmount: joi.number().positive().required(),
      transactionType: joi
        .string()
        .valid('EMI', 'Partial Prepayment', 'Full Prepayment')
        .required(),
      razorpay_order_id: joi.string().required(),
      razorpay_payment_id: joi.string().required(),
      razorpay_signature: joi.string().required(),
    })

    const { error } = schema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message })
    }

    // Verify Razorpay HMAC signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keySecret) {
      return res.status(500).json({ success: false, message: 'Razorpay keys are not configured on the server' })
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature!' })
    }

    const validation = await validateLoanPayment(userId, loanDisbursedId, transactionAmount)
    if (validation.error) {
      return res.status(validation.status).json({ success: false, message: validation.error })
    }

    const { loan } = validation
    let finalPrincipalAmount = loan.principalAmountLeft - transactionAmount
    if (finalPrincipalAmount < 0) finalPrincipalAmount = 0

    const loanTransaction = await LoanTransaction.create({
      loanDisbursedId,
      transactionAmount,
      transactionType,
      razorpayPaymentId: razorpay_payment_id,
      userId,
    })

    const updatePayload = { principalAmountLeft: finalPrincipalAmount }

    // Close loan on full prepayment or when principal reaches zero
    if (transactionType === 'Full Prepayment' || finalPrincipalAmount === 0) {
      updatePayload.isActive = false
    }

    const updatedLoan = await LoanDisbursed.findByIdAndUpdate(
      loanDisbursedId,
      updatePayload,
      { new: true }
    )

    res.status(201).json({
      success: true,
      message: 'Payment verified and recorded successfully!',
      data: {
        transaction: loanTransaction,
        loan: updatedLoan,
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: err.message,
    })
  }
}

module.exports = {
  createRazorpayOrder,
  verifyRazorpayCheckout,
}
