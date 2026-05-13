import { Link } from '@inertiajs/react';
import { AlertTriangle, Clock } from 'lucide-react';
import React from 'react';

import { show as projectShow } from '@/actions/App/Http/Controllers/Api/ProjectController';

export type DeadlineAlertProject = {
  id: number;
  name: string;
  deadline: string;
  status: string;
  days_overdue?: number;
  days_remaining?: number;
};

export type ProjectDeadlineAlertsShape = {
  overdue: DeadlineAlertProject[];
  ending_soon: DeadlineAlertProject[];
};

type Props = {
  alerts?: ProjectDeadlineAlertsShape | null;
};

export function ProjectDeadlineAlertsBanner({ alerts }: Props) {
  const overdue = alerts?.overdue ?? [];
  const endingSoon = alerts?.ending_soon ?? [];

  if (overdue.length === 0 && endingSoon.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {overdue.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-950 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Chantiers en retard ({overdue.length})
          </div>
          <ul className="mt-2 space-y-1.5 pl-6 text-xs font-semibold text-rose-900/90">
            {overdue.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link href={projectShow.url(p.id)} className="underline decoration-rose-400 underline-offset-2 hover:text-rose-950">
                  {p.name}
                </Link>
                <span className="text-rose-700">
                  — échéance {new Date(p.deadline).toLocaleDateString('fr-FR')}
                  {typeof p.days_overdue === 'number' ? ` (${p.days_overdue} j. de retard)` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {endingSoon.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <Clock className="h-4 w-4 shrink-0" />
            Fin de chantier proche ({endingSoon.length})
          </div>
          <p className="mt-1 pl-6 text-[11px] font-medium text-amber-800/90">Échéance dans les 14 prochains jours (hors chantiers terminés ou suspendus).</p>
          <ul className="mt-2 space-y-1.5 pl-6 text-xs font-semibold text-amber-900/90">
            {endingSoon.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link href={projectShow.url(p.id)} className="underline decoration-amber-400 underline-offset-2 hover:text-amber-950">
                  {p.name}
                </Link>
                <span className="text-amber-800">
                  — {new Date(p.deadline).toLocaleDateString('fr-FR')}
                  {typeof p.days_remaining === 'number' ? ` (J-${p.days_remaining})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
