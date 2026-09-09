const LoanForm = require('../models/LoanForm')
const Income = require('../models/Income')
const Expense = require('../models/Expense')
const joi = require('joi')
const LoanDisbursed = require('../models/LoanDisbursed')
const { GoogleGenAI } = require('@google/genai')

const buildRiskScorePrompt = ({ loanFormJsonString, incomeRecordsJsonString, expenseRecordsJsonString, aggregates }) => {
    const { totalMonthlyIncome, totalMonthlyExpenses, monthlySurplus, expenseToIncomeRatio } = aggregates

    return `You are a credit risk analyst for an Indian fintech lending platform.

Analyze the applicant's loan form, income records, and expense records. Compute a single risk score between 0.00 and 1.00 (exactly 2 decimal places).

- Higher score = higher risk, less creditworthy (closer to 1.00)
- Lower score = lower risk, more creditworthy (closer to 0.00)

Consider:
1. Credit score (Indian bureau scale ~300-900)
2. Total income, income source diversity, and stability
3. Total expenses, expense-to-income ratio, and savings surplus
4. Loan purpose and repayment capacity
5. KYC document provided (yes/no)

If income or expense data is missing or empty, penalize the score (maximum 0.40).

---

LOAN FORM:
${loanFormJsonString}

INCOME RECORDS:
${incomeRecordsJsonString}

EXPENSE RECORDS:
${expenseRecordsJsonString}

PRE-COMPUTED:
- Total monthly income (INR): ${totalMonthlyIncome}
- Total monthly expenses (INR): ${totalMonthlyExpenses}
- Monthly surplus (INR): ${monthlySurplus}
- Expense-to-income ratio: ${expenseToIncomeRatio}

---

Respond with ONLY the risk score as a number with exactly 2 decimal places.
No JSON. No explanation. No extra text.

Example valid responses: 0.73 or 0.45 or 0.91`
}

const parseRiskScore = (text) => {
    const match = text.trim().match(/\d+\.\d{2}|\d+/)
    if (!match) {
        throw new Error('Invalid risk score from AI')
    }

    const score = Math.min(1, Math.max(0, parseFloat(match[0])))
    return Math.round(score * 100) / 100
}

const getLoanForm = async (req, res) => {
    try{
        const loanFormId = req.params.id

        const loanForm = await LoanForm.findById(loanFormId)

        if(!loanForm){
            return res.status(404).json({ success: false, message: "Loan Form not found!" })
        }

        res.status(200).json({ success: true, message: "Loan Form fetched successfully!", data: loanForm })
    }catch(err){
        res.status(500).json({ success: false, message: "Internal Server Error!", error: err.message })
    }
}

const createLoanForm = async (req, res) => {
    try{
        const { applicantName, applicantEmail, applicantAddress, applicantPhone, loanPurpose, creditScore, kycDocument, panNumber } = req.body
        const userId = req.user.userId

        const schema = joi.object({
            applicantName: joi.string().required(),
            applicantEmail: joi.string().email().required(),
            applicantAddress: joi.string().required(),
            applicantPhone: joi.string().required(),
            loanPurpose: joi.string().required(),
            creditScore: joi.number().required(),
            kycDocument: joi.string().required(),
            panNumber: joi.string().required(),
        }).required()

        const { error } = schema.validate(req.body)
        if(error){
            return res.status(400).json({ success: false, message: error.details[0].message })
        }

        const existingLoan = await LoanDisbursed.findOne({ userId, isActive: true })
        if(existingLoan){
            return res.status(400).json({ success: false, message: "You already have an active loan!" })
        }

        const loanForm = await LoanForm.create({
            applicantName, applicantEmail, applicantAddress, applicantPhone, loanPurpose, creditScore, kycDocument, panNumber, userId 
        })

        const [incomes, expenses] = await Promise.all([
            Income.find({ userId }),
            Expense.find({ userId }).populate('categoryId', 'categoryName categoryBudget'),
        ])

        const totalMonthlyIncome = incomes.reduce((sum, income) => sum + income.amount, 0)
        const totalMonthlyExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
        const monthlySurplus = totalMonthlyIncome - totalMonthlyExpenses
        const expenseToIncomeRatio = totalMonthlyIncome > 0
            ? (totalMonthlyExpenses / totalMonthlyIncome).toFixed(2)
            : '1.00'

        const loanFormJsonString = JSON.stringify({
            applicantName,
            applicantEmail,
            applicantAddress,
            applicantPhone,
            loanPurpose,
            creditScore,
            panNumber,
            kycDocumentProvided: Boolean(kycDocument),
        })

        const incomeRecordsJsonString = JSON.stringify(incomes.map((income) => ({
            amount: income.amount,
            source: income.source,
            remark: income.remark,
        })))

        const expenseRecordsJsonString = JSON.stringify(expenses.map((expense) => ({
            amount: expense.amount,
            title: expense.title,
            paymentMethod: expense.paymentMethod,
            categoryName: expense.categoryId?.categoryName,
            categoryBudget: expense.categoryId?.categoryBudget,
        })))

        const prompt = buildRiskScorePrompt({
            loanFormJsonString,
            incomeRecordsJsonString,
            expenseRecordsJsonString,
            aggregates: {
                totalMonthlyIncome,
                totalMonthlyExpenses,
                monthlySurplus,
                expenseToIncomeRatio,
            },
        })

        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        })

        const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: prompt,
        })

        console.log(response.text)

        const riskScore = parseRiskScore(response.text)

        const loanAmount = 5000000 * riskScore

        let interestRate;

        if(riskScore >= 0.90){
            interestRate = 25.00
        }else if(riskScore >= 0.70 && riskScore < 0.90){
            interestRate = 21.00
        }else if(riskScore >= 0.50 && riskScore < 0.70){
            interestRate = 18.00
        }else if(riskScore >= 0.30 && riskScore < 0.50){
            interestRate = 15.00
        }else if(riskScore >= 0.10 && riskScore < 0.30){
            interestRate = 12.00
        }else {
            interestRate = 10.00
        }

        res.status(201).json({
            success: true,
            message: "Loan Form created successfully!",
            data: { loanForm, loanAmount, interestRate },
        })
    }catch(err){
        res.status(500).json({ success: false, message: "Internal Server Error!", error: err.message })
    }
}

module.exports = {
    getLoanForm,
    createLoanForm,
}
