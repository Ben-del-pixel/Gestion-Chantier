<?php

namespace App\Models;

use App\Enums\AttendanceShift;
use App\Enums\AttendanceStatus;
use Database\Factories\AttendanceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    /** @use HasFactory<AttendanceFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'project_id',
        'date',
        'shift',
        'check_in',
        'check_out',
        'status',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'date' => 'date',
        'shift' => AttendanceShift::class,
        'check_in' => 'datetime',
        'check_out' => 'datetime',
        'status' => AttendanceStatus::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
