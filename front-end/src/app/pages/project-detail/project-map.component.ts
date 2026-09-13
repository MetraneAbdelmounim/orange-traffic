import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup, ScaleControl } from 'maplibre-gl';
import { controllerUiUrl, hasCoordinates, modemUiUrl, streetViewUrl } from '../../core/controller-links';
import { ThemeService } from '../../core/services/theme.service';
import { Controller } from '../../models/controller';

/**
 * Free, keyless vector tiles — same source as project-youness's station map.
 * Vector rather than raster because the 3D view extrudes real building
 * footprints; a raster tile is a flat image and cannot be tilted meaningfully.
 */
const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const TILT_PITCH = 55;
const DEFAULT_BEARING = -15;
const STREET_ZOOM = 17;

// Small inline icons for the popup's quick-access links — the popup is raw
// HTML set via `.setHTML()`, not an Angular template, so these are plain
// SVG strings rather than the [innerHTML] | safeHtml pattern used elsewhere.
const POPUP_ICON = {
  streetView: `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>`,
  device: `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"/></svg>`,
  modem: `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"/></svg>`,
};

/**
 * Map + controller list, in one component — same pairing as project-youness's
 * `station-map.component` (map left, list right on desktop, stacked on
 * mobile), extended with two-way selection: picking a controller in the list
 * flies the map to its marker and opens its popup, and clicking a marker
 * highlights the matching row in the list. Neither direction existed in the
 * reference component (it only does list → map), so this is new behaviour,
 * not a straight port.
 */
