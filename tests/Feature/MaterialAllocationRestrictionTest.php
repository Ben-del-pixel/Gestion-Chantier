<?php

use App\Enums\UserRole;
use App\Models\Material;
use App\Models\Project;
use App\Models\User;

test('magasinier can allocate material only to own project', function () {
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier->value]);
    $ownProject = Project::factory()->create(['storekeeper_id' => $magasinier->id]);
    $otherProject = Project::factory()->create();
    $material = Material::factory()->create([
        'project_id' => $ownProject->id,
        'storekeeper_id' => $magasinier->id,
        'quantity_in_stock' => 100,
    ]);

    $this->actingAs($magasinier)
        ->post(route('materials.allocate'), [
            'material_id' => $material->id,
            'project_id' => $otherProject->id,
            'quantity_requested' => 10,
        ])
        ->assertForbidden();

    $this->actingAs($magasinier)
        ->post(route('materials.allocate'), [
            'material_id' => $material->id,
            'project_id' => $ownProject->id,
            'quantity_requested' => 10,
        ])
        ->assertRedirect(route('materials.index'));
});

test('cannot allocate material to a different project than its owner project', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager->value]);
    $projectA = Project::factory()->create();
    $projectB = Project::factory()->create();
    $material = Material::factory()->create([
        'project_id' => $projectA->id,
        'quantity_in_stock' => 100,
    ]);

    $this->actingAs($manager)
        ->from(route('materials.index'))
        ->post(route('materials.allocate'), [
            'material_id' => $material->id,
            'project_id' => $projectB->id,
            'quantity_requested' => 10,
        ])
        ->assertRedirect(route('materials.index'));

    $this->assertDatabaseMissing('resource_requests', [
        'material_id' => $material->id,
        'project_id' => $projectB->id,
    ]);
});
