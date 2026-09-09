/**
 * Email service for the EMI reminder cron job.
 * Sends HTML reminder emails via nodemailer using SMTP credentials from .env.
 */

const nodemailer = require('nodemailer')

const TIMEZONE = 'Asia/Kolkata'

/** Creates a nodemailer SMTP transporter from env vars (SMTP_HOST, SMTP_USER, etc.). */
function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP credentials are not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)')
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  })
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDueDate(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function buildEmiReminderHtml({ applicantName, emiAmount, dueDate, emiNumber, totalEmis }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #2563eb;">EMI Payment Reminder</h2>
      <p>Hi ${applicantName},</p>
      <p>This is a friendly reminder that your loan EMI is due in <strong>2 days</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">EMI Number</td>
          <td style="padding: 8px 0; text-align: right;"><strong>${emiNumber} of ${totalEmis}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Amount Due</td>
          <td style="padding: 8px 0; text-align: right;"><strong>${formatCurrency(emiAmount)}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Due Date</td>
          <td style="padding: 8px 0; text-align: right;"><strong>${formatDueDate(dueDate)}</strong></td>
        </tr>
      </table>
      <p>Please ensure sufficient funds are available to avoid late payment charges.</p>
      <p style="color: #666; font-size: 13px;">— Fintech App</p>
    </div>
  `
}

/** Sends the "EMI due in 2 days" reminder email to a single borrower. */
async function sendEmiReminderEmail({ to, applicantName, emiAmount, dueDate, emiNumber, totalEmis }) {
  const transporter = createTransporter()
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER

  await transporter.sendMail({
    from,
    to,
    subject: `EMI due in 2 days — ${formatCurrency(emiAmount)} on ${formatDueDate(dueDate)}`,
    html: buildEmiReminderHtml({ applicantName, emiAmount, dueDate, emiNumber, totalEmis }),
  })
}

module.exports = {
  sendEmiReminderEmail,
}
