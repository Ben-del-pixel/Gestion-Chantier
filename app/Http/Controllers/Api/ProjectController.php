<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(): Response
    {
        $projects = Project::with('engineer', 'manager', 'tasks.workers')->latest()->get();
        $engineers = User::where('role', UserRole::Engineer)->get();

        return Inertia::render('projects/index', [
            'projects' => $projects,
            'engineers' => $engineers,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'deadline' => 'required|date|after_or_equal:start_date',
            'budget' => 'nullable|numeric|min:0',
            'progress' => 'nullable|integer|min:0|max:100',
            'status' => 'nullable|in:initialisation,planifie,en_cours,termine,suspendu',
            'engineer_id' => 'nullable|exists:users,id',
            'steps' => 'nullable|array',
            'steps.*.name' => 'nullable|string|max:255',
            'steps.*.budget' => 'nullable|numeric|min:0',
        ]);

        $project = Project::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'budget' => $validated['budget'] ?? 0,
            'deadline' => $validated['deadline'],
            'progress' => $validated['progress'] ?? 0,
            'engineer_id' => $validated['engineer_id'] ?? null,
            'manager_id' => auth()->id(),
            'status' => $validated['status'] ?? 'initialisation',
        ]);

        // Create project steps if provided
        if (! empty($validated['steps'])) {
            foreach ($validated['steps'] as $index => $step) {
                $project->steps()->create([
                    'name' => $step['name'],
                    'budget' => $step['budget'] ?? 0,
                    'order' => $index + 1,
                ]);
            }

            // Sync total budget from steps
            $project->syncBudgetFromSteps();
        }

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'create_project',
            'description' => "Création du projet : {$project->name}",
            'properties' => [
                'project_id' => $project->id,
            ],
        ]);

        return redirect()->route('projects.show', $project)->with('success', 'Projet créé avec succès');
    }

    public function show(Project $project): Response
    {
        $project->load(['engineer', 'manager', 'storekeeper', 'steps', 'tasks.workers', 'workers']);

        $engineers = User::where('role', UserRole::Engineer)->get();
        $storekeepers = User::where('role', UserRole::Magasinier)->get();
        $allWorkers = User::whereIn('role', [UserRole::Worker, UserRole::Magasinier])->get();

        // Calculate total unique workers for the project (from workers relation or tasks)
        $totalWorkersCount = $project->workers->count();

        return Inertia::render('projects/show', [
            'project' => $project,
            'totalWorkersCount' => $totalWorkersCount,
            'engineers' => $engineers,
            'storekeepers' => $storekeepers,
            'allWorkers' => $allWorkers,
        ]);
    }

    public function update(Request $request, Project $project)
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'deadline' => 'nullable|date',
            'budget' => 'nullable|numeric|min:0',
            'progress' => 'nullable|integer|min:0|max:100',
            'budget_consumed' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:initialisation,planifie,en_cours,termine,suspendu',
            'engineer_id' => 'nullable|exists:users,id',
            'storekeeper_id' => 'nullable|exists:users,id',
            'steps' => 'nullable|array',
            'steps.*.id' => 'nullable|exists:project_steps,id',
            'steps.*.name' => 'required|string|max:255',
            'steps.*.budget' => 'nullable|numeric|min:0',
        ]);

        $resolvedStartDate = $validated['start_date'] ?? $project->start_date;
        $resolvedDeadline = $validated['deadline'] ?? $project->deadline;

        if ($resolvedStartDate && $resolvedDeadline && $resolvedDeadline < $resolvedStartDate) {
            return back()->withErrors(['deadline' => 'La date de fin doit être postérieure ou égale à la date de début.']);
        }

        $projectData = $request->only([
            'name', 'description', 'start_date', 'deadline', 'budget', 'status', 'progress', 'budget_consumed', 'engineer_id', 'storekeeper_id',
        ]);

        // Convert empty strings to null for IDs
        if (isset($projectData['engineer_id']) && $projectData['engineer_id'] === '') {
            $projectData['engineer_id'] = null;
        }
        if (isset($projectData['storekeeper_id']) && $projectData['storekeeper_id'] === '') {
            $projectData['storekeeper_id'] = null;
        }

        // Restriction: Only one magasinier per project (Storekeeper or in Workers)
        if (!empty($projectData['storekeeper_id'])) {
            $otherMagasinierInTeam = $project->workers()
                ->where('role', UserRole::Magasinier->value)
                ->where('users.id', '!=', $projectData['storekeeper_id'])
                ->exists();
            
            if ($otherMagasinierInTeam) {
                return back()->withErrors(['storekeeper_id' => 'Un autre magasinier est déjà présent dans l\'équipe terrain. Un projet ne peut avoir qu\'un seul magasinier.']);
            }
        }

        $project->update($projectData);

        if ($request->has('steps')) {
            $existingStepIds = [];
            foreach ($validated['steps'] as $index => $stepData) {
                if (isset($stepData['id'])) {
                    $step = $project->steps()->find($stepData['id']);
                    if ($step) {
                        $step->update([
                            'name' => $stepData['name'],
                            'budget' => $stepData['budget'] ?? 0,
                            'order' => $index + 1,
                        ]);
                        $existingStepIds[] = $step->id;
                    }
                } else {
                    $newStep = $project->steps()->create([
                        'name' => $stepData['name'],
                        'budget' => $stepData['budget'] ?? 0,
                        'order' => $index + 1,
                    ]);
                    $existingStepIds[] = $newStep->id;
                }
            }
            $project->steps()->whereNotIn('id', $existingStepIds)->delete();
            $project->syncBudgetFromSteps();
        }

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'update_project',
            'description' => "Mise à jour complète du projet : {$project->name}",
            'properties' => [
                'project_id' => $project->id,
                'status' => $project->status,
            ],
        ]);

        return redirect()->route('projects.show', $project)->with('success', 'Projet mis à jour avec succès');
    }

    public function assignWorkers(Request $request, Project $project)
    {
        $validated = $request->validate([
            'worker_ids' => 'required|array',
            'worker_ids.*' => 'exists:users,id',
        ]);

        $project->workers()->sync($validated['worker_ids']);

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'assign_workers',
            'description' => 'Assignation de '.count($validated['worker_ids'])." ouvriers au projet : {$project->name}",
            'properties' => [
                'project_id' => $project->id,
                'worker_count' => count($validated['worker_ids']),
            ],
        ]);

        return response()->json([
            'message' => 'Ouvriers assignés avec succès',
            'workers' => $project->workers,
        ]);
    }

    public function destroy(Project $project)
    {
        $projectName = $project->name;

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'delete_project',
            'description' => "Suppression du projet : {$projectName}",
            'properties' => [
                'project_id' => $project->id,
            ],
        ]);

        $project->delete();

        return redirect()->route('projects.index')->with('success', 'Projet supprimé avec succès');
    }
}
