const mongoose = require('mongoose');

const cartSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', unique: true },
  items: [
    {
      productId: { type: String, required: true },
      id: String,
      name: String,
      price: Number,
      qty: Number,
      img: String,
    }
  ]
}, { timestamps: true });

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;
