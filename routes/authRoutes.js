const express = require('express');
const { loginUser, registerUser, getCurrentUser } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/login', loginUser)
router.post('/register', registerUser)
router.get('/me', authMiddleware, getCurrentUser)

module.exports = router;
