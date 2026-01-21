const express = require('express');
const router = express.Router();

// Import middlewares
const { authenticate, authorize } = require('../middlewares/auth');
const { 
  validateUserRegistration, 
  validateUserLogin, 
  validateObjectId 
} = require('../middlewares/validation');

// Import controllers
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getAssignableUsers
} = require('../controllers/userController');

// Public routes

router.post('/register', validateUserRegistration, registerUser);

router.post('/login', validateUserLogin, loginUser);

// Protected routes

router.get('/profile', authenticate, getUserProfile);

router.put('/profile', authenticate, updateUserProfile);

router.put('/change-password', authenticate, changePassword);

router.get('/assignable-users', authenticate, getAssignableUsers);

// Admin only routes

router.get('/users', authenticate, authorize('ADMIN'), getAllUsers);

router.put('/users/:userId/role', 
  authenticate, 
  authorize('ADMIN'), 
  validateObjectId('userId'),
  updateUserRole
);

router.put('/users/:userId/status', 
  authenticate, 
  authorize('ADMIN'), 
  validateObjectId('userId'),
  updateUserStatus
);

router.delete('/users/:userId', 
  authenticate, 
  authorize('ADMIN'), 
  validateObjectId('userId'),
  deleteUser
);

module.exports = router;