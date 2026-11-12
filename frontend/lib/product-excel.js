const encoder = new TextEncoder();
const decoder = new TextDecoder();

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function concatBytes(chunks) {
  const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

function zipStore(files) {
  const local = [];
  const central = [];
  let offset = 0;
  const put16 = (view, position, value) => view.setUint16(position, value, true);
  const put32 = (view, position, value) => view.setUint32(position, value, true);
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    put32(view, 0, 0x04034b50); put16(view, 4, 20); put16(view, 6, 0x800); put16(view, 8, 0);
    put32(view, 14, crc); put32(view, 18, data.length); put32(view, 22, data.length); put16(view, 26, nameBytes.length);
    header.set(nameBytes, 30);
    local.push(header, data);
    const directory = new Uint8Array(46 + nameBytes.length);
    const directoryView = new DataView(directory.buffer);
    put32(directoryView, 0, 0x02014b50); put16(directoryView, 4, 20); put16(directoryView, 6, 20); put16(directoryView, 8, 0x800); put16(directoryView, 10, 0);
    put32(directoryView, 16, crc); put32(directoryView, 20, data.length); put32(directoryView, 24, data.length); put16(directoryView, 28, nameBytes.length); put32(directoryView, 42, offset);
    directory.set(nameBytes, 46);
    central.push(directory);
    offset += header.length + data.length;
  }
  const centralBytes = concatBytes(central);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  put32(endView, 0, 0x06054b50); put16(endView, 8, central.length); put16(endView, 10, central.length); put32(endView, 12, centralBytes.length); put32(endView, 16, offset);
  return concatBytes([...local, centralBytes, end]);
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value) { value--; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); }
  return name;
}

function sheetXml(rows) {
  const body = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    if (value == null || value === "") return "";
    const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
    if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${body}</sheetData></worksheet>`;
}

export function createProductWorkbook(sheets) {
  const sheetNames = sheets.map((sheet) => sheet.name);
  const workbookSheets = sheetNames.map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const relationships = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = sheetXml(sheet.rows); });
  return zipStore(files);
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") throw new Error("Trình duyệt chưa hỗ trợ đọc file Excel nén. Hãy lưu file dưới dạng .xlsx không nén hoặc dùng Chrome/Edge mới.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let endOffset = -1;
  for (let offset = Math.max(0, bytes.length - 65557); offset <= bytes.length - 22; offset++) if (view.getUint32(offset, true) === 0x06054b50) endOffset = offset;
  if (endOffset < 0) throw new Error("File không phải workbook Excel .xlsx hợp lệ.");
  const count = view.getUint16(endOffset + 10, true);
  let cursor = view.getUint32(endOffset + 16, true);
  const files = {};
  for (let index = 0; index < count; index++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Cấu trúc file Excel không hợp lệ.");
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    if (method === 0) files[name] = compressed;
    else if (method === 8) files[name] = await inflateRaw(compressed);
    else throw new Error("File Excel dùng kiểu nén chưa được hỗ trợ.");
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function parseXml(bytes) {
  const document = new DOMParser().parseFromString(decoder.decode(bytes), "application/xml");
  if (document.querySelector("parsererror")) throw new Error("Không đọc được cấu trúc workbook Excel.");
  return document;
}

function cellColumn(reference) {
  let value = 0;
  for (const char of reference.match(/^[A-Z]+/)[0]) value = value * 26 + char.charCodeAt(0) - 64;
  return value - 1;
}

export async function readProductWorkbook(buffer) {
  const files = await unzip(buffer);
  const workbook = parseXml(files["xl/workbook.xml"]);
  const rels = parseXml(files["xl/_rels/workbook.xml.rels"]);
  const targets = Object.fromEntries([...rels.getElementsByTagName("Relationship")].map((item) => [item.getAttribute("Id"), item.getAttribute("Target")]));
  const sheet = workbook.getElementsByTagName("sheet")[0];
  if (!sheet) throw new Error("Workbook không có sheet dữ liệu.");
  const relationId = sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const target = targets[relationId]?.replace(/^\//, "") || "worksheets/sheet1.xml";
  const sheetPath = target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
  const shared = files["xl/sharedStrings.xml"] ? [...parseXml(files["xl/sharedStrings.xml"]).getElementsByTagName("si")].map((item) => [...item.getElementsByTagName("t")].map((text) => text.textContent).join("")) : [];
  const document = parseXml(files[sheetPath]);
  return [...document.getElementsByTagName("row")].map((row) => {
    const values = [];
    for (const cell of row.getElementsByTagName("c")) {
      const column = cellColumn(cell.getAttribute("r"));
      const type = cell.getAttribute("t");
      let value = cell.getElementsByTagName("v")[0]?.textContent ?? "";
      if (type === "s") value = shared[Number(value)] ?? "";
      else if (type === "inlineStr") value = [...cell.getElementsByTagName("t")].map((text) => text.textContent).join("");
      else if (type !== "str" && type !== "e" && value !== "") value = Number(value);
      values[column] = value;
    }
    return values;
  });
}
