export interface WeatherData {
  current: {
    temperature: number;
    weatherCode: number;
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m,wind_speed_10m,precipitation&timezone=auto&alerts=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch weather data');
  const data = await response.json();
  
  return {
    current: {
      temperature: data.current.temperature_2m,
      weatherCode: data.current.weather_code,
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
