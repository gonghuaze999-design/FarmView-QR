import React, { createContext, useContext } from 'react';

export type SiteBinding = {
  siteName: string;
  weatherId: number;
  insectId: number;
  cameraId: number;
  farmlandId?: number; // 大数据平台的地块ID
  center?: [number, number];
  polygon?: [number, number][];
};

type SiteContextType = {
  siteKey: string;
  binding: SiteBinding | null;
};

const SiteContext = createContext<SiteContextType>({
  siteKey: 'base-current',
  binding: null,
});

export const useSiteContext = () => useContext(SiteContext);

export const SiteProvider: React.FC<{
  siteKey: string;
  binding: SiteBinding | null;
  children: React.ReactNode;
}> = ({ siteKey, binding, children }) => {
  return (
    <SiteContext.Provider value={{ siteKey, binding }}>
      {children}
    </SiteContext.Provider>
  );
};
