/* ═══════════════════════════════════════════════════════════════════════
   X-GYM · XScanCache v1.1 — κοινό cache ιστορικού σκαναρισμάτων
   ───────────────────────────────────────────────────────────────────────
   ΝΕΟ ΣΤΗ v1.1
     Η loadStatsHistory και η xsyLoad καλούν ταυτόχρονα το load().
     Καμία δεν είχε τελειώσει όταν ξεκινούσε η άλλη, οπότε κατέβαζαν
     ΚΑΙ ΟΙ ΔΥΟ τα ίδια δεδομένα (διπλά reads, διπλή αίτηση).

     Τώρα η δεύτερη κλήση επιστρέφει την ίδια Promise με την πρώτη.

   ΑΝΤΙΚΑΤΑΣΤΑΣΗ: ολόκληρο το scancache.js στη ρίζα του repo
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
  "use strict";

  var KEY = "xsc:v1";
  var COL = "xgym_scans";

  var store = null;
  var loaded = false;
  var canWrite = true;
  var pending = null;        /* ✅ η Promise που τρέχει αυτή τη στιγμή */

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

  function put(data) {
    var dk = String(data.dateKey || "").slice(0, 10);
    if (dk.length !== 10) return false;

    var id = String(data.id || "").trim();
    if (!id) return false;

    var time = String(data.time || "");
    var per  = String(data.period || "");

    if (!store.d[dk]) store.d[dk] = [];

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


  var API = {

    load: function (db) {
      /* ✅ Ήδη τρέχει — δώσε την ίδια Promise αντί για δεύτερο κατέβασμα */
      if (pending) return pending;

      store = read();
      var tKey = todayKey();
      var yKey = yesterdayKey();
      var t0 = Date.now();

      /* ενήμερο — μηδέν reads, τίποτα ασύγχρονο */
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

      pending = q.then(function (snap) {
        var added = 0;
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          if (String(d.dateKey || "").slice(0, 10) >= tKey) return;
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
        loaded = true;
        return API;

      }).then(function (r) {
        pending = null;          /* ✅ ελευθέρωσε για μελλοντικές κλήσεις */
        return r;
      });

      return pending;
    },

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
      console.log("  σε εξέλιξη : " + (pending ? "ναι" : "όχι"));
    },

    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      store = blank(); loaded = false; canWrite = true; pending = null;
      console.log("[cache] καθαρίστηκε");
    }
  };

  global.XScanCache = API;

})(window);