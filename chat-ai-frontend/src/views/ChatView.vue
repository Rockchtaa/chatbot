<script setup>
import { useUserStore } from '../stores/user';
import { useChatStore } from '../stores/chat';
import { useRouter } from 'vue-router';
import Header from '../components/Header.vue';
import { onMounted, nextTick } from 'vue';

const userStore = useUserStore();
const chatStore = useChatStore();
const router = useRouter();

// Ensure user is logged in
if (!userStore.userId) {
  router.push('/');
}
const scrollToBottom = () => {
  nextTick(() => {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  });
};

onMounted(() => {
  chatStore.loadChatHistory().then(scrollToBottom);
});
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-900 text-white">
    <Header />

    <!-- Chat messages -->
    <div id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-for="(msg, index) in chatStore.messages" :key="index" class="flex items-start"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
        <div class="max-w-xs px-4 py-2 rounded-lg md:max-w-md" :class="msg.role === 'user'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-white'
          ">{{ msg.content }}</div>
      </div>
    </div>

    <!-- Chat input -->
    <div class="p-4 bg-gray-800 flex items-center space-x-4">
      <input v-model="chatStore.inputMessage" @keyup.enter="chatStore.sendMessage(chatStore.inputMessage)" type="text"
        placeholder="Type your message..." class="flex-1 p-2 bg-gray-700 text-white rounded-lg focus:outline-none" />

      <button @click="chatStore.sendMessage(chatStore.inputMessage)"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Send
      </button>
    </div>
    
  </div>
</template>