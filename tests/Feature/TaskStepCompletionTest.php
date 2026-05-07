<?php

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\User;

test('step is automatically completed when all tasks are completed', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer->value]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier->value,
        'engineer_id' => $engineer->id,
    ]);
    $worker = User::factory()->create([
        'role' => UserRole::Worker->value,
        'chef_chantier_id' => $chef->id,
    ]);

    $project = Project::create([
        'name' => 'Projet Auto Step',
        'description' => 'Test auto completion',
        'budget' => 50000,
        'deadline' => now()->addMonth()->toDateString(),
        'status' => 'initialisation',
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
    ]);

    $step = $project->steps()->create([
        'name' => 'Etape 1',
        'budget' => 10000,
        'order' => 1,
    ]);

    $this->actingAs($manager)->post('/tasks', [
        'project_id' => $project->id,
        'project_step_id' => $step->id,
        'name' => 'Tache 1',
        'description' => 'T1',
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDay()->toDateString(),
        'status' => 'termine',
        'worker_ids' => [$worker->id],
    ])->assertRedirect();

    $step->refresh();
    expect($step->is_completed)->toBeTrue();

    $task = $project->tasks()->firstOrFail();
    $this->actingAs($manager)->put("/tasks/{$task->id}", [
        'project_step_id' => $step->id,
        'name' => 'Tache 1',
        'description' => 'T1',
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDay()->toDateString(),
        'status' => 'en_cours',
        'worker_ids' => [$worker->id],
    ])->assertRedirect();

    $step->refresh();
    expect($step->is_completed)->toBeFalse();
});
