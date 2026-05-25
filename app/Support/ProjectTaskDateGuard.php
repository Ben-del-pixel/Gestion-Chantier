<?php

namespace App\Support;

use App\Models\Project;
use Carbon\Carbon;

class ProjectTaskDateGuard
{
    public static function endDateExceedsProjectDeadline(Project $project, string $endDate): bool
    {
        if (! $project->deadline) {
            return false;
        }

        return Carbon::parse($endDate)->startOfDay()->gt(
            $project->deadline->copy()->startOfDay(),
        );
    }

    public static function validationMessage(Project $project): string
    {
        $deadlineLabel = $project->deadline?->format('d/m/Y') ?? 'non définie';

        return "La date de fin de la tâche ne peut pas dépasser la date limite du chantier ({$deadlineLabel}).";
    }
}
