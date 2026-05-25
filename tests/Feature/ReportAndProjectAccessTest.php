<?php

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('chef de chantier sees their projects on reports index', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    $mine = Project::factory()->create([
        'manager_id' => $manager->id,
        'chef_chantier_id' => $chef->id,
    ]);
    Project::factory()->create([
        'manager_id' => $manager->id,
    ]);

    $this->actingAs($chef)
        ->get(route('reports.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('projects', 1)
            ->where('projects.0.id', $mine->id)
        );
});

test('engineer projects index hides budget fields', function () {
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $project = Project::factory()->create([
        'engineer_id' => $engineer->id,
        'budget' => 75000,
        'budget_consumed' => 12000,
    ]);
    $project->steps()->create([
        'name' => 'Fondations',
        'budget' => 75000,
        'order' => 1,
    ]);

    $this->actingAs($engineer)
        ->get(route('projects.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('projects/index')
            ->where('canViewBudget', false)
            ->has('projects', 1)
            ->missing('projects.0.budget')
            ->missing('projects.0.budget_consumed')
            ->missing('projects.0.steps.0.budget')
        );
});

test('engineer cannot delete a project', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
    ]);

    $this->actingAs($engineer)
        ->from(route('projects.index'))
        ->delete(route('projects.destroy', $project))
        ->assertForbidden();

    expect(Project::query()->whereKey($project->id)->exists())->toBeTrue();
});

test('chef cannot generate global report', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'chef_chantier_id' => $chef->id,
    ]);

    $this->actingAs($chef)
        ->postJson(route('reports.generate'), [
            'type' => 'global',
        ])
        ->assertForbidden();

    $this->actingAs($chef)
        ->postJson(route('reports.generate'), [
            'type' => 'project',
            'project_id' => $project->id,
        ])
        ->assertOk();
});

test('chef cannot generate project report without project id', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    Project::factory()->create([
        'manager_id' => $manager->id,
        'chef_chantier_id' => $chef->id,
    ]);

    $this->actingAs($chef)
        ->postJson(route('reports.generate'), [
            'type' => 'project',
        ])
        ->assertStatus(422);
});

test('worker can generate project report for own project only', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $worker = User::factory()->create(['role' => UserRole::Worker]);
    $project = Project::factory()->create(['manager_id' => $manager->id]);
    $project->workers()->sync([$worker->id]);

    $other = Project::factory()->create(['manager_id' => $manager->id]);

    $this->actingAs($worker)
        ->postJson(route('reports.generate'), [
            'type' => 'project',
            'project_id' => $other->id,
        ])
        ->assertForbidden();

    $this->actingAs($worker)
        ->postJson(route('reports.generate'), [
            'type' => 'project',
            'project_id' => $project->id,
        ])
        ->assertOk();
});

test('chef can generate worker report for worker on their project', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    $worker = User::factory()->create(['role' => UserRole::Worker]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $task = Task::create([
        'project_id' => $project->id,
        'project_step_id' => null,
        'project_sub_step_id' => null,
        'name' => 'Tâche test',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->sync([$worker->id]);

    $this->actingAs($chef)
        ->postJson(route('reports.generate'), [
            'type' => 'worker',
            'worker_id' => $worker->id,
        ])
        ->assertOk();
});
