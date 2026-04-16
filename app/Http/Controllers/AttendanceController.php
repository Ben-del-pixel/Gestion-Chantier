<?php

namespace App\Http\Controllers;

use App\Enums\AttendanceShift;
use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\Project;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AttendanceController extends Controller
{
    public function index(): Response
    {
        $date = request('date') ? Carbon::parse(request('date')) : Carbon::today();
        $projectId = request('project_id');

        $query = Attendance::with('user', 'project')
            ->whereRaw('DATE(date) = ?', [$date->toDateString()]);

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        $attendances = $query->orderBy('shift')->orderBy('check_in', 'desc')->get();

        // Count statistics
        $present = $attendances->filter(fn ($a) => $a->check_in && ! $a->check_out)->count();
        $checked_out = $attendances->filter(fn ($a) => $a->check_out)->count();
        $absent = User::where('role', '!=', 'manager')->count() - $attendances->count();

        $projects = Project::select('id', 'name')->orderBy('name')->get();
        $workers = User::where('role', 'worker')->select('id', 'name')->orderBy('name')->get();

        // Get available statuses
        $statuses = array_map(
            fn (AttendanceStatus $status) => [
                'value' => $status->value,
                'label' => $status->label(),
                'color' => $status->color(),
            ],
            AttendanceStatus::cases()
        );

        // Get available shifts
        $shifts = array_map(
            fn (AttendanceShift $shift) => [
                'value' => $shift->value,
                'label' => $shift->label(),
                'icon' => $shift->icon(),
            ],
            AttendanceShift::cases()
        );

        return Inertia::render('attendance/index', [
            'attendances' => $attendances,
            'date' => $date->format('Y-m-d'),
            'statistics' => [
                'present' => $present,
                'checked_out' => $checked_out,
                'absent' => $absent,
                'total_workers' => User::where('role', '!=', 'manager')->count(),
            ],
            'projects' => $projects,
            'workers' => $workers,
            'statuses' => $statuses,
            'shifts' => $shifts,
            'selectedProject' => $projectId,
        ]);
    }

    public function apiList(): JsonResponse
    {
        $date = request('date') ? Carbon::parse(request('date')) : Carbon::today();
        $projectId = request('project_id');

        $query = Attendance::with('user', 'project')
            ->whereRaw('DATE(date) = ?', [$date->toDateString()]);

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        $attendances = $query->orderBy('shift')->orderBy('check_in', 'desc')->get();

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
            'shift' => 'nullable|string|in:morning,evening',
            'status' => 'nullable|string|in:present,absent,retard,malade',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
        ]);

        $shift = $validated['shift'] ?? 'morning';
        $today = Carbon::today()->toDateString();

        // Check if already checked in for this shift today
        $existingAttendance = Attendance::where('user_id', $validated['user_id'])
            ->where('project_id', $validated['project_id'])
            ->whereDate('date', $today)
            ->where('shift', $shift)
            ->first();

        if ($existingAttendance && $existingAttendance->check_in && ! $existingAttendance->check_out) {
            return response()->json([
                'message' => "Déjà enregistré pour le shift de {$shift} aujourd'hui",
                'error' => true,
            ], 422);
        }

        // If already exists but checked out, update it; otherwise create new
        if ($existingAttendance) {
            $existingAttendance->update([
                'check_in' => Carbon::now(),
                'check_out' => null,
                'status' => $validated['status'] ?? 'present',
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
            ]);
            $attendance = $existingAttendance;
        } else {
            $attendance = Attendance::create([
                'user_id' => $validated['user_id'],
                'project_id' => $validated['project_id'],
                'date' => Carbon::today(),
                'shift' => $shift,
                'check_in' => Carbon::now(),
                'status' => $validated['status'] ?? 'present',
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
            ]);
        }

        $attendance->load('user', 'project');

        return response()->json([
            'message' => 'Arrivée enregistrée',
            'attendance' => $attendance,
        ], 201);
    }

    public function checkOut(Request $request, Attendance $attendance)
    {
        if ($attendance->check_out) {
            return response()->json([
                'message' => 'Déjà enregistré',
                'error' => true,
            ], 422);
        }

        $attendance->update([
            'check_out' => Carbon::now(),
        ]);

        $attendance->load('user', 'project');

        return response()->json([
            'message' => 'Départ enregistré',
            'attendance' => $attendance,
        ]);
    }

    public function updateStatus(Request $request, Attendance $attendance)
    {
        $validated = $request->validate([
            'status' => 'required|string|in:present,absent,retard,malade',
        ]);

        $attendance->update([
            'status' => $validated['status'],
        ]);

        $attendance->load('user', 'project');

        return response()->json([
            'message' => 'Statut mis à jour',
            'attendance' => $attendance,
        ]);
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
