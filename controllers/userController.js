const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middlewares/errorHandler');
const emailService = require('../utils/emailService');

// Register new user
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'USER' } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError('User with this email already exists', 400);
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role
  });

  // Generate JWT token
  const token = user.generateAuthToken();

  // Send welcome email (async, don't wait for it)
  emailService.sendWelcomeEmail(user).catch(() => {});

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      },
      token
    }
  });
});

// Login user
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and include password field for comparison
  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError('Invalid email or password', 401);
  }

  // Check if user is active
  if (!user.isActive) {
    throw new ApiError('Account is deactivated. Please contact administrator.', 401);
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // Generate JWT token
  const token = user.generateAuthToken();

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      },
      token
    }
  });
});

// Get current user profile
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    }
  });
});

// Update user profile
const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Check if email is being changed and if it's already taken
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError('Email is already in use', 400);
    }
  }

  // Update fields
  if (name) user.name = name;
  if (email) user.email = email;

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        updatedAt: user.updatedAt
      }
    }
  });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Check current password
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError('Current password is incorrect', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Get all users (Admin only)
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role, isActive } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  let query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (role) {
    query.role = role;
  }
  
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  // Get total count for pagination
  const total = await User.countDocuments(query);

  // Get users
  const users = await User.find(query)
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 })
    .select('-password -passwordChangedAt');

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    }
  });
});

// Update user role (Admin only)
const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['USER', 'ADMIN'].includes(role)) {
    throw new ApiError('Invalid role. Must be USER or ADMIN', 400);
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Prevent self-role modification
  if (user._id.toString() === req.user._id.toString()) {
    throw new ApiError('Cannot modify your own role', 400);
  }

  user.role = role;
  await user.save();

  res.json({
    success: true,
    message: `User role updated to ${role} successfully`,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        updatedAt: user.updatedAt
      }
    }
  });
});

// Activate/Deactivate user (Admin only)
const updateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { isActive } = req.body;

  const user = await User.findById(userId);
  
  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Prevent self-status modification
  if (user._id.toString() === req.user._id.toString()) {
    throw new ApiError('Cannot modify your own status', 400);
  }

  user.isActive = isActive;
  await user.save();

  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    }
  });
});

// Delete user (Admin only)
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  
  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Prevent self-deletion
  if (user._id.toString() === req.user._id.toString()) {
    throw new ApiError('Cannot delete your own account', 400);
  }

  // Check if user has associated data
  const Project = require('../models/Project');
  const Ticket = require('../models/Ticket');

  const hasProjects = await Project.findOne({ createdBy: userId });
  const hasTickets = await Ticket.findOne({
    $or: [{ createdBy: userId }, { assignedTo: userId }]
  });

  if (hasProjects || hasTickets) {
    // Instead of deleting, deactivate the user to maintain data integrity
    user.isActive = false;
    await user.save();
    
    return res.json({
      success: true,
      message: 'User deactivated successfully (has associated data)',
      data: { user }
    });
  }

  await User.findByIdAndDelete(userId);

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});

// Get users for ticket assignment
const getAssignableUsers = asyncHandler(async (req, res) => {
  const { search, projectId } = req.query;

  // Build query for active users only
  let query = { isActive: true };
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  // If projectId is provided, filter users who have access to that project
  let users;
  if (projectId) {
    const Project = require('../models/Project');
    const project = await Project.findById(projectId);
    
    if (!project) {
      throw new ApiError('Project not found', 404);
    }

    // Check if current user has access to this project
    if (req.user.role !== 'ADMIN' && !project.hasAccess(req.user._id)) {
      throw new ApiError('Access denied to this project', 403);
    }

    // Get project creator and members
    const memberUserIds = project.members.map(member => member.user);
    const accessibleUserIds = [project.createdBy, ...memberUserIds];
    
    query._id = { $in: accessibleUserIds };
  }

  users = await User.find(query)
    .select('name email role')
    .sort({ name: 1 })
    .limit(50); // Limit to 50 users for performance

  res.json({
    success: true,
    data: {
      users,
      total: users.length
    }
  });
});

module.exports = {
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
};