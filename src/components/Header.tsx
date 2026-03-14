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
    <header className="bg-white p-4 flex items-center justify-between sticky top-0 z-50 border-b border-stone-200">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative cursor-pointer w-10 h-10 flex-shrink-0" onClick={changeAvatar}>
          <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full border border-stone-300 object-cover" />
          <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full border border-stone-300">
            <Edit2 size={10} className="text-stone-500" />
          </div>
        </div>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="bg-transparent text-base font-bold text-stone-900 outline-none w-24"
        />
      </div>
      
      <div className="flex items-center gap-4 flex-shrink-0">
        <WeatherWidget />
        <div className="relative p-2 cursor-pointer hover:bg-stone-100 rounded-full">
          <Bell size={20} className="text-stone-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </div>
      </div>
    </header>
  );
};
