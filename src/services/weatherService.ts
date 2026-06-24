export interface WeatherData {
  current: {
    temperature: number;
    weatherCode: number;
    windSpeed: number;
    precipitation: number;
    humidity: number;
  };
  hourly: {
    time: string[];
    temperature: number[];
    windSpeed: number[];
    precipitation: number[];
  };
  alerts: {
    event: string;
    description: string;
    severity: string;
  }[];
}

export const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherData> => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,precipitation,relative_humidity_2m&hourly=temperature_2m,wind_speed_10m,precipitation&timezone=auto&alerts=true&_t=${Date.now()}`;
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error('Failed to fetch weather data');
  const data = await response.json();

  return {
    current: {
      temperature: data.current.temperature_2m,
      weatherCode: data.current.weather_code,
      windSpeed: data.current.wind_speed_10m,
      precipitation: data.current.precipitation,
      humidity: data.current.relative_humidity_2m,
    },
    hourly: {
      time: data.hourly.time,
      temperature: data.hourly.temperature_2m,
      windSpeed: data.hourly.wind_speed_10m,
      precipitation: data.hourly.precipitation,
    },
    alerts: data.alerts || [],
  };
};
