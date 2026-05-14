<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class ProjectDeadlineAlertNotification extends Notification
{
    use Queueable;

    /**
     * @param  'ending_soon'|'overdue'  $kind
     */
    public function __construct(
        public int $projectId,
        public string $projectName,
        public string $deadline,
        public string $kind,
        public ?int $daysRemaining,
        public ?int $daysOverdue,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        $isOverdue = $this->kind === 'overdue';
        $title = $isOverdue ? 'Échéance dépassée' : 'Échéance proche';

        if ($isOverdue) {
            $days = (int) ($this->daysOverdue ?? 0);
            $message = sprintf(
                'Le chantier « %s » a dépassé son échéance du %s (%s jour%s).',
                $this->projectName,
                $this->formatDeadline(),
                $days,
                $days > 1 ? 's' : ''
            );
        } else {
            $days = (int) ($this->daysRemaining ?? 0);
            $message = sprintf(
                'Le chantier « %s » se termine dans %s jour%s (échéance le %s).',
                $this->projectName,
                $days,
                $days > 1 ? 's' : '',
                $this->formatDeadline()
            );
        }

        return [
            'title' => $title,
            'message' => $message,
            'project_id' => $this->projectId,
            'project_name' => $this->projectName,
            'deadline' => $this->deadline,
            'kind' => $this->kind,
            'days_remaining' => $this->daysRemaining,
            'days_overdue' => $this->daysOverdue,
        ];
    }

    private function formatDeadline(): string
    {
        try {
            return \Carbon\Carbon::parse($this->deadline)->translatedFormat('d M Y');
        } catch (\Throwable) {
            return $this->deadline;
        }
    }
}
