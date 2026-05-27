const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const sendEmail = require('../utils/sendEmail');
const { orderConfirmationEmail, orderStatusUpdateEmail, adminNewOrderEmail } = require('../utils/emailTemplates');
const { getAdminNotificationRecipients } = require('../utils/adminNotifications');
const { calculateOrderPricing } = require('../utils/pricingEngine');
const Promotion = require('../models/promotionModel');
const { calculatePagination, formatSimplePaginatedResponse } = require('../utils/paginationUtil');

// ---------------------------------------------------------------------------
// Filtering & sorting helpers for order list endpoints
// ---------------------------------------------------------------------------

// Map incoming status values (lowercase synonyms or exact enum values) to the
// canonical Order schema enum: ['Processing', 'Shipped', 'Out for Delivery',
// 'Delivered']. Anything we cannot map (e.g. 'cancelled') is treated as a
// no-op so the filter is silently ignored rather than producing an error.
const STATUS_FILTER_MAP = {
  pending: 'Processing',
  processing: 'Processing',
  shipped: 'Shipped',
  'out for delivery': 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Delivered',
};

const normalizeStatusFilter = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (STATUS_FILTER_MAP[lower]) return STATUS_FILTER_MAP[lower];
  if (['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(raw)) {
    return raw;
  }
  return null;
};

// Map dateRange ('7d' | '30d' | '90d') to a `createdAt: { $gte: <Date> }` filter.
const DATE_RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const buildDateRangeFilter = (value) => {
  if (!value) return null;
  const days = DATE_RANGE_DAYS[String(value).trim()];
  if (!days) return null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return { $gte: since };
};

// Map a sortBy query value to a Mongo sort spec. Order documents do not have a
// `rating` field, so 'rating' falls back to default (newest first). 'price' is
// mapped to the order `total` since orders don't have a single price field.
const buildOrderSort = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  switch (raw) {
    case 'createdAt':
      return { createdAt: 1 };
    case '-createdAt':
      return { createdAt: -1 };
    case 'price':
      return { total: 1 };
    case '-price':
      return { total: -1 };
    case 'rating':
    case '-rating':
    default:
      return { createdAt: -1 };
  }
};

