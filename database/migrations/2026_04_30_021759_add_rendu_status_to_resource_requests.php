<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // On SQLite, we can't easily change enums, but Laravel treats them as string usually.
        // We will just let it be. If we really want to be strict, we'd recreate the table.
        // But for now, we'll just implement the logic in code.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
