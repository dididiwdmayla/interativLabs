export interface Viewport {
  name: string;
  width: number;
  height: number;
  mobile: boolean;
}

export const CAPTURE_VIEWPORTS: Viewport[] = [
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "1440x900", width: 1440, height: 900, mobile: false },
];

export const OVERFLOW_WIDTHS = [360, 390, 412];

export const CAPTURE_DIR = "docs/capturas/fase-1";
