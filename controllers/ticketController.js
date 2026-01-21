const Ticket = require('../models/Ticket');
const Project = require('../models/Project');
const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middlewares/errorHandler');
const emailService = require('../utils/emailService');

// Create a new ticket
const createTicket = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    priority,
    type,
    project,
    assignedTo,
    dueDate,
    estimatedHours,
    tags
  } = req.body;

  // Verify project exists and user has access
  const projectDoc = await Project.findOne({ _id: project, isActive: true });
  if (!projectDoc) {
    throw new ApiError('Project not found', 404);
  }

  // Check if user has access to the project
  if (req.user.role !== 'ADMIN' && !projectDoc.hasAccess(req.user._id, 'CONTRIBUTOR')) {
    throw new ApiError('Access denied to this project', 403);
  }

  // Verify assigned user exists and has access to project (if provided)
  let assignedUser = null;
  if (assignedTo) {
    assignedUser = await User.findOne({ _id: assignedTo, isActive: true });
    if (!assignedUser) {
      throw new ApiError('Assigned user not found or inactive', 404);
    }

    // Check if assigned user has access to project
    if (req.user.role !== 'ADMIN' && !projectDoc.hasAccess(assignedTo)) {
      throw new ApiError('Assigned user does not have access to this project', 403);
    }
  }

  const ticket = await Ticket.create({
    title,
    description,
    priority,
    type: type || 'BUG',
    project,
    assignedTo: assignedTo || null,
    createdBy: req.user._id,
    dueDate,
    estimatedHours,
    tags: tags || [],
    statusHistory: [{
      status: 'OPEN',
      changedBy: req.user._id,
      changedAt: new Date(),
      comment: 'Ticket created'
    }]
  });

  // Populate ticket details
  await ticket.populate([
    { path: 'assignedTo', select: 'name email' },
    { path: 'createdBy', select: 'name email' },
    { path: 'project', select: 'name' }
  ]);

  // Send assignment email if ticket is assigned
  if (assignedUser && assignedTo !== req.user._id.toString()) {
    emailService.sendTicketAssignmentEmail(ticket, assignedUser, req.user).catch(() => {});
  }

  res.status(201).json({
    success: true,
    message: 'Ticket created successfully',
    data: { ticket }
  });
});

// Get all tickets with filtering
const getAllTickets = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    priority,
    assignedTo,
    project,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    type
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  let query = {};

  // Filter by project access for non-admin users
  if (req.user.role !== 'ADMIN') {
    const accessibleProjects = await Project.find({
      $or: [
        { createdBy: req.user._id },
        { 'members.user': req.user._id }
      ],
      isActive: true
    }).select('_id');

    query.project = { $in: accessibleProjects.map(p => p._id) };
  }

  // Apply filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (type) query.type = type;
  if (assignedTo) query.assignedTo = assignedTo;
  if (project) {
    query.project = query.project 
      ? { $in: [project] }
      : project;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Get total count for pagination
  const total = await Ticket.countDocuments(query);

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Get tickets
  const tickets = await Ticket.find(query)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('project', 'name')
    .skip(skip)
    .limit(parseInt(limit))
    .sort(sort);

  res.json({
    success: true,
    data: {
      tickets,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    }
  });
});

// Get ticket by ID
const getTicketById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ticket = await Ticket.findById(id)
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role')
    .populate('project', 'name description')
    .populate('statusHistory.changedBy', 'name email');

  if (!ticket) {
    throw new ApiError('Ticket not found', 404);
  }

  // Check access permissions
  const project = await Project.findById(ticket.project._id);
  if (req.user.role !== 'ADMIN' && !project.hasAccess(req.user._id)) {
    throw new ApiError('Access denied to this ticket', 403);
  }

  res.json({
    success: true,
    data: { ticket }
  });
});

