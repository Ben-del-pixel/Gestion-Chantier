<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('resource_requests', function (Blueprint $table) {
            // SQLite doesn't support modifying columns directly for ENUMs easily,
            // but Laravel 11/13 handles it better with change().
            // However, to be safe and compatible, we'll use a string if it's SQLite or just update.
            $table->string('status')->default('en_attente')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('resource_requests', function (Blueprint $table) {
            $table->enum('status', ['en_attente', 'approuve', 'rejete', 'livre'])->default('en_attente')->change();
        });
    }
};
