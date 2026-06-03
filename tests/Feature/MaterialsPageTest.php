<?php

use App\Enums\UserRole;
use App\Models\Material;
use App\Models\Project;
use App\Models\ProjectStep;
use App\Models\ResourceRequest;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function materialTestStep(Project $project, string $name = 'Phase 1'): ProjectStep
{
    return $project->steps()->create([
        'name' => $name,
        'budget' => 1000,
        'order' => 1,
    ]);
}

test('guests are redirected to login when visiting materials page', function () {
    $this->get(route('materials.index'))->assertRedirect(route('login'));
});

test('authenticated users can view materials page', function () {
    $user = User::factory()->create(['role' => UserRole::Manager]);
    $project = Project::factory()->create();
    Material::factory()->create([
        'name' => 'Ciment',
        'description' => 'Fournisseur A',
        'quantity_in_stock' => 250,
        'unit' => 'sacs',
        'project_id' => $project->id,
    ]);

    $this->actingAs($user)
        ->get(route('materials.index'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('materials/index')
            ->has('materials', 1)
            ->has('storekeeperAllocationGroups')
            ->where('materials.0.name', 'Ciment')
        );
});

test('magasinier can create a material', function () {
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create(['storekeeper_id' => $magasinier->id]);
    $step = materialTestStep($project);

    $this->actingAs($magasinier)
        ->post(route('materials.store'), [
            'name' => 'Ciment rapide',
            'description' => 'Fournisseur X',
            'quantity_in_stock' => 42,
            'unit' => 'sacs',
            'type' => 'materiaux',
            'category' => 'construction',
            'project_id' => $project->id,
            'project_step_id' => $step->id,
        ])
        ->assertRedirect(route('materials.index', ['project_id' => $project->id]));

    $this->assertDatabaseHas('materials', [
        'name' => 'Ciment rapide',
        'quantity_in_stock' => 42,
        'unit' => 'sacs',
        'project_id' => $project->id,
        'storekeeper_id' => $magasinier->id,
    ]);
});

test('cannot create a material without project step', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $storekeeper = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create(['storekeeper_id' => $storekeeper->id]);
    materialTestStep($project);

    $this->actingAs($manager)
        ->from(route('materials.index'))
        ->post(route('materials.store'), [
            'name' => 'Sans étape',
            'quantity_in_stock' => 1,
            'unit' => 'sacs',
            'type' => 'materiaux',
            'project_id' => $project->id,
        ])
        ->assertSessionHasErrors('project_step_id');

    $this->assertDatabaseMissing('materials', [
        'name' => 'Sans étape',
    ]);
});

test('manager cannot create a material without selecting a project', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);

    $this->actingAs($manager)
        ->from(route('materials.index'))
        ->post(route('materials.store'), [
            'name' => 'Sans chantier',
            'description' => 'Test',
            'quantity_in_stock' => 1,
            'unit' => 'sacs',
            'type' => 'materiaux',
            'category' => 'test',
        ])
        ->assertSessionHasErrors('project_id');

    $this->assertDatabaseMissing('materials', [
        'name' => 'Sans chantier',
    ]);
});

test('manager cannot create a material for a project without storekeeper', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $project = Project::factory()->create(['storekeeper_id' => null]);
    $step = materialTestStep($project);

    $this->actingAs($manager)
        ->from(route('materials.index'))
        ->post(route('materials.store'), [
            'name' => 'Stock orphelin',
            'description' => 'Test',
            'quantity_in_stock' => 1,
            'unit' => 'sacs',
            'type' => 'materiaux',
            'category' => 'test',
            'project_id' => $project->id,
            'project_step_id' => $step->id,
        ])
        ->assertSessionHasErrors('project_id');

    $this->assertDatabaseMissing('materials', [
        'name' => 'Stock orphelin',
    ]);
});

test('manager can create a material', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $storekeeper = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create(['storekeeper_id' => $storekeeper->id]);
    $step = materialTestStep($project);

    $this->actingAs($manager)
        ->post(route('materials.store'), [
            'name' => 'Gravier premium',
            'description' => 'Fournisseur M',
            'quantity_in_stock' => 65,
            'unit' => 'tonnes',
            'type' => 'materiaux',
            'category' => 'construction',
            'project_id' => $project->id,
            'project_step_id' => $step->id,
        ])
        ->assertRedirect(route('materials.index', ['project_id' => $project->id]));

    $this->assertDatabaseHas('materials', [
        'name' => 'Gravier premium',
        'quantity_in_stock' => 65,
        'unit' => 'tonnes',
        'project_id' => $project->id,
        'storekeeper_id' => $storekeeper->id,
    ]);
});

test('manager can update a material', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $material = Material::factory()->create([
        'name' => 'Bois ancien',
        'quantity_in_stock' => 20,
        'unit' => 'm3',
        'type' => 'materiaux',
    ]);

    $this->actingAs($manager)
        ->put(route('materials.update', ['material' => $material->id]), [
            'name' => 'Bois traité',
            'description' => 'Lot B',
            'quantity_in_stock' => 30,
            'unit' => 'm3',
            'type' => 'materiaux',
            'category' => 'charpente',
        ])
        ->assertRedirect(route('materials.index'));

    $this->assertDatabaseHas('materials', [
        'id' => $material->id,
        'name' => 'Bois traité',
        'quantity_in_stock' => 30,
    ]);
});

