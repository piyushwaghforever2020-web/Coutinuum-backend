const getPagination = (page = 1, limit = 10) => {
  const parsedPage = Number(page) || 1;
  const parsedLimit = Number(limit) || 10;
  const offset = (parsedPage - 1) * parsedLimit;

  return {
    page: parsedPage,
    limit: parsedLimit,
    offset
  };
};

const buildPaginationMeta = (count, page, limit) => ({
  total_records: count,
  total_pages: Math.ceil(count / limit) || 1,
  current_page: page,
  per_page: limit
});

module.exports = {
  getPagination,
  buildPaginationMeta
};
