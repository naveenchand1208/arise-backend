# ARISE API — Backend Test Guide
## Base URL: https://api.arise.in
## Test order matters — auth token needed for most routes

---

## SETUP

```bash
BASE=https://api.arise.in
# After login, set:
TOKEN=<your_jwt_token>
ADMIN_TOKEN=<your_admin_jwt_token>
```

---

## 1. AUTH (/api/auth)

### Register
```bash
curl -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@bhive.in","password":"Test@1234","phone":"9999999999"}'
# Expected: { success: true, data: { token, refreshToken, user } }
```

### Login
```bash
curl -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@bhive.in","password":"Test@1234"}'
# Expected: { success: true, data: { token, refreshToken, user } }
# SAVE token → TOKEN=<value>
```

### Refresh Token
```bash
curl -X POST $BASE/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<your_refresh_token>"}'
# Expected: { success: true, data: { token } }
```

### Forgot Password
```bash
curl -X POST $BASE/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@bhive.in"}'
# Expected: { success: true, message: "OTP sent" }
# Requires MSG91 live key
```

### Logout
```bash
curl -X POST $BASE/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
# Expected: { success: true }
```

---

## 2. USER (/api/user)

### Get Profile
```bash
curl $BASE/api/user/profile \
  -H "Authorization: Bearer $TOKEN"
# Expected: { success: true, data: { name, email, plan, beliefScore, currentStreak... } }
```

### Update Profile
```bash
curl -X PUT $BASE/api/user/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Naveenraj","city":"Erode"}'
# Expected: { success: true }
```

### Update Priorities
```bash
curl -X PUT $BASE/api/user/priorities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priorities":["Wealth","Health","Purpose"]}'
# Expected: { success: true }
```

### Get/Save Settings
```bash
curl $BASE/api/user/settings -H "Authorization: Bearer $TOKEN"
curl -X PUT $BASE/api/user/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"morningTime":"05:00","nightTime":"21:30","notifications":{"ritualReminders":true,"streakAlerts":true}}'
# Expected: { success: true, message: "Settings saved" }
```

### Get Stats
```bash
curl $BASE/api/user/stats -H "Authorization: Bearer $TOKEN"
# Expected: { success: true, data: { totalCheckins, currentStreak... } }
```

---

## 3. ONBOARDING (/api/onboarding)

```bash
curl -X POST $BASE/api/onboarding/save \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"Entrepreneur","lifeVision":"Build bhive to 1M users","priorities":["Wealth","Health","Purpose"],"beliefBaseline":{"health":7,"wealth":6,"happiness":8},"morningTime":"05:00","nightTime":"21:30"}'
# Expected: { success: true }

curl $BASE/api/onboarding/data -H "Authorization: Bearer $TOKEN"
# Expected: { success: true, data: { role, lifeVision... } }
```

---

## 4. BELIEF (/api/belief)

### Daily Check-in
```bash
curl -X POST $BASE/api/belief/checkin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scores":{"health":7,"wealth":6,"happiness":8,"relationships":7,"purpose":9},"avg":7.4}'
# Expected: { success: true, data: { streak, beliefScore } }
```

### Get Check-ins
```bash
curl "$BASE/api/belief/checkins?limit=7" -H "Authorization: Bearer $TOKEN"
```

### I AM Statements
```bash
curl -X POST $BASE/api/belief/iam \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"statements":["I am a powerful creator","I am wealthy and free"]}'
curl $BASE/api/belief/iam -H "Authorization: Bearer $TOKEN"
```

### Belief Reframes
```bash
curl -X POST $BASE/api/belief/reframe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"old":"Money is hard to earn","newBelief":"Money flows easily to me"}'
curl $BASE/api/belief/reframes -H "Authorization: Bearer $TOKEN"
# Get the ID from above, then:
curl -X DELETE $BASE/api/belief/reframes/<id> -H "Authorization: Bearer $TOKEN"
```

---

## 5. BEHAVIOUR (/api/behaviour)

