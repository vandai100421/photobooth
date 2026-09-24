const cron = require('node-cron');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { runBirthdayJob } = require('./jobs/birthday.job');
const { runHolidayJob } = require('./jobs/holiday.job');
const { runReengageJob } = require('./jobs/reengage.job');

const DEFAULT_SCHEDULE = '0 8 * * *';
let tasks = [];

// Read the cron expression from the settings table. Falls back to the
// default (8:00 AM daily) when missing, invalid, or on DB error.
const getSchedule = async () => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'cron_schedule')
      .maybeSingle();
    if (error) {
      logger.warn(
        `cron: settings query failed, using default (${DEFAULT_SCHEDULE}): ${error.message}`,
      );
      return DEFAULT_SCHEDULE;
    }
    const schedule = data && data.value;
    if (!schedule) {
      return DEFAULT_SCHEDULE;
    }
    if (!cron.validate(schedule)) {
      logger.warn(`cron: invalid schedule '${schedule}', using default`);
      return DEFAULT_SCHEDULE;
    }
    return schedule;
  } catch (err) {
    logger.warn(
      `cron: failed to read schedule, using default: ${err.message}`,
    );
    return DEFAULT_SCHEDULE;
  }
};

// Run all three jobs sequentially. Each job is isolated so a failure in
// one does not prevent the others from running.
const runAllJobs = async () => {
  const jobs = [
    { name: 'birthday', fn: runBirthdayJob },
    { name: 'holiday', fn: runHolidayJob },
    { name: 'reengage', fn: runReengageJob },
  ];
  for (const { name, fn } of jobs) {
    try {
      logger.info(`cron: starting ${name} job`);
      await fn();
      logger.info(`cron: ${name} job completed`);
    } catch (err) {
      logger.error(`cron: ${name} job failed: ${err.message}`, err.stack);
    }
  }
};

// Initialize the scheduler. Reads the cron expression from settings and
// registers a single scheduled task that runs all three jobs.
const initScheduler = async () => {
  const schedule = await getSchedule();
  const task = cron.schedule(schedule, () => {
    runAllJobs().catch((err) => {
      logger.error(`cron: unhandled error in runAllJobs: ${err.message}`);
    });
  });
  tasks = [task];
  logger.info(`Cron scheduler initialized with schedule '${schedule}'`);
};

// Stop all scheduled tasks (for graceful shutdown).
const stopScheduler = () => {
  for (const t of tasks) {
    t.stop();
  }
  tasks = [];
  logger.info('Cron scheduler stopped');
};

// Exported so the HTTP cron endpoint (src/modules/cron) can trigger all
// jobs on Vercel serverless, where node-cron cannot run.
module.exports = { initScheduler, stopScheduler, runAllJobs };
