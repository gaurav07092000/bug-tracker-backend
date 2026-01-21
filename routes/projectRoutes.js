const express = require('express');
const router = express.Router();

// Import middlewares
const { authenticate, authorize } = require('../middlewares/auth');
const {
  validateProjectCreation,
  validateProjectUpdate,
  validateObjectId
} = require('../middlewares/validation');

// Import controllers
const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
  getProjectStats
} = require('../controllers/projectController');

// All routes require authentication
router.use(authenticate);

// Project CRUD routes

router.post('/', authorize('ADMIN'), validateProjectCreation, createProject);

router.get('/', getAllProjects);

router.get('/:id', validateObjectId('id'), getProjectById);

router.put('/:id', validateObjectId('id'), validateProjectUpdate, updateProject);

router.delete('/:id', authorize('ADMIN'), validateObjectId('id'), deleteProject);

// Project member management routes

router.post('/:id/members', validateObjectId('id'), addProjectMember);

router.delete('/:id/members/:userId', 
  validateObjectId('id'), 
  validateObjectId('userId'),
  removeProjectMember
);

router.put('/:id/members/:userId/role', 
  validateObjectId('id'), 
  validateObjectId('userId'),
  updateMemberRole
);

// Project statistics and analytics

router.get('/:id/stats', validateObjectId('id'), getProjectStats);

module.exports = router;