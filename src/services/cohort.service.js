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

const syncCohortPrograms = async (cohort, programsPayload, seatLimit) => {
  if (!programsPayload) return;

  const { Program, CohortProgram } = require('../models');

  if (programsPayload.length === 0) {
    await CohortProgram.destroy({ where: { cohortId: cohort.id } });
    return;
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
        seats_remaining: Math.max(Number(cohort.seatLimit) - Number(cohort.seatsFilled),0),
        status: cohort.status,
        refund_policy: cohort.refundPolicy,
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
      is_active: Boolean(cohort.isActive)
    };
  }

  async getCohorts(query = {}) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const filters = {
      isActive: query.is_active
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
      leaveWith: payload.leave_with,
      liveSessionsText: payload.live_sessions_text,
      workshopsText: payload.workshops_text,
      cohortSizeText: payload.cohort_size_text,
      investmentTiers: payload.investment_tiers,
      scarcityText: payload.scarcity_text,
      displayPrice: payload.display_price,
      status: 'active',
      hasMultiProgram: payload.programs && payload.programs.length >= 2,
      ...(payload.is_active !== undefined && { isActive: payload.is_active })
    });

    if (payload.programs) {
      await syncCohortPrograms(cohort, payload.programs, payload.seat_limit);
    }

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
      ...(payload.leave_with !== undefined && { leaveWith: payload.leave_with }),
      ...(payload.live_sessions_text !== undefined && { liveSessionsText: payload.live_sessions_text }),
      ...(payload.workshops_text !== undefined && { workshopsText: payload.workshops_text }),
      ...(payload.cohort_size_text !== undefined && { cohortSizeText: payload.cohort_size_text }),
      ...(payload.investment_tiers !== undefined && { investmentTiers: payload.investment_tiers }),
      ...(payload.scarcity_text !== undefined && { scarcityText: payload.scarcity_text }),
      ...(payload.display_price !== undefined && { displayPrice: payload.display_price }),
      ...(payload.status !== undefined && { status: payload.status }),
      ...(payload.programs !== undefined && { hasMultiProgram: payload.programs.length >= 2 }),
      ...(payload.is_active !== undefined && { isActive: payload.is_active })
    };

    const updated = await cohortRepository.update(cohort, updatedPayload);

    if (payload.programs !== undefined) {
      await syncCohortPrograms(updated, payload.programs, updated.seatLimit);
    }

    const status =
      updated.status === 'closed'
        ? 'closed'
        : filledSeats >= updated.seatLimit
          ? 'full'
          : updated.status;

    if (status !== updated.status) {
      await cohortRepository.update(updated, { status });
    }

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

module.exports = new CohortService();
