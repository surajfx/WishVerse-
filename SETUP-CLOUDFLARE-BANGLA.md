# WishVerse backend on Cloudflare Workers (free, no card)

Eta Firebase Functions-er bodole. Firebase Login ar Firestore thakbe, shudhu backend Cloudflare-e cholbe.

## Ki ki lagbe
1. Cloudflare free account (card lage na)
2. Firebase service account key (JSON file)
3. Razorpay **notun** Key Secret (regenerate kora) + nijer baniye deoa webhook password

## Step 1: Firestore rules publish korun (khub joruri)
Firebase Console → Firestore Database → **Rules** → puro lekha muche `firestore.rules` file-er lekha paste → **Publish**.
Eta na korle keu payment chhara wish baniye felte pare.

## Step 2: Service account key
Firebase Console → Project settings (gear) → **Service accounts** → **Generate new private key**. Ekta `.json` file download hobe.
File-ta khule **puro lekha** copy korun (`{` theke `}` porjonto). Eta khub gopon: kothao post korben na, GitHub-e dibe na.

## Step 3: Worker toiri
Cloudflare → **Workers & Pages** → **Create** → **Create Worker** → naam `wishverse-api` → **Deploy**.
Tarpor **Edit code** → shob lekha muche ফেলুন → `worker/dist/worker.js` file-er puro lekha paste → **Deploy**.

## Step 4: Variables ar Secrets
Worker → **Settings** → **Variables and Secrets** → Add:

| Type | Name | Value |
|---|---|---|
| Text | RAZORPAY_KEY_ID | rzp_test_... (Key ID) |
| Text | OWNER_EMAIL | suraj7uddin@gmail.com |
| Text | FIREBASE_PROJECT_ID | surajfx2 |
| Secret | RAZORPAY_KEY_SECRET | notun Key Secret |
| Secret | RAZORPAY_WEBHOOK_SECRET | nijer webhook password |
| Secret | FIREBASE_SERVICE_ACCOUNT | step 2-er puro JSON |

**Deploy** press korun. Worker URL (`https://wishverse-api.<apnar-naam>.workers.dev`) browser-e kholle `{"ok":true,"service":"wishverse-api"}` dekhabe.

## Step 5: Website-e URL boshan
`shared/config.js` file-e `API_BASE` e Worker URL din (shesh e `/` chhara). GitHub-e commit korun.

## Step 6: Razorpay webhook
Razorpay Dashboard → Settings → Webhooks → Add:
- URL: `https://<Worker URL>/razorpayWebhook`
- Secret: step 4-er webhook password
- Events: `payment.captured`, `payment.failed`, `refund.processed`
- Settings → Payment Capture → **Automatic**

## Test
Test mode-e ₹35 payment → admin panel dekhun → refund kore dekhun.

## Limit (free plan)
Worker: din-e 1 lakh request. Firestore: din-e 50 hajar read. Admin list gulo shorboccho 1000 ta payment dekhay.

## Link share
Wish toiri hole link `https://<Worker URL>/s/<id>`. WhatsApp/Insta-te title ar chhobi preview dekhay.
