import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  APIProvider,
  Map as GoogleMapView,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Search,
  Building2,
  Video,
  Star,
  CheckCircle2,
  LocateFixed,
  ExternalLink,
  Phone,
  Loader2,
  AlertCircle,
  Navigation,
  Hospital,
} from 'lucide-react';
import { SupportedLanguage } from '../types/healthcare';

export interface SelectedHospitalSelection {
  locationLabel: string;
  hospitalPlaceId: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalMapsUri?: string;
  primaryTypeLabel?: string;
  rating?: number | null;
  phone?: string | null;
  distanceLabel?: string;
  nextAvailableSlot?: string;
  isVirtual?: boolean;
}

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface DiscoveredClinic {
  placeId: string;
  name: string;
  address: string;
  typeLabel: string;
  location: LatLngPoint;
  rating: number | null;
  userRatingCount: number | null;
  businessStatus?: string;
  phone: string | null;
  mapsUri?: string;
  distanceKm: number;
  distanceLabel: string;
  attributions?: Array<{ provider: string | null; providerURI?: string | null }>;
}

interface LocationPreset {
  id: string;
  label: string;
  subtitle: string;
  center: LatLngPoint;
}

type FacilityFilter = 'all' | 'hospital' | 'clinic' | 'doctor';

const LOCATION_PRESETS: LocationPreset[] = [
  {
    id: 'hanamkonda',
    label: 'Hanamkonda',
    subtitle: 'Hanamkonda, Telangana',
    center: { lat: 18.0005, lng: 79.5553 },
  },
  {
    id: 'warangal',
    label: 'Warangal',
    subtitle: 'Warangal, Telangana',
    center: { lat: 17.9689, lng: 79.5941 },
  },
  {
    id: 'hyderabad',
    label: 'Hyderabad',
    subtitle: 'Hyderabad, Telangana',
    center: { lat: 17.4239, lng: 78.4738 },
  },
  {
    id: 'bengaluru',
    label: 'Bengaluru',
    subtitle: 'Bengaluru, Karnataka',
    center: { lat: 12.9716, lng: 77.5946 },
  },
  {
    id: 'chennai',
    label: 'Chennai',
    subtitle: 'Chennai, Tamil Nadu',
    center: { lat: 13.0827, lng: 80.2707 },
  },
  {
    id: 'mumbai',
    label: 'Mumbai',
    subtitle: 'Mumbai, Maharashtra',
    center: { lat: 19.076, lng: 72.8777 },
  },
];

const RADIUS_OPTIONS = [
  { label: '3 km', meters: 3000 },
  { label: '5 km', meters: 5000 },
  { label: '10 km', meters: 10000 },
  { label: '25 km', meters: 25000 },
];

const FACILITY_FILTERS: Array<{ id: FacilityFilter; label: string; types: string[] }> = [
  {
    id: 'all',
    label: 'Hospitals & Clinics',
    types: ['hospital', 'general_hospital', 'medical_clinic', 'medical_center', 'doctor'],
  },
  {
    id: 'hospital',
    label: 'Hospitals',
    types: ['hospital', 'general_hospital'],
  },
  {
    id: 'clinic',
    label: 'Clinics',
    types: ['medical_clinic', 'medical_center'],
  },
  {
    id: 'doctor',
    label: 'Doctors',
    types: ['doctor'],
  },
];

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

function getLanguageCode(language?: SupportedLanguage): string {
  if (language === 'Telugu') return 'te';
  if (language === 'Hindi') return 'hi';
  return 'en';
}

function toLatLngPoint(loc: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined): LatLngPoint | null {
  if (!loc) return null;
  if (typeof (loc as google.maps.LatLng).lat === 'function') {
    const ll = loc as google.maps.LatLng;
    return { lat: ll.lat(), lng: ll.lng() };
  }
  const lit = loc as google.maps.LatLngLiteral;
  if (typeof lit.lat === 'number' && typeof lit.lng === 'number') {
    return { lat: lit.lat, lng: lit.lng };
  }
  return null;
}

