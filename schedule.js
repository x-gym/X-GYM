/* ==========================================================================
   X-GYM · schedule.js  ·  v1.0.0
   --------------------------------------------------------------------------
   Κοινή λογική προγράμματος τμημάτων.
   Το φορτώνουν ΚΑΙ οι δύο σελίδες:
       XGYM.html                              -> <script src="schedule.js"></script>
       X GYM - Attendance tracker/XDISPLAY.html -> <script src="../schedule.js"></script>

   ΚΑΝΟΝΑΣ: καμία λογική προγράμματος δεν γράφεται μέσα στις σελίδες.
   Ό,τι αφορά "τι παίζει πότε" ζει ΜΟΝΟ εδώ.

   Αυτό το αρχείο δεν αγγίζει Firestore — είναι καθαρή λογική.
   Τα δεδομένα του τα δίνουν οι σελίδες.
   ========================================================================== */
(function (global) {
  "use strict";

  var VERSION = "1.0.0";

  /* ---------------------------------------------------------------- ημέρες */
  var DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_NAMES = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
  var DAY_SHORT = ["ΚΥΡ", "ΔΕΥ", "ΤΡΙ", "ΤΕΤ", "ΠΕΜ", "ΠΑΡ", "ΣΑΒ"];

  /* ------------------------------------------------------- τύποι τμημάτων */
  /* Τα χρώματα είναι σταθερά σε ΟΛΑ τα slides και στο ADMIN.
     Pilates = το κυανό της εφαρμογής (είναι το κυρίαρχο τμήμα).
     Pilates Men = ίδιο κυανό + badge, γιατί είναι το ίδιο μάθημα.        */
  var CLASS_TYPES = {
    pilates:     { label: "Pilates",       color: "#5ff0ff", kids: false, badge: null  },
    pilates_men: { label: "Pilates Men",   color: "#5ff0ff", kids: false, badge: "MEN" },
    kykliki:     { label: "Κυκλική",       color: "#ffa94d", kids: false, badge: null  },
    enorgani:    { label: "Ενόργανη",      color: "#c77dff", kids: true,  badge: null  },
    trx:         { label: "TRX",           color: "#51cf66", kids: false, badge: null  },
    bjj:         { label: "BJJ",           color: "#ff6b6b", kids: false, badge: null  },
    bjj_kids:    { label: "BJJ",           color: "#ff6b6b", kids: true,  badge: null  }
  };

  /* --------------------------------------------------------- προπονητές */
  var TRAINERS = ["Μαριάννα", "Κώστας", "Χρήστος"];

  /* ------------------------------------------------- σταθερό πρόγραμμα */
  /* Χρησιμεύει σε δύο πράγματα:
       1. seed  — γράφεται μία φορά στο Firestore
       2. fallback — αν πέσει το δίκτυο, η οθόνη δείχνει αυτό αντί για κενό
     day: 0=Κυρ ... 6=Σαβ  (ίδιο με το Date.getDay())                     */
  var DEFAULT_CLASSES = [
    /* ΔΕΥΤΕΡΑ */
    { id: "mon_1000_kykliki",     day: 1, time: "10:00", duration: 60, type: "kykliki",     trainer: "Κώστας",   active: true },
    { id: "mon_1600_enorgani",    day: 1, time: "16:00", duration: 60, type: "enorgani",    trainer: "Μαριάννα", active: true },
    { id: "mon_1700_enorgani",    day: 1, time: "17:00", duration: 60, type: "enorgani",    trainer: "Μαριάννα", active: true },
    { id: "mon_1800_pilates",     day: 1, time: "18:00", duration: 60, type: "pilates",     trainer: "Μαριάννα", active: true },
    { id: "mon_1900_pilates",     day: 1, time: "19:00", duration: 60, type: "pilates",     trainer: "Μαριάννα", active: true },
    { id: "mon_2100_pilates_men", day: 1, time: "21:00", duration: 60, type: "pilates_men", trainer: "Μαριάννα", active: true },

    /* ΤΡΙΤΗ */
    { id: "tue_0900_pilates",     day: 2, time: "09:00", duration: 60, type: "pilates",     trainer: "Μαριάννα", active: true },
    { id: "tue_1700_trx",         day: 2, time: "17:00", duration: 60, type: "trx",         trainer: "Χρήστος",  active: true },
    { id: "tue_1900_bjj_kids",    day: 2, time: "19:00", duration: 60, type: "bjj_kids",    trainer: "Χρήστος",  active: true },
    { id: "tue_2000_bjj",         day: 2, time: "20:00", duration: 60, type: "bjj",         trainer: "Χρήστος",  active: true },

    /* ΤΕΤΑΡΤΗ */
    { id: "wed_1000_kykliki",     day: 3, time: "10:00", duration: 60, type: "kykliki",     trainer: "Κώστας",   active: true },
    { id: "wed_1600_enorgani",    day: 3, time: "16:00", duration: 60, type: "enorgani",    trainer: "Μαριάννα", active: true },
    { id: "wed_1700_enorgani",    day: 3, time: "17:00", duration: 60, type: "enorgani",    trainer: "Μαριάννα", active: true },
    { id: "wed_1800_pilates",     day: 3, time: "18:00", duration: 60, type: "pilates",     trainer: "Μαριάννα", active: true },
    { id: "wed_1900_pilates",     day: 3, time: "19:00", duration: 60, type: "pilates",     trainer: "Μαριάννα", active: true },
    { id: "wed_2000_pilates_men", day: 3, time: "20:00", duration: 60, type: "pilates_men", trainer: "Μαριάννα", active: true },

    /* ΠΕΜΠΤΗ */
    { id: "thu_0900_pilates",     day: 4, time: "09:00", duration: 60, type: "pilates",     trainer: "Μαριάννα", active: true },
    { id: "thu_1700_trx",         day: 4, time: "17:00", duration: 60, type: "trx",         trainer: "Χρήστος",  active: true },
    { id: "thu_1800_pilates",     day: 4, time: "18:00", duration: 60, type: "pilates",     trainer: "Μαριάννα", active: true },
    { id: "thu_1900_bjj_kids",    day: 4, time: "19:00", duration: 60, type: "bjj_kids",    trainer: "Χρήστος",  active: true },
    { id: "thu_2000_bjj",         day: 4, time: "20:00", duration: 60, type: "bjj",         trainer: "Χρήστος",  active: true }

    /* ΠΑΡΑΣΚΕΥΗ — κενή */
  ];

  /* ====================================================== βοηθητικά ημ/νιών */

  /* Τοπική ημερομηνία "YYYY-MM-DD".
     ΠΡΟΣΟΧΗ: sv-SE, όχι toISOString() — ίδια σύμβαση με το υπόλοιπο XGYM. */
  function dateKey(d) {
    return (d || new Date()).toLocaleDateString("sv-SE");
  }

  function parseKey(key) {
    var p = String(key).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function addDays(d, n) {
    var c = new Date(d.getTime());
    c.setDate(c.getDate() + n);
    c.setHours(0, 0, 0, 0);
    return c;
  }

  function minutesOf(hhmm) {
    var p = String(hhmm).split(":");
    return (+p[0]) * 60 + (+p[1]);
  }

  function hhmm(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function typeInfo(typeId) {
    return CLASS_TYPES[typeId] || { label: typeId, color: "#8892a0", kids: false, badge: null };
  }

  /* Πλήρης ονομασία για εμφάνιση: "BJJ Kids", "Ενόργανη Kids", "Pilates Men" */
  function displayName(typeId) {
    var t = typeInfo(typeId);
    var n = t.label;
    if (t.kids) n += " Kids";
    if (t.badge === "MEN" && n.indexOf("Men") === -1) n += " Men";
    return n;
  }

  /* Το doc ID της εξαίρεσης — ντετερμινιστικό, ίδιο μοτίβο με xgym_payments.
     Δύο πατήματα "Ακύρωση" γράφουν στο ΙΔΙΟ έγγραφο, δεν δημιουργούν δεύτερο. */
  function overrideId(dateK, classId) {
    return dateK + "_" + classId;
  }

  /* ============================================ ο πυρήνας: τι παίζει σήμερα */
  /*
     date      : Date
     classes   : πίνακας σταθερών τμημάτων
     overrides : πίνακας εξαιρέσεων (ΟΛΕΣ όσες έχεις φορτώσει — η συνάρτηση
                 ψάχνει και όσες δείχνουν ΠΡΟΣ αυτή τη μέρα)

     Επιστρέφει occurrences ταξινομημένα κατά ώρα:
       status: "ok"          κανονικό
               "cancelled"   ακυρώθηκε  (μένει στη λίστα — το UI αποφασίζει)
               "moved_away"  μεταφέρθηκε αλλού (το UI συνήθως το κρύβει)
               "moved_in"    ήρθε από άλλη μέρα
  */
  function getScheduleForDate(date, classes, overrides) {
    classes   = classes   || [];
    overrides = overrides || [];

    var key = dateKey(date);
    var dow = date.getDay();
    var out = [];

    /* --- 1. το σταθερό πρόγραμμα της ημέρας --- */
    classes.forEach(function (c) {
      if (c.active === false) return;
      if (c.day !== dow) return;

      var occ = makeOcc(c, key, c.time, c.trainer, "ok");

      var ov = findOverride(overrides, key, c.id);
      if (ov) {
        if (ov.status === "cancelled") {
          occ.status = "cancelled";
          occ.note = ov.note || "";
        } else if (ov.status === "moved") {
          occ.status = "moved_away";
          occ.movedTo = { date: ov.newDate || key, time: ov.newTime || c.time };
          occ.note = ov.note || "";
        } else if (ov.status === "trainer") {
          occ.trainer = ov.newTrainer || c.trainer;
          occ.trainerChanged = true;
          occ.note = ov.note || "";
        }
      }
      out.push(occ);
    });

    /* --- 2. τμήματα που ΜΕΤΑΦΕΡΘΗΚΑΝ ΣΕ αυτή τη μέρα --- */
    overrides.forEach(function (ov) {
      if (ov.status !== "moved") return;
      if ((ov.newDate || ov.date) !== key) return;
      if (ov.date === key && (ov.newDate || key) === key) {
        /* μετακίνηση ώρας μέσα στην ίδια μέρα — το χειριζόμαστε εδώ */
      }
      var c = classes.filter(function (x) { return x.id === ov.classId; })[0];
      if (!c) return;

      var occ = makeOcc(c, key, ov.newTime || c.time, ov.newTrainer || c.trainer, "moved_in");
      occ.movedFrom = { date: ov.date, time: c.time };
      occ.note = ov.note || "";
      out.push(occ);
    });

    out.sort(function (a, b) { return minutesOf(a.time) - minutesOf(b.time); });
    return out;
  }

  function makeOcc(c, dateK, time, trainer, status) {
    var t = typeInfo(c.type);
    var startM = minutesOf(time);
    return {
      classId: c.id,
      type: c.type,
      name: displayName(c.type),
      color: t.color,
      kids: t.kids,
      badge: t.badge,
      trainer: trainer,
      date: dateK,
      time: time,
      duration: c.duration || 60,
      endTime: hhmm(startM + (c.duration || 60)),
      startMin: startM,
      endMin: startM + (c.duration || 60),
      status: status || "ok",
      trainerChanged: false,
      movedFrom: null,
      movedTo: null,
      note: ""
    };
  }

  function findOverride(overrides, dateK, classId) {
    for (var i = 0; i < overrides.length; i++) {
      var o = overrides[i];
      if (o.date === dateK && o.classId === classId) return o;
    }
    return null;
  }

  /* Αυτά που πραγματικά μπαίνουν στην οθόνη */
  function visibleOccurrences(occs) {
    return occs.filter(function (o) { return o.status !== "moved_away"; });
  }

  /* ================================================ τμήμα σε εξέλιξη / επόμενο */

  function getCurrentClass(now, classes, overrides) {
    var occs = visibleOccurrences(getScheduleForDate(now, classes, overrides));
    var m = now.getHours() * 60 + now.getMinutes();
    for (var i = 0; i < occs.length; i++) {
      var o = occs[i];
      if (o.status === "cancelled") continue;
      if (m >= o.startMin && m < o.endMin) {
        o.progress = (m - o.startMin) / o.duration;   /* 0..1 για την μπάρα */
        o.minutesLeft = o.endMin - m;
        return o;
      }
    }
    return null;
  }

  /* Ψάχνει μπροστά έως 7 μέρες — έτσι το slide δεν αδειάζει ποτέ
     Παρασκευή/Σάββατο/Κυριακή που δεν υπάρχουν τμήματα.            */
  function getNextClass(now, classes, overrides, maxDays) {
    maxDays = maxDays == null ? 7 : maxDays;
    var nowMin = now.getHours() * 60 + now.getMinutes();

    for (var d = 0; d <= maxDays; d++) {
      var day = addDays(now, d);
      var occs = visibleOccurrences(getScheduleForDate(day, classes, overrides));

      for (var i = 0; i < occs.length; i++) {
        var o = occs[i];
        if (o.status === "cancelled") continue;
        if (d === 0 && o.startMin <= nowMin) continue;

        o.isToday = (d === 0);
        o.isTomorrow = (d === 1);
        o.daysAhead = d;
        o.minutesUntil = (d * 1440) + o.startMin - nowMin;
        o.dayName = DAY_NAMES[day.getDay()];
        return o;
      }
    }
    return null;
  }

  /* "Ξεκινά σε 12΄" / "Ξεκινά σε 1ω 20΄" / "Δευτέρα 10:00" */
  function countdownText(occ) {
    if (!occ) return "";
    if (!occ.isToday) return occ.dayName + " " + occ.time;
    var m = occ.minutesUntil;
    if (m < 1) return "Ξεκινά τώρα";
    if (m < 60) return "Ξεκινά σε " + m + "΄";
    var h = Math.floor(m / 60), r = m % 60;
    return "Ξεκινά σε " + h + "ω" + (r ? " " + r + "΄" : "");
  }

  /* Όλη η εβδομάδα — για το QR / τη σελίδα εβδομαδιαίου */
  function getWeek(fromDate, classes, overrides) {
    var start = addDays(fromDate, -((fromDate.getDay() + 6) % 7)); /* Δευτέρα */
    var week = [];
    for (var i = 0; i < 7; i++) {
      var d = addDays(start, i);
      week.push({
        date: d,
        key: dateKey(d),
        dayName: DAY_NAMES[d.getDay()],
        dayShort: DAY_SHORT[d.getDay()],
        occurrences: visibleOccurrences(getScheduleForDate(d, classes, overrides))
      });
    }
    return week;
  }

  /* ------------------------------------------------------------- εξαγωγή */
  global.XSchedule = {
    VERSION: VERSION,
    DAY_CODES: DAY_CODES,
    DAY_NAMES: DAY_NAMES,
    DAY_SHORT: DAY_SHORT,
    CLASS_TYPES: CLASS_TYPES,
    TRAINERS: TRAINERS,
    DEFAULT_CLASSES: DEFAULT_CLASSES,

    dateKey: dateKey,
    parseKey: parseKey,
    addDays: addDays,
    minutesOf: minutesOf,
    hhmm: hhmm,
    typeInfo: typeInfo,
    displayName: displayName,
    overrideId: overrideId,

    getScheduleForDate: getScheduleForDate,
    visibleOccurrences: visibleOccurrences,
    getCurrentClass: getCurrentClass,
    getNextClass: getNextClass,
    countdownText: countdownText,
    getWeek: getWeek
  };

})(typeof window !== "undefined" ? window : globalThis);
