const Project = require('../models/Project');
const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middlewares/errorHandler');
const emailService = require('../utils/emailService');

// Create a new project (Admin only)
const createProject = asyncHandler(async (req, res) => {
  const { name, description, status, priority, endDate } = req.body;

  // Check if project name already exists
  const existingProject = await Project.findOne({ name });
  if (existingProject) {
    throw new ApiError('Project with this name already exists', 400);
  }

  const project = await Project.create({
    name,
    description,
    status: status || 'ACTIVE',
    priority: priority || 'MEDIUM',
    endDate,
    createdBy: req.user._id
  });

  // Populate creator information
  await project.populate('createdBy', 'name email');

  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: { project }
  });
});

// Get all projects
const getAllProjects = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    status, 
    priority,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  let query = { isActive: true };

  // For non-admin users, only show projects they have access to
  if (req.user.role !== 'ADMIN') {
    query.$or = [
      { createdBy: req.user._id },
      { 'members.user': req.user._id }
    ];
  }

  if (search) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    });
  }

  if (status) {
    query.status = status;
  }

  if (priority) {
    query.priority = priority;
  }

  // Get total count for pagination
  const total = await Project.countDocuments(query);

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Get projects
  const projects = await Project.find(query)
    .populate('createdBy', 'name email')
    .populate('members.user', 'name email')
    .populate('ticketCount')
    .skip(skip)
    .limit(parseInt(limit))
    .sort(sort);

  res.json({
    success: true,
    data: {
      projects,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    }
  });
});

// Get project by ID
const getProjectById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const project = await Project.findOne({ _id: id, isActive: true })
    .populate('createdBy', 'name email role')
    .populate('members.user', 'name email role')
    .populate('ticketCount');

  if (!project) {
    throw new ApiError('Project not found', 404);
  }

  // Check access permissions
  if (req.user.role !== 'ADMIN' && !project.hasAccess(req.user._id)) {
    throw new ApiError('Access denied to this project', 403);
  }

  res.json({
    success: true,
    data: { project }
  });
});

// Update project (Admin or project creator)
const updateProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const project = await Project.findOne({ _id: id, isActive: true });

  if (!project) {
    throw new ApiError('Project not found', 404);
  }

  // Check permissions (admin or creator)
  if (req.user.role !== 'ADMIN' && project.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError('Access denied. Only admin or project creator can update project', 403);
  }

  // Prevent name conflicts
  if (updates.name && updates.name !== project.name) {
    const existingProject = await Project.findOne({ 
      name: updates.name, 
      _id: { $ne: id } 
    });
    if (existingProject) {
      throw new ApiError('Project with this name already exists', 400);
    }
  }

  // Update allowed fields
  const allowedUpdates = ['name', 'description', 'status', 'priority', 'endDate'];
  allowedUpdates.forEach(field => {
    if (updates[field] !== undefined) {
      project[field] = updates[field];
    }
  });

  await project.save();
  await project.populate('createdBy', 'name email');

  res.json({
    success: true,
    message: 'Project updated successfully',
    data: { project }
  });
});

// Delete project (Admin only)
const deleteProject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const project = await Project.findOne({ _id: id, isActive: true });

  if (!project) {
    throw new ApiError('Project not found', 404);
  }

  // Check if project has associated tickets
  const Ticket = require('../models/Ticket');
  const hasTickets = await Ticket.findOne({ project: id });

  if (hasTickets) {
    // Soft delete to maintain data integrity
    project.isActive = false;
    project.status = 'ARCHIVED';
    await project.save();

    return res.json({
      success: true,
      message: 'Project archived successfully (has associated tickets)',
      data: { project }
    });
  }

  // Hard delete if no tickets
  await Project.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Project deleted successfully'
  });
});

