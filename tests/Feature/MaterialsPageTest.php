<?php

use App\Enums\UserRole;
use App\Models\Material;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to login when visiting materials page', function () {
    $this->get(route('materials.index'))->assertRedirect(route('login'));
});

test('authenticated users can view materials page', function () {
    $user = User::factory()->create();
    Material::factory()->create([
        'name' => 'Ciment',
        'description' => 'Fournisseur A',
        'quantity_in_stock' => 250,
        'unit' => 'sacs',
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

    $this->actingAs($magasinier)
        ->post(route('materials.store'), [
            'name' => 'Ciment rapide',
            'description' => 'Fournisseur X',
            'quantity_in_stock' => 42,
            'unit' => 'sacs',
            'category' => 'construction',
        ])
        ->assertRedirect(route('materials.index'));

    $this->assertDatabaseHas('materials', [
        'name' => 'Ciment rapide',
        'quantity_in_stock' => 42,
        'unit' => 'sacs',
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
            'category' => 'metaux',
        ])
        ->assertForbidden();
});
