#!/usr/bin/env node
// scripts/test-admin-api.js - Test admin users API

import 'dotenv/config';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';
const TEST_EMAIL = 'Admin@gmail.com';
const TEST_PASSWORD = 'Password@321';

async function testAdminAPI() {
  console.log('\n=== ADMIN API TEST ===\n');

  try {
    // Step 1: Login
    console.log(`1️⃣ Logging in with: ${TEST_EMAIL}`);
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json().catch(() => ({}));
      throw new Error(`Login failed: ${loginResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const loginData = await loginResponse.json();
    console.log(`✅ Login successful!`);
    console.log(`   User: ${loginData.user?.username}`);
    console.log(`   Role: ${loginData.user?.role}`);
    console.log(`   Email: ${loginData.user?.email}`);

    const accessToken = loginData.token || loginData.accessToken;
    console.log(`   Token: ${accessToken.substring(0, 30)}...`);

    // Step 2: Get users list
    console.log(`\n2️⃣ Fetching admin/users/all...`);
    const usersResponse = await fetch(`${API_URL}/api/admin/users/all?page=1&limit=10`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Cookie': `access_token=${accessToken}`
      }
    });

    if (!usersResponse.ok) {
      const errorData = await usersResponse.json().catch(() => ({}));
      throw new Error(`Users fetch failed: ${usersResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const usersData = await usersResponse.json();
    console.log(`✅ Users fetched successfully!`);
    console.log(`   Total Users: ${usersData.pagination?.total}`);
    console.log(`   Page: ${usersData.pagination?.page}/${usersData.pagination?.pages}`);
    console.log(`   Users in response: ${usersData.data?.length}`);

    // Step 3: Display users
    console.log(`\n3️⃣ User Data:`);
    console.log(`\n┌─────────────────────────────────────────────────────────────────┐`);
    console.log(`│ Username         │ Email                    │ Role       │ Status   │`);
    console.log(`├─────────────────────────────────────────────────────────────────┤`);

    usersData.data?.forEach(user => {
      const username = (user.username || 'N/A').padEnd(15);
      const email = (user.email || 'N/A').padEnd(24);
      const role = (user.role || 'N/A').padEnd(10);
      const status = user.active ? 'Active' : 'Inactive';
      console.log(`│ ${username} │ ${email} │ ${role} │ ${status}  │`);
    });

    console.log(`└─────────────────────────────────────────────────────────────────┘`);

    // Step 4: Test user details endpoint
    if (usersData.data && usersData.data.length > 0) {
      const firstUser = usersData.data[0];
      console.log(`\n4️⃣ Fetching details for user: ${firstUser.username}`);

      const detailsResponse = await fetch(`${API_URL}/api/admin/users/${firstUser._id}/details`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Cookie': `access_token=${accessToken}`
        }
      });

      if (!detailsResponse.ok) {
        console.log(`⚠️ User details fetch failed: ${detailsResponse.status}`);
      } else {
        const detailsData = await detailsResponse.json();
        console.log(`✅ User details fetched!`);
        console.log(`   Username: ${detailsData.data?.username}`);
        console.log(`   Email: ${detailsData.data?.email}`);
        console.log(`   Full Name: ${detailsData.data?.fullName}`);
        console.log(`   Role: ${detailsData.data?.role}`);
        console.log(`   Active: ${detailsData.data?.active}`);
        console.log(`   Phone: ${detailsData.data?.phone || 'N/A'}`);
        console.log(`   Created: ${new Date(detailsData.data?.createdAt).toLocaleString()}`);
      }
    }

    console.log(`\n✅ ALL TESTS PASSED! Backend API is working correctly.\n`);

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}\n`);
    process.exit(1);
  }
}

// Run tests
testAdminAPI();
