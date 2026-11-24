# Bill Check

Tracks every delivery bill from the shop counter to the customer's door.

```
Cashier (counter)  ──►  Driver (lot)  ──►  Customer (OTP)
  bill created           loaded, left        OTP verified
  clock starts                               clock ends, bill finalized
```

1. **Cashier** creates a bill at the counter: bill no, receiver name, receiver phone, optional address and lot details. The system gives it a unique ID and the time. The clock starts. The cashier assigns a driver now or later.
2. **Driver** sees the lots assigned to them, taps **Loaded**, then **Leaving now**. Leaving sends a 6-digit OTP to the customer's phone.
3. **Customer** tells the driver the OTP. The driver enters it, which records the time the lot reached the customer.
4. The bill is **finalized**: stamped with the created and reached times, the total time taken, and the cashier's name. Every step is kept in the bill's timeline.

**Roles:** Admin, Cashier, Driver. The admin creates every person's account (employee ID + password). Customers have no login, they only receive the OTP.

## What's in the repo

| Folder | What it is |
| --- | --- |
| `backend/` | Node.js + Express API with PostgreSQL. JWT login, hashed passwords, all the bill rules. |
| `mobile/` | React Native app (Expo). One app for everyone; each person sees the screens for their role. |

## Running it locally

You need Node.js 20+ and PostgreSQL 14+.

### 1. Backend

```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET
npm install
createdb billcheck            # or create the database any way you like
npm run create-admin -- ADMIN-1 "Your Name" yourpassword
npm start                     # API on http://localhost:4000, tables are created on start
```

Run the tests (they use a separate, throwaway database):

```bash
createdb billcheck_test
npm test                      # or set TEST_DATABASE_URL
```

### 2. Mobile app

```bash
cd mobile
npm install
# Point the app at the backend. On a real phone use your computer's LAN IP, not localhost.
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 npx expo start
```

Scan the QR code with the **Expo Go** app on Android or iPhone. Press `w` to open it in a browser instead.

Log in as the admin you created, add a cashier and a driver under **People**, then try the flow.

## OTP and SMS

The backend talks to SMS through a small provider interface in `backend/src/sms/`.

- `SMS_PROVIDER=console` (default): **test mode**. No SMS is sent. The OTP is printed in the server log and shown in a yellow box in the driver's app so you can test the whole flow.
- `SMS_PROVIDER=msg91`: sends a real SMS through MSG91. Set `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID`. In India the template must be DLT-approved; it should use `##otp##` and `##billno##` variables. In this mode the OTP is never sent to the app.

Another provider (Twilio, Fast2SMS, …) is one file with a `sendOtp({ phone, otp, billNo })` function, added to `backend/src/sms/index.js`.

OTP rules (all configurable in `.env`): valid for 30 minutes, 5 wrong tries before it must be resent, at most 5 sends per bill. OTPs are stored hashed.

## API summary

| Method | Path | Who | What |
| --- | --- | --- | --- |
| POST | `/auth/login` | anyone | `{ empId, password }` → token |
| GET | `/auth/me` | logged in | current user |
| GET | `/users?role=` | admin, cashier (drivers only) | list people |
| POST | `/users` | admin | create account |
| PATCH | `/users/:id` | admin | change name/phone, disable, reset password |
| GET | `/bills?status=&q=&from=&to=` | all (drivers see only theirs) | history |
| GET | `/bills/:id` | all (drivers only theirs) | bill + timeline |
| POST | `/bills` | cashier, admin | create bill (optional `driverId`) |
| POST | `/bills/:id/assign` | cashier, admin | assign / change driver (before loading) |
| POST | `/bills/:id/cancel` | cashier, admin | cancel an open bill |
| POST | `/bills/:id/loaded` | assigned driver | lot loaded |
| POST | `/bills/:id/left` | assigned driver | left for delivery, sends OTP |
| POST | `/bills/:id/resend-otp` | assigned driver | new OTP |
| POST | `/bills/:id/deliver` | assigned driver | `{ otp }` → reached, finalized |

Bill status goes `created → assigned → loaded → left → delivered`, or `cancelled`.

## Assumptions to confirm

These are choices made for the first version. Each is easy to change.

1. **Login is employee ID + password**, set by the admin. People can't sign up or reset their own password; the admin resets it.
2. **The cashier assigns the driver.** A driver can't pick up bills on their own.
3. **The driver can be changed until the lot is loaded.** After that, the bill can only be cancelled.
4. **The clock starts when the bill is created** and ends when the OTP is verified. Loaded and left times are recorded in between.
5. **"Finalized" happens automatically** when the OTP is verified, and is stamped with the cashier who created the bill. The cashier doesn't need to press anything.
6. **Cashiers and admins see all bills.** Drivers see only bills assigned to them.
7. **One bill = one lot = one customer.** A driver can carry several bills at once; each has its own OTP.
8. **Indian 10-digit mobile numbers** only for the customer phone.
9. **No delete.** Bills can be cancelled but not deleted, so history stays complete.

## Before going live

- Set a long random `JWT_SECRET` and `NODE_ENV=production`.
- Switch `SMS_PROVIDER` to `msg91` and add the keys.
- Host the backend over HTTPS (for example Render, Railway or a VPS) with a managed PostgreSQL.
- Build the phone apps with EAS Build (`npx eas build`) and set `EXPO_PUBLIC_API_URL` to the live API.
