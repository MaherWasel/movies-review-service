const admin = require('firebase-admin');
const { getRedisClient } = require('../services/redis');
const config = require('../config');
const logger = require('../logger');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.projectId });
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  const redis = getRedisClient();
  const cacheKey = `token:${token.slice(-16)}`;

  // Check Redis cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      req.user = JSON.parse(cached);
      return next();
    }
  } catch (err) {
    logger.warn({ err }, 'Redis cache read failed — falling back to Firebase');
  }

  // Validate with Firebase
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const userData = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
    };

    try {
      await redis.setex(cacheKey, config.tokenCacheTTL, JSON.stringify(userData));
    } catch (err) {
      logger.warn({ err }, 'Redis cache write failed');
    }

    req.user = userData;
    next();
  } catch (err) {
    logger.warn({ err }, 'Firebase token verification failed');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
