<?php

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;

function taskDeadlineProject(User $manager, User $engineer, User $chef): Project
{
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
        'deadline' => now()->addDays(10)->toDateString(),
        'start_date' => now()->toDateString(),
    ]);

    $project->steps()->create([
        'name' => 'Phase test',
        'budget' => 1000,
        'order' => 1,
    ]);

    return $project->fresh(['steps']);
}

test('manager cannot create task with end date after project deadline', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    $project = taskDeadlineProject($manager, $engineer, $chef);
    $step = $project->steps->first();

    $this->actingAs($manager)
        ->from(route('projects.show', $project))
        ->post(route('tasks.store'), [
            'project_id' => $project->id,
            'project_step_id' => $step->id,
            'name' => 'Tâche hors délai',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(30)->toDateString(),
            'status' => 'planifie',
        ])
        ->assertSessionHasErrors('end_date');

    expect(Task::query()->where('name', 'Tâche hors délai')->exists())->toBeFalse();
});

test('engineer cannot create task with end date after project deadline', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    $project = taskDeadlineProject($manager, $engineer, $chef);
    $step = $project->steps->first();

    $this->actingAs($engineer)
        ->from(route('projects.show', $project))
        ->post(route('tasks.store'), [
            'project_id' => $project->id,
            'project_step_id' => $step->id,
            'name' => 'Tâche ingénieur hors délai',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(),
            'status' => 'planifie',
        ])
        ->assertSessionHasErrors('end_date');
});

test('chef de chantier cannot create task with end date after project deadline', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    $project = taskDeadlineProject($manager, $engineer, $chef);
    $step = $project->steps->first();

    $this->actingAs($chef)
        ->from(route('projects.show', $project))
        ->post(route('tasks.store'), [
            'project_id' => $project->id,
            'project_step_id' => $step->id,
            'name' => 'Tâche chef hors délai',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(15)->toDateString(),
            'status' => 'planifie',
        ])
        ->assertSessionHasErrors('end_date');
});

test('manager can create task ending on project deadline', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    $project = taskDeadlineProject($manager, $engineer, $chef);
    $step = $project->steps->first();
    $deadline = $project->deadline->format('Y-m-d');

    $this->actingAs($manager)
        ->post(route('tasks.store'), [
            'project_id' => $project->id,
            'project_step_id' => $step->id,
            'name' => 'Tâche dans les délais',
            'start_date' => now()->toDateString(),
            'end_date' => $deadline,
            'status' => 'planifie',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('tasks', [
        'name' => 'Tâche dans les délais',
        'project_id' => $project->id,
    ]);
});

test('manager cannot update task end date beyond project deadline', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);
    $project = taskDeadlineProject($manager, $engineer, $chef);
    $step = $project->steps->first();

    $task = Task::create([
        'project_id' => $project->id,
        'project_step_id' => $step->id,
        'name' => 'Tâche existante',
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);

    $this->actingAs($manager)
        ->from(route('projects.show', $project))
        ->put(route('tasks.update', $task), [
            'project_step_id' => $step->id,
            'name' => 'Tâche existante',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(25)->toDateString(),
            'status' => 'planifie',
        ])
        ->assertSessionHasErrors('end_date');

    expect($task->fresh()->end_date->format('Y-m-d'))->toBe(now()->addDay()->format('Y-m-d'));
});

test('chef cannot create sub-step with planned date after project deadline', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $worker = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chef->id,
    ]);
    $project = taskDeadlineProject($manager, $engineer, $chef);
    $step = $project->steps->first();

    $this->actingAs($chef)
        ->postJson(route('sub-steps.store'), [
            'project_step_id' => $step->id,
            'name' => 'Sous-étape tardive',
            'planned_date' => now()->addDays(20)->toDateString(),
            'worker_ids' => [$worker->id],
        ])
        ->assertUnprocessable()
        ->assertJsonPath('errors.planned_date.0', fn ($message) => str_contains($message, 'date limite du chantier'));
});
