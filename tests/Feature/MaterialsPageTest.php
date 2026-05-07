<?php

use App\Enums\UserRole;
use App\Models\Material;
use App\Models\Project;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

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
            ->where('materials.0.name', 'Ciment')
        );
});

test('magasinier can create a material', function () {
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create(['storekeeper_id' => $magasinier->id]);

    $this->actingAs($magasinier)
        ->post(route('materials.store'), [
            'name' => 'Ciment rapide',
            'description' => 'Fournisseur X',
            'quantity_in_stock' => 42,
            'unit' => 'sacs',
            'type' => 'materiaux',
            'category' => 'construction',
        ])
        ->assertRedirect(route('materials.index'));

    $this->assertDatabaseHas('materials', [
        'name' => 'Ciment rapide',
        'quantity_in_stock' => 42,
        'unit' => 'sacs',
        'project_id' => $project->id,
        'storekeeper_id' => $magasinier->id,
    ]);
});

test('manager can create a material', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $storekeeper = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create(['storekeeper_id' => $storekeeper->id]);

    $this->actingAs($manager)
        ->post(route('materials.store'), [
            'name' => 'Gravier premium',
            'description' => 'Fournisseur M',
            'quantity_in_stock' => 65,
            'unit' => 'tonnes',
            'type' => 'materiaux',
            'category' => 'construction',
            'project_id' => $project->id,
        ])
        ->assertRedirect(route('materials.index'));

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
        ->assertRedirect(route('materials.index'));

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

test('non magasinier cannot create a material', function () {
    $worker = User::factory()->create(['role' => UserRole::Worker]);

    $this->actingAs($worker)
        ->post(route('materials.store'), [
            'name' => 'Acier test',
            'description' => 'Fournisseur Y',
            'quantity_in_stock' => 10,
            'unit' => 'tonnes',
            'category' => 'metaux',
        ])
        ->assertForbidden();
});
