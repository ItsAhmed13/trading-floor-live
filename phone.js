/* Phone build: fetch the encrypted data and decrypt it with the key from the
   link (the part after #k=). The key never leaves the phone: browsers do not send
   the '#' part to any server. It is also kept in this browser so a bookmark
   without the key still opens. */
(function () {
  "use strict";
  function bytes(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }
  function keyText() {
    const m = /[#&]k=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (m) {
      try { localStorage.setItem("floor-key", m[1]); } catch (_) { /* storage optional */ }
      return m[1];
    }
    try { return localStorage.getItem("floor-key"); } catch (_) { return null; }
  }
  window.FLOOR_LOADER = async function () {
    const k = keyText();
    if (!k) throw new Error("This link is missing its key (the part after #k=).");
    const res = await fetch("data.enc.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("No data published yet.");
    const env = await res.json();
    const ck = await crypto.subtle.importKey("raw", bytes(k), "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(env.iv) }, ck, bytes(env.ct));
    window.FLOOR = JSON.parse(new TextDecoder().decode(plain));
    return window.FLOOR;
  };
})();