```bash
# Morning check-in
curl -X POST $BASE/api/behaviour/morning-checkin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stepsCompleted":5,"totalSteps":5}'
# Expected: { success: true, data: { streak } }

# Today summary (home screen uses this)
curl $BASE/api/behaviour/today -H "Authorization: Bearer $TOKEN"
# Expected: { data: { morning:{done,stepsCompleted}, midday:{done}, sats:{done}, intention:{done} } }

# Midday check-in
curl -X POST $BASE/api/behaviour/midday \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"energy":8,"focus":7,"emotion":"Energised"}'

# SATS
curl -X POST $BASE/api/behaviour/sats \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scene":"Received funding for bhive","feeling":"joy and certainty"}'

# Intention
curl -X POST $BASE/api/behaviour/intention \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"iAm":"focused and unstoppable","intentions":["Close 3 deals","Ship ARISE v1","Meditate"]}'

# Celebration
curl -X POST $BASE/api/behaviour/celebration \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"win":"Completed morning protocol 7 days straight","celebrationType":"fist_pump"}'
```

---

## 6. TASKS (/api/tasks)

```bash
# Get today (auto-creates 3 empty slots)
curl $BASE/api/tasks -H "Authorization: Bearer $TOKEN"

# Add task
curl -X POST $BASE/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Close bhive funding round","order":1}'
# Save id from response → TASK_ID=<id>

# Tick done
curl -X PATCH $BASE/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"done":true}'

# Edit text
curl -X PATCH $BASE/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Updated task text"}'

# Delete
curl -X DELETE $BASE/api/tasks/$TASK_ID -H "Authorization: Bearer $TOKEN"

# History
curl $BASE/api/tasks/history -H "Authorization: Bearer $TOKEN"
```

---

## 7. PATTERN (/api/pattern)

```bash
# Pattern break
curl -X POST $BASE/api/pattern/break \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patternBroken":"Doom scrolling","oldLoop":"Phone first thing in morning","icon":"✅"}'
curl $BASE/api/pattern/breaks -H "Authorization: Bearer $TOKEN"

# Challenge
curl -X POST $BASE/api/pattern/challenge/join \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days":21}'
# Save id → CHALLENGE_ID=<id>
curl -X POST $BASE/api/pattern/challenge/checkin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"'$CHALLENGE_ID'"}'
curl $BASE/api/pattern/challenges -H "Authorization: Bearer $TOKEN"

# Energy Vampires
curl -X POST $BASE/api/pattern/vampires \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Late night Instagram","type":"Habit","drain":8,"fix":"Phone off at 9PM","icon":"📱"}'
curl $BASE/api/pattern/vampires -H "Authorization: Bearer $TOKEN"
# Save id → VID=<id>
curl -X PATCH $BASE/api/pattern/vampires/$VID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dissolved":true}'
curl -X DELETE $BASE/api/pattern/vampires/$VID -H "Authorization: Bearer $TOKEN"

# Energy Shields
curl $BASE/api/pattern/shields/today -H "Authorization: Bearer $TOKEN"
curl -X POST $BASE/api/pattern/shields/activate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shieldId":"morning_ritual","active":true}'
# Add custom
curl -X POST $BASE/api/pattern/shields/activate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customShield":{"name":"No meetings before 10AM","rule":"Protect morning focus","icon":"🛡️"}}'

# Weekly Review
curl -X POST $BASE/api/pattern/weekly-review \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"biggestWin":"Shipped ARISE","biggestChallenge":"Consistency","patternShift":"Morning ritual dissolving doom scroll","nextWeekFocus":"Daily checkins","loopRating":{}}'
```

---

## 8. JOURNAL (/api/journal)

```bash
curl -X POST $BASE/api/journal/entry \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"daily","content":"Today I realised my belief score is directly tied to my morning ritual consistency.","prompts":["What shifted today?"]}'
curl $BASE/api/journal/entries -H "Authorization: Bearer $TOKEN"
curl "$BASE/api/journal/entries?type=daily" -H "Authorization: Bearer $TOKEN"
# Save id → JID=<id>
curl $BASE/api/journal/entries/$JID -H "Authorization: Bearer $TOKEN"
curl -X DELETE $BASE/api/journal/entries/$JID -H "Authorization: Bearer $TOKEN"
```

---

## 9. WEALTH (/api/wealth)

```bash
curl -X POST $BASE/api/wealth/intention \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target":500000,"currency":"INR","month":"2025-07"}'

curl -X POST $BASE/api/wealth/income-entry \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"bhive SaaS","amount":120000,"date":"2025-07-05"}'

curl $BASE/api/wealth/income-summary -H "Authorization: Bearer $TOKEN"
# Expected: { data: { target, actual, gap, entries[] } }
```

---

## 10. RESULT (/api/result)

