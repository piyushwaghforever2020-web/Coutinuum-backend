const cohortRepository = require('../repositories/cohort.repository');
const participantRepository = require('../repositories/participant.repository');
const {
  getParticipantPaymentStatus,
  getRegistrationStatusFromPaymentStatus
} = require('../utils/participantStatus');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const calculateDurationWeeks = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;

  return Math.ceil(totalDays / 7);
};

const validateEndDate = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'End date must be equal to or after start date.');
  }
};

const formatDateRange = (start, end) => {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);

  const sameYear = startDate.getFullYear() === endDate.getFullYear();

  const startFormatted = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    ...(sameYear ? {} : { year: 'numeric' })
  });

  const endFormatted = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });

  return `${startFormatted} – ${endFormatted}`;
};

const parseJSONSafely = (data) => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  }
  return data;
};

// Priority: draft > inactive > full > closed > open > active (upcoming)
const computeSyncStatus = (cohort) => {
  if (cohort.isDraft) return 'draft';

  if (!cohort.isActive) return 'inactive';

  const now = new Date();
  const start = cohort.startDate ? new Date(cohort.startDate) : null;
  const end   = cohort.endDate   ? new Date(cohort.endDate)   : null;

  // Seats exhausted always wins over date-based status.
  if (Number(cohort.seatsFilled) >= Number(cohort.seatLimit)) return 'full';

  // Past end date → closed only when seats were not fully filled.
  if (end && end < now) return 'closed';

  // Within date range → open for enrollment
  if (start && end && start <= now && now <= end) return 'open';

  // Before start date → upcoming/active
  return 'active';
};

const syncCohortStatus = async (cohort) => {
  const newStatus = computeSyncStatus(cohort);

  if (cohort.syncStatus !== newStatus) {
    await cohortRepository.update(cohort, { syncStatus: newStatus });
    cohort.syncStatus = newStatus; // keep local reference fresh
  }

  return newStatus;
};

const syncCohortPrograms = async (cohort, programsPayload, seatLimit) => {
  if (!programsPayload) return 0;

  const { Program, CohortProgram } = require('../models');

  if (programsPayload.length === 0) {
    await CohortProgram.destroy({ where: { cohortId: cohort.id } });
    return 0;
  }

  const allocatedSeatsBase = seatLimit || 0;
  const resolvedProgramIds = [];

  for (let i = 0; i < programsPayload.length; i++) {
    const p = programsPayload[i];

    let programId;

    if (!p.program_id) {
      // No ID provided — create a new program
      const newProgram = await Program.create({
        name: p.program_name,
        description: p.program_description
      });
      programId = newProgram.id;
    } else {
      // ID provided — upsert existing program
      await Program.upsert({
        id: p.program_id,
        name: p.program_name,
        description: p.program_description
      });
      programId = p.program_id;
    }

    resolvedProgramIds.push(programId);

    const allocatedSeats = allocatedSeatsBase;

    const [mapping, created] = await CohortProgram.findOrCreate({
      where: { cohortId: cohort.id, programId },
      defaults: {
        allocatedSeats,
        seatsFilled: 0,
        isFull: false
      }
    });

    if (!created && mapping.allocatedSeats !== allocatedSeats) {
      const isFull = mapping.seatsFilled >= allocatedSeats;
      await mapping.update({ allocatedSeats, isFull });
    }
  }

  await CohortProgram.destroy({
    where: {
      cohortId: cohort.id,
      programId: { [require('sequelize').Op.notIn]: resolvedProgramIds }
    }
  });

  return new Set(resolvedProgramIds).size;
};

const isMostSelected = (filledSeats, mostBookedSeats) =>
  mostBookedSeats > 0 && Number(filledSeats) === Number(mostBookedSeats);

const getMostBookedSeatsFromCohorts = (cohorts) =>
  cohorts.reduce(
    (maxSeats, cohort) => Math.max(maxSeats, Number(cohort.seatsFilled || 0)),
    0
  );

