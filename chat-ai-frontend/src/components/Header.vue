<script setup>
import robotImage from '../assets/robot.png';
</script>

<template>
  <div
    class="py-4 px-6 bg-gray-800 shadow-md flex justify-between items-center"
  >
    <div class="flex items-center gap-3">
      <img :src="robotImage" alt="Chat AI" class="w-8 h-8" />
      <h1 class="text-lg font-semibold">Chat AI</h1>
    </div>
  </div>
</template>