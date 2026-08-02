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
    const sorted = [...new Set(days)].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
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
      fontSize: 7,
      fontStyle: "normal",
      align: "center",
      border: "000000",
      lineWidth: 0.12
    }, options || {});
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      throw new Error(`Invalid PDF cell geometry: ${x}, ${y}, ${width}, ${height}`);
    }
    pdf.setFillColor(...rgb(opts.fill));
    pdf.setDrawColor(...rgb(opts.border));
    pdf.setLineWidth(opts.lineWidth);
    pdf.rect(x, y, width, height, "FD");
    if (text == null || text === "") return;
    pdf.setTextColor(...rgb(opts.textColor));
    pdf.setFont("helvetica", opts.fontStyle);
    pdf.setFontSize(opts.fontSize);
    const fitted = fitText(pdf, text, Math.max(1, width - 1.8));
    const textX = opts.align === "left" ? x + 1 : opts.align === "right" ? x + width - 1 : x + width / 2;
    pdf.text(fitted, textX, y + height / 2 + opts.fontSize * 0.13, { align: opts.align });
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
    const metrics = Object.assign({
      totalHotels: hotels.length,
      activeStops: 0,
      upcomingStops: 0
    }, options.metrics || {});
    const labels = Object.assign({
      allRooms: "All RM Types & Suites",
      subject: "Subject to hotel availability",
      openToSale: "Open to Sale",
      white: "White",
      stopSale: "Stop Sale",
      red: "RED",
      reportTitle: "Yanabea Alhuda Availability & Stop Sale Tracker",
      slogan: "Peaceful Stay... for a Blessed Journey",
      officialReport: "OFFICIAL REPORT",
      generated: "Generated:",
      totalHotels: "TOTAL HOTELS LOADED",
      activeStops: "ACTIVE STOP SALES",
      upcomingStops: "UPCOMING STOP SALES",
      copyright: "COPYRIGHTS YANABEA ALHUDA 2026 © PEACEFUL STAY... FOR A BLESSED JOURNEY"
    }, options.labels || {});

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
      throw new Error("A valid report year and month are required.");
    }

    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const pdf = new JsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;
    const labelWidth = 94;
    const dayWidth = (contentWidth - labelWidth) / daysInMonth;
    const weekdayHeight = 7;
    const dateHeight = 6;
    const roomHeight = 7.2;
    const separatorHeight = 2.4;
    const blockGap = 3;
    const bottomLimit = pageHeight - 14;
    const generatedAt = String(options.generatedAt || new Date().toLocaleString("en-US"));
    const reportMonth = `${MONTH_NAMES[month]} ${year}`;
    let y = 0;
    let pageHasCalendarContent = false;

    pdf.setProperties({
      title: `Stop Sale Calendar - ${reportMonth}`,
      subject: "Hotel availability and stop-sale calendar",
      author: "Yanabea Alhuda",
      creator: "Yanabea Alhuda Stop Sale Tracker"
    });

    function drawLogo(x, logoY) {
      const logoData = options.logoData;
      if (!logoData || typeof logoData !== "string" || !/^data:image\//i.test(logoData)) return false;
      try {
        const format = /^data:image\/jpe?g/i.test(logoData) ? "JPEG" : "PNG";
        pdf.addImage(logoData, format, x, logoY, 20, 20, undefined, "FAST");
        return true;
      } catch (error) {
        console.warn("Could not add the report logo to the PDF", error);
        return false;
      }
    }

    function drawMetricCard(x, cardY, width, accent, label, value) {
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(234, 223, 206);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, cardY, width, 20, 2, 2, "FD");
      pdf.setFillColor(...rgb(accent));
      pdf.roundedRect(x, cardY, 2.2, 20, 1, 1, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.2);
      pdf.setTextColor(100, 100, 100);
      pdf.text(label, x + width / 2, cardY + 7, { align: "center" });
      pdf.setFontSize(14);
      pdf.setTextColor(...rgb(accent));
      pdf.text(String(value), x + width / 2, cardY + 15.5, { align: "center" });
    }

    function drawReportHeader(firstPage) {
      y = margin;
      const hasLogo = firstPage && drawLogo(margin, y);
      const titleX = margin + (hasLogo ? 25 : 0);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(firstPage ? 16 : 13);
      pdf.setTextColor(111, 16, 40);
      pdf.text(labels.reportTitle, titleX, y + 7.2);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(firstPage ? 8.5 : 7.5);
      pdf.setTextColor(100, 100, 100);
      pdf.text(labels.slogan, titleX, y + 13.5);

      pdf.setFont("helvetica", firstPage ? "bold" : "normal");
      pdf.setFontSize(firstPage ? 9.5 : 7.2);
      pdf.setTextColor(firstPage ? 111 : 100, firstPage ? 16 : 100, firstPage ? 40 : 100);
      pdf.text(firstPage ? labels.officialReport : `${labels.generated} ${generatedAt}`, pageWidth - margin, y + 6.8, { align: "right" });
      if (firstPage) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${labels.generated} ${generatedAt}`, pageWidth - margin, y + 13.2, { align: "right" });
      }

      pdf.setDrawColor(212, 175, 98);
      pdf.setLineWidth(0.8);
      pdf.line(margin, y + 22.5, pageWidth - margin, y + 22.5);

      if (firstPage) {
        const cardGap = 6;
        const cardWidth = (contentWidth - cardGap * 2) / 3;
        const cardY = y + 28;
        drawMetricCard(margin, cardY, cardWidth, "6F1028", labels.totalHotels, metrics.totalHotels);
        drawMetricCard(margin + cardWidth + cardGap, cardY, cardWidth, "B00020", labels.activeStops, metrics.activeStops);
        drawMetricCard(margin + (cardWidth + cardGap) * 2, cardY, cardWidth, "B56A00", labels.upcomingStops, metrics.upcomingStops);
        y = cardY + 26;
      } else {
        y += 28;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(111, 16, 40);
      pdf.text(`Stop Sale Calendar - ${reportMonth}${firstPage ? "" : " (continued)"}`, margin, y);
      y += 4.5;
      pageHasCalendarContent = false;
    }

    function newPage() {
      pdf.addPage("a3", "landscape");
      drawReportHeader(false);
    }

    function drawHotelHeader(name, fill, continued) {
      const title = continued ? `${name} (continued)` : name;
      drawCell(pdf, margin, y, labelWidth, weekdayHeight + dateHeight, title, {
        fill, fontSize: 9.2, fontStyle: "bold"
      });
      for (let day = 1; day <= daysInMonth; day += 1) {
        const x = margin + labelWidth + (day - 1) * dayWidth;
        const date = new Date(Date.UTC(year, month, day));
        drawCell(pdf, x, y, dayWidth, weekdayHeight, WEEKDAYS[date.getUTCDay()], {
          fill, fontSize: 7.2, fontStyle: "bold"
        });
        drawCell(pdf, x, y + weekdayHeight, dayWidth, dateHeight, `${day}/${MONTH_NAMES[month].slice(0, 3)}`, {
          fill: "FFFFFF", fontSize: 6.2
        });
      }
      y += weekdayHeight + dateHeight;
      pageHasCalendarContent = true;
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
        fontSize: hasSubject ? 7 : 8,
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
          fill: "FFFFFF", textColor: "0F766E", fontSize: 6, fontStyle: "italic"
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

    drawReportHeader(true);
    hotels.forEach((hotel, hotelIndex) => {
      const fill = HOTEL_FILLS[hotelIndex % HOTEL_FILLS.length];
      const rooms = preparedRooms(hotel);
      const fullHeight = weekdayHeight + dateHeight + rooms.length * roomHeight + separatorHeight + blockGap;
      if (y + fullHeight > bottomLimit && pageHasCalendarContent) newPage();
      drawHotelHeader(hotel.name || "Hotel", fill, false);
      rooms.forEach(room => {
        if (y + roomHeight + separatorHeight > bottomLimit) {
          newPage();
          drawHotelHeader(hotel.name || "Hotel", fill, true);
        }
        drawRoom(room, fill);
      });
      pdf.setFillColor(0, 0, 0);
      pdf.rect(margin, y, contentWidth, separatorHeight, "F");
      y += separatorHeight + blockGap;
    });

    const legendHeight = roomHeight * 4;
    if (y + legendHeight > bottomLimit) newPage();
    drawCell(pdf, margin, y, labelWidth, roomHeight, labels.openToSale, { fill: "9DC3E6", fontSize: 8, fontStyle: "bold" });
    drawCell(pdf, margin, y + roomHeight, labelWidth, roomHeight, labels.white, { fill: "FFFFFF", fontSize: 8 });
    drawCell(pdf, margin, y + roomHeight * 2, labelWidth, roomHeight, labels.stopSale, { fill: "9DC3E6", fontSize: 8, fontStyle: "bold" });
    drawCell(pdf, margin, y + roomHeight * 3, labelWidth, roomHeight, labels.red, { fill: "FF0000", fontSize: 8, fontStyle: "bold" });

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(234, 223, 206);
      pdf.setLineWidth(0.25);
      pdf.line(margin, pageHeight - 10.5, pageWidth - margin, pageHeight - 10.5);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.2);
      pdf.setTextColor(100, 100, 100);
      pdf.text(labels.copyright, pageWidth / 2, pageHeight - 5.4, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 5.4, { align: "right" });
    }
    return pdf;
  }

  function download(options) {
    buildDocument(options).save(getFileName(options));
  }

  root.StopSalePdfExporter = { buildDocument, download, getFileName };
})(typeof globalThis !== "undefined" ? globalThis : window);
