const { Op } = require('sequelize');
const { sequelize } = require('../models');
const sponsorshipRepository = require('../repositories/sponsorship.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const seatRepository = require('../repositories/seat.repository');
const sponsorshipService = require('./sponsorship.service');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');

const TERMINAL_STATUSES = ['failed', 'voided', 'cancelled'];

const mapEmployer = (employer) =>
  employer
    ? {
        id: Number(employer.id),
        name: employer.name,
        email: employer.email,
        company_name: employer.companyName
      }
    : null;

const mapCohort = (cohort) =>
  cohort
    ? {
        id: Number(cohort.id),
        name: cohort.name,
        status: cohort.status
      }
    : null;

const mapProgram = (program) =>
  program
    ? {
        id: Number(program.id),
        name: program.name
      }
    : null;

const mapSeat = (seat) => ({
  id: Number(seat.id),
  status: seat.status,
  participant_id: seat.participantId ? Number(seat.participantId) : null,
  participant_email: seat.participantEmail || null,
  assigned_email: seat.assignedEmail || null
});

const mapAdminListItem = (sponsorship) => ({
  id: Number(sponsorship.id),
  status: sponsorship.status,
  sponsership_category: sponsorship.sponsershipCategory,
  total_seats: Number(sponsorship.totalSeats),
  used_seats: Number(sponsorship.usedSeats || 0),
  amount: Number(sponsorship.amount || 0),
  currency: sponsorship.currency,
  paid_at: sponsorship.paidAt,
  invoice_due_at: sponsorship.invoiceDueAt,
  created_at: sponsorship.createdAt,
  updated_at: sponsorship.updatedAt,
  employer: mapEmployer(sponsorship.employer),
  cohort: mapCohort(sponsorship.cohort),
  program: mapProgram(sponsorship.program)
});

const mapAdminDetail = (sponsorship) => {
  const seats = (sponsorship.seats || []).map(mapSeat);

  return {
    ...mapAdminListItem(sponsorship),
    hosted_invoice_url: sponsorship.hostedInvoiceUrl,
    invoice_pdf_url: sponsorship.invoicePdfUrl,
    stripe_invoice_id: sponsorship.stripeInvoiceId,
    invoice: sponsorship.invoice
      ? {
          id: Number(sponsorship.invoice.id),
          status: sponsorship.invoice.status,
          paid_at: sponsorship.invoice.paidAt
        }
      : null,
    seats
  };
};

class AdminSponsorshipService {
  async getAllSponsorships(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const filters = {
      category: query.category,
      status: query.status,
      search: query.search,
      cohortId: query.cohort
    };

    const { rows, count } = await sponsorshipRepository.findAllAdmin({
      filters,
      limit,
      offset
    });

    return {
      items: rows.map(mapAdminListItem),
      pagination: buildPaginationMeta(count, page, limit)
    };
  }

  async getSponsorshipById(id) {
    const sponsorship = await sponsorshipRepository.findById(id);

    if (!sponsorship) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
    }

    return mapAdminDetail(sponsorship);
  }

  async updateSponsorship(id, payload) {
    const sponsorship = await sponsorshipRepository.findPlainById(id);

    if (!sponsorship) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
    }

    if (TERMINAL_STATUSES.includes(sponsorship.status)) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        `Cannot update sponsorship while status is ${sponsorship.status}.`
      );
    }

    const updates = {};

    if (payload.total_seats !== undefined) {
      if (Number(payload.total_seats) < Number(sponsorship.usedSeats || 0)) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Total seats cannot be less than used seats.'
        );
      }
      updates.totalSeats = payload.total_seats;
    }

    if (payload.amount !== undefined) {
      updates.amount = payload.amount;
    }

    if (payload.currency !== undefined) {
      updates.currency = payload.currency;
    }

    if (payload.invoice_due_at !== undefined) {
      updates.invoiceDueAt = payload.invoice_due_at;
    }

    if (payload.sponsership_category !== undefined) {
      updates.sponsershipCategory = payload.sponsership_category;
    }

    if (!Object.keys(updates).length) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No valid fields provided to update.');
    }

    await sponsorshipRepository.update(sponsorship, updates);

    return this.getSponsorshipById(id);
  }

  async deleteSponsorship(id) {
    const sponsorship = await sponsorshipRepository.findPlainById(id);

    if (!sponsorship) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
    }

    if (sponsorship.status === 'paid') {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Paid sponsorships cannot be deleted.');
    }

    const usedSeats = await seatRepository.countUsedBySponsorship(sponsorship.id);

    if (usedSeats > 0) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        'Sponsorship has assigned seats and cannot be deleted.'
      );
    }

    await sponsorshipRepository.destroy(sponsorship);

    return { id: Number(id), deleted: true };
  }

  async updateSponsorshipActiveStatus(id, payload) {
    const sponsorship = await sponsorshipRepository.findPlainById(id);

    if (!sponsorship) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
    }

    if (payload.is_active) {
      if (sponsorship.status !== 'cancelled') {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'Only cancelled sponsorships can be reactivated.'
        );
      }

      await sponsorshipRepository.update(sponsorship, { status: 'invoice_requested' });
    } else {
      if (TERMINAL_STATUSES.includes(sponsorship.status)) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          `Sponsorship is already inactive (${sponsorship.status}).`
        );
      }

      if (sponsorship.status === 'paid') {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'Paid sponsorships cannot be deactivated. Mark as unpaid first if needed.'
        );
      }

      await sponsorshipRepository.update(sponsorship, { status: 'cancelled' });
    }

    return this.getSponsorshipById(id);
  }

  async markSponsorshipAsPaid(sponsorshipId, adminUser) {
    return sponsorshipService.markSponsorshipAsPaid(sponsorshipId, adminUser);
  }

  async markSponsorshipAsUnpaid(sponsorshipId) {
    let result;

    await sequelize.transaction(async (transaction) => {
      const sponsorship = await sponsorshipRepository.findPlainById(sponsorshipId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Sponsorship
        }
      });

      if (!sponsorship) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
      }

      if (sponsorship.status !== 'paid') {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'Only paid sponsorships can be marked as unpaid.'
        );
      }

      const usedSeats = await seatRepository.countUsedBySponsorship(sponsorship.id, {
        transaction
      });

      if (usedSeats > 0) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'Cannot mark as unpaid while seats are assigned to participants.'
        );
      }

      const invoice = await invoiceRepository.findBySponsorshipId(sponsorship.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Invoice
        }
      });

      await sponsorshipRepository.update(
        sponsorship,
        {
          status: 'pending_payment',
          paidAt: null
        },
        { transaction }
      );

      if (invoice) {
        await invoiceRepository.update(
          invoice,
          {
            status: 'sent',
            paidAt: null
          },
          { transaction }
        );
      }

      await sequelize.models.Seat.update(
        { status: 'locked', holdExpiresAt: null },
        {
          where: {
            sponsorshipId: sponsorship.id,
            status: {
              [Op.in]: ['available', 'locked']
            }
          },
          transaction
        }
      );

      result = {
        sponsorship_id: Number(sponsorship.id),
        status: 'pending_payment'
      };
    });

    return result;
  }
}

module.exports = new AdminSponsorshipService();
