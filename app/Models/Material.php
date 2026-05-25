<?php

namespace App\Models;

use Database\Factories\MaterialFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Material extends Model
{
    /** @use HasFactory<MaterialFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'quantity_in_stock',
        'unit',
        'type',
        'category',
        'storekeeper_id',
        'project_id',
        'project_step_id',
    ];

    protected $casts = [
        'quantity_in_stock' => 'decimal:2',
    ];

    public function movements(): HasMany
    {
        return $this->hasMany(MaterialMovement::class);
    }

    public function storekeeper(): BelongsTo
    {
        return $this->belongsTo(User::class, 'storekeeper_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function projectStep(): BelongsTo
    {
        return $this->belongsTo(ProjectStep::class, 'project_step_id');
    }
}
