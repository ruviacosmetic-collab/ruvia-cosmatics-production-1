const ReturnRequest = require('../models/returnModel');
const Order = require('../models/orderModel');
const User = require('../models/userModel');
const sendEmail = require('../utils/sendEmail');
const {
  adminReturnRequestEmail,
  customerReturnAcknowledgementEmail,
  customerReturnStatusUpdateEmail,
} = require('../utils/emailTemplates');
const { getAdminNotificationRecipients } = require('../utils/adminNotifications');

// Best-effort email helper. Schedules a send on the next tick so request
// handlers never block on SMTP, and centralizes error logging so individual
// callers stay readable.
const queueEmail = ({ to, subject, text, html, label }) => {
  if (!to) return;
  setImmediate(() => {
    sendEmail({ email: to, subject, message: text, html }).catch((err) => {
      console.error(`${label} email failed`, err);
    });
  });
};

// @desc    Create return request
// @route   POST /api/returns
// @access  Private
const createReturnRequest = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    if (!orderId || !reason) {
      return res.status(400).json({ message: 'Order ID and reason are required' });
    }

    // Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to request return for this order' });
    }

    // Check if return already exists
    const existingReturn = await ReturnRequest.findOne({ order: orderId });
    if (existingReturn) {
      return res.status(400).json({ message: 'Return request already exists for this order' });
    }

    const returnRequest = await ReturnRequest.create({
      order: orderId,
      user: req.user._id,
      reason,
    });

    // Pull fresh user record for both customer and admin emails so we can
    // greet by name and include contact details.
    const userDoc = await User.findById(req.user._id).select('name email');

    // 1) Customer acknowledgement email — confirms we received the request,
    //    includes order summary + bill totals + reason + "team will reach out".
    try {
      if (userDoc?.email) {
        const tpl = customerReturnAcknowledgementEmail({
          user: userDoc,
          order,
          returnRequest,
        });
        queueEmail({
          to: userDoc.email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
          label: 'Customer return acknowledgement',
        });
      }
    } catch (e) {
      console.error('Could not send customer return acknowledgement email', e);
    }

    // 2) Admin notification — internal alert with customer + order context.
    try {
      const recipients = getAdminNotificationRecipients();
      if (recipients.length > 0) {
        const tpl = adminReturnRequestEmail({ user: userDoc, order, returnRequest });
        queueEmail({
          to: recipients.join(','),
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
          label: 'Admin return request',
        });
      }
    } catch (e) {
      console.error('Could not send admin return request email', e);
    }

    res.status(201).json(returnRequest);
  } catch (error) {
    console.error('Create return request error:', error);
    res.status(500).json({ message: 'Server error while creating return request' });
  }
};

// @desc    Get user's return requests
// @route   GET /api/returns/myreturns
// @access  Private
const getMyReturns = async (req, res) => {
  try {
    const returns = await ReturnRequest.find({ user: req.user._id })
      .populate('order', 'total status items')
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (error) {
    console.error('Get my returns error:', error);
    res.status(500).json({ message: 'Server error while fetching return requests' });
  }
};

// @desc    Get all return requests (Admin)
// @route   GET /api/returns
// @access  Private/Admin
const getAllReturns = async (req, res) => {
  try {
    const returns = await ReturnRequest.find({})
      // Include richer order context so the admin UI can show the bill
      // (totals + items + payment) without an extra round-trip.
      .populate('order', 'total subtotal gst shippingFee discount status items isPaid paymentMethod createdAt')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (error) {
    console.error('Get all returns error:', error);
    res.status(500).json({ message: 'Server error while fetching return requests' });
  }
};

// @desc    Update return status (Admin)
// @route   PUT /api/returns/:id/status
// @access  Private/Admin
const updateReturnStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = ['Pending', 'Approved', 'Refunded', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const returnRequest = await ReturnRequest.findById(req.params.id)
      .populate('order')
      .populate('user', 'name email');

    if (!returnRequest) {
      return res.status(404).json({ message: 'Return request not found' });
    }

    const previousStatus = returnRequest.status;
    returnRequest.status = status;
    await returnRequest.save();

    // Email the customer when the status actually changes — Approved /
    // Rejected / Refunded all carry meaningful next-step language. Skip the
    // email when the admin re-saves the same status (idempotent UI clicks).
    if (previousStatus !== status && returnRequest.user?.email) {
      try {
        const tpl = customerReturnStatusUpdateEmail({
          user: returnRequest.user,
          order: returnRequest.order,
          returnRequest,
          status,
        });
        queueEmail({
          to: returnRequest.user.email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
          label: 'Customer return status',
        });
      } catch (e) {
        console.error('Could not send customer return status email', e);
      }
    }

    res.json(returnRequest);
  } catch (error) {
    console.error('Update return status error:', error);
    res.status(500).json({ message: 'Server error while updating return status' });
  }
};

module.exports = {
  createReturnRequest,
  getMyReturns,
  getAllReturns,
  updateReturnStatus,
};
