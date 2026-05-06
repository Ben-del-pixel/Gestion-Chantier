<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectWorker extends Model
{
    protected $fillable = [
        'project_id',
        'worker_id',
        'chef_chantier_id',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function worker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'worker_id');
    }

    public function chefChantier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'chef_chantier_id');
    }
}
