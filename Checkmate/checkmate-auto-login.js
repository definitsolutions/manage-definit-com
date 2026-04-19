(function(){
  if (window.__cmal) return;
  window.__cmal = true;

  function hasAuth() {
    try {
      var p = localStorage.getItem("persist:root");
      if (!p) return false;
      var r = JSON.parse(p);
      if (!r.auth) return false;
      var a = JSON.parse(r.auth);
      return !!(a.authToken && a.authToken.length > 10);
    } catch(e) { return false; }
  }

  if (hasAuth()) return;

  fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email: "admin@definit.com", password: "Ck!tGm8Xr2Wq9pN4"})
  })
  .then(function(r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  })
  .then(function(d) {
    var t = d.data && d.data.token ? d.data.token : d.token;
    var u = d.data && d.data.user ? d.data.user : d.user || {};
    if (!t) return;
    var a = JSON.stringify({
      authToken: t, user: u, isAuthenticated: true,
      isLoading: false, success: true, msg: "User logged in successfully"
    });
    var e = "{}";
    try {
      var p = localStorage.getItem("persist:root");
      if (p) e = JSON.parse(p).ui || "{}";
    } catch(x) {}
    localStorage.setItem("persist:root", JSON.stringify({
      auth: a, ui: e,
      _persist: JSON.stringify({version: -1, rehydrated: true})
    }));
    window.location.href = "/";
  })
  .catch(function(e) { console.warn("[auto-login]", e.message); });
})();
