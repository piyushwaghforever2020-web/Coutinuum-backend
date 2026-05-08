const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const validate = (schemas) => {
  return (req, res, next) => {
    try {
      ['body', 'params', 'query'].forEach((key) => {
        if (!schemas[key]) {
          return;
        }

        const { error, value } = schemas[key].validate(req[key], {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Validation failed.',
            error.details.map((detail) => detail.message)
          );
        }

        req[key] = value;
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = validate;
