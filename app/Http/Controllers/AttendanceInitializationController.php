<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
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
        $authorizationError = $this->authorizeEngineerForProject($request, $project);

        if ($authorizationError) {
            return $authorizationError;
        }

        $date = Carbon::parse($validated['date'])->startOfDay();
        $shifts = $validated['shifts'] ?? ['morning', 'evening'];

        // Presence initialization must target assigned project workers only.
        $workers = $project->workers()->get();
        if ($workers->isEmpty()) {
            return response()->json([
                'error' => 'Aucun ouvrier affecte a ce projet. Veuillez affecter des ouvriers d\'abord.',
            ], 422);
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
        $authorizationError = $this->authorizeEngineerForProject($request, $project);

        if ($authorizationError) {
            return $authorizationError;
        }

        $validated = $request->validate([
            'worker_ids' => 'required|array',
            'worker_ids.*' => 'required|integer|exists:users,id',
        ]);

        // Verify that all selected users are assignable chantier staff (worker or magasinier)
        $workers = User::whereIn('id', $validated['worker_ids'])
            ->whereIn('role', [UserRole::Worker, UserRole::Magasinier])
            ->get();

        if ($workers->count() !== count($validated['worker_ids'])) {
            return response()->json([
                'error' => 'Certaines personnes selectionnees ne sont pas assignables (ouvrier/magasinier).',
            ], 422);
        }

        // Sync the workers (replace existing)
        $project->workers()->sync($validated['worker_ids']);

        return response()->json([
            'message' => 'Personnel assigne avec succes',
            'assigned_count' => $workers->count(),
        ]);
    }

    /**
     * Get available workers that can be assigned to a project.
     */
    public function getAvailableWorkers(): JsonResponse
    {
        $user = request()->user();
        if (! $user || ! in_array($user->role, [UserRole::Engineer, UserRole::ChefChantier], true)) {
            return response()->json([
                'error' => 'Seuls les ingenieurs peuvent consulter cette ressource.',
            ], 403);
        }

        $workers = User::whereIn('role', [UserRole::Worker, UserRole::Magasinier])
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
        $authorizationError = $this->authorizeEngineerForProject(request(), $project);

        if ($authorizationError) {
            return $authorizationError;
        }

        $workers = $project->workers()
            ->select('users.id', 'users.name', 'users.email')
            ->get();

        return response()->json([
            'workers' => $workers,
        ]);
    }

    private function authorizeEngineerForProject(Request $request, Project $project): ?JsonResponse
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role, [UserRole::Engineer, UserRole::ChefChantier], true)) {
            return response()->json([
                'error' => 'Seuls les ingenieurs peuvent gerer l\'affectation et la presence.',
            ], 403);
        }

        if ((int) $project->engineer_id !== (int) $user->id) {
            return response()->json([
                'error' => 'Ce projet n\'est pas assigne a cet ingenieur.',
            ], 403);
        }

        return null;
    }
}
