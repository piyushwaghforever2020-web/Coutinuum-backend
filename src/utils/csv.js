const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  const escapedValue = stringValue.replace(/"/g, '""');

  if (/[",\n]/.test(escapedValue)) {
    return `"${escapedValue}"`;
  }

  return escapedValue;
};

const convertToCsv = (rows, headers) => {
  const headerRow = headers.map((header) => escapeCsvValue(header.label)).join(',');
  const dataRows = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header.key])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
};

module.exports = {
  convertToCsv
};
