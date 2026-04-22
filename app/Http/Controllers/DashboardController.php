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
use Illuminate\Http\Request;
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
            'attendanceShifts' => [],
            'attendanceDate' => now()->toDateString(),
            'workerAttendances' => [],
            'workerAttendanceSummary' => [
                'present' => 0,
                'absent' => 0,
                'retard' => 0,
                'malade' => 0,
            ],
        ];

        if ($user->role === UserRole::Manager) {
            $data['projects'] = Project::with(['engineer', 'steps'])->latest()->get();
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
            $data['tasks'] = Task::whereHas('project', function ($q) use ($user) {
                $q->where('engineer_id', $user->id);
            })->with(['workers', 'project'])->latest()->get();

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

            $data['attendanceWorkers'] = User::where('role', UserRole::Worker)
                ->select('id', 'name', 'email')
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

            $data['attendanceShifts'] = array_map(
                fn (AttendanceShift $shift) => [
                    'value' => $shift->value,
                    'label' => $shift->label(),
                    'icon' => $shift->icon(),
                ],
                AttendanceShift::cases()
            );
        } elseif ($user->role === UserRole::Worker) {
            $data['tasks'] = $user->tasks()->with('project')->latest()->get();

            $attendances = Attendance::with('project:id,name')
                ->where('user_id', $user->id)
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
        }

        return Inertia::render('dashboard', $data);
    }
}