function computeDistanceKm(a: LatLngPoint, b: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistanceLabel(km: number): string {
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000))} m away`;
  }
  return `${km.toFixed(1)} km away`;
}

function isQuotaError(err: unknown): boolean {
  const text =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === 'object' && err !== null
      ? JSON.stringify(err)
      : String(err);
  const upper = text.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('QUOTA') ||
    upper.includes('429')
  );
}

interface ClinicMarkerItemProps {
  clinic: DiscoveredClinic;
  isSelected: boolean;
  onSelect: (clinic: DiscoveredClinic, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}

const ClinicMarkerItem: React.FC<ClinicMarkerItemProps> = ({ clinic, isSelected, onSelect }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      position={clinic.location}
      title={clinic.name}
      zIndex={isSelected ? 1000 : 10}
      onClick={() => onSelect(clinic, marker)}
    >
      <Pin
        background={isSelected ? '#064734' : '#137A5B'}
        borderColor={isSelected ? '#E0FFC2' : '#064734'}
        glyphColor="#FFFFFF"
        scale={isSelected ? 1.2 : 1.0}
      />
    </AdvancedMarker>
  );
};

interface ClinicLocationPickerProps {
  language?: SupportedLanguage;
  selectedHospital: SelectedHospitalSelection | null;
  onSelectHospital: (selection: SelectedHospitalSelection | null) => void;
}

interface MapLocatorInnerProps extends ClinicLocationPickerProps {
  languageCode: string;
}

const MapLocatorInner: React.FC<MapLocatorInnerProps> = ({
  languageCode,
  selectedHospital,
  onSelectHospital,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const apiStatus = useApiLoadingStatus();

  const [locationInput, setLocationInput] = useState<string>('Hanamkonda, Telangana');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState<boolean>(false);

  const [activeLocationLabel, setActiveLocationLabel] = useState<string>('Hanamkonda, Telangana');
  const [searchCenter, setSearchCenter] = useState<LatLngPoint>(LOCATION_PRESETS[0].center);
  const [radiusMeters, setRadiusMeters] = useState<number>(5000);
  const [facilityFilter, setFacilityFilter] = useState<FacilityFilter>('all');

  const [clinics, setClinics] = useState<DiscoveredClinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locatingUser, setLocatingUser] = useState<boolean>(false);

  const [infoClinic, setInfoClinic] = useState<DiscoveredClinic | null>(null);
  const [infoAnchor, setInfoAnchor] = useState<google.maps.marker.AdvancedMarkerElement | null>(null);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const suppressAutocompleteRef = useRef<boolean>(false);
  const searchRequestSeqRef = useRef<number>(0);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  // Fetch location autocomplete suggestions using Places API (New) AutocompleteSuggestion
  useEffect(() => {
    if (!placesLib || suppressAutocompleteRef.current) {
      suppressAutocompleteRef.current = false;
      return;
    }

    const trimmed = locationInput.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setAutocompleteLoading(true);
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          language: languageCode,
          region: 'in',
        });
        setSuggestions(res.suggestions || []);
        setShowSuggestions((res.suggestions || []).length > 0);
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      } finally {
        setAutocompleteLoading(false);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [placesLib, locationInput, languageCode]);

  const mapPlaceToClinic = useCallback(
    (place: google.maps.places.Place, origin: LatLngPoint): DiscoveredClinic | null => {
      const pt = toLatLngPoint(place.location);
      if (!pt) return null;
      const distKm = computeDistanceKm(origin, pt);
      return {
        placeId: place.id,
        name: place.displayName || 'Healthcare Facility',
        address: place.formattedAddress || 'Address available on Google Maps',
        typeLabel: place.primaryTypeDisplayName || 'Clinic / Hospital',
        location: pt,
        rating: typeof place.rating === 'number' ? place.rating : null,
        userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
        businessStatus: place.businessStatus ? String(place.businessStatus) : undefined,
        phone: place.nationalPhoneNumber || null,
        mapsUri: place.googleMapsURI || undefined,
        distanceKm: distKm,
        distanceLabel: formatDistanceLabel(distKm),
        attributions: Array.isArray(place.attributions) ? place.attributions : undefined,
      };
    },
    []
  );

  // Query live location-specific clinics & hospitals for the selected coordinates
  const searchClinicsAtCenter = useCallback(
    async (
      center: LatLngPoint,
      label: string,
      radius: number,
      filter: FacilityFilter
    ) => {
      if (!placesLib) return;
      const reqId = ++searchRequestSeqRef.current;
      setClinicsLoading(true);
      setSearchError(null);
      setInfoClinic(null);
      setInfoAnchor(null);

      const filterConfig =
        FACILITY_FILTERS.find((f) => f.id === filter) || FACILITY_FILTERS[0];

      const fields = [
        'id',
        'displayName',
        'formattedAddress',
        'location',
        'rating',
        'userRatingCount',
        'businessStatus',
        'primaryTypeDisplayName',
        'nationalPhoneNumber',
        'googleMapsURI',
      ];

      try {
        const nearbyReq: google.maps.places.SearchNearbyRequest & {
          internalUsageAttributionIds?: string[];
        } = {
          fields,
          locationRestriction: {
            center,
            radius: Math.min(radius, 50000),
          },
          includedTypes: filterConfig.types,
          maxResultCount: 15,
          rankPreference: placesLib.SearchNearbyRankPreference.DISTANCE,
          language: languageCode,
          region: 'in',
          internalUsageAttributionIds: ATTRIBUTION_IDS,
        };

        const { places } = await placesLib.Place.searchNearby(nearbyReq);
        if (reqId !== searchRequestSeqRef.current) return;

        let mapped = (places || [])
          .map((p) => mapPlaceToClinic(p, center))
          .filter((item): item is DiscoveredClinic => item !== null)
          .sort((a, b) => a.distanceKm - b.distanceKm);

        // Fallback to Text Search (New) if Nearby returns 0 results in sparse areas
        if (mapped.length === 0) {
          const typeWord =
            filter === 'hospital'
              ? 'hospitals'
              : filter === 'clinic'
              ? 'medical clinics'
              : filter === 'doctor'
              ? 'doctors'
              : 'hospitals and clinics';
          const textReq: google.maps.places.SearchByTextRequest & {
            internalUsageAttributionIds?: string[];
          } = {
            textQuery: `${typeWord} near ${label}`,
            fields,
            locationBias: {
              center,
              radius: Math.min(radius, 50000),
            },
            maxResultCount: 12,
            language: languageCode,
            region: 'in',
            internalUsageAttributionIds: ATTRIBUTION_IDS,
          };
          const textRes = await placesLib.Place.searchByText(textReq);
          if (reqId !== searchRequestSeqRef.current) return;
          mapped = (textRes.places || [])
            .map((p) => mapPlaceToClinic(p, center))
            .filter((item): item is DiscoveredClinic => item !== null)
            .sort((a, b) => a.distanceKm - b.distanceKm);
        }

        setClinics(mapped);

        if (map && mapped.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(center);
          mapped.slice(0, 8).forEach((c) => bounds.extend(c.location));
          map.fitBounds(bounds, 56);
        } else if (map) {
          map.panTo(center);
          map.setZoom(13);
        }
      } catch (err) {
        if (reqId !== searchRequestSeqRef.current) return;
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          setSearchError('Google Maps Places quota reached. Please try again later.');
        } else {
          setSearchError('Unable to load clinics for this location right now. Please try another area.');
        }
        setClinics([]);
      } finally {
        if (reqId === searchRequestSeqRef.current) {
          setClinicsLoading(false);
        }
      }
    },
    [placesLib, languageCode, map, mapPlaceToClinic]
  );

  // Trigger live search whenever Places library is ready or location/radius/filter changes
  useEffect(() => {
    if (!placesLib) return;
    void searchClinicsAtCenter(searchCenter, activeLocationLabel, radiusMeters, facilityFilter);
  }, [placesLib, searchCenter, activeLocationLabel, radiusMeters, facilityFilter, searchClinicsAtCenter]);

  const applyNewLocation = useCallback(
    (center: LatLngPoint, label: string) => {
      suppressAutocompleteRef.current = true;
      setLocationInput(label);
      setActiveLocationLabel(label);
      setSearchCenter(center);
      setShowSuggestions(false);
      if (map) {
        map.panTo(center);
        map.setZoom(13);
      }
    },
    [map]
  );

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      });
      const pt = toLatLngPoint(place.location);
      const label =
        place.formattedAddress ||
        place.displayName ||
        suggestion.placePrediction.text?.text ||
        locationInput;
      resetSession();
      if (pt) {
        if (map && place.viewport) {
          map.fitBounds(place.viewport);
        }
        applyNewLocation(pt, label);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setSearchError('Could not resolve that location. Please pick another suggestion.');
    }
  };

  const handleManualLocationSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = locationInput.trim();
    if (!query || !placesLib) return;

    setShowSuggestions(false);
    setClinicsLoading(true);
    setSearchError(null);

    try {
      const { places } = await placesLib.Place.searchByText({
        textQuery: query,
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        maxResultCount: 1,
        language: languageCode,
        region: 'in',
        internalUsageAttributionIds: ATTRIBUTION_IDS,
      } as google.maps.places.SearchByTextRequest);

      const first = places?.[0];
      const pt = toLatLngPoint(first?.location);
      if (pt && first) {
        const label = first.formattedAddress || first.displayName || query;
        resetSession();
        if (map && first.viewport) {
          map.fitBounds(first.viewport);
        }
        applyNewLocation(pt, label);
      } else {
        setClinicsLoading(false);
        setSearchError(`Could not find location "${query}". Try a city, locality, or pin code.`);
      }
    } catch (err) {
      setClinicsLoading(false);
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setSearchError('Location search failed. Please check your query and try again.');
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingUser(true);
    setSearchError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        applyNewLocation(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          'My Current Location'
        );
      },
      () => {
        setLocatingUser(false);
        setSearchError(
          'Location permission denied or unavailable. Enter a city or click directly on the map.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleChooseVirtual = () => {
    onSelectHospital({
      locationLabel: 'Online Video Room',
      hospitalPlaceId: 'clinic-online-video',
      hospitalName: 'Online Video Consultation',
      hospitalAddress: 'Encrypted Telehealth Video Room · Join from anywhere',
      primaryTypeLabel: 'Telehealth Video Room',
      rating: 4.9,
      distanceLabel: '0 km · Instant',
      nextAvailableSlot: 'Today · Next Open Slot',
      isVirtual: true,
    });
  };

  const handleChooseClinic = useCallback(
    (clinic: DiscoveredClinic, marker?: google.maps.marker.AdvancedMarkerElement | null) => {
      onSelectHospital({
        locationLabel: activeLocationLabel,
        hospitalPlaceId: clinic.placeId,
        hospitalName: clinic.name,
        hospitalAddress: clinic.address,
        hospitalMapsUri: clinic.mapsUri,
        primaryTypeLabel: clinic.typeLabel,
        rating: clinic.rating,
        phone: clinic.phone,
        distanceLabel: clinic.distanceLabel,
        isVirtual: false,
      });

      setInfoClinic(clinic);
      if (marker) {
        setInfoAnchor(marker);
      } else {
        setInfoAnchor(null);
      }
      if (map) {
        map.panTo(clinic.location);
      }
    },
    [activeLocationLabel, map, onSelectHospital]
  );

  const isVirtualSelected =
    !selectedHospital || selectedHospital.hospitalPlaceId === 'clinic-online-video';

  const uniqueAttributions = useMemo(() => {
    const list: Array<{ provider: string; providerURI?: string | null }> = [];
    const seen: Record<string, boolean> = {};
    clinics.forEach((c) => {
      c.attributions?.forEach((a) => {
        if (a.provider && !seen[a.provider]) {
          seen[a.provider] = true;
          list.push({ provider: a.provider, providerURI: a.providerURI });
        }
      });
    });
    return list;
  }, [clinics]);

  return (
    <div className="space-y-4">
      {/* Location Selection & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] space-y-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Specific Location Autocomplete Input */}
          <div className="relative flex-1 w-full sm:w-auto sm:min-w-[240px]">
            <Search className="w-4 h-4 text-[var(--color-forest)] absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleManualLocationSearch();
                }
              }}
              placeholder="Select city, locality, or address (e.g., Hanamkonda, Madhapur, Indiranagar)..."
              className="w-full pl-10 pr-24 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] text-[var(--color-text-dark)]"
            />
            <button
              type="button"
              onClick={() => void handleManualLocationSearch()}
              disabled={clinicsLoading}
              className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-forest)] hover:bg-[var(--color-forest-dark)] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
            >
              {autocompleteLoading ? '...' : 'Find Area'}
            </button>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-[var(--color-leaf-border)] rounded-xl shadow-lg overflow-hidden divide-y divide-[var(--color-leaf-border)]/50">
                {suggestions.map((suggestion, idx) => {
                  const label = suggestion.placePrediction?.text?.text || '';
                  if (!label) return null;
                  return (
                    <button
                      key={`${suggestion.placePrediction?.placeId || idx}`}
                      type="button"
                      onClick={() => void handleSelectSuggestion(suggestion)}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)] flex items-center gap-2 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[var(--color-forest)] shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Use Current GPS Location */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locatingUser}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-[var(--color-leaf-border)] hover:border-[var(--color-forest)] text-[var(--color-forest)] text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {locatingUser ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
            <span>Use My Location</span>
          </button>

          {/* Search Radius */}
          <select
            aria-label="Search radius"
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            className="px-3 py-2.5 text-xs font-semibold bg-white border border-[var(--color-leaf-border)] rounded-xl text-[var(--color-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)]"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.meters} value={r.meters}>
                Within {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* City Quick Presets + Facility Type Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-[var(--color-text-muted)] mr-1">
              Quick Locations:
            </span>
            {LOCATION_PRESETS.map((preset) => {
              const isActive = activeLocationLabel === preset.subtitle;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyNewLocation(preset.center, preset.subtitle)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[var(--color-forest)] text-white shadow-2xs'
                      : 'bg-white border border-[var(--color-leaf-border)] text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-[var(--color-leaf-border)] rounded-xl">
            {FACILITY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFacilityFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  facilityFilter === f.id
                    ? 'bg-[var(--color-forest)] text-white'
                    : 'text-[var(--color-text-dark)] hover:bg-[var(--color-leaf)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Search Location Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-forest)]">
            <Navigation className="w-3.5 h-3.5" />
            <span>
              Showing clinics &amp; hospitals near{' '}
              <strong className="underline decoration-[var(--color-forest)]/40">
                {activeLocationLabel}
              </strong>
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] font-normal">
              (Tip: Click anywhere on the map to inspect another neighborhood)
            </span>
          </div>
          {clinicsLoading && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-forest)]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Fetching nearby facilities...
            </span>
          )}
        </div>
      </div>

      {searchError && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>{searchError}</span>
        </div>
      )}

      {(apiStatus === APILoadingStatus.FAILED || apiStatus === APILoadingStatus.AUTH_FAILURE) && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>
            Google Maps failed to initialize. Verify your Google Maps API key restrictions and enabled APIs (Maps JavaScript API &amp; Places API New).
          </span>
        </div>
      )}

      {/* Interactive Split View: Google Map + Synchronized Location-Specific Facilities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Google Map Container with explicit CSS height (CF2) */}
        <div className="lg:col-span-7 relative w-full h-[280px] sm:h-[360px] lg:h-[400px] xl:h-[440px] rounded-2xl overflow-hidden border-2 border-[var(--color-leaf-border)] bg-[var(--color-leaf-soft)] shadow-xs">
          <GoogleMapView
            mapId="DEMO_MAP_ID"
            defaultCenter={LOCATION_PRESETS[0].center}
            defaultZoom={13}
            gestureHandling="greedy"
            streetViewControl={false}
            mapTypeControl={false}
            internalUsageAttributionIds={ATTRIBUTION_IDS}
            onClick={(ev) => {
              const latLng = ev.detail?.latLng;
              if (latLng) {
                applyNewLocation(
                  { lat: latLng.lat, lng: latLng.lng },
                  `Selected Pin (${latLng.lat.toFixed(4)}, ${latLng.lng.toFixed(4)})`
                );
              }
            }}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Selected Location Center Pin */}
            <AdvancedMarker position={searchCenter} title={`Search Location: ${activeLocationLabel}`} zIndex={5}>
              <Pin background="#0284c7" borderColor="#e0f2fe" glyphColor="#ffffff" scale={0.95} />
            </AdvancedMarker>

            {/* Real Location-Specific Clinic & Hospital Pins */}
            {clinics.map((clinic) => (
              <ClinicMarkerItem
                key={clinic.placeId}
                clinic={clinic}
                isSelected={selectedHospital?.hospitalPlaceId === clinic.placeId}
                onSelect={handleChooseClinic}
              />
            ))}

            {/* InfoWindow anchored to selected clinic */}
            {infoClinic && (
              <InfoWindow
                anchor={infoAnchor || undefined}
                position={infoAnchor ? undefined : infoClinic.location}
                onCloseClick={() => {
                  setInfoClinic(null);
                  setInfoAnchor(null);
                }}
              >
                <div className="max-w-[230px] p-1 space-y-1.5 text-xs text-slate-800">
                  <div className="font-bold text-[#064734] text-sm leading-snug">
                    {infoClinic.name}
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-700">
                    {infoClinic.typeLabel} · {infoClinic.distanceLabel}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">{infoClinic.address}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5">
                    {infoClinic.rating !== null && (
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {infoClinic.rating.toFixed(1)}
                        {infoClinic.userRatingCount ? ` (${infoClinic.userRatingCount})` : ''}
                      </span>
                    )}
                    {infoClinic.phone && (
                      <span className="text-slate-600">{infoClinic.phone}</span>
                    )}
                  </div>
                  {infoClinic.mapsUri && (
                    <a
                      href={infoClinic.mapsUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#064734] underline pt-0.5"
                    >
                      Open in Google Maps
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMapView>
        </div>

        {/* Right: Virtual Room Option + Location-Specific Clinics & Hospitals List */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {/* Virtual Online Video Consultation Card */}
          <button
            type="button"
            onClick={handleChooseVirtual}
            className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer space-y-1.5 ${
              isVirtualSelected
                ? 'bg-[var(--color-leaf)]/60 border-[var(--color-forest)] shadow-xs'
                : 'bg-white border-[var(--color-leaf-border)] hover:border-[var(--color-forest)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#137A5B]">
                <Video className="w-3.5 h-3.5" />
                Telehealth Video Room
              </span>
              {isVirtualSelected && (
                <CheckCircle2 className="w-4 h-4 text-[var(--color-forest)] shrink-0" />
              )}
            </div>
            <div className="text-sm font-bold text-[var(--color-forest)]">
              Online Video Consultation
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Encrypted real-time video &amp; chat consultation from home (no travel required).
            </p>
          </button>

          {/* Discovered Real Clinics & Hospitals for Selected Location */}
          {clinicsLoading && clinics.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] text-center text-xs text-[var(--color-text-muted)] space-y-2">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--color-forest)]" />
              <div>Searching clinics &amp; hospitals near {activeLocationLabel}...</div>
            </div>
          ) : clinics.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] text-center text-xs text-[var(--color-text-muted)] space-y-1">
              <Hospital className="w-5 h-5 mx-auto text-[var(--color-forest)]" />
              <div className="font-semibold text-[var(--color-forest)]">
                No matching facilities found within {Math.round(radiusMeters / 1000)} km.
              </div>
              <div>Try increasing the search radius or selecting another location.</div>
            </div>
          ) : (
            clinics.map((clinic) => {
              const isSelected = selectedHospital?.hospitalPlaceId === clinic.placeId;
              return (
                <div
                  key={clinic.placeId}
                  onClick={() => handleChooseClinic(clinic)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleChooseClinic(clinic);
                    }
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-[var(--color-leaf)]/60 border-[var(--color-forest)] shadow-xs'
                      : 'bg-white border-[var(--color-leaf-border)] hover:border-[var(--color-forest)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#137A5B] truncate">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{clinic.typeLabel}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {clinic.rating !== null && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-forest)] tabular-nums">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {clinic.rating.toFixed(1)}
                        </span>
                      )}
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-[var(--color-forest)] shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-bold text-[var(--color-forest)] leading-snug">
                    {clinic.name}
                  </div>

                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                    {clinic.address}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] tabular-nums border-t border-[var(--color-leaf-border)]/60">
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-text-dark)]">
                      <MapPin className="w-3 h-3 text-[var(--color-forest)]" />
                      {clinic.distanceLabel}
                    </span>

                    <div className="flex items-center gap-2.5">
                      {clinic.phone && (
                        <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                          <Phone className="w-3 h-3" />
                          {clinic.phone}
                        </span>
                      )}
                      {clinic.mapsUri && (
                        <a
                          href={clinic.mapsUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 font-bold text-[var(--color-forest)] hover:underline"
                        >
                          <span>Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Required Google Places Attributions if present */}
      {uniqueAttributions.length > 0 && (
        <div className="text-[10px] text-[var(--color-text-muted)] flex flex-wrap items-center gap-2">
          <span>Place data attributions:</span>
          {uniqueAttributions.map((attr, idx) =>
            attr.providerURI ? (
              <a
                key={`${attr.provider}-${idx}`}
                href={attr.providerURI}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--color-forest)]"
              >
                {attr.provider}
              </a>
            ) : (
              <span key={`${attr.provider}-${idx}`}>{attr.provider}</span>
            )
          )}
        </div>
      )}
    </div>
  );
};

export const ClinicLocationPicker: React.FC<ClinicLocationPickerProps> = ({
  language = 'English',
  selectedHospital,
  onSelectHospital,
}) => {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
  const [apiKey, setApiKey] = useState<string>(envKey);
  const [configLoaded, setConfigLoaded] = useState<boolean>(Boolean(envKey));

  useEffect(() => {
    if (envKey) {
      setApiKey(envKey);
      setConfigLoaded(true);
      return;
    }
    let cancelled = false;
    fetch('/api/config/maps')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean; apiKey?: string } | null) => {
        if (!cancelled && data?.apiKey) {
          setApiKey(data.apiKey);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setConfigLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [envKey]);

  const languageCode = getLanguageCode(language);

  if (!configLoaded) {
    return (
      <div className="p-8 rounded-2xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-forest)]" />
        <span>Initializing Google Maps Platform clinic locator...</span>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
        <div className="flex items-center gap-2 font-bold">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Google Maps API key not detected in runtime configuration</span>
        </div>
        <p className="leading-relaxed">
          Configure <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">GOOGLE_MAPS_API_KEY</code> in your environment or AI Studio Google Maps settings, then reload. You can still book an{' '}
          <button
            type="button"
            onClick={() =>
              onSelectHospital({
                locationLabel: 'Online Video Room',
                hospitalPlaceId: 'clinic-online-video',
                hospitalName: 'Online Video Consultation',
                hospitalAddress: 'Encrypted Telehealth Video Room · Join from anywhere',
                primaryTypeLabel: 'Telehealth Video Room',
                rating: 4.9,
                distanceLabel: '0 km · Instant',
                isVirtual: true,
              })
            }
            className="underline font-bold cursor-pointer"
          >
            Online Video Consultation
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      language={languageCode}
      region="IN"
      libraries={['places', 'marker']}
    >
      <MapLocatorInner
        language={language}
        languageCode={languageCode}
        selectedHospital={selectedHospital}
        onSelectHospital={onSelectHospital}
      />
    </APIProvider>
  );
};
