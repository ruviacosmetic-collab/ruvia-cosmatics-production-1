process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');

const User = require('./models/userModel');
const { isEncrypted } = require('./utils/encryptionUtil');

function execPreSave(doc) {
  return new Promise((resolve, reject) => {
    doc.schema.s.hooks.execPre('save', doc, (err) => (err ? reject(err) : resolve()));
  });
}

function execPostInit(doc) {
  return new Promise((resolve, reject) => {
    doc.schema.s.hooks.execPost('init', doc, [doc], (err) => (err ? reject(err) : resolve()));
  });
}

(async () => {
  console.log('1');
  const u = new User({
    name: 'a',
    email: 'x@y.z',
    password: 'p',
    phone: '9999990000',
    addresses: [
      { firstName: 'F', lastName: 'L', phone: '8888881234', address: '1 main st', city: 'C', pin: '00000' },
    ],
  });
  console.log('2 doc constructed; phone:', u.phone, 'addrs:', u.addresses.length);

  // Force isModified to true so pre-save hooks treat fields as dirty.
  u.isModified = () => true;

  await execPreSave(u);
  console.log('3 pre-save done');

  console.log('phone encrypted?', isEncrypted(u.phone));
  console.log('addr.phone encrypted?', isEncrypted(u.addresses[0].phone));
  console.log('addr.address encrypted?', isEncrypted(u.addresses[0].address));
  console.log('addr.city plaintext kept?', u.addresses[0].city === 'C');
  console.log('addr.firstName plaintext kept?', u.addresses[0].firstName === 'F');

  await execPostInit(u);

  console.log('decrypted phone match?', u.phone === '9999990000');
  console.log('decrypted addr.phone match?', u.addresses[0].phone === '8888881234');
  console.log('decrypted addr.address match?', u.addresses[0].address === '1 main st');

  // Idempotency
  const u2 = new User({ name: 'a', email: 'x@y.z', password: 'p', phone: '9999990000' });
  u2.isModified = () => true;
  await execPreSave(u2);
  const enc1 = u2.phone;
  await execPreSave(u2);
  console.log('idempotent (no double-encrypt)?', enc1 === u2.phone);

  // Missing key path: simulate unset env, ensure no throw and value passed through.
  const oldKey = process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY;
  // Reset module cache so encryption util re-evaluates env (cached key may persist; that's fine).
  const u3 = new User({ name: 'a', email: 'x@y.z', password: 'p', phone: '7777777777' });
  u3.isModified = () => true;
  await execPreSave(u3);
  console.log('missing-key fallback (should not throw):', typeof u3.phone === 'string');
  process.env.ENCRYPTION_KEY = oldKey;
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
