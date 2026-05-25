<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Project;
use App\Models\ReportSubmission;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(): Response
    {
        $user = request()->user();
        $userRoleValue = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;

        // Filter projects based on user role
        if ($user->role === UserRole::ChefChantier) {
            $projects = Project::select('id', 'name')
                ->where('chef_chantier_id', $user->id)
                ->orderBy('name')
                ->get();
        } elseif ($user->role === UserRole::Engineer) {
            $chefChantierIds = User::query()
                ->where('engineer_id', $user->id)
                ->where('role', UserRole::ChefChantier)
                ->pluck('id');
            $projects = Project::select('id', 'name')
                ->where(function ($query) use ($user, $chefChantierIds) {
                    $query->where('engineer_id', $user->id)
                        ->orWhereIn('chef_chantier_id', $chefChantierIds);
                })
                ->orderBy('name')
                ->get();
        } else {
            $projects = Project::select('id', 'name')->orderBy('name')->get();
        }

        $receivedReports = ReportSubmission::with(['sender:id,name,role', 'project:id,name'])
            ->where('recipient_id', $user->id)
            ->latest()
            ->take(20)
            ->get();

        $sentReports = ReportSubmission::with(['recipient:id,name,role', 'project:id,name'])
            ->where('sender_id', $user->id)
            ->latest()
            ->take(20)
            ->get();

        $potentialRecipients = [];
        if ($user->role === UserRole::Manager) {
            $potentialRecipients = User::where('role', '!=', UserRole::Manager)
                ->orderBy('role')
                ->orderBy('name')
                ->get(['id', 'name', 'role']);
        }

        return Inertia::render('reports/index', [
            'reportTypes' => [
                ['value' => 'global', 'label' => 'Rapport Global'],
                ['value' => 'project', 'label' => 'Rapport par Projet'],
                ['value' => 'worker', 'label' => 'Rapport par Ouvrier'],
                ['value' => 'activities', 'label' => 'Rapport d\'Activités'],
            ],
            'projects' => $projects,
            'receivedReports' => $receivedReports,
            'sentReports' => $sentReports,
            'potentialRecipients' => $potentialRecipients,
            'canSubmitReport' => in_array($userRoleValue, [
                UserRole::Worker->value,
                UserRole::Magasinier->value,
                UserRole::Engineer->value,
                UserRole::ChefChantier->value,
                UserRole::Manager->value,
            ], true),
            'submitTargetLabel' => $this->resolveTargetLabel($userRoleValue),
        ]);
    }

    public function submit(Request $request)
    {
        $user = $request->user();
        $userRoleValue = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;

        if (! in_array($userRoleValue, [
            UserRole::Worker->value,
            UserRole::Magasinier->value,
            UserRole::Engineer->value,
            UserRole::ChefChantier->value,
            UserRole::Manager->value,
        ], true)) {
            abort(403, 'Ce role ne peut pas soumettre de rapport.');
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'min:20'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'recipient_id' => ['nullable', 'exists:users,id'],
        ]);

        $recipientId = $validated['recipient_id'] ?? $this->resolveRecipientIdForUser($user, $userRoleValue, $validated['project_id'] ?? null);

        if (! $recipientId) {
            return back()->withErrors([
                'recipient' => 'Aucun destinataire valide n\'a ete trouve pour ce rapport.',
            ]);
        }

        ReportSubmission::create([
            'title' => $validated['title'],
            'content' => $validated['content'],
            'project_id' => $validated['project_id'] ?? null,
            'sender_id' => $user->id,
            'recipient_id' => (int) $recipientId,
            'status' => 'submitted',
        ]);

        return to_route('reports.index')->with('success', 'Rapport soumis avec succes.');
    }

    private function resolveTargetLabel(string $role): string
    {
        return match ($role) {
            UserRole::Manager->value => 'Destinataire au choix',
            UserRole::Engineer->value => 'Manager',
            UserRole::ChefChantier->value => 'Ingénieur',
            UserRole::Worker->value, UserRole::Magasinier->value => 'Ingénieur',
            default => 'Destinataire',
        };
    }

    private function resolveRecipientIdForUser(User $user, string $userRoleValue, ?int $projectId = null): ?int
    {
        // Chef de Chantier reports go to Engineer of the project
        if ($userRoleValue === UserRole::ChefChantier->value) {
            if ($projectId) {
                $projectEngineerId = Project::where('id', $projectId)->value('engineer_id');
                if ($projectEngineerId) {
                    return (int) $projectEngineerId;
                }
            }

            // If no project specified, find the engineer the chef is under
            $engineerId = User::where('id', $user->id)->value('engineer_id');
            if ($engineerId) {
                return (int) $engineerId;
            }

            return User::where('role', UserRole::Engineer->value)->value('id');
        }

        if ($userRoleValue === UserRole::Engineer->value) {
            if ($projectId) {
                $projectManagerId = Project::where('id', $projectId)->value('manager_id');
                if ($projectManagerId) {
                    return (int) $projectManagerId;
                }
            }

            return User::where('role', UserRole::Manager->value)->value('id');
        }

        if (in_array($userRoleValue, [UserRole::Worker->value, UserRole::Magasinier->value], true)) {
            $engineerId = null;
            if ($projectId) {
                $engineerId = Project::where('id', $projectId)->value('engineer_id');
            }
            if (! $engineerId) {
                $engineerId = Project::query()
                    ->whereHas('workers', function ($query) use ($user) {
                        $query->where('users.id', $user->id);
                    })
                    ->whereNotNull('engineer_id')
                    ->value('engineer_id');
            }

            if ($engineerId) {
                return (int) $engineerId;
            }

            return User::where('role', UserRole::Engineer->value)->value('id');
        }

        return null;
    }

    private function engineerHasProjectAccess(User $engineer, Project $project): bool
    {
        if ((int) $project->engineer_id === (int) $engineer->id) {
            return true;
        }

        if (! $project->chef_chantier_id) {
            return false;
        }

        $chef = User::query()->find($project->chef_chantier_id);

        return $chef
            && $chef->role === UserRole::ChefChantier
            && (int) $chef->engineer_id === (int) $engineer->id;
    }

    private function userCanAccessProjectForReport(User $user, UserRole $role, int $projectId): bool
    {
        $project = Project::query()->find($projectId);
        if (! $project) {
            return false;
        }

        return match ($role) {
            UserRole::Manager => true,
            UserRole::Engineer => $this->engineerHasProjectAccess($user, $project),
            UserRole::ChefChantier => (int) $project->chef_chantier_id === (int) $user->id,
            UserRole::Worker => $project->workers()->where('users.id', $user->id)->exists(),
            UserRole::Magasinier => (int) $project->storekeeper_id === (int) $user->id,
            default => false,
        };
    }

    private function userCanAccessWorkerForReport(User $user, UserRole $role, int $workerId): bool
    {
        $target = User::query()->find($workerId);
        if (! $target) {
            return false;
        }

        if ($role === UserRole::Worker) {
            return (int) $workerId === (int) $user->id;
        }

        if ($role === UserRole::Engineer) {
            $chefIds = User::query()
                ->where('engineer_id', $user->id)
                ->where('role', UserRole::ChefChantier)
                ->pluck('id');

            return Task::query()
                ->whereHas('workers', function ($q) use ($workerId) {
                    $q->where('users.id', $workerId);
                })
                ->whereHas('project', function ($q) use ($user, $chefIds) {
                    $q->where('engineer_id', $user->id)
                        ->orWhereIn('chef_chantier_id', $chefIds);
                })
                ->exists();
        }

        if ($role === UserRole::ChefChantier) {
            return Task::query()
                ->whereHas('workers', function ($q) use ($workerId) {
                    $q->where('users.id', $workerId);
                })
                ->whereHas('project', function ($q) use ($user) {
                    $q->where('chef_chantier_id', $user->id);
                })
                ->exists();
        }

        if ($role === UserRole::Magasinier) {
            return Task::query()
                ->whereHas('workers', function ($q) use ($workerId) {
                    $q->where('users.id', $workerId);
                })
                ->whereHas('project', function ($q) use ($user) {
                    $q->where('storekeeper_id', $user->id);
                })
                ->exists();
        }

        return false;
    }

    private function assertUserCanGenerateReport(User $user, UserRole $role, array $validated): void
    {
        $type = $validated['type'];
        $projectId = isset($validated['project_id']) ? (int) $validated['project_id'] : null;
        $workerId = isset($validated['worker_id']) ? (int) $validated['worker_id'] : null;

        if ($role === UserRole::Manager) {
            return;
        }

        if (in_array($type, ['global', 'activities'], true)) {
            abort(403, 'Ce type de rapport est réservé au manager.');
        }

        if ($type === 'project') {
            if (! $projectId) {
                abort(422, 'Sélectionnez un projet pour générer ce rapport.');
            }
            if (! $this->userCanAccessProjectForReport($user, $role, $projectId)) {
                abort(403, 'Accès non autorisé à ce projet.');
            }
        }

        if ($type === 'worker') {
            if (! $workerId) {
                abort(422, 'Sélectionnez un ouvrier pour générer ce rapport.');
            }
            if (! $this->userCanAccessWorkerForReport($user, $role, $workerId)) {
                abort(403, 'Accès non autorisé pour ce profil.');
            }
        }
    }

    public function generate(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:global,project,worker,activities',
            'project_id' => 'nullable|exists:projects,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'worker_id' => 'nullable|exists:users,id',
        ]);

        $user = $request->user();
        $role = $user->role instanceof UserRole ? $user->role : UserRole::from((string) $user->role);
        $this->assertUserCanGenerateReport($user, $role, $validated);

        $reportType = $validated['type'];
        $startDate = isset($validated['start_date']) && $validated['start_date'] !== null && $validated['start_date'] !== ''
            ? Carbon::parse($validated['start_date'])
            : null;
        $endDate = isset($validated['end_date']) && $validated['end_date'] !== null && $validated['end_date'] !== ''
            ? Carbon::parse($validated['end_date'])
            : null;

        $report = match ($reportType) {
            'global' => $this->generateGlobalReport($startDate, $endDate),
            'project' => $this->generateProjectReport($validated['project_id'] ?? null, $startDate, $endDate),
            'worker' => $this->generateWorkerReport($validated['worker_id'] ?? null, $startDate, $endDate),
            'activities' => $this->generateActivitiesReport($startDate, $endDate),
            default => [],
        };

        if (! $role->canViewBudget()) {
            $report = $this->stripBudgetFromReportData($report, $reportType);
        }

        return response()->json([
            'type' => $reportType,
            'period' => [
                'start_date' => $startDate?->format('Y-m-d'),
                'end_date' => $endDate?->format('Y-m-d'),
            ],
            'data' => $report,
        ]);
    }

    private function stripBudgetFromReportData(mixed $report, string $reportType): mixed
    {
        if ($reportType === 'global' && is_array($report)) {
            unset($report['summary']['total_budget']);

            return $report;
        }

        if ($reportType === 'project' && is_array($report)) {
            return array_map(function (array $project) {
                unset($project['budget'], $project['budget_from_steps']);

                return $project;
            }, $report);
        }

        return $report;
    }

    private function generateGlobalReport(?Carbon $startDate, ?Carbon $endDate): array
    {
        $projectsQuery = Project::query();
        $tasksQuery = Task::query();
        $activitiesQuery = ActivityLog::query();
        $attendanceQuery = Attendance::query();

        if ($startDate) {
            $projectsQuery->where('created_at', '>=', $startDate);
            $tasksQuery->where('created_at', '>=', $startDate);
            $activitiesQuery->where('created_at', '>=', $startDate);
            $attendanceQuery->where('date', '>=', $startDate->format('Y-m-d'));
        }

        if ($endDate) {
            $projectsQuery->where('created_at', '<=', $endDate);
            $tasksQuery->where('created_at', '<=', $endDate);
            $activitiesQuery->where('created_at', '<=', $endDate);
            $attendanceQuery->where('date', '<=', $endDate->format('Y-m-d'));
        }

        $totalProjects = $projectsQuery->count();
        $activeProjects = $projectsQuery->where('status', '!=', 'termine')->count();
        $completedProjects = $projectsQuery->where('status', 'termine')->count();

        $totalTasks = $tasksQuery->count();
        $completedTasks = $tasksQuery->where('status', 'termine')->count();

        $totalBudget = $projectsQuery->sum('budget');
        $totalWorkers = User::where('role', '!=', 'manager')->count();

        $attendanceRecords = $attendanceQuery->get();
        $totalWorkingHours = $attendanceRecords->sum(function ($record) {
            if ($record->check_in && $record->check_out) {
                return Carbon::parse($record->check_in)->diffInHours(Carbon::parse($record->check_out));
            }

            return 0;
        });

        $activitiesByAction = $activitiesQuery
            ->groupBy('action')
            ->selectRaw('action, COUNT(*) as count')
            ->get()
            ->mapWithKeys(fn ($item) => [$item->action => $item->count])
            ->toArray();

        return [
            'summary' => [
                'total_projects' => $totalProjects,
                'active_projects' => $activeProjects,
                'completed_projects' => $completedProjects,
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'total_budget' => (float) $totalBudget,
                'total_workers' => $totalWorkers,
                'total_working_hours' => $totalWorkingHours,
            ],
            'projects_by_status' => Project::selectRaw('status, COUNT(*) as count')
                ->groupBy('status')
                ->get()
                ->mapWithKeys(fn ($item) => [$item->status => $item->count])
                ->toArray(),
            'activities' => $activitiesByAction,
        ];
    }

    private function generateProjectReport(?int $projectId, ?Carbon $startDate, ?Carbon $endDate): array
    {
        $query = Project::with('tasks', 'manager', 'engineer', 'steps');

        if ($projectId) {
            $query->where('id', $projectId);
        }

        if ($startDate) {
            $query->where('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('created_at', '<=', $endDate);
        }

        $projects = $query->get();

        return $projects->map(function ($project) {
            $tasks = $project->tasks;
            $totalBudgetSteps = $project->steps->sum('budget');
            $workers = collect($tasks)->flatMap(fn ($task) => $task->workers)->unique('id');

            return [
                'id' => $project->id,
                'name' => $project->name,
                'description' => $project->description,
                'status' => $project->status,
                'start_date' => $project->start_date?->format('Y-m-d') ?? '—',
                'deadline' => $project->deadline?->format('Y-m-d') ?? '—',
                'budget' => (float) $project->budget,
                'budget_from_steps' => (float) $totalBudgetSteps,
                'manager' => $project->manager?->name,
                'engineer' => $project->engineer?->name,
                'total_tasks' => $tasks->count(),
                'completed_tasks' => $tasks->where('status', 'termine')->count(),
                'total_workers' => $workers->count(),
                'total_steps' => $project->steps->count(),
            ];
        })->toArray();
    }

    private function generateWorkerReport(?int $workerId, ?Carbon $startDate, ?Carbon $endDate): array
    {
        $query = User::where('role', '!=', 'manager');

        if ($workerId) {
            $query->where('id', $workerId);
        }

        $workers = $query->with('tasks')->get();

        return $workers->map(function ($worker) use ($startDate, $endDate) {
            $attendanceQuery = Attendance::where('user_id', $worker->id);

            if ($startDate) {
                $attendanceQuery->where('date', '>=', $startDate->format('Y-m-d'));
            }

            if ($endDate) {
                $attendanceQuery->where('date', '<=', $endDate->format('Y-m-d'));
            }

            $attendanceRecords = $attendanceQuery->get();

            $totalWorkingHours = $attendanceRecords->sum(function ($record) {
                if ($record->check_in && $record->check_out) {
                    return Carbon::parse($record->check_in)->diffInHours(Carbon::parse($record->check_out));
                }

                return 0;
            });

            $projectsWorkedOn = $worker->tasks
                ->map(fn ($task) => $task->project_id)
                ->unique()
                ->count();

            $tasksCompleted = $worker->tasks->where('status', 'termine')->count();

            return [
                'id' => $worker->id,
                'name' => $worker->name,
                'email' => $worker->email,
                'role' => $worker->role,
                'total_tasks' => $worker->tasks->count(),
                'completed_tasks' => $tasksCompleted,
                'projects_worked_on' => $projectsWorkedOn,
                'attendance_days' => $attendanceRecords->count(),
                'total_working_hours' => $totalWorkingHours,
                'avg_hours_per_day' => $attendanceRecords->count() > 0 ? round($totalWorkingHours / $attendanceRecords->count(), 2) : 0,
            ];
        })->toArray();
    }

    private function generateActivitiesReport(?Carbon $startDate, ?Carbon $endDate): array
    {
        $query = ActivityLog::with('user');

        if ($startDate) {
            $query->where('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('created_at', '<=', $endDate);
        }

        $activities = $query->latest()->get();

        $actionStats = ActivityLog::query();

        if ($startDate) {
            $actionStats->where('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $actionStats->where('created_at', '<=', $endDate);
        }

        $actionStats = $actionStats
            ->selectRaw('action, COUNT(*) as count')
            ->groupBy('action')
            ->get()
            ->mapWithKeys(fn ($item) => [$item->action => $item->count])
            ->toArray();

        $userStats = ActivityLog::query();

        if ($startDate) {
            $userStats->where('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $userStats->where('created_at', '<=', $endDate);
        }

        $userStats = $userStats
            ->selectRaw('user_id, COUNT(*) as count')
            ->groupBy('user_id')
            ->with('user')
            ->get()
            ->map(fn ($item) => [
                'user_id' => $item->user_id,
                'user_name' => $item->user?->name,
                'count' => $item->count,
            ])
            ->toArray();

        return [
            'total_activities' => $activities->count(),
            'action_statistics' => $actionStats,
            'user_statistics' => $userStats,
            'recent_activities' => $activities->take(50)->map(function ($activity) {
                return [
                    'id' => $activity->id,
                    'user' => $activity->user?->name,
                    'action' => $activity->action,
                    'description' => $activity->description,
                    'timestamp' => $activity->created_at->format('Y-m-d H:i:s'),
                ];
            })->toArray(),
        ];
    }
}