const mapCohortSummary = (cohort, filledSeats = 0, revenue = 0, mostBookedSeats = 0) => {
  const fillRate = cohort.seatLimit
    ? Number(((filledSeats / cohort.seatLimit) * 100).toFixed(2))
    : 0;

  const status = cohort.status === 'closed' ? 'closed' : filledSeats >= cohort.seatLimit ? 'full' : cohort.status;

  const durationWeeks = calculateDurationWeeks(cohort.startDate, cohort.endDate);
  const durationFormat = formatDateRange(cohort.startDate, cohort.endDate);
  const duration = durationWeeks && durationFormat ? `${durationWeeks} weeks | ${durationFormat}` : null;
  const seatsRemaining = Math.max((cohort.seatLimit || 0) - filledSeats, 0);

  return {
    id: cohort.id,
    name: cohort.name,
    description: cohort.description,
    start_date: cohort.startDate,
    end_date: cohort.endDate,
    duration_weeks: durationWeeks,
    duration_format: durationFormat,
    duration,
    price: cohort.price,
    seat_limit: cohort.seatLimit,
    seats_filled: filledSeats,
    seats_remaining: seatsRemaining,
    fill_rate: fillRate,
    status,
    refund_policy: cohort.refundPolicy,
    refund_deferral_policy: parseJSONSafely(cohort.refundDeferralPolicy),
    time_commitment: cohort.timeCommitment,
    program_overview: cohort.programOverview,
    leave_with: parseJSONSafely(cohort.leaveWith),
    live_sessions_text: cohort.liveSessionsText,
    workshops_text: cohort.workshopsText,
    cohort_size_text: cohort.cohortSizeText,
    investment_tiers: parseJSONSafely(cohort.investmentTiers),
    scarcity_text: cohort.scarcityText,
    display_price: cohort.displayPrice,
    programs: cohort.programs ? cohort.programs.map((p) => ({
      program_id: p.id,
      program_name: p.name,
      program_description: p.description,
      allocated_seats: p.CohortProgram ? p.CohortProgram.allocatedSeats : 0,
      seats_filled: p.CohortProgram ? p.CohortProgram.seatsFilled : 0,
      is_full: p.CohortProgram ? p.CohortProgram.isFull : false
    })) : [],
    has_multi_program: Boolean(cohort.hasMultiProgram),
    is_active: Boolean(cohort.isActive),
    is_draft: Boolean(cohort.isDraft),
    sync_status: cohort.syncStatus,
    mostSelected: isMostSelected(filledSeats, mostBookedSeats),
    revenue,
    created_at: cohort.createdAt,
    updated_at: cohort.updatedAt
  };
};

class CohortService {
  async getPublicCohorts() {
    const cohorts = await cohortRepository.findPublicList();
    const mostBookedSeats = getMostBookedSeatsFromCohorts(cohorts);

    return cohorts.map((cohort) => {
      const durationWeeks = calculateDurationWeeks(cohort.startDate, cohort.endDate);
      const durationFormat = formatDateRange(cohort.startDate, cohort.endDate);
      const duration = durationWeeks && durationFormat ? `${durationWeeks} weeks | ${durationFormat}` : null;

      return {
        id: cohort.id,
        name: cohort.name,
        description: cohort.description,
        start_date: cohort.startDate,
        end_date: cohort.endDate,
        duration_weeks: durationWeeks,
        duration_format: durationFormat,
        duration,
        price: cohort.price,
        seat_limit: cohort.seatLimit,
        seats_filled: Number(cohort.seatsFilled),
        seats_remaining: Math.max(
          Number(cohort.seatLimit) - Number(cohort.seatsFilled),
          0
        ),
        status: cohort.status,
        refund_policy: cohort.refundPolicy,
        refund_deferral_policy: parseJSONSafely(cohort.refundDeferralPolicy),
        time_commitment: cohort.timeCommitment,
        program_overview: cohort.programOverview,
        leave_with: parseJSONSafely(cohort.leaveWith),
        live_sessions_text: cohort.liveSessionsText,
        workshops_text: cohort.workshopsText,
        cohort_size_text: cohort.cohortSizeText,
        investment_tiers: parseJSONSafely(cohort.investmentTiers),
        scarcity_text: cohort.scarcityText,
        display_price: cohort.displayPrice,
        programs: cohort.programs ? cohort.programs.map((p) => ({
          program_id: p.id,
          program_name: p.name,
          program_description: p.description,
          allocated_seats: p.CohortProgram ? p.CohortProgram.allocatedSeats : 0,
          seats_filled: p.CohortProgram ? p.CohortProgram.seatsFilled : 0,
          is_full: p.CohortProgram ? p.CohortProgram.isFull : false
        })) : [],
        has_multi_program: Boolean(cohort.hasMultiProgram),
        is_active: Boolean(cohort.isActive),
        is_draft: Boolean(cohort.isDraft),
        sync_status: cohort.syncStatus,
        mostSelected: isMostSelected(cohort.seatsFilled, mostBookedSeats),
        is_enrollment_open:
          Boolean(cohort.isActive) &&
          cohort.status === 'active' &&
          Number(cohort.seatsFilled) < Number(cohort.seatLimit)
      };
    });
  }

