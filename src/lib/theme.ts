import type { Role, Specialty } from './types';

export const colors = {
  bg: '#F5F6FA',
  card: '#FFFFFF',
  text: '#171B26',
  muted: '#667085',
  faint: '#98A2B3',
  border: '#E2E5EE',
  primary: '#2E5BE8',
  primarySoft: '#E8EEFE',
  success: '#16936A',
  successSoft: '#E3F6EE',
  danger: '#D14343',
  dangerSoft: '#FCEBEB',
  warning: '#C97A06',
  warningSoft: '#FEF4E2',
  shade: '#DCE6FF',
};

export const radius = { sm: 8, md: 12, lg: 18 };

export const specialtyColors: Record<Specialty, string> = {
  robotics: '#D62828',
  drone: '#8A4FE0',
  roboboat: '#0E9C9A',
  general: '#E07A1F',
};

export const specialtyLabels: Record<Specialty, string> = {
  robotics: 'Robotics',
  drone: 'Drones',
  roboboat: 'Roboboat',
  general: 'General',
};

// MaterialCommunityIcons names
export const roleIcons: Record<Role, 'office-building' | 'school' | 'hard-hat' | 'wrench'> = {
  school: 'office-building',
  student: 'school',
  mentor: 'hard-hat',
  independent: 'wrench',
};

export const roleLabels: Record<Role, string> = {
  school: 'School',
  student: 'Student',
  mentor: 'Mentor/Teacher',
  independent: 'Independent Team',
};
