const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Production: Use environment variable
  console.log('Using Firebase credentials from environment variable');
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Development: Use local file
  console.log('Using Firebase credentials from local file');
  serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// TMDB API Configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// ===== MOVIE ROUTES (TMDB API) =====

// Get popular movies
app.get('/api/movies/popular', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
      params: {
        api_key: TMDB_API_KEY,
        page,
        language: 'en-US'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching popular movies:', error.message);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Get now playing movies
app.get('/api/movies/now-playing', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const response = await axios.get(`${TMDB_BASE_URL}/movie/now_playing`, {
      params: {
        api_key: TMDB_API_KEY,
        page,
        language: 'en-US'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching now playing movies:', error.message);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Get top rated movies
app.get('/api/movies/top-rated', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const response = await axios.get(`${TMDB_BASE_URL}/movie/top_rated`, {
      params: {
        api_key: TMDB_API_KEY,
        page,
        language: 'en-US'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching top rated movies:', error.message);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Search movies
app.get('/api/movies/search', async (req, res) => {
  try {
    const { query, page = 1 } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        query,
        page,
        language: 'en-US'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error searching movies:', error.message);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Get single movie details
app.get('/api/movies/:id', async (req, res) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/${req.params.id}`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
        append_to_response: 'credits,videos'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching movie details:', error.message);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// ===== REVIEW ROUTES =====

// Get all reviews for a movie
app.get('/api/reviews/:movieId', async (req, res) => {
  try {
    const snapshot = await db.collection('reviews')
      .where('movieId', '==', req.params.movieId)
      .get();

    const reviews = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      reviews.push({ 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt ? { _seconds: data.createdAt._seconds } : null,
        updatedAt: data.updatedAt ? { _seconds: data.updatedAt._seconds } : null
      });
    });

    reviews.sort((a, b) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get user's reviews
app.get('/api/user-reviews/:userId', async (req, res) => {
  try {
    const snapshot = await db.collection('reviews')
      .where('userId', '==', req.params.userId)
      .get();

    const reviews = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      reviews.push({ 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt ? { _seconds: data.createdAt._seconds } : null,
        updatedAt: data.updatedAt ? { _seconds: data.updatedAt._seconds } : null
      });
    });

    reviews.sort((a, b) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ error: 'Failed to fetch user reviews' });
  }
});

// Create a new review
app.post('/api/reviews', async (req, res) => {
  try {
    const { movieId, movieTitle, moviePoster, userId, userName, rating, comment } = req.body;

    if (!movieId || !userId || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const review = {
      movieId,
      movieTitle,
      moviePoster,
      userId,
      userName,
      rating: Number(rating),
      comment: comment || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('reviews').add(review);
    
    console.log('Review created successfully:', {
      id: docRef.id,
      movieId,
      userName,
      rating
    });
    
    res.status(201).json({ 
      id: docRef.id, 
      ...review,
      createdAt: null,
      updatedAt: null
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Update a review
app.put('/api/reviews/:id', async (req, res) => {
  try {
    const { rating, comment, userId } = req.body;
    const reviewId = req.params.id;

    const reviewDoc = await db.collection('reviews').doc(reviewId).get();
    
    if (!reviewDoc.exists) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (reviewDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates = {
      rating: Number(rating),
      comment: comment || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('reviews').doc(reviewId).update(updates);
    
    res.json({ id: reviewId, ...updates });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete a review
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    const reviewId = req.params.id;

    const reviewDoc = await db.collection('reviews').doc(reviewId).get();
    
    if (!reviewDoc.exists) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (reviewDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.collection('reviews').doc(reviewId).delete();
    
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ===== USER ROUTES =====

// Get user profile
app.get('/api/users/:userId', async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ id: userDoc.id, ...userDoc.data() });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create/Update user profile
app.post('/api/users', async (req, res) => {
  try {
    const { userId, email, displayName } = req.body;

    const userData = {
      email,
      displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(userId).set(userData, { merge: true });
    
    res.json({ id: userId, ...userData });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Movie API is running' });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Movie Review API - IMDb Style',
    status: 'running',
    endpoints: {
      health: '/health',
      movies: {
        popular: '/api/movies/popular',
        nowPlaying: '/api/movies/now-playing',
        topRated: '/api/movies/top-rated',
        search: '/api/movies/search?query=term',
        details: '/api/movies/:id'
      },
      reviews: {
        getByMovie: '/api/reviews/:movieId',
        getByUser: '/api/user-reviews/:userId',
        create: 'POST /api/reviews',
        update: 'PUT /api/reviews/:id',
        delete: 'DELETE /api/reviews/:id'
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🎬 Movie API running on port ${PORT}`);
});