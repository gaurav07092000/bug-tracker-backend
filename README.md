# Bug Tracking System (Mini Jira) Backend

A comprehensive RESTful API backend for a Bug Tracking System built with Node.js, Express.js, and MongoDB.

## 🚀 Features

- **User Management**: Registration, login, profile management with JWT authentication
- **Role-Based Access Control**: ADMIN and USER roles with proper authorization
- **Project Management**: Create, update, delete projects with member management
- **Ticket Management**: Full CRUD operations for bug/task tickets with filtering
- **Email Notifications**: Automated email notifications for assignments and updates
- **Security**: Password hashing with bcrypt, rate limiting, input validation
- **Error Handling**: Centralized error handling with detailed responses

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Security**: bcrypt
- **Email**: Nodemailer
- **Validation**: express-validator
- **Security**: Helmet, CORS, rate limiting

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection configuration
├── controllers/
│   ├── userController.js    # User management logic
│   ├── projectController.js # Project management logic
│   └── ticketController.js  # Ticket management logic
├── middlewares/
│   ├── auth.js             # Authentication & authorization
│   ├── errorHandler.js     # Global error handling
│   └── validation.js       # Input validation rules
├── models/
│   ├── User.js             # User schema & methods
│   ├── Project.js          # Project schema & methods
│   └── Ticket.js           # Ticket schema & methods
├── routes/
│   ├── userRoutes.js       # User-related endpoints
│   ├── projectRoutes.js    # Project-related endpoints
│   └── ticketRoutes.js     # Ticket-related endpoints
├── utils/
│   └── emailService.js     # Email notification service
├── .env.example            # Environment variables template
├── app.js                  # Express app configuration
├── server.js               # Server startup & configuration
└── package.json            # Dependencies & scripts
```

## 🔧 Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your configuration:
   - MongoDB connection string
   - JWT secret key
   - Email service credentials
   - Other environment variables

3. **Start MongoDB**:
   Make sure MongoDB is running on your system or use MongoDB Atlas.

4. **Run the Application**:
   ```bash
   # Development mode with auto-restart
   npm run dev

   # Production mode
   npm start
   ```

5. **API Verification**:
   Visit: `http://localhost:5000/api/health`

## 📚 API Documentation

### Base URL: `http://localhost:5000/api`

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "role": "USER"
}
```

#### Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### Get Profile
```http
GET /auth/profile
Authorization: Bearer <jwt_token>
```

### Project Endpoints

#### Create Project (Admin Only)
```http
POST /projects
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Website Redesign",
  "description": "Complete website redesign project",
  "priority": "HIGH",
  "endDate": "2024-12-31"
}
```

#### Get All Projects
```http
GET /projects?page=1&limit=10&search=website&status=ACTIVE
Authorization: Bearer <jwt_token>
```

#### Get Project by ID
```http
GET /projects/:projectId
Authorization: Bearer <jwt_token>
```

### Ticket Endpoints

#### Create Ticket
```http
POST /tickets
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "Login form validation bug",
  "description": "Email validation not working properly",
  "priority": "HIGH",
  "type": "BUG",
  "project": "60d5ecb74b24a043c8e1b234",
  "assignedTo": "60d5ecb74b24a043c8e1b567",
  "dueDate": "2024-02-15T00:00:00.000Z",
  "estimatedHours": 4
}
```

#### Get Tickets with Filtering
```http
GET /tickets?status=OPEN&priority=HIGH&assignedTo=userId&project=projectId&page=1&limit=10
Authorization: Bearer <jwt_token>
```

#### Update Ticket
```http
PUT /tickets/:ticketId
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "actualHours": 2
}
```

### Response Format

#### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors (if any)
  ],
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## 🔒 Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent abuse with configurable limits
- **Input Validation**: Comprehensive validation using express-validator
- **CORS Protection**: Configurable Cross-Origin Resource Sharing
- **Helmet**: Security headers protection
- **Error Handling**: Secure error responses without sensitive data exposure

## 📊 User Roles & Permissions

### USER Role
- View accessible projects and tickets
- Create tickets in accessible projects
- Update own tickets and assigned tickets
- View own profile and update profile

### ADMIN Role
- All USER permissions
- Create, update, delete projects
- Manage project members
- View all users and tickets
- Update user roles and status
- Access administrative endpoints

## 📧 Email Notifications

The system sends email notifications for:
- Welcome email on user registration
- Ticket assignment notifications
- Ticket status update notifications
- Project invitation notifications

Email service is configured using Nodemailer and can be customized in `utils/emailService.js`.

## 🧪 Testing the API

You can test the API using tools like:
- **Postman**: Import the collection for easy testing
- **curl**: Command-line testing
- **Insomnia**: REST client for API testing

### Sample Test Flow:

1. Register a new admin user
2. Login to get JWT token
3. Create a project
4. Add members to project
5. Create tickets
6. Assign tickets to users
7. Update ticket status

## 📈 Performance & Scalability

- **Database Indexing**: Optimized queries with proper indexes
- **Pagination**: Efficient data retrieval with pagination
- **Async Operations**: Non-blocking operations with async/await
- **Connection Pooling**: MongoDB connection optimization
- **Error Handling**: Graceful error handling without crashes

## 🔧 Environment Variables

```env
# Database
DATABASE_URI=mongodb://localhost:27017/bug_tracker

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@bugtracker.com

# Security
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚀 Deployment

### Production Deployment Steps:

1. **Environment Setup**:
   - Set `NODE_ENV=production`
   - Use strong JWT secret
   - Configure production database

2. **Security**:
   - Enable HTTPS
   - Set up proper CORS origins
   - Configure rate limiting
   - Set up monitoring

3. **Database**:
   - Use MongoDB Atlas for production
   - Set up database backups
   - Monitor performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code comments

---

**Built with ❤️ for efficient bug tracking and project management.**
