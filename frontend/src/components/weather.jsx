"use client";

import { LocateFixed, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { messageFrom, useApi } from "@/lib/api";

// Maps WMO weather interpretation codes to ambient scene types and textual descriptions.
function condition(code, day) {
    if (code === 0) return [day ? "sun" : "night", day ? "Clear skies" : "Clear night"];
    if ([1, 2, 3].includes(code)) return ["cloud", code === 3 ? "Overcast" : "Partly cloudy"];
    if ([45, 48].includes(code)) return ["fog", "Foggy"];
    if ([71, 73, 75, 77, 85, 86].includes(code)) return ["snow", "Snowfall"];
    if ([95, 96, 99].includes(code)) return ["storm", "Thunderstorms"];
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["rain", "Rain & drizzle"];
    return ["cloud", "Conditions unavailable"];
}

function WeatherReport() {
    const { userId, request } = useApi();
    // Coordinates kept in volatile memory only; never stored in localStorage or cookies.
    const [location, setLocation] = useState(null);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState("");
    // attempt counter tracks in-flight geolocation queries to ignore stale responses or unmounts.
    const attempt = useRef(0);
    useEffect(() => () => { attempt.current++; }, []);

    // 15-minute polling matches the backend cache fresh TTL.
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        location ? ["weather", userId, location.latitude, location.longitude] : null,
        () => request("/weather/", { method: "POST", body: JSON.stringify(location) }),
        { refreshInterval: 900000, revalidateOnFocus: false, shouldRetryOnError: false },
    );

    function locate() {
        if (!navigator.geolocation || !window.isSecureContext) {
            setLocationError("Location needs HTTPS or localhost and a browser with location support.");
            return;
        }
        const current = ++attempt.current;
        setLocating(true);
        setLocationError("");
        // Geolocation is opt-in and triggered solely on explicit user click.
        navigator.geolocation.getCurrentPosition(({ coords }) => {
            if (current !== attempt.current) return;
            // Round coordinates to 2 decimals (~1.1km) for privacy preservation and Redis cache consolidation.
            setLocation({ latitude: Number(coords.latitude.toFixed(2)), longitude: Number(coords.longitude.toFixed(2)) });
            setLocating(false);
        }, ({ code }) => {
            if (current !== attempt.current) return;
            setLocationError(code === 1 ? "Location access was denied. Allow it in your browser’s site settings, then try again." : "Could not find your location. Check location services and try again.");
            setLocating(false);
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }

    const [scene, description] = data ? condition(data.current.weather_code, data.current.is_day) : ["cloud", ""];
    const delayed = Boolean(data?.stale || error);
    return <>
        {!location && <p className="weather-note">Local weather beside your local time. Share approximate coordinates with Open-Meteo through Django; nothing is saved in your browser.</p>}
        {locationError && <p className="form-error" role="alert">{locationError}</p>}
        {isLoading && <p role="status">Checking the skies…</p>}
        {error && <p className="form-error" role="alert">{messageFrom(error)}</p>}
        {data && <>
            <div className="weather-window" data-weather={scene} data-day={Boolean(data.current.is_day)}>
                <div className="weather-scene" aria-hidden="true">
                    <i className="weather-orb" /><i className="weather-cloud cloud-a" /><i className="weather-cloud cloud-b" />
                    {Array.from({ length: 18 }, (_, index) => <i className="weather-particle" key={index} style={{ "--x": `${(index * 37 + 7) % 100}%`, "--delay": `${-index * .43}s`, "--duration": `${2 + index % 4}s` }} />)}
                </div>
                <div className="weather-reading"><span className="eyebrow">CURRENT LOCATION</span><div className="weather-temperature">{Math.round(data.current.temperature_2m)}<span>°C</span></div><p>{description}</p></div>
            </div>
            <p className="weather-note">{delayed ? "Saved weather" : "Model estimate"} · <time dateTime={data.observed_at}>{new Date(data.observed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></p>
        </>}
        {location && <details className="weather-more"><summary>Weather details{delayed ? " · Update delayed" : ""}</summary>
        {data && <>
            <dl className="weather-details"><div><dt>Feels like</dt><dd>{Math.round(data.current.apparent_temperature)}°C</dd></div><div><dt>Humidity</dt><dd>{Math.round(data.current.relative_humidity_2m)}%</dd></div><div><dt>Wind</dt><dd>{Math.round(data.current.wind_speed_10m)} km/h</dd></div></dl>
            <p className="weather-note" role="status">{delayed ? "Last saved conditions · Update delayed" : "Model-based current conditions"}<br /><time dateTime={data.observed_at}>{new Date(data.observed_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time> · Checks every 15 minutes</p>
        </>}
        <div className="weather-actions">
            {location && <button className="text-button" onClick={locate} disabled={locating}><LocateFixed size={14} />{locating ? "Finding your location…" : location ? "Update location" : "Use my location"}</button>}
            {location && <button className="text-button" onClick={() => mutate()} disabled={isValidating}><RefreshCw size={14} />{isValidating ? "Updating…" : "Refresh weather"}</button>}
        </div>
        </details>}
        {!location && <button className="text-button weather-locate" onClick={locate} disabled={locating}><LocateFixed size={14} />{locating ? "Finding your location…" : "Use my location"}</button>}
        <p className="weather-note weather-credit">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>
    </>;
}

export function Weather() {
    const { userId, checking } = useApi();
    return <section className="weather-widget" aria-label="Local weather">
        {checking ? <p className="weather-note" role="status">Checking weather access…</p> : !userId ? <p className="weather-note">Connect your workspace for local weather.</p> : <WeatherReport key={userId} />}
    </section>;
}
