# WishVerse Razorpay Setup (Bangla guide)

## Ki ki lagbe
1. **Razorpay Key ID + Key Secret** (Dashboard → Account & Settings → API Keys). Prothome **Test mode** e try korun.
2. **Razorpay Webhook Secret** (nijer baniye deoa ekta password, niche Webhook section dekhun).
3. **Firebase Blaze plan** (Functions chalate lagbe. Card lage, kintu choto site e usually free tier-er moddhei thake).
4. **Google login enable**: Firebase Console → Authentication → Sign-in method → **Google** → Enable. Tarpor Settings → Authorized domains e `wishverse.surajfx.in` add korun. Email/Password provider **disable** kore din (jate keu fake account na banay).

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
`functions/.env` file-e `RAZORPAY_KEY_ID` (public) ar `OWNER_EMAIL` already deya ache, tai deploy-er somoy kono prompt ashbe na. **Key Secret kono file-e likhben na**, sudhu `functions:secrets:set` command-e paste korben. Chat-e secret share hoye gele Razorpay Dashboard theke regenerate kore notun secret set kore nin (Live-e jawar age obosshoi).

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
- `admin.html` → sudhu owner (`suraj7uddin@gmail.com`) ar owner-er banano admin-ra khulte pare. Tab: Overview, Payments, Refund requests, Paid buyers, Users, **Pricing** (dam komano/barano), **Give free plan** (kauke free plan), **Admins** (sudhu owner: notun admin add/remove), Bypass/Security

## Bypass hole ki hoy
Wish ekhon sudhu `createWish` function diye save hoy (Firestore rules browser theke write bondho). Function payment, 7-use limit, suspend check kore. Keu paid chara API call korle, fake signature pathale ba onno-r order use korle **Security** tab e dhora pore. Suspend korle login-o bondho hoye jay.

## Owner / Admin
- Owner (`suraj7uddin@gmail.com`) ar admin-ra shob card **free ar unlimited** use korte pare, kono payment lage na.
- Owner admin panel > Admins tab e Gmail diye onno admin baniye dite pare. Admin-ra price change, free plan deoya, refund, suspend/unsuspend korte pare, kintu notun admin banate pare na.
- Owner ba admin-ke suspend kora jay na.
- Free plan: Give free plan tab e Gmail ar plan din. Se age login na korle first Google login e auto active hoy. Revoke korle plan chole jay.
- Price: Pricing tab e rupee te likhun. Website-e sob jaygay sathe sathe bodle jay.

## Share link preview (WhatsApp / Instagram)
Wish toiri hole je link pawa jay (`.../wishShare?id=...`) setai share korte hobe. WhatsApp/Insta-te card-er title (jemon "Birthday Surprise for Riya") ar ekta sundor chhobi preview hishebe dekhay, tarpor click korle wish khule jay. Chhobi gulo `share-img/` folder-e (card-wise). Eta GitHub Pages-e push korte hobe, ar `wishShare` function deploy hote hobe (`firebase deploy --only functions`).

## Account page
Log out, Delete my account (DELETE likhe confirm), plan-er card-wise credit bar ("5 of 7 left"), nijer banano wish-er link (Copy / WhatsApp). Suspended user ba pending refund report thakle account delete hoy na. Payment record accounting-er jonno thake.

## Payment popup
Pay korar age WishVerse-er nijer popup ashe (price, kon plan), tarpor Razorpay window, tarpor "Confirming" animation, shesh e success (confetti) ba failure (Try again).
