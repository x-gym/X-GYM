/* ═══════════════════════════════════════════════════════════════════════
   X-GYM · XScanCache — κοινό cache ιστορικού σκαναρισμάτων
   ───────────────────────────────────────────────────────────────────────
   Κρατάει το ιστορικό του xgym_scans στο localStorage της συσκευής και
   ζητάει από το Firestore ΜΟΝΟ τις ημέρες που λείπουν.

     Πρώτο άνοιγμα ανά συσκευή : 10.700 reads (μία φορά)
     Κάθε επόμενο              : 0–150 reads

   ΣΗΜΑΝΤΙΚΟ: το cache φτάνει μέχρι ΧΘΕΣ. Τα σημερινά τα φέρνουν οι
   live listeners που ήδη υπάρχουν — έτσι δεν διπλομετρώνται.

   Αν το localStorage είναι γεμάτο ή απενεργοποιημένο, όλα δουλεύουν
   κανονικά· απλά χωρίς όφελος. Ποτέ χειρότερα από σήμερα.

   ΑΡΧΕΙΟ: scancache.js — στη ΡΙΖΑ του repo, δίπλα στο schedule.js
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
  "use strict";

  var KEY = "xsc:v1";
  var COL = "xgym_scans";

  var store = null;        /* { v, last, m:{id:[name,gender]}, d:{dateKey:[[id,time,period]]} } */
  var loaded = false;
  var canWrite = true;

  function todayKey() { return new Date().toLocaleDateString("sv-SE"); }

  function yesterdayKey() {
    var d = new Date(); d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("sv-SE");
  }

  function blank() { return { v: 1, last: "", m: {}, d: {} }; }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var o = JSON.parse(raw);
      if (!o || o.v !== 1 || !o.d || !o.m) return blank();
      return o;
    } catch (e) {
      console.warn("[cache] ανάγνωση απέτυχε — από την αρχή");
      return blank();
    }
  }

  function write() {
    if (!canWrite) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) {
      canWrite = false;
      console.warn("[cache] εγγραφή απέτυχε (" + e.name + ") — συνεχίζουμε χωρίς cache");
    }
  }

  /* Προσθήκη ενός σκαναρίσματος στο store. Επιστρέφει true αν ήταν νέο. */
  function put(data) {
    var dk = String(data.dateKey || "").slice(0, 10);
    if (dk.length !== 10) return false;

    var id = String(data.id || "").trim();
    if (!id) return false;

    var time = String(data.time || "");
    var per  = String(data.period || "");

    if (!store.d[dk]) store.d[dk] = [];

    /* ίδιο id + ίδια ώρα = ίδιο σκανάρισμα */
    var arr = store.d[dk];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i][0] === id && arr[i][1] === time) return false;
    }
    arr.push([id, time, per]);

    var nm = String(data.name || "").trim();
    var gd = String(data.gender || "");
    if (nm || gd) {
      var cur = store.m[id];
      store.m[id] = [nm || (cur && cur[0]) || "", gd || (cur && cur[1]) || ""];
    }
    return true;
  }

  /* ═══ ΔΗΜΟΣΙΑ API ═══ */

  var API = {

    /* Φορτώνει το cache και συμπληρώνει ό,τι λείπει από το Firestore.
       db = το firebase.firestore() instance της σελίδας. */
    load: function (db) {
      store = read();
      var tKey = todayKey();
      var yKey = yesterdayKey();
      var t0 = Date.now();

      /* ενήμερο — μηδέν reads */
      if (store.last && store.last >= yKey) {
        loaded = true;
        console.log("[cache] ενήμερο έως " + store.last + " · 0 reads · "
                  + API.count() + " καταγραφές");
        return Promise.resolve(API);
      }

      var q;
      if (!store.last) {
        console.log("[cache] πρώτη φορά σε αυτή τη συσκευή — πλήρης λήψη");
        q = db.collection(COL).get();
      } else {
        console.log("[cache] συμπλήρωση από " + store.last);
        q = db.collection(COL)
              .where("dateKey", ">", store.last)
              .where("dateKey", "<", tKey)
              .get();
      }

      return q.then(function (snap) {
        var added = 0;
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          if (String(d.dateKey || "").slice(0, 10) >= tKey) return;  /* σήμερα → listener */
          if (put(d)) added++;
        });

        store.last = yKey;
        write();
        loaded = true;

        console.log("[cache] " + snap.size + " reads · +" + added + " νέες · σύνολο "
                  + API.count() + " · " + (Date.now() - t0) + "ms");
        return API;

      }).catch(function (e) {
        console.error("[cache] λήψη απέτυχε:", e.message);
        loaded = true;                       /* συνεχίζουμε με ό,τι έχουμε */
        return API;
      });
    },

    /* Διατρέχει όλες τις καταγραφές ΜΕΧΡΙ ΧΘΕΣ.
       cb(data, syntheticDocId) — ίδια υπογραφή με το snap.forEach */
    forEach: function (cb) {
      if (!store) store = read();
      for (var dk in store.d) {
        var arr = store.d[dk];
        for (var i = 0; i < arr.length; i++) {
          var e = arr[i];
          var meta = store.m[e[0]] || ["", ""];
          cb({
            id: e[0],
            name: meta[0],
            gender: meta[1],
            time: e[1],
            period: e[2],
            dateKey: dk
          }, "c:" + e[0] + ":" + dk + ":" + e[1]);
        }
      }
    },

    count: function () {
      if (!store) store = read();
      var n = 0;
      for (var dk in store.d) n += store.d[dk].length;
      return n;
    },

    isLoaded: function () { return loaded; },

    /* Διαγνωστικό — τρέξ' το στην κονσόλα */
    info: function () {
      if (!store) store = read();
      var days = Object.keys(store.d).sort();
      var bytes = 0;
      try { bytes = (localStorage.getItem(KEY) || "").length; } catch (e) {}
      console.log("─── XScanCache ───");
      console.log("  καταγραφές : " + API.count());
      console.log("  ημέρες     : " + days.length
                + (days.length ? " (" + days[0] + " → " + days[days.length - 1] + ")" : ""));
      console.log("  μέλη       : " + Object.keys(store.m).length);
      console.log("  έως        : " + (store.last || "—"));
      console.log("  μέγεθος    : " + Math.round(bytes / 1024) + " KB");
      console.log("  εγγραφή    : " + (canWrite ? "εντάξει" : "ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΗ"));
    },

    /* Καθαρισμός — η επόμενη φόρτωση θα κάνει πλήρη λήψη */
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      store = blank(); loaded = false; canWrite = true;
      console.log("[cache] καθαρίστηκε");
    }
  };

  global.XScanCache = API;

})(window);
