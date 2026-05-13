function escapeXml(value) {
  return String(value ?? "").replace(/[&<>]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
  })[char]);
}

function col(index) {
  let label = "";
  let value = index;
  while (value >= 0) {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  }
  return label;
}

function cell(column, rowIndex, value) {
  return `<c r="${column}${rowIndex}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function worksheet(rows) {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => cell(col(columnIndex), rowIndex + 1, value)).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
}

function textFile(name, content) {
  const encoder = new TextEncoder();
  return { name, bytes: encoder.encode(content) };
}

function crc32(bytes) {
  const table = new Uint32Array(256).map((_, i) => {
    let c = i;
    for (let j = 0; j < 8; j += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(buffer, offset, value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

function write32(buffer, offset, value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function zip(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const bytes = file.bytes;
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    write32(local, 0, 0x04034b50);
    write16(local, 4, 20);
    write16(local, 8, 0);
    write32(local, 14, crc);
    write32(local, 18, bytes.length);
    write32(local, 22, bytes.length);
    write16(local, 26, nameBytes.length);
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    write32(central, 0, 0x02014b50);
    write16(central, 4, 20);
    write16(central, 6, 20);
    write32(central, 16, crc);
    write32(central, 20, bytes.length);
    write32(central, 24, bytes.length);
    write16(central, 28, nameBytes.length);
    write32(central, 42, offset);
    central.set(nameBytes, 46);

    locals.push({ local, bytes });
    centrals.push(central);
    offset += local.length + bytes.length;
  }

  const centralStart = offset;
  const centralSize = centrals.reduce((sum, file) => sum + file.length, 0);
  const output = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const record of locals) {
    output.set(record.local, cursor);
    cursor += record.local.length;
    output.set(record.bytes, cursor);
    cursor += record.bytes.length;
  }
  for (const central of centrals) {
    output.set(central, cursor);
    cursor += central.length;
  }
  write32(output, cursor, 0x06054b50);
  write16(output, cursor + 8, files.length);
  write16(output, cursor + 10, files.length);
  write32(output, cursor + 12, centralSize);
  write32(output, cursor + 16, centralStart);
  return output;
}

export function makeXlsx(rows) {
  const files = [
    textFile("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    textFile("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    textFile("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    textFile("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    textFile("xl/worksheets/sheet1.xml", worksheet(rows))
  ];
  return new Blob([zip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
