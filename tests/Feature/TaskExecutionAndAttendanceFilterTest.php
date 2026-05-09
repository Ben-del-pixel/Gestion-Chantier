<?php

use App\Enums\UserRole;
use App\Models\Attendance;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('all assigned workers must execute before task and step are marked complete', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $w1 = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chef->id,
    ]);
    $w2 = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chef->id,
    ]);

    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $project->workers()->sync([$w1->id, $w2->id]);

    $step = $project->steps()->create([
        'name' => 'Fondations',
        'budget' => 1000,
        'order' => 1,
    ]);

    $task = Task::create([
        'project_id' => $project->id,
        'project_step_id' => $step->id,
        'name' => 'Fondation côté gauche',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->sync([$w1->id, $w2->id]);

    $this->actingAs($w1)->post(route('tasks.execute', $task))->assertRedirect();

    $task->refresh();
    expect($task->status)->toBe('en_cours');

    $this->actingAs($w2)->post(route('tasks.execute', $task))->assertRedirect();

    $task->refresh();
    $step->refresh();

    expect($task->status)->toBe('termine');
    expect($step->is_completed)->toBeTrue();
});

test('engineer cannot assign storekeeper via assign-storekeeper endpoint', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
    ]);

    $this->actingAs($engineer)
        ->postJson(route('projects.assign-storekeeper', $project), [
            'storekeeper_id' => $magasinier->id,
        ])
        ->assertForbidden();
});

test('manager can filter attendance by project', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $project = Project::factory()->create(['manager_id' => $manager->id]);
    $worker = User::factory()->create(['role' => UserRole::Worker]);

    Attendance::factory()->create([
        'user_id' => $worker->id,
        'project_id' => $project->id,
        'date' => now()->toDateString(),
    ]);

    $this->actingAs($manager)
        ->get(route('attendance.index', ['project_id' => $project->id]))
        ->assertSuccessful();
});