test('manager can delete a material', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $material = Material::factory()->create();

    $this->actingAs($manager)
        ->delete(route('materials.destroy', ['material' => $material->id]))
        ->assertRedirect(route('materials.index'));

    $this->assertDatabaseMissing('materials', [
        'id' => $material->id,
    ]);
});

test('magasinier cannot delete a material', function () {
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create(['storekeeper_id' => $magasinier->id]);
    $material = Material::factory()->create([
        'project_id' => $project->id,
        'storekeeper_id' => $magasinier->id,
    ]);

    $this->actingAs($magasinier)
        ->delete(route('materials.destroy', ['material' => $material->id]))
        ->assertForbidden();

    $this->assertDatabaseHas('materials', [
        'id' => $material->id,
    ]);
});

test('manager can allocate material to project', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $storekeeper = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create(['storekeeper_id' => $storekeeper->id]);
    $material = Material::factory()->create([
        'project_id' => $project->id,
        'storekeeper_id' => $storekeeper->id,
        'quantity_in_stock' => 100,
        'unit' => 'sacs',
    ]);

    $this->actingAs($manager)
        ->post(route('materials.allocate'), [
            'material_id' => $material->id,
            'project_id' => $project->id,
            'quantity_requested' => 15,
            'comment' => 'Allocation manager',
        ])
        ->assertRedirect(route('materials.index', ['project_id' => $project->id]));

    $this->assertDatabaseHas('resource_requests', [
        'material_id' => $material->id,
        'project_id' => $project->id,
        'user_id' => $manager->id,
        'status' => 'livre',
    ]);

    $material->refresh();
    expect((float) $material->quantity_in_stock)->toBe(85.0);
});

test('manager can register stock entry movement', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $material = Material::factory()->create([
        'quantity_in_stock' => 10,
    ]);

    $this->actingAs($manager)
        ->post(route('materials.stock-in'), [
            'material_id' => $material->id,
            'quantity' => 5,
            'reason' => 'Réapprovisionnement',
            'comment' => 'Arrivage fournisseur',
        ])
        ->assertRedirect(route('materials.index'));

    $material->refresh();
    expect((float) $material->quantity_in_stock)->toBe(15.0);

    $this->assertDatabaseHas('material_movements', [
        'material_id' => $material->id,
        'movement_type' => 'entry',
        'reason' => 'Réapprovisionnement',
    ]);
});

test('manager can register stock exit movement', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $material = Material::factory()->create([
        'quantity_in_stock' => 10,
    ]);

    $this->actingAs($manager)
        ->post(route('materials.stock-out'), [
            'material_id' => $material->id,
            'quantity' => 3,
            'reason' => 'Casse',
            'comment' => 'Pertes chantier',
        ])
        ->assertRedirect(route('materials.index'));

    $material->refresh();
    expect((float) $material->quantity_in_stock)->toBe(7.0);

    $this->assertDatabaseHas('material_movements', [
        'material_id' => $material->id,
        'movement_type' => 'exit',
        'reason' => 'Casse',
    ]);
});

test('stock exit cannot exceed available quantity', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $material = Material::factory()->create([
        'quantity_in_stock' => 2,
    ]);

    $this->actingAs($manager)
        ->from(route('materials.index'))
        ->post(route('materials.stock-out'), [
            'material_id' => $material->id,
            'quantity' => 5,
            'reason' => 'Sortie test',
        ])
        ->assertRedirect(route('materials.index'));

    $material->refresh();
    expect((float) $material->quantity_in_stock)->toBe(2.0);
});

test('materials index groups allocations by storekeeper for manager', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier, 'name' => 'Jean Dupot']);
    $project = Project::factory()->create([
        'storekeeper_id' => $magasinier->id,
        'name' => 'Chantier Nord',
    ]);
    $material = Material::factory()->create([
        'project_id' => $project->id,
        'storekeeper_id' => $magasinier->id,
        'type' => 'materiaux',
        'quantity_in_stock' => 100,
    ]);

    ResourceRequest::create([
        'material_id' => $material->id,
        'project_id' => $project->id,
        'user_id' => $manager->id,
        'quantity_requested' => 5,
        'status' => 'livre',
    ]);

    $this->actingAs($manager)
        ->get(route('materials.index'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('materials/index')
            ->has('storekeeperAllocationGroups', 1)
            ->where('storekeeperAllocationGroups.0.storekeeper_name', 'Jean Dupot')
            ->has('storekeeperAllocationGroups.0.projects', 1)
            ->has('storekeeperAllocationGroups.0.projects.0.materiaux', 1)
            ->has('storekeeperAllocationGroups.0.projects.0.materiel', 0)
        );
});

