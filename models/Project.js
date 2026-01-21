const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot be more than 100 characters'],
    unique: true
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Project creator is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Additional fields for future enhancements
  status: {
    type: String,
    enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'],
    default: 'ACTIVE'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  // Team members who can access this project
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['VIEWER', 'CONTRIBUTOR', 'MANAGER'],
      default: 'CONTRIBUTOR'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
projectSchema.index({ name: 1 });
projectSchema.index({ createdBy: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ isActive: 1 });
projectSchema.index({ 'members.user': 1 });

// Virtual for ticket count
projectSchema.virtual('ticketCount', {
  ref: 'Ticket',
  localField: '_id',
  foreignField: 'project',
  count: true
});

// Static method to find active projects
projectSchema.statics.findActiveProjects = function() {
  return this.find({ isActive: true }).populate('createdBy', 'name email');
};

// Static method to find projects by user
projectSchema.statics.findProjectsByUser = function(userId) {
  return this.find({
    $or: [
      { createdBy: userId },
      { 'members.user': userId }
    ],
    isActive: true
  }).populate('createdBy', 'name email');
};

// Instance method to check if user has access to project
projectSchema.methods.hasAccess = function(userId, requiredRole = 'VIEWER') {
  // Creator always has full access
  if (this.createdBy.toString() === userId.toString()) {
    return true;
  }

  // Check if user is a member with required role
  const member = this.members.find(m => m.user.toString() === userId.toString());
  if (!member) return false;

  const roleHierarchy = { VIEWER: 1, CONTRIBUTOR: 2, MANAGER: 3 };
  return roleHierarchy[member.role] >= roleHierarchy[requiredRole];
};

// Pre-remove middleware to handle cascading deletes
projectSchema.pre('remove', async function(next) {
  try {
    // Remove all tickets associated with this project
    await mongoose.model('Ticket').deleteMany({ project: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;