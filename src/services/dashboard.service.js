const dashboardRepository = require('../repositories/dashboard.repository');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const DASHBOARD_FILTERS = Object.freeze(['weekly', 'monthly', 'yearly']);
const DEFAULT_DASHBOARD_FILTER = 'monthly';
const toPercentage = (value, total) => {
  if (!total) {
    return 0;
  }

  return Number(((Number(value || 0) / Number(total)) * 100).toFixed(2));
};

const CHART_WEEKS = 8;

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDashboardDateRange = (filter = DEFAULT_DASHBOARD_FILTER) => {
  const normalizedFilter = DASHBOARD_FILTERS.includes(filter)
    ? filter
    : DEFAULT_DASHBOARD_FILTER;
  const endDate = new Date();
  let startDate;

  if (normalizedFilter === 'weekly') {
    startDate = startOfDay(endDate);
    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - mondayOffset);
  } else if (normalizedFilter === 'yearly') {
    startDate = new Date(endDate.getFullYear(), 0, 1);
  } else {
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  }

  return {
    filter: normalizedFilter,
    startDate,
    endDate
  };
};

const buildGraphMeta = (dateRange) => ({
  filter: dateRange.filter,
  available_filters: DASHBOARD_FILTERS,
  period: {
    start_date: dateRange.startDate.toISOString(),
    end_date: dateRange.endDate.toISOString()
  },
  keys: {
    label: 'label',
    value: 'value',
    key: 'key',
    percentage: 'percentage'
  }
});

const buildGraphItem = (key, label, value, total) => ({
  key,
  label,
  value,
  percentage: toPercentage(value, total)
});

const differenceInWeeks = (startDate, endDate) => {
  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsPerWeek);
};

const buildCohortFillProgress = (cohort, paidParticipants) => {
  const labels = Array.from({ length: CHART_WEEKS }, (_, index) => `W${index + 1}`);

  if (!cohort) {
    return {
      cohort_id: null,
      cohort_name: null,
      labels,
      series: labels.map(() => 0),
      seat_limit: 0,
      seats_filled: 0,
      fill_rate: 0
    };
  }

  const chartStartDate = startOfDay(cohort.createdAt || cohort.startDate || new Date());
  const weeklyCounts = Array.from({ length: CHART_WEEKS }, () => 0);

  for (const participant of paidParticipants) {
    const participantDate = startOfDay(participant.createdAt);
    const weekIndex = Math.max(
      0,
      Math.min(CHART_WEEKS - 1, differenceInWeeks(chartStartDate, participantDate))
    );

    weeklyCounts[weekIndex] += 1;
  }

  const series = weeklyCounts.reduce((accumulator, count, index) => {
    const previousValue = index > 0 ? accumulator[index - 1] : 0;
    accumulator.push(previousValue + count);
    return accumulator;
  }, []);

  const actualSeatsFilled = Number(cohort.seatsFilled || 0);
  const lastSeriesValue = series[series.length - 1] || 0;

  if (actualSeatsFilled > lastSeriesValue && series.length) {
    series[series.length - 1] = actualSeatsFilled;
  }

  const seatLimit = Number(cohort.seatLimit || 0);
  const fillRate = toPercentage(actualSeatsFilled, seatLimit);

  return {
    cohort_id: cohort.id,
    cohort_name: cohort.name,
    labels,
    series,
    seat_limit: seatLimit,
    seats_filled: actualSeatsFilled,
    fill_rate: fillRate
  };
};

const buildRegistrationOverview = (registrationCompleted, registrationIncomplete, dateRange) => {
  const total = Number(registrationCompleted || 0) + Number(registrationIncomplete || 0);

  return {
    ...buildGraphMeta(dateRange),
    total,
    items: [
      buildGraphItem('complete', 'Complete', registrationCompleted, total),
      buildGraphItem('not_complete', 'Not Complete', registrationIncomplete, total)
    ]
  };
};

const buildPaymentOverview = (
  totalPaidUsers,
  totalFailedUsers,
  totalRefundedUsers,
  dateRange
) => {
  const total =
    Number(totalPaidUsers || 0) + Number(totalFailedUsers || 0) + Number(totalRefundedUsers || 0);

  return {
    ...buildGraphMeta(dateRange),
    total,
    items: [
      buildGraphItem('paid', 'Paid', totalPaidUsers, total),
      buildGraphItem('failed', 'Failed', totalFailedUsers, total),
      buildGraphItem('refund', 'Refund', totalRefundedUsers, total)
    ]
  };
};

const fetchRegistrationOverview = async (dateRange) => {
  const [registrationCompleted, registrationIncomplete] = await Promise.all([
    dashboardRepository.getRegistrationCompletedCount(dateRange),
    dashboardRepository.getRegistrationIncompleteCount(dateRange)
  ]);

  return buildRegistrationOverview(registrationCompleted, registrationIncomplete, dateRange);
};

const fetchPaymentOverview = async (dateRange) => {
  const [totalPaidUsers, totalFailedUsers, totalRefundedUsers] = await Promise.all([
    dashboardRepository.getParticipantCountByPaymentStatus('paid', dateRange),
    dashboardRepository.getParticipantCountByPaymentStatus('failed', dateRange),
    dashboardRepository.getParticipantCountByPaymentStatus('refunded', dateRange)
  ]);

  return buildPaymentOverview(totalPaidUsers, totalFailedUsers, totalRefundedUsers, dateRange);
};

const buildCohortOption = (cohort) => ({
  id: cohort.id,
  name: cohort.name,
  start_date: cohort.startDate,
  seat_limit: Number(cohort.seatLimit || 0),
  seats_filled: Number(cohort.seatsFilled || 0),
  status: cohort.status
});

