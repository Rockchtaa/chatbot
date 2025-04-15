<script setup>
import { useUserStore } from '../stores/user';
import { useRouter } from 'vue-router';
import robotImage from '../assets/robot.png';

const userStore = useUserStore();
const router = useRouter();

const logout = () => {
  userStore.logout();
  router.push('/');
};
</script>

<template>
  <div
    class="py-4 px-6 bg-gray-800 shadow-md flex justify-between items-center"
  >
    <img :src="robotImage" alt="Chat AI" class="w-8 h-8" />
    <h1 class="text-lg font-semibold">Chat AI</h1>
    <button @click="logout" class="text-gray-400 hover:text-white">
      Logout
    </button>
  </div>
</template>