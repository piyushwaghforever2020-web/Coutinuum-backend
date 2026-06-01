const cron = require('node-cron');
const applicationService = require('../../services/application.service');

cron.schedule('* * * * *', async () => {
  try {
    const result = await applicationService.releaseExpiredSelfPaySeatHolds({ limit: 100 });

    if (result.processed > 0) {
      console.log('[Seat Hold] Expired self-pay holds released.', result);
    }
  } catch (error) {
    console.error('[Seat Hold] Expired hold cleanup failed:', error);
  }
});
