const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const L = require("./lib");

admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

const RZP_KEY_ID = defineString("RAZORPAY_KEY_ID");
const RZP_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const RZP_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const OWNER_EMAIL = defineString("OWNER_EMAIL", { default: "suraj7uddin@gmail.com" }); // the one owner; owner appoints other admins from the admin panel

const REGION = "asia-south1";
const OPTS = { region: REGION, secrets: [RZP_KEY_SECRET], cors: true };
const WH_OPTS = { region: REGION, secrets: [RZP_KEY_SECRET, RZP_WEBHOOK_SECRET] };

const rzp = () => new Razorpay({ key_id: RZP_KEY_ID.value(), key_secret: RZP_KEY_SECRET.value() });

/* ------------------------------ helpers ------------------------------ */
const lc = (e) => String(e || "").trim().toLowerCase();
const OWNER = () => lc(OWNER_EMAIL.value());
async function isAdminEmail(email, verified) {
  email = lc(email);
  if (!email || !verified) return false;
  if (email === OWNER()) return true;
  return (await db.doc(`admins/${email}`).get()).exists;
}
const isOwnerAuth = (a) => !!a.token.email_verified && lc(a.token.email) === OWNER();
const isAdminAuth = (a) => isAdminEmail(a.token.email, a.token.email_verified);

// Only Google logins are accepted (verified e-mail). Blocks throw-away password accounts.
function needAuth(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please log in first.");
  const prov = req.auth.token.firebase && req.auth.token.firebase.sign_in_provider;
  if (prov !== "google.com" || !req.auth.token.email_verified) throw new HttpsError("permission-denied", "GOOGLE_LOGIN_REQUIRED");
  return req.auth;
}
async function needAdmin(req) {
  const a = needAuth(req);
  if (!(await isAdminAuth(a))) throw new HttpsError("permission-denied", "Admins only.");
  return a;
}
function needOwner(req) {
  const a = needAuth(req);
  if (!isOwnerAuth(a)) throw new HttpsError("permission-denied", "Owner only.");
  return a;
}
async function needActiveUser(req) {
  const a = needAuth(req);
  const u = await db.doc(`users/${a.uid}`).get();
  if (u.exists && u.data().suspended) throw new HttpsError("permission-denied", "SUSPENDED");
  return a;
}
async function touchUser(a) {
  await db.doc(`users/${a.uid}`).set(
    { email: a.token.email || "", lastSeen: FV.serverTimestamp() },
    { merge: true }
  );
  await applyPendingGrants(a.uid, a.token.email);
}
// Free plan given by an admin (no Razorpay involved). Shows in the payments list as "granted".
async function grantEntitlement(uid, email, g) {
  const id = "grant_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const batch = db.batch();
  batch.set(db.doc(`payments/${id}`), {
    uid, email: lc(email), plan: g.plan, cardId: g.plan === "single" ? g.cardId : null, amount: 0, currency: "INR",
    status: "granted", grantedBy: g.by || "", note: String(g.note || "").slice(0, 200), attempts: 0,
    createdAt: FV.serverTimestamp(), paidAt: FV.serverTimestamp(),
  });
  batch.set(db.doc(`entitlements/${uid}`),
    g.plan === "all" ? { all: { paymentId: id, at: Date.now() } } : { cards: { [g.cardId]: { paymentId: id, at: Date.now() } } },
    { merge: true });
  await batch.commit();
  return id;
}
async function applyPendingGrants(uid, email) {
  const e = lc(email);
  if (!e) return;
  const ref = db.doc(`pendingGrants/${e}`);
  const s = await ref.get();
  if (!s.exists) return;
  for (const g of s.data().grants || []) await grantEntitlement(uid, e, g);
  await ref.delete();
}
async function getPricingDoc() {
  const s = await db.doc("config/pricing").get();
  const d = s.exists ? s.data() : {};
  const D = L.DEFAULT_PRICING, pick = (k) => ({
    amount: d[k] && Number.isInteger(d[k].amount) ? d[k].amount : D[k].amount,
    old: d[k] && Number.isInteger(d[k].old) ? d[k].old : D[k].old,
  });
  return { single: pick("single"), all: pick("all") };
}
async function logEvent(type, uid, email, detail) {
  try {
    await db.collection("securityEvents").add({
      type, uid: uid || "", email: email || "", detail: String(detail || "").slice(0, 500),
      at: FV.serverTimestamp(),
    });
  } catch (e) { console.error("logEvent", e); }
}
const ms = (t) => (t && t.toMillis ? t.toMillis() : null);
function cleanPayment(id, d) {
  return {
    id, uid: d.uid, email: d.email, plan: d.plan, cardId: d.cardId || null,
    amount: d.amount, status: d.status, razorpayPaymentId: d.razorpayPaymentId || null,
    method: d.method || null, error: d.error || null, attempts: d.attempts || 0,
    note: d.note || "", grantedBy: d.grantedBy || "",
    createdAt: ms(d.createdAt), paidAt: ms(d.paidAt), refundedAt: ms(d.refundedAt),
    refundRequest: d.refundRequest
      ? {
          message: d.refundRequest.message, status: d.refundRequest.status,
          at: ms(d.refundRequest.at), usageAtRequest: d.refundRequest.usageAtRequest ?? null,
          adminNote: d.refundRequest.adminNote || "", decidedAt: ms(d.refundRequest.decidedAt),
        }
      : null,
    refundId: d.refundId || null,
  };
}

