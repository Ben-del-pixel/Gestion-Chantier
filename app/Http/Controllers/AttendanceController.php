<?php

namespace App\Http\Controllers;

use App\Enums\AttendanceShift;
use App\Enums\AttendanceStatus;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AttendanceController extends Controller
{
    private function canManageAttendance(Project $project, User $user): bool
    {
        if ($user->role === UserRole::Manager) {
            return true;
        }

        return $user->role === UserRole::Magasinier && $project->storekeeper_id === $user->id;
    }

    private function isAllowedAttendanceTargetForMagasinier(Project $project, int $targetUserId): bool
    {
        if ((int) $project->chef_chantier_id === $targetUserId) {
            return true;
        }

        return $project->workers()
            ->where('users.role', UserRole::Worker->value)
            ->where('users.id', $targetUserId)
            ->exists();
    }

    public function index(): Response
    {
        $user = request()->user();
        $userRoleValue = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;
        if (! in_array($userRoleValue, [
            UserRole::Manager->value,
            UserRole::Magasinier->value,
            UserRole::Engineer->value,
            UserRole::ChefChantier->value,
            UserRole::Worker->value,
        ], true)) {
            abort(403, 'Accès non autorisé au module de présence.');
        }

        $date = request('date') ? Carbon::parse(request('date')) : Carbon::today();
        $projectId = request('project_id');

        $query = Attendance::with('user', 'project')
            ->whereRaw('DATE(date) = ?', [$date->toDateString()]);

        $projectsQuery = Project::select('id', 'name')->orderBy('name');

        if ($userRoleValue === UserRole::Magasinier->value) {
            $projectsQuery->where('storekeeper_id', $user->id);
            if (! $projectId && $projectsQuery->count() === 1) {
                $projectId = $projectsQuery->value('id');
            }
        } elseif ($userRoleValue === UserRole::Engineer->value) {
            $projectsQuery->where('engineer_id', $user->id);
        } elseif ($userRoleValue === UserRole::ChefChantier->value) {
            $projectsQuery->where('chef_chantier_id', $user->id);
            if (! $projectId && $projectsQuery->count() === 1) {
                $projectId = $projectsQuery->value('id');
            }
        } elseif ($userRoleValue === UserRole::Worker->value) {
            $projectsQuery->whereHas('workers', function ($projectQuery) use ($user) {
                $projectQuery->where('users.id', $user->id);
            });
        }

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        if ($user->role === UserRole::Magasinier) {
            $query->whereHas('project', function ($projectQuery) use ($user) {
                $projectQuery->where('storekeeper_id', $user->id);
            });
        } elseif ($user->role === UserRole::Engineer) {
            $query->whereHas('project', function ($projectQuery) use ($user) {
                $projectQuery->where('engineer_id', $user->id);
            });
        } elseif ($user->role === UserRole::ChefChantier) {
            $query->whereHas('project', function ($projectQuery) use ($user) {
                $projectQuery->where('chef_chantier_id', $user->id);
            });
        } elseif ($user->role === UserRole::Worker) {
            $query->where('user_id', $user->id);
        }

        $query->where('shift', AttendanceShift::Morning->value);

        $attendances = $query->orderBy('check_in', 'desc')->get();

        // Count statistics (une entrée par personne et par jour — présence « journée »)
        $present = $attendances
            ->filter(fn ($a) => $a->check_in && ! $a->check_out)
            ->unique('user_id')
            ->count();
        $checked_out = $attendances->filter(fn ($a) => $a->check_out)->count();

        // Get workers based on user role
        $userRoleValue = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;

        if ($userRoleValue === UserRole::Magasinier->value) {
            $managedProjectIds = Project::where('storekeeper_id', $user->id)->pluck('id');
            $workers = User::whereIn('role', [UserRole::Worker->value, UserRole::ChefChantier->value])
                ->whereHas('projects', function ($projectQuery) use ($managedProjectIds) {
                    $projectQuery->whereIn('projects.id', $managedProjectIds);
                })
                ->select('id', 'name')
                ->orderBy('name')
                ->get();
            $chefIds = Project::whereIn('id', $managedProjectIds)
                ->whereNotNull('chef_chantier_id')
                ->pluck('chef_chantier_id');
            if ($chefIds->isNotEmpty()) {
                $chefs = User::whereIn('id', $chefIds)->select('id', 'name')->orderBy('name')->get();
                $workers = $workers->merge($chefs)->unique('id')->values();
            }
        } elseif ($userRoleValue === UserRole::Engineer->value) {
            $workers = User::where('role', UserRole::Worker->value)
                ->whereHas('projects', function ($projectQuery) use ($user) {
                    $projectQuery->where('projects.engineer_id', $user->id);
                })
                ->select('id', 'name')
                ->orderBy('name')
                ->get();
        } elseif ($userRoleValue === UserRole::ChefChantier->value) {
            $managedProjectIds = Project::where('chef_chantier_id', $user->id)->pluck('id');
            $workers = User::where('role', UserRole::Worker->value)
                ->whereHas('projects', function ($projectQuery) use ($managedProjectIds) {
                    $projectQuery->whereIn('projects.id', $managedProjectIds);
                })
                ->select('id', 'name')
                ->orderBy('name')
                ->get();
            $chefIds = Project::whereIn('id', $managedProjectIds)
                ->whereNotNull('chef_chantier_id')
                ->pluck('chef_chantier_id');
            if ($chefIds->isNotEmpty()) {
                $chefs = User::whereIn('id', $chefIds)->select('id', 'name')->orderBy('name')->get();
                $workers = $workers->merge($chefs)->unique('id')->values();
            }
        } elseif ($userRoleValue === UserRole::Worker->value) {
            $workers = User::where('id', $user->id)->select('id', 'name')->get();
        } else {
            $workers = User::where('role', UserRole::Worker->value)
                ->select('id', 'name')
                ->orderBy('name')
                ->get();
        }

        $attendedUserIds = $attendances
            ->filter(fn ($a) => $a->check_in !== null)
            ->pluck('user_id')
            ->unique();
        $absent = $workers->filter(fn ($w) => ! $attendedUserIds->contains($w->id))->count();

        $projects = $projectsQuery->get();
        $assignedTasks = collect();
        if ($userRoleValue === UserRole::Worker->value) {
            $assignedTasks = Task::with([
                'project:id,name',
                'workers' => fn ($q) => $q->withPivot(['executed_at']),
            ])
                ->whereHas('workers', function ($workersQuery) use ($user) {
                    $workersQuery->where('users.id', $user->id);
                })
                ->orderByRaw("CASE WHEN status = 'retard' THEN 0 WHEN status = 'en_cours' THEN 1 WHEN status = 'planifie' THEN 2 ELSE 3 END")
                ->orderBy('end_date')
                ->get();
        }

        // Get available statuses
        $statuses = array_map(
            fn (AttendanceStatus $status) => [
                'value' => $status->value,
                'label' => $status->label(),
                'color' => $status->color(),
            ],
            AttendanceStatus::cases()
        );

        return Inertia::render('attendance/index', [
            'attendances' => $attendances,
            'date' => $date->format('Y-m-d'),
            'statistics' => [
                'present' => $present,
                'checked_out' => $checked_out,
                'absent' => $absent,
                'total_workers' => $workers->count(),
            ],
            'projects' => $projects,
            'workers' => $workers,
            'statuses' => $statuses,
            'selectedProject' => $projectId,
            'assignedTasks' => $assignedTasks,
        ]);
    }

    public function apiList(): JsonResponse
    {
        $user = request()->user();
        $userRoleValue = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;
        if (! in_array($userRoleValue, [
            UserRole::Manager->value,
            UserRole::Magasinier->value,
            UserRole::Engineer->value,
            UserRole::ChefChantier->value,
            UserRole::Worker->value,
        ], true)) {
            abort(403, 'Accès non autorisé au module de présence.');
        }

        $date = request('date') ? Carbon::parse(request('date')) : Carbon::today();
        $projectId = request('project_id');

        $query = Attendance::with('user', 'project')
            ->whereRaw('DATE(date) = ?', [$date->toDateString()]);

        if ($projectId) {
            $query->where('project_id', $projectId);
            if ($user->role === UserRole::Magasinier) {
                $project = Project::findOrFail($projectId);
                if (! $this->canManageAttendance($project, $user)) {
                    abort(403, 'Vous ne pouvez gérer que la présence de votre chantier.');
                }
            } elseif ($user->role === UserRole::Engineer) {
                $project = Project::findOrFail($projectId);
                if ((int) $project->engineer_id !== (int) $user->id) {
                    abort(403, 'Vous ne pouvez consulter que la présence de vos chantiers.');
                }
            } elseif ($user->role === UserRole::ChefChantier) {
                $project = Project::findOrFail($projectId);
                if ((int) $project->chef_chantier_id !== (int) $user->id) {
                    abort(403, 'Vous ne pouvez consulter que la présence de vos chantiers.');
                }
            }
        } elseif ($user->role === UserRole::Magasinier) {
            $query->whereHas('project', function ($projectQuery) use ($user) {
                $projectQuery->where('storekeeper_id', $user->id);
            });
        } elseif ($user->role === UserRole::Engineer) {
            $query->whereHas('project', function ($projectQuery) use ($user) {
                $projectQuery->where('engineer_id', $user->id);
            });
        } elseif ($user->role === UserRole::ChefChantier) {
            $query->whereHas('project', function ($projectQuery) use ($user) {
                $projectQuery->where('chef_chantier_id', $user->id);
            });
        } elseif ($user->role === UserRole::Worker) {
            $query->where('user_id', $user->id);
        }

        $query->where('shift', AttendanceShift::Morning->value);

        $attendances = $query->orderBy('check_in', 'desc')->get();

        return response()->json([
            'attendances' => $attendances,
            'date' => $date->format('Y-m-d'),
        ]);
    }

    public function checkIn(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'project_id' => 'required|exists:projects,id',
            'status' => 'nullable|string|in:present,absent,retard,malade',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
        ]);

        $shift = AttendanceShift::Morning->value;
        $project = Project::findOrFail($validated['project_id']);
        if (! $this->canManageAttendance($project, $request->user())) {
            abort(403, 'Seuls le manager et le magasinier du chantier peuvent gérer la présence.');
        }
        if ($request->user()->role === UserRole::Magasinier
            && ! $this->isAllowedAttendanceTargetForMagasinier($project, (int) $validated['user_id'])) {
            abort(403, 'Le magasinier peut pointer seulement les ouvriers et le chef de chantier de son chantier.');
        }

        $dateString = Carbon::today()->toDateString();

        $attendance = Attendance::query()
            ->where('user_id', $validated['user_id'])
            ->where('project_id', $validated['project_id'])
            ->where('shift', $shift)
            ->whereRaw('DATE(date) = ?', [$dateString])
            ->first();

        if ($attendance?->check_in) {
            return back()->with('error', 'Une arrivée est déjà enregistrée pour cette journée.');
        }

        if (! $attendance) {
            $attendance = new Attendance([
                'user_id' => $validated['user_id'],
                'project_id' => $validated['project_id'],
                'date' => $dateString,
                'shift' => $shift,
            ]);
        }

        $attendance->fill([
            'check_in' => Carbon::now(),
            'status' => $validated['status'] ?? 'present',
            'latitude' => $validated['latitude'] ?? null,
            'longitude' => $validated['longitude'] ?? null,
        ]);
        $attendance->save();

        $attendance->load('user', 'project');

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'take_attendance',
            'description' => "Enregistrement de l'arrivée pour ".$attendance->user->name,
            'properties' => $attendance->toArray(),
        ]);

        return back()->with('success', 'Arrivée enregistrée pour '.$attendance->user->name);
    }

    public function checkOut(Request $request, Attendance $attendance)
    {
        if (! $this->canManageAttendance($attendance->project, $request->user())) {
            abort(403, 'Seuls le manager et le magasinier du chantier peuvent gérer la présence.');
        }

        if ($attendance->check_out) {
            return back()->with('error', 'Départ déjà enregistré pour cet ouvrier.');
        }

        $attendance->update([
            'check_out' => Carbon::now(),
        ]);

        $attendance->load('user', 'project');

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'take_attendance',
            'description' => 'Enregistrement du départ pour '.$attendance->user->name,
            'properties' => $attendance->toArray(),
        ]);

        return back()->with('success', 'Départ enregistré pour '.$attendance->user->name);
    }

    public function updateStatus(Request $request, Attendance $attendance): RedirectResponse|JsonResponse
    {
        if (! $this->canManageAttendance($attendance->project, $request->user())) {
            abort(403, 'Seuls le manager et le magasinier du chantier peuvent gérer la présence.');
        }

        $validated = $request->validate([
            'status' => 'required|string|in:present,absent,retard,malade',
        ]);

        $attendance->update([
            'status' => $validated['status'],
        ]);

        $attendance->load('user', 'project');

        if ($request->expectsJson()) {
            return response()->json([
                'attendance' => $attendance,
            ]);
        }

        return back()->with('success', 'Statut mis à jour avec succès');
    }

    public function workerOverview(Request $request): Response
    {
        $workerId = request('worker_id');
        $startDate = request('start_date') ? Carbon::parse(request('start_date')) : Carbon::today()->subDays(30);
        $endDate = request('end_date') ? Carbon::parse(request('end_date')) : Carbon::today();

        $worker = User::findOrFail($workerId);

        $query = Attendance::with('project')
            ->where('user_id', $workerId)
            ->whereBetween('date', [$startDate, $endDate])
            ->orderBy('date', 'desc');

        $attendances = $query->get();

        // Calculate statistics
        $presentDays = $attendances->filter(fn ($a) => $a->check_in)->count();
        $totalWorkingHours = $attendances->sum(function ($record) {
            if ($record->check_in && $record->check_out) {
                return Carbon::parse($record->check_in)->diffInHours(Carbon::parse($record->check_out));
            }

            return 0;
        });

        $avgHoursPerDay = $presentDays > 0 ? round($totalWorkingHours / $presentDays, 2) : 0;

        $projectsWorkedOn = $attendances
            ->pluck('project_id')
            ->unique()
            ->count();

        $workers = User::where('role', '!=', 'manager')
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('attendance/worker-overview', [
            'worker' => $worker,
            'attendances' => $attendances,
            'statistics' => [
                'present_days' => $presentDays,
                'total_working_hours' => $totalWorkingHours,
                'avg_hours_per_day' => $avgHoursPerDay,
                'projects_worked_on' => $projectsWorkedOn,
            ],
            'period' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
            ],
            'workers' => $workers,
            'selectedWorker' => $workerId,
        ]);
    }

    public function monthlyOverview(Request $request): Response
    {
        $month = request('month') ? Carbon::parse(request('month')) : Carbon::today();
        $projectId = request('project_id');

        $startDate = $month->copy()->startOfMonth();
        $endDate = $month->copy()->endOfMonth();

        $query = Attendance::with('user', 'project')
            ->whereBetween('date', [$startDate, $endDate]);

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        $attendances = $query->orderBy('date', 'desc')->get();

        // Group by user
        $userStats = User::where('role', '!=', 'manager')
            ->get()
            ->map(function ($user) use ($startDate, $endDate, $projectId) {
                $userAttendances = Attendance::where('user_id', $user->id)
                    ->whereBetween('date', [$startDate, $endDate]);

                if ($projectId) {
                    $userAttendances->where('project_id', $projectId);
                }

                $userAttendances = $userAttendances->get();

                $totalWorkingHours = $userAttendances->sum(function ($record) {
                    if ($record->check_in && $record->check_out) {
                        return Carbon::parse($record->check_in)->diffInHours(Carbon::parse($record->check_out));
                    }

                    return 0;
                });

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'present_days' => $userAttendances->filter(fn ($a) => $a->check_in)->count(),
                    'total_days' => $startDate->diffInDays($endDate) + 1,
                    'total_working_hours' => $totalWorkingHours,
                ];
            })
            ->filter(fn ($stat) => $stat['present_days'] > 0);

        $projects = Project::select('id', 'name')->orderBy('name')->get();

        return Inertia::render('attendance/monthly-overview', [
            'userStats' => $userStats->values(),
            'month' => $month->format('Y-m'),
            'projects' => $projects,
            'selectedProject' => $projectId,
        ]);
    }
}
