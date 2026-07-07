# ARISE — Deployment Guide
## Hostinger KVM 2 + Firebase + Flutter

---

## 1. Server Setup (Hostinger KVM 2)

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Create log directory
mkdir -p /var/log/arise

# Create app directory
mkdir -p /var/www/arise-backend
```

---

## 2. Upload Backend

```bash
# From your local machine
scp -r arise-backend/* root@YOUR_SERVER_IP:/var/www/arise-backend/

# On server
cd /var/www/arise-backend
npm install
```

---

## 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Fill in every key:
- `FIREBASE_PROJECT_ID` — from Firebase Console > Project Settings
- `FIREBASE_PRIVATE_KEY` — from Service Account JSON
- `FIREBASE_CLIENT_EMAIL` — from Service Account JSON
- Or put the service account JSON at `config/firebase-service-account.json` / set `FIREBASE_SERVICE_ACCOUNT_PATH`.
- `JWT_SECRET` — generate: `openssl rand -hex 64`
- `ADMIN_JWT_SECRET` — generate: `openssl rand -hex 64`
- `MSG91_AUTH_KEY` — from msg91.com dashboard
- `MSG91_TEMPLATE_ID` — OTP template ID
- `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` — from razorpay.com dashboard
- `R2_ACCOUNT_ID` + keys — from Cloudflare R2 dashboard
- `ALLOWED_ORIGINS` — your domains: `https://arise.in,https://admin.arise.in`

---

## 4. Start with PM2

```bash
cd /var/www/arise-backend
pm2 start ecosystem.config.js --env production --update-env
pm2 save
pm2 startup   # auto-start on reboot
```

Verify the API before pointing the app/admin panel at it:

```bash
pm2 logs arise-api --lines 80
curl -i http://127.0.0.1:5000/health
curl -i https://api.arise.in/health
```

If the browser shows a black Hostinger/LiteSpeed `503 Service Unavailable` page, Node is not serving that response. Check `pm2 status`, `pm2 logs arise-api`, the `.env` on the server, and that Nginx proxies to the same `PORT` PM2 starts.

---

## 5. Nginx Reverse Proxy

```bash
apt install nginx -y
nano /etc/nginx/sites-available/arise-api
```

```nginx
server {
    listen 80;
    server_name api.arise.in;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/arise-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL with Let's Encrypt
apt install certbot python3-certbot-nginx -y
certbot --nginx -d api.arise.in
```

---

## 6. Firebase Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# In arise-backend directory
firebase init firestore

# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

---

## 7. Flutter App Setup

```bash
# Install FlutterFire CLI
dart pub global activate flutterfire_cli

# In arise-flutter directory
flutterfire configure
# Select your Firebase project
# Select android + ios platforms
# This generates lib/firebase_options.dart automatically
```

Update `lib/main.dart` to initialise Firebase:
```dart
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // ... rest of main
}
```

Update `lib/services/api_service.dart` line 4:
```dart
static const String baseUrl = 'https://api.arise.in/api';  // ← your domain
```

---

## 8. Android Build

```bash
# In arise-flutter
flutter pub get
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk

# Or bundle for Play Store
flutter build appbundle --release
```

Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
           android:value="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"/>
```

---

## 9. iOS Build

```bash
flutter build ios --release
# Open in Xcode: open ios/Runner.xcworkspace
```

For Razorpay on iOS (App Store rule):
- Use a WebView to open `https://api.arise.in/api/subscription/pay?orderId=XXX`
- Server renders a Razorpay checkout page and redirects back with the payment result.

---

## 10. Admin Panel Deploy

```bash
# Upload to any static host (Netlify, Vercel, or same Nginx server)
scp arise-admin/index.html root@YOUR_SERVER_IP:/var/www/arise-admin/

# Nginx config for admin panel
server {
    listen 80;
    server_name admin.arise.in;
    root /var/www/arise-admin;
    index index.html;
}
```

---

## 11. Create First Admin User

```bash
# In Firebase Console > Firestore > admins collection
# Add document with ID = your UID from Firebase Auth
{
  uid: "YOUR_UID",
  name: "Naveenraj",
  email: "admin@arise.in",
  password: "BCRYPT_HASH",   # generate with: node -e "const b=require('bcryptjs');console.log(b.hashSync('YourPass',12))"
  role: "superadmin",
  createdAt: "2025-01-01T00:00:00.000Z"
}
```

---

## 12. PM2 Commands Reference

```bash
pm2 status              # Check all processes
pm2 logs arise-api      # View live logs
pm2 restart arise-api   # Restart app
pm2 reload arise-api    # Zero-downtime reload
pm2 stop arise-api      # Stop
pm2 monit               # Dashboard
```

---

## Checklist Before Launch

- [ ] `.env` all 15 keys filled
- [ ] Firebase rules deployed
- [ ] Firebase indexes deployed
- [ ] `api_service.dart` baseUrl updated
- [ ] `google-services.json` in `android/app/`
- [ ] `GoogleService-Info.plist` in `ios/Runner/`
- [ ] `firebase_options.dart` generated (FlutterFire CLI)
- [ ] Firebase Auth → Email/Password enabled
- [ ] Firebase Auth -> Phone (optional, for MSG91 fallback)
- [ ] Razorpay live keys in `.env`
- [ ] AdMob IDs in `AndroidManifest.xml` + `Info.plist`
- [ ] App icons generated (`flutter_launcher_icons`)
- [ ] Splash screen configured (`flutter_native_splash`)
- [ ] Audio files uploaded to R2 bucket `arise-media`
- [ ] First admin user created in Firestore
- [ ] SSL certificate active on `api.arise.in`
- [ ] PM2 running and saved