// Idempotent: mark paid + grant entitlement. Safe to call from verify, webhook, admin sync.
async function fulfill(orderId, rp) {
  const pRef = db.doc(`payments/${orderId}`);
  return db.runTransaction(async (tx) => {
    const ps = await tx.get(pRef);
    if (!ps.exists) return { ok: false, reason: "NO_ORDER" };
    const p = ps.data();
    if (p.status === "paid" || p.status === "refunded") return { ok: true, already: true };
    if (rp.amount !== p.amount || (rp.currency && rp.currency !== "INR")) {
      return { ok: false, reason: "AMOUNT_MISMATCH", uid: p.uid, email: p.email };
    }
    const eRef = db.doc(`entitlements/${p.uid}`);
    const es = await tx.get(eRef);
    const ent = es.exists ? es.data() : {};
    const upd = {};
    if (p.plan === "all") {
      upd.all = { paymentId: orderId, at: Date.now() };
      upd.usage = {}; // fresh allowance for a new purchase
    } else {
      upd[`cards.${p.cardId}`] = { paymentId: orderId, at: Date.now() };
      upd[`usage.${p.cardId}`] = 0;
    }
    tx.update(pRef, {
      status: "paid", razorpayPaymentId: rp.id, method: rp.method || null,
      paidAt: FV.serverTimestamp(), error: FV.delete(),
    });
    if (es.exists) tx.update(eRef, upd);
    else {
      tx.set(eRef, p.plan === "all"
        ? { all: upd.all, cards: {}, usage: {} }
        : { all: null, cards: { [p.cardId]: upd[`cards.${p.cardId}`] }, usage: { [p.cardId]: 0 } });
    }
    void ent;
    return { ok: true };
  });
}

async function revokeEntitlement(p) {
  const eRef = db.doc(`entitlements/${p.uid}`);
  const es = await eRef.get();
  if (!es.exists) return;
  if (p.plan === "all") await eRef.update({ all: null });
  else await eRef.update({ [`cards.${p.cardId}`]: FV.delete() });
}

