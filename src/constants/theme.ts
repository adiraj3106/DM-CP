export const COLORS = {
  wine: {
    900: '#35121C',
    800: '#4C1B28',
    700: '#642434',
    600: '#7C2D3E',
    500: '#9E3A4D',
    400: '#C06878',
    300: '#D6939F',
    200: '#E8BFC6',
    100: '#F5E1E5',
    50:  '#FCF5F6',
  },

  sage: {
    900: '#1B241A',
    800: '#2A3728',
    700: '#3A4B36',
    600: '#4A6044',
    500: '#5B7553',
    400: '#7FA076',
    300: '#A3BB9C',
    200: '#C5D5C0',
    100: '#E2EAE0',
    50:  '#F3F6F2',
  },

  amber: {
    900: '#40280E',
    800: '#5F3B15',
    700: '#7F4F1C',
    600: '#A06523',
    500: '#C17C2A',
    400: '#D49A42',
    300: '#E4B66E',
    200: '#F0D2A1',
    100: '#F8E9D0',
    50:  '#FDF7EE',
  },

  terra: {
    900: '#3B1510',
    800: '#582019',
    700: '#782B21',
    600: '#983629',
    500: '#B84233',
    400: '#C45A49',
    300: '#D17D6F',
    200: '#E5ABA1',
    100: '#F3D5D0',
    50:  '#FBF0EE',
  },

  cream: {
    900: '#2D2926',
    800: '#453F3A',
    700: '#6B635B',
    600: '#9A9186',
    500: '#B8B0A4',
    400: '#D5CEC3',
    300: '#E8E2D9',
    200: '#F3EDE4',
    100: '#FBF8F3',
    50:  '#FEFDFB',
  },

  surface: {
    primary:      '#F6F8F5',
    secondary:    '#EFF2EE',
    elevated:     '#FFFFFF',
    dark:         '#202822',
    darkElevated: '#453F3A',
  },

  risk: {
    safe:          '#5B7553',
    safeBg:        '#E2EAE0',
    review:        '#C17C2A',
    reviewBg:      '#F8E9D0',
    investigate:   '#B84233',
    investigateBg: '#F3D5D0',
  },

  severity: {
    low:      '#6B635B',
    medium:   '#C17C2A',
    high:     '#D49A42',
    critical: '#B84233',
  },

  pillar: {
    gnn: '#40845A',
  },
} as const;

export const TIER_LABELS = {
  safe: 'Safe',
  review: 'Review',
  investigate: 'Investigate',
} as const;

export const TIER_THRESHOLDS = {
  safe: { min: 0.0, max: 0.39 },
  review: { min: 0.40, max: 0.69 },
  investigate: { min: 0.70, max: 1.0 },
} as const;

export const PILLAR_LABELS = {
  gnn: 'Network / GNN',
} as const;
