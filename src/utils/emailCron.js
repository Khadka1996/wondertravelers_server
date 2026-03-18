// src/utils/emailCron.js
import cron from 'node-cron';
import { logger } from './logger.util.js';

// Placeholder – replace with your actual email sending logic
// (e.g. Nodemailer, Resend, Postmark, SendGrid, etc.)
const sendDailySummaryEmail = async () => {
  try {
    logger.info('Starting daily email summary job');

    // Example: fetch users who need summary, send emails...
    // const users = await User.find({ receiveDailySummary: true });
    // for (const user of users) { await sendEmail(user.email, 'Your daily summary', '...'); }

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1500));

    logger.info('Daily email summary job completed successfully');
  } catch (err) {
    logger.error('Daily email summary job failed', { error: err.message, stack: err.stack });
    // Optional: send alert to admin/Slack/PagerDuty
  }
};

const sendWeeklyReportEmail = async () => {
  try {
    logger.info('Starting weekly report email job');
    // ... similar logic ...
    await new Promise(resolve => setTimeout(resolve, 1200));
    logger.info('Weekly report email job completed');
  } catch (err) {
    logger.error('Weekly report email job failed', { error: err.message });
  }
};

// ── Exported API ─────────────────────────────────────────────────────────────
export default {
  // Called once after successful DB connection
  start: () => {
    // Every day at 8:00 AM (server time) → daily summary
    cron.schedule('0 8 * * *', sendDailySummaryEmail, {
      scheduled: true,
      timezone: 'Asia/Kathmandu', // Nepal time – adjust as needed
    });

    // Every Monday at 7:00 AM → weekly report
    cron.schedule('0 7 * * 1', sendWeeklyReportEmail, {
      scheduled: true,
      timezone: 'Asia/Kathmandu',
    });

    logger.info('Email cron jobs scheduled (daily @ 8 AM, weekly Monday @ 7 AM NPT)');
  },

  // Called during graceful shutdown
  stop: () => {
    // node-cron doesn't have built-in stop-all, but you can destroy tasks if needed
    // For simple use-cases this is usually not required (process exit handles it)
    logger.info('Email cron jobs stopped (or process exiting)');
  },
};

// Bonus: If you scale horizontally (multiple instances), consider switching to BullMQ + Redis:
// → repeatable jobs with locking / uniqueness
// → guaranteed execution even after restarts
// → retries, priorities, delays, concurrency control
// Example migration path: https://bullmq.io/guide/repeatable
// For now node-cron is fine for single-instance or non-critical emails.