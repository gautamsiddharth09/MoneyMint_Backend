/**
 * Manual test runner for the EMI reminder cron job.
 *
 * Usage:
 *   node scripts/testEmiReminder.js              # dry-run — show which loans qualify
 *   node scripts/testEmiReminder.js --send       # run the real job (sends emails)
 *   node scripts/testEmiReminder.js --send --days 0   # send for EMIs due TODAY (easier testing)
 *   node scripts/testEmiReminder.js --send --force    # send to first active loan (ignore due date)
 */

require('dotenv').config()

const mongoose = require('mongoose')
const LoanDisbursed = require('../models/LoanDisbursed')
const LoanTransaction = require('../models/LoanTransaction')
require('../models/LoanForm')
require('../models/User')
const {
  getNextEmiDueDate,
  addCalendarDays,
  isSameCalendarDay,
  countPaidEmis,
  formatDateKey,
} = require('../utils/loanCalculations')
const { sendEmiReminders } = require('../jobs/emiReminderJob')

const TIMEZONE = 'Asia/Kolkata'
const args = process.argv.slice(2)
const shouldSend = args.includes('--send')
const forceSend = args.includes('--force')
const daysIndex = args.indexOf('--days')
const reminderDays = daysIndex !== -1 ? Number(args[daysIndex + 1]) : 2

async function fetchActiveLoans() {
  return LoanDisbursed.find({ isActive: true })
    .populate('loanFormId', 'applicantName applicantEmail')
    .populate('userId', 'email name')
}

async function inspectLoans(activeLoans) {
  const today = new Date()
  const targetDueDay = addCalendarDays(today, reminderDays)

  console.log('\n--- EMI Reminder Test ---')
  console.log(`Today (IST):        ${formatDateKey(today, TIMEZONE)}`)
  console.log(`Target due date:    ${formatDateKey(targetDueDay, TIMEZONE)} (${reminderDays} day(s) from today)`)
  console.log(`Mode:               ${shouldSend ? 'SEND emails' : 'DRY RUN (pass --send to email)'}`)
  console.log(`Active loans found: ${activeLoans.length}\n`)

  if (activeLoans.length === 0) {
    console.log('No active loans in the database. Disburse a loan first, then re-run this script.')
    return
  }

  let matchCount = 0

  for (const loan of activeLoans) {
    const transactions = await LoanTransaction.find({ loanDisbursedId: loan._id })
    const dueDate = getNextEmiDueDate(loan, transactions)
    const email = loan.loanFormId?.applicantEmail || loan.userId?.email || '(no email)'
    const name = loan.loanFormId?.applicantName || loan.userId?.name || 'Customer'
    const paidCount = countPaidEmis(transactions)

    const qualifies =
      loan.principalAmountLeft > 0 &&
      dueDate &&
      isSameCalendarDay(dueDate, targetDueDay, TIMEZONE)

    if (qualifies) matchCount += 1

    console.log(`Loan ${loan._id}`)
    console.log(`  Borrower:     ${name} <${email}>`)
    console.log(`  Disbursed:    ${formatDateKey(loan.disbursedDate, TIMEZONE)}`)
    console.log(`  Next EMI:     ${dueDate ? formatDateKey(dueDate, TIMEZONE) : 'none (fully paid)'}`)
    console.log(`  EMI #${paidCount + 1} amount:  ₹${loan.emiAmount}`)
    console.log(`  Qualifies:    ${qualifies ? 'YES ✓' : 'no'}`)
    console.log('')
  }

  if (matchCount === 0) {
    console.log('No loans match the target due date.')
    console.log('Tip: run with --send --force to send a test email to the first active loan.\n')
  } else {
    console.log(`${matchCount} loan(s) will receive a reminder.\n`)
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('MongoDB connected')

  const activeLoans = await fetchActiveLoans()
  await inspectLoans(activeLoans)

  if (shouldSend) {
    const { sendEmiReminderEmail } = require('../services/emailService')

    if (forceSend) {
      const loan = activeLoans.find(
        (l) => l.principalAmountLeft > 0 && (l.loanFormId?.applicantEmail || l.userId?.email)
      )
      if (!loan) {
        console.log('No active loan with an email address found.')
        await mongoose.disconnect()
        return
      }

      const transactions = await LoanTransaction.find({ loanDisbursedId: loan._id })
      const dueDate = getNextEmiDueDate(loan, transactions)
      const email = loan.loanFormId?.applicantEmail || loan.userId?.email
      const name = loan.loanFormId?.applicantName || loan.userId?.name || 'Customer'

      console.log(`\n--force: sending test reminder to ${email} (ignoring due date check)...`)

      await sendEmiReminderEmail({
        to: email,
        applicantName: name,
        emiAmount: loan.emiAmount,
        dueDate: dueDate || addCalendarDays(new Date(), 2),
        emiNumber: countPaidEmis(transactions) + 1,
        totalEmis: loan.disbursedDuration,
      })
      console.log(`✓ Test email sent to ${email}`)
    } else if (reminderDays !== 2) {
      const today = new Date()
      const targetDueDay = addCalendarDays(today, reminderDays)
      let sent = 0

      for (const loan of activeLoans) {
        const transactions = await LoanTransaction.find({ loanDisbursedId: loan._id })
        const dueDate = getNextEmiDueDate(loan, transactions)
        if (!dueDate || loan.principalAmountLeft <= 0) continue
        if (!isSameCalendarDay(dueDate, targetDueDay, TIMEZONE)) continue

        const email = loan.loanFormId?.applicantEmail || loan.userId?.email
        const name = loan.loanFormId?.applicantName || loan.userId?.name || 'Customer'
        if (!email) continue

        await sendEmiReminderEmail({
          to: email,
          applicantName: name,
          emiAmount: loan.emiAmount,
          dueDate,
          emiNumber: countPaidEmis(transactions) + 1,
          totalEmis: loan.disbursedDuration,
        })
        sent += 1
        console.log(`✓ Email sent to ${email}`)
      }
      console.log(`\nDone — sent ${sent} email(s)`)
    } else {
      await sendEmiReminders()
    }
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
