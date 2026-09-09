/**
 * EMI Reminder Cron Job
 *
 * Runs on a daily schedule and sends nodemailer emails to borrowers whose
 * next unpaid EMI is due exactly 2 days from today (IST).
 *
 * EMI due dates are NOT stored in the database — they are derived at runtime
 * from LoanDisbursed.disbursedDate + month offset, matching the frontend
 * amortization logic in utils/loanCalculations.js.
 *
 * Env vars:
 *   EMI_REMINDER_CRON     — cron expression (default: '0 9 * * *' = 9 AM daily)
 *   EMI_REMINDER_ENABLED  — set to 'false' to disable the job entirely
 *   SMTP_* / EMAIL_FROM   — nodemailer credentials (see services/emailService.js)
 */

const cron = require('node-cron')
const LoanDisbursed = require('../models/LoanDisbursed')
const LoanTransaction = require('../models/LoanTransaction')
// Register referenced models so Mongoose populate() works when this job runs standalone
require('../models/LoanForm')
require('../models/User')
const { sendEmiReminderEmail } = require('../services/emailService')
const {
  getNextEmiDueDate,
  addCalendarDays,
  isSameCalendarDay,
  countPaidEmis,
} = require('../utils/loanCalculations')

// All date comparisons use IST so reminders align with Indian business hours
const TIMEZONE = 'Asia/Kolkata'

// How many days before the due date to send the reminder email
const REMINDER_DAYS_BEFORE = 2

// Default: every day at 9:00 AM IST. Override via EMI_REMINDER_CRON in .env
const CRON_SCHEDULE = process.env.EMI_REMINDER_CRON || '0 9 * * *'

/**
 * Core handler — queries active loans, finds those with an EMI due in 2 days,
 * and sends a reminder email to each eligible borrower.
 *
 * Exported separately from start() so it can be invoked manually for testing:
 *   node -e "require('dotenv').config(); ... require('./jobs/emiReminderJob').sendEmiReminders()"
 */
async function sendEmiReminders() {
  console.log('[emiReminderJob] Running EMI reminder check...')

  // Fetch all active disbursed loans with applicant and user details for email/name
  const activeLoans = await LoanDisbursed.find({ isActive: true })
    .populate('loanFormId', 'applicantName applicantEmail')
    .populate('userId', 'email name')

  let sent = 0
  let skipped = 0

  const today = new Date()
  // If today is Sep 5, targetDueDay is Sep 7 — we remind for EMIs due on Sep 7
  const targetDueDay = addCalendarDays(today, REMINDER_DAYS_BEFORE)

  for (const loan of activeLoans) {
    try {
      // Loan fully repaid — no upcoming EMI to remind about
      if (loan.principalAmountLeft <= 0) {
        skipped += 1
        continue
      }

      // Paid EMI count comes from LoanTransaction records (type === 'EMI')
      const transactions = await LoanTransaction.find({ loanDisbursedId: loan._id })
      const dueDate = getNextEmiDueDate(loan, transactions)

      // All EMIs paid or tenure exhausted — nothing left to remind
      if (!dueDate) {
        skipped += 1
        continue
      }

      // Only send when the next EMI due date falls exactly 2 calendar days from today
      if (!isSameCalendarDay(dueDate, targetDueDay, TIMEZONE)) {
        skipped += 1
        continue
      }

      // Prevent duplicate emails if the job is re-run on the same day (e.g. server restart)
      if (
        loan.lastEmiReminderDueDate &&
        isSameCalendarDay(loan.lastEmiReminderDueDate, dueDate, TIMEZONE)
      ) {
        skipped += 1
        continue
      }

      // Prefer the email from the loan application; fall back to the registered user email
      const loanForm = loan.loanFormId
      const recipientEmail = loanForm?.applicantEmail || loan.userId?.email
      const applicantName = loanForm?.applicantName || loan.userId?.name || 'Customer'

      if (!recipientEmail) {
        console.warn(`[emiReminderJob] No email found for loan ${loan._id}`)
        skipped += 1
        continue
      }

      const paidCount = countPaidEmis(transactions)

      await sendEmiReminderEmail({
        to: recipientEmail,
        applicantName,
        emiAmount: loan.emiAmount,
        dueDate,
        emiNumber: paidCount + 1,
        totalEmis: loan.disbursedDuration,
      })

      // Record which due date we reminded for, so we don't send again for the same EMI
      loan.lastEmiReminderDueDate = dueDate
      await loan.save()

      sent += 1
      console.log(`[emiReminderJob] Reminder sent to ${recipientEmail} for loan ${loan._id}`)
    } catch (err) {
      // Log and continue — one failed loan should not block reminders for others
      console.error(`[emiReminderJob] Failed for loan ${loan._id}:`, err.message)
    }
  }

  console.log(`[emiReminderJob] Done — sent: ${sent}, skipped: ${skipped}`)
}

/**
 * Registers the daily cron schedule. Called once from index.js after MongoDB connects.
 */
function start() {
  if (process.env.EMI_REMINDER_ENABLED === 'false') {
    console.log('[emiReminderJob] Disabled via EMI_REMINDER_ENABLED=false')
    return
  }

  cron.schedule(CRON_SCHEDULE, sendEmiReminders, { timezone: TIMEZONE })
  console.log(`[emiReminderJob] Scheduled daily at "${CRON_SCHEDULE}" (${TIMEZONE})`)
}

module.exports = {
  start,
  sendEmiReminders,
}
