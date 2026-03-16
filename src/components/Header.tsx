import React, { useState } from 'react';
import { Bell, Edit2 } from 'lucide-react';
import { WeatherWidget } from './WeatherWidget';

const DEFAULT_AVATARS = Array.from({ length: 10 }, (_, i) => `https://picsum.photos/seed/chili${i + 1}/100/100`);

export const Header: React.FC = () => {
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATARS[0]);
  const [userName, setUserName] = useState('农场主');

  const changeAvatar = () => {
    const randomIndex = Math.floor(Math.random() * DEFAULT_AVATARS.length);
    setAvatarUrl(DEFAULT_AVATARS[randomIndex]);
  };

  return (
    <header className="bg-white/80 backdrop-blur-xl p-4 flex items-center justify-between sticky top-0 z-50 border-b border-zinc-100 shadow-sm">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative cursor-pointer w-11 h-11 flex-shrink-0 group" onClick={changeAvatar}>
          <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full border-2 border-white shadow-sm object-cover transition-transform group-hover:scale-105" />
          <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-sm border border-zinc-100 text-zinc-400 group-hover:text-emerald-600 transition-colors">
            <Edit2 size={12} />
          </div>
        </div>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="bg-transparent text-lg font-bold text-zinc-800 outline-none w-32 placeholder-zinc-400 focus:border-b-2 focus:border-emerald-500 transition-all"
        />
      </div>
      
      <div className="flex items-center gap-4 flex-shrink-0">
        <WeatherWidget />
        <div className="relative p-2 cursor-pointer hover:bg-zinc-100 rounded-full transition-colors">
          <Bell size={22} className="text-zinc-600" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
        </div>
      </div>
    </header>
  );
};