/* --------------------------- user: payments --------------------------- */
exports.createOrder = onCall(OPTS, async (req) => {
  const a = await needActiveUser(req);
  const { plan, cardId } = req.data || {};
  if (!L.PLANS[plan]) throw new HttpsError("invalid-argument", "Unknown plan.");
  if (await isAdminAuth(a)) throw new HttpsError("failed-precondition", "Admins already have free access.");
  const planDef = { amount: (await getPricingDoc())[plan].amount, label: plan === "all" ? "All Cards Pass" : "One Card" };
  if (plan === "single" && !L.CARDS[cardId]) throw new HttpsError("invalid-argument", "Choose a valid card.");
  await touchUser(a);

  const es = await db.doc(`entitlements/${a.uid}`).get();
  const ent = es.exists ? es.data() : {};
  if (ent.all) throw new HttpsError("failed-precondition", "You already have the All Cards Pass.");
  if (plan === "single" && ent.cards && ent.cards[cardId]) {
    throw new HttpsError("failed-precondition", "You already own this card.");
  }

  const order = await rzp().orders.create({
    amount: planDef.amount, currency: "INR",
    receipt: `wv_${Date.now()}`.slice(0, 40),
    notes: { uid: a.uid, plan, cardId: plan === "single" ? cardId : "all" },
  });
  await db.doc(`payments/${order.id}`).set({
    uid: a.uid, email: a.token.email || "", plan,
    cardId: plan === "single" ? cardId : null,
    amount: planDef.amount, currency: "INR", status: "created", attempts: 0,
    createdAt: FV.serverTimestamp(),
  });
  return { orderId: order.id, amount: planDef.amount, currency: "INR", keyId: RZP_KEY_ID.value(), label: planDef.label, email: a.token.email || "" };
});

exports.verifyPayment = onCall(OPTS, async (req) => {
  const a = needAuth(req);
  const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = req.data || {};
  if (!oid || !pid || !sig) throw new HttpsError("invalid-argument", "Missing payment details.");
  const pSnap = await db.doc(`payments/${oid}`).get();
  if (!pSnap.exists || pSnap.data().uid !== a.uid) {
    await logEvent("verify_foreign_order", a.uid, a.token.email, `order ${oid}`);
    throw new HttpsError("not-found", "Order not found.");
  }
  if (!L.verifyCheckoutSignature(RZP_KEY_SECRET.value(), oid, pid, sig)) {
    await logEvent("bad_signature", a.uid, a.token.email, `order ${oid} payment ${pid}`);
    throw new HttpsError("permission-denied", "Payment signature mismatch.");
  }
  // Never trust the browser: ask Razorpay what really happened.
  let rp = await rzp().payments.fetch(pid);
  if (rp.order_id !== oid) {
    await logEvent("order_mismatch", a.uid, a.token.email, `order ${oid} payment ${pid}`);
    throw new HttpsError("permission-denied", "Payment does not belong to this order.");
  }
  if (rp.status === "authorized") rp = await rzp().payments.capture(pid, rp.amount, "INR");
  if (rp.status !== "captured") throw new HttpsError("failed-precondition", `Payment status: ${rp.status}`);
  const r = await fulfill(oid, rp);
  if (!r.ok) {
    if (r.reason === "AMOUNT_MISMATCH") await logEvent("amount_mismatch", a.uid, a.token.email, `order ${oid}`);
    throw new HttpsError("failed-precondition", r.reason);
  }
  return { ok: true };
});

exports.reportPaymentFailure = onCall(OPTS, async (req) => {
  const a = needAuth(req);
  const { orderId, description } = req.data || {};
  const ref = db.doc(`payments/${orderId}`);
  const s = await ref.get();
  if (!s.exists || s.data().uid !== a.uid) return { ok: true };
  if (s.data().status === "created" || s.data().status === "failed") {
    await ref.update({ status: "failed", error: String(description || "Payment failed").slice(0, 300), attempts: FV.increment(1) });
  }
  return { ok: true };
});

