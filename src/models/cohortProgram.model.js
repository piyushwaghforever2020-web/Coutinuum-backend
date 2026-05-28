module.exports = (sequelize, DataTypes) => {
  const CohortProgram = sequelize.define(
    'CohortProgram',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      cohortId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'cohort_id',
        references: {
          model: 'cohorts',
          key: 'id'
        }
      },
      programId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'program_id',
        references: {
          model: 'programs',
          key: 'id'
        }
      },
      allocatedSeats: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'allocated_seats',
        validate: {
          max: 20
        }
      },
      seatsFilled: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'seats_filled'
      },
      isFull: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_full'
      }
    },
    {
      tableName: 'cohort_programs',
      underscored: true,
      timestamps: true
    }
  );

  return CohortProgram;
};
