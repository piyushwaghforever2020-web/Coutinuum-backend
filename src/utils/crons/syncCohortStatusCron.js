const cohortRepository = require('../../repositories/cohort.repository');
const { FINAL_COHORT_STATUSES } = require('../../constants/app.constants');
const {syncCohortStatus} = require('../../services/cohort.service')
const cron = require('node-cron');

const syncAllCohortStatuses = async () => {
  const cohorts = await cohortRepository.findAll({ limit: 1000, offset: 0 });

  for (const cohort of cohorts.rows) {
    await syncCohortStatus(cohort);
  }
};

cron.schedule('0 * * * *', async () => {
  console.log('Running cohort status sync cron job...');
  try {
    await syncAllCohortStatuses();
    console.log('Cohort status sync completed successfully.');
  } catch (error) {
    console.error('Error during cohort status sync:', error);
  }
});
