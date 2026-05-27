const getTokenCookieOptions = () => {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  // Cross-site cookies (Vercel frontend -> Render backend) require SameSite=None + Secure.
  // In local development, Lax is safer and avoids issues on http://localhost.
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  };
};

module.exports = { getTokenCookieOptions };

