<?php

namespace App\Http\Controllers;

use App\Enums\AttendanceShift;
use App\Enums\AttendanceStatus;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Material;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\ProjectDeadlineAlertNotifier;
use App\Support\ProjectDeadlineAlerts;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $data = [
            'projects' => [],
            'stats' => [
                'total_budget' => 0,
                'active_projects' => 0,
                'total_workers' => 0,
                'total_tasks' => 0,
            ],
            'tasks' => [],
            'attendanceProjects' => [],
            'attendanceWorkers' => [],
            'attendanceStatuses' => [],
            'attendanceDate' => now()->toDateString(),
            'workerAttendances' => [],
            'workerAttendanceSummary' => [
                'present' => 0,
                'absent' => 0,
                'retard' => 0,
                'malade' => 0,
            ],
            'workerIncidents' => [],
            'workerProjects' => [],
            'receivedWorkerIncidents' => [],
            'canResolveWorkerIncidents' => false,
            'projectDeadlineAlerts' => [
                'overdue' => [],
                'ending_soon' => [],
            ],
        ];

        if ($user->role === UserRole::Manager) {
            $data['projects'] = Project::with(['engineer', 'steps'])->latest()->get();
            $data['projectDeadlineAlerts'] = ProjectDeadlineAlerts::fromProjects($data['projects']);
            $data['stats'] = [
                'total_budget' => Project::sum('budget'),
                'active_projects' => Project::where('status', 'en_cours')->count(),
                'total_workers' => User::where('role', UserRole::Worker)->count(),
                'total_materials' => Material::sum('quantity_in_stock'),
                'total_tasks' => Task::count(),
            ];
            $data['recentActivities'] = ActivityLog::with('user')->latest()->take(5)->get();
            $data['materialDistribution'] = Material::select('category', DB::raw('sum(quantity_in_stock) as total'))
                ->groupBy('category')
                ->get()
                ->map(fn ($m) => [
                    'label' => $m->category ?: 'Autre',
                    'total' => (float) $m->total,
                ]);

            $data['engineers'] = User::whereIn('role', [UserRole::Engineer, UserRole::ChefChantier])->get(['id', 'name', 'email']);
        } elseif ($user->role === UserRole::Engineer) {
            $chefChantierIds = User::where('engineer_id', $user->id)->pluck('id');
            $engineerProjectsForAlerts = Project::query()
                ->where(function ($q) use ($user, $chefChantierIds) {
                    $q->where('engineer_id', $user->id)
                        ->orWhereIn('chef_chantier_id', $chefChantierIds);
                })
                ->get(['id', 'name', 'deadline', 'status']);
            $data['projectDeadlineAlerts'] = ProjectDeadlineAlerts::fromProjects($engineerProjectsForAlerts);

            $data['tasks'] = Task::whereHas('project', function ($q) use ($user) {
                $q->where('engineer_id', $user->id);
            })->with([
                'project',
                'workers' => fn ($q) => $q->withPivot(['executed_at']),
            ])->latest()->get();

            $data['stats'] = [
                'active_tasks' => Task::whereHas('project', function ($q) use ($user) {
                    $q->where('engineer_id', $user->id);
                })->where('status', 'en_cours')->count(),
                'total_workers_under' => User::whereHas('tasks', function ($q) use ($user) {
                    $q->whereHas('project', function ($pq) use ($user) {
                        $pq->where('engineer_id', $user->id);
                    });
                })->distinct()->count(),
            ];

            $data['attendanceProjects'] = Project::where('engineer_id', $user->id)
                ->select('id', 'name')
                ->orderBy('name')
                ->get();

            $data['attendanceWorkers'] = User::whereIn('role', [UserRole::Worker, UserRole::Magasinier])
                ->select('id', 'name', 'email', 'role')
                ->orderBy('name')
                ->get();

            $data['attendanceStatuses'] = array_map(
                fn (AttendanceStatus $status) => [
                    'value' => $status->value,
                    'label' => $status->label(),
                    'color' => $status->color(),
                ],
                AttendanceStatus::cases()
            );

            $data['receivedWorkerIncidents'] = $this->workerDeclaredIncidentsForProjectIds(
                Project::where('engineer_id', $user->id)->pluck('id')
            );
            $data['canResolveWorkerIncidents'] = true;
        } elseif ($user->role === UserRole::ChefChantier) {
            $chefProjectsForAlerts = Project::where('chef_chantier_id', $user->id)
                ->get(['id', 'name', 'deadline', 'status']);
            $data['projectDeadlineAlerts'] = ProjectDeadlineAlerts::fromProjects($chefProjectsForAlerts);

            $data['tasks'] = Task::whereHas('project', function ($q) use ($user) {
                $q->where('chef_chantier_id', $user->id);
            })->with([
                'project',
                'workers' => fn ($q) => $q->withPivot(['executed_at']),
            ])->latest()->get();

            $data['stats'] = [
                'active_tasks' => Task::whereHas('project', function ($q) use ($user) {
                    $q->where('chef_chantier_id', $user->id);
                })->where('status', 'en_cours')->count(),
                'total_workers_under' => User::where('role', UserRole::Worker)
                    ->where('chef_chantier_id', $user->id)
                    ->count(),
            ];

            $data['attendanceProjects'] = Project::where('chef_chantier_id', $user->id)
                ->select('id', 'name')
                ->orderBy('name')
                ->get();

            $data['attendanceWorkers'] = User::whereIn('role', [UserRole::Worker, UserRole::Magasinier])
                ->where('chef_chantier_id', $user->id)
                ->select('id', 'name', 'email', 'role')
                ->orderBy('name')
                ->get();

            $data['attendanceStatuses'] = array_map(
                fn (AttendanceStatus $status) => [
                    'value' => $status->value,
                    'label' => $status->label(),
                    'color' => $status->color(),
                ],
                AttendanceStatus::cases()
            );

            $data['receivedWorkerIncidents'] = $this->workerDeclaredIncidentsForProjectIds(
                Project::where('chef_chantier_id', $user->id)->pluck('id')
            );
            $data['canResolveWorkerIncidents'] = true;
        } elseif ($user->role === UserRole::Worker) {
            $data['tasks'] = $user->tasks()->with([
                'project',
                'workers' => fn ($q) => $q->withPivot(['executed_at']),
            ])->latest()->get();

            $taskProjectIds = $data['tasks']->pluck('project_id')->filter()->unique()->values();
            $pivotProjectIds = $user->projects()->pluck('projects.id');
            $allWorkerProjectIds = $taskProjectIds->merge($pivotProjectIds)->unique()->values();
            $data['workerProjects'] = $allWorkerProjectIds->isNotEmpty()
                ? Project::query()
                    ->whereIn('id', $allWorkerProjectIds)
                    ->select('id', 'name')
                    ->orderBy('name')
                    ->get()
                : collect();

            $attendances = Attendance::with('project:id,name')
                ->where('user_id', $user->id)
                ->where('shift', AttendanceShift::Morning->value)
                ->latest('date')
                ->latest('id')
                ->get();

            $data['workerAttendances'] = $attendances;
            $data['workerAttendanceSummary'] = [
                'present' => $attendances->where('status', AttendanceStatus::Present->value)->count(),
                'absent' => $attendances->where('status', AttendanceStatus::Absent->value)->count(),
                'retard' => $attendances->where('status', AttendanceStatus::Late->value)->count(),
                'malade' => $attendances->where('status', AttendanceStatus::Sick->value)->count(),
            ];

            $data['workerIncidents'] = ActivityLog::query()
                ->where('user_id', $user->id)
                ->where('action', 'incident_declared')
                ->latest()
                ->take(50)
                ->get();
        }

        $alerts = $data['projectDeadlineAlerts'];
        $hasDeadlineAlerts = count($alerts['overdue']) > 0 || count($alerts['ending_soon']) > 0;

        if ($hasDeadlineAlerts && in_array($user->role, [UserRole::Manager, UserRole::Engineer, UserRole::ChefChantier], true)) {
            app(ProjectDeadlineAlertNotifier::class)->notifyStakeholders($alerts);
        }

        return Inertia::render('dashboard', $data);
    }

    /**
     * @return Collection<int, ActivityLog>
     */
    private function workerDeclaredIncidentsForProjectIds(Collection $projectIds): Collection
    {
        if ($projectIds->isEmpty()) {
            return collect();
        }

        $ids = $projectIds->map(fn ($id) => (int) $id)->all();

        return ActivityLog::query()
            ->with('user:id,name')
            ->where('action', 'incident_declared')
            ->latest()
            ->take(100)
            ->get()
            ->filter(function (ActivityLog $log) use ($ids) {
                $pid = (int) ($log->properties['project_id'] ?? 0);

                return $pid !== 0 && in_array($pid, $ids, true);
            })
            ->values()
            ->take(25);
    }
}