/* Razorpay → server. Source of truth even if the user closes the tab after paying. */
exports.razorpayWebhook = onRequest(WH_OPTS, async (req, res) => {
  const sig = req.get("X-Razorpay-Signature");
  if (!L.verifyWebhookSignature(RZP_WEBHOOK_SECRET.value(), req.rawBody, sig)) {
    await logEvent("bad_webhook_signature", "", "", req.ip || "");
    return res.status(400).send("bad signature");
  }
  const ev = req.body || {};
  try {
    const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
    if (ev.event === "payment.captured" && pay) {
      const r = await fulfill(pay.order_id, pay);
      if (!r.ok && r.reason === "AMOUNT_MISMATCH") await logEvent("amount_mismatch", r.uid, r.email, `order ${pay.order_id} (webhook)`);
    } else if (ev.event === "payment.failed" && pay) {
      const ref = db.doc(`payments/${pay.order_id}`);
      const s = await ref.get();
      if (s.exists && s.data().status !== "paid" && s.data().status !== "refunded") {
        await ref.update({
          status: "failed", razorpayPaymentId: pay.id, method: pay.method || null,
          error: String(pay.error_description || pay.error_reason || "Payment failed").slice(0, 300),
          attempts: FV.increment(1),
        });
      }
    } else if (ev.event === "refund.processed" || ev.event === "refund.created") {
      const rf = ev.payload.refund.entity;
      const q = await db.collection("payments").where("razorpayPaymentId", "==", rf.payment_id).limit(1).get();
      if (!q.empty) {
        const d = q.docs[0];
        if (d.data().status === "paid") {
          // refund made from Razorpay dashboard directly → mirror it here
          await d.ref.update({ status: "refunded", refundId: rf.id, refundedAt: FV.serverTimestamp() });
          await revokeEntitlement(d.data());
        }
      }
    }
  } catch (e) {
    console.error("webhook", e);
    return res.status(500).send("error");
  }
  res.send("ok");
});

/* ----------------------------- user: account ----------------------------- */
exports.getMyAccount = onCall(OPTS, async (req) => {
  const a = needAuth(req);
  await touchUser(a);
  const [u, e, ps] = await Promise.all([
    db.doc(`users/${a.uid}`).get(),
    db.doc(`entitlements/${a.uid}`).get(),
    db.collection("payments").where("uid", "==", a.uid).get(),
  ]);
  const ent = e.exists ? e.data() : {};
  const payments = ps.docs.map((d) => cleanPayment(d.id, d.data()))
    .filter((p) => p.status !== "created")
    .sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  return {
    email: a.token.email || "",
    suspended: !!(u.exists && u.data().suspended),
    isAdmin: await isAdminAuth(a), isOwner: isOwnerAuth(a),
    all: !!ent.all,
    cards: Object.keys(ent.cards || {}),
    usage: ent.usage || {},
    usesPerCard: L.USES_PER_CARD,
    payments,
  };
});

// One refund report per payment, ever (enforced in a transaction), max 100 words.
exports.requestRefund = onCall(OPTS, async (req) => {
  const a = await needActiveUser(req);
  const { paymentId, message } = req.data || {};
  const v = L.validateRefundMessage(message);
  if (!v.ok) throw new HttpsError("invalid-argument", v.error);
  const ref = db.doc(`payments/${paymentId}`);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().uid !== a.uid) throw new HttpsError("not-found", "Payment not found.");
    const p = s.data();
    if (p.status !== "paid") throw new HttpsError("failed-precondition", "Only paid orders can be reported.");
    if (p.refundRequest) throw new HttpsError("already-exists", "You have already reported this payment.");
    const es = await tx.get(db.doc(`entitlements/${a.uid}`));
    const usage = es.exists ? es.data().usage || {} : {};
    const used = p.plan === "all" ? Object.values(usage).reduce((x, y) => x + y, 0) : usage[p.cardId] || 0;
    tx.update(ref, { refundRequest: { message: v.text, status: "pending", at: FV.serverTimestamp(), usageAtRequest: used } });
  });
  return { ok: true };
});

