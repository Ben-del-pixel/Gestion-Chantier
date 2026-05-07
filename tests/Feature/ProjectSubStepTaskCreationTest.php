<?php

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectSubStep;
use App\Models\Task;
use App\Models\User;

test('creating sub-step creates linked task attached to project step', function () {
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
        'name' => 'Projet Test',
        'description' => 'Projet de test',
        'budget' => 10000,
        'deadline' => now()->addMonth()->toDateString(),
        'status' => 'initialisation',
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
    ]);

    $step = $project->steps()->create([
        'name' => 'Etape Fondation',
        'budget' => 3000,
        'order' => 1,
    ]);

    $this->actingAs($chef)
        ->post(route('sub-steps.store'), [
            'project_step_id' => $step->id,
            'name' => 'Coulage beton',
            'description' => 'Sous etape test',
            'planned_date' => now()->addDay()->toDateString(),
            'worker_ids' => [$worker->id],
        ])
        ->assertCreated();

    $subStep = ProjectSubStep::query()->firstOrFail();
    $task = Task::query()->firstOrFail();

    expect($task->project_id)->toBe($project->id)
        ->and($task->project_step_id)->toBe($step->id)
        ->and($task->project_sub_step_id)->toBe($subStep->id)
        ->and($task->name)->toBe('Coulage beton')
        ->and($task->status)->toBe('planifie');

    $this->assertDatabaseHas('task_user', [
        'task_id' => $task->id,
        'user_id' => $worker->id,
    ]);
});
