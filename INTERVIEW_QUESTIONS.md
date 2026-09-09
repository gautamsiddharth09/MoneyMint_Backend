# FinTrack Fintech App — Interview Questions & Answers

A comprehensive collection of technical interview questions and detailed answers based on the FinTrack personal finance and loan management platform. Organized by topic for easy preparation.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Design & Architecture](#2-system-design--architecture)
3. [Authentication & Security](#3-authentication--security)
4. [Database & MongoDB](#4-database--mongodb)
5. [REST API Design](#5-rest-api-design)
6. [Personal Finance Module](#6-personal-finance-module)
7. [Loan Module & Business Logic](#7-loan-module--business-logic)
8. [EMI Calculation](#8-emi-calculation)
9. [AI Risk Scoring (Gemini)](#9-ai-risk-scoring-gemini)
10. [Razorpay Payment Integration](#10-razorpay-payment-integration)
11. [Cron Jobs & Email](#11-cron-jobs--email)
12. [Frontend (React)](#12-frontend-react)
13. [Node.js & Express](#13-nodejs--express)
14. [Error Handling & Validation](#14-error-handling--validation)
15. [Performance & Scalability](#15-performance--scalability)
16. [Testing & Debugging](#16-testing--debugging)
17. [Behavioral & Scenario-Based](#17-behavioral--scenario-based)
18. [Improvements & Trade-offs](#18-improvements--trade-offs)

---

## 1. Project Overview

### Q1. What is FinTrack and what problem does it solve?

**Answer:**

FinTrack is a full-stack fintech application that combines two capabilities in one platform:

1. **Personal finance management** — users track income, expenses, and budget categories, and view monthly analytics (savings rate, category breakdowns, budget vs. actual spending).

2. **Personal loan lifecycle** — users apply for a loan, get an AI-generated risk assessment and loan offer, disburse the loan, view an amortization schedule, pay EMIs/prepayments via Razorpay, and receive automated email reminders before due dates.

It solves the problem of fragmented financial tools by giving users a single dashboard to both **manage daily finances** and **handle loan repayment** — with the loan underwriting informed by the user's actual income and expense data already in the system.

---

### Q2. Walk me through the tech stack and why you chose each technology.

**Answer:**

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + Vite | Component-based UI, fast HMR with Vite, React Compiler for optimization |
| Backend | Node.js + Express 5 | JavaScript full-stack, non-blocking I/O for API + cron, large npm ecosystem |
| Database | MongoDB + Mongoose | Flexible schema for evolving loan/finance models, JSON-native, Atlas for cloud hosting |
| Auth | JWT + httpOnly cookies | Stateless auth without localStorage XSS risk |
| Validation | Joi (backend) + custom utils (frontend) | Declarative schema validation on API boundary |
| Payments | Razorpay | Leading Indian payment gateway, test mode for development |
| AI | Google Gemini (`gemini-flash-latest`) | Fast, cost-effective LLM for structured risk scoring |
| Scheduling | node-cron | Lightweight in-process cron without external scheduler |
| Email | nodemailer | Simple SMTP integration for EMI reminders |

**What we deliberately avoided:** React Router (state-based nav is simpler for 6 pages), Redux (no complex global state), UI libraries (custom CSS for full control).

---

### Q3. What are the main features of the application?

**Answer:**

1. **User authentication** — register, login, session persistence via JWT cookie
2. **Expense tracking** — CRUD with categories and payment methods (UPI, Cash, Card, etc.)
3. **Income tracking** — CRUD with source and optional remarks
4. **Budget categories** — named categories with budget limits
5. **Analytics dashboard** — monthly income/expense/savings, category breakdowns, budget tracking
6. **Loan application** — form with KYC, PAN, credit score, purpose
7. **AI loan underwriting** — Gemini analyzes financial profile → risk score → loan amount + interest rate
8. **Loan disbursement** — user picks amount and tenure, EMI calculated live
9. **Loan dashboard** — progress bar, amortization schedule, payment history
10. **Razorpay payments** — EMI, partial prepayment, full prepayment
11. **EMI email reminders** — cron job sends email 2 days before due date
12. **Settings** — placeholder for future features

---

### Q4. How is the project structured? Monolith or microservices?

**Answer:**

It is a **monorepo with a modular monolith** architecture — not microservices.

```
fintech-app/
├── backend/    ← Single Express server (all APIs + cron)
└── frontend/   ← Single React SPA
```

**Why monolith:**
- Small team / solo project — microservices add operational complexity
- All features share the same database and auth
- Easier to develop, debug, and deploy
- Can be split later if needed (e.g., extract payment service)

**Internal modularity:** Controllers, models, routes, services, jobs, and utils are separated by concern within the backend, making future extraction straightforward.

---

## 2. System Design & Architecture

### Q5. Explain the high-level architecture of FinTrack.

**Answer:**

```
┌──────────────┐     HTTP + Cookie     ┌──────────────────┐
│  React SPA   │ ◄──────────────────► │  Express API     │
│  (Vite)      │   credentials:include│  (Node.js)       │
└──────────────┘                      └────────┬─────────┘
                                               │
                    ┌──────────────────────────┼──────────────────┐
                    │                          │                  │
               ┌────▼────┐              ┌──────▼──────┐   ┌──────▼──────┐
               │ MongoDB │              │ Gemini AI   │   │  Razorpay   │
               │ Atlas   │              │ (Risk Score)│   │  (Payments) │
               └─────────┘              └─────────────┘   └─────────────┘
                                               │
                                        ┌──────▼──────┐
                                        │ SMTP Server │
                                        │ (Reminders) │
                                        └─────────────┘
```

**Flow:**
1. Frontend makes API calls with JWT cookie
2. Express routes → auth middleware → controller → Mongoose → MongoDB
3. Loan application additionally calls Gemini AI
4. Payments go through Razorpay (server creates order, client opens checkout, server verifies signature)
5. Cron job runs in-process, queries MongoDB, sends emails via SMTP

---

### Q6. Why did you use JWT in httpOnly cookies instead of localStorage?

**Answer:**

| Approach | XSS Risk | CSRF Risk | Mobile/SPA |
|----------|----------|-----------|------------|
| localStorage | **High** — any JS can read token | Low | Easy |
| httpOnly cookie | **Low** — JS cannot access cookie | Medium (mitigated with sameSite) | Requires credentials: include |

**Our choice: httpOnly cookie because:**

1. **XSS protection** — even if an attacker injects JavaScript, they cannot steal the JWT from `document.cookie` because `httpOnly: true` blocks JS access
2. **Automatic sending** — browser sends cookie on every request with `credentials: 'include'`, no manual header management
3. **sameSite: 'lax'** — provides CSRF protection for cross-origin POST requests
4. **secure flag in production** — cookie only sent over HTTPS

**Trade-off:** Slightly more complex CORS setup (`credentials: true` on both sides), and logout requires a server endpoint to clear the cookie (currently a gap — logout is client-side only).

---

### Q7. How does the frontend communicate with the backend?

**Answer:**

All API calls go through `frontend/src/api/http.js`:

```js
export async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',  // sends JWT cookie automatically
  })
  // ... error handling, JSON parse
}
```

**Key points:**
- `API_URL` is `http://localhost:3000` (configurable in `api/config.js`)
- Every request includes `credentials: 'include'` so the httpOnly cookie is sent
- Backend CORS is configured with `origin: ['http://localhost:5173', 'http://localhost:5174']` and `credentials: true`
- Four helpers: `apiGet`, `apiPost`, `apiPut`, `apiDelete`
- Each resource (auth, expenses, incomes, categories, loans) has its own API module wrapping these helpers

---

### Q8. Why didn't you use React Router?

**Answer:**

FinTrack has only **6 top-level pages** (Overview, Expenses, Income, Categories, Loans, Settings) plus loan sub-views managed by an internal state machine. React Router would add:

- A dependency and bundle size increase
- URL management complexity for a simple sidebar navigation
- No need for deep linking or bookmarkable sub-pages in the current scope

Instead, `Dashboard.jsx` uses `activePage` state:

```js
const [activePage, setActivePage] = useState('overview')
// Sidebar calls onNavigate('expenses') etc.
// renderPage() switch returns the correct component
```

The loan module has its own sub-state machine in `LoansPage.jsx` (`loading → form → disburse → dashboard → payment`).

**When I'd add React Router:** If we need shareable URLs, browser back/forward navigation, or more than ~10 pages.

---

## 3. Authentication & Security

### Q9. Explain the complete authentication flow.

**Answer:**

**Registration:**
1. User submits name, email, password
2. Frontend validates (name 2–20 chars, email format, password strength)
3. `POST /api/auth/register` → Joi validation → check email uniqueness → `bcrypt.hash(password, SALTS)` → save User → 201

**Login:**
1. User submits email, password
2. `POST /api/auth/login` → find user → `bcrypt.compare()` → `jwt.sign({ userId, name }, JWT_SECRET, { expiresIn: '1d' })` → set httpOnly cookie → return user info

**Session restore (page reload):**
1. `App.jsx` mounts → calls `GET /api/auth/me`
2. Browser sends cookie automatically
3. `authMiddleware` verifies JWT → returns `{ user: { id, name } }`
4. If valid → show Dashboard; if 401 → show AuthPage

**Protected requests:**
1. Any API call with `credentials: 'include'`
2. `authMiddleware` reads `req.cookies.token` → `jwt.verify()` → sets `req.user = { userId, name }`
3. Controller uses `req.user.userId` to scope data

---

### Q10. What is bcrypt and why use it for passwords?

**Answer:**

bcrypt is a **password hashing function** based on the Blowfish cipher with a built-in salt.

```js
const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALTS))
// SALTS = 13 (cost factor / number of rounds = 2^13 = 8192 iterations)
```

**Why bcrypt over plain SHA-256:**
1. **Slow by design** — 8192 iterations make brute-force attacks impractical
2. **Built-in salt** — each hash is unique even for identical passwords
3. **Adaptive** — increase SALTS over time as hardware gets faster
4. **Industry standard** — recommended by OWASP for password storage

**We never store plain-text passwords.** Login uses `bcrypt.compare(plainPassword, storedHash)` which handles salt extraction automatically.

---

### Q11. What are the password validation rules?

**Answer:**

Both frontend (`utils/validation.js`) and backend (`authController.js`) enforce:

```
Minimum 8 characters
At least 1 uppercase letter (A-Z)
At least 1 lowercase letter (a-z)
At least 1 digit (0-9)
At least 1 special character (non-alphanumeric)
```

Regex: `/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/`

**Why validate on both sides:**
- Frontend: immediate user feedback, better UX
- Backend: security — never trust client validation alone (API can be called directly via curl/Postman)

---

### Q12. What security vulnerabilities exist in the current auth implementation?

**Answer:**

| Vulnerability | Status | Mitigation |
|--------------|--------|------------|
| XSS token theft | Mitigated | httpOnly cookie |
| CSRF | Partially mitigated | sameSite: 'lax' |
| No server-side logout | **Gap** | Cookie persists until expiry; add logout endpoint |
| No token refresh | **Gap** | User must re-login after 24h |
| No rate limiting | **Gap** | Login endpoint vulnerable to brute force |
| No account lockout | **Gap** | Unlimited login attempts |
| Resource ownership | **Gap** | Update/delete don't verify userId on expenses/incomes |
| Password in transit | Depends on deployment | Must use HTTPS in production |

---

### Q13. How would you implement server-side logout?

**Answer:**

```js
// backend/controllers/authController.js
exports.logoutUser = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
  res.status(200).json({ success: true, message: 'Logged out' })
}

// backend/routes/authRoutes.js
router.post('/logout', authMiddleware, logoutUser)

// frontend
async function logout() {
  await apiPost('/api/auth/logout')
  setIsAuthenticated(false)
  setUser(null)
}
```

For stronger security, implement a **token blacklist** (Redis set of invalidated JWTs checked in authMiddleware) or switch to **refresh token rotation**.

---

## 4. Database & MongoDB

### Q14. Why MongoDB over SQL for this project?

**Answer:**

| Factor | MongoDB | SQL (PostgreSQL) |
|--------|---------|-----------------|
| Schema flexibility | Documents evolve easily (added `lastEmiReminderDueDate` without migration) | Requires ALTER TABLE |
| Nested data | Natural JSON documents | Requires JOINs |
| Loan models | 7 collections with references — manageable without complex joins | Would work but more boilerplate |
| Prototyping speed | Faster iteration | Stricter schema upfront |
| Financial transactions | **Weaker** — no ACID multi-document transactions by default | Strong ACID guarantees |

**Why MongoDB fits here:**
- Rapid prototyping of evolving loan/finance schemas
- Document model maps naturally to JSON API responses
- Mongoose provides schema validation, middleware, and population (like JOINs)
- MongoDB Atlas gives free cloud hosting

**When SQL would be better:** If we need strict financial transaction integrity (double-entry bookkeeping), complex reporting queries, or regulatory audit trails.

---

### Q15. Explain all the database models and their relationships.

**Answer:**

**7 collections:**

1. **User** — `{ name, email, password }` — root entity
2. **Category** — `{ userId, categoryName, categoryBudget }` — belongs to User
3. **Expense** — `{ userId, amount, categoryId, title, paymentMethod }` — belongs to User + Category
4. **Income** — `{ userId, amount, source, remark }` — belongs to User
5. **LoanForm** — `{ userId, applicantName, applicantEmail, ..., panNumber }` — loan application
6. **LoanDisbursed** — `{ loanFormId, userId, disbursedAmount, emiAmount, principalAmountLeft, ... }` — active loan
7. **LoanTransaction** — `{ loanDisbursedId, userId, transactionAmount, transactionType, razorpayPaymentId }` — payments

**Relationships:**
```
User 1──N Category
User 1──N Expense
User 1──N Income
User 1──N LoanForm
User 1──N LoanDisbursed
User 1──N LoanTransaction
Category 1──N Expense
LoanForm 1──1 LoanDisbursed
LoanDisbursed 1──N LoanTransaction
```

**No dedicated EMI table** — EMI schedule is computed at runtime from `disbursedDate + month offset`.

---

### Q16. What is Mongoose populate and where do you use it?

**Answer:**

Mongoose `populate()` replaces ObjectId references with the actual referenced document — similar to a SQL JOIN.

**Examples in FinTrack:**

```js
// Expense with category name (loanFormController)
Expense.find({ userId }).populate('categoryId', 'categoryName categoryBudget')

// Cron job with applicant details (emiReminderJob)
LoanDisbursed.find({ isActive: true })
  .populate('loanFormId', 'applicantName applicantEmail')
  .populate('userId', 'email name')
```

**Important:** Referenced models must be registered with Mongoose before populate is called. The cron job explicitly requires `LoanForm` and `User` models for this reason:

```js
require('../models/LoanForm')
require('../models/User')
```

Without this, running the job standalone throws `MissingSchemaError`.

---

### Q17. How would you handle a payment that needs to update both LoanTransaction and LoanDisbursed atomically?

**Answer:**

Currently, the Razorpay verify endpoint does two operations sequentially:

```js
const loanTransaction = await LoanTransaction.create({ ... })
const updatedLoan = await LoanDisbursed.findByIdAndUpdate(loanDisbursedId, { ... })
```

**Problem:** If the server crashes between these two operations, you get inconsistent state (transaction recorded but principal not updated, or vice versa).

**Solution — MongoDB multi-document transactions:**

```js
const session = await mongoose.startSession()
session.startTransaction()
try {
  const [transaction] = await LoanTransaction.create([{ ... }], { session })
  const loan = await LoanDisbursed.findByIdAndUpdate(id, { ... }, { session, new: true })
  await session.commitTransaction()
} catch (err) {
  await session.abortTransaction()
  throw err
} finally {
  session.endSession()
}
```

**Requirements:** MongoDB replica set (Atlas provides this by default). This ensures both writes succeed or both fail — critical for financial operations.

---

## 5. REST API Design

### Q18. How are API routes organized?

**Answer:**

Routes are split by resource, each mounted on a prefix in `index.js`:

```js
app.use('/api/auth', authRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/incomes', incomeRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/loans', loanFormRoutes)       // multiple files, same prefix
app.use('/api/loans', loanDisbursedRoutes)
app.use('/api/loans', loanTransactionRoutes)
app.use('/api/loans', loanPaymentRoutes)
```

Each route file:
1. Creates an Express Router
2. Applies `authMiddleware` (except auth routes)
3. Maps HTTP methods to controller functions

**Pattern:** Route → Middleware → Controller → Model → Response

---

### Q19. What HTTP status codes does the API use?

**Answer:**

| Code | Usage |
|------|-------|
| 200 | Successful GET, login |
| 201 | Resource created (register, create expense, payment verified) |
| 204 | Successful DELETE (no body) |
| 400 | Validation error, bad input, business rule violation |
| 401 | Missing or invalid JWT token |
| 403 | Authorized but not owner (e.g., paying someone else's loan) |
| 404 | Resource not found |
| 500 | Unhandled server error |

**Response format:**
```json
{
  "success": true/false,
  "message": "Human-readable message",
  "data": { ... }        // on success
  "error": "err.message"  // on 500
}
```

---

### Q20. Why validate with Joi on the backend if the frontend also validates?

**Answer:**

**Never trust the client.** Frontend validation is for UX (instant feedback). Backend validation is for security.

Attack scenarios without backend validation:
1. **Direct API calls** — attacker uses curl/Postman to send `{ amount: -5000 }` bypassing frontend checks
2. **Modified frontend** — user edits JavaScript in browser DevTools
3. **Automated bots** — scripts hitting API endpoints directly

Joi validates at the API boundary:
```js
const schema = joi.object({
  transactionAmount: joi.number().positive().required(),
  transactionType: joi.string().valid('EMI', 'Partial Prepayment', 'Full Prepayment').required(),
})
const { error } = schema.validate(req.body)
if (error) return res.status(400).json({ message: error.details[0].message })
```

---

## 6. Personal Finance Module

### Q21. How does the analytics dashboard work?

**Answer:**

The Overview page (`AnalyticsOverview.jsx`) fetches all user expenses and incomes, then computes analytics **client-side** in `utils/analytics.js`:

1. **Filter by month** — `filterByMonth(records, year, month)` using `createdAt` timestamps
2. **Monthly totals** — sum income amounts, sum expense amounts
3. **Net savings** — income − expenses
4. **Savings rate** — (savings / income) × 100
5. **Category breakdown** — group expenses by categoryId, sum amounts, compare to category budget
6. **Income source breakdown** — group by source field
7. **Payment method breakdown** — group by paymentMethod enum
8. **Recent transactions** — last N expenses sorted by date

**Month navigation:** Dashboard passes `year` and `month` state to AnalyticsOverview. A MonthSelector component increments/decrements the month.

**Why client-side:** Dataset is small (personal finance), avoids complex backend aggregation endpoints, and gives instant recalculation when switching months.

---

### Q22. How are categories linked to expenses?

**Answer:**

Expenses store a `categoryId` (ObjectId reference to Category):

```js
// Expense model
categoryId: { type: ObjectId, ref: 'Category', required: true }
```

When creating an expense, the user selects a category from a dropdown populated by their categories. The frontend sends `categoryId` in the POST body.

For analytics, expenses are grouped by category:
```js
expenses.forEach(expense => {
  const catId = expense.categoryId
  breakdown[catId] = (breakdown[catId] || 0) + expense.amount
})
```

Budget tracking compares `breakdown[catId]` against `category.categoryBudget`.

---

## 7. Loan Module & Business Logic

### Q23. Explain the complete loan lifecycle step by step.

**Answer:**

**Step 1 — Application:**
- User fills loan form (name, email, PAN, credit score, KYC, purpose)
- `POST /api/loans/loan-form`
- Backend checks no active loan exists
- Creates LoanForm, fetches income/expense history
- Sends data to Gemini AI → risk score → loan amount + interest rate
- Returns offer to frontend

**Step 2 — Disbursement:**
- User sees approved amount and rate
- Adjusts sliders: amount (₹50K–max) and tenure (6–48 months)
- Frontend calculates EMI live
- `POST /api/loans/loan-disbursed` creates LoanDisbursed record

**Step 3 — Dashboard:**
- Shows loan summary, progress bar, amortization schedule
- Fetches transactions, overlays paid status on schedule
- User can view payment history

**Step 4 — Payment:**
- User selects EMI / Partial Prepay / Full Prepay
- Razorpay checkout flow (create order → pay → verify)
- Backend records LoanTransaction, updates principalAmountLeft
- Loan closes if principal reaches 0

**Step 5 — Reminders:**
- Daily cron checks active loans
- Sends email 2 days before next EMI due date

---

### Q24. Why is only one active loan allowed per user?

**Answer:**

Business rule enforced at two points:

1. **Application** (`loanFormController.js`):
   ```js
   const existingLoan = await LoanDisbursed.findOne({ userId, isActive: true })
   if (existingLoan) return res.status(400).json({ message: "You already have an active loan!" })
   ```

2. **Disbursement** (`loanDisbursedController.js`) — same check

**Reasons:**
- Simplifies UI — no need for multi-loan dashboard
- Reduces credit risk — prevents over-leveraging
- Matches typical personal loan products (one active loan at a time)
- Makes EMI reminder cron simpler (one loan to track per user)

---

### Q25. What happens when a user does a full prepayment?

**Answer:**

1. Frontend sets `transactionAmount = loan.principalAmountLeft` and `transactionType = 'Full Prepayment'`
2. Razorpay order created for full remaining amount
3. On verify (`loanPaymentController.js`):
   ```js
   finalPrincipalAmount = loan.principalAmountLeft - transactionAmount  // → 0
   LoanTransaction.create({ transactionType: 'Full Prepayment', ... })
   
   if (transactionType === 'Full Prepayment' || finalPrincipalAmount === 0) {
     updatePayload.isActive = false  // close the loan
   }
   LoanDisbursed.findByIdAndUpdate(loanDisbursedId, updatePayload)
   ```
4. Frontend schedule marks all pending rows as `closed`
5. User can now apply for a new loan (no active loan check passes)

---

### Q26. How does the frontend loan state machine work?

**Answer:**

`LoansPage.jsx` manages five views via a `view` state variable:

```js
const VIEWS = { LOADING: 'loading', FORM: 'form', DISBURSE: 'disburse', DASHBOARD: 'dashboard', PAYMENT: 'payment' }
```

**Transitions:**

| From | To | Trigger |
|------|----|---------|
| loading | form | GET /get-loan returns 404 (no active loan) |
| loading | dashboard | GET /get-loan returns active loan |
| form | disburse | Application submitted successfully |
| disburse | dashboard | Loan disbursed successfully |
| disburse | form | User clicks Back |
| dashboard | payment | User clicks Pay |
| payment | dashboard | Payment verified or user clicks Back |

On mount, `loadActiveLoan()` determines initial view. After payment, `handlePaymentSuccess()` refreshes data and returns to dashboard.

---

## 8. EMI Calculation

### Q27. Explain the EMI formula and why reducing balance method is used.

**Answer:**

**Formula (reducing balance):**
```
monthlyRate = annualRate / 12 / 100
EMI = P × r × (1+r)^n / ((1+r)^n - 1)
```

Where P = principal, r = monthly rate, n = tenure in months.

**Example:** ₹5,00,000 at 15% p.a. for 24 months:
- monthlyRate = 15/12/100 = 0.0125
- EMI = 500000 × 0.0125 × (1.0125)^24 / ((1.0125)^24 - 1) ≈ ₹24,482

**Why reducing balance (not flat rate):**
- Interest is calculated on **outstanding principal**, which decreases each month
- Industry standard in India (RBI regulated lenders use this)
- Fairer to borrower — total interest is lower than flat rate
- Each EMI has decreasing interest component and increasing principal component

**Flat rate alternative:** Interest = P × rate × tenure / 12 — simpler but borrower pays more total interest.

---

### Q28. How is the amortization schedule generated?

**Answer:**

`generateRepaymentSchedule(principal, annualRate, tenureMonths, startDate)`:

```js
for (let month = 1; month <= tenureMonths; month++) {
  interest = round(balance × monthlyRate)
  principalPart = min(emi - interest, balance)
  balance = max(0, balance - principalPart)
  dueDate = disbursedDate + month  // using setMonth()
  
  schedule.push({ month, dueDate, emi, principal, interest, balance, status: 'pending' })
}
```

**Key points:**
- EMI amount is fixed for all months
- Interest portion decreases over time
- Principal portion increases over time
- Last EMI may have a slightly different principal part (rounding)
- Due dates are `disbursedDate + N months` (EMI 1 due 1 month after disbursement)

---

### Q29. Why are EMI due dates computed at runtime instead of stored in the database?

**Answer:**

**Current approach:**
- Due date for EMI #N = `disbursedDate + N months`
- Paid status = count of EMI transactions
- Next due date = schedule[paidCount + 1]

**Pros:**
- No extra collection/table needed
- Single source of truth (disbursedDate + transactions)
- Schedule automatically adjusts if logic changes
- Simpler data model

**Cons:**
- Must recompute on every dashboard load and cron run
- Cannot easily query "all EMIs due this week" in MongoDB
- Prepayment doesn't recalculate remaining schedule (frontend marks visual indicator only)
- Performance concern at scale (thousands of loans)

**When to store:** If we need DB-level queries on due dates, audit trails, or regulatory reporting — create an `EmiSchedule` collection with one document per EMI row.

---

### Q30. How does the frontend mark EMIs as paid on the schedule?

**Answer:**

`applyTransactionsToSchedule(schedule, transactions)`:

1. Sort transactions oldest-first
2. For each transaction:
   - **EMI** → find first `pending` row, mark as `paid`, record `paidOn` and `paidAmount`
   - **Partial Prepayment** → mark first pending row as `partial-prepay`
   - **Full Prepayment** → mark all pending rows as `closed`

```js
let emiPaidCount = 0
for (const txn of sorted) {
  if (txn.transactionType === 'EMI') {
    const target = updated.find(row => row.status === 'pending')
    if (target) {
      target.status = 'paid'
      target.paidOn = txn.transactionDate
    }
    emiPaidCount += 1
  }
}
```

This is a **simplified overlay** — it doesn't recalculate the schedule after prepayment (remaining EMIs stay the same amount, only principal tracking changes on the loan document).

---

## 9. AI Risk Scoring (Gemini)

### Q31. How does the AI loan underwriting work?

**Answer:**

When a user submits a loan application, the backend:

1. **Collects data:**
   - Loan form fields (name, PAN, credit score, purpose, KYC status)
   - All user income records (amount, source)
   - All user expense records (amount, category, payment method)
   - Pre-computed aggregates (total income, total expenses, surplus, expense-to-income ratio)

2. **Builds a prompt** for Gemini (`gemini-flash-latest`):
   - Role: "credit risk analyst for an Indian fintech lending platform"
   - Instructions: compute risk score 0.00–1.00 (higher = riskier)
   - Factors: credit score, income stability, expense ratio, loan purpose, KYC
   - Penalty if income/expense data is missing (max score 0.40)

3. **Parses response:**
   ```js
   const riskScore = parseRiskScore(response.text)  // extract number, clamp 0–1
   ```

4. **Computes offer:**
   ```js
   loanAmount = 5,000,000 × riskScore    // up to ₹50 lakh
   interestRate = band based on riskScore // 10% to 25%
   ```

---

### Q32. Why use AI for risk scoring instead of a rule-based engine?

**Answer:**

| Approach | Pros | Cons |
|----------|------|------|
| **Rule-based** | Deterministic, explainable, fast, no API cost | Rigid, hard to capture complex patterns |
| **AI (Gemini)** | Considers multiple factors holistically, adapts to varied profiles | Non-deterministic, API latency/cost, harder to explain |
| **ML model** | Best accuracy with training data | Needs historical loan performance data we don't have |

**Why AI fits this project:**
- Demonstrates integration of modern AI into fintech workflows
- No training data needed (zero-shot with structured prompt)
- Handles varied financial profiles without hardcoding every rule
- Uses existing income/expense data from the finance module — unique advantage

**Production improvement:** Replace with a trained ML model once sufficient loan performance data exists. Use AI as a fallback or for edge cases.

---

### Q33. What happens if the Gemini API fails or returns invalid data?

**Answer:**

**Current behavior:** The entire loan application fails with a 500 error:

```js
catch (err) {
  res.status(500).json({ success: false, message: "Internal Server Error!", error: err.message })
}
```

The LoanForm is already created before the AI call, so a failed AI call leaves an orphaned application record.

**Improvements:**
1. **Fallback scoring** — if AI fails, use a rule-based score from credit score + expense ratio
2. **Retry logic** — retry Gemini call 2–3 times with exponential backoff
3. **Transaction wrapping** — create LoanForm only after successful AI response
4. **Response validation** — `parseRiskScore()` already handles invalid text, but could add more robust parsing
5. **Circuit breaker** — if Gemini is down, automatically switch to rule-based scoring
6. **Async processing** — return "application received" immediately, process AI scoring in background, notify user when offer is ready

---

## 10. Razorpay Payment Integration

### Q34. Explain the Razorpay payment flow in detail.

**Answer:**

**Step 1 — Create Order (Server):**
```js
POST /api/loans/razorpay/create-order
Body: { loanDisbursedId, transactionAmount, transactionType }

Server:
  1. Validate input (Joi)
  2. validateLoanPayment() — ownership, active status, amount ≤ principal
  3. razorpay.orders.create({ amount: amountInPaise, currency: 'INR', receipt, notes })
  4. Return { keyId, orderId, amount, currency }
```

**Step 2 — Checkout (Client):**
```js
Frontend:
  1. Load checkout.js dynamically
  2. Open Razorpay modal with order details
  3. User pays via UPI/Card/NetBanking
  4. Razorpay returns { razorpay_order_id, razorpay_payment_id, razorpay_signature }
```

**Step 3 — Verify (Server):**
```js
POST /api/loans/razorpay/verify
Body: { loanDisbursedId, transactionAmount, transactionType, razorpay_order_id, razorpay_payment_id, razorpay_signature }

Server:
  1. HMAC-SHA256: hash(order_id|payment_id, key_secret) === signature
  2. Re-validate loan ownership and amount
  3. Create LoanTransaction
  4. Update principalAmountLeft
  5. Close loan if full prepay or principal = 0
```

---

### Q35. Why create the order on the server instead of the client?

**Answer:**

**Security.** If the client created the order:
1. Attacker could modify `amount` in the request — pay ₹1 for a ₹24,000 EMI
2. No ownership validation before payment
3. Payment could be initiated for another user's loan

**Server-side order creation ensures:**
- Amount is validated against `principalAmountLeft`
- Loan ownership is verified (`loan.userId === req.user.userId`)
- Loan is active (`isActive === true`)
- Amount is converted to paise server-side (no floating point issues)
- Order notes store metadata for reconciliation

The client never decides the payment amount — it only opens the Razorpay modal with server-provided order details.

---

### Q36. How does Razorpay signature verification work?

**Answer:**

Razorpay generates an HMAC-SHA256 signature using your `key_secret`:

```
signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
```

**Server verification:**
```js
const body = `${razorpay_order_id}|${razorpay_payment_id}`
const expectedSignature = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(body)
  .digest('hex')

if (expectedSignature !== razorpay_signature) {
  return res.status(400).json({ message: 'Invalid payment signature!' })
}
```

**Why this matters:**
- Proves the payment callback genuinely came from Razorpay
- Prevents attackers from forging payment confirmations
- Must happen server-side (key_secret never exposed to client)
- Only after verification do we record the transaction and update the loan

---

### Q37. What is the difference between Razorpay test mode and live mode?

**Answer:**

| Aspect | Test Mode | Live Mode |
|--------|-----------|-----------|
| Keys | `rzp_test_xxxxx` | `rzp_live_xxxxx` |
| Money | No real money transferred | Real money transferred |
| Cards | Use test card numbers (4111...) | Real cards |
| UPI | Test UPI IDs | Real UPI |
| Webhooks | Same format, test events | Production events |
| Dashboard | Separate test/live toggle | Real transaction reports |

FinTrack uses test keys (`rzp_test_Sk9w5hJL0oTpPc`) in development. For production, swap to live keys and ensure HTTPS.

---

## 11. Cron Jobs & Email

### Q38. Explain the EMI reminder cron job in detail.

**Answer:**

**Purpose:** Send email reminders to borrowers 2 days before their next EMI due date.

**Schedule:** Daily at 9:00 AM IST (`0 9 * * *`), configurable via `EMI_REMINDER_CRON`.

**Algorithm:**
1. Query `LoanDisbursed.find({ isActive: true })`
2. Populate applicant email and user email
3. For each loan:
   - Skip if `principalAmountLeft <= 0`
   - Count paid EMIs from transactions
   - Compute next due date: `disbursedDate + (paidCount + 1) months`
   - Compare: is due date exactly 2 calendar days from today (IST)?
   - Skip if `lastEmiReminderDueDate` matches (already sent)
   - Send HTML email via nodemailer
   - Save `lastEmiReminderDueDate` on loan document

**Started in:** `index.js` after MongoDB connects:
```js
mongoose.connect(MONGODB_URI).then(() => {
  require('./jobs/emiReminderJob').start()
})
```

---

### Q39. Why use node-cron instead of a separate job scheduler?

**Answer:**

| Approach | Pros | Cons |
|----------|------|------|
| **node-cron (in-process)** | Simple, no extra infrastructure, runs with the server | Dies if server restarts, no distributed locking, single instance only |
| **Cron on OS (crontab)** | Independent of app process | Needs separate script, deployment complexity |
| **Bull/BullMQ + Redis** | Distributed, retry, dashboard, persistent | Requires Redis, more setup |
| **AWS EventBridge / Cloud Scheduler** | Managed, scalable, reliable | Cloud vendor lock-in, cost |

**Why node-cron fits:**
- Small scale (personal/portfolio project)
- Job runs once daily — brief downtime on restart is acceptable
- No extra infrastructure needed
- `lastEmiReminderDueDate` prevents duplicate sends on restart

**When to upgrade:** Multiple server instances (need distributed lock), sub-minute scheduling, or job retry/dead-letter requirements → use Bull + Redis.

---

### Q40. How do you prevent duplicate reminder emails?

**Answer:**

Two mechanisms:

1. **Date matching** — only sends when due date is exactly 2 days away. Since cron runs once daily, each EMI matches on exactly one day.

2. **`lastEmiReminderDueDate` field** on `LoanDisbursed`:
   ```js
   if (loan.lastEmiReminderDueDate && isSameCalendarDay(loan.lastEmiReminderDueDate, dueDate, TIMEZONE)) {
     skipped += 1
     continue  // already sent for this due date
   }
   // After sending:
   loan.lastEmiReminderDueDate = dueDate
   await loan.save()
   ```

This handles edge cases:
- Server restart and cron re-runs on the same day
- Manual test script run on the same day as cron
- Multiple server instances (partial protection — full protection needs distributed lock)

---

### Q41. How does nodemailer send emails in this project?

**Answer:**

`services/emailService.js`:

1. **Create transporter** from env vars:
   ```js
   nodemailer.createTransport({
     host: SMTP_HOST,       // smtp.gmail.com
     port: SMTP_PORT,       // 587
     secure: false,         // true for 465
     auth: { user: SMTP_USER, pass: SMTP_PASS }
   })
   ```

2. **Build HTML email** with borrower name, EMI number, amount (INR formatted), due date (IST formatted)

3. **Send:**
   ```js
   transporter.sendMail({
     from: EMAIL_FROM,
     to: applicantEmail,
     subject: 'EMI due in 2 days — ₹24,482 on Monday, 9 September 2026',
     html: buildEmiReminderHtml({ ... })
   })
   ```

For Gmail, use an **App Password** (not your regular password) with 2FA enabled.

---

## 12. Frontend (React)

### Q42. How does session persistence work on page reload?

**Answer:**

`App.jsx` runs on every page load:

```js
useEffect(() => {
  async function restoreSession() {
    try {
      const data = await getCurrentUser()  // GET /api/auth/me
      setUser(data.user)
      setIsAuthenticated(true)
    } catch {
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsCheckingSession(false)
    }
  }
  restoreSession()
}, [])
```

**Flow:**
1. Page loads → show "Checking your session..."
2. Call `/api/auth/me` — browser sends JWT cookie automatically
3. If cookie valid → JWT verified → user data returned → show Dashboard
4. If cookie expired/missing → 401 → show AuthPage

The JWT cookie has `maxAge: 24 hours`, so sessions persist across browser restarts within that window.

---

### Q43. How is the loan payment page integrated with Razorpay?

**Answer:**

`LoanPaymentPage.jsx` + `utils/razorpay.js`:

1. User selects payment type (EMI / Partial / Full) and amount
2. Frontend calls `createRazorpayOrder()` API
3. `openLoanRazorpayCheckout()`:
   - Dynamically loads `checkout.js` script
   - Creates Razorpay instance with server order details
   - Opens payment modal
4. On payment success, Razorpay calls the `handler` callback
5. Handler calls `verifyRazorpayPayment()` API with payment IDs + signature
6. On verify success → `onPaymentSuccess()` → refresh loan data → return to dashboard
7. On dismiss/failure → show error message

```js
const result = await openLoanRazorpayCheckout({
  order,                    // from create-order API
  paymentPayload,           // { loanDisbursedId, transactionAmount, transactionType }
  verifyPayment,            // API function
  description: 'EMI Payment',
  prefill: { name, email, contact }
})
```

---

### Q44. Why is analytics computed on the frontend instead of the backend?

**Answer:**

**Current approach:** Frontend fetches raw expense/income arrays, computes all analytics in `utils/analytics.js`.

**Pros:**
- No backend aggregation endpoints needed
- Instant month switching (no API call)
- Simple backend — just CRUD
- Dataset is small (personal finance, hundreds of records max)

**Cons:**
- Transfers all data to client (bandwidth)
- Computation on client device (negligible for small datasets)
- Cannot cache aggregated results
- Analytics logic duplicated if mobile app is added

**When to move to backend:** Large datasets (thousands of transactions), need for cached/pre-computed reports, or multiple client platforms sharing analytics logic.

---

## 13. Node.js & Express

### Q45. Explain the Express middleware chain for a protected route.

**Answer:**

Example: `GET /api/expenses/user-expenses`

```
Request arrives
  │
  ▼
express.json()          ← Parse JSON body
  │
  ▼
cors({ origin, credentials: true })  ← Allow cross-origin with cookies
  │
  ▼
cookieParser()          ← Parse cookies → req.cookies
  │
  ▼
expenseRoutes           ← Match route
  │
  ▼
authMiddleware          ← Verify JWT from req.cookies.token
  │                       Sets req.user = { userId, name }
  │                       Returns 401 if invalid
  ▼
getUserExpenses()       ← Controller: Expense.find({ userId: req.user.userId })
  │
  ▼
Response JSON
```

---

### Q46. What happens when the server starts?

**Answer:**

`backend/index.js` execution order:

1. Load dotenv → read `.env`
2. Create Express app
3. Register middleware (json, cors, cookieParser)
4. Mount all route files on `/api/*` prefixes
5. `mongoose.connect(MONGODB_URI)`:
   - On success → log "MongoDB connected" → `emiReminderJob.start()` (registers cron)
   - On failure → log error
6. `app.listen(PORT)` → server accepting requests

The cron job runs in the same Node.js process as the API server.

---

## 14. Error Handling & Validation

### Q47. How is error handling done across the application?

**Answer:**

**Backend pattern (every controller):**
```js
try {
  // validation → business logic → database operation
  res.status(200/201).json({ success: true, data })
} catch (err) {
  res.status(500).json({ success: false, message: "Internal Server Error!", error: err.message })
}
```

**Validation errors:** 400 with Joi message
**Auth errors:** 401 from middleware
**Not found:** 404 with message
**Authorization:** 403 (e.g., paying someone else's loan)

**Frontend pattern:**
```js
try {
  const res = await apiPost('/api/...', data)
  // handle success
} catch (err) {
  setError(err.message)  // displayed in UI
}
```

**Cron job:** Per-loan try/catch — one failed email doesn't block others:
```js
for (const loan of activeLoans) {
  try { /* send email */ }
  catch (err) { console.error(`Failed for loan ${loan._id}:`, err.message) }
}
```

---

## 15. Performance & Scalability

### Q48. What are the scalability bottlenecks in the current architecture?

**Answer:**

| Bottleneck | Impact | Solution |
|-----------|--------|----------|
| Cron in-process | Doesn't scale to multiple server instances | Move to Bull + Redis or external scheduler |
| No caching | Every request hits MongoDB | Add Redis cache for frequent reads |
| Client-side analytics | Transfers all data to browser | Backend aggregation endpoints |
| No pagination | All expenses/incomes fetched at once | Add limit/skip pagination |
| No database indexes | Slow queries as data grows | Index userId, isActive, loanDisbursedId |
| Synchronous Gemini call | Blocks loan application response | Async processing with webhook/notification |
| Single MongoDB connection | Connection pool limits | Configure pool size, read replicas |
| No CDN for frontend | Single server serves static files | Deploy to Vercel/Netlify/S3+CloudFront |

---

### Q49. What MongoDB indexes would you add?

**Answer:**

```js
// User — already unique on email via schema

// Expense — most queries filter by userId
ExpenseSchema.index({ userId: 1, createdAt: -1 })

// Income — same pattern
IncomeSchema.index({ userId: 1, createdAt: -1 })

// Category
CategorySchema.index({ userId: 1 })

// LoanDisbursed — active loan lookup + cron job
LoanDisbursedSchema.index({ userId: 1, isActive: 1 })
LoanDisbursedSchema.index({ isActive: 1 })

// LoanTransaction — payment history per loan
LoanTransactionSchema.index({ loanDisbursedId: 1, transactionDate: -1 })
LoanTransactionSchema.index({ loanDisbursedId: 1, transactionType: 1 })

// LoanForm
LoanFormSchema.index({ userId: 1 })
```

These cover the most frequent query patterns: user-scoped lists, active loan lookup, and cron job iteration.

---

## 16. Testing & Debugging

### Q50. How do you test the EMI reminder cron job?

**Answer:**

Use `backend/scripts/testEmiReminder.js`:

```bash
# 1. Dry run — see which loans qualify (no emails)
node scripts/testEmiReminder.js

# 2. Real cron logic — sends for EMIs due in 2 days
node scripts/testEmiReminder.js --send

# 3. Custom window — e.g., EMIs due today
node scripts/testEmiReminder.js --send --days 0

# 4. Force send — ignores due date, sends to first active loan
node scripts/testEmiReminder.js --send --force
```

**Output shows:**
- Today's date and target due date (IST)
- Each active loan with borrower, next EMI date, qualification status
- Sent/skipped counts

**For real cron path testing:** Adjust a loan's `disbursedDate` so the next unpaid EMI falls exactly 2 days from today.

---

### Q51. How would you add automated tests to this project?

**Answer:**

**Backend (Jest + Supertest):**
```js
// Unit tests
- loanCalculations.test.js → EMI formula, schedule generation, date helpers
- parseRiskScore.test.js → AI response parsing

// Integration tests
- auth.test.js → register, login, me endpoint
- loanFlow.test.js → application → disbursement → payment
- razorpay.test.js → order creation, signature verification (mock Razorpay)

// Test DB: mongodb-memory-server (in-memory MongoDB)
```

**Frontend (Vitest + React Testing Library):**
```js
- validation.test.js → all validation functions
- analytics.test.js → monthly filtering, breakdowns
- loanCalculations.test.js → EMI matches backend
- LoginForm.test.jsx → form submission, error display
```

**E2E (Playwright/Cypress):**
```js
- Full loan flow: register → add income/expenses → apply → disburse → pay EMI
- Auth flow: register → login → reload → still authenticated
```

---

## 17. Behavioral & Scenario-Based

### Q52. A user reports they paid an EMI but the dashboard still shows it as pending. How do you debug?

**Answer:**

**Investigation steps:**

1. **Check LoanTransaction collection:**
   ```js
   db.loantransactions.find({ loanDisbursedId: ObjectId("...") })
   ```
   Is there a transaction with `transactionType: 'EMI'` and the correct `razorpayPaymentId`?

2. **If no transaction exists:**
   - Payment may have failed at Razorpay but UI showed success
   - Verify endpoint may have rejected the signature
   - Check server logs for errors during verify

3. **If transaction exists but UI shows pending:**
   - Frontend schedule overlay issue — check `applyTransactionsToSchedule()`
   - Transactions may not be fetched (API error silently caught)
   - Browser cache — hard refresh

4. **Check Razorpay dashboard:**
   - Was payment actually captured?
   - Match `razorpay_payment_id` with our transaction record

5. **Check principalAmountLeft:**
   - Was it updated after payment?
   - If transaction exists but principal unchanged → verify endpoint partially failed

**Fix:** If payment was captured by Razorpay but not recorded, manually create the LoanTransaction and update principalAmountLeft (with audit log).

---

### Q53. How would you deploy this application to production?

**Answer:**

**Backend:**
1. Deploy to Railway / Render / AWS EC2 / DigitalOcean
2. Set all env vars (production MongoDB Atlas, live Razorpay keys, SMTP)
3. Set `NODE_ENV=production` (enables secure cookies)
4. Use PM2 or Docker for process management
5. Enable HTTPS (required for secure cookies and Razorpay)

**Frontend:**
1. Build: `npm run build` → static files in `dist/`
2. Deploy to Vercel / Netlify / S3 + CloudFront
3. Update `API_URL` to production backend URL
4. Update backend CORS origins to include production frontend URL

**Database:**
1. MongoDB Atlas with production cluster
2. Enable backup, add indexes
3. IP whitelist for backend server

**Monitoring:**
1. Server logs (PM2 logs / CloudWatch)
2. Uptime monitoring (UptimeRobot)
3. Error tracking (Sentry)
4. Razorpay webhook for payment reconciliation

---

### Q54. A user tries to pay EMI but gets "Invalid payment signature". What happened?

**Answer:**

The Razorpay signature verification failed:

```js
expectedSignature = HMAC-SHA256(order_id|payment_id, key_secret)
if (expectedSignature !== razorpay_signature) → 400 Invalid payment signature
```

**Possible causes:**

1. **Wrong key_secret** — `.env` has incorrect `RAZORPAY_KEY_SECRET`
2. **Test vs live key mismatch** — order created with test key, verify uses live key (or vice versa)
3. **Tampered payload** — frontend modified payment IDs before sending to verify
4. **Order ID mismatch** — frontend sent different order_id than what Razorpay returned
5. **Encoding issue** — special characters in order_id or payment_id

**Debug:**
1. Log `body`, `expectedSignature`, and `razorpay_signature` (don't log key_secret)
2. Verify keys in Razorpay dashboard match `.env`
3. Test with Razorpay test cards in test mode
4. Check if order was created and payment was on the same Razorpay account

---

### Q55. How would you add multi-loan support?

**Answer:**

**Database changes:**
- Remove single active loan constraint
- Add loan status enum: `pending, active, closed, defaulted`
- Loan list API: `GET /api/loans/all` → all user's loans

**Backend changes:**
- Remove `findOne({ isActive: true })` checks
- Add loan selection to payment and dashboard endpoints
- Cron job already handles multiple loans (iterates all active)

**Frontend changes:**
- Loans page shows loan list instead of single loan
- Click a loan → its dashboard
- Application form available if no *pending* application
- Payment page receives specific `loanDisbursedId`

**Minimal change approach:** Keep one active loan but allow new application after previous loan is closed (already works).

---

## 18. Improvements & Trade-offs

### Q56. What would you improve if you had more time?

**Answer:**

**High priority:**
1. Server-side logout endpoint + token invalidation
2. Resource ownership checks on update/delete
3. MongoDB transactions for payment recording
4. Automated tests (unit + integration)
5. Database indexes

**Medium priority:**
6. Pagination on expense/income lists
7. Backend analytics aggregation API
8. Async loan application processing (AI scoring in background)
9. File upload for KYC documents (S3/Cloudinary)
10. Settings page (profile edit, password change)

**Nice to have:**
11. Shared npm package for EMI calculations
12. Email notification preferences
13. SMS reminders (Twilio)
14. Admin dashboard for loan management
15. Loan rejection flow with minimum risk threshold
16. React Router for proper URL navigation
17. Docker Compose for one-command setup

---

### Q57. What was the hardest technical challenge in this project?

**Answer:**

**Candidate answer — Razorpay integration:**

The payment flow spans frontend and backend with strict security requirements:
1. Server must create the order (can't trust client amount)
2. Client opens Razorpay modal with server order
3. Server must verify HMAC signature before recording payment
4. Payment recording must update both transaction and loan atomically
5. Three payment modes (EMI, partial, full) with different amount logic

Getting the signature verification right and handling edge cases (payment cancelled, failed, network error during verify) required careful coordination between `loanPaymentController.js`, `razorpay.js`, and `LoanPaymentPage.jsx`.

**Alternative answer — EMI cron job:**

EMI due dates aren't stored in the database — they're computed from `disbursedDate + month offset`. Building a reliable cron that:
- Matches the frontend schedule exactly
- Handles timezone correctly (IST)
- Prevents duplicate emails
- Works when run standalone (Mongoose model registration)

Required mirroring the frontend's `loanCalculations.js` on the backend and careful date comparison logic.

---

### Q58. Explain a trade-off you made in this project.

**Answer:**

**Duplicate EMI logic (frontend + backend) vs. shared package:**

We have identical `loanCalculations.js` in both frontend and backend. A shared npm package would be DRY, but:

- **Chosen:** Duplicate the ~100 lines in both places
- **Why:** Avoids monorepo tooling complexity (Lerna, Turborepo), keeps frontend and backend independently deployable, and the logic is stable (EMI formula doesn't change)
- **Risk:** Logic drift if one copy is updated without the other
- **Mitigation:** Comments in both files reference each other; test script validates same output

This is a pragmatic trade-off for a portfolio project that would change if the team or deployment complexity grows.

---

### Q59. How does this project demonstrate full-stack skills?

**Answer:**

| Skill | Demonstrated In |
|-------|----------------|
| **Frontend** | React 19, state management, form handling, API integration, dynamic script loading |
| **Backend** | Express REST API, middleware chain, controller pattern, Joi validation |
| **Database** | MongoDB schema design, Mongoose ODM, references, population, timestamps |
| **Authentication** | JWT, bcrypt, httpOnly cookies, CORS with credentials, session restore |
| **Payment integration** | Razorpay server-side orders, HMAC verification, multi-mode payments |
| **AI integration** | Gemini API, prompt engineering, response parsing, risk scoring |
| **Scheduled jobs** | node-cron, email delivery, idempotent processing, test scripts |
| **Financial math** | EMI calculation, amortization schedule, reducing balance method |
| **Security** | Server-side validation, signature verification, ownership checks, XSS/CSRF mitigation |
| **DevOps awareness** | Environment variables, production cookie settings, deployment considerations |

---

### Q60. If you were interviewing someone who built this project, what would you ask?

**Answer:**

**Must-ask questions:**
1. Why httpOnly cookies over localStorage for JWT?
2. Walk me through the Razorpay payment flow
3. How is the EMI calculated? What's reducing balance?
4. Why compute EMI due dates at runtime instead of storing them?
5. How does the AI risk scoring work?
6. What happens if the cron job runs twice on the same day?
7. How would you make the payment recording atomic?
8. What's missing for production readiness?

**Deep-dive questions:**
9. How would you prevent a user from paying another user's loan?
10. Explain the HMAC signature verification step by step
11. What MongoDB indexes would you add and why?
12. How would you handle Gemini API failure during loan application?
13. What's the difference between partial prepayment and EMI in the schedule overlay?
14. How would you scale the cron job to 100,000 active loans?

**Red flags in answers:**
- Doesn't know how JWT cookie auth works
- Can't explain why server creates Razorpay order
- Thinks EMI uses flat rate interest
- Unaware of ownership validation gaps
- Can't describe what happens on full prepayment

---

*This document covers 60 questions across 18 categories. Review the [README](./README.md) for architecture diagrams, API reference, and setup instructions.*
