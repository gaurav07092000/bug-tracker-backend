require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function promoteUserToAdmin() {
  try {
    await mongoose.connect(process.env.DATABASE_URI);

    const user = await User.findOne().sort({ createdAt: -1 });
    
    if (!user) {
      return;
    }

    if (user.role === 'ADMIN') {
      return;
    } else {
      user.role = 'ADMIN';
      await user.save();
    }

    await mongoose.disconnect();

  } catch (error) {
    process.exit(1);
  }
}

promoteUserToAdmin();