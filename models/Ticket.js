const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Ticket title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Ticket description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
    required: true
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'MEDIUM',
    required: true
  },
  type: {
    type: String,
    enum: ['BUG', 'FEATURE', 'ENHANCEMENT', 'TASK'],
    default: 'BUG'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Ticket creator is required']
  },
  // Additional fields for enhanced functionality
  dueDate: {
    type: Date
  },
  estimatedHours: {
    type: Number,
    min: 0,
    max: 1000
  },
  actualHours: {
    type: Number,
    min: 0,
    max: 1000,
    default: 0
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  // For tracking ticket history
  statusHistory: [{
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    comment: String
  }],
  // File attachments (for future enhancement)
  attachments: [{
    fileName: String,
    fileUrl: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  resolvedAt: Date,
  closedAt: Date
}, {
  timestamps: true
});

// Indexes for better query performance
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ assignedTo: 1 });
ticketSchema.index({ project: 1 });
ticketSchema.index({ createdBy: 1 });
ticketSchema.index({ type: 1 });
ticketSchema.index({ createdAt: -1 });

// Compound indexes for common queries
ticketSchema.index({ project: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ project: 1, assignedTo: 1 });

// Pre-save middleware to track status changes
ticketSchema.pre('save', function(next) {
  // Track status history
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedBy: this.modifiedBy || this.createdBy, // modifiedBy should be set in controller
      changedAt: new Date()
    });
  }

  // Set resolved/closed timestamps
  if (this.isModified('status')) {
    if (this.status === 'RESOLVED' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
    if (this.status === 'CLOSED' && !this.closedAt) {
      this.closedAt = new Date();
    }
    // Clear timestamps if status is reverted
    if (this.status !== 'RESOLVED' && this.status !== 'CLOSED') {
      this.resolvedAt = undefined;
    }
    if (this.status !== 'CLOSED') {
      this.closedAt = undefined;
    }
  }

  next();
});

// Static method to get tickets by status
ticketSchema.statics.findByStatus = function(status) {
  return this.find({ status })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('project', 'name');
};

// Static method to get tickets by priority
ticketSchema.statics.findByPriority = function(priority) {
  return this.find({ priority })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('project', 'name');
};

// Static method to get tickets assigned to a user
ticketSchema.statics.findAssignedToUser = function(userId) {
  return this.find({ assignedTo: userId })
    .populate('createdBy', 'name email')
    .populate('project', 'name')
    .sort({ createdAt: -1 });
};

// Static method to get tickets by project
ticketSchema.statics.findByProject = function(projectId) {
  return this.find({ project: projectId })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
};

// Instance method to check if ticket is overdue
ticketSchema.methods.isOverdue = function() {
  return this.dueDate && this.dueDate < new Date() && 
         !['RESOLVED', 'CLOSED'].includes(this.status);
};

// Virtual for days until due
ticketSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  const diffTime = this.dueDate - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for time spent
ticketSchema.virtual('timeSpent').get(function() {
  if (this.estimatedHours && this.actualHours) {
    return {
      estimated: this.estimatedHours,
      actual: this.actualHours,
      variance: this.actualHours - this.estimatedHours
    };
  }
  return null;
});

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;