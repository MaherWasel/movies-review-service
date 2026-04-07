const { Router } = require('express');
const firestore = require('../services/firestore');
const { publishEvent } = require('../services/pubsub');
const logger = require('../logger');

const router = Router();

// GET /reviews?movieId=xxx — list reviews for a movie
router.get('/', async (req, res) => {
  const { movieId } = req.query;
  if (!movieId) {
    return res.status(400).json({ error: 'movieId query parameter is required' });
  }

  try {
    const snapshot = await firestore
      .collection('reviews')
      .where('movieId', '==', movieId)
      .orderBy('createdAt', 'desc')
      .get();

    const reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ reviews });
  } catch (err) {
    logger.error({ err }, 'Failed to list reviews');
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /reviews — add a review
router.post('/', async (req, res) => {
  const { movieId, text, rating } = req.body;

  if (!movieId || !text || rating == null) {
    return res.status(400).json({ error: 'movieId, text, and rating are required' });
  }

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
  }

  // Verify movie exists
  const movieDoc = await firestore.collection('movies').doc(movieId).get();
  if (!movieDoc.exists) {
    return res.status(404).json({ error: 'Movie not found' });
  }

  try {
    const reviewData = {
      movieId,
      userId: req.user.uid,
      userName: req.user.name || req.user.email || 'Anonymous',
      text,
      rating,
      createdAt: new Date().toISOString(),
    };

    const ref = await firestore.collection('reviews').add(reviewData);

    // Publish event for async processing (rating aggregation)
    await publishEvent('REVIEW_CREATED', {
      reviewId: ref.id,
      movieId,
      rating,
      userId: req.user.uid,
    });

    res.status(201).json({ id: ref.id, ...reviewData });
  } catch (err) {
    logger.error({ err }, 'Failed to create review');
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// DELETE /reviews/:id — delete own review
router.delete('/:id', async (req, res) => {
  try {
    const doc = await firestore.collection('reviews').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = doc.data();
    if (review.userId !== req.user.uid) {
      return res.status(403).json({ error: 'You can only delete your own reviews' });
    }

    await firestore.collection('reviews').doc(req.params.id).delete();

    // Publish event for async processing
    await publishEvent('REVIEW_DELETED', {
      reviewId: req.params.id,
      movieId: review.movieId,
      rating: review.rating,
      userId: req.user.uid,
    });

    res.json({ message: 'Review deleted' });
  } catch (err) {
    logger.error({ err }, 'Failed to delete review');
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;