// Add member to project (Admin or project creator)
const addProjectMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, role = 'CONTRIBUTOR' } = req.body;

  const project = await Project.findOne({ _id: id, isActive: true });

  if (!project) {
    throw new ApiError('Project not found', 404);
  }

  // Check permissions
  if (req.user.role !== 'ADMIN' && project.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError('Access denied. Only admin or project creator can add members', 403);
  }

  // Check if user exists
  const user = await User.findOne({ _id: userId, isActive: true });
  if (!user) {
    throw new ApiError('User not found or inactive', 404);
  }

  // Check if user is already a member
  const existingMember = project.members.find(member => 
    member.user.toString() === userId
  );
  if (existingMember) {
    throw new ApiError('User is already a member of this project', 400);
  }

  // Add member
  project.members.push({
    user: userId,
    role: role,
    joinedAt: new Date()
  });

  await project.save();
  await project.populate('members.user', 'name email');

  // Send invitation email
  emailService.sendProjectInvitationEmail(project, user, req.user).catch(() => {});

  res.json({
    success: true,
    message: 'Member added to project successfully',
    data: { project }
  });
});

// Remove member from project
const removeProjectMember = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;

  const project = await Project.findOne({ _id: id, isActive: true });

  if (!project) {
    throw new ApiError('Project not found', 404);
  }

  // Check permissions
  if (req.user.role !== 'ADMIN' && project.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError('Access denied. Only admin or project creator can remove members', 403);
  }

  // Find and remove member
  const memberIndex = project.members.findIndex(member => 
    member.user.toString() === userId
  );

  if (memberIndex === -1) {
    throw new ApiError('User is not a member of this project', 404);
  }

  project.members.splice(memberIndex, 1);
  await project.save();

  res.json({
    success: true,
    message: 'Member removed from project successfully'
  });
});

// Update member role in project
const updateMemberRole = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const { role } = req.body;

  if (!['VIEWER', 'CONTRIBUTOR', 'MANAGER'].includes(role)) {
    throw new ApiError('Invalid role. Must be VIEWER, CONTRIBUTOR, or MANAGER', 400);
  }

  const project = await Project.findOne({ _id: id, isActive: true });

  if (!project) {
    throw new ApiError('Project not found', 404);
  }

  // Check permissions
  if (req.user.role !== 'ADMIN' && project.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError('Access denied. Only admin or project creator can update member roles', 403);
  }

  // Find and update member
  const member = project.members.find(member => 
    member.user.toString() === userId
  );

  if (!member) {
    throw new ApiError('User is not a member of this project', 404);
  }

  member.role = role;
  await project.save();
  await project.populate('members.user', 'name email');

  res.json({
    success: true,
    message: 'Member role updated successfully',
    data: { project }
  });
});

// Get project statistics
const getProjectStats = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const project = await Project.findOne({ _id: id, isActive: true });

  if (!project) {
    throw new ApiError('Project not found', 404);
  }

  // Check access permissions
  if (req.user.role !== 'ADMIN' && !project.hasAccess(req.user._id)) {
    throw new ApiError('Access denied to this project', 403);
  }

  // Get ticket statistics
  const Ticket = require('../models/Ticket');
  
  const [
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    closedTickets,
    highPriorityTickets,
    ticketsByPriority,
    recentTickets
  ] = await Promise.all([
    Ticket.countDocuments({ project: id }),
    Ticket.countDocuments({ project: id, status: 'OPEN' }),
    Ticket.countDocuments({ project: id, status: 'IN_PROGRESS' }),
    Ticket.countDocuments({ project: id, status: 'RESOLVED' }),
    Ticket.countDocuments({ project: id, status: 'CLOSED' }),
    Ticket.countDocuments({ project: id, priority: 'HIGH' }),
    Ticket.aggregate([
      { $match: { project: project._id } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]),
    Ticket.find({ project: id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assignedTo', 'name')
      .populate('createdBy', 'name')
  ]);

  const stats = {
    project: {
      id: project._id,
      name: project.name,
      status: project.status,
      memberCount: project.members.length
    },
    tickets: {
      total: totalTickets,
      open: openTickets,
      inProgress: inProgressTickets,
      resolved: resolvedTickets,
      closed: closedTickets,
      highPriority: highPriorityTickets,
      byPriority: ticketsByPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recent: recentTickets
    }
  };

  res.json({
    success: true,
    data: { stats }
  });
});

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
  getProjectStats
};