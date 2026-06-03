<?php

use App\Support\MaterialPresets;

it('merges material names with defaults', function () {
    $options = MaterialPresets::nameOptions([
        (object) ['name' => 'Perceuse'],
    ]);

    expect($options)->toContain('Perceuse');
    expect($options)->toContain('Bêche');
    expect($options)->toContain('Marteau');
});

it('merges categories and units with defaults', function () {
    $categories = MaterialPresets::categoryOptions([]);
    $units = MaterialPresets::unitOptions([]);

    expect($categories)->toContain('construction');
    expect($categories)->toContain('outillage');
    expect($units)->toContain('sacs');
    expect($units)->toContain('pieces');
});
