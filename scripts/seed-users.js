#!/usr/bin/env node
// scripts/seed-users.js - Seed database with test users

import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/features/auth/auth.model.js';
import { logger } from '../src/utils/logger.util.js';

const testUsers = [
  {
    username: 'admin',
    email: 'admin@wondertravelers.dev',
    password: 'Admin@123456',
    fullName: 'Admin User',
    role: 'admin',
    active: true
  },
  {
    username: 'admintest',
    email: 'Admin@gmail.com',
    password: 'Password@321',
    fullName: 'Admin Test User',
    role: 'admin',
    active: true
  },
  {
    username: 'moderator1',
    email: 'moderator@wondertravelers.dev',
    password: 'Mod@123456',
    fullName: 'Moderator User',
    role: 'moderator',
    active: true
  },
  {
    username: 'testuser1',
    email: 'test1@wondertravelers.dev',
    password: 'Test@123456',
    fullName: 'Test User One',
    role: 'user',
    active: true
  },
  {
    username: 'testuser2',
    email: 'test2@wondertravelers.dev',
    password: 'Test@123456',
    fullName: 'Test User Two',
    role: 'user',
    active: true
  },
  {
    username: 'testuser3',
    email: 'test3@wondertravelers.dev',
    password: 'Test@123456',
    fullName: 'Test User Three',
    role: 'user',
    active: true
  }
];

async function seedUsers() {
  try {
    // Connect to MongoDB
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable not found');
    }

    await mongoose.connect(process.env.MONGO_URI);
    logger.info('Connected to MongoDB');

    // Check existing users
    const existingCount = await User.countDocuments();
    logger.info(`Found ${existingCount} existing users`);

    // Create users
    let created = 0;
    let skipped = 0;

    for (const userData of testUsers) {
      try {
        const existingUser = await User.findOne({ email: userData.email });
        
        if (existingUser) {
          logger.info(`✓ User already exists: ${userData.email}`);
          skipped++;
        } else {
          const newUser = new User(userData);
          await newUser.save();
          logger.info(`✓ Created user: ${userData.email} (${userData.role})`);
          created++;
        }
      } catch (err) {
        logger.error(`✗ Failed to create user ${userData.email}:`, err.message);
      }
    }

    // Summary
    const totalUsers = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });
    const modCount = await User.countDocuments({ role: 'moderator' });
    const userCount = await User.countDocuments({ role: 'user' });

    logger.info('\n========== Seeding Complete ==========');
    logger.info(`Created: ${created} users`);
    logger.info(`Skipped: ${skipped} users`);
    logger.info(`\nDatabase Summary:`);
    logger.info(`  Total Users: ${totalUsers}`);
    logger.info(`  Admins: ${adminCount}`);
    logger.info(`  Moderators: ${modCount}`);
    logger.info(`  Regular Users: ${userCount}`);
    logger.info('=====================================\n');

    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run seeding
seedUsers();