// Update ticket
const updateTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const ticket = await Ticket.findById(id).populate('project assignedTo createdBy');

  if (!ticket) {
    throw new ApiError('Ticket not found', 404);
  }

  // Check access permissions
  const project = await Project.findById(ticket.project._id);
  if (req.user.role !== 'ADMIN' && !project.hasAccess(req.user._id, 'CONTRIBUTOR')) {
    throw new ApiError('Access denied to update this ticket', 403);
  }

  // Store previous values for comparison
  const previousStatus = ticket.status;
  const previousAssignedTo = ticket.assignedTo;

  // Handle assignment changes
  if (updates.assignedTo !== undefined) {
    if (updates.assignedTo) {
      const assignedUser = await User.findOne({ _id: updates.assignedTo, isActive: true });
      if (!assignedUser) {
        throw new ApiError('Assigned user not found or inactive', 404);
      }

      // Check if assigned user has access to project
      if (req.user.role !== 'ADMIN' && !project.hasAccess(updates.assignedTo)) {
        throw new ApiError('Assigned user does not have access to this project', 403);
      }
    }
  }

  // Update allowed fields
  const allowedUpdates = [
    'title', 'description', 'status', 'priority', 'type',
    'assignedTo', 'dueDate', 'estimatedHours', 'actualHours', 'tags'
  ];

  allowedUpdates.forEach(field => {
    if (updates[field] !== undefined) {
      ticket[field] = updates[field];
    }
  });

  // Set who modified the ticket for status history
  ticket.modifiedBy = req.user._id;

  await ticket.save();

  // Repopulate after save
  await ticket.populate([
    { path: 'assignedTo', select: 'name email' },
    { path: 'createdBy', select: 'name email' },
    { path: 'project', select: 'name' }
  ]);

  // Send notifications for significant changes
  const shouldNotifyStatusChange = previousStatus !== ticket.status;
  const shouldNotifyAssignment = 
    updates.assignedTo !== undefined && 
    previousAssignedTo?.toString() !== ticket.assignedTo?.toString();

  if (shouldNotifyStatusChange) {
    emailService.sendTicketStatusUpdateEmail(ticket, req.user).catch(() => {});
  }

  if (shouldNotifyAssignment && ticket.assignedTo && 
      ticket.assignedTo._id.toString() !== req.user._id.toString()) {
    emailService.sendTicketAssignmentEmail(ticket, ticket.assignedTo, req.user).catch(() => {});
  }

  res.json({
    success: true,
    message: 'Ticket updated successfully',
    data: { ticket }
  });
});

// Delete ticket
const deleteTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ticket = await Ticket.findById(id).populate('project');

  if (!ticket) {
    throw new ApiError('Ticket not found', 404);
  }

  // Check permissions (admin, project creator, or ticket creator)
  const project = await Project.findById(ticket.project._id);
  const isProjectCreator = project.createdBy.toString() === req.user._id.toString();
  const isTicketCreator = ticket.createdBy.toString() === req.user._id.toString();

  if (req.user.role !== 'ADMIN' && !isProjectCreator && !isTicketCreator) {
    throw new ApiError('Access denied. Only admin, project creator, or ticket creator can delete tickets', 403);
  }

  await Ticket.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Ticket deleted successfully'
  });
});

