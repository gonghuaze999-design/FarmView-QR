import React, { createContext, useContext } from 'react';

export type SiteBinding = {
  siteName: string;
  owner: string;
  baseId: number;
  farmlandIds: number[];
  devices: {
    weatherIds: number[];
    insectIds: number[];
    cameraIds: number[];
  };
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
