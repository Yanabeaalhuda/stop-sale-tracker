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

  function getRoomFileName(options) {
    const month = Number(options.month);
    const year = Number(options.year);
    if (options.language === "ar") return `تقويم_إيقاف_البيع_حسب_الغرف_${MONTH_NAMES[month]}_${year}.pdf`;
    return `Stop_Sale_Calendar_By_Room_${MONTH_NAMES[month]}_${year}.pdf`;
  }

  function buildRoomCentricDocument(options) {
    const JsPDF = pdfConstructor();
    const year = Number(options.year);
    const month = Number(options.month);
    const rooms = Array.isArray(options.rooms) ? options.rooms : [];
    const metrics = Object.assign({
      totalHotels: 0,
      activeStops: 0,
      upcomingStops: 0
    }, options.metrics || {});
    const isAr = options.language === "ar";
    const labels = Object.assign({
      allRooms: isAr ? "جميع أنواع الغرف والأجنحة" : "All RM Types & Suites",
      subject: isAr ? "خاضع لتوافر الفندق" : "Subject to hotel availability",
      openToSale: isAr ? "متاح للبيع" : "Open to Sale",
      white: isAr ? "أبيض" : "White",
      stopSale: isAr ? "إيقاف بيع" : "Stop Sale",
      red: isAr ? "أحمر" : "RED",
      reportTitle: isAr ? "تقرير إيقاف البيع حسب نوع الغرفة - ينابيع الهدى" : "Yanabea Alhuda Room-Wise Stop Sale Report",
      slogan: isAr ? "سكن مطمئن... لرحلة مباركة" : "Peaceful Stay... for a Blessed Journey",
      officialReport: isAr ? "تقرير رسمي" : "OFFICIAL REPORT",
      generated: isAr ? "تاريخ الإنشاء:" : "Generated:",
      totalHotels: isAr ? "إجمالي الفنادق" : "TOTAL HOTELS LOADED",
      activeStops: isAr ? "إيقاف فعال الآن" : "ACTIVE STOP SALES",
      upcomingStops: isAr ? "إيقاف بيع قادم" : "UPCOMING STOP SALES",
      copyright: isAr ? "حقوق الطبع محفوظة ينابيع الهدى 2026 © سكن مطمئن... لرحلة مباركة" : "COPYRIGHTS YANABEA ALHUDA 2026 © PEACEFUL STAY... FOR A BLESSED JOURNEY",
      hotelHeader: isAr ? "اسم الفندق" : "Hotel Name",
      roomHeaderPrefix: isAr ? "نوع الغرفة: " : "ROOM TYPE: "
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
    const sectionHeaderHeight = 7.5;
    const weekdayHeight = 6.5;
    const dateHeight = 5.5;
    const hotelRowHeight = 7.0;
    const separatorHeight = 2.0;
    const blockGap = 3.5;
    const bottomLimit = pageHeight - 14;
    const generatedAt = String(options.generatedAt || new Date().toLocaleString("en-US"));
    const reportMonth = `${MONTH_NAMES[month]} ${year}`;
    let y = 0;
    let pageHasCalendarContent = false;

    pdf.setProperties({
      title: `Room Stop Sale Calendar - ${reportMonth}`,
      subject: "Hotel availability and stop-sale calendar grouped by room type",
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
      pdf.text(`${labels.reportTitle} - ${reportMonth}${firstPage ? "" : " (continued)"}`, margin, y);
      y += 4.5;
      pageHasCalendarContent = false;
    }

    function newPage() {
      pdf.addPage("a3", "landscape");
      drawReportHeader(false);
    }

    function drawRoomSectionHeader(roomName, isAllRooms, continued) {
      const displayTitle = isAllRooms ? labels.allRooms : (roomName || "Room Type");
      const title = `${labels.roomHeaderPrefix}${displayTitle}${continued ? " (continued)" : ""}`;

      drawCell(pdf, margin, y, contentWidth, sectionHeaderHeight, title, {
        fill: isAllRooms ? "420817" : "6F1028",
        textColor: "FFFFFF",
        fontSize: 9.5,
        fontStyle: "bold",
        align: "left"
      });
      y += sectionHeaderHeight;

      drawCell(pdf, margin, y, labelWidth, weekdayHeight + dateHeight, labels.hotelHeader, {
        fill: "FDF7EC", textColor: "6F1028", fontSize: 8.5, fontStyle: "bold"
      });
      for (let day = 1; day <= daysInMonth; day += 1) {
        const x = margin + labelWidth + (day - 1) * dayWidth;
        const date = new Date(Date.UTC(year, month, day));
        drawCell(pdf, x, y, dayWidth, weekdayHeight, WEEKDAYS[date.getUTCDay()], {
          fill: "FDF7EC", textColor: "420817", fontSize: 7.0, fontStyle: "bold"
        });
        drawCell(pdf, x, y + weekdayHeight, dayWidth, dateHeight, `${day}/${MONTH_NAMES[month].slice(0, 3)}`, {
          fill: "FFFFFF", fontSize: 6.0
        });
      }
      y += weekdayHeight + dateHeight;
      pageHasCalendarContent = true;
    }

    function drawHotelRowUnderRoom(hotelItem, hotelIndex) {
      const fill = HOTEL_FILLS[hotelIndex % HOTEL_FILLS.length];
      const stopDays = new Set((hotelItem.stopDays || []).map(Number));
      const subjectDays = new Set((hotelItem.subjectDays || []).map(Number));
      const availableDays = [...subjectDays].filter(day => day >= 1 && day <= daysInMonth && !stopDays.has(day));

      drawCell(pdf, margin, y, labelWidth, hotelRowHeight, hotelItem.hotelName || "Hotel", {
        fill: fill,
        fontSize: 7.8,
        fontStyle: "bold",
        align: "left"
      });

      for (let day = 1; day <= daysInMonth; day += 1) {
        const x = margin + labelWidth + (day - 1) * dayWidth;
        drawCell(pdf, x, y, dayWidth, hotelRowHeight, "", {
          fill: stopDays.has(day) ? "FF0000" : "FFFFFF"
        });
      }

      ranges(availableDays).forEach(range => {
        const x = margin + labelWidth + (range.start - 1) * dayWidth;
        const width = (range.end - range.start + 1) * dayWidth;
        drawCell(pdf, x, y, width, hotelRowHeight, range.end - range.start >= 2 ? labels.subject : "", {
          fill: "FFFFFF", textColor: "0F766E", fontSize: 5.8, fontStyle: "italic"
        });
      });
      y += hotelRowHeight;
    }

    drawReportHeader(true);

    rooms.forEach(roomGroup => {
      const hotelsInRoom = Array.isArray(roomGroup.hotels) ? roomGroup.hotels : [];
      if (!hotelsInRoom.length) return;

      const blockHeaderHeight = sectionHeaderHeight + weekdayHeight + dateHeight;
      const fullBlockHeight = blockHeaderHeight + hotelsInRoom.length * hotelRowHeight + separatorHeight + blockGap;

      if (y + fullBlockHeight > bottomLimit && pageHasCalendarContent) {
        newPage();
      }

      drawRoomSectionHeader(roomGroup.name, roomGroup.isAllRooms, false);

      hotelsInRoom.forEach((hotelItem, hotelIndex) => {
        if (y + hotelRowHeight + separatorHeight > bottomLimit) {
          newPage();
          drawRoomSectionHeader(roomGroup.name, roomGroup.isAllRooms, true);
        }
        drawHotelRowUnderRoom(hotelItem, hotelIndex);
      });

      pdf.setFillColor(0, 0, 0);
      pdf.rect(margin, y, contentWidth, separatorHeight, "F");
      y += separatorHeight + blockGap;
    });

    const legendHeight = hotelRowHeight * 4;
    if (y + legendHeight > bottomLimit) newPage();
    drawCell(pdf, margin, y, labelWidth, hotelRowHeight, labels.openToSale, { fill: "9DC3E6", fontSize: 8, fontStyle: "bold" });
    drawCell(pdf, margin, y + hotelRowHeight, labelWidth, hotelRowHeight, labels.white, { fill: "FFFFFF", fontSize: 8 });
    drawCell(pdf, margin, y + hotelRowHeight * 2, labelWidth, hotelRowHeight, labels.stopSale, { fill: "9DC3E6", fontSize: 8, fontStyle: "bold" });
    drawCell(pdf, margin, y + hotelRowHeight * 3, labelWidth, hotelRowHeight, labels.red, { fill: "FF0000", fontSize: 8, fontStyle: "bold" });

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

  function downloadByRoom(options) {
    buildRoomCentricDocument(options).save(getRoomFileName(options));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AVAILABILITY-ONLY PDF REPORT
  // Shows only "Subject to Hotel Availability" ranges. Stop-sale dates are
  // intentionally excluded — they are never referenced in the output.
  // ─────────────────────────────────────────────────────────────────────────────

  function getAvailabilityFileName(options) {
    const month = Number(options.month);
    const year  = Number(options.year);
    if (options.language === "ar") return `تقرير_الإتاحة_${MONTH_NAMES[month]}_${year}.pdf`;
    return `Hotel_Availability_Report_${MONTH_NAMES[month]}_${year}.pdf`;
  }

  function buildAvailabilityDocument(options) {
    const JsPDF  = pdfConstructor();
    const year   = Number(options.year);
    const month  = Number(options.month);
    const hotels = Array.isArray(options.hotels) ? options.hotels : [];
    const isAr   = options.language === "ar";

    const metrics = Object.assign({
      totalHotels: hotels.length,
      availableRooms: 0,
      subjectRooms: 0
    }, options.metrics || {});

    const labels = Object.assign({
      allRooms:         isAr ? "جميع أنواع الغرف والأجنحة"    : "All RM Types & Suites",
      subject:          isAr ? "خاضع لتوافر الفندق"           : "Subject to Hotel Availability",
      openToSale:       isAr ? "متاح للبيع"                   : "Open to Sale",
      subjectShort:     isAr ? "إتاحة"                        : "Availability",
      reportTitle:      isAr ? "تقرير إتاحة الفنادق - ينابيع الهدى" : "Yanabea Alhuda Hotel Availability Report",
      slogan:           isAr ? "سكن مطمئن... لرحلة مباركة"   : "Peaceful Stay... for a Blessed Journey",
      officialReport:   isAr ? "تقرير رسمي"                   : "OFFICIAL REPORT",
      generated:        isAr ? "تاريخ الإنشاء:"               : "Generated:",
      totalHotels:      isAr ? "إجمالي الفنادق"               : "TOTAL HOTELS LOADED",
      availableRooms:   isAr ? "غرف بإتاحة مشروطة"            : "ROOMS WITH AVAILABILITY",
      subjectRooms:     isAr ? "أيام إتاحة"                   : "SUBJECT DAYS",
      noAvailability:   isAr ? "متاح بالكامل"                 : "Open to Sale",
      copyright:        isAr
        ? "حقوق الطبع محفوظة ينابيع الهدى 2026 © سكن مطمئن... لرحلة مباركة"
        : "COPYRIGHTS YANABEA ALHUDA 2026 © PEACEFUL STAY... FOR A BLESSED JOURNEY"
    }, options.labels || {});

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
      throw new Error("A valid report year and month are required.");
    }

    const daysInMonth   = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const pdf           = new JsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
    const pageWidth     = pdf.internal.pageSize.getWidth();
    const pageHeight    = pdf.internal.pageSize.getHeight();
    const margin        = 8;
    const contentWidth  = pageWidth - margin * 2;
    const labelWidth    = 94;
    const dayWidth      = (contentWidth - labelWidth) / daysInMonth;
    const weekdayHeight = 7;
    const dateHeight    = 6;
    const roomHeight    = 7.2;
    const separatorHeight = 2.4;
    const blockGap      = 3;
    const bottomLimit   = pageHeight - 14;
    const generatedAt   = String(options.generatedAt || new Date().toLocaleString("en-US"));
    const reportMonth   = `${MONTH_NAMES[month]} ${year}`;
    let y = 0;
    let pageHasCalendarContent = false;

    // Accent colours for this report: teal/green palette (no red)
    const ACCENT_TITLE  = "0F766E"; // teal — availability theme
    const ACCENT_CARD1  = "0F766E";
    const ACCENT_CARD2  = "087A36";
    const ACCENT_CARD3  = "1A6B5A";
    const AVAIL_FILL    = "E6F7F4"; // light teal cell background
    const AVAIL_TEXT    = "0F766E"; // teal text
    const HEADER_FILL   = "0F766E"; // section header background
    const HOTEL_HEADER_FILLS = [
      "D9F2EC", "BFE8E0", "A5DDD3", "8BD1C6", "71C5B8",
      "57B9AB", "3DAD9D", "23A190", "0F9582"
    ];

    pdf.setProperties({
      title:   `Hotel Availability Report - ${reportMonth}`,
      subject: "Hotel availability calendar",
      author:  "Yanabea Alhuda",
      creator: "Yanabea Alhuda Stop Sale Tracker"
    });

    function drawLogo(x, logoY) {
      const logoData = options.logoData;
      if (!logoData || typeof logoData !== "string" || !/^data:image\//i.test(logoData)) return false;
      try {
        const format = /^data:image\/jpe?g/i.test(logoData) ? "JPEG" : "PNG";
        pdf.addImage(logoData, format, x, logoY, 20, 20, undefined, "FAST");
        return true;
      } catch (err) {
        console.warn("Could not add logo to PDF", err);
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
      const titleX  = margin + (hasLogo ? 25 : 0);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(firstPage ? 16 : 13);
      pdf.setTextColor(...rgb(ACCENT_TITLE));
      pdf.text(labels.reportTitle, titleX, y + 7.2);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(firstPage ? 8.5 : 7.5);
      pdf.setTextColor(100, 100, 100);
      pdf.text(labels.slogan, titleX, y + 13.5);

      pdf.setFont("helvetica", firstPage ? "bold" : "normal");
      pdf.setFontSize(firstPage ? 9.5 : 7.2);
      pdf.setTextColor(...(firstPage ? rgb(ACCENT_TITLE) : [100, 100, 100]));
      pdf.text(
        firstPage ? labels.officialReport : `${labels.generated} ${generatedAt}`,
        pageWidth - margin, y + 6.8, { align: "right" }
      );
      if (firstPage) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${labels.generated} ${generatedAt}`, pageWidth - margin, y + 13.2, { align: "right" });
      }

      // Gold divider line
      pdf.setDrawColor(212, 175, 98);
      pdf.setLineWidth(0.8);
      pdf.line(margin, y + 22.5, pageWidth - margin, y + 22.5);

      if (firstPage) {
        const cardGap   = 6;
        const cardWidth = (contentWidth - cardGap * 2) / 3;
        const cardY     = y + 28;
        drawMetricCard(margin,                          cardY, cardWidth, ACCENT_CARD1, labels.totalHotels,    metrics.totalHotels);
        drawMetricCard(margin + cardWidth + cardGap,    cardY, cardWidth, ACCENT_CARD2, labels.availableRooms, metrics.availableRooms);
        drawMetricCard(margin + (cardWidth + cardGap)*2, cardY, cardWidth, ACCENT_CARD3, labels.subjectRooms,  metrics.subjectRooms);
        y = cardY + 26;
      } else {
        y += 28;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...rgb(ACCENT_TITLE));
      pdf.text(
        `${labels.reportTitle} - ${reportMonth}${firstPage ? "" : " (continued)"}`,
        margin, y
      );
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
        fill, fontSize: 9.2, fontStyle: "bold", textColor: "0F4F47"
      });
      for (let day = 1; day <= daysInMonth; day += 1) {
        const x    = margin + labelWidth + (day - 1) * dayWidth;
        const date = new Date(Date.UTC(year, month, day));
        drawCell(pdf, x, y, dayWidth, weekdayHeight, WEEKDAYS[date.getUTCDay()], {
          fill, fontSize: 7.2, fontStyle: "bold", textColor: "0F4F47"
        });
        drawCell(pdf, x, y + weekdayHeight, dayWidth, dateHeight, `${day}/${MONTH_NAMES[month].slice(0, 3)}`, {
          fill: "FFFFFF", fontSize: 6.2
        });
      }
      y += weekdayHeight + dateHeight;
      pageHasCalendarContent = true;
    }

    function drawRoomAvailability(room, fill) {
      const subjectDays = new Set((room.subjectDays || []).map(Number));
      const availDays   = [...subjectDays].filter(d => d >= 1 && d <= daysInMonth);
      const hasSubject  = availDays.length > 0;
      const baseName    = room.isAllRooms ? labels.allRooms : (room.name || "Room Type");
      const name        = hasSubject && !room.isAllRooms
        ? `${baseName} (${labels.subjectShort})`
        : baseName;

      drawCell(pdf, margin, y, labelWidth, roomHeight, name, {
        fill: room.isAllRooms ? "FFFFFF" : fill,
        fontSize: hasSubject ? 7 : 8,
        fontStyle: room.isAllRooms ? "bold" : "normal",
        textColor: hasSubject ? AVAIL_TEXT : "333333"
      });

      for (let day = 1; day <= daysInMonth; day += 1) {
        const x = margin + labelWidth + (day - 1) * dayWidth;
        drawCell(pdf, x, y, dayWidth, roomHeight, "", { fill: "FFFFFF" });
      }

      ranges(availDays).forEach(range => {
        const x      = margin + labelWidth + (range.start - 1) * dayWidth;
        const width  = (range.end - range.start + 1) * dayWidth;
        const label  = range.end - range.start >= 2 ? labels.subject : "";
        drawCell(pdf, x, y, width, roomHeight, label, {
          fill: AVAIL_FILL, textColor: AVAIL_TEXT, fontSize: 6, fontStyle: "italic"
        });
      });

      y += roomHeight;
    }

    function preparedRooms(hotel) {
      const supplied = Array.isArray(hotel.rooms) ? hotel.rooms : [];
      const regular  = supplied.filter(r => !r.isAllRooms);
      const allRooms = supplied.find(r => r.isAllRooms) || {
        name: labels.allRooms, isAllRooms: true, stopDays: [], subjectDays: []
      };
      return regular.concat(allRooms);
    }

    drawReportHeader(true);

    hotels.forEach((hotel, hotelIndex) => {
      const fill  = HOTEL_HEADER_FILLS[hotelIndex % HOTEL_HEADER_FILLS.length];
      const rooms = preparedRooms(hotel);
      const fullHeight = weekdayHeight + dateHeight + rooms.length * roomHeight + separatorHeight + blockGap;
      if (y + fullHeight > bottomLimit && pageHasCalendarContent) newPage();
      drawHotelHeader(hotel.name || "Hotel", fill, false);
      rooms.forEach(room => {
        if (y + roomHeight + separatorHeight > bottomLimit) {
          newPage();
          drawHotelHeader(hotel.name || "Hotel", fill, true);
        }
        drawRoomAvailability(room, fill);
      });
      pdf.setFillColor(...rgb(HEADER_FILL));
      pdf.rect(margin, y, contentWidth, separatorHeight, "F");
      y += separatorHeight + blockGap;
    });



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

  function downloadAvailability(options) {
    buildAvailabilityDocument(options).save(getAvailabilityFileName(options));
  }

  root.StopSalePdfExporter = {
    buildDocument,
    download,
    getFileName,
    buildRoomCentricDocument,
    downloadByRoom,
    getRoomFileName,
    buildAvailabilityDocument,
    downloadAvailability,
    getAvailabilityFileName
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
