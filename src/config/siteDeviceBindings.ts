export interface SiteDeviceBinding {
  siteName: string;
  weatherId: number;
  insectId: number;
  cameraId: number;
}

/**
 * 多基地设备绑定配置（P1 版本：代码内配置）。
 * 二维码示例：
 *   http://43.156.153.252:3101/?site=base-current
 *   http://43.156.153.252:3101/?site=base-legacy
 */
export const SITE_DEVICE_BINDINGS: Record<string, SiteDeviceBinding> = {
  // 当前在用基地（你提供的最新设备 ID）
  'base-current': {
    siteName: '当前基地',
    weatherId: 11828,
    insectId: 2734,
    cameraId: 313793,
  },

  // 历史基地（保留，便于回滚或排查）
  'base-legacy': {
    siteName: '历史基地',
    weatherId: 8041,
    insectId: 1314,
    cameraId: 5224,
  },
};

export const DEFAULT_SITE_KEY = 'base-current';