```bash
curl $BASE/api/result/loop-status -H "Authorization: Bearer $TOKEN"
curl $BASE/api/result/belief-evolution -H "Authorization: Bearer $TOKEN"
curl $BASE/api/result/monthly-report -H "Authorization: Bearer $TOKEN"
curl $BASE/api/result/bottleneck -H "Authorization: Bearer $TOKEN"
# Expected bottleneck: { bottleneck: { layer }, recommendation, loopStatus }
```

---

## 11. CONTENT (/api/content)

```bash
curl $BASE/api/content/meditations -H "Authorization: Bearer $TOKEN"
curl $BASE/api/content/breathwork -H "Authorization: Bearer $TOKEN"
curl $BASE/api/content/asana -H "Authorization: Bearer $TOKEN"
curl $BASE/api/content/master-library -H "Authorization: Bearer $TOKEN"
curl $BASE/api/content/affirmations -H "Authorization: Bearer $TOKEN"
curl $BASE/api/content/featured-today -H "Authorization: Bearer $TOKEN"
# Expected featured: { name, master, weakestLayer, reason }

curl -X POST $BASE/api/content/log-play \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentId":"silva_mirror","contentType":"meditation","durationSeconds":600}'
```

---

## 12. COMMUNITY (/api/community)

```bash
curl $BASE/api/community/feed -H "Authorization: Bearer $TOKEN"
curl -X POST $BASE/api/community/post \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Day 7 of ARISE. Morning ritual done. Belief score hit 8.2 today.","tags":["belief","morning"]}'
# Save id → PID=<id>
curl -X POST $BASE/api/community/like/$PID -H "Authorization: Bearer $TOKEN"
curl $BASE/api/community/post/$PID -H "Authorization: Bearer $TOKEN"
curl -X POST $BASE/api/community/comment/$PID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Keep going!"}'
curl $BASE/api/community/trending -H "Authorization: Bearer $TOKEN"
curl "$BASE/api/community/explore?tag=belief" -H "Authorization: Bearer $TOKEN"
```

---

## 13. SUBSCRIPTION (/api/subscription)

```bash
curl $BASE/api/subscription/plans -H "Authorization: Bearer $TOKEN"
curl -X POST $BASE/api/subscription/create-order \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId":"core_monthly"}'
# Expected: { data: { orderId, amount, currency } }

curl $BASE/api/subscription/status -H "Authorization: Bearer $TOKEN"

# Paywall gates
curl $BASE/api/subscription/gate/wealth_hub -H "Authorization: Bearer $TOKEN"
curl $BASE/api/subscription/gate/master_library -H "Authorization: Bearer $TOKEN"
curl $BASE/api/subscription/gate/challenge_66 -H "Authorization: Bearer $TOKEN"
# Free user expected: { allowed: false, reason: "upgrade_required" }
```

---

## 14. ADMIN (/api/admin) — Use ADMIN_TOKEN

```bash
# Admin login first
curl -X POST $BASE/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@arise.in","password":"YourAdminPass"}'
# ADMIN_TOKEN=<token>

curl $BASE/api/admin/dashboard -H "Authorization: Bearer $ADMIN_TOKEN"
curl $BASE/api/admin/users -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X PATCH $BASE/api/admin/users/<uid>/block \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"blocked":true}'
curl $BASE/api/admin/posts/pending -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X PATCH $BASE/api/admin/posts/<postId>/moderate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve"}'
curl $BASE/api/admin/audit-log -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 15. NOTIFICATIONS (/api/notifications) — Admin only

```bash
curl -X POST $BASE/api/notifications/broadcast \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"segment":"all","title":"Your loop is waiting 🌅","body":"Day starts with one choice. Open ARISE."}'

curl $BASE/api/notifications/history -H "Authorization: Bearer $TOKEN"
```

---

## HEALTH CHECK (no auth)

```bash
curl $BASE/health
# Expected: { status: "OK", app: "ARISE API", routes: 15, uptime: <seconds> }
```

---

## CRITICAL CHECKS — run these first

```bash
# 1. Server is up
curl $BASE/health

# 2. Auth works
curl -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@bhive.in","password":"Test@1234"}'

# 3. Token protects routes (should get 401)
curl $BASE/api/user/profile

# 4. Rate limiter works (run 11 times fast, 11th should 429)
for i in {1..11}; do curl -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"x","password":"x"}' -s | grep -o '"success":[a-z]*'; done

# 5. Webhook signature rejects bad request
curl -X POST $BASE/api/subscription/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: invalid" \
  -d '{"event":"payment.captured"}'
# Expected: 400
```
