/**
 * Libellés français pour les valeurs brutes renvoyées par l’API (shifts, statuts).
 * Les pages qui reçoivent déjà `shifts` / `statuses` depuis le backend peuvent préférer `.label`.
 */

const SHIFT_FR: Record<string, string> = {
  morning: 'Matin',
  evening: 'Soir',
};

const STATUS_FR: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  retard: 'Retard',
  malade: 'Malade',
};

export function attendanceShiftLabel(
  value: string | null | undefined,
  shifts?: Array<{ value: string; label: string }>,
): string {
  if (value == null || value === '') {
    return '—';
  }

  const fromApi = shifts?.find((s) => s.value === value)?.label;

  return fromApi ?? SHIFT_FR[value] ?? value;
}

export function attendanceStatusLabel(value: string | null | undefined): string {
  if (value == null || value === '') {
    return '—';
  }

  return STATUS_FR[value] ?? value;
}