// Compose a MongoDB filter object from the supported query params, merged on
// top of any base filter (e.g. `{ user: req.user._id }` for "my orders").
const buildOrderListFilter = (query, baseFilter = {}) => {
  const filter = { ...baseFilter };

  const status = normalizeStatusFilter(query.status);
  if (status) filter.status = status;

  const createdAtRange = buildDateRangeFilter(query.dateRange);
  if (createdAtRange) {
    filter.createdAt = { ...(filter.createdAt || {}), ...createdAtRange };
  }

  return filter;
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      promoCode,
    } = req.body;

    console.log('Order request body:', { items: items?.length, shippingAddress: !!shippingAddress, paymentMethod });

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

    // Normalize shipping address keys (frontend uses address/pin; schema supports both)
    const normalizedShippingAddress = {
      firstName: shippingAddress.firstName || '',
      lastName: shippingAddress.lastName || '',
      phone: shippingAddress.phone || '',
      address: shippingAddress.address || shippingAddress.street || '',
      city: shippingAddress.city || '',
      pin: shippingAddress.pin || shippingAddress.zipCode || '',
      street: shippingAddress.street || shippingAddress.address || '',
      state: shippingAddress.state || '',
      zipCode: shippingAddress.zipCode || shippingAddress.pin || '',
    };

    if (!paymentMethod) {
      return res.status(400).json({ message: 'Payment method is required' });
    }

    const validPaymentMethods = ['Razorpay', 'COD', 'UPI'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    // ✅ Verify items and calculate pricing on server (includes promo logic)
    const pricing = await calculateOrderPricing({ items, promoCode });

    // For COD, order is created but not marked as paid
    const isPaid = paymentMethod === 'COD' ? false : false;

    const order = new Order({
      items: pricing.verifiedItems,
      user: req.user._id,
      shippingAddress: normalizedShippingAddress,
      paymentMethod,
      promoCode: pricing.promoMeta?.code || undefined,
      subtotal: pricing.subtotal, // ✅ Server-calculated
      discount: pricing.discount, // ✅ Server-calculated
      gst: pricing.gst, // ✅ Server-calculated
      shippingFee: pricing.shippingFee, // ✅ Server-calculated
      total: pricing.total, // ✅ Server-calculated
      pricingBreakdown: {
        promo: pricing.promoMeta || null,
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        discountedSubtotal: pricing.discountedSubtotal,
        gst: pricing.gst,
        shippingFee: pricing.shippingFee,
        total: pricing.total,
      },
      isPaid,
      trackingEvents: [{ status: 'Ordered', timestamp: new Date() }],
    });

    const createdOrder = await order.save();

    // ✅ Update stock
    for (const item of pricing.verifiedItems) {
      // NOTE: `item.product` stores the product "public id" (slug), not Mongo _id.
      // So we must update by `id` field (unique + indexed) instead of findByIdAndUpdate.
      await Product.findOneAndUpdate(
        { id: String(item.product) },
        { $inc: { countInStock: -item.qty } },
        { new: false }
      );
    }

    // ✅ Increment promotion usage count (best-effort)
    try {
      if (pricing.promo && pricing.promo._id) {
        await Promotion.updateOne(
          { _id: pricing.promo._id },
          { $inc: { usedCount: 1 } }
        );
      }
    } catch (e) {
      console.warn('Could not increment promo usedCount', e.message);
    }

    // Send order confirmation email (best-effort)
    try {
      const userDoc = await User.findById(req.user._id).select('name email');
      if (userDoc?.email) {
        const tpl = orderConfirmationEmail({ user: userDoc, order: createdOrder });
        setImmediate(() => {
          sendEmail({
            email: userDoc.email,
            subject: tpl.subject,
            message: tpl.text,
            html: tpl.html,
          }).catch((err) => console.error('Order confirmation email failed', err));
        });
      }
    } catch (e) {
      console.error('Could not send order confirmation email', e);
    }

    // Notify admin(s) about new order (best-effort)
    try {
      const recipients = getAdminNotificationRecipients();
      if (recipients.length > 0) {
        const userDoc = await User.findById(req.user._id).select('name email');
        const tpl = adminNewOrderEmail({ user: userDoc, order: createdOrder });
        setImmediate(() => {
          sendEmail({
            email: recipients.join(','),
            subject: tpl.subject,
            message: tpl.text,
            html: tpl.html,
          }).catch((err) => console.error('Admin new order email failed', err));
        });
      }
    } catch (e) {
      console.error('Could not send admin new order email', e);
    }

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error while creating order', error: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      'user',
      'name email'
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // ✅ Check if user owns the order or is admin
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this order' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({ message: 'Server error while fetching order' });
  }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // ✅ Check if user owns the order or is admin
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    order.isPaid = true;
    order.paidAt = Date.now();
    // Payment result comes from Razorpay webhook/frontend confirmation
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.email_address,
    };

    const updatedOrder = await order.save();

    res.json(updatedOrder);
  } catch (error) {
    console.error('Update order to paid error:', error);
    res.status(500).json({ message: 'Server error while updating order payment status' });
  }
};

// @desc    Get logged in user orders (paginated, filtered, sorted)
// @route   GET /api/orders/myorders?page=1&limit=20&status=&dateRange=&sortBy=
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const filter = buildOrderListFilter(req.query, { user: req.user._id });
    const sort = buildOrderSort(req.query.sortBy);

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit),
    ]);

    res.json(formatSimplePaginatedResponse(orders, page, limit, total));
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
};

