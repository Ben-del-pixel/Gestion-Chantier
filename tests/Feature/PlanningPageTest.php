<?php

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('manager can view planning page with tasks grouped by step', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $project = Project::factory()->create(['manager_id' => $manager->id]);
    $step = $project->steps()->create([
        'name' => 'Fondations',
        'budget' => 5000,
        'order' => 1,
    ]);
    $worker = User::factory()->create(['role' => UserRole::Worker]);
    $project->workers()->attach($worker->id);

    $task = Task::create([
        'project_id' => $project->id,
        'project_step_id' => $step->id,
        'project_sub_step_id' => null,
        'name' => 'Coulage dalle',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addWeek(),
        'status' => 'planifie',
    ]);
    $task->workers()->attach($worker->id);

    $this->actingAs($manager)
        ->get(route('planning.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('planning/index')
            ->has('projects', 1)
            ->where('projects.0.name', $project->name)
            ->has('projects.0.steps', 1)
            ->where('projects.0.steps.0.name', 'Fondations')
            ->has('projects.0.steps.0.tasks', 1)
            ->where('projects.0.steps.0.tasks.0.name', 'Coulage dalle')
        );
});

test('engineer sees only projects in their scope on planning', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineerA = User::factory()->create(['role' => UserRole::Engineer]);
    $engineerB = User::factory()->create(['role' => UserRole::Engineer]);

    $projectMine = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineerA->id,
    ]);
    Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineerB->id,
    ]);

    $this->actingAs($engineerA)
        ->get(route('planning.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('projects', 1)
            ->where('projects.0.id', $projectMine->id)
        );
});

test('worker cannot access planning page', function () {
    $worker = User::factory()->create(['role' => UserRole::Worker]);

    $this->actingAs($worker)
        ->get(route('planning.index'))
        ->assertForbidden();
});

test('chef de chantier sees only their projects on planning', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    $otherChef = User::factory()->create(['role' => UserRole::ChefChantier]);

    $mine = Project::factory()->create([
        'manager_id' => $manager->id,
        'chef_chantier_id' => $chef->id,
    ]);
    Project::factory()->create([
        'manager_id' => $manager->id,
        'chef_chantier_id' => $otherChef->id,
    ]);

    $this->actingAs($chef)
        ->get(route('planning.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('projects', 1)
            ->where('projects.0.id', $mine->id)
        );
});
