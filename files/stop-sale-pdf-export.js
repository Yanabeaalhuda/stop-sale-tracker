(function (root) {
  "use strict";

  const HOTEL_FILLS = [
    "FBE5D6", "9DC3E6", "E7E6E6", "92D050", "FFF2CC", "DDEBF7", "E2F0D9"
  ];
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function pdfConstructor() {
    const ctor = root.jspdf && root.jspdf.jsPDF;
    if (!ctor) throw new Error("The PDF library is not available.");
    return ctor;
  }

  function rgb(hex) {
    const clean = String(hex || "000000").replace("#", "");
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16)
    ];
  }

  function ranges(days) {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    const out = [];
    let start = null;
    let previous = null;
    sorted.forEach(day => {
      if (start == null) {
        start = day;
        previous = day;
      } else if (day === previous + 1) {
        previous = day;
      } else {
        out.push({ start, end: previous });
        start = day;
        previous = day;
      }
    });
    if (start != null) out.push({ start, end: previous });
    return out;
  }

  function fitText(pdf, value, maxWidth) {
    const source = String(value == null ? "" : value);
    if (!source || pdf.getTextWidth(source) <= maxWidth) return source;
    let result = source;
    while (result.length > 1 && pdf.getTextWidth(`${result}...`) > maxWidth) {
      result = result.slice(0, -1);
    }
    return `${result}...`;
  }

  function drawCell(pdf, x, y, width, height, text, options) {
    const opts = Object.assign({
      fill: "FFFFFF",
      textColor: "000000",
      fontSize: 5,
      fontStyle: "normal",
      align: "center",
      border: "000000"
    }, options || {});
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      throw new Error(`Invalid PDF cell geometry: ${x}, ${y}, ${width}, ${height}`);
    }
    pdf.setFillColor(...rgb(opts.fill));
    pdf.setDrawColor(...rgb(opts.border));
    pdf.setLineWidth(0.12);
    pdf.rect(x, y, width, height, "FD");
    if (text == null || text === "") return;
    pdf.setTextColor(...rgb(opts.textColor));
    pdf.setFont("helvetica", opts.fontStyle);
    pdf.setFontSize(opts.fontSize);
    const fitted = fitText(pdf, text, Math.max(1, width - 1.4));
    const textX = opts.align === "left" ? x + 0.8 : opts.align === "right" ? x + width - 0.8 : x + width / 2;
    pdf.text(fitted, textX, y + height / 2 + opts.fontSize * 0.12, { align: opts.align });
  }

  function getFileName(options) {
    const month = Number(options.month);
    const year = Number(options.year);
    if (options.language === "ar") return `تقويم_إيقاف_البيع_${MONTH_NAMES[month]}_${year}.pdf`;
    return `Stop_Sale_Calendar_${MONTH_NAMES[month]}_${year}.pdf`;
  }

  function buildDocument(options) {
    const JsPDF = pdfConstructor();
    const year = Number(options.year);
    const month = Number(options.month);
    const hotels = Array.isArray(options.hotels) ? options.hotels : [];
    const labels = Object.assign({
      allRooms: "All RM Types & Suites",
      subject: "Subject to hotel availability",
      openToSale: "Open to Sale",
      white: "White",
      stopSale: "Stop Sale",
      red: "RED"
    }, options.labels || {});
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const pdf = new JsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const labelWidth = 72;
    const dayWidth = (pageWidth - margin * 2 - labelWidth) / daysInMonth;
    const weekdayHeight = 5.2;
    const dateHeight = 4.8;
    const roomHeight = 5.25;
    const separatorHeight = 2.1;
    const blockGap = 2.1;
    const bottomLimit = pageHeight - 8;
    let y = 0;

    pdf.setProperties({
      title: `Stop Sale Calendar - ${MONTH_NAMES[month]} ${year}`,
      subject: "Hotel availability and stop-sale calendar",
      author: "Yanabea Alhuda",
      creator: "Yanabea Alhuda Stop Sale Tracker"
    });

    function drawPageHeading() {
      y = margin;
      pdf.setTextColor(111, 16, 40);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(`Stop Sale Calendar - ${MONTH_NAMES[month]} ${year}`, margin, y + 4.2);
      pdf.setTextColor(90, 90, 90);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      const generated = new Date().toISOString().slice(0, 10);
      pdf.text(`Generated: ${generated}`, pageWidth - margin, y + 4.2, { align: "right" });
      pdf.setDrawColor(212, 175, 98);
      pdf.setLineWidth(0.7);
      pdf.line(margin, y + 6.2, pageWidth - margin, y + 6.2);
      y += 8.4;
    }

    function newPage() {
      pdf.addPage("a3", "landscape");
      drawPageHeading();
    }

    function drawHotelHeader(name, fill, continued) {
      const title = continued ? `${name} (continued)` : name;
      drawCell(pdf, margin, y, labelWidth, weekdayHeight + dateHeight, title, {
        fill, fontSize: 7.5, fontStyle: "bold"
      });
      for (let day = 1; day <= daysInMonth; day += 1) {
        const x = margin + labelWidth + (day - 1) * dayWidth;
        const date = new Date(Date.UTC(year, month, day));
        drawCell(pdf, x, y, dayWidth, weekdayHeight, WEEKDAYS[date.getUTCDay()], {
          fill, fontSize: 5.2, fontStyle: "bold"
        });
        drawCell(pdf, x, y + weekdayHeight, dayWidth, dateHeight, date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).replace(" ", "/"), {
          fill: "FFFFFF", fontSize: 4.5
        });
      }
      y += weekdayHeight + dateHeight;
    }

    function drawRoom(room, fill) {
      const stopDays = new Set((room.stopDays || []).map(Number));
      const subjectDays = new Set((room.subjectDays || []).map(Number));
      const availableDays = [...subjectDays].filter(day => day >= 1 && day <= daysInMonth && !stopDays.has(day));
      const hasSubject = availableDays.length > 0;
      const baseName = room.isAllRooms ? labels.allRooms : (room.name || "Room Type");
      const name = hasSubject && !room.isAllRooms ? `${baseName} (${labels.subject})` : baseName;
      drawCell(pdf, margin, y, labelWidth, roomHeight, name, {
        fill: room.isAllRooms ? "FFFFFF" : fill,
        fontSize: 5.1,
        fontStyle: room.isAllRooms ? "bold" : "normal"
      });
      for (let day = 1; day <= daysInMonth; day += 1) {
        const x = margin + labelWidth + (day - 1) * dayWidth;
        drawCell(pdf, x, y, dayWidth, roomHeight, "", {
          fill: stopDays.has(day) ? "FF0000" : "FFFFFF"
        });
      }
      ranges(availableDays).forEach(range => {
        const x = margin + labelWidth + (range.start - 1) * dayWidth;
        const width = (range.end - range.start + 1) * dayWidth;
        drawCell(pdf, x, y, width, roomHeight, range.end - range.start >= 2 ? labels.subject : "", {
          fill: "FFFFFF", textColor: "666666", fontSize: 4, fontStyle: "italic"
        });
      });
      y += roomHeight;
    }

    function preparedRooms(hotel) {
      const supplied = Array.isArray(hotel.rooms) ? hotel.rooms : [];
      const regular = supplied.filter(room => !room.isAllRooms);
      const allRooms = supplied.find(room => room.isAllRooms) || {
        name: labels.allRooms, isAllRooms: true, stopDays: [], subjectDays: []
      };
      return regular.concat(allRooms);
    }

    drawPageHeading();
    hotels.forEach((hotel, hotelIndex) => {
      const fill = HOTEL_FILLS[hotelIndex % HOTEL_FILLS.length];
      const rooms = preparedRooms(hotel);
      const fullHeight = weekdayHeight + dateHeight + rooms.length * roomHeight + separatorHeight + blockGap;
      if (y + fullHeight > bottomLimit && y > margin + 10) newPage();
      drawHotelHeader(hotel.name || "Hotel", fill, false);
      rooms.forEach(room => {
        if (y + roomHeight + separatorHeight > bottomLimit) {
          newPage();
          drawHotelHeader(hotel.name || "Hotel", fill, true);
        }
        drawRoom(room, fill);
      });
      pdf.setFillColor(0, 0, 0);
      pdf.rect(margin, y, pageWidth - margin * 2, separatorHeight, "F");
      y += separatorHeight + blockGap;
    });

    const legendHeight = roomHeight * 4;
    if (y + legendHeight > bottomLimit) newPage();
    drawCell(pdf, margin, y, labelWidth, roomHeight, labels.openToSale, { fill: "9DC3E6", fontSize: 5.5, fontStyle: "bold" });
    drawCell(pdf, margin, y + roomHeight, labelWidth, roomHeight, labels.white, { fill: "FFFFFF", fontSize: 5.5 });
    drawCell(pdf, margin, y + roomHeight * 2, labelWidth, roomHeight, labels.stopSale, { fill: "9DC3E6", fontSize: 5.5, fontStyle: "bold" });
    drawCell(pdf, margin, y + roomHeight * 3, labelWidth, roomHeight, labels.red, { fill: "FF0000", fontSize: 5.5, fontStyle: "bold" });

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      pdf.setTextColor(90, 90, 90);
      pdf.text(`Yanabea Alhuda - Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 3.3, { align: "right" });
    }
    return pdf;
  }

  function download(options) {
    buildDocument(options).save(getFileName(options));
  }

  root.StopSalePdfExporter = { buildDocument, download, getFileName };
})(typeof globalThis !== "undefined" ? globalThis : window);
