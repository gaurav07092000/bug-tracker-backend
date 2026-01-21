const express = require('express');
const router = express.Router();

// Import middlewares
const { authenticate } = require('../middlewares/auth');
const {
  validateTicketCreation,
  validateTicketUpdate,
  validateObjectId,
  validateTicketQuery
} = require('../middlewares/validation');

// Import controllers
const {
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
} = require('../controllers/ticketController');

// All routes require authentication
router.use(authenticate);

// User-specific ticket routes

router.get('/assigned-to-me', getMyAssignedTickets);

router.get('/created-by-me', getMyCreatedTickets);

router.get('/stats', getTicketStats);

// Ticket CRUD routes

router.post('/', validateTicketCreation, createTicket);

router.get('/', validateTicketQuery, getAllTickets);

router.get('/:id', validateObjectId('id'), getTicketById);

router.put('/:id', validateObjectId('id'), validateTicketUpdate, updateTicket);

router.delete('/:id', validateObjectId('id'), deleteTicket);

// Ticket assignment routes

router.put('/:id/assign', validateObjectId('id'), assignTicket);

router.put('/:id/unassign', validateObjectId('id'), unassignTicket);

module.exports = router;