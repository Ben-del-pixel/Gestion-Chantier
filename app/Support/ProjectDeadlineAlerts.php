<?php

declare(strict_types=1);

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Support\Collection;

final class ProjectDeadlineAlerts
{
    /**
     * @return array{overdue: list<array<string, mixed>>, ending_soon: list<array<string, mixed>>}
     */
    public static function fromProjects(Collection $projects, int $endingSoonDays = 14): array
    {
        $today = Carbon::today()->startOfDay();
        $soonEnd = $today->copy()->addDays($endingSoonDays)->startOfDay();

        $relevant = $projects->filter(
            fn ($project) => $project->deadline !== null
                && ! in_array((string) $project->status, ['termine', 'suspendu'], true)
        );

        $overdue = $relevant
            ->filter(fn ($project) => $project->deadline->copy()->startOfDay()->lt($today))
            ->sortBy(fn ($p) => $p->deadline->timestamp)
            ->values();

        $endingSoon = $relevant
            ->filter(function ($project) use ($today, $soonEnd) {
                $d = $project->deadline->copy()->startOfDay();

                return $d->gte($today) && $d->lte($soonEnd);
            })
            ->sortBy(fn ($p) => $p->deadline->timestamp)
            ->values();

        return [
            'overdue' => $overdue->map(function ($project) use ($today) {
                $deadline = $project->deadline->copy()->startOfDay();

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'deadline' => $project->deadline->format('Y-m-d'),
                    'status' => (string) $project->status,
                    'days_overdue' => (int) $deadline->diffInDays($today),
                ];
            })->all(),
            'ending_soon' => $endingSoon->map(function ($project) use ($today) {
                $deadline = $project->deadline->copy()->startOfDay();

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'deadline' => $project->deadline->format('Y-m-d'),
                    'status' => (string) $project->status,
                    'days_remaining' => (int) $today->diffInDays($deadline),
                ];
            })->all(),
        ];
    }
}
