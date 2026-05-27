const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const safe = (v) => (v === undefined || v === null ? "" : String(v));

const formatDateTime = (dt) => {
  try {
    const d = dt ? new Date(dt) : new Date();
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const baseLayout = ({ title, preheader, bodyHtml }) => {
  const brand = process.env.EMAIL_BRAND_NAME || "Ruvia Cosmetics";
  const supportEmail = process.env.EMAIL_SUPPORT_EMAIL || process.env.EMAIL_FROM_EMAIL || "";

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${safe(title)}</title>
      <style>
        body { margin:0; background:#FDFBF7; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; }
        .wrap { max-width: 640px; margin: 0 auto; padding: 24px; }
        .card { background:#ffffff; border:1px solid rgba(31,41,55,0.08); border-radius: 16px; overflow:hidden; }
        .header { padding: 18px 20px; background:#3E2E2C; color:#fff; }
        .header h1 { margin:0; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; }
        .content { padding: 20px; }
        .muted { color: rgba(31,41,55,0.65); font-size: 13px; line-height: 1.55; }
        .h2 { margin: 0 0 8px 0; font-size: 20px; }
        .btn { display:inline-block; padding: 12px 16px; border-radius: 10px; background:#FF9A9E; color:#1f2937 !important; text-decoration:none; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; font-size: 11px; }
        .divider { height:1px; background: rgba(31,41,55,0.08); margin: 16px 0; }
        table { width:100%; border-collapse: collapse; }
        th, td { padding: 10px 0; border-bottom: 1px solid rgba(31,41,55,0.08); font-size: 13px; }
        th { text-align:left; color: rgba(31,41,55,0.65); font-weight: 700; }
        td:last-child, th:last-child { text-align:right; }
        .footer { padding: 16px 20px; font-size: 12px; color: rgba(31,41,55,0.6); }
      </style>
    </head>
    <body>
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
        ${safe(preheader)}
      </div>
      <div class="wrap">
        <div class="card">
          <div class="header">
            <h1>${safe(brand)}</h1>
          </div>
          <div class="content">
            ${bodyHtml}
          </div>
          <div class="footer">
            Need help? Reply to this email${supportEmail ? ` or contact <strong>${safe(supportEmail)}</strong>` : ""}.
            <div class="divider"></div>
            This is an automated message.
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
};

const welcomeEmail = ({ user }) => {
  const name = safe(user?.name || "there");
  const subject = `Welcome to Ruvia, ${name}!`;

  const html = baseLayout({
    title: "Welcome to Ruvia",
    preheader: "Your account is ready. Let’s get you glowing.",
    bodyHtml: `
      <h2 class="h2">Welcome, ${name}.</h2>
      <p class="muted">
        Your Ruvia account has been created successfully. You can now track orders, manage your address book, and write verified product reviews.
      </p>
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/shop">Explore Products</a>
    `,
  });

  const text = `Welcome, ${name}.\n\nYour Ruvia account has been created successfully.\n\nExplore products: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/shop`;

  return { subject, text, html };
};

const orderConfirmationEmail = ({ user, order }) => {
  const name = safe(user?.name || "Customer");
  const orderId = safe(order?._id || "");
  const orderNo = orderId ? `ORD-${orderId.slice(-6).toUpperCase()}` : "Your order";
  const placedAt = formatDateTime(order?.createdAt || Date.now());
  const items = Array.isArray(order?.items) ? order.items : [];

  const rows = items
    .map((it) => {
      const qty = Number(it?.qty || 1);
      const lineTotal = Number(it?.price || 0) * qty;
      return `<tr><td>${safe(it?.name)}</td><td>${qty}</td><td>${currency(lineTotal)}</td></tr>`;
    })
    .join("");

  const subtotal = Number(order?.subtotal ?? 0);
  const gst = Number(order?.gst ?? 0);
  const shippingFee = Number(order?.shippingFee ?? 0);
  const total = Number(order?.total ?? subtotal + gst + shippingFee);

  const sa = order?.shippingAddress || {};
  const addr1 = safe(sa.address || sa.street || "");
  const addr2 = [sa.city, sa.state].filter(Boolean).join(", ");
  const pin = safe(sa.pin || sa.zipCode || "");

  const subject = `Thanks for your order — ${orderNo}`;

  const html = baseLayout({
    title: "Order Confirmed",
    preheader: `Order confirmed • ${orderNo}`,
    bodyHtml: `
      <h2 class="h2">Order placed successfully.</h2>
      <p class="muted">Hi ${name}, thanks for shopping with us. We’ll notify you when your order is shipped.</p>
      <p class="muted"><strong>${orderNo}</strong> • Placed on ${safe(placedAt)}</p>
      <div class="divider"></div>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
        </thead>
        <tbody>${rows || ""}</tbody>
      </table>
      <div class="divider"></div>
      <table>
        <tbody>
          <tr><td>Subtotal</td><td>${currency(subtotal)}</td></tr>
          <tr><td>GST</td><td>${currency(gst)}</td></tr>
          <tr><td>Shipping</td><td>${shippingFee === 0 ? "FREE" : currency(shippingFee)}</td></tr>
          <tr><td><strong>Total</strong></td><td><strong>${currency(total)}</strong></td></tr>
        </tbody>
      </table>
      <div class="divider"></div>
      <p class="muted"><strong>Shipping to:</strong><br/>${addr1}${addr2 ? `<br/>${safe(addr2)}` : ""}${pin ? `<br/>${safe(pin)}` : ""}</p>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(order?._id)}">View order</a>
    `,
  });

  const text =
    `Hi ${name}, thanks for your order.\n` +
    `${orderNo} • Placed on ${placedAt}\n` +
    `Total: ${currency(total)}\n\n` +
    `View order: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(order?._id)}`;

  return { subject, text, html };
};

const orderStatusUpdateEmail = ({ user, order, status }) => {
  const name = safe(user?.name || "Customer");
  const orderId = safe(order?._id || "");
  const orderNo = orderId ? `ORD-${orderId.slice(-6).toUpperCase()}` : "Your order";
  const when = formatDateTime(Date.now());
  const normalized = safe(status || order?.status || "Update");

  const subject = `${orderNo} • ${normalized}`;

  const html = baseLayout({
    title: "Order Update",
    preheader: `${orderNo} status update: ${normalized}`,
    bodyHtml: `
      <h2 class="h2">Your order update</h2>
      <p class="muted">Hi ${name}, your order status changed to <strong>${normalized}</strong>.</p>
      <p class="muted"><strong>${orderNo}</strong> • Updated at ${safe(when)}</p>
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(orderId)}">Track order</a>
    `,
  });

  const text =
    `Hi ${name}, your order status is now: ${normalized}\n` +
    `${orderNo} • Updated at ${when}\n\n` +
    `Track: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(orderId)}`;

  return { subject, text, html };
};

const adminNewOrderEmail = ({ user, order }) => {
  const customerName = safe(user?.name || "Customer");
  const customerEmail = safe(user?.email || "");
  const orderId = safe(order?._id || "");
  const orderNo = orderId ? `ORD-${orderId.slice(-6).toUpperCase()}` : "New order";
  const placedAt = formatDateTime(order?.createdAt || Date.now());

  const items = Array.isArray(order?.items) ? order.items : [];
  const rows = items
    .map((it) => {
      const qty = Number(it?.qty || 1);
      const lineTotal = Number(it?.price || 0) * qty;
      return `<tr><td>${safe(it?.name)}</td><td>${qty}</td><td>${currency(lineTotal)}</td></tr>`;
    })
    .join("");

  const subtotal = Number(order?.subtotal ?? 0);
  const discount = Number(order?.discount ?? 0);
  const gst = Number(order?.gst ?? 0);
  const shippingFee = Number(order?.shippingFee ?? 0);
  const total = Number(order?.total ?? subtotal - discount + gst + shippingFee);

  const subject = `New order received — ${orderNo}`;

  const html = baseLayout({
    title: "New Order",
    preheader: `New order • ${orderNo}`,
    bodyHtml: `
      <h2 class="h2">New order received</h2>
      <p class="muted"><strong>${orderNo}</strong> • Placed on ${safe(placedAt)}</p>
      <p class="muted">Customer: <strong>${customerName}</strong>${customerEmail ? ` (${customerEmail})` : ""}</p>
      <div class="divider"></div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>${rows || ""}</tbody>
      </table>
      <div class="divider"></div>
      <table>
        <tbody>
          <tr><td>Subtotal</td><td>${currency(subtotal)}</td></tr>
          ${discount ? `<tr><td>Discount</td><td>- ${currency(discount)}</td></tr>` : ""}
          <tr><td>GST</td><td>${currency(gst)}</td></tr>
          <tr><td>Shipping</td><td>${shippingFee === 0 ? "FREE" : currency(shippingFee)}</td></tr>
          <tr><td><strong>Total</strong></td><td><strong>${currency(total)}</strong></td></tr>
        </tbody>
      </table>
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/admin/orders">Open admin orders</a>
    `,
  });

  const text =
    `New order received\n` +
    `${orderNo} • Placed on ${placedAt}\n` +
    `Customer: ${customerName}${customerEmail ? ` (${customerEmail})` : ""}\n` +
    `Total: ${currency(total)}\n` +
    `Admin: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/admin/orders`;

  return { subject, text, html };
};

const adminReturnRequestEmail = ({ user, order, returnRequest }) => {
  const customerName = safe(user?.name || "Customer");
  const customerEmail = safe(user?.email || "");
  const orderId = safe(order?._id || returnRequest?.order || "");
  const orderNo = orderId ? `ORD-${String(orderId).slice(-6).toUpperCase()}` : "Return request";
  const createdAt = formatDateTime(returnRequest?.createdAt || Date.now());
  const reason = safe(returnRequest?.reason || "");

  const subject = `Return request — ${orderNo}`;

  const html = baseLayout({
    title: "Return Request",
    preheader: `Return request • ${orderNo}`,
    bodyHtml: `
      <h2 class="h2">Return request submitted</h2>
      <p class="muted"><strong>${orderNo}</strong> • Submitted on ${safe(createdAt)}</p>
      <p class="muted">Customer: <strong>${customerName}</strong>${customerEmail ? ` (${customerEmail})` : ""}</p>
      <div class="divider"></div>
      <p class="muted"><strong>Reason:</strong><br/>${reason || "—"}</p>
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/admin/returns">Open admin returns</a>
    `,
  });

  const text =
    `Return request submitted\n` +
    `${orderNo} • Submitted on ${createdAt}\n` +
    `Customer: ${customerName}${customerEmail ? ` (${customerEmail})` : ""}\n` +
    `Reason: ${reason || "—"}\n` +
    `Admin: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/admin/returns`;

  return { subject, text, html };
};

const customerReturnAcknowledgementEmail = ({ user, order, returnRequest }) => {
  const name = safe(user?.name || "Customer");
  const orderId = safe(order?._id || returnRequest?.order || "");
  const orderNo = orderId ? `ORD-${String(orderId).slice(-6).toUpperCase()}` : "Your order";
  const createdAt = formatDateTime(returnRequest?.createdAt || Date.now());
  const reason = safe(returnRequest?.reason || "");
  const items = Array.isArray(order?.items) ? order.items : [];

  const rows = items
    .map((it) => {
      const qty = Number(it?.qty || 1);
      const lineTotal = Number(it?.price || 0) * qty;
      return `<tr><td>${safe(it?.name)}</td><td>${qty}</td><td>${currency(lineTotal)}</td></tr>`;
    })
    .join("");

  const subtotal = Number(order?.subtotal ?? 0);
  const discount = Number(order?.discount ?? 0);
  const gst = Number(order?.gst ?? 0);
  const shippingFee = Number(order?.shippingFee ?? 0);
  const total = Number(order?.total ?? subtotal - discount + gst + shippingFee);

  const sa = order?.shippingAddress || {};
  const addr1 = safe(sa.address || sa.street || "");
  const addr2 = [sa.city, sa.state].filter(Boolean).join(", ");
  const pin = safe(sa.pin || sa.zipCode || "");

  const subject = `We received your return request — ${orderNo}`;

  const html = baseLayout({
    title: "Return Request Received",
    preheader: `Return request received for ${orderNo}`,
    bodyHtml: `
      <h2 class="h2">Hi ${name}, we received your return request.</h2>
      <p class="muted">
        Thanks for reaching out. Our team will review your request and get back to you
        shortly with the next steps. Most return queries are answered within 24-48 hours.
      </p>
      <p class="muted"><strong>${orderNo}</strong> • Requested on ${safe(createdAt)}</p>
      <div class="divider"></div>
      <p class="muted"><strong>Reason for return:</strong><br/>${reason || "—"}</p>
      <div class="divider"></div>
      <h3 style="margin: 0 0 8px 0; font-size: 14px; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(31,41,55,0.65);">Order summary</h3>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
        </thead>
        <tbody>${rows || ""}</tbody>
      </table>
      <div class="divider"></div>
      <table>
        <tbody>
          <tr><td>Subtotal</td><td>${currency(subtotal)}</td></tr>
          ${discount ? `<tr><td>Discount</td><td>- ${currency(discount)}</td></tr>` : ""}
          <tr><td>GST</td><td>${currency(gst)}</td></tr>
          <tr><td>Shipping</td><td>${shippingFee === 0 ? "FREE" : currency(shippingFee)}</td></tr>
          <tr><td><strong>Order total</strong></td><td><strong>${currency(total)}</strong></td></tr>
        </tbody>
      </table>
      ${addr1 ? `
      <div class="divider"></div>
      <p class="muted"><strong>Shipped to:</strong><br/>${addr1}${addr2 ? `<br/>${safe(addr2)}` : ""}${pin ? `<br/>${safe(pin)}` : ""}</p>
      ` : ""}
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(orderId)}">View order</a>
    `,
  });

  const text =
    `Hi ${name}, we received your return request.\n` +
    `${orderNo} • Requested on ${createdAt}\n` +
    `Reason: ${reason || "—"}\n\n` +
    `Order total: ${currency(total)}\n` +
    `Our team will review your request and reach out within 24-48 hours with next steps.\n\n` +
    `View order: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(orderId)}`;

  return { subject, text, html };
};

const customerReturnStatusUpdateEmail = ({ user, order, returnRequest, status }) => {
  const name = safe(user?.name || "Customer");
  const orderId = safe(order?._id || returnRequest?.order || "");
  const orderNo = orderId ? `ORD-${String(orderId).slice(-6).toUpperCase()}` : "Your order";
  const normalized = safe(status || returnRequest?.status || "Update");

  const heading =
    normalized === "Approved" ? "Your return has been approved" :
    normalized === "Refunded" ? "Your refund has been issued" :
    normalized === "Rejected" ? "Your return request was not approved" :
    "Return request update";

  const message =
    normalized === "Approved"
      ? "Good news. Your return is approved. You'll receive pickup or drop-off instructions in a separate email shortly."
      : normalized === "Refunded"
      ? "Your refund has been processed. It typically takes 3-7 business days to reflect on your original payment method."
      : normalized === "Rejected"
      ? "After reviewing your request, we're unable to approve this return. If you'd like to discuss further, just reply to this email."
      : "There's a new update on your return request.";

  const subject = `${orderNo} • Return ${normalized}`;

  const html = baseLayout({
    title: "Return Update",
    preheader: `${orderNo} return ${normalized.toLowerCase()}`,
    bodyHtml: `
      <h2 class="h2">${heading}</h2>
      <p class="muted">Hi ${name}, ${message}</p>
      <p class="muted"><strong>${orderNo}</strong> • Status: <strong>${normalized}</strong></p>
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(orderId)}">View order</a>
    `,
  });

  const text =
    `Hi ${name}, ${message}\n` +
    `${orderNo} • Return status: ${normalized}\n\n` +
    `View order: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(orderId)}`;

  return { subject, text, html };
};

const welcomeCouponEmail = ({ email, code, percentOff = 15 }) => {
  const safeCode = safe(code || "WELCOME15");
  const percent = Number(percentOff || 15);
  const subject = `Here's your ${percent}% off — welcome to Ruvia.`;

  const shopUrl = `${safe(
    process.env.FRONTEND_URL || "http://localhost:3000"
  )}/shop`;

  const html = baseLayout({
    title: "Your Welcome Coupon",
    preheader: `Use ${safeCode} for ${percent}% off your first order`,
    bodyHtml: `
      <h2 class="h2">Welcome to the inner circle.</h2>
      <p class="muted">
        Thanks for joining the Ruvia list, ${safe(email)}.
        Here is your one-time welcome offer for your first order:
      </p>
      <div style="margin: 18px 0; padding: 18px 20px; border: 1px dashed #FF9A9E; border-radius: 12px; text-align:center; background: #FFF5F6;">
        <div style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(31,41,55,0.55); margin-bottom: 6px;">
          ${percent}% OFF YOUR FIRST ORDER
        </div>
        <div style="font-family: ui-serif, Georgia, serif; font-size: 28px; font-weight: 800; color: #1f2937; letter-spacing: 0.05em;">
          ${safeCode}
        </div>
      </div>
      <p class="muted">
        Apply this code at checkout in the <strong>Apply Coupon</strong> field.
        No login required to browse — your discount applies as soon as you enter the code.
      </p>
      <div class="divider"></div>
      <a class="btn" href="${shopUrl}">Start Shopping</a>
      <div class="divider"></div>
      <p class="muted" style="font-size: 12px;">
        Unsubscribe anytime. We respect your inbox.
      </p>
    `,
  });

  const text =
    `Welcome to Ruvia.\n\n` +
    `Your ${percent}% off coupon: ${safeCode}\n` +
    `Apply it at checkout in the "Apply Coupon" field.\n\n` +
    `Start shopping: ${shopUrl}`;

  return { subject, text, html };
};

const adminSupportMessageEmail = ({ name, email, topic, message, createdAt }) => {
  const submittedAt = formatDateTime(createdAt || Date.now());
  const subject = `Support: ${safe(topic || 'New message')} — ${safe(name)}`;

  const html = baseLayout({
    title: 'New Support Message',
    preheader: `From ${safe(name)} • ${safe(email)}`,
    bodyHtml: `
      <h2 class="h2">New support message</h2>
      <p class="muted">Submitted on ${safe(submittedAt)}</p>
      <div class="divider"></div>
      <table>
        <tbody>
          <tr><td>Name</td><td>${safe(name)}</td></tr>
          <tr><td>Email</td><td>${safe(email)}</td></tr>
          <tr><td>Topic</td><td>${safe(topic)}</td></tr>
        </tbody>
      </table>
      <div class="divider"></div>
      <p class="muted"><strong>Message:</strong></p>
      <p class="muted" style="white-space: pre-wrap;">${safe(message)}</p>
    `,
  });

  const text =
    `New support message\n` +
    `Submitted on ${submittedAt}\n` +
    `Name: ${safe(name)}\n` +
    `Email: ${safe(email)}\n` +
    `Topic: ${safe(topic)}\n\n` +
    `Message:\n${safe(message)}`;

  return { subject, text, html };
};

const customerSupportAcknowledgementEmail = ({ name, topic, message }) => {
  const subject = "We've received your message";

  const html = baseLayout({
    title: 'Support Request Received',
    preheader: 'Thanks for reaching out — we will reply within 24 hours.',
    bodyHtml: `
      <h2 class="h2">Hi ${safe(name || 'there')}, thanks for reaching out.</h2>
      <p class="muted">
        We have received your message about <strong>${safe(topic || 'your query')}</strong>
        and our team will get back to you within 24 hours.
      </p>
      <div class="divider"></div>
      <p class="muted"><strong>Your message:</strong></p>
      <p class="muted" style="white-space: pre-wrap;">${safe(message)}</p>
      <div class="divider"></div>
      <p class="muted">If anything urgent comes up in the meantime, just reply to this email.</p>
    `,
  });

  const text =
    `Hi ${safe(name || 'there')}, thanks for reaching out.\n\n` +
    `We received your message about ${safe(topic || 'your query')} and our team will respond within 24 hours.\n\n` +
    `Your message:\n${safe(message)}`;

  return { subject, text, html };
};

const passwordResetEmail = ({ user, resetLink }) => {
  const name = safe(user?.name || "there");
  const subject = "Reset Your Password";

  const html = baseLayout({
    title: "Password Reset",
    preheader: "Reset your Ruvia password",
    bodyHtml: `
      <h2 class="h2">Reset your password</h2>
      <p class="muted">Hi ${name}, we received a request to reset your password. Click the link below to create a new password:</p>
      <div class="divider"></div>
      <a class="btn" href="${safe(resetLink)}">Reset Password</a>
      <div class="divider"></div>
      <p class="muted">This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
    `,
  });

  const text =
    `Hi ${name}, we received a request to reset your password.\n\n` +
    `Reset your password: ${safe(resetLink)}\n\n` +
    `This link will expire in 1 hour.\n` +
    `If you did not request this, please ignore this email.`;

  return { subject, text, html };
};

module.exports = {
  welcomeEmail,
  orderConfirmationEmail,
  orderStatusUpdateEmail,
  adminNewOrderEmail,
  adminReturnRequestEmail,
  customerReturnAcknowledgementEmail,
  customerReturnStatusUpdateEmail,
  welcomeCouponEmail,
  adminSupportMessageEmail,
  customerSupportAcknowledgementEmail,
  passwordResetEmail,
};