test('magasinier only sees own storekeeper allocation group', function () {
    $magA = User::factory()->create(['role' => UserRole::Magasinier, 'name' => 'Magasinier A']);
    $magB = User::factory()->create(['role' => UserRole::Magasinier, 'name' => 'Magasinier B']);
    $projectA = Project::factory()->create(['storekeeper_id' => $magA->id]);
    Project::factory()->create(['storekeeper_id' => $magA->id, 'name' => 'Second chantier A']);
    $projectB = Project::factory()->create(['storekeeper_id' => $magB->id]);
    $matA = Material::factory()->create([
        'project_id' => $projectA->id,
        'storekeeper_id' => $magA->id,
        'type' => 'materiaux',
    ]);
    $matB = Material::factory()->create([
        'project_id' => $projectB->id,
        'storekeeper_id' => $magB->id,
        'type' => 'materiaux',
    ]);
    ResourceRequest::create([
        'material_id' => $matA->id,
        'project_id' => $projectA->id,
        'user_id' => $magA->id,
        'quantity_requested' => 2,
        'status' => 'livre',
    ]);
    ResourceRequest::create([
        'material_id' => $matB->id,
        'project_id' => $projectB->id,
        'user_id' => $magB->id,
        'quantity_requested' => 3,
        'status' => 'livre',
    ]);

    $this->actingAs($magA)
        ->get(route('materials.index'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('materials/index')
            ->has('storekeeperAllocationGroups', 1)
            ->where('storekeeperAllocationGroups.0.storekeeper_name', 'Magasinier A')
        );
});

test('magasinier with multiple projects sees chantier picker without materials until project selected', function () {
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $projectA = Project::factory()->create(['storekeeper_id' => $magasinier->id, 'name' => 'ESIS Maintenant']);
    $projectB = Project::factory()->create(['storekeeper_id' => $magasinier->id, 'name' => 'Chantier Sud']);
    Material::factory()->create(['project_id' => $projectA->id, 'storekeeper_id' => $magasinier->id]);
    Material::factory()->create(['project_id' => $projectB->id, 'storekeeper_id' => $magasinier->id]);

    $this->actingAs($magasinier)
        ->get(route('materials.index'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('materials/index')
            ->where('selectedProjectId', null)
            ->has('materials', 0)
            ->has('projects', 2)
        );
});

test('magasinier sees only materials for selected chantier', function () {
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $projectA = Project::factory()->create(['storekeeper_id' => $magasinier->id, 'name' => 'ESIS Maintenant']);
    $projectB = Project::factory()->create(['storekeeper_id' => $magasinier->id, 'name' => 'Chantier Sud']);
    Material::factory()->create([
        'project_id' => $projectA->id,
        'storekeeper_id' => $magasinier->id,
        'name' => 'Ciment A',
    ]);
    Material::factory()->create([
        'project_id' => $projectB->id,
        'storekeeper_id' => $magasinier->id,
        'name' => 'Ciment B',
    ]);

    $this->actingAs($magasinier)
        ->get(route('materials.index', ['project_id' => $projectA->id]))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('materials/index')
            ->where('selectedProjectId', $projectA->id)
            ->where('selectedProjectName', 'ESIS Maintenant')
            ->has('materials', 1)
            ->where('materials.0.name', 'Ciment A')
        );
});

test('magasinier with single project is redirected to that project stock view', function () {
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create(['storekeeper_id' => $magasinier->id]);

    $this->actingAs($magasinier)
        ->get(route('materials.index'))
        ->assertRedirect(route('materials.index', ['project_id' => $project->id]));
});

test('magasinier cannot access another storekeepers project materials', function () {
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $otherMagasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $ownProject = Project::factory()->create(['storekeeper_id' => $magasinier->id]);
    $otherProject = Project::factory()->create(['storekeeper_id' => $otherMagasinier->id]);

    $this->actingAs($magasinier)
        ->get(route('materials.index', ['project_id' => $otherProject->id]))
        ->assertForbidden();
});

test('magasinier creates material on the selected chantier only', function () {
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $projectA = Project::factory()->create(['storekeeper_id' => $magasinier->id]);
    $projectB = Project::factory()->create(['storekeeper_id' => $magasinier->id]);
    $stepB = materialTestStep($projectB, 'Phase B');

    $this->actingAs($magasinier)
        ->post(route('materials.store'), [
            'name' => 'Gravier chantier B',
            'quantity_in_stock' => 10,
            'unit' => 'm3',
            'type' => 'materiaux',
            'project_id' => $projectB->id,
            'project_step_id' => $stepB->id,
        ])
        ->assertRedirect(route('materials.index', ['project_id' => $projectB->id]));

    $this->assertDatabaseHas('materials', [
        'name' => 'Gravier chantier B',
        'project_id' => $projectB->id,
    ]);
    $this->assertDatabaseMissing('materials', [
        'name' => 'Gravier chantier B',
        'project_id' => $projectA->id,
    ]);
});

test('non magasinier cannot create a material', function () {
    $worker = User::factory()->create(['role' => UserRole::Worker]);

    $this->actingAs($worker)
        ->post(route('materials.store'), [
            'name' => 'Acier test',
            'description' => 'Fournisseur Y',
            'quantity_in_stock' => 10,
            'unit' => 'tonnes',
            'type' => 'materiaux',
            'category' => 'metaux',
        ])
        ->assertForbidden();
});
