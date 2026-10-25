/* Shared service-location picker. Values remain local until the client sends the enquiry. */
(function () {
  'use strict';
  let leafletPromise;
  let dialog;
  let map;
  let activePicker;
  let lastFocus;
  const centers = {Dubai:[25.2048,55.2708],Sharjah:[25.3463,55.4209],'Abu Dhabi':[24.4539,54.3773],Ajman:[25.4052,55.5136],'Ras Al Khaimah':[25.7895,55.9432],'Umm Al Quwain':[25.5647,55.5552],Fujairah:[25.1288,56.3265]};
  const mapsURL = (lat, lng) => 'https://www.google.com/maps?q=' + Number(lat).toFixed(6) + ',' + Number(lng).toFixed(6);
  function coordinates(value) {
    const match = value.match(/(?:[?&]q=)?(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const pair = [Number(match[1]), Number(match[2])];
    return Math.abs(pair[0]) <= 90 && Math.abs(pair[1]) <= 180 ? pair : null;
  }
  function googleLink(value) {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      if (host === 'maps.app.goo.gl' || host === 'maps.google.com' || ((host === 'google.com' || host === 'www.google.com') && /^\/maps(?:\/|$)/.test(url.pathname))) return url.href;
    } catch (_) { /* A malformed pasted link is reported beside the field. */ }
    return null;
  }
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; css.crossOrigin = '';
      document.head.append(css);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; script.crossOrigin = '';
      const timer = setTimeout(() => fail(), 12000);
      function fail() {clearTimeout(timer);leafletPromise=null;script.remove();css.remove();reject(new Error('map unavailable'));}
      script.onload = () => {clearTimeout(timer);resolve();}; script.onerror = fail;
      document.head.append(script);
    });
    return leafletPromise;
  }
  function makeDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'sl-dialog'; dialog.setAttribute('aria-labelledby','sl-map-title');
    dialog.innerHTML = '<div class="sl-dialog-head"><div><h2 id="sl-map-title">Choose your service location</h2><p>Move or zoom the map, or tap a place. Put the pin on your building or service entrance.</p></div><button class="sl-button sl-close" type="button" aria-label="Close location map">&times;</button></div><div class="sl-map-wrap"><div class="sl-map" id="sl-location-map" aria-label="Service location map. Use arrow keys to move and plus or minus to zoom."></div><div class="sl-map-pin" aria-hidden="true"></div></div><p class="sl-map-note" role="status">Loading map...</p><div class="sl-dialog-footer"><a class="sl-preview" target="_blank" rel="noopener noreferrer" hidden>View this pin in Google Maps</a><button class="sl-button sl-button-primary sl-confirm" type="button" disabled>Use this location</button></div>';
    document.body.append(dialog);
    dialog.querySelector('.sl-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { if (lastFocus && lastFocus.isConnected) lastFocus.focus(); });
    dialog.querySelector('.sl-confirm').addEventListener('click', () => {
      const center = map.getCenter();
      activePicker.set(mapsURL(center.lat, center.lng), 'Map location selected.');
      dialog.close();
    });
  }
  async function chooseMap(picker, button) {
    if (!dialog) makeDialog();
    if (!dialog.showModal) { picker.status.textContent = 'Your browser cannot open the map. Use current location or paste a Google Maps link below.'; picker.fallback.open = true; return; }
    activePicker = picker; lastFocus = button;
    dialog.querySelector('.sl-confirm').disabled = true;
    dialog.querySelector('.sl-preview').hidden = true;
    dialog.querySelector('.sl-map-note').textContent = 'Loading map...';
    dialog.showModal();
    try {
      await loadLeaflet();
      if (!dialog.open) return;
      if (!map) {
        map = L.map('sl-location-map', {scrollWheelZoom:false});
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
        map.on('click', e => map.panTo(e.latlng));
        map.on('moveend', () => {
          const center = map.getCenter();
          dialog.querySelector('.sl-preview').href = mapsURL(center.lat, center.lng);
        });
      }
      const existing = coordinates(picker.input.value);
      const emirate = document.getElementById('emirate');
      map.setView(existing || centers[emirate && emirate.value] || centers.Dubai, existing ? 17 : 12);
      map.invalidateSize();
      const center = map.getCenter();
      const preview = dialog.querySelector('.sl-preview');
      preview.href = mapsURL(center.lat, center.lng); preview.hidden = false;
      dialog.querySelector('.sl-map-note').textContent = 'The pin marks the location that will be added to your enquiry. You can also use arrow keys to move the map.';
      dialog.querySelector('.sl-confirm').disabled = false;
    } catch (_) {
      dialog.querySelector('.sl-map-note').textContent = 'The map could not load. Close this window and use current location, or paste a Google Maps link below.';
      picker.fallback.open = true;
    }
  }
  function enhance(input) {
    if (!input || input.dataset.locationReady) return;
    input.dataset.locationReady = 'true';
    const wrap = input.parentElement;
    const oldLabel = wrap.querySelector('label');
    const required = input.required || input.id === 'coordinates';
    const labelID = input.id + '-location-label';
    input.type = 'hidden';
    wrap.classList.add('sl-picker'); wrap.setAttribute('role','group'); wrap.setAttribute('aria-labelledby',labelID);
    if (oldLabel) oldLabel.remove();
    const ui = document.createElement('div');
    ui.innerHTML = '<span class="sl-label" id="'+labelID+'">Service location'+(required?' *':' (optional)')+'</span><div class="sl-actions"><button class="sl-button sl-button-primary sl-choose" type="button">Choose on map</button><button class="sl-button sl-current" type="button">Use current location</button></div><p class="sl-help">Choose a pin or allow your browser to find your location. A Google Maps link will be included when you send your enquiry.</p><p class="sl-status" role="status" aria-live="polite"></p><div class="sl-selected" hidden><span class="sl-selection-text"></span> <a target="_blank" rel="noopener noreferrer">View in Google Maps</a><button class="sl-clear" type="button">Clear location</button></div><details class="sl-fallback"><summary>Already have a Google Maps link?</summary><label for="'+input.id+'-map-link">Paste your Google Maps link</label><input id="'+input.id+'-map-link" type="url" placeholder="https://maps.app.goo.gl/..." maxlength="500"><button class="sl-button sl-paste" type="button">Use this link</button></details>';
    wrap.append(ui);
    let request = 0;
    const status = ui.querySelector('.sl-status');
    const selected = ui.querySelector('.sl-selected');
    const current = ui.querySelector('.sl-current');
    const fallback = ui.querySelector('.sl-fallback');
    const picker = {input,status,fallback,set(value,description) {
      request++; current.disabled = false; current.textContent = 'Use current location';
      input.value = value; input.classList.remove('field-error'); wrap.removeAttribute('aria-invalid');
      selected.hidden = !value;
      if (value) {
        ui.querySelector('.sl-selection-text').textContent = description;
        selected.querySelector('a').href = googleLink(value) || mapsURL(...coordinates(value));
      }
      status.textContent = ''; status.classList.remove('sl-error');
      input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
    }};
    ui.querySelector('.sl-choose').addEventListener('click', e => chooseMap(picker,e.currentTarget));
    ui.querySelector('.sl-clear').addEventListener('click', () => {picker.set('','');ui.querySelector('.sl-fallback input').value='';ui.querySelector('.sl-choose').focus();});
    current.addEventListener('click', () => {
      if (!navigator.geolocation || !window.isSecureContext) { status.textContent = 'Current location is unavailable in this browser. Choose on map or paste a Google Maps link.'; return; }
      const ticket = ++request;
      current.disabled = true; current.textContent = 'Finding your location...'; status.textContent = 'Allow location access if your browser asks. This may take a few seconds.';
      navigator.geolocation.getCurrentPosition(position => {
        if (ticket !== request || !input.isConnected) return;
        const {latitude,longitude,accuracy} = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { current.disabled=false;current.textContent='Use current location';status.textContent='Your location could not be found. Please choose it on the map.';return; }
        picker.set(mapsURL(latitude,longitude),'Current location selected.');
        status.textContent = accuracy > 100 ? 'Your device returned an approximate location. Choose on map to adjust the pin to your building.' : 'Please check the pin in Google Maps and add your building and unit details.';
      }, error => {
        if (ticket !== request || !input.isConnected) return;
        current.disabled = false; current.textContent = 'Use current location'; status.classList.add('sl-error');
        status.textContent = error.code === 1 ? 'Location access was not allowed. Choose on map instead, or enable location access in your browser.' : 'Your current location could not be found. Try again or choose on map.';
      }, {enableHighAccuracy:true,timeout:15000,maximumAge:60000});
    });
    const pasted = ui.querySelector('.sl-fallback input');
    function usePastedLink() {
      const link = googleLink(pasted.value.trim());
      if (!link) {status.textContent='Please paste a valid HTTPS Google Maps link.';status.classList.add('sl-error');pasted.focus();return;}
      picker.set(link,'Google Maps location selected.'); fallback.open=false;
    }
    ui.querySelector('.sl-paste').addEventListener('click',usePastedLink);
    pasted.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();usePastedLink();}});
    // Include a valid pasted link even if a client goes straight to Review.
    if (input.form) input.form.addEventListener('submit', e => {
      if (pasted.value.trim() && !fallback.open) return;
      if (pasted.value.trim()) { if (!googleLink(pasted.value.trim())) {e.preventDefault();e.stopImmediatePropagation();status.textContent='Please use a valid Google Maps link, or choose on map.';fallback.open=true;pasted.focus();} else picker.set(googleLink(pasted.value.trim()),'Google Maps location selected.'); }
    },true);
    if (input.value && (googleLink(input.value) || coordinates(input.value))) picker.set(input.value,'Location selected.');
    if (input.form) input.form.addEventListener('reset',()=>{request++;setTimeout(()=>{if(input.isConnected)picker.set(input.defaultValue||'','Location selected.');},0);});
  }
  function scan() { ['maps','coordinates'].forEach(id=>enhance(document.getElementById(id))); }
  scan();
  // The home-page basket recreates its address fields when items change.
  const cartBottom = document.getElementById('cartBottom');
  if (cartBottom) new MutationObserver(scan).observe(cartBottom,{childList:true,subtree:true});
})();
