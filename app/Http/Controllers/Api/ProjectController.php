<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'steps' => 'required|array|min:1',
            'steps.*.name' => 'required|string|max:255',
            'steps.*.budget' => 'required|numeric|min:0',
            'budget' => 'nullable|numeric|min:0',
            'deadline' => 'required|date|after:today',
            'engineer_id' => 'nullable|exists:users,id',
        ]);

        $steps = $validated['steps'];
        
        // Calculate total budget from steps
        $totalBudget = collect($steps)->sum('budget');
        
        // Allow manager to override the auto-calculated budget
        $finalBudget = $validated['budget'] ?? $totalBudget;

        $project = Project::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'budget' => $finalBudget,
            'deadline' => $validated['deadline'],
            'engineer_id' => $validated['engineer_id'] ?? null,
            'manager_id' => auth()->id(),
            'status' => 'initialisation',
        ]);

        // Create project steps
        foreach ($steps as $index => $step) {
            $project->steps()->create([
                'name' => $step['name'],
                'budget' => $step['budget'],
                'order' => $index + 1,
            ]);
        }

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'create_project',
            'description' => "Création du projet : {$project->name} avec " . count($steps) . " étape(s)",
            'properties' => [
                'project_id' => $project->id,
                'steps_count' => count($steps),
                'total_budget' => $finalBudget,
            ],
        ]);

        return response()->json([
            'project' => $project->load('steps'),
            'message' => 'Projet créé avec succès',
        ], 201);
    }
}
