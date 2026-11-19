import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as topojson from 'topojson-client';
import L from 'leaflet';

export default function LiveMap({ data, showQr, theme }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const countryLayerRef = useRef(null);
  const dotLayerRef = useRef(null);
  const arcLayerRef = useRef(null);
  const fxLayerRef = useRef(null);
  const venueMarkerRef = useRef(null);
  const prevCountsRef = useRef(new Map());
  const [tickerMessage, setTickerMessage] = useState(null);

  const cities = data?.cities || [];
  const venue = data?.venue || null;
  const answerUrl = `${window.location.origin}/q/${data?.id}`;
  const displayUrl = answerUrl.replace(/^https?:\/\//, '');

  const arcPoints = useCallback((a, b) => {
    const p0 = [a.lat, a.lon], p2 = [b.lat, b.lon];
    const dx = p2[1] - p0[1], dy = p2[0] - p0[0];
    const mid = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
    const k = 0.22;
    const p1 = [mid[0] + dx * k, mid[1] - dy * k];
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, u = 1 - t;
      pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    return pts;
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      worldCopyJump: false,
      maxBounds: [[-75, -200], [85, 200]],
      maxBoundsViscosity: 0.8,
      fadeAnimation: true
    }).setView([22, 80], 4);

    map.attributionControl.setPrefix('');
    map.attributionControl.addAttribution('Cities: GeoNames · Borders: Natural Earth (India view)');

    const countryLayer = L.geoJSON(null, {
      interactive: false,
      style: () => ({
        className: 'country',
        fillColor: theme === 'light' ? '#ffffff' : '#1d1940',
        fillOpacity: 1,
        color: theme === 'light' ? '#c9cfda' : '#3a3470',
        weight: 0.8
      })
    }).addTo(map);

    const arcLayer = L.layerGroup().addTo(map);
    const dotLayer = L.layerGroup().addTo(map);
    const fxLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    countryLayerRef.current = countryLayer;
    arcLayerRef.current = arcLayer;
    dotLayerRef.current = dotLayer;
    fxLayerRef.current = fxLayer;

    // Load TopoJSON countries
    fetch('/geo/countries.json')
      .then(r => r.json())
      .then(topo => {
        if (!topo.objects?.countries) return;
        const fc = topojson.feature(topo, topo.objects.countries);
        countryLayer.addData(fc);
        countryLayer.eachLayer(l => {
          if (l.feature?.properties) {
            l.feature.properties.cc = l.feature.properties.ISO_A2;
          }
        });
      })
      .catch(() => {});

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Map Layers & Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !data) return;

    const dotLayer = dotLayerRef.current;
    const arcLayer = arcLayerRef.current;
    const fxLayer = fxLayerRef.current;
    const countryLayer = countryLayerRef.current;

    dotLayer.clearLayers();
    arcLayer.clearLayers();

    const topColor = theme === 'light' ? '#5b3df5' : '#ffd166';
    const dotColor = theme === 'light' ? '#e8417a' : '#ff5c8a';
    const arcColor = theme === 'light' ? '#5b3df5' : '#ffd166';

    // Highlight countries that have participants
    if (countryLayer) {
      const activeCcs = new Set(cities.map(c => c.cc));
      countryLayer.eachLayer(l => {
        const cc = l.feature?.properties?.cc;
        const isHot = activeCcs.has(cc);
        l.setStyle({
          fillColor: isHot
            ? (theme === 'light' ? '#ece7ff' : '#2f2672')
            : (theme === 'light' ? '#ffffff' : '#1d1940'),
          fillOpacity: 1,
          color: theme === 'light' ? '#c9cfda' : '#3a3470',
          weight: 0.8
        });
      });
    }

    // Venue & Arcs
    if (venue) {
      for (const c of cities) {
        if (c.km < 15) continue;
        L.polyline(arcPoints(c, venue), {
          className: 'arc',
          color: arcColor,
          weight: 1.2 + Math.min(3, Math.sqrt(c.count)),
          opacity: 0.55,
          interactive: false
        }).addTo(arcLayer);
      }

      if (!venueMarkerRef.current) {
        venueMarkerRef.current = L.marker([venue.lat, venue.lon], { interactive: false, zIndexOffset: 1000 }).addTo(fxLayer);
      }
      venueMarkerRef.current.setLatLng([venue.lat, venue.lon]);
      const venueHasDot = cities.some(c => c.km < 15);
      const vname = venueHasDot ? '' : String(venue.name || '');
      venueMarkerRef.current.setIcon(L.divIcon({
        className: '',
        html: `<div class="venue" style="display:flex;align-items:center;gap:6px;transform:translate(-13px,-15px);white-space:nowrap">
          <div style="width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:${topColor};color:#17151f;font-size:15px;box-shadow:0 0 16px ${topColor}">★</div>
          ${vname ? `<div style="background:var(--panel);border:1px solid var(--panel-line);color:var(--fg);font-weight:800;font-size:15px;padding:3px 10px;border-radius:10px">${vname}</div>` : ''}
        </div>`,
        iconSize: [0, 0]
      }));
    } else if (venueMarkerRef.current) {
      fxLayer.removeLayer(venueMarkerRef.current);
      venueMarkerRef.current = null;
    }

    // Render City Dots
    const max = cities[0]?.count || 1;
    [...cities].reverse().forEach((c) => {
      const rank = cities.indexOf(c);
      const r = 5 + 17 * Math.sqrt(c.count / max);
      const isTop = rank === 0;

      const m = L.circleMarker([c.lat, c.lon], {
        radius: r,
        color: '#fff',
        weight: 1.5,
        opacity: 0.9,
        fillColor: isTop ? topColor : dotColor,
        fillOpacity: 0.9,
        interactive: false
      }).addTo(dotLayer);

      if (rank < 25) {
        m.bindTooltip(`<span>${venue && c.km < 15 ? '★ ' : ''}${c.name} <b>${c.count}</b></span>`, {
          permanent: true,
          direction: 'right',
          offset: [r + 2, 0],
          className: 'lbl'
        });
      }
    });

    // Pulse & Ticker for new arrivals
    const prevCounts = prevCountsRef.current;
    if (prevCounts.size > 0) {
      const fresh = cities.filter(c => c.count > (prevCounts.get(c.id) || 0)).sort((a, b) => (b.last || 0) - (a.last || 0));
      for (const c of fresh.slice(0, 4)) {
        const pm = L.marker([c.lat, c.lon], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:3px solid ${topColor};animation:pulse 2s ease-out forwards"></div>`,
            iconSize: [0, 0]
          }),
          interactive: false
        }).addTo(fxLayer);
        setTimeout(() => fxLayer.removeLayer(pm), 2300);
      }

      if (fresh.length > 0) {
        const arrival = fresh[0];
        setTickerMessage(`📍 Someone just joined from ${arrival.name}${arrival.cc !== (venue?.cc || 'IN') ? ', ' + arrival.country : ''}${venue && arrival.km > 15 ? ` · ${arrival.km.toLocaleString('en-IN')} km away` : ''}`);
        const timer = setTimeout(() => setTickerMessage(null), 3500);
        return () => clearTimeout(timer);
      }
    }
    prevCountsRef.current = new Map(cities.map(c => [c.id, c.count]));

    // Auto-fit bounds
    if (cities.length > 0) {
      const pts = cities.map(c => [c.lat, c.lon]);
      if (venue) pts.push([venue.lat, venue.lon]);
      if (pts.length === 1) {
        map.flyTo(pts[0], 5.5, { duration: 1.2 });
      } else {
        map.flyToBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 6.5, duration: 1.4 });
      }
    }
  }, [cities, venue, theme, arcPoints]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      {/* Leaflet Map Target */}
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, background: 'var(--sea)' }} />

      {/* Top Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '3vh 3vw 6vh',
        pointerEvents: 'none',
        zIndex: 500,
        background: 'linear-gradient(180deg, var(--sea) 0%, transparent 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '2vw'
      }}>
        <h1 style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 'clamp(24px, 3.8vw, 60px)',
          lineHeight: 1.08,
          letterSpacing: '-0.025em',
          margin: 0,
          maxWidth: '70%'
        }}>
          {data?.question}
        </h1>
        <span style={{
          pointerEvents: 'auto',
          flex: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: 'clamp(12px, 1.1vw, 16px)',
          padding: '7px 14px',
          borderRadius: '999px',
          background: 'var(--panel)',
          border: '1px solid var(--panel-line)'
        }}>
          <span className="dot" style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: data?.open ? '#ff4d6d' : '#999',
            boxShadow: data?.open ? '0 0 0 4px rgba(255,77,109,.2)' : 'none'
          }} />
          <span>{data?.open ? 'Live' : 'Answers closed'}</span>
        </span>
      </div>

      {/* Side Stats Panel */}
      {cities.length > 0 && (
        <div style={{
          position: 'fixed',
          right: '2.4vw',
          top: '50%',
          transform: 'translateY(-46%)',
          width: 'clamp(240px, 21vw, 380px)',
          zIndex: 500,
          background: 'var(--panel)',
          border: '1px solid var(--panel-line)',
          borderRadius: '20px',
          padding: '18px 18px 12px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
            <div style={{ textAlign: 'center' }}>
              <b style={{ display: 'block', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 'clamp(22px, 2.4vw, 40px)', lineHeight: 1 }}>
                {(data?.participants || 0).toLocaleString('en-IN')}
              </b>
              <span style={{ color: 'var(--fg2)', fontSize: 'clamp(11px, .85vw, 14px)', fontWeight: 700 }}>people</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <b style={{ display: 'block', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 'clamp(22px, 2.4vw, 40px)', lineHeight: 1 }}>
                {cities.length.toLocaleString('en-IN')}
              </b>
              <span style={{ color: 'var(--fg2)', fontSize: 'clamp(11px, .85vw, 14px)', fontWeight: 700 }}>cities</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <b style={{ display: 'block', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 'clamp(22px, 2.4vw, 40px)', lineHeight: 1 }}>
                {(data?.countries || 0).toLocaleString('en-IN')}
              </b>
              <span style={{ color: 'var(--fg2)', fontSize: 'clamp(11px, .85vw, 14px)', fontWeight: 700 }}>countries</span>
            </div>
          </div>

          {venue && (
            <div style={{ borderTop: '1px solid var(--panel-line)', paddingTop: '12px', marginBottom: '12px', display: 'grid', gap: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>Travelled in total</span>
                <b style={{ fontWeight: 800 }}>{(data?.totalKm || 0).toLocaleString('en-IN')} km</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>Farthest</span>
                <b style={{ fontWeight: 800 }}>{data?.farthest ? `${data.farthest.name} · ${data.farthest.km.toLocaleString('en-IN')} km` : '–'}</b>
              </div>
            </div>
          )}

          <div style={{ color: 'var(--fg2)', fontSize: '12px', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', borderTop: '1px solid var(--panel-line)', paddingTop: '12px', marginBottom: '6px' }}>
            Top cities
          </div>
          <div style={{ display: 'grid', gap: '4px' }}>
            {cities.slice(0, 8).map((c, i) => (
              <div key={c.id || i} style={{ display: 'grid', gridTemplateColumns: '1.6em 1fr auto', gap: '8px', alignItems: 'center', padding: '4px 0', fontSize: '13.5px', fontWeight: 700 }}>
                <i style={{
                  fontStyle: 'normal',
                  width: '1.5em',
                  height: '1.5em',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '.75em',
                  background: i === 0 ? '#ffd166' : i === 1 ? '#d9dce3' : i === 2 ? '#f0a86b' : 'var(--panel-line)',
                  color: '#17151f'
                }}>
                  {i + 1}
                </i>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name} <small style={{ color: 'var(--fg2)', fontWeight: 600 }}>{c.state || c.country}</small>
                </span>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini QR Card in Corner */}
      {showQr && cities.length > 0 && (
        <div style={{
          position: 'fixed',
          left: '2.4vw',
          bottom: '3vh',
          zIndex: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          background: 'var(--panel)',
          border: '1px solid var(--panel-line)',
          borderRadius: '18px',
          padding: '10px 18px 10px 10px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ width: 'clamp(84px, 11vh, 150px)', aspectRatio: '1', background: '#fff', borderRadius: '12px', padding: '6px' }}>
            <img src={`/api/questions/${data?.id}/qr.svg`} alt="QR code" style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontFamily: 'var(--display)', fontSize: 'clamp(16px, 1.6vw, 26px)' }}>Scan to add your city</div>
            <div style={{ color: 'var(--fg2)', fontWeight: 600, fontSize: 'clamp(12px, 1.1vw, 18px)' }}>{displayUrl}</div>
          </div>
        </div>
      )}

      {/* Empty State when no answers yet */}
      {cities.length === 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 550, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', textAlign: 'center', background: 'var(--panel)', border: '1px solid var(--panel-line)', borderRadius: '26px', padding: '28px 34px', backdropFilter: 'blur(10px)' }}>
            <div style={{ width: 'min(42vh, 36vw)', aspectRatio: '1', background: '#fff', borderRadius: '18px', padding: '12px', margin: '0 auto' }}>
              <img src={`/api/questions/${data?.id}/qr.svg`} alt="QR code" style={{ width: '100%', height: '100%', display: 'block' }} />
            </div>
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 38px)', marginTop: '2.4vh' }}>Where are you from?</h2>
            <p style={{ color: 'var(--fg2)', margin: '6px 0 0', fontSize: 'clamp(14px, 1.3vw, 20px)', fontWeight: 600 }}>Scan to put your city on the map</p>
            <p style={{ fontSize: 'clamp(12px, 1vw, 16px)', color: 'var(--fg2)', marginTop: '4px' }}>{displayUrl}</p>
          </div>
        </div>
      )}

      {/* Arrival Ticker Banner */}
      {tickerMessage && (
        <div style={{
          position: 'fixed',
          left: '50%',
          bottom: '3.4vh',
          transform: 'translateX(-50%)',
          zIndex: 600,
          background: 'var(--panel)',
          border: '1px solid var(--panel-line)',
          padding: '10px 18px',
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: 'clamp(13px, 1.2vw, 20px)',
          backdropFilter: 'blur(10px)',
          whiteSpace: 'nowrap',
          animation: 'fadeIn .3s ease'
        }}>
          {tickerMessage}
        </div>
      )}
    </div>
  );
}
