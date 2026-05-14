<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Notifications\ProjectDeadlineAlertNotification;
use Illuminate\Support\Facades\DB;

final class ProjectDeadlineAlertNotifier
{
    /**
     * @param  array{overdue: list<array<string, mixed>>, ending_soon: list<array<string, mixed>>}  $alerts
     */
    public function notifyStakeholders(array $alerts): void
    {
        foreach ($alerts['overdue'] ?? [] as $row) {
            $this->notifyStakeholdersForRow($row, 'overdue');
        }

        foreach ($alerts['ending_soon'] ?? [] as $row) {
            $this->notifyStakeholdersForRow($row, 'ending_soon');
        }
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  'ending_soon'|'overdue'  $kind
     */
    private function notifyStakeholdersForRow(array $row, string $kind): void
    {
        $projectId = (int) ($row['id'] ?? 0);

        if ($projectId === 0) {
            return;
        }

        $project = Project::query()->find($projectId);

        if ($project === null) {
            return;
        }

        $recipientIds = array_values(array_unique(array_filter([
            $project->manager_id,
            $project->engineer_id,
            $project->chef_chantier_id,
        ], static fn ($id) => $id !== null && (int) $id > 0)));

        foreach ($recipientIds as $userId) {
            $user = User::query()->find((int) $userId);

            if ($user === null) {
                continue;
            }

            if ($this->alreadyNotifiedToday($user, $projectId, $kind)) {
                continue;
            }

            $user->notify(new ProjectDeadlineAlertNotification(
                projectId: $projectId,
                projectName: (string) $project->name,
                deadline: (string) ($row['deadline'] ?? $project->deadline?->format('Y-m-d') ?? ''),
                kind: $kind,
                daysRemaining: isset($row['days_remaining']) ? (int) $row['days_remaining'] : null,
                daysOverdue: isset($row['days_overdue']) ? (int) $row['days_overdue'] : null,
            ));
        }
    }

    private function alreadyNotifiedToday(User $user, int $projectId, string $kind): bool
    {
        return DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id)
            ->where('type', ProjectDeadlineAlertNotification::class)
            ->whereDate('created_at', now()->toDateString())
            ->where('data->project_id', $projectId)
            ->where('data->kind', $kind)
            ->exists();
    }
}
