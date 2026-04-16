<?php

namespace App\Enums;

enum AttendanceStatus: string
{
    case Present = 'present';
    case Absent = 'absent';
    case Late = 'retard';
    case Sick = 'malade';

    public function label(): string
    {
        return match ($this) {
            self::Present => 'Présent',
            self::Absent => 'Absent',
            self::Late => 'Retard',
            self::Sick => 'Malade',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Present => 'text-green-600 bg-green-50',
            self::Absent => 'text-red-600 bg-red-50',
            self::Late => 'text-orange-600 bg-orange-50',
            self::Sick => 'text-yellow-600 bg-yellow-50',
        };
    }
}
