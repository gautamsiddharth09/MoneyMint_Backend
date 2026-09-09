/**
 * Loan math helpers — shared with frontend logic for EMI schedule generation.
 */

function calculateEMI(principal, annualInterestRate, tenureMonths) {
  if (!principal || !tenureMonths) return 0

  const monthlyRate = annualInterestRate / 12 / 100

  if (monthlyRate === 0) {
    return Math.round(principal / tenureMonths)
  }

  const factor = Math.pow(1 + monthlyRate, tenureMonths)
  const emi = (principal * monthlyRate * factor) / (factor - 1)

  return Math.round(emi)
}

function generateRepaymentSchedule(principal, annualRate, tenureMonths, startDate) {
  const monthlyRate = annualRate / 12 / 100
  const emi = calculateEMI(principal, annualRate, tenureMonths)
  let balance = principal
  const schedule = []
  const baseDate = new Date(startDate)

  for (let month = 1; month <= tenureMonths; month += 1) {
    const interest = Math.round(balance * monthlyRate)
    const principalPart = Math.min(emi - interest, balance)
    balance = Math.max(0, balance - principalPart)

    const dueDate = new Date(baseDate)
    dueDate.setMonth(dueDate.getMonth() + month)

    schedule.push({
      month,
      dueDate: dueDate.toISOString(),
      emi,
      principal: principalPart,
      interest,
      balance: Math.round(balance),
      status: 'pending',
    })
  }

  return schedule
}

/** Count EMI payments recorded in LoanTransaction (used by the reminder cron). */
function countPaidEmis(transactions) {
  return transactions.filter((t) => t.transactionType === 'EMI').length
}

/**
 * Returns the due date of the next unpaid EMI for a loan.
 * Rebuilds the amortization schedule and picks the row after all paid EMIs.
 * Returns null when every EMI in the tenure has been paid.
 */
function getNextEmiDueDate(loan, transactions) {
  const paidCount = countPaidEmis(transactions)
  const nextEmiMonth = paidCount + 1

  if (nextEmiMonth > loan.disbursedDuration) {
    return null
  }

  const schedule = generateRepaymentSchedule(
    loan.disbursedAmount,
    loan.disbursedInterest,
    loan.disbursedDuration,
    loan.disbursedDate
  )

  const nextEmi = schedule[nextEmiMonth - 1]
  return nextEmi ? new Date(nextEmi.dueDate) : null
}

/** Normalises a date to 'YYYY-MM-DD' in the given timezone for day-level comparison. */
function formatDateKey(date, timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Adds N calendar days to a date (used to compute "due in 2 days" target). */
function addCalendarDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Compares two dates by calendar day in a timezone, ignoring time-of-day. */
function isSameCalendarDay(dateA, dateB, timeZone = 'Asia/Kolkata') {
  return formatDateKey(dateA, timeZone) === formatDateKey(dateB, timeZone)
}

module.exports = {
  calculateEMI,
  generateRepaymentSchedule,
  countPaidEmis,
  getNextEmiDueDate,
  formatDateKey,
  addCalendarDays,
  isSameCalendarDay,
}