// The only way a wish gets saved: server checks payment, suspension and the 7-use limit.
exports.createWish = onCall(OPTS, async (req) => {
  const a = await needActiveUser(req);
  const wish = L.sanitizeWish(req.data);
  if (!wish) throw new HttpsError("invalid-argument", "Please fill From, To and Message.");
  const eRef = db.doc(`entitlements/${a.uid}`);
  const wRef = db.collection("wishes").doc();
  const isAdmin = await isAdminAuth(a);
  try {
    await db.runTransaction(async (tx) => {
      if (!isAdmin) { // owner/admins use every card free and unlimited
        const es = await tx.get(eRef);
        const c = L.checkEntitlement(es.exists ? es.data() : null, wish.templateId);
        if (!c.ok) throw new HttpsError(c.reason === "LIMIT_REACHED" ? "resource-exhausted" : "failed-precondition", c.reason);
        tx.update(eRef, { [`usage.${wish.templateId}`]: FV.increment(1) });
      }
      tx.set(wRef, { ...wish, ownerUid: a.uid, createdAt: FV.serverTimestamp() });
    });
  } catch (e) {
    if (e instanceof HttpsError && e.message === "NO_ENTITLEMENT") {
      await logEvent("wish_without_entitlement", a.uid, a.token.email, `card ${wish.templateId}`);
    }
    throw e;
  }
  return { id: wRef.id };
});

/* -------------------------------- admin -------------------------------- */
exports.adminCheck = onCall(OPTS, async (req) => {
  const a = needAuth(req);
  return { isAdmin: await isAdminAuth(a), isOwner: isOwnerAuth(a), email: a.token.email || "" };
});

async function allPayments(limit = 2000) {
  const s = await db.collection("payments").orderBy("createdAt", "desc").limit(limit).get();
  return s.docs.map((d) => cleanPayment(d.id, d.data()));
}

exports.adminOverview = onCall(OPTS, async (req) => {
  await needAdmin(req);
  const [pays, users, ev] = await Promise.all([
    allPayments(),
    db.collection("users").get(),
    db.collection("securityEvents").orderBy("at", "desc").limit(500).get(),
  ]);
  const by = (st) => pays.filter((p) => p.status === st);
  const paid = by("paid"), refunded = by("refunded");
  const flagged = new Set(ev.docs.map((d) => d.data().uid).filter(Boolean));
  return {
    totalOrders: pays.length,
    created: by("created").length,
    paid: paid.length,
    failed: by("failed").length,
    refunded: refunded.length,
    granted: by("granted").length,
    refundRequestsPending: pays.filter((p) => p.refundRequest && p.refundRequest.status === "pending").length,
    plan99Buyers: new Set(pays.filter((p) => p.plan === "all" && (p.status === "paid")).map((p) => p.uid)).size,
    plan35Buyers: new Set(pays.filter((p) => p.plan === "single" && p.status === "paid").map((p) => p.uid)).size,
    revenuePaise: paid.reduce((x, p) => x + p.amount, 0),
    refundedPaise: refunded.reduce((x, p) => x + p.amount, 0),
    suspended: users.docs.filter((d) => d.data().suspended).length,
    flaggedUsers: flagged.size,
  };
});

exports.adminListPayments = onCall(OPTS, async (req) => {
  await needAdmin(req);
  return { payments: await allPayments(1000) }; // filtering is done in the browser
});

exports.adminListUsers = onCall(OPTS, async (req) => {
  await needAdmin(req);
  const [list, docs, ents, ev] = await Promise.all([
    admin.auth().listUsers(1000),
    db.collection("users").get(),
    db.collection("entitlements").get(),
    db.collection("securityEvents").orderBy("at", "desc").limit(500).get(),
  ]);
  const adm = new Set((await db.collection("admins").get()).docs.map((d) => d.id));
  const meta = {}; docs.forEach((d) => (meta[d.id] = d.data()));
  const entm = {}; ents.forEach((d) => (entm[d.id] = d.data()));
  const flags = {}; ev.docs.forEach((d) => { const u = d.data().uid; if (u) flags[u] = (flags[u] || 0) + 1; });
  return {
    users: list.users.map((u) => ({
      uid: u.uid, email: u.email || "", createdAt: Date.parse(u.metadata.creationTime) || null,
      lastSignIn: Date.parse(u.metadata.lastSignInTime) || null,
      suspended: !!(meta[u.uid] && meta[u.uid].suspended), reason: (meta[u.uid] && meta[u.uid].suspendReason) || "",
      hasAll: !!(entm[u.uid] && entm[u.uid].all),
      cards: Object.keys((entm[u.uid] && entm[u.uid].cards) || {}),
      flags: flags[u.uid] || 0, isAdmin: lc(u.email) === OWNER() || adm.has(lc(u.email)),
    })),
  };
});

