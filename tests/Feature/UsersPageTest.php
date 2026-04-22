<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to login when visiting users page', function () {
    $this->get(route('users.index'))->assertRedirect(route('login'));
});

test('authenticated users can view main-d oeuvre page', function () {
    $user = User::factory()->create();
    User::factory()->create([
        'name' => 'Alice Ouvrière',
        'email' => 'alice@chantier.cd',
    ]);

    $this->actingAs($user)
        ->get(route('users.index'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('users/index')
            ->has('users', 2)
            ->where('users.1.name', 'Alice Ouvrière')
        );
});
