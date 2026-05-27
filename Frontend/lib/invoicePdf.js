const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const safe = (v) => (v === undefined || v === null ? "" : String(v));
const numberFromAny = (v) => {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  // Handle strings like "₹1,299"
  const s = String(v).replace(/[^\d.]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const loadPdfLibs = async () => {
  const [jspdfMod, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  // jsPDF v2 uses named export { jsPDF }, while some builds expose default export.
  const jsPDF = jspdfMod?.jsPDF || jspdfMod?.default;
  if (!jsPDF) throw new Error("PDF library (jsPDF) failed to load");

  // jspdf-autotable typically exports default function; keep fallbacks for safety.
  const autoTable = autoTableMod?.default || autoTableMod?.autoTable || autoTableMod;
  if (!autoTable) throw new Error("PDF library (autoTable) failed to load");

  return { jsPDF, autoTable };
};

export async function downloadInvoicePdf(order) {
  if (!order?._id) throw new Error("Order is missing");

  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginX = 40;
  let y = 48;

  const invoiceNo = `INV-${String(order._id).slice(-8).toUpperCase()}`;
  const orderNo = `ORD-${String(order._id).slice(-8).toUpperCase()}`;
  const invoiceDate = order.createdAt ? new Date(order.createdAt) : new Date();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Ruvia Cosmetics", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 18;
  doc.text("Invoice", marginX, y);

  doc.setFontSize(10);
  doc.text(`Invoice No: ${invoiceNo}`, 360, 48);
  doc.text(`Order No: ${orderNo}`, 360, 62);
  doc.text(`Date: ${invoiceDate.toLocaleDateString("en-IN")}`, 360, 76);
  doc.text(`Payment: ${safe(order.paymentMethod || "")}`, 360, 90);

  y += 28;
  doc.setDrawColor(230);
  doc.line(marginX, y, 555, y);
  y += 16;

  // Addresses
  const sa = order.shippingAddress || {};
  const name = [sa.firstName, sa.lastName].filter(Boolean).join(" ").trim();
  const addressLine1 = sa.address || sa.street || "";
  const cityLine = [sa.city, sa.state].filter(Boolean).join(", ");
  const pin = sa.pin || sa.zipCode || "";
  const phone = sa.phone || "";

  doc.setFont("helvetica", "bold");
  doc.text("Shipping To", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 14;
  doc.text(safe(name), marginX, y);
  y += 12;
  doc.text(safe(addressLine1), marginX, y);
  y += 12;
  doc.text(safe(cityLine), marginX, y);
  y += 12;
  doc.text(pin ? `PIN: ${safe(pin)}` : "", marginX, y);
  y += 12;
  doc.text(phone ? `Phone: ${safe(phone)}` : "", marginX, y);

  y += 14;

  // Items table
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map((it) => {
    const qty = numberFromAny(it.qty ?? it.quantity ?? 1) || 1;
    const unit = numberFromAny(it.price);
    return [
      safe(it.name),
      safe(it.product || it.id || ""),
      String(qty),
      currency(unit),
      currency(qty * unit),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Item", "SKU", "Qty", "Unit Price", "Line Total"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 6, valign: "middle" },
    headStyles: { fillColor: [17, 24, 39] }, // brand-dark
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  const endY = doc.lastAutoTable?.finalY || y + 120;

  // Totals
  const subtotal = Number(order.subtotal ?? 0);
  const gst = Number(order.gst ?? 0);
  const shippingFee = Number(order.shippingFee ?? 0);
  const total = Number(order.total ?? subtotal + gst + shippingFee);

  const totalsX = 360;
  let ty = endY + 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const line = (label, value, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, totalsX, ty);
    doc.text(value, 555, ty, { align: "right" });
    ty += 14;
  };

  line("Subtotal", currency(subtotal));
  line("GST", currency(gst));
  line("Shipping", shippingFee === 0 ? "FREE" : currency(shippingFee));
  doc.setDrawColor(230);
  doc.line(totalsX, ty, 555, ty);
  ty += 12;
  line("Total", currency(total), true);

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("This is a computer-generated invoice.", marginX, 820);

  doc.save(`${invoiceNo}.pdf`);
}
