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
        ]);

        $project = Project::findOrFail($validated['project_id']);
        $authorizationError = $this->authorizeEngineerForProject($request, $project);

        if ($authorizationError) {
            return $authorizationError;
        }

        $date = Carbon::parse($validated['date'])->startOfDay();
        $shifts = ['morning'];

        // Presence initialization must target assigned project workers only.
        $workers = $project->workers()->get();
        if ($workers->isEmpty()) {
            return response()->json([
                'message' => 'Aucun ouvrier affecté à ce projet. Veuillez affecter des ouvriers d\'abord.',
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
            'created' => $created,
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
            ->whereIn('role', [UserRole::Worker->value, UserRole::Magasinier->value])
            ->get();

        if ($workers->count() !== count($validated['worker_ids'])) {
            return response()->json([
                'message' => 'Certaines personnes sélectionnées ne sont pas assignables (ouvrier/magasinier).',
            ], 422);
        }

        // Restriction: Only one magasinier per project team
        $magasiniers = $workers->filter(fn ($w) => $w->role->value === UserRole::Magasinier->value);

        if ($magasiniers->count() > 1) {
            return response()->json([
                'message' => 'Un projet ne peut avoir qu\'un seul magasinier dans l\'équipe.',
            ], 422);
        }

        // If there's already a storekeeper assigned to the project,
        // the only magasinier allowed in the team is that storekeeper itself.
        if ($project->storekeeper_id && $magasiniers->count() > 0) {
            $assignedMagasinierId = $magasiniers->first()->id;
            if ((int) $assignedMagasinierId !== (int) $project->storekeeper_id) {
                return response()->json([
                    'message' => 'Ce projet a déjà un magasinier responsable assigné. Vous ne pouvez pas en ajouter un autre dans l\'équipe.',
                ], 422);
            }
        }

        // Sync the workers (replace existing)
        $project->workers()->sync($validated['worker_ids']);

        return response()->json([
            'message' => 'Personnel assigné avec succès',
        ]);
    }

    /**
     * Get available workers that can be assigned to a project.
     */
    public function getAvailableWorkers(): JsonResponse
    {
        $user = request()->user();
        if (! $user || ! in_array($user->role->value, [UserRole::Engineer->value, UserRole::ChefChantier->value, UserRole::Manager->value], true)) {
            return response()->json([
                'error' => 'Vous n\'avez pas les droits pour consulter cette ressource.',
            ], 403);
        }

        $workers = User::whereIn('role', [UserRole::Worker->value, UserRole::Magasinier->value])
            ->select('id', 'name', 'email', 'role')
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
            ->select('users.id', 'users.name', 'users.email', 'users.role')
            ->get();

        return response()->json([
            'workers' => $workers,
        ]);
    }

    private function authorizeEngineerForProject(Request $request, Project $project): ?JsonResponse
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role->value, [UserRole::Engineer->value, UserRole::ChefChantier->value, UserRole::Manager->value], true)) {
            return response()->json([
                'error' => 'Seuls les ingenieurs ou managers peuvent gerer l\'affectation et la presence.',
            ], 403);
        }

        // Si le user est manager, Bypass la vérification de l'ID ingénieur
        if ($user->role->value === UserRole::Manager->value) {
            return null;
        }

        if ((int) $project->engineer_id !== (int) $user->id) {
            return response()->json([
                'error' => 'Ce projet n\'est pas assigne a cet ingenieur.',
            ], 403);
        }

        return null;
    }
}
