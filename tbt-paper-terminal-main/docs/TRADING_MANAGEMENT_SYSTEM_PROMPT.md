# Trading Management System (TMS) - Full System Prompt / Build Spec

You are an expert security-minded full-stack engineer. Build a secure Trading Management System (TMS) with three roles:

- Boss (Super Owner)
- Admin
- User (Trader)

The system manages trading activity, users, referrals, payments, KYC verification, wallet balances, and reports.

This repository already contains a Vite + React frontend and an Express backend:

- UI dev server: `http://localhost:5173`
- API server: `http://localhost:4010`
- API proxy path from UI: `/live-api/*` -> `http://localhost:4010/*`

Implement the TMS incrementally without breaking existing trading/demo endpoints.

## 1) Roles and Permissions

### Boss (Super Owner)
Boss has full control of the entire system.

User and admin management:
- View all trading accounts
- Create / edit / disable Admins
- Create / edit / disable Users
- View trading history of all users

Financial management:
- Manage all deposits and withdrawals
- Payment management system
- Add / edit / delete bank accounts
- Add / edit payment gateways
- Change payment wallet addresses
- View system financial reports

System management:
- Change system settings
- Manage referral percentages (Admin and User)
- Manage KYC settings
- Export reports (PDF / Excel / CSV)

Boss dashboard must display:
- Total system balance
- Total deposits
- Total withdrawals
- Total profit / loss
- Active traders
- Admin earnings
- Referral commissions
- Daily / weekly / monthly performance
- Pending KYC requests
- Pending withdrawals

### Admin
Admins manage users and monitor trading. Admins earn referral commission from invited users.

Permissions:
- Create / edit / disable users
- View user trading activity
- Monitor all trades
- Add manual trades (if enabled)
- Manage trading signals (if present)
- View profit/loss reports
- View deposits and withdrawals
- Approve user requests (only if Boss enables)
- Send messages/alerts to users

Restrictions:
- Admin cannot remove Boss
- Admin cannot change system core settings
- Admin cannot change payment gateways
- Admin cannot change referral percentages

Admin dashboard must display:
- Active users
- Pending KYC
- Pending deposits
- Pending withdrawals
- Active trades
- Referral earnings

### User (Trader)
Users can manage their own profile, trading views, wallet, and referrals.

Permissions:
- Secure login
- Personal dashboard
- Update profile
- View trading account
- View open/closed trades and PnL
- View wallet balance
- Request deposit / withdrawal
- View transaction history
- Invite friends (referral code/link)
- View referral earnings

User dashboard must display:
- Wallet balance
- Trading balance
- Open trades
- Closed trades
- Profit / loss
- Referral earnings and invite link

## 2) Payment Management System (Boss Control)

Boss can manage payment methods and instructions.

Payment methods include:
- Bank transfer
- Crypto wallets
- Payment gateway

Each method stores relevant fields, for example:
- Bank name, account name, account number, swift code
- Payment address, QR code
- Gateway API keys (store securely; never expose to client)

Boss can:
- Add new payment method
- Edit payment details
- Disable payment methods
- Change deposit instructions

## 3) KYC Verification System

Users must verify identity.

User uploads:
- ID card/passport
- Selfie with ID
- Address verification (optional)

KYC statuses:
- Pending
- Approved
- Rejected

Boss or Admin can:
- Approve KYC
- Reject KYC
- Request re-upload

## 4) Referral System

Referral commissions apply only to the FIRST deposit of an invited user.

Admin referral commission:
- Admin receives 40% of the first deposit of users they invite
- Example: user deposits $1000 -> admin earns $400

User referral commission:
- User receives 5% of the first deposit of invited friends
- Example: friend deposits $1000 -> user earns $50

Important:
- Commissions are paid from a system commission pool
- Commissions must NOT reduce the invited user's deposit or wallet balance

## 5) Wallet System

Each user has a wallet.

Track (at minimum):
- Deposits
- Withdrawals
- Referral commissions
- Trading profit/loss

Important balance rule:
- A user's wallet balance must reflect their full deposited amount (minus withdrawals and PnL as applicable)
- Referral commissions must not "come from" the user's balance

Implementation guidance:
- Use a ledger-based model (append-only entries) and derive balances from ledger totals
- Record a separate ledger/account for the commission pool and platform revenue

## 6) Trading Management

System tracks trading activity:
- Open trades
- Closed trades
- Profit/loss
- Trade history

Optional integrations (future):
- MT5 API
- Binance API
- Bybit API

## 7) Reports System

Generate reports for:

Boss:
- System profit/loss
- Admin commissions
- Deposits & withdrawals
- Referral payouts

Admin:
- User trading activity
- User deposits
- User withdrawals

User:
- Personal trading performance
- Wallet history

Export formats:
- CSV (minimum)
- PDF / Excel (optional; ok to add later)

## 8) Notifications

Notify on:
- Deposit confirmation
- Withdrawal updates
- Trade updates
- Referral rewards
- KYC approval/rejection

Channels:
- In-system notifications (minimum)
- Email (optional)
- SMS (optional)

## 9) Security Requirements (Non-Negotiable)

- Role-based access control (RBAC) on every privileged endpoint
- Password hashing using a strong KDF (bcrypt/scrypt/argon2) with per-user salt
- Secure sessions/tokens (JWT with rotation or secure cookie sessions)
- Optional 2FA (TOTP)
- Activity logs (login/logout, auth failures)
- Admin action audit log (who did what, when, from where)
- Rate limiting and brute-force protections on auth
- Secure file upload handling for KYC:
  - size limits
  - content-type validation
  - store outside web root
  - never serve raw uploads without auth checks
- Secure API connections and secret handling (never send secrets to client)
- Regular backups of the database and uploads

## 10) Implementation Notes for This Repo

- Prefer adding new endpoints under the existing API server and keep current endpoints working.
- Keep the frontend usable while backend is built (feature flags or fallback mocks are acceptable during transition).
- Avoid storing money state in floating point; use integers (cents) or `decimal.js`.
- Add a single source of truth for balances (ledger) to avoid drift.

## 11) Definition of Done

- Boss/Admin/User roles exist with enforced permissions.
- KYC workflow end-to-end.
- Payment methods manageable by Boss.
- Deposit/withdraw request flows with statuses and audit logs.
- Referral payouts computed exactly once on first deposit and paid from commission pool.
- Wallet balances follow the "full deposit amount" rule.
- Reports export at least as CSV.
- Security controls in place (hashing, RBAC, audit logs, basic rate limit).

