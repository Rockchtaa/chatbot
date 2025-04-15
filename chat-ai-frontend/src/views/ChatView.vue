<script setup>
import { useUserStore } from '../stores/user';
import { useChatStore } from '../stores/chat';
import { useRouter } from 'vue-router';
import Header from '../components/Header.vue';

const userStore = useUserStore();
const chatStore = useChatStore();
const router = useRouter();

// Ensure user is logged in
if (!userStore.userId) {
  router.push('/');
}
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-900 text-white">
    <Header />

    <!-- Chat messages -->
    <div id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4">


    </div>
    <div v-if="chatStore.isLoading" class="flex justify-start">
      <div class="bg-gray-700 text-white px-4 py-2 rounded-lg">
        <span class="animate-pulse">AI is thinking...</span>
      </div>
    </div>
  </div>

</template>