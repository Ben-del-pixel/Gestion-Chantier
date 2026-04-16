<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Project;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceInitializationController extends Controller
{
    /**
     * Initialize attendance records for a project on a specific date.
     * Creates attendance records for all workers assigned to the project.
     * If no workers are assigned, uses all workers.
     */
    public function initializeForProject(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'project_id' => 'required|exists:projects,id',
            'shifts' => 'nullable|array',
            'shifts.*' => 'string|in:morning,evening',
        ]);

        $project = Project::findOrFail($validated['project_id']);
        $date = Carbon::parse($validated['date'])->startOfDay();
        $shifts = $validated['shifts'] ?? ['morning', 'evening'];

        // Get all workers assigned to this project, or all workers if none assigned
        $workers = $project->workers()->get();
        if ($workers->isEmpty()) {
            $workers = User::where('role', 'worker')->get();
        }

        $created = 0;
        $errors = [];
        $dateString = $date->toDateString();

        foreach ($workers as $worker) {
            foreach ($shifts as $shift) {
                try {
                    // Check using raw where to handle SQLite date comparisons correctly
                    $exists = Attendance::where('user_id', $worker->id)
                        ->where('project_id', $project->id)
                        ->where('shift', $shift)
                        ->whereRaw('DATE(date) = ?', [$dateString])
                        ->exists();

                    if (! $exists) {
                        Attendance::create([
                            'user_id' => $worker->id,
                            'project_id' => $project->id,
                            'date' => $dateString,
                            'shift' => $shift,
                            'status' => 'present',
                        ]);
                        $created++;
                    }
                } catch (\Exception $e) {
                    // Log the error
                    $errors[] = "Worker {$worker->id}, shift {$shift}: {$e->getMessage()}";
                    \Log::warning("Failed to create attendance for worker {$worker->id}: {$e->getMessage()}");
                }
            }
        }

        return response()->json([
            'message' => "Initialized {$created} attendance records",
            'created' => $created,
            'total_workers' => $workers->count(),
            'shifts' => count($shifts),
            'errors' => $errors,
        ]);
    }

    /**
     * Assign workers to a project.
     */
    public function assignWorkers(Request $request, Project $project): JsonResponse
    {
        $validated = $request->validate([
            'worker_ids' => 'required|array',
            'worker_ids.*' => 'required|integer|exists:users,id',
        ]);

        // Verify that all workers exist and are workers
        $workers = User::whereIn('id', $validated['worker_ids'])
            ->where('role', 'worker')
            ->get();

        if ($workers->count() !== count($validated['worker_ids'])) {
            return response()->json([
                'error' => 'Some workers do not exist or are not workers',
            ], 422);
        }

        // Sync the workers (replace existing)
        $project->workers()->sync($validated['worker_ids']);

        return response()->json([
            'message' => 'Workers assigned successfully',
            'assigned_count' => $workers->count(),
        ]);
    }

    /**
     * Get available workers that can be assigned to a project.
     */
    public function getAvailableWorkers(): JsonResponse
    {
        $workers = User::where('role', 'worker')
            ->select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        return response()->json([
            'workers' => $workers,
        ]);
    }

    /**
     * Get workers assigned to a project.
     */
    public function getProjectWorkers(Project $project): JsonResponse
    {
        $workers = $project->workers()
            ->select('users.id', 'users.name', 'users.email')
            ->get();

        return response()->json([
            'workers' => $workers,
        ]);
    }
}