  async getPublicCohortSeatAvailability(id) {
    const cohort = await cohortRepository.findById(id);

    if (!cohort) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
    }

    const seatLimit = Number(cohort.seatLimit);
    const seatsFilled = Number(cohort.seatsFilled);
    const seatsRemaining = Math.max(seatLimit - seatsFilled, 0);
    const seatAvailable =
      Boolean(cohort.isActive) &&
      cohort.status === 'active' &&
      seatsRemaining > 0;

    return {
      cohort_id: cohort.id,
      start_date: cohort.startDate,
      seat_available: seatAvailable,
      seats_remaining: seatsRemaining,
      seat_limit: seatLimit,
      seats_filled: seatsFilled,
      status: cohort.status,
      is_active: Boolean(cohort.isActive),
      is_draft: Boolean(cohort.isDraft)
    };
  }

  async getCohorts(query = {}) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const filters = {
      isActive: query.is_active,
      isDraft: query.is_draft
    };

    const [{ rows, count }, mostBookedSeats] = await Promise.all([
      cohortRepository.findAll({
        filters,
        limit,
        offset
      }),
      cohortRepository.getMostBookedSeats(filters)
    ]);
    const cohortIds = rows.map((cohort) => cohort.id);
    const revenueMap = await cohortRepository.getRevenueMap(cohortIds);

    return {
      items: rows.map((cohort) =>
        mapCohortSummary(
          cohort,
          Number(cohort.seatsFilled),
          revenueMap[cohort.id] || 0,
          mostBookedSeats
        )
      ),
      pagination: buildPaginationMeta(count, page, limit)
    };
  }

  async createCohort(payload) {
    validateEndDate(payload.start_date, payload.end_date);

    const cohort = await cohortRepository.create({
      name: payload.name,
      description: payload.description,
      startDate: payload.start_date,
      endDate: payload.end_date,
      price: payload.price,
      seatLimit: payload.seat_limit,
      refundPolicy: payload.refund_policy,
      refundDeferralPolicy: payload.refund_deferral_policy,
      timeCommitment: payload.time_commitment,
      programOverview: payload.program_overview,
      leaveWith: payload.leave_with,
      liveSessionsText: payload.live_sessions_text,
      workshopsText: payload.workshops_text,
      cohortSizeText: payload.cohort_size_text,
      investmentTiers: payload.investment_tiers,
      scarcityText: payload.scarcity_text,
      displayPrice: payload.display_price,
      isDraft: Boolean(payload.is_draft),
      status: 'active',
      hasMultiProgram: payload.programs ? payload.programs.length >= 0 : false,
      ...(payload.is_active !== undefined && { isActive: payload.is_active })
    });

    if (payload.programs !== undefined) {
      const linkedProgramCount = await syncCohortPrograms(cohort, payload.programs, payload.seat_limit);
      await cohortRepository.update(cohort, { hasMultiProgram: linkedProgramCount >= 0 });
    }

    // Refresh cohort with latest data before computing status
    const fresh = await cohortRepository.findById(cohort.id);
    await syncCohortStatus(fresh);

    return this.getCohortById(cohort.id);
  }

  async updateCohort(id, payload) {
    const cohort = await cohortRepository.findById(id);

    if (!cohort) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
    }

    const filledSeats = Number(cohort.seatsFilled);

    if (payload.seat_limit && payload.seat_limit < filledSeats) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Seat limit cannot be lower than the number of enrolled participants.'
      );
    }

    const resolvedStartDate = payload.start_date !== undefined ? payload.start_date : cohort.startDate;
    const resolvedEndDate = payload.end_date !== undefined ? payload.end_date : cohort.endDate;
    validateEndDate(resolvedStartDate, resolvedEndDate);

    const updatedPayload = {
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.start_date !== undefined && { startDate: payload.start_date }),
      ...(payload.end_date !== undefined && { endDate: payload.end_date }),
      ...(payload.price !== undefined && { price: payload.price }),
      ...(payload.seat_limit !== undefined && { seatLimit: payload.seat_limit }),
      ...(payload.refund_policy !== undefined && { refundPolicy: payload.refund_policy }),
      ...(payload.refund_deferral_policy !== undefined && {
        refundDeferralPolicy: payload.refund_deferral_policy
      }),
      ...(payload.time_commitment !== undefined && { timeCommitment: payload.time_commitment }),
      ...(payload.program_overview !== undefined && { programOverview: payload.program_overview }),
      ...(payload.leave_with !== undefined && { leaveWith: payload.leave_with }),
      ...(payload.live_sessions_text !== undefined && { liveSessionsText: payload.live_sessions_text }),
      ...(payload.workshops_text !== undefined && { workshopsText: payload.workshops_text }),
      ...(payload.cohort_size_text !== undefined && { cohortSizeText: payload.cohort_size_text }),
      ...(payload.investment_tiers !== undefined && { investmentTiers: payload.investment_tiers }),
      ...(payload.scarcity_text !== undefined && { scarcityText: payload.scarcity_text }),
      ...(payload.display_price !== undefined && { displayPrice: payload.display_price }),
      ...(payload.status !== undefined && { status: payload.status }),
      ...(payload.programs !== undefined && { hasMultiProgram: payload.programs.length > 0 }),
      ...(payload.is_active !== undefined && { isActive: payload.is_active }),
      ...(payload.is_draft !== undefined && { isDraft: payload.is_draft })
    };

    const updated = await cohortRepository.update(cohort, updatedPayload);

    if (payload.programs !== undefined) {
      const linkedProgramCount = await syncCohortPrograms(updated, payload.programs, updated.seatLimit);
      await cohortRepository.update(updated, { hasMultiProgram: linkedProgramCount > 0 });
    }

    // Re-fetch to get latest seatsFilled, isDraft, dates before sync
    const fresh = await cohortRepository.findById(id);
    await syncCohortStatus(fresh);

    return this.getCohortById(id);
  }

  async deleteCohort(id) {
    const cohort = await cohortRepository.findById(id);

    if (!cohort) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
    }

    await cohortRepository.softDelete(cohort);

    return {
      id,
      deleted: true
    };
  }

  async updateCohortActiveStatus(id, payload) {
    const cohort = await cohortRepository.findById(id);

    if (!cohort) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
    }

    await cohortRepository.update(cohort, {
      isActive: payload.is_active
    });

    const fresh = await cohortRepository.findById(id);
    await syncCohortStatus(fresh);

    return this.getCohortById(id);
  }

  async getCohortById(id) {
    const cohort = await cohortRepository.findById(id);

    if (!cohort) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
    }

    const [participants, revenueMap, mostBookedSeats] = await Promise.all([
      participantRepository.findByCohort(id),
      cohortRepository.getRevenueMap([id]),
      cohortRepository.getMostBookedSeats()
    ]);

    const summary = mapCohortSummary(
      cohort,
      Number(cohort.seatsFilled),
      revenueMap[id] || 0,
      mostBookedSeats
    );

    return {
      ...summary,
      participants: participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        email: participant.email,
        phone: participant.phone,
        company: participant.company,
        role: participant.role,
        program_id: participant.programId,
        program: participant.program
          ? {
              id: participant.program.id,
              name: participant.program.name,
              description: participant.program.description
            }
          : null,
        payment_status: getParticipantPaymentStatus(participant.paymentStatus),
        registration_status: getRegistrationStatusFromPaymentStatus(participant.paymentStatus),
        is_active: Boolean(participant.isActive),
        created_at: participant.createdAt
      }))
    };
  }
}

const cohortServiceInstance = new CohortService();

module.exports = cohortServiceInstance;
module.exports.syncCohortStatus = syncCohortStatus;