const fetchCohortFillProgress = async (cohortId, cohorts) => {
  const selectedCohort = cohorts.find((cohort) => Number(cohort.id) === Number(cohortId)) || null;

  if (!selectedCohort) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found for dashboard graph.');
  }

  const paidParticipants = await dashboardRepository.getPaidParticipantsByCohort(selectedCohort.id);
  const graph = buildCohortFillProgress(selectedCohort, paidParticipants);

  return {
    ...graph,
    points: graph.labels.map((label, index) => ({
      label,
      value: graph.series[index] || 0
    })),
    cohort_options: cohorts.map(buildCohortOption)
  };
};

class DashboardService {
  async getRegistrationCompletionGraph(query = {}) {
    const dateRange = getDashboardDateRange(query.filter);
    return fetchRegistrationOverview(dateRange);
  }

  async getPaymentStatusGraph(query = {}) {
    const dateRange = getDashboardDateRange(query.filter);
    return fetchPaymentOverview(dateRange);
  }

  async getCohortFillProgressGraph(query = {}) {
    const cohorts = await dashboardRepository.getCohorts();
    return fetchCohortFillProgress(query.cohort_id, cohorts);
  }

  async getDashboardMetrics(query = {}) {
    const dateRange = getDashboardDateRange(query.filter);
    const [
      totalPaidUsers,
      totalFailedUsers,
      totalRefundedUsers,
      registrationCompleted,
      registrationIncomplete,
      totalSeatLimit,
      filledSeatCount,
      cohorts
    ] = await Promise.all([
      dashboardRepository.getTotalPaidUsers(),
      dashboardRepository.getParticipantCountByPaymentStatus('failed'),
      dashboardRepository.getParticipantCountByPaymentStatus('refunded'),
      dashboardRepository.getRegistrationCompletedCount(),
      dashboardRepository.getRegistrationIncompleteCount(),
      dashboardRepository.getTotalSeatLimit(),
      dashboardRepository.getFilledSeatCount(),
      dashboardRepository.getCohorts()
    ]);
    const [registrationOverviewGraph, paymentOverviewGraph] = await Promise.all([
      fetchRegistrationOverview(dateRange),
      fetchPaymentOverview(dateRange)
    ]);

    const fillRate = totalSeatLimit
      ? Number(((filledSeatCount / totalSeatLimit) * 100).toFixed(2))
      : 0;
    const totalPaymentStatusUsers =
      Number(totalPaidUsers || 0) +
      Number(totalFailedUsers || 0) +
      Number(totalRefundedUsers || 0);
    const totalParticipants = Number(registrationCompleted || 0) + Number(registrationIncomplete || 0);
    const availableSeats = Math.max(Number(totalSeatLimit || 0) - Number(filledSeatCount || 0), 0);
    const cohortFillProgress = cohorts.length
      ? await fetchCohortFillProgress(query.cohort_id || cohorts[0].id, cohorts)
      : {
          ...buildCohortFillProgress(null, []),
          points: [],
          cohort_options: []
        };

    return {
      total_paid_users: totalPaidUsers,
      total_failed_users: totalFailedUsers,
      total_refunded_users: totalRefundedUsers,
      registration_completed: registrationCompleted,
      registration_incomplete: registrationIncomplete,
      cohort_fill_rate: fillRate,
      cohort_options: cohorts.map(buildCohortOption),
      percentages: {
        paid_users: toPercentage(totalPaidUsers, totalPaymentStatusUsers),
        failed_users: toPercentage(totalFailedUsers, totalPaymentStatusUsers),
        refunded_users: toPercentage(totalRefundedUsers, totalPaymentStatusUsers),
        registration_completed: toPercentage(registrationCompleted, totalParticipants),
        registration_incomplete: toPercentage(registrationIncomplete, totalParticipants),
        filled_seats: toPercentage(filledSeatCount, totalSeatLimit),
        available_seats: toPercentage(availableSeats, totalSeatLimit),
        payment_statuses: {
          paid: toPercentage(totalPaidUsers, totalPaymentStatusUsers),
          failed: toPercentage(totalFailedUsers, totalPaymentStatusUsers),
          refunded: toPercentage(totalRefundedUsers, totalPaymentStatusUsers)
        }
      },
      graph: {
        keys: {
          label: 'label',
          value: 'value',
          key: 'key',
          percentage: 'percentage'
        },
        active_filter: dateRange.filter,
        payment_overview: paymentOverviewGraph.items,
        payment_overview_meta: {
          filter: paymentOverviewGraph.filter,
          available_filters: paymentOverviewGraph.available_filters,
          period: paymentOverviewGraph.period,
          total: paymentOverviewGraph.total
        },
        registration_overview: registrationOverviewGraph.items,
        registration_overview_meta: {
          filter: registrationOverviewGraph.filter,
          available_filters: registrationOverviewGraph.available_filters,
          period: registrationOverviewGraph.period,
          total: registrationOverviewGraph.total
        },
        cohort_capacity: [
          {
            key: 'filled_seats',
            label: 'Filled Seats',
            value: Number(filledSeatCount || 0),
            percentage: toPercentage(filledSeatCount, totalSeatLimit)
          },
          {
            key: 'available_seats',
            label: 'Available Seats',
            value: availableSeats,
            percentage: toPercentage(availableSeats, totalSeatLimit)
          },
          {
            key: 'total_seat_limit',
            label: 'Total Seat Limit',
            value: Number(totalSeatLimit || 0),
            percentage: totalSeatLimit ? 100 : 0
          },
          {
            key: 'cohort_fill_rate',
            label: 'Cohort Fill Rate',
            value: fillRate,
            percentage: fillRate
          }
        ],
        cohort_fill_progress: cohortFillProgress
      },
      cohort_fill_progress: cohortFillProgress
    };
  }
}

module.exports = new DashboardService();
