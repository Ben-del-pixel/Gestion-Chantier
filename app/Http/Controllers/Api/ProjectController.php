<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\ProjectStep;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(): Response
    {
        $user = auth()->user();

        // Filter projects based on user role
        if ($user->role === UserRole::ChefChantier) {
            // Chef de Chantier sees only projects assigned to him
            $projects = Project::with('engineer', 'manager', 'chefChantier', 'workers', 'steps')
                ->where('chef_chantier_id', $user->id)
                ->latest()
                ->get();
            // Show his engineer in the filter (if any project has one)
            $engineers = User::where('role', UserRole::Engineer)
                ->where('id', $user->engineer_id)
                ->get();
        } elseif ($user->role === UserRole::Engineer) {
            // Engineer sees his own projects and projects of his chefs de chantier
            $chefChantierIds = User::where('engineer_id', $user->id)->pluck('id');
            $projects = Project::with('engineer', 'manager', 'chefChantier', 'workers', 'steps')
                ->where(function ($query) use ($user, $chefChantierIds) {
                    $query->where('engineer_id', $user->id)
                        ->orWhereIn('chef_chantier_id', $chefChantierIds);
                })
                ->latest()
                ->get();
            // Engineers don't see other engineers in filter
            $engineers = collect();
        } else {
            // Manager sees all projects
            $projects = Project::with('engineer', 'manager', 'chefChantier', 'workers', 'steps')->latest()->get();
            $engineers = User::where('role', UserRole::Engineer)->get();
        }

        return Inertia::render('projects/index', [
            'projects' => $projects,
            'engineers' => $engineers,
        ]);
    }

    public function store(Request $request)
    {
        // Only Manager can create projects
        if (auth()->user()->role !== UserRole::Manager) {
            abort(403, 'Seul un Manager peut créer des projets.');
        }

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

        // Note: L'équipe sera assignée par le Chef de Chantier plus tard
        // Le Manager assigne seulement l'Ingénieur au projet

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
        $project->load(['engineer', 'manager', 'chefChantier', 'storekeeper', 'steps', 'tasks.workers', 'workers']);

        $engineers = User::where('role', UserRole::Engineer)->get();
        $chefsChantier = User::where('role', UserRole::ChefChantier)->get();
        $storekeepers = User::where('role', UserRole::Magasinier)->get();
        $allWorkers = User::whereIn('role', [UserRole::Worker, UserRole::Magasinier, UserRole::ChefChantier])->get();

        // Calculate total unique workers for the project (from workers relation or tasks)
        $totalWorkersCount = $project->workers->count();

        return Inertia::render('projects/show', [
            'project' => $project,
            'totalWorkersCount' => $totalWorkersCount,
            'engineers' => $engineers,
            'chefsChantier' => $chefsChantier,
            'storekeepers' => $storekeepers,
            'allWorkers' => $allWorkers,
        ]);
    }

    public function update(Request $request, Project $project)
    {
        // Permission check: Only Manager or Engineer assigned to project can update
        $user = auth()->user();
        if ($user->role === UserRole::Manager) {
            // Manager can update any project
        } elseif ($user->role === UserRole::Engineer && $project->engineer_id === $user->id) {
            // Engineer can only update their own projects
        } else {
            abort(403, 'Vous n\'avez pas la permission de modifier ce projet.');
        }

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
            'chef_chantier_id' => 'nullable|exists:users,id',
            'storekeeper_id' => 'nullable|exists:users,id',
            'steps' => 'nullable|array',
            'steps.*.id' => 'nullable|exists:project_steps,id',
            'steps.*.name' => 'required|string|max:255',
            'steps.*.budget' => 'nullable|numeric|min:0',
        ]);

        // Capture original IDs before update
        $originalEngineerId = $project->engineer_id;
        $originalChefChanttierId = $project->chef_chantier_id;

        $projectData = $request->only([
            'name', 'description', 'start_date', 'deadline', 'budget', 'status', 'progress', 'budget_consumed', 'engineer_id', 'chef_chantier_id', 'storekeeper_id',
        ]);

        // Convert empty strings to null for IDs
        if (isset($projectData['engineer_id']) && $projectData['engineer_id'] === '') {
            $projectData['engineer_id'] = null;
        }
        if (isset($projectData['chef_chantier_id']) && $projectData['chef_chantier_id'] === '') {
            $projectData['chef_chantier_id'] = null;
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

        // Auto-assign new engineer's team if engineer changed
        if (isset($projectData['engineer_id']) && (int)$projectData['engineer_id'] !== (int)$originalEngineerId) {
            if (! empty($projectData['engineer_id'])) {
                // Engineer change doesn't automatically change workers anymore,
                // as workers are linked to Chef de Chantier.
            } else {
                // Remove all workers if engineer removed?
                // Usually an engineer removal might mean project reset.
            }
        }

        // Auto-assign chef de chantier's team if chef de chantier changed or assigned
        // Per documentation: when a Chef de Chantier is assigned, his team is automatically linked to the project
        if (isset($projectData['chef_chantier_id']) && (int)$projectData['chef_chantier_id'] !== (int)$originalChefChanttierId) {
            if (! empty($projectData['chef_chantier_id'])) {
                $chefChantier = User::find($projectData['chef_chantier_id']);
                if ($chefChantier) {
                    // Get chef's team workers
                    $chefTeamIds = $chefChantier->team()->pluck('id')->toArray();

                    // Replace workers with chef's team
                    if (! empty($chefTeamIds)) {
                        $project->workers()->sync($chefTeamIds);
                    }
                }
            } else {
                // If chef de chantier is removed, we might want to keep or remove workers.
                // For now, let's keep them unless an engineer change also happens.
            }
        }

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

        return back()->with('success', 'Équipe mise à jour avec succès');
    }

    public function toggleStep(Project $project, ProjectStep $step)
    {
        // Permission check
        $user = auth()->user();
        if ($user->role !== UserRole::Manager &&
            !($user->role === UserRole::Engineer && $project->engineer_id === $user->id) &&
            !($user->role === UserRole::ChefChantier && $project->chef_chantier_id === $user->id)
        ) {
            abort(403, "Vous n'avez pas la permission de modifier les étapes de ce projet.");
        }

        // Ensure the step belongs to the project
        if ($step->project_id !== $project->id) {
            abort(404);
        }

        if ($step->is_completed) {
            $step->uncomplete();
            $message = 'Étape marquée comme non terminée';
        } else {
            $step->complete();
            $message = 'Étape validée et budget consommé';
        }

        return back()->with('success', $message);
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
