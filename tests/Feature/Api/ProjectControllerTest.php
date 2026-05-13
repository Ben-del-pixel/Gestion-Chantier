<?php

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\User;

test('manager can create project with steps and synced budget from steps', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $start = now()->toDateString();
    $deadline = now()->addDays(30)->toDateString();

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'Chantier Centre Ville',
            'description' => 'Rénovation complète',
            'start_date' => $start,
            'deadline' => $deadline,
            'budget' => '4500',
            'steps' => [
                ['name' => 'Phase 1', 'budget' => 1000],
                ['name' => 'Phase 2', 'budget' => 2000],
                ['name' => 'Phase 3', 'budget' => 1500],
            ],
        ])
        ->assertRedirect();

    $project = Project::firstOrFail();
    expect((float) $project->budget)->toBe(4500.0);
    expect($project->steps()->count())->toBe(3);
    expect($project->manager_id)->toBe($manager->id);
});

test('manager submitted budget is overwritten by step totals after creation', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'Projet avec override',
            'description' => 'Budget override test',
            'start_date' => now()->toDateString(),
            'deadline' => now()->addDays(30)->toDateString(),
            'budget' => 5500,
            'steps' => [
                ['name' => 'Étape 1', 'budget' => 1000],
                ['name' => 'Étape 2', 'budget' => 2000],
            ],
        ])
        ->assertRedirect();

    $project = Project::firstOrFail();
    expect((float) $project->budget)->toBe(3000.0);
});

test('project rejects deadline before start date on create', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'Dates invalides',
            'start_date' => now()->addDays(7)->toDateString(),
            'deadline' => now()->addDays(1)->toDateString(),
            'steps' => [
                ['name' => 'Phase 1', 'budget' => 1000],
            ],
        ])
        ->assertSessionHasErrors('deadline');
});

test('project rejects start date before today on create', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'Début passé',
            'start_date' => now()->subDays(3)->toDateString(),
            'deadline' => now()->addDays(30)->toDateString(),
            'steps' => [
                ['name' => 'Phase 1', 'budget' => 1000],
            ],
        ])
        ->assertSessionHasErrors('start_date');
});

test('project deadline cannot be earlier than start date on update', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'start_date' => now()->toDateString(),
        'deadline' => now()->addDays(30)->toDateString(),
    ]);

    $this->actingAs($manager)
        ->from(route('projects.show', $project))
        ->put(route('projects.update', $project), [
            'deadline' => now()->subDays(1)->toDateString(),
        ])
        ->assertSessionHasErrors('deadline');
});

test('project requires at least one step', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'No Steps Project',
            'start_date' => now()->toDateString(),
            'deadline' => now()->addDays(30)->toDateString(),
            'steps' => [],
        ])
        ->assertSessionHasErrors('steps');
});

test('each step requires name and budget', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'Invalid Steps',
            'start_date' => now()->toDateString(),
            'deadline' => now()->addDays(30)->toDateString(),
            'steps' => [
                ['name' => 'Phase 1'],
                ['budget' => 1000],
            ],
        ])
        ->assertSessionHasErrors(['steps.0.budget', 'steps.1.name']);
});

test('steps are created with correct order', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'Order Test',
            'start_date' => now()->toDateString(),
            'deadline' => now()->addDays(30)->toDateString(),
            'steps' => [
                ['name' => 'First', 'budget' => 1000],
                ['name' => 'Second', 'budget' => 2000],
                ['name' => 'Third', 'budget' => 3000],
            ],
        ])
        ->assertRedirect();

    $project = Project::firstOrFail();
    expect($project->steps[0]->order)->toBe(1);
    expect($project->steps[1]->order)->toBe(2);
    expect($project->steps[2]->order)->toBe(3);
});
