const { Router } = require('express');
const firestore = require('../services/firestore');
const logger = require('../logger');

const router = Router();

// POST /movies/:id/like — like a movie
router.post('/:id/like', async (req, res) => {
  const movieId = req.params.id;
  const userId = req.user.uid;

  try {
    const movieDoc = await firestore.collection('movies').doc(movieId).get();
    if (!movieDoc.exists) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const likeRef = firestore.collection('likes').doc(`${userId}_${movieId}`);
    const existingLike = await likeRef.get();

    if (existingLike.exists) {
      const data = existingLike.data();
      if (data.type === 'like') {
        return res.status(409).json({ error: 'Already liked this movie' });
      }

      // Switch from dislike to like
      await firestore.runTransaction(async (txn) => {
        txn.update(likeRef, { type: 'like', updatedAt: new Date().toISOString() });
        txn.update(firestore.collection('movies').doc(movieId), {
          likeCount: (movieDoc.data().likeCount || 0) + 1,
          dislikeCount: Math.max((movieDoc.data().dislikeCount || 0) - 1, 0),
        });
      });

      return res.json({ message: 'Switched to like' });
    }

    // New like
    await firestore.runTransaction(async (txn) => {
      txn.set(likeRef, {
        userId,
        movieId,
        type: 'like',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      txn.update(firestore.collection('movies').doc(movieId), {
        likeCount: (movieDoc.data().likeCount || 0) + 1,
      });
    });

    res.status(201).json({ message: 'Movie liked' });
  } catch (err) {
    logger.error({ err }, 'Failed to like movie');
    res.status(500).json({ error: 'Failed to like movie' });
  }
});

// POST /movies/:id/dislike — dislike a movie
router.post('/:id/dislike', async (req, res) => {
  const movieId = req.params.id;
  const userId = req.user.uid;

  try {
    const movieDoc = await firestore.collection('movies').doc(movieId).get();
    if (!movieDoc.exists) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const likeRef = firestore.collection('likes').doc(`${userId}_${movieId}`);
    const existingLike = await likeRef.get();

    if (existingLike.exists) {
      const data = existingLike.data();
      if (data.type === 'dislike') {
        return res.status(409).json({ error: 'Already disliked this movie' });
      }

      // Switch from like to dislike
      await firestore.runTransaction(async (txn) => {
        txn.update(likeRef, { type: 'dislike', updatedAt: new Date().toISOString() });
        txn.update(firestore.collection('movies').doc(movieId), {
          likeCount: Math.max((movieDoc.data().likeCount || 0) - 1, 0),
          dislikeCount: (movieDoc.data().dislikeCount || 0) + 1,
        });
      });

      return res.json({ message: 'Switched to dislike' });
    }

    // New dislike
    await firestore.runTransaction(async (txn) => {
      txn.set(likeRef, {
        userId,
        movieId,
        type: 'dislike',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      txn.update(firestore.collection('movies').doc(movieId), {
        dislikeCount: (movieDoc.data().dislikeCount || 0) + 1,
      });
    });

    res.status(201).json({ message: 'Movie disliked' });
  } catch (err) {
    logger.error({ err }, 'Failed to dislike movie');
    res.status(500).json({ error: 'Failed to dislike movie' });
  }
});

module.exports = router;
