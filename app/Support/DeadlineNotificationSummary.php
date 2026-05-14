<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\User;
use App\Notifications\ProjectDeadlineAlertNotification;

final class DeadlineNotificationSummary
{
    /**
     * @return array{unread_count: int, items: list<array{id: string, title: string, message: string, project_id: int, kind: string}>}
     */
    public static function forUser(?User $user): array
    {
        if ($user === null) {
            return ['unread_count' => 0, 'items' => []];
        }

        $notifications = $user->unreadNotifications()
            ->where('type', ProjectDeadlineAlertNotification::class)
            ->latest()
            ->take(15)
            ->get();

        return [
            'unread_count' => $notifications->count(),
            'items' => $notifications->map(static function ($n): array {
                /** @var array<string, mixed> $data */
                $data = $n->data;

                return [
                    'id' => (string) $n->id,
                    'title' => (string) ($data['title'] ?? ''),
                    'message' => (string) ($data['message'] ?? ''),
                    'project_id' => (int) ($data['project_id'] ?? 0),
                    'kind' => (string) ($data['kind'] ?? ''),
                ];
            })->values()->all(),
        ];
    }
}
