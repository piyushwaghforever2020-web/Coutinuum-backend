const migrate = require('./migrate');
const { sequelize, Cohort, Participant, Payment } = require('../src/models');

const sampleCohorts = [
  {
    name: 'AI Leadership Cohort',
    description: 'Advanced leadership program for AI builders.',
    startDate: '2026-05-15',
    price: 999,
    seatLimit: 30,
    refundPolicy: 'Full refund up to 7 days before start date.',
    status: 'active'
  },
  {
    name: 'Product Strategy Sprint',
    description: 'Hands-on cohort for product leaders building AI-first products.',
    startDate: '2026-06-05',
    price: 799,
    seatLimit: 25,
    refundPolicy: '50% refund up to 5 days before start date.',
    status: 'active'
  }
];

const sampleParticipants = [
  {
    cohortName: 'AI Leadership Cohort',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    phone: '+91-9876500011',
    company: 'Lumos Labs',
    role: 'Engineering Manager',
    answers: {
      motivation: 'Looking to scale AI teams more effectively.',
      goals: ['leadership', 'execution']
    },
    paymentStatus: 'paid',
    registrationStatus: 'complete',
    payment: {
      amount: 999,
      status: 'paid',
      transactionId: 'TXN-AI-1001'
    }
  },
  {
    cohortName: 'AI Leadership Cohort',
    name: 'Meera Nair',
    email: 'meera.nair@example.com',
    phone: '+91-9876500012',
    company: 'Northstar AI',
    role: 'Product Lead',
    answers: {
      motivation: 'Want a stronger AI product operating model.'
    },
    paymentStatus: 'paid',
    registrationStatus: 'complete',
    payment: {
      amount: 999,
      status: 'paid',
      transactionId: 'TXN-AI-1002'
    }
  },
  {
    cohortName: 'AI Leadership Cohort',
    name: 'Rohan Patel',
    email: 'rohan.patel@example.com',
    phone: '+91-9876500013',
    company: 'PixelForge',
    role: 'Founder',
    answers: {
      motivation: 'Exploring enrollment before confirming budget.'
    },
    paymentStatus: 'failed',
    registrationStatus: 'incomplete',
    payment: {
      amount: 999,
      status: 'failed',
      transactionId: 'TXN-AI-1003'
    }
  },
  {
    cohortName: 'Product Strategy Sprint',
    name: 'Isha Kapoor',
    email: 'isha.kapoor@example.com',
    phone: '+91-9876500014',
    company: 'Orbit Commerce',
    role: 'Senior Product Manager',
    answers: {
      motivation: 'Need sharper product strategy for AI launches.'
    },
    paymentStatus: 'paid',
    registrationStatus: 'complete',
    payment: {
      amount: 799,
      status: 'paid',
      transactionId: 'TXN-PS-2001'
    }
  },
  {
    cohortName: 'Product Strategy Sprint',
    name: 'Kabir Singh',
    email: 'kabir.singh@example.com',
    phone: '+91-9876500015',
    company: 'BlueRiver Tech',
    role: 'Growth Lead',
    answers: {
      motivation: 'Previously enrolled and later refunded.'
    },
    paymentStatus: 'refunded',
    registrationStatus: 'complete',
    payment: {
      amount: 799,
      status: 'refunded',
      transactionId: 'TXN-PS-2002'
    }
  },
  {
    cohortName: 'Product Strategy Sprint',
    name: 'Nisha Verma',
    email: 'nisha.verma@example.com',
    phone: '+91-9876500016',
    company: 'CraftStack',
    role: 'Operations Manager',
    answers: {
      motivation: 'Application saved but payment not completed.'
    },
    paymentStatus: 'failed',
    registrationStatus: 'incomplete',
    payment: {
      amount: 799,
      status: 'failed',
      transactionId: 'TXN-PS-2003'
    }
  }
];

const upsertCohort = async (data, transaction) => {
  const [cohort, created] = await Cohort.findOrCreate({
    where: { name: data.name },
    defaults: data,
    transaction
  });

  if (!created) {
    await cohort.update(data, { transaction });
  }

  return cohort;
};

const upsertParticipant = async (data, transaction) => {
  const [participant, created] = await Participant.findOrCreate({
    where: {
      email: data.email,
      cohortId: data.cohortId
    },
    defaults: data,
    transaction
  });

  if (!created) {
    await participant.update(data, { transaction });
  }

  return participant;
};

const upsertPayment = async (data, transaction) => {
  const [payment, created] = await Payment.findOrCreate({
    where: { transactionId: data.transactionId },
    defaults: data,
    transaction
  });

  if (!created) {
    await payment.update(data, { transaction });
  }

  return payment;
};

const updateSeatCounts = async (cohortIds, transaction) => {
  for (const cohortId of cohortIds) {
    const cohort = await Cohort.findByPk(cohortId, { transaction });
    const seatsFilled = await Participant.count({
      where: {
        cohortId,
        paymentStatus: 'paid',
        registrationStatus: 'complete'
      },
      transaction
    });

    await Cohort.update(
      {
        seatsFilled,
        status:
          cohort.status === 'closed'
            ? 'closed'
            : seatsFilled >= cohort.seatLimit
              ? 'full'
              : 'active'
      },
      { where: { id: cohortId }, transaction }
    );
  }
};

const migrateParticipants = async () => {
  await migrate({ closeConnection: false });
  await sequelize.authenticate();

  try {
    const summary = {
      cohorts: 0,
      participants: 0,
      payments: 0
    };

    await sequelize.transaction(async (transaction) => {
      const cohortMap = new Map();

      for (const cohortData of sampleCohorts) {
        const cohort = await upsertCohort(cohortData, transaction);
        cohortMap.set(cohortData.name, cohort);
        summary.cohorts += 1;
      }

      for (const participantData of sampleParticipants) {
        const cohort = cohortMap.get(participantData.cohortName);

        const participant = await upsertParticipant(
          {
            name: participantData.name,
            email: participantData.email,
            phone: participantData.phone,
            company: participantData.company,
            role: participantData.role,
            answers: participantData.answers,
            cohortId: cohort.id,
            paymentStatus: participantData.paymentStatus,
            registrationStatus: participantData.registrationStatus
          },
          transaction
        );
        summary.participants += 1;

        await upsertPayment(
          {
            participantId: participant.id,
            cohortId: cohort.id,
            amount: participantData.payment.amount,
            status: participantData.payment.status,
            transactionId: participantData.payment.transactionId
          },
          transaction
        );
        summary.payments += 1;
      }

      await updateSeatCounts(
        [...new Set([...cohortMap.values()].map((cohort) => cohort.id))],
        transaction
      );
    });

    console.log(
      `Participant sample data applied successfully. Cohorts: ${summary.cohorts}, Participants: ${summary.participants}, Payments: ${summary.payments}.`
    );
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  migrateParticipants().catch((error) => {
    console.error('Participant sample migration failed:', error);
    process.exitCode = 1;
  });
}

module.exports = migrateParticipants;
