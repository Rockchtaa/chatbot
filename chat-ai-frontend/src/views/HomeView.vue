<script setup>
import { useChatStore } from '../stores/chat';
import Header from '../components/Header.vue';
import { onMounted, nextTick } from 'vue';

const chatStore = useChatStore();

const scrollToBottom = () => {
  nextTick(() => {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  });
};

onMounted(() => {
  chatStore.loadChatHistory().then(scrollToBottom);
});

const sendMessage = () => {
  chatStore.sendMessage(chatStore.inputMessage);
  scrollToBottom();
};
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-900 text-white">
    <Header />

    <!-- Chat messages -->
    <div id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-for="(msg, index) in chatStore.messages" :key="index" class="flex items-start mb-4"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">

        <!-- Message -->
        <div class="rounded-lg shadow-md px-4 py-3 max-w-xs md:max-w-md break-words"
          :class="msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'">
          <div v-html="msg.formattedContent || msg.content" class="message-content"></div>
          <div class="text-xs text-gray-400 mt-2">{{ msg.timestamp }}</div>
        </div>
      </div>

      <!-- Loading spinner -->
      <div v-if="chatStore.isLoading" class="flex items-center justify-center p-4">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    </div>

    <!-- Chat input -->
    <div class="p-4 bg-gray-800 border-t border-gray-700 flex items-center space-x-3">
      <div class="flex-1 relative">
        <textarea v-model="chatStore.inputMessage"
          @keydown.enter.exact.prevent="sendMessage" rows="1"
          placeholder="Type your message..."
          class="w-full p-3 pr-12 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          style="min-height: 44px; max-height: 120px; overflow-y: auto;"></textarea>
        <button @click="sendMessage"
          class="absolute right-2 bottom-2 p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.message-content code {
  font-family: monospace;
  background-color: rgba(30, 41, 59, 0.8);
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.message-content pre {
  background-color: rgba(30, 41, 59, 0.5);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin: 0.5rem 0;
  overflow-x: auto;
}

.message-content ul {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
  list-style-type: disc;
}

.message-content ol {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
  list-style-type: decimal;
}

.message-content h1 {
  font-size: 1.25rem;
  font-weight: bold;
  margin: 0.75rem 0;
}

.message-content h2 {
  font-size: 1.125rem;
  font-weight: bold;
  margin: 0.5rem 0;
}

.message-content h3 {
  font-size: 1rem;
  font-weight: bold;
  margin: 0.5rem 0;
}

.message-content a {
  color: #60a5fa;
  text-decoration: none;
}

.message-content a:hover {
  text-decoration: underline;
}

.message-content blockquote {
  border-left: 4px solid #6b7280;
  padding-left: 0.75rem;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  margin: 0.5rem 0;
  font-style: italic;
  background-color: rgba(30, 41, 59, 0.3);
}
</style>