// Assign ticket to user
const assignTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const ticket = await Ticket.findById(id).populate('project');

  if (!ticket) {
    throw new ApiError('Ticket not found', 404);
  }

  // Check access permissions
  const project = await Project.findById(ticket.project._id);
  if (req.user.role !== 'ADMIN' && !project.hasAccess(req.user._id, 'CONTRIBUTOR')) {
    throw new ApiError('Access denied to assign this ticket', 403);
  }

  // Verify user exists and has project access
  const assignedUser = await User.findOne({ _id: userId, isActive: true });
  if (!assignedUser) {
    throw new ApiError('User not found or inactive', 404);
  }

  if (req.user.role !== 'ADMIN' && !project.hasAccess(userId)) {
    throw new ApiError('User does not have access to this project', 403);
  }

  const previousAssignee = ticket.assignedTo;
  ticket.assignedTo = userId;
  ticket.modifiedBy = req.user._id;

  await ticket.save();
  await ticket.populate([
    { path: 'assignedTo', select: 'name email' },
    { path: 'createdBy', select: 'name email' },
    { path: 'project', select: 'name' }
  ]);

  // Send assignment email if not self-assigning
  if (userId !== req.user._id.toString()) {
    emailService.sendTicketAssignmentEmail(ticket, assignedUser, req.user).catch(() => {});
  }

  res.json({
    success: true,
    message: 'Ticket assigned successfully',
    data: { ticket }
  });
});

// Unassign ticket
const unassignTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ticket = await Ticket.findById(id).populate('project');

  if (!ticket) {
    throw new ApiError('Ticket not found', 404);
  }

  // Check access permissions
  const project = await Project.findById(ticket.project._id);
  if (req.user.role !== 'ADMIN' && !project.hasAccess(req.user._id, 'CONTRIBUTOR')) {
    throw new ApiError('Access denied to unassign this ticket', 403);
  }

  ticket.assignedTo = null;
  ticket.modifiedBy = req.user._id;

  await ticket.save();
  await ticket.populate([
    { path: 'createdBy', select: 'name email' },
    { path: 'project', select: 'name' }
  ]);

  res.json({
    success: true,
    message: 'Ticket unassigned successfully',
    data: { ticket }
  });
});

// Get tickets assigned to current user
const getMyAssignedTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, priority } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  let query = { assignedTo: req.user._id };

  if (status) query.status = status;
  if (priority) query.priority = priority;

  const total = await Ticket.countDocuments(query);

  const tickets = await Ticket.find(query)
    .populate('createdBy', 'name email')
    .populate('project', 'name')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      tickets,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    }
  });
});

// Get tickets created by current user
const getMyCreatedTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, priority } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  let query = { createdBy: req.user._id };

  if (status) query.status = status;
  if (priority) query.priority = priority;

  const total = await Ticket.countDocuments(query);

  const tickets = await Ticket.find(query)
    .populate('assignedTo', 'name email')
    .populate('project', 'name')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      tickets,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    }
  });
});

// Get ticket statistics
const getTicketStats = asyncHandler(async (req, res) => {
  // Get accessible projects for non-admin users
  let projectFilter = {};
  if (req.user.role !== 'ADMIN') {
    const accessibleProjects = await Project.find({
      $or: [
        { createdBy: req.user._id },
        { 'members.user': req.user._id }
      ],
      isActive: true
    }).select('_id');

    projectFilter = { project: { $in: accessibleProjects.map(p => p._id) } };
  }

  const [
    totalTickets,
    myAssignedTickets,
    myCreatedTickets,
    statusStats,
    priorityStats,
    overdueTickets
  ] = await Promise.all([
    Ticket.countDocuments(projectFilter),
    Ticket.countDocuments({ ...projectFilter, assignedTo: req.user._id }),
    Ticket.countDocuments({ ...projectFilter, createdBy: req.user._id }),
    Ticket.aggregate([
      { $match: projectFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Ticket.aggregate([
      { $match: projectFilter },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]),
    Ticket.countDocuments({
      ...projectFilter,
      dueDate: { $lt: new Date() },
      status: { $nin: ['RESOLVED', 'CLOSED'] }
    })
  ]);

  const stats = {
    total: totalTickets,
    assigned: myAssignedTickets,
    created: myCreatedTickets,
    overdue: overdueTickets,
    byStatus: statusStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byPriority: priorityStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {})
  };

  res.json({
    success: true,
    data: { stats }
  });
});

module.exports = {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  assignTicket,
  unassignTicket,
  getMyAssignedTickets,
  getMyCreatedTickets,
  getTicketStats
};