# WishVerse Razorpay Setup (Bangla guide)

## Ki ki lagbe
1. **Razorpay Key ID + Key Secret** (Dashboard → Account & Settings → API Keys). Prothome **Test mode** e try korun.
2. **Razorpay Webhook Secret** (nijer baniye deoa ekta password, step 5 dekhun).
3. **Firebase Blaze plan** (Functions chalate lagbe. Card lage, kintu choto site e usually free tier-er moddhei thake).
4. **Firebase Auth e Email/Password enable** (Authentication → Sign-in method).
5. **Admin UID** (Firebase Console → Authentication → Users → apnar account-er UID copy korun).

Keno backend lagbe: Razorpay **Secret Key** kokhono website-er HTML/JS e rakha jay na. Je kew copy kore free te "paid" bole dite pare. Tai order banano, payment verify, refund shob **Firebase Functions** e hoy.

## Deploy steps (computer e, ekbar)
```bash
npm i -g firebase-tools
firebase login
cd WishVerse-pay
cd functions && npm install && cd ..
firebase functions:secrets:set RAZORPAY_KEY_SECRET      # Key Secret paste korun
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET  # nijer deoa webhook password
firebase deploy --only functions,firestore:rules
```
Deploy-er somoy duto prompt ashbe: `RAZORPAY_KEY_ID` (rzp_test_xxx) ar `ADMIN_UIDS` (apnar UID; ekadhik hole comma diye).

## Razorpay webhook (khub joruri)
Razorpay Dashboard → Settings → Webhooks → Add:
- URL: deploy-er por terminal e `razorpayWebhook` function-er URL dekhabe (`https://asia-south1-surajfx2.cloudfunctions.net/razorpayWebhook`)
- Secret: upore `RAZORPAY_WEBHOOK_SECRET` e ja dilen sheta
- Events: `payment.captured`, `payment.failed`, `refund.processed`
- Settings → Payment Capture: **Automatic**

Eta thakle user payment kore tab bondho kore dileo plan unlock hobe, ar failed payment admin e dekha jabe.

## Live jawar age
Test mode e ₹35/₹99 payment kore dekhun → admin.html e dekhun → refund kore dekhun. Tarpor Live keys diye `RAZORPAY_KEY_ID` ar secret bodle abar `firebase deploy --only functions`.

## Pages
- `pricing.html` → Razorpay checkout
- `account.html` → user-er plan, usage, payment list, **Report problem** (100 words, ek payment e matro ek bar)
- `admin.html` → sudhu Admin UID-er account e khule (Overview, Payments, Refund requests, Buyers, Users, Security)

## Bypass hole ki hoy
Wish ekhon sudhu `createWish` function diye save hoy (Firestore rules browser theke write bondho). Function payment, 7-use limit, suspend check kore. Keu paid chara API call korle, fake signature pathale ba onno-r order use korle **Security** tab e dhora pore. Suspend korle login-o bondho hoye jay.
