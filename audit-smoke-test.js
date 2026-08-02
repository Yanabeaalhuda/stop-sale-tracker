const fs = require("fs");
const path = require("path");
const vm = require("vm");

const project = __dirname;

function dummyElement() {
  return {
    value: "", checked: false, disabled: false, innerHTML: "", innerText: "", textContent: "",
    style: {}, dataset: {}, options: [], selectedIndex: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, setAttribute() {}, appendChild() {}, removeChild() {},
    querySelectorAll() { return []; }, cloneNode() { return dummyElement(); }
  };
}

const elements = new Map();
const document = {
  body: Object.assign(dummyElement(), { dir: "" }),
  documentElement: { lang: "en", dir: "ltr" },
  title: "",
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, dummyElement());
    return elements.get(id);
  },
  querySelectorAll() { return []; },
  querySelector() { return dummyElement(); },
  createElement() { return dummyElement(); }
};

const context = {
  console, Buffer, Uint8Array, ArrayBuffer, Date, Math, JSON, Set, Map, Promise,
  setTimeout, clearTimeout, document,
  location: { hostname: "localhost", pathname: "/" },
  localStorage: { getItem() { return null; }, setItem() {} },
  fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" }),
  alert() {}, FileReader: function FileReader() {}
};
context.window = context;
context.globalThis = context;
context.addEventListener = () => {};
vm.createContext(context);

vm.runInContext(fs.readFileSync(path.join(project, "files/xlsx.full.min.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(project, "files/stop-sale-export.js"), "utf8"), context);

const html = fs.readFileSync(path.join(project, "index.html"), "utf8");
const appScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .find(source => source.includes("function parseWorkbook"))
  .replace(/\nmStatus\.innerText = t\[currentLang\]\.noFile;[\s\S]*?loadFromRepo\(false\);\s*$/, "");
vm.runInContext(appScript, context);

const expectedFiles = [
  "Availability Calendar.xlsx",
  "Sheraton Makkah Availability Chart 29 July 2026.xlsx",
  "Stop Sale Calendar (1).xlsx - Stop Sale (8)-1.xlsx",
  "marriot.xlsx"
];
const actualFiles = fs.readdirSync(path.join(project, "data")).filter(name => /\.xlsx?$/i.test(name)).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles.slice().sort())) {
  throw new Error(`Unexpected data workbook set: ${actualFiles.join(", ")}`);
}

context.__stats = { sheets: 0 };
for (const fileName of actualFiles) {
  context.__fileName = fileName;
  context.__workbook = context.XLSX.read(fs.readFileSync(path.join(project, "data", fileName)), {
    type: "buffer", cellStyles: true, cellNF: true
  });
  vm.runInContext("parseWorkbook(__workbook, __fileName, __stats)", context);
}

context.__snapshot = vm.runInContext(`(() => {
  today = Math.round(Date.UTC(2026, 7, 2) / MS_PER_DAY);
  const hotelNames = Object.keys(hotelData);
  const roomKeys = hotelNames.flatMap(hotel => Object.keys(hotelData[hotel]));
  return {
    hotelNames,
    roomCount: roomKeys.length,
    roomKeys,
    metrics: getTemplateReportMetrics(),
    exportHotels: buildTemplateExportHotels(2026, 7)
  };
})()`, context);

const expectedHotels = [
  "Conrad Makkah", "Hilton Suites Makkah", "Hilton Makkah Convention", "Double Tree",
  "Sheraton MAKKAH", "Tilal Jabal Al Kabah", "marriot MAKKAH"
];
if (context.__snapshot.hotelNames.length !== 7) throw new Error(`Expected 7 hotels, found ${context.__snapshot.hotelNames.length}`);
expectedHotels.forEach(name => {
  if (!context.__snapshot.hotelNames.includes(name)) throw new Error(`Missing hotel: ${name}`);
});
if (context.__snapshot.roomCount !== 51) throw new Error(`Expected 51 real source room rows, found ${context.__snapshot.roomCount}`);
["by request", "aug", "sep", "oct", "dec", "jan", "feb", "tilal jabal al kabah"].forEach(fake => {
  if (context.__snapshot.roomKeys.includes(fake)) throw new Error(`Parser treated a heading as a room: ${fake}`);
});

const metrics = context.__snapshot.metrics;
if (metrics.totalHotels !== 7 || metrics.activeStops !== 16 || metrics.upcomingStops !== 105) {
  throw new Error(`Unexpected report metrics: ${JSON.stringify(metrics)}`);
}

context.__options = { year: 2026, month: 7, language: "en", hotels: context.__snapshot.exportHotels };
const generatedWorkbook = vm.runInContext("StopSaleExporter.buildWorkbook(__options)", context);
const generatedBytes = context.XLSX.write(generatedWorkbook, { type: "buffer", bookType: "xlsx", cellStyles: true });
const reopened = context.XLSX.read(generatedBytes, { type: "buffer", cellStyles: true, cellNF: true });
const outputSheet = reopened.Sheets[reopened.SheetNames[0]];
const labelsInColumnA = Object.entries(outputSheet)
  .filter(([address, cell]) => /^A\d+$/.test(address) && cell && cell.v != null)
  .map(([, cell]) => String(cell.v));
expectedHotels.forEach(name => {
  if (!labelsInColumnA.includes(name)) throw new Error(`Generated Excel is missing hotel block: ${name}`);
});

console.log(JSON.stringify({
  status: "PASS",
  files: actualFiles.length,
  parsedSheets: context.__stats.sheets,
  hotels: context.__snapshot.hotelNames.length,
  sourceRoomRows: context.__snapshot.roomCount,
  metrics,
  excelSheet: reopened.SheetNames[0],
  excelRange: outputSheet["!ref"]
}, null, 2));