exports.adminSecurityEvents = onCall(OPTS, async (req) => {
  await needAdmin(req);
  const s = await db.collection("securityEvents").orderBy("at", "desc").limit(200).get();
  return { events: s.docs.map((d) => ({ id: d.id, ...d.data(), at: ms(d.data().at) })) };
});

exports.adminSetSuspended = onCall(OPTS, async (req) => {
  await needAdmin(req);
  const { uid, suspended, reason } = req.data || {};
  if (!uid) throw new HttpsError("invalid-argument", "uid missing");
  let target = null;
  try { target = await admin.auth().getUser(uid); } catch { throw new HttpsError("not-found", "User not found."); }
  if (target.uid === req.auth.uid || await isAdminEmail(target.email, true)) throw new HttpsError("failed-precondition", "Cannot suspend an admin.");
  await db.doc(`users/${uid}`).set(
    { suspended: !!suspended, suspendReason: suspended ? String(reason || "").slice(0, 300) : "", suspendedAt: suspended ? FV.serverTimestamp() : null },
    { merge: true }
  );
  await admin.auth().updateUser(uid, { disabled: !!suspended }); // blocks login completely
  if (suspended) await admin.auth().revokeRefreshTokens(uid);
  return { ok: true };
});

exports.adminRefund = onCall(OPTS, async (req) => {
  const a = await needAdmin(req);
  const { paymentId, note } = req.data || {};
  const ref = db.doc(`payments/${paymentId}`);
  const s = await ref.get();
  if (!s.exists) throw new HttpsError("not-found", "Payment not found.");
  const p = s.data();
  if (p.status !== "paid" || !p.razorpayPaymentId) throw new HttpsError("failed-precondition", "Only paid payments can be refunded.");
  const rf = await rzp().payments.refund(p.razorpayPaymentId, {
    amount: p.amount, speed: "normal", notes: { by: a.uid, note: String(note || "").slice(0, 200) },
  });
  const upd = { status: "refunded", refundId: rf.id, refundedAt: FV.serverTimestamp() };
  if (p.refundRequest) {
    upd["refundRequest.status"] = "approved";
    upd["refundRequest.adminNote"] = String(note || "").slice(0, 300);
    upd["refundRequest.decidedAt"] = FV.serverTimestamp();
  }
  await ref.update(upd);
  await revokeEntitlement(p);
  return { ok: true, refundId: rf.id };
});

exports.adminRejectRefund = onCall(OPTS, async (req) => {
  await needAdmin(req);
  const { paymentId, note } = req.data || {};
  const ref = db.doc(`payments/${paymentId}`);
  const s = await ref.get();
  if (!s.exists || !s.data().refundRequest) throw new HttpsError("failed-precondition", "No refund request.");
  await ref.update({
    "refundRequest.status": "rejected",
    "refundRequest.adminNote": String(note || "").slice(0, 300),
    "refundRequest.decidedAt": FV.serverTimestamp(),
  });
  return { ok: true };
});

// Re-check an order directly with Razorpay (fixes "user paid but nothing unlocked").
exports.adminSyncPayment = onCall(OPTS, async (req) => {
  await needAdmin(req);
  const { paymentId } = req.data || {};
  const s = await db.doc(`payments/${paymentId}`).get();
  if (!s.exists) throw new HttpsError("not-found", "Payment not found.");
  const list = await rzp().orders.fetchPayments(paymentId);
  const items = list.items || [];
  const captured = items.find((x) => x.status === "captured");
  if (captured) {
    const r = await fulfill(paymentId, captured);
    return { ok: r.ok, razorpayStatus: "captured", note: r.already ? "Already synced" : r.ok ? "Fixed: entitlement granted" : r.reason };
  }
  const last = items[items.length - 1];
  return { ok: true, razorpayStatus: last ? last.status : "no payment attempt", note: "No captured payment found at Razorpay." };
});