// @desc    Admin: Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const normalizeStatus = (value) => {
      const raw = String(value || '').trim();
      const s = raw.toLowerCase();
      if (!s) return null;
      if (s === 'processing' || s === 'ordered' || s === 'order placed' || s === 'placed') return 'Processing';
      if (s === 'shipped' || s === 'dispatch' || s === 'dispatched') return 'Shipped';
      if (s === 'out for delivery' || s === 'out_for_delivery' || s === 'outfordelivery' || s === 'out for delivery pending') return 'Out for Delivery';
      if (s === 'delivered' || s === 'completed') return 'Delivered';
      // Accept exact enum casing too
      if (['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(raw)) return raw;
      return null;
    };

    const nextStatus = status ? normalizeStatus(status) : order.status;
    if (!nextStatus) {
      return res.status(400).json({
        message: 'Invalid status. Allowed: Processing, Shipped, Out for Delivery, Delivered',
      });
    }
    const prevStatus = order.status;
    order.status = nextStatus;
    // Add a tracking event when status changes
    if (nextStatus && nextStatus !== prevStatus) {
      order.trackingEvents = order.trackingEvents || [];
      order.trackingEvents.push({ status: nextStatus, timestamp: new Date() });
    }
    await order.save();

    // Send status update email (best-effort)
    try {
      const userDoc = order.user;
      if (userDoc?.email && nextStatus !== prevStatus) {
        const tpl = orderStatusUpdateEmail({ user: userDoc, order, status: nextStatus });
        setImmediate(() => {
          sendEmail({
            email: userDoc.email,
            subject: tpl.subject,
            message: tpl.text,
            html: tpl.html,
          }).catch((err) => console.error('Order status email failed', err));
        });
      }
    } catch (e) {
      console.error('Could not send order status email', e);
    }

    res.json(order);
  } catch (err) {
    console.error('updateOrderStatus error', err);
    res.status(500).json({ message: 'Could not update order status' });
  }
};

// @desc    Get tracking events for an order (customer or admin)
// @route   GET /api/orders/:id/tracking
// @access  Private
const getOrderTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Ownership check (or admin)
    if (order.user?._id?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this order' });
    }

    const events = Array.isArray(order.trackingEvents) ? order.trackingEvents : [];
    // Sort ascending by time
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      orderId: order._id,
      status: order.status,
      isPaid: order.isPaid,
      paymentMethod: order.paymentMethod,
      trackingEvents: events,
      updatedAt: order.updatedAt,
    });
  } catch (error) {
    console.error('getOrderTracking error:', error);
    res.status(500).json({ message: 'Server error while fetching tracking' });
  }
};

// @desc    Admin: add a tracking event manually
// @route   POST /api/orders/:id/tracking
// @access  Private/Admin
const addOrderTrackingEvent = async (req, res) => {
  try {
    const { status, timestamp } = req.body || {};
    if (!status) return res.status(400).json({ message: 'status is required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.trackingEvents = order.trackingEvents || [];
    order.trackingEvents.push({ status, timestamp: timestamp ? new Date(timestamp) : new Date() });
    await order.save();
    res.json({ message: 'Tracking event added', trackingEvents: order.trackingEvents });
  } catch (error) {
    console.error('addOrderTrackingEvent error:', error);
    res.status(500).json({ message: 'Server error while updating tracking' });
  }
};

// @desc    Admin: Get all orders (paginated, filtered, sorted)
// @route   GET /api/orders/all?page=1&limit=20&status=&dateRange=&sortBy=
// @access  Private/Admin
const getAllOrders = async (req, res) => {
  try {
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const filter = buildOrderListFilter(req.query);
    const sort = buildOrderSort(req.query.sortBy);

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .populate('user', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit),
    ]);

    res.json(formatSimplePaginatedResponse(orders, page, limit, total));
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Server error while fetching all orders' });
  }
};

module.exports = {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  getOrderTracking,
  addOrderTrackingEvent,
};
