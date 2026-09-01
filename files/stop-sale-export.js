(function (root) {
  "use strict";

  const XLSX = root.XLSX;
  if (!XLSX) {
    throw new Error("The Excel library must load before stop-sale-export.js");
  }

  const MS_PER_DAY = 86400000;
  const EXCEL_EPOCH_OFFSET = 25569;
  const HOTEL_FILLS = [
    "FBE5D6",
    "9DC3E6",
    "E7E6E6",
    "92D050",
    "FFF2CC",
    "DDEBF7",
    "E2F0D9"
  ];

  const MONTH_NAMES_EN = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const MONTH_NAMES_AR = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  const thinBorder = {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } }
  };

  function solidFill(rgb) {
    return { patternType: "solid", fgColor: { rgb } };
  }

  function setCell(sheet, row, col, value, style, extra) {
    const address = XLSX.utils.encode_cell({ r: row, c: col });
    // The browser-side style writer omits truly blank cells. A hidden zero
    // preserves fills and borders while the custom number format keeps the
    // calendar cell visually empty in Excel.
    let cellStyle = style;
    if (value == null) {
      value = 0;
      cellStyle = Object.assign({}, style, { numFmt: ";;;" });
    }
    let type = "s";
    if (typeof value === "number") type = "n";
    else if (typeof value === "boolean") type = "b";
    sheet[address] = Object.assign({ t: type, v: value, s: cellStyle }, extra || {});
    return address;
  }

  function excelSerial(year, month, day) {
    return Math.round(Date.UTC(year, month, day) / MS_PER_DAY) + EXCEL_EPOCH_OFFSET;
  }

  function dayNumber(year, month, day) {
    return Math.round(Date.UTC(year, month, day) / MS_PER_DAY);
  }

  function consecutiveRanges(days) {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    const ranges = [];
    let start = null;
    let previous = null;
    sorted.forEach(day => {
      if (start == null) {
        start = day;
        previous = day;
      } else if (day === previous + 1) {
        previous = day;
      } else {
        ranges.push({ start, end: previous });
        start = day;
        previous = day;
      }
    });
    if (start != null) ranges.push({ start, end: previous });
    return ranges;
  }

  function buildWorkbook(options) {
    const defaultYear = Number.isInteger(Number(options.year)) ? Number(options.year) : new Date().getFullYear();
    const defaultMonth = (Number.isInteger(Number(options.month)) && Number(options.month) >= 0 && Number(options.month) <= 11)
      ? Number(options.month)
      : new Date().getMonth();
    const language = options.language === "ar" ? "ar" : "en";
    const hotels = Array.isArray(options.hotels) ? options.hotels : [];
    const labels = Object.assign({
      allRooms: language === "ar" ? "جميع أنواع الغرف والأجنحة" : "All RM Types & Suites",
      subject: language === "ar" ? "خاضع لتوافر الفندق" : "Subject to hotel availability",
      openToSale: language === "ar" ? "متاح للبيع" : "Open to Sale",
      white: language === "ar" ? "أبيض" : "White",
      stopSale: language === "ar" ? "إيقاف بيع" : "Stop Sale",
      red: language === "ar" ? "أحمر" : "RED"
    }, options.labels || {});

    const sheet = {};
    const merges = [];
    const rows = [];
    let row = 0;
    let maxColUsed = 31;

    hotels.forEach((hotel, hotelIndex) => {
      const hotelFill = HOTEL_FILLS[hotelIndex % HOTEL_FILLS.length];
      const hotelStyle = {
        fill: solidFill(hotelFill),
        font: { name: "Calibri", sz: 14, bold: true, color: { rgb: "000000" } },
        border: thinBorder,
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
      const weekdayStyle = {
        fill: solidFill(hotelFill),
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "000000" } },
        border: thinBorder,
        alignment: { horizontal: "center", vertical: "center" },
        numFmt: "ddd"
      };
      const dateStyle = {
        fill: solidFill("FFFFFF"),
        font: { name: "Calibri", sz: 10, color: { rgb: "000000" } },
        border: thinBorder,
        alignment: { horizontal: "center", vertical: "center" },
        numFmt: "[$-409]d/mmm;@"
      };
      const roomLabelStyle = {
        fill: solidFill(hotelFill),
        font: { name: "Calibri", sz: 11, color: { rgb: "000000" } },
        border: thinBorder,
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
      const allRoomsLabelStyle = {
        fill: solidFill("FFFFFF"),
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "000000" } },
        border: thinBorder,
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
      const openStyle = {
        fill: solidFill("FFFFFF"),
        font: { name: "Calibri", sz: 9, color: { rgb: "666666" } },
        border: thinBorder,
        alignment: { horizontal: "center", vertical: "center", shrinkToFit: true }
      };
      const stopStyle = {
        fill: solidFill("FF0000"),
        font: { name: "Calibri", sz: 9, bold: true, color: { rgb: "FFFFFF" } },
        border: thinBorder,
        alignment: { horizontal: "center", vertical: "center" }
      };
      const subjectStyle = {
        fill: solidFill("FFFFFF"),
        font: { name: "Calibri", sz: 9, italic: true, color: { rgb: "666666" } },
        border: thinBorder,
        alignment: { horizontal: "center", vertical: "center", shrinkToFit: true }
      };

      const hotelMonths = (Array.isArray(hotel.months) && hotel.months.length)
        ? hotel.months
        : [{ year: defaultYear, month: defaultMonth, rooms: hotel.rooms || [] }];

      hotelMonths.forEach((monthData, monthIndex) => {
        const curYear = Number(monthData.year);
        const curMonth = Number(monthData.month);
        const curDaysInMonth = new Date(Date.UTC(curYear, curMonth + 1, 0)).getUTCDate();
        if (curDaysInMonth > maxColUsed) maxColUsed = curDaysInMonth;

        const monthLabel = `${MONTH_NAMES_EN[curMonth]} ${curYear}`;
        const headerTitle = hotelMonths.length > 1
          ? `${hotel.name || "Hotel"} - ${monthLabel}`
          : (hotel.name || "Hotel");

        setCell(sheet, row, 0, headerTitle, hotelStyle);
        merges.push({ s: { r: row, c: 0 }, e: { r: row + 1, c: 0 } });

        for (let day = 1; day <= curDaysInMonth; day += 1) {
          const col = day;
          const serial = excelSerial(curYear, curMonth, day);
          const dateAddress = XLSX.utils.encode_cell({ r: row + 1, c: col });
          setCell(sheet, row, col, serial, weekdayStyle, { f: dateAddress, z: "ddd" });
          setCell(sheet, row + 1, col, serial, dateStyle, { z: "[$-409]d/mmm;@" });
        }

        rows[row] = { hpt: 18 };
        rows[row + 1] = { hpt: 18 };
        row += 2;

        const suppliedRooms = Array.isArray(monthData.rooms) ? monthData.rooms : [];
        const regularRooms = suppliedRooms.filter(room => !room.isAllRooms);
        const allRoomsEntry = suppliedRooms.find(room => room.isAllRooms) || {
          name: labels.allRooms,
          isAllRooms: true,
          stopDays: [],
          subjectDays: []
        };

        regularRooms.concat(allRoomsEntry).forEach(roomData => {
          const stopSet = new Set((roomData.stopDays || []).map(Number));
          const subjectSet = new Set((roomData.subjectDays || []).map(Number));
          const hasSubject = [...subjectSet].some(day => day >= 1 && day <= curDaysInMonth && !stopSet.has(day));
          const baseName = roomData.isAllRooms ? labels.allRooms : (roomData.name || "Room Type");
          const label = hasSubject && !roomData.isAllRooms
            ? `${baseName} (${labels.subject})`
            : baseName;

          setCell(sheet, row, 0, label, roomData.isAllRooms ? allRoomsLabelStyle : roomLabelStyle);
          for (let day = 1; day <= curDaysInMonth; day += 1) {
            const isStop = stopSet.has(day);
            const isSubject = !isStop && subjectSet.has(day);
            setCell(sheet, row, day, null, isStop ? stopStyle : (isSubject ? subjectStyle : openStyle));
          }

          const availableDays = [...subjectSet].filter(day => day >= 1 && day <= curDaysInMonth && !stopSet.has(day));
          consecutiveRanges(availableDays).forEach(range => {
            const anchor = XLSX.utils.encode_cell({ r: row, c: range.start });
            sheet[anchor].t = "s";
            sheet[anchor].v = labels.subject;
            sheet[anchor].s = subjectStyle;
            if (range.end > range.start) {
              merges.push({ s: { r: row, c: range.start }, e: { r: row, c: range.end } });
              for (let col = range.start + 1; col <= range.end; col += 1) {
                delete sheet[XLSX.utils.encode_cell({ r: row, c: col })];
              }
            }
          });

          rows[row] = { hpt: 18 };
          row += 1;
        });

        if (monthIndex < hotelMonths.length - 1) {
          row += 1; // space row between consecutive months of same hotel
        }
      });

      const separatorStyle = { fill: solidFill("000000") };
      for (let col = 0; col <= maxColUsed; col += 1) {
        setCell(sheet, row, col, null, separatorStyle);
      }
      rows[row] = { hpt: 8 };
      row += 2;
    });

    const legendHeaderStyle = {
      fill: solidFill("9DC3E6"),
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "000000" } },
      border: thinBorder,
      alignment: { horizontal: "center", vertical: "center" }
    };
    const legendWhiteStyle = {
      fill: solidFill("FFFFFF"),
      font: { name: "Calibri", sz: 11, color: { rgb: "000000" } },
      border: thinBorder,
      alignment: { horizontal: "center", vertical: "center" }
    };
    const legendRedStyle = {
      fill: solidFill("FF0000"),
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "000000" } },
      border: thinBorder,
      alignment: { horizontal: "center", vertical: "center" }
    };

    setCell(sheet, row, 0, labels.openToSale, legendHeaderStyle);
    setCell(sheet, row + 1, 0, labels.white, legendWhiteStyle);
    setCell(sheet, row + 2, 0, labels.stopSale, legendHeaderStyle);
    setCell(sheet, row + 3, 0, labels.red, legendRedStyle);
    rows[row] = rows[row + 1] = rows[row + 2] = rows[row + 3] = { hpt: 18 };

    sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row + 3, c: maxColUsed } });
    sheet["!merges"] = merges;
    sheet["!cols"] = [{ wch: 54 }].concat(Array.from({ length: maxColUsed }, () => ({ wch: 9 })));
    sheet["!rows"] = rows;
    sheet["!views"] = [{ showGridLines: true }];
    sheet["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    sheet["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

    const monthNames = language === "ar" ? MONTH_NAMES_AR : MONTH_NAMES_EN;
    const sheetName = `${monthNames[defaultMonth]} ${defaultYear}`.slice(0, 31);
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: `Stop Sale Calendar - ${monthNames[defaultMonth]} ${defaultYear}`,
      Subject: "Hotel availability and stop-sale calendar",
      Author: "Yanabea Alhuda",
      Company: "Yanabea Alhuda"
    };
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    return workbook;
  }

  function getFileName(options) {
    const language = options.language === "ar" ? "ar" : "en";
    const month = Number(options.month);
    const year = Number(options.year);
    if (language === "ar") return `تقويم_إيقاف_البيع_${MONTH_NAMES_AR[month]}_${year}.xlsx`;
    return `Stop_Sale_Calendar_${MONTH_NAMES_EN[month]}_${year}.xlsx`;
  }

  function download(options) {
    const workbook = buildWorkbook(options);
    XLSX.writeFile(workbook, getFileName(options), { bookType: "xlsx", cellStyles: true, compression: true });
  }

  root.StopSaleExporter = { buildWorkbook, download, getFileName, dayNumber };
})(typeof globalThis !== "undefined" ? globalThis : window);