/* ----------------------- pricing (owner/admin editable) ----------------------- */
exports.getPricing = onCall({ region: REGION, cors: true }, async () => getPricingDoc());

exports.adminSetPricing = onCall(OPTS, async (req) => {
  await needAdmin(req);
  const v = L.normalizePricing(req.data);
  if (!v.ok) throw new HttpsError("invalid-argument", v.error);
  await db.doc("config/pricing").set(v.value);
  return v.value;
});

/* ------------------------ free plans given by admins ------------------------ */
exports.adminGrantPlan = onCall(OPTS, async (req) => {
  const a = await needAdmin(req);
  const { email, plan, cardId, note } = req.data || {};
  if (!L.isEmail(email)) throw new HttpsError("invalid-argument", "Enter a valid email.");
  if (!L.PLANS[plan]) throw new HttpsError("invalid-argument", "Unknown plan.");
  if (plan === "single" && !L.CARDS[cardId]) throw new HttpsError("invalid-argument", "Choose a card.");
  const g = { plan, cardId: plan === "single" ? cardId : null, note: String(note || "").slice(0, 200), by: a.token.email || a.uid };
  let user = null;
  try { user = await admin.auth().getUserByEmail(lc(email)); }
  catch (e) { if (e.code !== "auth/user-not-found") throw e; }
  if (user) { await grantEntitlement(user.uid, email, g); return { ok: true, status: "granted" }; }
  // Not signed up yet: it will be applied automatically on their first Google login.
  const ref = db.doc(`pendingGrants/${lc(email)}`);
  const s = await ref.get();
  const grants = s.exists ? s.data().grants || [] : [];
  grants.push(g);
  await ref.set({ grants, updatedAt: FV.serverTimestamp() });
  return { ok: true, status: "pending" };
});

exports.adminRevokeGrant = onCall(OPTS, async (req) => {
  await needAdmin(req);
  const ref = db.doc(`payments/${(req.data || {}).paymentId}`);
  const s = await ref.get();
  if (!s.exists || s.data().status !== "granted") throw new HttpsError("failed-precondition", "Only granted plans can be revoked.");
  await ref.update({ status: "revoked", refundedAt: FV.serverTimestamp() });
  await revokeEntitlement(s.data());
  return { ok: true };
});

exports.adminListPending = onCall(OPTS, async (req) => {
  await needAdmin(req);
  const s = await db.collection("pendingGrants").get();
  return { pending: s.docs.map((d) => ({ email: d.id, grants: d.data().grants || [] })) };
});

exports.adminCancelPending = onCall(OPTS, async (req) => {
  await needAdmin(req);
  await db.doc(`pendingGrants/${lc((req.data || {}).email)}`).delete();
  return { ok: true };
});

/* ------------------------------ owner: admins ------------------------------ */
exports.adminListAdmins = onCall(OPTS, async (req) => {
  needOwner(req);
  const s = await db.collection("admins").get();
  return { owner: OWNER(), admins: s.docs.map((d) => ({ email: d.id, addedBy: d.data().addedBy || "" })) };
});

exports.adminAddAdmin = onCall(OPTS, async (req) => {
  const a = needOwner(req);
  const email = lc((req.data || {}).email);
  if (!L.isEmail(email)) throw new HttpsError("invalid-argument", "Enter a valid Gmail address.");
  if (email === OWNER()) throw new HttpsError("failed-precondition", "That is already the owner.");
  await db.doc(`admins/${email}`).set({ addedBy: a.token.email, at: FV.serverTimestamp() });
  return { ok: true };
});

exports.adminRemoveAdmin = onCall(OPTS, async (req) => {
  needOwner(req);
  const email = lc((req.data || {}).email);
  if (email === OWNER()) throw new HttpsError("failed-precondition", "Owner cannot be removed.");
  await db.doc(`admins/${email}`).delete();
  return { ok: true };
});