@Component({
  selector: 'app-project-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div class="flex items-center gap-2 text-sm text-ink-secondary">
          <span class="chip chip-good"><span class="chip-dot"></span>OK</span>
          <span class="chip chip-crit"><span class="chip-dot"></span>Alarme</span>
          <span class="chip chip-neutral"><span class="chip-dot"></span>Injoignable</span>
          @if (unlocatedCount() > 0) {
            <span class="text-xs text-ink-muted">· {{ unlocatedCount() }} sans coordonnées</span>
          }
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-ghost" (click)="fitToControllers()">Recentrer</button>
          <button type="button" class="btn btn-ghost" (click)="toggleTilt()">{{ tilted ? 'Vue 2D' : 'Vue 3D' }}</button>
        </div>
      </div>

      @if (controllers.length === 0) {
        <div class="p-12 text-center text-sm text-ink-muted">Aucun contrôleur dans ce projet.</div>
      } @else {
        <div class="grid gap-4 p-4 lg:grid-cols-[1fr_20rem]">
          <div class="overflow-hidden rounded-lg border border-line">
            @if (located().length === 0) {
              <div class="flex h-[60vh] items-center justify-center p-12 text-center text-sm text-ink-muted">
                Aucun contrôleur de ce projet n'a de coordonnées valides — renseignez latitude/longitude pour les faire apparaître ici.
              </div>
            } @else {
              <div #mapContainer class="h-[60vh] w-full"></div>
            }
          </div>

          <aside class="card flex max-h-[60vh] flex-col overflow-hidden">
            <div class="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Contrôleurs ({{ controllers.length }})
            </div>
            <ul class="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
              @for (c of controllers; track c._id) {
                <li>
                  <button
                    type="button"
                    class="controller-row flex w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-surface-hover"
                    [class.is-selected]="selectedId() === c._id"
                    (click)="selectController(c)"
                  >
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-medium text-ink">{{ c.nom }}</span>
                      <span class="block font-mono text-xs text-ink-muted">{{ c.ip }}</span>
                    </span>
                    <span
                      class="h-2 w-2 flex-none rounded-full"
                      [style.background-color]="!c.status ? 'var(--neutral)' : c.lastSnapshot.activeFlags.length ? 'var(--crit)' : 'var(--good)'"
                    ></span>
                  </button>
                </li>
              }
            </ul>
          </aside>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .controller-row.is-selected {
        background-color: var(--surface-hover);
        box-shadow: inset 3px 0 0 var(--brand);
      }
    `,
  ],
})
export class ProjectMapComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) controllers: Controller[] = [];

  @ViewChild('mapContainer')
  set mapContainer(ref: ElementRef<HTMLDivElement> | undefined) {
    this.container = ref?.nativeElement;
    if (this.container && !this.map) this.initMap();
  }

  private theme = inject(ThemeService);
  private router = inject(Router);

  tilted = true;
  selectedId = signal<string | null>(null);
  private map?: MapLibreMap;
  private container?: HTMLDivElement;
  private markers = new Map<string, Marker>();

  private isLocated(c: Controller): boolean {
    return hasCoordinates(c);
  }

  /** Controllers that carry real coordinates — (0,0) is the schema default for "not set". */
  located(): Controller[] {
    return this.controllers.filter((c) => this.isLocated(c));
  }

  unlocatedCount(): number {
    return this.controllers.length - this.located().length;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['controllers'] && this.map) this.syncMarkers();
  }

  ngOnDestroy(): void {
    this.markers.forEach((m) => m.remove());
    this.map?.remove();
  }

  private initMap(): void {
    const located = this.located();
    if (!located.length || !this.container) return;

    this.map = new MapLibreMap({
      container: this.container,
      style: MAP_STYLES[this.theme.choice() === 'dark' ? 'dark' : 'light'],
      pitch: TILT_PITCH,
      bearing: DEFAULT_BEARING,
      attributionControl: { compact: true },
    });

    this.map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    this.map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    this.syncMarkers();

    this.map.on('load', () => {
      this.map!.resize();
      this.fitToControllers();
      this.ensureBuildings();
    });
    this.map.on('styledata', () => this.ensureBuildings());
  }

  private ensureBuildings(): void {
    const map = this.map;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('building-3d') || map.getLayer('ot-buildings')) return;
    if (!map.getSource('openmaptiles')) return;

    map.addLayer({
      id: 'ot-buildings',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#c9beb2',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.6,
      },
    });
  }

  /** One marker per distinct coordinate — several controllers can share an intersection. */
  private groups(): { key: string; lat: number; lon: number; controllers: Controller[] }[] {
    const byPoint = new Map<string, { key: string; lat: number; lon: number; controllers: Controller[] }>();
    for (const c of this.located()) {
      const key = `${c.latitude},${c.longitude}`;
      const group = byPoint.get(key);
      if (group) group.controllers.push(c);
      else byPoint.set(key, { key, lat: c.latitude, lon: c.longitude, controllers: [c] });
    }
    return [...byPoint.values()];
  }

  private syncMarkers(): void {
    if (!this.map) return;
    const seen = new Set<string>();

    for (const group of this.groups()) {
      seen.add(group.key);
      const existing = this.markers.get(group.key);
      const element = existing?.getElement() ?? this.createPin();
      this.paintPin(element, group.controllers);

      if (existing) {
        existing.setLngLat([group.lon, group.lat]);
        existing.getPopup()?.setHTML(this.popupHtml(group.controllers));
        continue;
      }

      const popup = new Popup({ offset: 18, closeButton: true, maxWidth: '280px' }).setHTML(this.popupHtml(group.controllers));
      popup.on('open', () => this.wirePopupSelection(popup));

      const marker = new Marker({ element, anchor: 'center' }).setLngLat([group.lon, group.lat]).setPopup(popup).addTo(this.map);
      this.markers.set(group.key, marker);

      // Highlight + fly-to only — MapLibre's own Marker/Popup binding already
      // toggles this popup on the same click (it listens on the map, not the
      // element, so it isn't visible here); calling selectController's own
      // togglePopup too would double-toggle and cancel the open back out.
      element.addEventListener('click', () => {
        if (group.controllers.length === 1) this.focusOnControllerLocation(group.controllers[0]);
      });
    }

    for (const [key, marker] of this.markers) {
      if (!seen.has(key)) {
        marker.remove();
        this.markers.delete(key);
      }
    }

    this.refreshSelectionHighlight();
  }

  private createPin(): HTMLElement {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'map-pin';
    return pin;
  }

  private paintPin(element: HTMLElement, controllers: Controller[]): void {
    const alarmed = controllers.filter((c) => c.status && c.lastSnapshot.activeFlags.length > 0).length;
    const offline = controllers.filter((c) => !c.status).length;
    element.classList.toggle('is-crit', alarmed > 0);
    element.classList.toggle('is-down', alarmed === 0 && offline > 0);
    element.classList.toggle('is-group', controllers.length > 1);
    element.textContent = controllers.length > 1 ? String(controllers.length) : '';
    element.title = controllers.length === 1 ? `${controllers[0].nom} (${controllers[0].ip})` : `${controllers.length} contrôleurs ici`;
    element.setAttribute('aria-label', element.title);
  }

  /** Highlights the marker(s) matching the currently selected controller, if any. */
  private refreshSelectionHighlight(): void {
    const id = this.selectedId();
    for (const group of this.groups()) {
      const el = this.markers.get(group.key)?.getElement();
      if (!el) continue;
      el.classList.toggle('is-selected', group.controllers.some((c) => c._id === id));
    }
  }

  private escape(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  }

  private popupHtml(controllers: Controller[]): string {
    const row = (c: Controller) => {
      const alarmed = c.status && c.lastSnapshot.activeFlags.length > 0;
      const state = !c.status ? 'is-down' : alarmed ? 'is-crit' : 'is-up';
      const label = !c.status ? 'Injoignable' : alarmed ? `${c.lastSnapshot.activeFlags.length} alarme(s)` : 'OK';
      const id = this.escape(c._id);
      const links = [
        hasCoordinates(c)
          ? `<a class="map-popup-link" href="${this.escape(streetViewUrl(c))}" target="_blank" rel="noopener">${POPUP_ICON.streetView}Street View</a>`
          : '',
        `<a class="map-popup-link" href="${this.escape(controllerUiUrl(c))}" target="_blank" rel="noopener">${POPUP_ICON.device}Contrôleur</a>`,
        `<a class="map-popup-link" href="${this.escape(modemUiUrl(c))}" target="_blank" rel="noopener">${POPUP_ICON.modem}Modem</a>`,
      ]
        .filter(Boolean)
        .join('');
      return `
        <li class="map-popup-item" data-id="${id}">
          <span class="map-popup-state ${state}"></span>
          <span class="map-popup-name">
            <a data-nav-id="${id}" href="/controllers/${id}">${this.escape(c.nom)}</a>
            <span class="map-popup-ip">${this.escape(c.ip)}</span>
            <span class="map-popup-links">${links}</span>
          </span>
          <span class="map-popup-note">${label}</span>
        </li>`;
    };

    const header =
      controllers.length === 1
        ? `<p class="map-popup-title">${this.escape(controllers[0].nom)}</p>`
        : `<p class="map-popup-title">${controllers.length} contrôleurs à cet emplacement</p>`;

    return `<div class="map-popup">${header}<ul class="map-popup-list">${controllers.map(row).join('')}</ul></div>`;
  }

  /**
   * A click inside a popup either selects the controller (row body) or opens
   * its full detail page (the name link) — delegated on the popup's root
   * element, wired once per popup instance (guarded via `dataset.wired`)
   * since `setHTML` rewrites the inner markup without recreating the element.
   */
  private wirePopupSelection(popup: Popup): void {
    const el = popup.getElement();
    if (!el || el.dataset['wired']) return;
    el.dataset['wired'] = '1';
    el.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      const link = target.closest<HTMLElement>('a[data-nav-id]');
      if (link) {
        ev.preventDefault();
        const id = link.getAttribute('data-nav-id');
        if (id) this.router.navigate(['/controllers', id]);
        return;
      }
      // Any other link (Street View, the device's own UI) opens in a new tab
      // on its own — it must not also trigger row selection underneath it.
      if (target.closest('a')) return;
      const row = target.closest<HTMLElement>('[data-id]');
      const controller = row && this.controllers.find((c) => c._id === row.getAttribute('data-id'));
      if (controller) this.selectController(controller);
    });
  }

  fitToControllers(): void {
    const located = this.located();
    if (!this.map || !located.length) return;

    const bounds = located.reduce(
      (acc, c) => acc.extend([c.longitude, c.latitude]),
      new LngLatBounds([located[0].longitude, located[0].latitude], [located[0].longitude, located[0].latitude])
    );
    this.map.fitBounds(bounds, {
      padding: 80,
      maxZoom: STREET_ZOOM,
      duration: 800,
      pitch: this.tilted ? TILT_PITCH : 0,
      bearing: DEFAULT_BEARING,
    });
  }

  toggleTilt(): void {
    this.tilted = !this.tilted;
    this.map?.easeTo({ pitch: this.tilted ? TILT_PITCH : 0, duration: 600 });
  }

  /** Highlights `c` in the list and, if it has real coordinates, flies the map to its marker — without touching any popup. */
  private focusOnControllerLocation(c: Controller): void {
    this.selectedId.set(c._id);
    this.refreshSelectionHighlight();

    if (!this.map || !this.isLocated(c)) return;

    this.map.flyTo({
      center: [c.longitude, c.latitude],
      zoom: STREET_ZOOM,
      pitch: this.tilted ? TILT_PITCH : 0,
      bearing: DEFAULT_BEARING,
      duration: 800,
    });
  }

  /**
   * Selecting a controller from the list (or from a popup row) highlights it
   * and flies the map to its marker, explicitly opening the popup — unlike a
   * direct marker click, nothing else on the map already does that here.
   */
  selectController(c: Controller): void {
    this.focusOnControllerLocation(c);
    if (!this.map || !this.isLocated(c)) return;

    const marker = this.markers.get(`${c.latitude},${c.longitude}`);
    if (marker && !marker.getPopup()?.isOpen()) marker.togglePopup();
  }
}
