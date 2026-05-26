<?php

use App\Enums\UserRole;
use App\Models\Material;
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

test('manager can create project with storekeeper and materials', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'Chantier avec stock',
            'start_date' => now()->toDateString(),
            'deadline' => now()->addDays(30)->toDateString(),
            'storekeeper_id' => $magasinier->id,
            'steps' => [
                ['name' => 'Phase 1', 'budget' => 2000],
            ],
            'materials' => [
                [
                    'name' => 'Ciment',
                    'quantity_in_stock' => 50,
                    'unit' => 'sacs',
                    'type' => 'materiaux',
                    'step_index' => 0,
                ],
            ],
        ])
        ->assertRedirect();

    $project = Project::firstOrFail();
    expect($project->storekeeper_id)->toBe($magasinier->id);
    expect(Material::where('project_id', $project->id)->count())->toBe(1);
    $material = Material::first();
    expect($material->name)->toBe('Ciment');
    expect($material->project_step_id)->toBe($project->steps()->first()->id);
});

test('manager can create project materials without step index (auto first step)', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'Chantier stock auto étape',
            'start_date' => now()->toDateString(),
            'deadline' => now()->addDays(30)->toDateString(),
            'storekeeper_id' => $magasinier->id,
            'steps' => [
                ['name' => 'Phase 1', 'budget' => 2000],
                ['name' => 'Phase 2', 'budget' => 1000],
            ],
            'materials' => [
                [
                    'name' => 'Sable',
                    'quantity_in_stock' => 12,
                    'unit' => 'm3',
                    'type' => 'materiaux',
                    // step_index omitted intentionally
                ],
            ],
        ])
        ->assertRedirect();

    $project = Project::query()->where('name', 'Chantier stock auto étape')->firstOrFail();
    $firstStep = $project->steps()->orderBy('order')->firstOrFail();
    $material = Material::query()->where('project_id', $project->id)->where('name', 'Sable')->firstOrFail();

    expect((int) $material->project_step_id)->toBe((int) $firstStep->id);
});

test('manager cannot create project material without valid step index', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);

    $this->actingAs($manager)
        ->from(route('projects.index'))
        ->post(route('projects.store'), [
            'name' => 'Chantier invalide',
            'start_date' => now()->toDateString(),
            'deadline' => now()->addDays(30)->toDateString(),
            'storekeeper_id' => $magasinier->id,
            'steps' => [
                ['name' => 'Phase 1', 'budget' => 2000],
            ],
            'materials' => [
                [
                    'name' => 'Ciment',
                    'quantity_in_stock' => 50,
                    'unit' => 'sacs',
                    'type' => 'materiaux',
                    'step_index' => 5,
                ],
            ],
        ])
        ->assertSessionHasErrors('materials');

    expect(Material::where('name', 'Ciment')->exists())->toBeFalse();
});

test('engineer cannot change project or step budgets on update', function () {
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $project = Project::factory()->create([
        'engineer_id' => $engineer->id,
        'budget' => 8000,
        'budget_consumed' => 500,
    ]);
    $step = $project->steps()->create([
        'name' => 'Phase A',
        'budget' => 8000,
        'order' => 1,
    ]);

    $this->actingAs($engineer)
        ->from(route('projects.show', $project))
        ->put(route('projects.update', $project), [
            'budget_consumed' => 9999,
            'steps' => [
                [
                    'id' => $step->id,
                    'name' => 'Phase A renommée',
                    'budget' => 1,
                ],
            ],
        ])
        ->assertRedirect();

    $project->refresh();
    $step->refresh();

    expect((float) $project->budget)->toBe(8000.0);
    expect((float) $project->budget_consumed)->toBe(500.0);
    expect((float) $step->budget)->toBe(8000.0);
    expect($step->name)->toBe('Phase A renommée');
});

test('project update recalculates budget from steps and ignores direct budget field', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'budget' => 1000,
    ]);
    $step = $project->steps()->create([
        'name' => 'Étape A',
        'budget' => 1000,
        'order' => 1,
    ]);

    $this->actingAs($manager)
        ->from(route('projects.show', $project))
        ->put(route('projects.update', $project), [
            'budget' => 99999,
            'steps' => [
                [
                    'id' => $step->id,
                    'name' => 'Étape A',
                    'budget' => 2500,
                ],
                [
                    'name' => 'Étape B',
                    'budget' => 1500,
                ],
            ],
        ])
        ->assertRedirect();

    $project->refresh();
    expect((float) $project->budget)->toBe(4000.0);
});
